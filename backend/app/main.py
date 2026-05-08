import asyncio
import io
import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import AsyncOpenAI, APIStatusError, APIConnectionError, RateLimitError
from app.config import get_settings
from app.dependencies import get_ai_client
from app.middleware import RateLimitMiddleware
from app.agent.core import run_agent
from app.agent.memory import compress_conversation
from app.math_wiki.admin_router import router as admin_router

logger = logging.getLogger(__name__)


async def _register_codecs(conn) -> None:
    # Create extension first so the vector type exists before codec registration
    await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
    import pgvector.asyncpg
    await pgvector.asyncpg.register_vector(conn)


_SCHEMA_DDL = [
    "CREATE EXTENSION IF NOT EXISTS vector",
    """CREATE TABLE IF NOT EXISTS wiki_units (
        id TEXT PRIMARY KEY, type TEXT NOT NULL, topic TEXT NOT NULL,
        subtopic TEXT NOT NULL, content TEXT NOT NULL,
        problem_ids TEXT NOT NULL DEFAULT '[]',
        source TEXT NOT NULL DEFAULT 'manual', source_url TEXT,
        deleted BOOLEAN NOT NULL DEFAULT FALSE,
        version INTEGER NOT NULL DEFAULT 1, last_edited_by TEXT,
        embedding vector(1024),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS problems (
        problem_id TEXT PRIMARY KEY, problem_text TEXT NOT NULL,
        choices TEXT, correct_answer TEXT,
        topic TEXT NOT NULL, subtopic TEXT NOT NULL,
        difficulty TEXT NOT NULL, problem_type TEXT NOT NULL,
        figure_svg TEXT, problem_hash TEXT,
        figure_type TEXT NOT NULL DEFAULT 'svg'
    )""",
    """CREATE TABLE IF NOT EXISTS wiki_unit_history (
        id SERIAL PRIMARY KEY, unit_id TEXT NOT NULL,
        version INTEGER NOT NULL, content TEXT NOT NULL,
        edited_by TEXT, reason TEXT,
        edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS unit_feedback (
        id SERIAL PRIMARY KEY, unit_id TEXT NOT NULL,
        problem_text TEXT, feedback_type TEXT NOT NULL DEFAULT 'general',
        comment TEXT, resolved BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS flagged_solutions (
        id SERIAL PRIMARY KEY, problem_text TEXT NOT NULL,
        problem_hash TEXT NOT NULL, solver_output TEXT NOT NULL,
        flag_reason TEXT, reviewed BOOLEAN NOT NULL DEFAULT FALSE,
        flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS wiki_drafts (
        draft_id TEXT PRIMARY KEY, source_url TEXT,
        source_text TEXT NOT NULL,
        proposed_units_json TEXT NOT NULL DEFAULT '[]',
        final_units_json TEXT, topic_hint TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by TEXT, reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS solution_logs (
        id SERIAL PRIMARY KEY, problem_text TEXT NOT NULL,
        problem_hash TEXT NOT NULL, classified_topic TEXT NOT NULL,
        retrieved_ids TEXT NOT NULL DEFAULT '[]',
        used_knowledge_ids TEXT NOT NULL DEFAULT '[]',
        solver_confidence TEXT NOT NULL DEFAULT 'medium',
        validation_valid BOOLEAN NOT NULL DEFAULT FALSE,
        validation_issues TEXT NOT NULL DEFAULT '[]',
        wiki_assisted BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS staged_wiki_units (
        staged_id TEXT PRIMARY KEY, unit_data TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual', source_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        proposed_by TEXT NOT NULL DEFAULT 'system',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS wiki_units_topic_idx ON wiki_units (topic)",
    "CREATE INDEX IF NOT EXISTS wiki_units_deleted_idx ON wiki_units (deleted)",
    "CREATE INDEX IF NOT EXISTS problems_hash_idx ON problems (problem_hash)",
    "CREATE INDEX IF NOT EXISTS solution_logs_created_idx ON solution_logs (created_at)",
    "CREATE INDEX IF NOT EXISTS staged_wiki_units_status_idx ON staged_wiki_units (status)",
    "CREATE INDEX IF NOT EXISTS wiki_units_embedding_hnsw ON wiki_units USING hnsw (embedding vector_cosine_ops)",
]


async def _hf_set_space_variable(key: str, value: str) -> None:
    """Update a HF Space variable via the Hub API (no-op outside HF Spaces)."""
    import os
    space_id = os.environ.get("SPACE_ID")
    hf_token = os.environ.get("HF_TOKEN")
    if not space_id or not hf_token:
        return
    try:
        from huggingface_hub import HfApi
        HfApi(token=hf_token).add_space_variable(space_id, key, value)
        logger.info("HF Space variable %s set to %r", key, value)
    except Exception as exc:
        logger.warning("Could not update HF Space variable %s: %s", key, exc)


async def _auto_seed_wiki(pool, client) -> None:
    """Crawl and ingest wiki content on startup.

    Normal mode (CRAWL_AUTO_SEED_ENABLED=true): only runs when wiki_units is empty.
    Force-reseed mode (CRAWL_FORCE_RESEED=true): truncates wiki_units, resets the
    crawl-progress cache, then runs a full crawl regardless of existing data.
    After a successful forced reseed the app self-disables the flag via the HF API.
    """
    from app.math_wiki.storage import pg_db
    settings = get_settings()
    force = settings.crawl_force_reseed

    if force:
        logger.info("auto-seed: CRAWL_FORCE_RESEED=true — wiping wiki_units for fresh crawl")
        try:
            async with pool.acquire() as conn:
                await conn.execute("TRUNCATE TABLE wiki_units")
        except Exception as exc:
            logger.error("auto-seed: truncate failed: %s — aborting reseed", exc)
            return
    else:
        try:
            count = await pg_db.count_wiki_units(pool)
        except Exception as exc:
            logger.warning("auto-seed: could not count wiki_units: %s", exc)
            return
        if count > 0:
            logger.info("auto-seed: wiki already has %d units, skipping", count)
            return

    try:
        from crawl.runner import crawl_and_ingest
        from crawl.topic_map import AOPS_QUERIES
        from crawl.progress import reset as reset_crawl_progress
    except ImportError as exc:
        logger.warning("auto-seed: crawl module not available (%s), skipping", exc)
        return

    if force:
        reset_crawl_progress()

    logger.info("auto-seed: starting background crawl (%s)", "force-reseed" if force else "empty wiki")

    topics = list(AOPS_QUERIES.keys())
    crawl_ok = True
    for topic in topics:
        try:
            stats = await crawl_and_ingest(
                client, topics=[topic], sources=["aops", "pauls", "generic"], pool=pool
            )
            logger.info(
                "auto-seed [%s]: pages=%d units=%d errors=%d",
                topic, stats["pages_fetched"], stats["wiki_units_added"], stats["errors"],
            )
        except Exception as exc:
            logger.error("auto-seed [%s] failed: %s", topic, exc)
            crawl_ok = False
        await asyncio.sleep(3)

    try:
        final = await pg_db.count_wiki_units(pool)
        logger.info("auto-seed complete: %d wiki units in DB", final)
    except Exception:
        pass

    if force and crawl_ok:
        await _hf_set_space_variable("CRAWL_FORCE_RESEED", "false")


async def _apply_schema(pool) -> None:
    """Run DDL idempotently on every startup — all statements are CREATE IF NOT EXISTS."""
    async with pool.acquire() as conn:
        for stmt in _SCHEMA_DDL:
            try:
                await conn.execute(stmt)
            except Exception as exc:
                logger.warning("DDL skipped (%s): %.80s", exc, stmt)
    logger.info("Schema applied (%d statements)", len(_SCHEMA_DDL))


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncpg
    from app.math_wiki.pipeline import _wiki_status, _ensure_bm25

    settings = get_settings()
    if settings.database_url:
        try:
            app.state.pool = await asyncpg.create_pool(
                settings.database_url,
                min_size=1,
                max_size=5,
                statement_cache_size=0,
                max_inactive_connection_lifetime=240,
                init=_register_codecs,
            )
            logger.info("asyncpg pool connected to Neon")
            await _apply_schema(app.state.pool)
        except Exception as exc:
            logger.error("Failed to create asyncpg pool: %s", exc)
            app.state.pool = None
    else:
        logger.warning("DATABASE_URL not set — running without PostgreSQL pool")
        app.state.pool = None

    _wiki_status.update({"phase": "starting", "progress": 0, "error": None})
    asyncio.ensure_future(_ensure_bm25(app.state.pool))
    if app.state.pool and (settings.crawl_auto_seed_enabled or settings.crawl_force_reseed):
        asyncio.ensure_future(_auto_seed_wiki(app.state.pool, get_ai_client()))
    elif app.state.pool:
        logger.info("auto-seed disabled (set CRAWL_AUTO_SEED_ENABLED or CRAWL_FORCE_RESEED to enable)")
    yield

    if app.state.pool:
        await app.state.pool.close()


def get_pool(request: Request):
    return getattr(request.app.state, "pool", None)


app = FastAPI(title="AI Agent App", lifespan=lifespan)
app.include_router(admin_router)

settings = get_settings()
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    messages: list[dict]
    customer_name: str = ""
    funnel_stage: str = ""


class ChatResponse(BaseModel):
    reply: str
    messages: list[dict]


class CompressRequest(BaseModel):
    messages: list[dict]


class CompressResponse(BaseModel):
    summary: str


# ── Exam AI models ───────────────────────────────────────────────────────────

class ExamAnalyzeRequest(BaseModel):
    result: dict
    history: list[dict] = []
    student_name: str = ""


class ExamAnalyzeResponse(BaseModel):
    insights: str
    weak_topics: list[str]
    recommendations: list[str]


class HintRequest(BaseModel):
    question: dict
    attempt_count: int = 1
    previous_hints: list[str] = []


class HintResponse(BaseModel):
    hint: str
    difficulty_note: str = ""


class TutorChatRequest(BaseModel):
    messages: list[dict]
    exam_context: dict
    student_name: str = ""


class TutorChatResponse(BaseModel):
    reply: str
    messages: list[dict]


class ExplainRequest(BaseModel):
    question: dict
    chosen_index: int


class ExplainResponse(BaseModel):
    correct_index: int
    explanation: str


class StudyPlanRequest(BaseModel):
    result: dict
    history: list[dict] = []
    wrong_questions: list[dict] = []
    topic_miss_counts: dict = {}
    student_name: str = ""


class StudyPlanResponse(BaseModel):
    plan: str
    weekly_schedule: list[dict]


class MathIngestRequest(BaseModel):
    text: str


class MathSolveRequest(BaseModel):
    question: str


class MathSolveResponse(BaseModel):
    label: str | None = None
    answer: dict | None = None
    validation: dict | None = None
    retrieved_ids: list[str] = []
    error: str | None = None
    wiki_assisted: bool = True


class MathOcrResponse(BaseModel):
    text: str


class MathReviewRequest(BaseModel):
    problem: str
    solution: str


class MathReviewResponse(BaseModel):
    verdict: str
    score: str
    correct_steps: list[str]
    errors: list[str]
    feedback: str
    correct_approach: str = ""
    retrieved_ids: list[str] = []


# ── Existing routes ──────────────────────────────────────────────────────────

@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    return {"status": "ok"}


@app.get("/wiki/status")
async def wiki_status():
    from app.math_wiki.pipeline import get_wiki_status
    return get_wiki_status()


@app.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
):
    reply, updated = await run_agent(
        client,
        req.messages,
        customer_name=req.customer_name,
        funnel_stage=req.funnel_stage,
    )
    return ChatResponse(reply=reply, messages=updated)


@app.post("/compress", response_model=CompressResponse)
async def compress(
    req: CompressRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
):
    summary = await compress_conversation(client, req.messages)
    return CompressResponse(summary=summary)


# ── Exam AI routes ───────────────────────────────────────────────────────────

@app.post("/analyze", response_model=ExamAnalyzeResponse)
async def analyze(
    req: ExamAnalyzeRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
):
    from app.agent.exam_analyzer import analyze_exam_result
    try:
        data = await analyze_exam_result(client, req.result, req.history, req.student_name)
        return ExamAnalyzeResponse(
            insights=data.get("insights", ""),
            weak_topics=data.get("weak_topics", []),
            recommendations=data.get("recommendations", []),
        )
    except (ValueError, KeyError):
        raise HTTPException(status_code=502, detail="AI response parse error")


@app.post("/hint", response_model=HintResponse)
async def hint(
    req: HintRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
):
    from app.agent.hint_generator import generate_hint
    try:
        data = await generate_hint(client, req.question, req.attempt_count, req.previous_hints)
        return HintResponse(
            hint=data.get("hint", ""),
            difficulty_note=data.get("difficulty_note", ""),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Không thể tạo gợi ý: {exc}")


@app.post("/tutor", response_model=TutorChatResponse)
async def tutor(
    req: TutorChatRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
):
    from app.agent.exam_tutor import run_tutor
    reply, updated = await run_tutor(
        client, req.messages, req.exam_context, req.student_name
    )
    return TutorChatResponse(reply=reply, messages=updated)


@app.post("/explain", response_model=ExplainResponse)
async def explain(
    req: ExplainRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
):
    from app.agent.exam_explainer import generate_explanation
    try:
        data = await generate_explanation(client, req.question, req.chosen_index)
        return ExplainResponse(
            correct_index=data.get("correct_index", 0),
            explanation=data.get("explanation", ""),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Không thể tạo giải thích: {exc}")


@app.post("/study-plan", response_model=StudyPlanResponse)
async def study_plan(
    req: StudyPlanRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
):
    from app.agent.study_planner import generate_study_plan
    data = await generate_study_plan(client, req.result, req.history, req.wrong_questions, req.topic_miss_counts, req.student_name)
    return StudyPlanResponse(
        plan=data.get("plan", ""),
        weekly_schedule=data.get("weekly_schedule", []),
    )


@app.post("/math-ingest")
async def math_ingest(req: MathIngestRequest, pool=Depends(get_pool)):
    client = get_ai_client()
    from app.math_wiki.agents.ingest import ingest_exam
    try:
        output = await ingest_exam(client, req.text, pool=pool)
        return {"problems": len(output.problems), "wiki_units": len(output.wiki_units)}
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=str(exc))


_ACCEPTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


@app.post("/math-ocr", response_model=MathOcrResponse)
async def math_ocr(file: UploadFile = File(...)):
    content_type = file.content_type or ""
    if content_type not in _ACCEPTED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported media type: {content_type!r}. Accepted: image/jpeg, image/png, image/webp",
        )

    MAX_SIZE = 5 * 1024 * 1024  # 5 MB
    content = await file.read(MAX_SIZE + 1)
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Image too large (max 5 MB)")

    client = get_ai_client()
    from app.math_wiki.agents.ocr import extract_math_from_image
    try:
        text = await extract_math_from_image(client, content, content_type)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        logger.error("math-ocr error: %s", exc)
        raise HTTPException(status_code=502, detail=f"OCR failed: {exc}")

    return MathOcrResponse(text=text)


@app.post("/math-solve", response_model=MathSolveResponse)
async def math_solve(req: MathSolveRequest, pool=Depends(get_pool)):
    client = get_ai_client()
    from app.math_wiki.pipeline import run_pipeline
    for attempt in range(2):
        try:
            return await asyncio.wait_for(run_pipeline(pool, client, req.question), timeout=55)
        except asyncio.TimeoutError:
            if attempt == 0:
                logger.warning("math-solve attempt 1 timed out, retrying")
                continue
            raise HTTPException(status_code=504, detail="Pipeline timed out — try again")
        except HTTPException:
            raise
        except (json.JSONDecodeError, ValueError) as exc:
            raise HTTPException(status_code=502, detail=str(exc))
        except RateLimitError as exc:
            raise HTTPException(status_code=429, detail=f"AI service rate limit: {exc}")
        except (APIStatusError, APIConnectionError) as exc:
            logger.error("math-solve AI client error: %s", exc)
            raise HTTPException(status_code=502, detail=f"AI service error: {exc}")
        except Exception as exc:
            logger.exception("math-solve unexpected error: %s", exc)
            raise HTTPException(status_code=502, detail=f"Pipeline error: {exc}")


@app.post("/math-review", response_model=MathReviewResponse)
async def math_review(req: MathReviewRequest, pool=Depends(get_pool)):
    client = get_ai_client()
    from app.math_wiki.agents.reviewer import review_solution
    from app.math_wiki.pipeline import _retrieve_rerank_context
    retrieved_ids, context = await _retrieve_rerank_context(pool, client, req.problem)
    try:
        result = await review_solution(client, req.problem, req.solution, context)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        logger.error("math-review error: %s", exc)
        raise HTTPException(status_code=502, detail=f"Review failed: {exc}")
    return MathReviewResponse(
        verdict=result.verdict,
        score=result.score,
        correct_steps=result.correct_steps,
        errors=result.errors,
        feedback=result.feedback,
        correct_approach=result.correct_approach,
        retrieved_ids=retrieved_ids,
    )


@app.post("/math-upload")
async def math_upload(file: UploadFile = File(...), pool=Depends(get_pool)):
    MAX_SIZE = 10 * 1024 * 1024  # 10MB
    content = await file.read(MAX_SIZE + 1)
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    filename = file.filename or ""
    content_type = file.content_type or ""

    if filename.lower().endswith(".pdf") or content_type == "application/pdf":
        try:
            from pypdf import PdfReader
        except ImportError:
            raise HTTPException(status_code=501, detail="pypdf not installed")
        reader = PdfReader(io.BytesIO(content))
        pages = [p.extract_text() or "" for p in reader.pages]
        raw_text = "\n\n".join(p.strip() for p in pages if p.strip())
    elif content_type in _ACCEPTED_IMAGE_TYPES:
        upload_client = get_ai_client()
        from app.math_wiki.agents.ocr import extract_math_from_image
        try:
            raw_text = await extract_math_from_image(upload_client, content, content_type)
        except ValueError as exc:
            raise HTTPException(status_code=502, detail=str(exc))
    elif content_type.startswith("text/") or not content_type:
        raw_text = content.decode("utf-8", errors="replace")
    else:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {content_type!r}")

    chunk_size = 3000
    chunks = [raw_text[i:i + chunk_size] for i in range(0, len(raw_text), chunk_size)] if raw_text else []

    client = get_ai_client()
    from app.math_wiki.agents.ingest import ingest_exam
    total_problems = total_wiki = 0
    try:
        for chunk in chunks:
            output = await ingest_exam(client, chunk, pool=pool)
            total_problems += len(output.problems)
            total_wiki += len(output.wiki_units)
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {"chunks_ingested": len(chunks), "problems": total_problems, "wiki_units": total_wiki}


@app.get("/metrics")
async def metrics(x_admin_key: str | None = None, pool=Depends(get_pool)):
    from app.metrics import get_metrics
    from app.math_wiki.storage.analytics import get_unit_usage_stats
    settings = get_settings()
    expected = getattr(settings, "admin_key", None)
    if expected and x_admin_key != expected:
        raise HTTPException(status_code=401, detail="Invalid admin key")
    data = get_metrics()
    if pool:
        try:
            async with pool.acquire() as conn:
                db_size = await conn.fetchval("SELECT pg_database_size(current_database())")
                data["pg_database_size_bytes"] = db_size
        except Exception:
            pass
        try:
            data["top_units"] = await get_unit_usage_stats(pool, days=30)
        except Exception:
            pass
    return data


@app.get("/math-gaps")
async def math_gaps(threshold: int = 5, pool=Depends(get_pool)):
    from app.math_wiki.storage import pg_db
    from app.math_wiki.taxonomy import CANONICAL_TOPICS
    topic_counts = await pg_db.count_wiki_units_by_topic(pool)
    gaps = [
        {"topic": t, "count": topic_counts.get(t, 0)}
        for t in CANONICAL_TOPICS
        if topic_counts.get(t, 0) < threshold
    ]
    return sorted(gaps, key=lambda x: x["count"])


@app.get("/math-stats")
async def math_stats(pool=Depends(get_pool)):
    from app.math_wiki.storage import pg_db
    return {
        "problems": await pg_db.count_problems(pool),
        "wiki_units": await pg_db.count_wiki_units(pool),
        "topics": await pg_db.count_wiki_units_by_topic(pool),
    }

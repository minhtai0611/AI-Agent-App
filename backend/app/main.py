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
    import pgvector.asyncpg
    await pgvector.asyncpg.register_vector(conn)


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
        except Exception as exc:
            logger.error("Failed to create asyncpg pool: %s", exc)
            app.state.pool = None
    else:
        logger.warning("DATABASE_URL not set — running without PostgreSQL pool")
        app.state.pool = None

    _wiki_status.update({"phase": "starting", "progress": 0, "error": None})
    asyncio.ensure_future(_ensure_bm25(app.state.pool))
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


@app.post("/math-upload")
async def math_upload(file: UploadFile = File(...), pool=Depends(get_pool)):
    MAX_SIZE = 10 * 1024 * 1024  # 10MB
    content = await file.read(MAX_SIZE + 1)
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    filename = file.filename or ""
    if filename.lower().endswith(".pdf"):
        try:
            from pypdf import PdfReader
        except ImportError:
            raise HTTPException(status_code=501, detail="pypdf not installed")
        reader = PdfReader(io.BytesIO(content))
        pages = [p.extract_text() or "" for p in reader.pages]
        raw_text = "\n\n".join(p.strip() for p in pages if p.strip())
    else:
        raw_text = content.decode("utf-8", errors="replace")

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

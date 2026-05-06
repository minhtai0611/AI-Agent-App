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

HF_DATASET_REPO = "MinhTai/ai-agent-app-storage"
HF_DB_FILENAME  = "math_wiki.db"


def _db_unit_count(path: str) -> int | None:
    """Return wiki_unit count for a DB file, or None if unreadable/malformed."""
    import sqlite3
    try:
        conn = sqlite3.connect(path)
        n = conn.execute("SELECT COUNT(*) FROM wiki_units WHERE deleted=0").fetchone()[0]
        conn.close()
        return n
    except Exception:
        return None


def _seed_db_if_empty() -> None:
    """Download math_wiki.db from HF hub when the configured DB is empty or malformed."""
    import os, shutil
    db_path = get_settings().math_wiki_db_path
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)

    count = _db_unit_count(db_path) if os.path.exists(db_path) else None
    if count and count > 0:
        logger.info("DB already populated (%d units) at %s — skipping download", count, db_path)
        return

    reason = "malformed" if (count is None and os.path.exists(db_path)) else "empty/missing"
    logger.info("DB %s — downloading from HF hub %s/%s", reason, HF_DATASET_REPO, HF_DB_FILENAME)
    try:
        from huggingface_hub import hf_hub_download
        # force_download bypasses the local cache in case a corrupt file was cached previously
        tmp = hf_hub_download(
            repo_id=HF_DATASET_REPO,
            filename=HF_DB_FILENAME,
            repo_type="dataset",
            force_download=True,
        )
        # Verify before replacing
        dl_count = _db_unit_count(tmp)
        if not dl_count:
            logger.warning("Downloaded DB is empty or malformed — aborting seed")
            return
        shutil.copy2(tmp, db_path)
        logger.info("DB seeded at %s (%d units)", db_path, dl_count)
    except Exception as exc:
        logger.warning("Could not seed DB from HF hub: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.math_wiki.pipeline import _wiki_status, _ensure_indexes
    _wiki_status.update({"phase": "starting", "progress": 0, "error": None})
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _seed_db_if_empty)
    loop.run_in_executor(None, _ensure_indexes)
    yield


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

# ── Existing models ──────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.math_wiki.pipeline import _wiki_status, _ensure_indexes
    _wiki_status.update({"phase": "starting", "progress": 0, "error": None})
    asyncio.get_event_loop().run_in_executor(None, _ensure_indexes)
    yield


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

# ── Existing models ──────────────────────────────────────────────────────────

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
async def math_ingest(req: MathIngestRequest):
    client = get_ai_client()
    from app.math_wiki.agents.ingest import ingest_exam
    try:
        output = await ingest_exam(client, req.text)
        return {"problems": len(output.problems), "wiki_units": len(output.wiki_units)}
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.post("/math-solve", response_model=MathSolveResponse)
async def math_solve(req: MathSolveRequest):
    client = get_ai_client()
    from app.math_wiki.pipeline import run_pipeline
    # Two attempts: first may be slow (index build); second benefits from warm cache.
    # 55 s × 2 = 110 s worst case, within the frontend's 130 s axios timeout.
    for attempt in range(2):
        try:
            return await asyncio.wait_for(run_pipeline(client, req.question), timeout=55)
        except asyncio.TimeoutError:
            if attempt == 0:
                logger.warning("math-solve attempt 1 timed out, retrying with warm cache")
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
async def math_upload(file: UploadFile = File(...)):
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
            output = await ingest_exam(client, chunk)
            total_problems += len(output.problems)
            total_wiki += len(output.wiki_units)
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {"chunks_ingested": len(chunks), "problems": total_problems, "wiki_units": total_wiki}


@app.get("/metrics")
async def metrics(x_admin_key: str | None = None):
    from app.metrics import get_metrics
    settings = get_settings()
    expected = getattr(settings, "admin_key", None)
    if expected and x_admin_key != expected:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid admin key")
    return get_metrics()


@app.get("/math-gaps")
async def math_gaps(threshold: int = 5):
    from app.math_wiki.storage.db import count_wiki_units_by_topic
    from app.math_wiki.taxonomy import CANONICAL_TOPICS
    topic_counts = count_wiki_units_by_topic()
    gaps = [
        {"topic": t, "count": topic_counts.get(t, 0)}
        for t in CANONICAL_TOPICS
        if topic_counts.get(t, 0) < threshold
    ]
    return sorted(gaps, key=lambda x: x["count"])


@app.get("/math-stats")
async def math_stats():
    from app.math_wiki.storage.db import count_problems, count_wiki_units, count_wiki_units_by_topic
    return {
        "problems": count_problems(),
        "wiki_units": count_wiki_units(),
        "topics": count_wiki_units_by_topic(),
    }

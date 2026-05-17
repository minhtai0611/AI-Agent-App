import asyncio
import hmac
import io
import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import AsyncOpenAI, APIStatusError, APIConnectionError, RateLimitError
from app.config import get_settings
from app.dependencies import get_ai_client, get_current_user, CurrentUser
from app.middleware import RateLimitMiddleware
from app.agent.core import run_agent
from app.agent.memory import compress_conversation
from app.math_wiki.admin_router import router as admin_router
from app.auth import verify_google_token, create_jwt

logger = logging.getLogger(__name__)


_SCHEMA_DDL = [
    """CREATE TABLE IF NOT EXISTS wiki_units (
        id TEXT PRIMARY KEY, type TEXT NOT NULL, topic TEXT NOT NULL,
        subtopic TEXT NOT NULL, content TEXT NOT NULL,
        problem_ids TEXT NOT NULL DEFAULT '[]',
        source TEXT NOT NULL DEFAULT 'manual', source_url TEXT,
        deleted INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1, last_edited_by TEXT,
        embedding TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
        id INTEGER PRIMARY KEY AUTOINCREMENT, unit_id TEXT NOT NULL,
        version INTEGER NOT NULL, content TEXT NOT NULL,
        edited_by TEXT, reason TEXT,
        edited_at TEXT NOT NULL DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS unit_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT, unit_id TEXT NOT NULL,
        problem_text TEXT, feedback_type TEXT NOT NULL DEFAULT 'general',
        comment TEXT, resolved INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS flagged_solutions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, problem_text TEXT NOT NULL,
        problem_hash TEXT NOT NULL, solver_output TEXT NOT NULL,
        flag_reason TEXT, reviewed INTEGER NOT NULL DEFAULT 0,
        flagged_at TEXT NOT NULL DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS wiki_drafts (
        draft_id TEXT PRIMARY KEY, source_url TEXT,
        source_text TEXT NOT NULL,
        proposed_units_json TEXT NOT NULL DEFAULT '[]',
        final_units_json TEXT, topic_hint TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by TEXT, reviewed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS solution_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, problem_text TEXT NOT NULL,
        problem_hash TEXT NOT NULL, classified_topic TEXT NOT NULL,
        retrieved_ids TEXT NOT NULL DEFAULT '[]',
        used_knowledge_ids TEXT NOT NULL DEFAULT '[]',
        solver_confidence TEXT NOT NULL DEFAULT 'medium',
        validation_valid INTEGER NOT NULL DEFAULT 0,
        validation_issues TEXT NOT NULL DEFAULT '[]',
        wiki_assisted INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS staged_wiki_units (
        staged_id TEXT PRIMARY KEY, unit_data TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual', source_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        proposed_by TEXT NOT NULL DEFAULT 'system',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )""",
    # Live migrations for existing DBs (ALTER TABLE is idempotent via try/except in _apply_schema)
    "ALTER TABLE users ADD COLUMN grade TEXT CHECK(grade IN ('9','10','11','12'))",
    "ALTER TABLE users ADD COLUMN school_type TEXT CHECK(school_type IN ('chuyên','công lập','quốc tế'))",
    "ALTER TABLE users ADD COLUMN province TEXT",
    "ALTER TABLE users ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'basic'",
    "ALTER TABLE users ADD COLUMN subscription_period TEXT NOT NULL DEFAULT 'monthly'",
    "ALTER TABLE users ADD COLUMN subscription_expires_at TEXT",
    "ALTER TABLE users ADD COLUMN credits_balance INTEGER NOT NULL DEFAULT 50",
    "ALTER TABLE users ADD COLUMN credits_reset_at TEXT",
    "ALTER TABLE users ADD COLUMN is_suspended INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN suspension_reason TEXT",
    "ALTER TABLE users ADD COLUMN tos_accepted_at TEXT",
    "ALTER TABLE users ADD COLUMN last_ip TEXT",
    """CREATE TABLE IF NOT EXISTS ai_credits_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        delta INTEGER NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS security_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        ip TEXT,
        event_type TEXT NOT NULL,
        confidence TEXT DEFAULT 'medium',
        detail TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    "CREATE INDEX IF NOT EXISTS ai_credits_log_user_idx ON ai_credits_log (user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS security_events_user_idx ON security_events (user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS security_events_type_idx ON security_events (event_type, created_at)",
    """CREATE TABLE IF NOT EXISTS question_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id TEXT NOT NULL,
        user_id INTEGER,
        reason TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    "ALTER TABLE users ADD COLUMN trial_used INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN trial_expires_at TEXT",
    "ALTER TABLE users ADD COLUMN is_deactivated INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN deactivated_at TEXT",
    "ALTER TABLE users ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN lock_reason TEXT",
    """CREATE TABLE IF NOT EXISTS deleted_google_subs (
        google_sub TEXT PRIMARY KEY,
        trial_used INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT DEFAULT (datetime('now'))
    )""",
    "CREATE INDEX IF NOT EXISTS wiki_units_topic_idx ON wiki_units (topic)",
    "CREATE INDEX IF NOT EXISTS wiki_units_deleted_idx ON wiki_units (deleted)",
    "CREATE INDEX IF NOT EXISTS problems_hash_idx ON problems (problem_hash)",
    "CREATE INDEX IF NOT EXISTS solution_logs_created_idx ON solution_logs (created_at)",
    "CREATE INDEX IF NOT EXISTS staged_wiki_units_status_idx ON staged_wiki_units (status)",
    """CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        google_sub TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        display_name TEXT,
        avatar_url TEXT,
        grade TEXT CHECK(grade IN ('9','10','11','12')),
        school_type TEXT CHECK(school_type IN ('chuyên','công lập','quốc tế')),
        province TEXT,
        subscription_tier TEXT NOT NULL DEFAULT 'basic',
        subscription_period TEXT NOT NULL DEFAULT 'monthly',
        subscription_expires_at TEXT,
        credits_balance INTEGER NOT NULL DEFAULT 50 CHECK(credits_balance >= 0),
        credits_reset_at TEXT,
        is_suspended INTEGER NOT NULL DEFAULT 0,
        suspension_reason TEXT,
        tos_accepted_at TEXT,
        last_ip TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS exam_results (
        result_id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        exam_id TEXT,
        score REAL,
        payload TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )""",
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
    Gap-fill mode (CRAWL_GAP_FILL_ENABLED=true): crawls only topics with zero units.
    After a successful forced reseed the app self-disables the flag via the HF API.
    """
    from app.math_wiki.storage import pg_db
    settings = get_settings()
    force = settings.crawl_force_reseed
    gap_fill = settings.crawl_gap_fill_enabled

    try:
        from crawl.runner import crawl_and_ingest
        from crawl.topic_map import AOPS_QUERIES
        from crawl.progress import reset as reset_crawl_progress
    except ImportError as exc:
        logger.warning("auto-seed: crawl module not available (%s), skipping", exc)
        return

    if force:
        logger.info("auto-seed: CRAWL_FORCE_RESEED=true — wiping wiki_units for fresh crawl")
        try:
            async with pool.acquire() as conn:
                await conn.execute("DELETE FROM wiki_units")
        except Exception as exc:
            logger.error("auto-seed: truncate failed: %s — aborting reseed", exc)
            return
        reset_crawl_progress()
        topics = list(AOPS_QUERIES.keys())
    elif gap_fill:
        try:
            topic_counts = await pg_db.count_wiki_units_by_topic(pool)
        except Exception as exc:
            logger.warning("auto-seed: could not count wiki_units by topic: %s", exc)
            return
        topics = [t for t in AOPS_QUERIES.keys() if topic_counts.get(t, 0) == 0]
        if not topics:
            logger.info("auto-seed: gap-fill — no zero-unit topics found, skipping")
            return
        logger.info("auto-seed: gap-fill — crawling %d zero-unit topics: %s", len(topics), topics)
    else:
        try:
            count = await pg_db.count_wiki_units(pool)
        except Exception as exc:
            logger.warning("auto-seed: could not count wiki_units: %s", exc)
            return
        if count > 0:
            logger.info("auto-seed: wiki already has %d units, skipping", count)
            return
        topics = list(AOPS_QUERIES.keys())

    logger.info("auto-seed: starting background crawl (%s)",
                "force-reseed" if force else ("gap-fill" if gap_fill else "empty wiki"))

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


async def _sanitize_wiki(pool) -> None:
    """Fix non-canonical labels and remove content duplicates; self-disables after success."""
    from app.math_wiki.storage.sanitizer import run_all
    try:
        report = await run_all(pool)
        logger.info(
            "wiki-sanitize complete: topic_remaps=%d topic_deletes=%d "
            "type_remaps=%d duplicates_removed=%d",
            report["topic_remaps"], report["topic_deletes"],
            report["type_remaps"], report["duplicates_removed"],
        )
        await _hf_set_space_variable("WIKI_SANITIZE_ENABLED", "false")
    except Exception as exc:
        logger.error("wiki-sanitize failed: %s", exc)


_VI_RE = __import__("re").compile(
    r"[àáảãạăắặẳẵằâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ"
    r"ÀÁẢÃẠĂẮẶẲẴẰÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ]"
)

_TRANSLATE_SYSTEM = (
    "You are a Vietnamese math translator. Translate the given English math knowledge unit "
    "into Vietnamese.\n\n"
    "Rules:\n"
    "- Output ONLY the translated content string — no JSON, no labels, no explanation.\n"
    "- Preserve ALL math expressions exactly: keep $...$ and $$...$$ delimiters, LaTeX commands, "
    "and variable names unchanged.\n"
    "- Write all prose, procedure names, and explanations in Vietnamese.\n"
    "- Keep the same structure and level of detail as the original.\n"
    "- Do NOT add any introductory phrase like \"Dưới đây là...\" — start the content directly."
)


async def _fix_english_wiki_units(pool, client) -> None:
    """Translate English wiki units (exam_upload source) to Vietnamese; self-disables after success."""
    import json as _json
    from app.config import get_settings as _gs
    from app.math_wiki.storage import pg_db
    from app.math_wiki.schemas import WikiUnit
    from app.agent.core import call_with_retry

    settings = _gs()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT id, type, topic, subtopic, content, problem_ids, source, source_url "
                "FROM wiki_units WHERE deleted = false AND source = 'exam_upload'"
            )

        english = [r for r in rows if not _VI_RE.search(r["content"])]
        logger.info("fix-english-wiki: %d exam_upload units, %d need translation", len(rows), len(english))

        ok = failed = 0
        for r in english:
            try:
                resp = await call_with_retry(
                    client,
                    model=settings.opus_model,
                    messages=[
                        {"role": "system", "content": _TRANSLATE_SYSTEM},
                        {"role": "user", "content": r["content"]},
                    ],
                    max_tokens=1024,
                )
                translated = (resp.choices[0].message.content or "").strip()
                if not translated:
                    raise ValueError("empty response")
                unit = WikiUnit(
                    id=r["id"], type=r["type"], topic=r["topic"],
                    subtopic=r["subtopic"] or "",
                    content=translated,
                    problem_ids=[] if r["problem_ids"] is None else _json.loads(r["problem_ids"]),
                )
                await pg_db.upsert_wiki_unit(
                    pool, unit,
                    source=r["source"], source_url=r["source_url"],
                    editor="fix_english_wiki_units",
                    reason="Translated English content to Vietnamese (PROMPT_INGEST language rule was missing)",
                )
                ok += 1
            except Exception as exc:
                logger.warning("fix-english-wiki: failed %s — %s", r["id"], exc)
                failed += 1

        logger.info("fix-english-wiki complete: translated=%d failed=%d", ok, failed)
        if failed == 0:
            await _hf_set_space_variable("WIKI_FIX_ENGLISH_ENABLED", "false")
        else:
            logger.warning("fix-english-wiki: %d failures — flag not auto-disabled", failed)
    except Exception as exc:
        logger.error("fix-english-wiki failed: %s", exc)


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
    from app.db import AsyncSQLitePool
    from app.math_wiki.pipeline import _wiki_status, _ensure_bm25

    settings = get_settings()
    pool = AsyncSQLitePool(settings.sqlite_path)
    await pool.initialize()
    app.state.pool = pool
    await _apply_schema(app.state.pool)
    logger.info("SQLite pool ready at %s", settings.sqlite_path)

    _wiki_status.update({"phase": "starting", "progress": 0, "error": None})
    asyncio.ensure_future(_ensure_bm25(app.state.pool))
    from app.abuse_detector import _run_abuse_detector
    asyncio.ensure_future(_run_abuse_detector(app.state.pool))
    if app.state.pool and (settings.crawl_auto_seed_enabled or settings.crawl_force_reseed or settings.crawl_gap_fill_enabled):
        asyncio.ensure_future(_auto_seed_wiki(app.state.pool, get_ai_client()))
    elif app.state.pool:
        logger.info("auto-seed disabled (set CRAWL_AUTO_SEED_ENABLED, CRAWL_FORCE_RESEED, or CRAWL_GAP_FILL_ENABLED to enable)")
    if app.state.pool and settings.wiki_sanitize_enabled:
        asyncio.ensure_future(_sanitize_wiki(app.state.pool))
    if app.state.pool and settings.wiki_fix_english_enabled:
        asyncio.ensure_future(_fix_english_wiki_units(app.state.pool, get_ai_client()))
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
    wrong_questions: list[dict] = []
    school_recommendations: list[dict] = []
    exam_category: str = ""
    user_profile: dict = {}


class ExamAnalyzeResponse(BaseModel):
    insights: str
    weak_topics: list[str]
    recommendations: list[str]
    question_analysis: str = ""
    school_insight: str = ""


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


class WeekQuizRequest(BaseModel):
    week_focus: str
    week_tasks: list[str]
    n: int = 4


class WeekQuizResponse(BaseModel):
    questions: list[dict]


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
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    await _spend_credits(pool, current_user.user_id, 3, "analyze")
    from app.agent.exam_analyzer import analyze_exam_result
    try:
        data = await analyze_exam_result(
            client, req.result, req.history, req.student_name,
            wrong_questions=req.wrong_questions,
            school_recommendations=req.school_recommendations,
            exam_category=req.exam_category,
            user_profile=req.user_profile,
        )
        return ExamAnalyzeResponse(
            insights=data.get("insights", ""),
            weak_topics=data.get("weak_topics", []),
            recommendations=data.get("recommendations", []),
            question_analysis=data.get("question_analysis", ""),
            school_insight=data.get("school_insight", ""),
        )
    except (ValueError, KeyError):
        raise HTTPException(status_code=502, detail="AI response parse error")


@app.post("/analyze/stream")
async def analyze_stream(
    req: ExamAnalyzeRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Stream the AI analysis as SSE text/event-stream.
    Each event is `data: <token>\\n\\n`; the final event is `data: [DONE]\\n\\n`.
    Credits are deducted upfront before the stream starts.
    """
    from fastapi.responses import StreamingResponse
    from app.agent.exam_analyzer import build_analyze_prompt, STATIC_EXAM_ANALYSIS_INSTRUCTIONS
    await _spend_credits(pool, current_user.user_id, 3, "analyze")

    prompt = build_analyze_prompt(
        req.result, req.history, req.student_name,
        wrong_questions=req.wrong_questions,
        exam_category=req.exam_category,
        user_profile=req.user_profile,
    )
    settings = get_settings()

    async def event_stream():
        try:
            stream = await client.chat.completions.create(
                model=settings.default_model,
                max_tokens=1200,
                messages=[
                    {"role": "system", "content": STATIC_EXAM_ANALYSIS_INSTRUCTIONS},
                    {"role": "user", "content": prompt},
                ],
                stream=True,
            )
            async for chunk in stream:
                token = chunk.choices[0].delta.content if chunk.choices else None
                if token:
                    yield f"data: {json.dumps(token)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/hint", response_model=HintResponse)
async def hint(
    req: HintRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    await _spend_credits(pool, current_user.user_id, 1, "hint")
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
    current_user: CurrentUser = Depends(get_current_user),
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
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    await _spend_credits(pool, current_user.user_id, 1, "explain")
    from app.agent.exam_explainer import generate_explanation
    try:
        data = await generate_explanation(client, req.question, req.chosen_index)
        return ExplainResponse(
            correct_index=data.get("correct_index", 0),
            explanation=data.get("explanation", ""),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Không thể tạo giải thích: {exc}")


_PAID_TIERS = {"student", "complete"}


@app.post("/study-plan", response_model=StudyPlanResponse)
async def study_plan(
    req: StudyPlanRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    user_row = await pool.fetchrow(
        "SELECT subscription_tier FROM users WHERE id = ?", current_user.user_id
    )
    if not user_row or user_row["subscription_tier"] not in _PAID_TIERS:
        raise HTTPException(
            status_code=403,
            detail={"code": "tier_required", "required": "student", "message": "Cần gói Học sinh hoặc Toàn diện để tạo kế hoạch học tập"},
        )
    await _spend_credits(pool, current_user.user_id, 5, "study-plan")
    from app.agent.study_planner import generate_study_plan
    data = await generate_study_plan(client, req.result, req.history, req.wrong_questions, req.topic_miss_counts, req.student_name)
    return StudyPlanResponse(
        plan=data.get("plan", ""),
        weekly_schedule=data.get("weekly_schedule", []),
    )


@app.post("/study-plan-quiz", response_model=WeekQuizResponse)
async def study_plan_quiz(
    req: WeekQuizRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    from app.math_wiki.agents.quiz_generator import generate_week_quiz
    n = max(1, min(req.n, 6))
    try:
        questions = await generate_week_quiz(client, pool, req.week_focus, req.week_tasks, n)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Quiz generation failed: {exc}")
    return WeekQuizResponse(questions=questions)


@app.post("/math-ingest")
async def math_ingest(
    req: MathIngestRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
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
async def math_solve(
    req: MathSolveRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
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
async def math_review(
    req: MathReviewRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
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
async def math_upload(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
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
async def metrics(request: Request, pool=Depends(get_pool)):
    from app.metrics import get_metrics
    from app.math_wiki.storage.analytics import get_unit_usage_stats
    _require_admin(request)
    data = get_metrics()
    if pool:
        try:
            import os
            from app.config import get_settings as _gs
            db_path = _gs().sqlite_path
            data["sqlite_size_bytes"] = os.path.getsize(db_path) if os.path.exists(db_path) else 0
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


# ── Auth endpoints ────────────────────────────────────────────────────────────

class GoogleAuthRequest(BaseModel):
    id_token: str


@app.post("/auth/google")
async def auth_google(body: GoogleAuthRequest, pool=Depends(get_pool)):
    try:
        google_payload = await verify_google_token(body.id_token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired Google token") from exc

    google_sub = google_payload["sub"]
    email = google_payload.get("email", "")
    display_name = google_payload.get("name")
    avatar_url = google_payload.get("picture")

    # Check if this google_sub previously hard-deleted their account to preserve trial_used
    deleted_sub = await pool.fetchrow(
        "SELECT trial_used FROM deleted_google_subs WHERE google_sub = $1",
        google_sub,
    )
    preserved_trial_used = deleted_sub["trial_used"] if deleted_sub else 0

    row = await pool.fetchrow(
        """
        INSERT INTO users (google_sub, email, display_name, avatar_url, trial_used, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (google_sub) DO UPDATE
          SET display_name = EXCLUDED.display_name,
              avatar_url = EXCLUDED.avatar_url,
              updated_at = NOW()
        RETURNING id, email, display_name, avatar_url
        """,
        google_sub, email, display_name, avatar_url, preserved_trial_used,
    )

    token = create_jwt(row["id"])
    return {
        "access_token": token,
        "user": {
            "id": row["id"],
            "email": row["email"],
            "display_name": row["display_name"],
            "avatar_url": row["avatar_url"],
        },
    }


# ── User endpoints ────────────────────────────────────────────────────────────

@app.get("/users/me")
async def get_me(current_user: CurrentUser = Depends(get_current_user), pool=Depends(get_pool)):
    row = await pool.fetchrow(
        """SELECT id, email, display_name, avatar_url,
                  grade, school_type, province,
                  subscription_tier, subscription_period, subscription_expires_at,
                  credits_balance, credits_reset_at,
                  is_suspended, suspension_reason, tos_accepted_at,
                  trial_used, trial_expires_at,
                  is_deactivated, is_locked, lock_reason
           FROM users WHERE id = $1""",
        current_user.user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    row = dict(row)
    # Enforce trial expiry: downgrade to basic if 7-day trial has elapsed
    if row.get("trial_used") and row.get("subscription_tier") == "student" and row.get("trial_expires_at"):
        from datetime import datetime, timezone
        expires = datetime.fromisoformat(row["trial_expires_at"])
        if expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            await pool.execute(
                "UPDATE users SET subscription_tier = 'basic', updated_at = NOW() WHERE id = $1",
                current_user.user_id,
            )
            row["subscription_tier"] = "basic"
    return row


_VALID_GRADES = {"9", "10", "11", "12"}
_VALID_SCHOOL_TYPES = {"chuyên", "công lập", "quốc tế"}


class ProfileUpdateRequest(BaseModel):
    grade: str | None = None
    school_type: str | None = None
    province: str | None = None


@app.post("/users/me/profile")
@app.patch("/users/me/profile")
async def update_profile(
    body: ProfileUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    if body.grade is not None and body.grade not in _VALID_GRADES:
        raise HTTPException(status_code=422, detail=f"grade must be one of {sorted(_VALID_GRADES)}")
    if body.school_type is not None and body.school_type not in _VALID_SCHOOL_TYPES:
        raise HTTPException(status_code=422, detail=f"school_type must be one of {sorted(_VALID_SCHOOL_TYPES)}")
    if body.province is not None and len(body.province.strip()) == 0:
        raise HTTPException(status_code=422, detail="province cannot be blank")

    updates = {}
    if body.grade is not None:
        updates["grade"] = body.grade
    if body.school_type is not None:
        updates["school_type"] = body.school_type
    if body.province is not None:
        updates["province"] = body.province.strip()
    updates["updated_at"] = "datetime('now')"

    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")

    # Build SET clause — datetime('now') must not be quoted as a string
    set_parts = []
    params = []
    for k, v in updates.items():
        if v == "datetime('now')":
            set_parts.append(f"{k} = datetime('now')")
        else:
            set_parts.append(f"{k} = ?")
            params.append(v)
    params.append(current_user.user_id)

    await pool.execute(
        f"UPDATE users SET {', '.join(set_parts)} WHERE id = ?",  # noqa: S608
        *params,
    )

    row = await pool.fetchrow(
        """SELECT id, email, display_name, avatar_url,
                  grade, school_type, province,
                  subscription_tier, subscription_period, subscription_expires_at,
                  credits_balance, credits_reset_at,
                  is_suspended, suspension_reason, tos_accepted_at
           FROM users WHERE id = ?""",
        current_user.user_id,
    )
    return dict(row)


@app.post("/users/me/tos-accept", status_code=204)
async def accept_tos(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    await pool.execute(
        "UPDATE users SET tos_accepted_at = datetime('now') WHERE id = ? AND tos_accepted_at IS NULL",
        current_user.user_id,
    )


async def _spend_credits(pool, user_id: int, amount: int, reason: str) -> None:
    """Atomically deduct `amount` credits. Raises 402 if insufficient, 403 if TOS not accepted."""
    row = await pool.fetchrow(
        "SELECT credits_balance, tos_accepted_at FROM users WHERE id = ?", user_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    if not row["tos_accepted_at"]:
        raise HTTPException(status_code=403, detail="tos_not_accepted")
    result = await pool.execute(
        "UPDATE users SET credits_balance = credits_balance - ? WHERE id = ? AND credits_balance >= ?",
        amount, user_id, amount,
    )
    if result == "UPDATE 0":
        balance_row = await pool.fetchrow("SELECT credits_balance FROM users WHERE id = ?", user_id)
        balance = balance_row["credits_balance"] if balance_row else 0
        raise HTTPException(
            status_code=402,
            detail={"code": "insufficient_credits", "balance": balance, "required": amount},
        )
    await pool.execute(
        "INSERT INTO ai_credits_log (user_id, delta, reason) VALUES (?, ?, ?)",
        user_id, -amount, reason,
    )


@app.get("/users/me/credits/log")
async def get_credits_log(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    rows = await pool.fetch(
        "SELECT delta, reason, created_at FROM ai_credits_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
        current_user.user_id,
    )
    return [dict(r) for r in rows]


class HistoryEntry(BaseModel):
    result_id: str
    exam_id: str | None = None
    score: float | None = None
    payload: dict | None = None
    created_at: str | None = None


@app.post("/users/me/history", status_code=204)
async def post_history(
    entries: list[HistoryEntry],
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    if not entries:
        return
    for entry in entries:
        if entry.score is not None and not (0 <= entry.score <= 10):
            raise HTTPException(status_code=422, detail=f"score must be between 0 and 10, got {entry.score}")
        if entry.payload:
            acc = entry.payload.get("accuracy")
            if acc is not None and not (0 <= float(acc) <= 1):
                raise HTTPException(status_code=422, detail=f"accuracy must be between 0 and 1, got {acc}")
    async with pool.acquire() as conn:
        for entry in entries:
            await conn.execute(
                """
                INSERT INTO exam_results (result_id, user_id, exam_id, score, payload, created_at)
                VALUES ($1, $2, $3, $4, $5::jsonb, COALESCE($6::timestamptz, NOW()))
                ON CONFLICT (result_id) DO NOTHING
                """,
                entry.result_id,
                current_user.user_id,
                entry.exam_id,
                entry.score,
                json.dumps(entry.payload) if entry.payload is not None else None,
                entry.created_at,
            )
            # Timing anomaly detection
            if entry.payload:
                duration = entry.payload.get("durationSeconds")
                answered = entry.payload.get("answeredCount", 0)
                if duration is not None and answered > 5 and duration < answered * 3:
                    await conn.execute(
                        "INSERT INTO security_events (user_id, event_type, confidence, detail) VALUES ($1, $2, $3, $4)",
                        current_user.user_id,
                        "exam_anomaly",
                        "HIGH",
                        json.dumps({"reason": "impossible_speed", "durationSeconds": duration, "answeredCount": answered, "exam_id": entry.exam_id}),
                    )


@app.get("/users/me/history")
async def get_history(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    rows = await pool.fetch(
        """
        SELECT result_id, exam_id, score, payload, created_at
        FROM exam_results
        WHERE user_id = $1
        ORDER BY created_at DESC
        """,
        current_user.user_id,
    )
    return [
        {
            "result_id": r["result_id"],
            "exam_id": r["exam_id"],
            "score": r["score"],
            "payload": r["payload"],
            "created_at": r["created_at"] if isinstance(r["created_at"], str) else (r["created_at"].isoformat() if r["created_at"] else None),
        }
        for r in rows
    ]


class QuestionReportRequest(BaseModel):
    reason: str


@app.post("/questions/{question_id}/report", status_code=204)
async def report_question(
    question_id: str,
    body: QuestionReportRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    if not body.reason.strip():
        raise HTTPException(status_code=422, detail="reason cannot be blank")
    await pool.execute(
        "INSERT INTO question_reports (question_id, user_id, reason) VALUES (?, ?, ?)",
        question_id, current_user.user_id, body.reason[:500],
    )


@app.post("/users/me/trial", status_code=204)
async def activate_trial(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    row = await pool.fetchrow(
        "SELECT subscription_tier, trial_used FROM users WHERE id = ?", current_user.user_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    if row["trial_used"]:
        raise HTTPException(status_code=409, detail="Trial already used")
    if row["subscription_tier"] != "basic":
        raise HTTPException(status_code=409, detail="Trial only available on Basic tier")
    await pool.execute(
        """UPDATE users SET
             subscription_tier = 'student',
             trial_used = 1,
             trial_expires_at = datetime('now', '+7 days'),
             credits_balance = credits_balance + 500,
             credits_reset_at = datetime('now', '+7 days'),
             updated_at = datetime('now')
           WHERE id = ?""",
        current_user.user_id,
    )


class DeleteAccountRequest(BaseModel):
    confirm_email: str


@app.delete("/users/me", status_code=204)
async def delete_account(
    body: DeleteAccountRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    row = await pool.fetchrow(
        "SELECT email, google_sub, trial_used FROM users WHERE id = ?",
        current_user.user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    if row["email"] != body.confirm_email:
        raise HTTPException(status_code=400, detail="Email confirmation does not match")
    # Preserve trial status so re-registration cannot claim another trial
    await pool.execute(
        "INSERT OR REPLACE INTO deleted_google_subs (google_sub, trial_used) VALUES (?, ?)",
        row["google_sub"], row["trial_used"],
    )
    await pool.execute("DELETE FROM users WHERE id = ?", current_user.user_id)
    from app.dependencies import invalidate_account_cache
    invalidate_account_cache(current_user.user_id)


@app.post("/users/me/deactivate", status_code=204)
async def deactivate_account(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    await pool.execute(
        "UPDATE users SET is_deactivated = 1, deactivated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
        current_user.user_id,
    )
    from app.dependencies import invalidate_account_cache
    invalidate_account_cache(current_user.user_id)


@app.post("/users/me/reactivate", status_code=204)
async def reactivate_account(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    await pool.execute(
        "UPDATE users SET is_deactivated = 0, deactivated_at = NULL, updated_at = datetime('now') WHERE id = ?",
        current_user.user_id,
    )
    from app.dependencies import invalidate_account_cache
    invalidate_account_cache(current_user.user_id)


# ── Admin endpoints ───────────────────────────────────────────────────────────

def _require_admin(request: Request):
    key = request.headers.get("x-admin-key", "")
    expected = getattr(get_settings(), "admin_key", "") or ""
    if not expected or not hmac.compare_digest(key.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")


class SubscriptionUpdate(BaseModel):
    tier: str
    period: str = "monthly"
    expires_at: str | None = None
    bonus_credits: int = 0


class CreditGrant(BaseModel):
    amount: int
    reason: str = "admin_grant"


class SuspendRequest(BaseModel):
    reason: str


@app.post("/admin/users/{user_id}/subscription", status_code=204)
async def admin_set_subscription(
    user_id: int,
    body: SubscriptionUpdate,
    request: Request,
    pool=Depends(get_pool),
):
    _require_admin(request)
    valid_tiers = {"basic", "student", "complete"}
    valid_periods = {"monthly", "annual"}
    if body.tier not in valid_tiers:
        raise HTTPException(status_code=422, detail=f"tier must be one of {sorted(valid_tiers)}")
    if body.period not in valid_periods:
        raise HTTPException(status_code=422, detail=f"period must be one of {sorted(valid_periods)}")
    await pool.execute(
        """UPDATE users SET subscription_tier = ?, subscription_period = ?,
           subscription_expires_at = ?,
           credits_balance = credits_balance + ?,
           updated_at = datetime('now')
           WHERE id = ?""",
        body.tier, body.period, body.expires_at, body.bonus_credits, user_id,
    )
    if body.bonus_credits:
        await pool.execute(
            "INSERT INTO ai_credits_log (user_id, delta, reason) VALUES (?, ?, ?)",
            user_id, body.bonus_credits, f"subscription_bonus_{body.tier}",
        )


@app.post("/admin/users/{user_id}/credits", status_code=204)
async def admin_grant_credits(
    user_id: int,
    body: CreditGrant,
    request: Request,
    pool=Depends(get_pool),
):
    _require_admin(request)
    if body.amount <= 0:
        raise HTTPException(status_code=422, detail="amount must be positive")
    await pool.execute(
        "UPDATE users SET credits_balance = credits_balance + ?, updated_at = datetime('now') WHERE id = ?",
        body.amount, user_id,
    )
    await pool.execute(
        "INSERT INTO ai_credits_log (user_id, delta, reason) VALUES (?, ?, ?)",
        user_id, body.amount, body.reason,
    )


@app.post("/admin/users/{user_id}/suspend", status_code=204)
async def admin_suspend_user(
    user_id: int,
    body: SuspendRequest,
    request: Request,
    pool=Depends(get_pool),
):
    _require_admin(request)
    await pool.execute(
        "UPDATE users SET is_suspended = 1, suspension_reason = ?, updated_at = datetime('now') WHERE id = ?",
        body.reason, user_id,
    )
    await pool.execute(
        "INSERT INTO security_events (user_id, event_type, confidence, detail) VALUES (?, ?, ?, ?)",
        user_id, "manual_suspend", "high", body.reason,
    )


@app.post("/admin/users/{user_id}/unsuspend", status_code=204)
async def admin_unsuspend_user(
    user_id: int,
    request: Request,
    pool=Depends(get_pool),
):
    _require_admin(request)
    await pool.execute(
        "UPDATE users SET is_suspended = 0, suspension_reason = NULL, updated_at = datetime('now') WHERE id = ?",
        user_id,
    )
    await pool.execute(
        "INSERT INTO security_events (user_id, event_type, confidence, detail) VALUES (?, ?, ?, ?)",
        user_id, "manual_unsuspend", "low", "admin unsuspend",
    )


@app.get("/admin/security-events")
async def admin_security_events(
    request: Request,
    limit: int = 50,
    pool=Depends(get_pool),
):
    _require_admin(request)
    limit = max(1, min(limit, 500))
    rows = await pool.fetch(
        """SELECT se.id, se.user_id, se.ip, se.event_type, se.confidence, se.detail, se.created_at,
                  u.email, u.is_suspended
           FROM security_events se
           LEFT JOIN users u ON u.id = se.user_id
           WHERE se.confidence IN ('high', 'medium')
           ORDER BY se.created_at DESC
           LIMIT ?""",
        limit,
    )
    return [dict(r) for r in rows]


@app.get("/admin/users")
async def admin_list_users(
    request: Request,
    search: str = "",
    page: int = 1,
    limit: int = 20,
    pool=Depends(get_pool),
):
    _require_admin(request)
    limit = max(1, min(limit, 100))
    page = max(1, page)
    offset = (page - 1) * limit
    if search:
        _pat = f"%{search}%"
        total_row = await pool.fetchrow(
            "SELECT COUNT(*) AS cnt FROM users WHERE email LIKE ? OR display_name LIKE ?",
            _pat, _pat,
        )
    else:
        total_row = await pool.fetchrow("SELECT COUNT(*) AS cnt FROM users")
    total = total_row["cnt"] if total_row else 0
    behavior_subq = """
        LEFT JOIN (
            SELECT user_id,
                   CAST(json_extract(payload, '$.tab_switches') AS INTEGER) AS last_tab_switches,
                   CAST(json_extract(payload, '$.devtools_detected') AS INTEGER) AS last_devtools
            FROM exam_results
            WHERE id IN (SELECT MAX(id) FROM exam_results GROUP BY user_id)
        ) beh ON beh.user_id = u.id
    """
    if search:
        pattern = f"%{search}%"
        rows = await pool.fetch(
            f"""SELECT u.id, u.email, u.display_name, u.subscription_tier, u.credits_balance,
                      u.is_suspended, u.suspension_reason, u.is_locked, u.lock_reason,
                      u.is_deactivated, u.trial_used, u.created_at,
                      beh.last_tab_switches, beh.last_devtools
               FROM users u {behavior_subq}
               WHERE u.email LIKE ? OR u.display_name LIKE ?
               ORDER BY u.created_at DESC LIMIT ? OFFSET ?""",
            pattern, pattern, limit, offset,
        )
    else:
        rows = await pool.fetch(
            f"""SELECT u.id, u.email, u.display_name, u.subscription_tier, u.credits_balance,
                      u.is_suspended, u.suspension_reason, u.is_locked, u.lock_reason,
                      u.is_deactivated, u.trial_used, u.created_at,
                      beh.last_tab_switches, beh.last_devtools
               FROM users u {behavior_subq}
               ORDER BY u.created_at DESC LIMIT ? OFFSET ?""",
            limit, offset,
        )
    return {"users": [dict(r) for r in rows], "total": total}


@app.delete("/admin/users/{user_id}", status_code=204)
async def admin_delete_user(
    user_id: int,
    request: Request,
    pool=Depends(get_pool),
):
    _require_admin(request)
    row = await pool.fetchrow("SELECT google_sub, trial_used FROM users WHERE id = ?", user_id)
    if row:
        await pool.execute(
            "INSERT OR REPLACE INTO deleted_google_subs (google_sub, trial_used) VALUES (?, ?)",
            row["google_sub"], row["trial_used"],
        )
    await pool.execute("DELETE FROM users WHERE id = ?", user_id)
    from app.dependencies import invalidate_account_cache
    invalidate_account_cache(user_id)


@app.post("/admin/users/{user_id}/unlock", status_code=204)
async def admin_unlock_user(
    user_id: int,
    request: Request,
    pool=Depends(get_pool),
):
    _require_admin(request)
    await pool.execute(
        "UPDATE users SET is_locked = 0, lock_reason = NULL, updated_at = datetime('now') WHERE id = ?",
        user_id,
    )
    await pool.execute(
        "INSERT INTO security_events (user_id, event_type, confidence, detail) VALUES (?, ?, ?, ?)",
        user_id, "manual_unlock", "low", "admin unlocked account",
    )
    from app.dependencies import invalidate_account_cache
    invalidate_account_cache(user_id)


@app.post("/admin/users/{user_id}/reset", status_code=204)
async def admin_reset_user(
    user_id: int,
    request: Request,
    pool=Depends(get_pool),
):
    _require_admin(request)
    row = await pool.fetchrow("SELECT google_sub FROM users WHERE id = ?", user_id)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    await pool.execute(
        """UPDATE users SET
             subscription_tier = 'basic', subscription_period = 'monthly', subscription_expires_at = NULL,
             credits_balance = 50, credits_reset_at = NULL,
             trial_used = 0, trial_expires_at = NULL,
             grade = NULL, province = NULL, school_type = NULL,
             tos_accepted_at = NULL,
             is_suspended = 0, suspension_reason = NULL,
             is_locked = 0, lock_reason = NULL,
             is_deactivated = 0, deactivated_at = NULL,
             updated_at = datetime('now')
           WHERE id = ?""",
        user_id,
    )
    await pool.execute("DELETE FROM exam_results WHERE user_id = ?", user_id)
    await pool.execute("DELETE FROM security_events WHERE user_id = ?", user_id)
    await pool.execute("DELETE FROM ai_credits_log WHERE user_id = ?", user_id)
    if row["google_sub"]:
        await pool.execute(
            "DELETE FROM deleted_google_subs WHERE google_sub = ?", row["google_sub"]
        )
    await pool.execute(
        "INSERT INTO security_events (user_id, event_type, confidence, detail) VALUES (?, ?, ?, ?)",
        user_id, "admin_reset", "low", "full account reset by admin",
    )
    from app.dependencies import invalidate_account_cache
    invalidate_account_cache(user_id)

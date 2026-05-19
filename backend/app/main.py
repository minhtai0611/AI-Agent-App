import asyncio
import hashlib
import hmac
import io
import json
import logging
import re
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from openai import AsyncOpenAI, APIStatusError, APIConnectionError, RateLimitError
from app.config import get_settings
from app.dependencies import get_ai_client, get_current_user, CurrentUser
from app.middleware import RateLimitMiddleware
from app.agent.core import run_agent
from app.agent.memory import compress_conversation
from app.math_wiki.admin_router import router as admin_router
from app.auth import verify_google_token, create_jwt
from app.admin_auth import validate_admin_key, derive_key, get_window_label, get_expiry_date

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Daily-challenge helpers
# ---------------------------------------------------------------------------
_ANSWER_KEY_PATH = Path(__file__).parent / "data" / "question_answers.json"
_answer_key: dict | None = None  # {question_id: correct_index}

def _load_answer_key() -> dict:
    global _answer_key
    if _answer_key is None:
        try:
            with open(_ANSWER_KEY_PATH) as f:
                _answer_key = json.load(f)
        except Exception:
            _answer_key = {}
    return _answer_key

def _select_daily_questions(all_ids: list[str], date_str: str, n: int = 5) -> list[str]:
    """Deterministically select n question IDs seeded by date string."""
    if len(all_ids) <= n:
        return all_ids[:n]
    result: list[str] = []
    seen: set[int] = set()
    counter = 0
    while len(result) < n:
        digest = hashlib.md5(f"{date_str}:{counter}".encode()).digest()
        idx = int.from_bytes(digest[:4], "big") % len(all_ids)
        if idx not in seen:
            seen.add(idx)
            result.append(all_ids[idx])
        counter += 1
    return result


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
    "ALTER TABLE users ADD COLUMN custom_display_name TEXT",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_custom_display_name ON users(custom_display_name) WHERE custom_display_name IS NOT NULL",
    "ALTER TABLE users ADD COLUMN last_seen_at TEXT DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN pending_deletion_at TEXT DEFAULT NULL",
    "CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at)",
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
    "ALTER TABLE users ADD COLUMN referral_code TEXT",
    "CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_idx ON users (referral_code)",
    """CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        max_students INTEGER NOT NULL DEFAULT 60,
        active INTEGER NOT NULL DEFAULT 1
    )""",
    """CREATE TABLE IF NOT EXISTS class_members (
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (class_id, student_id)
    )""",
    """CREATE TABLE IF NOT EXISTS referral_grants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        granted_at TEXT DEFAULT (datetime('now')),
        UNIQUE (referrer_id, referred_user_id)
    )""",
    """CREATE TABLE IF NOT EXISTS exam_leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id TEXT NOT NULL,
        score REAL NOT NULL,
        submitted_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE INDEX IF NOT EXISTS idx_leaderboard_exam ON exam_leaderboard (exam_id)""",
    """CREATE TABLE IF NOT EXISTS daily_challenge_leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        display_name TEXT NOT NULL DEFAULT '',
        date TEXT NOT NULL,
        score INTEGER NOT NULL,
        total INTEGER NOT NULL DEFAULT 5,
        time_seconds INTEGER NOT NULL DEFAULT 0,
        submitted_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, date)
    )""",
    """CREATE INDEX IF NOT EXISTS idx_daily_lb_date ON daily_challenge_leaderboard (date, score DESC, time_seconds ASC)""",
    """CREATE TABLE IF NOT EXISTS tutor_memory (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        summary TEXT NOT NULL DEFAULT '',
        updated_at TEXT DEFAULT (datetime('now'))
    )""",
    "ALTER TABLE users ADD COLUMN strategy_used_at TEXT DEFAULT NULL",
    # Part 9 — questions/exams from DB
    """CREATE TABLE IF NOT EXISTS exams (
        id TEXT PRIMARY KEY,
        year INTEGER,
        title TEXT NOT NULL,
        duration INTEGER,
        source TEXT,
        category TEXT NOT NULL,
        mode TEXT,
        total_questions INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        source TEXT,
        year INTEGER,
        topic TEXT,
        difficulty TEXT,
        question TEXT NOT NULL,
        choices TEXT NOT NULL,
        correct INTEGER NOT NULL,
        explanation TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS exam_questions (
        exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL REFERENCES questions(id),
        position INTEGER NOT NULL,
        PRIMARY KEY (exam_id, question_id)
    )""",
    "CREATE INDEX IF NOT EXISTS idx_eq_exam ON exam_questions(exam_id)",
    "CREATE INDEX IF NOT EXISTS idx_q_topic ON questions(topic)",
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


async def _seed_from_json(pool) -> None:
    """Auto-seed exams and questions tables from bundled JSON files (runs once, INSERT OR IGNORE)."""
    import pathlib
    data_dir = pathlib.Path(__file__).parent.parent.parent / "exam-app" / "src" / "data"
    try:
        exams_path = data_dir / "exams.json"
        questions_path = data_dir / "questions.json"
        if not exams_path.exists() or not questions_path.exists():
            logger.warning("_seed_from_json: JSON files not found at %s — skipping seed", data_dir)
            return
        exams = json.loads(exams_path.read_text())
        questions = json.loads(questions_path.read_text())
        async with pool.acquire() as conn:
            for e in exams:
                await conn.execute(
                    "INSERT OR IGNORE INTO exams (id, year, title, duration, source, category, mode, total_questions) VALUES (?,?,?,?,?,?,?,?)",
                    e["id"], e.get("year"), e["title"], e.get("duration"), e.get("source"),
                    e["category"], e.get("mode"), e.get("totalQuestions"),
                )
                for i, qid in enumerate(e.get("questionIds", [])):
                    await conn.execute(
                        "INSERT OR IGNORE INTO exam_questions (exam_id, question_id, position) VALUES (?,?,?)",
                        e["id"], qid, i,
                    )
            for q in questions:
                await conn.execute(
                    "INSERT OR IGNORE INTO questions (id, source, year, topic, difficulty, question, choices, correct, explanation) VALUES (?,?,?,?,?,?,?,?,?)",
                    q["id"], q.get("source"), q.get("year"), q.get("topic"), q.get("difficulty"),
                    q["question"], json.dumps(q.get("choices", []), ensure_ascii=False),
                    q["correct"], q.get("explanation"),
                )
        logger.info("_seed_from_json: seeded %d exams, %d questions", len(exams), len(questions))
    except Exception as exc:
        logger.warning("_seed_from_json failed: %s", exc)


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
    exam_count = (await app.state.pool.fetchrow("SELECT COUNT(*) AS cnt FROM exams"))
    if exam_count and exam_count["cnt"] == 0:
        await _seed_from_json(app.state.pool)

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
    tier_row = await pool.fetchrow("SELECT subscription_tier FROM users WHERE id = ?", current_user.user_id)
    if not tier_row or tier_row["subscription_tier"] not in _PAID_TIERS:
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
    tier_row_s = await pool.fetchrow("SELECT subscription_tier FROM users WHERE id = ?", current_user.user_id)
    if not tier_row_s or tier_row_s["subscription_tier"] not in _PAID_TIERS:
        await _spend_credits(pool, current_user.user_id, 3, "analyze")

    prompt = build_analyze_prompt(
        req.result, req.history, req.student_name,
        wrong_questions=req.wrong_questions,
        exam_category=req.exam_category,
        user_profile=req.user_profile,
    )
    settings = get_settings()

    async def event_stream():
        buf = ''
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
                    buf += token
                    if len(buf) >= 15:
                        yield f"data: {json.dumps(buf)}\n\n"
                        buf = ''
            if buf:
                yield f"data: {json.dumps(buf)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

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


async def _update_tutor_memory(pool, client, user_id: int, messages: list[dict]) -> None:
    """Compress the session into a short learning summary and persist it (Complete tier)."""
    try:
        settings = get_settings()
        mem_row = await pool.fetchrow("SELECT summary FROM tutor_memory WHERE user_id = ?", user_id)
        existing = (mem_row["summary"] if mem_row else "") or ""
        session_text = "\n".join(
            f"{m['role'].upper()}: {m['content'][:200]}" for m in messages[-8:] if isinstance(m.get("content"), str)
        )
        prompt = (
            f"Lịch sử học hiện tại (tóm tắt trước đây):\n{existing[:300]}\n\n"
            f"Phiên học mới:\n{session_text}\n\n"
            "Viết 2-3 câu tóm tắt những điểm mạnh/yếu mới của học sinh, kết hợp với lịch sử trước. "
            "Tối đa 400 ký tự. Chỉ trả lời tóm tắt, không giải thích."
        )
        resp = await client.chat.completions.create(
            model=get_settings().haiku_model, max_tokens=120,
            messages=[{"role": "user", "content": prompt}],
        )
        new_summary = (resp.choices[0].message.content or "").strip()[:400]
        await pool.execute(
            "INSERT INTO tutor_memory (user_id, summary, updated_at) VALUES (?, ?, datetime('now')) "
            "ON CONFLICT(user_id) DO UPDATE SET summary = excluded.summary, updated_at = excluded.updated_at",
            user_id, new_summary,
        )
    except Exception as exc:
        logger.warning("_update_tutor_memory failed for user %s: %s", user_id, exc)


@app.post("/tutor", response_model=TutorChatResponse)
async def tutor(
    req: TutorChatRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    tier_row_t = await pool.fetchrow(
        "SELECT subscription_tier FROM users WHERE id = ?", current_user.user_id
    )
    tier_t = tier_row_t["subscription_tier"] if tier_row_t else "basic"
    await _spend_credits(pool, current_user.user_id, 1, "tutor")
    from app.agent.exam_tutor import run_tutor
    # Prepend learning history for Complete users
    memory_prefix = ""
    if tier_t == "complete":
        mem_row = await pool.fetchrow(
            "SELECT summary FROM tutor_memory WHERE user_id = ?", current_user.user_id
        )
        if mem_row and mem_row["summary"]:
            memory_prefix = f"[Lịch sử học của học sinh: {mem_row['summary']}]\n\n"
    reply, updated = await run_tutor(
        client, req.messages, req.exam_context, req.student_name,
        memory_prefix=memory_prefix,
    )
    # Async memory update after ≥4 turns for Complete users
    if tier_t == "complete" and len(req.messages) >= 4:
        asyncio.ensure_future(_update_tutor_memory(pool, client, current_user.user_id, updated))
    return TutorChatResponse(reply=reply, messages=updated)


class GenerateExamRequest(BaseModel):
    topic_focus: list[str] | None = None
    difficulty: str = "medium"
    count: int = 10


@app.post("/generate-exam")
async def generate_exam(
    req: GenerateExamRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    tier_row_ge = await pool.fetchrow(
        "SELECT subscription_tier FROM users WHERE id = ?", current_user.user_id
    )
    if not tier_row_ge or tier_row_ge["subscription_tier"] != "complete":
        raise HTTPException(
            status_code=403,
            detail={"code": "tier_required", "required": "complete", "message": "Tạo đề AI riêng yêu cầu gói Toàn diện"},
        )
    count = max(5, min(15, req.count))
    await _spend_credits(pool, current_user.user_id, 5, "generate_exam")
    settings = get_settings()
    topics_hint = f"Chủ đề ưu tiên: {', '.join(req.topic_focus)}" if req.topic_focus else "Tất cả chủ đề toán lớp 10"
    prompt = (
        f"Tạo {count} câu trắc nghiệm toán lớp 10 theo chuẩn đề thi tuyển sinh Việt Nam.\n"
        f"{topics_hint}. Độ khó: {req.difficulty}.\n"
        "Trả về JSON array, mỗi phần tử gồm: question (string), choices (array 4 string), correct (int 0-3), topic (string), explanation (string ngắn).\n"
        "Chỉ trả lời JSON, không giải thích thêm."
    )
    try:
        resp = await client.chat.completions.create(
            model=settings.default_model, max_tokens=3000,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
        parsed = json.loads(raw)
        questions = parsed if isinstance(parsed, list) else parsed.get("questions", [])
        exam_id = f"generated-{current_user.user_id}-{int(datetime.utcnow().timestamp())}"
        return {"exam_id": exam_id, "questions": questions[:count]}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Không thể tạo đề: {exc}")


@app.get("/predict-score")
async def predict_score(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    tier_row_ps = await pool.fetchrow(
        "SELECT subscription_tier FROM users WHERE id = ?", current_user.user_id
    )
    if not tier_row_ps or tier_row_ps["subscription_tier"] != "complete":
        raise HTTPException(
            status_code=403,
            detail={"code": "tier_required", "required": "complete"},
        )
    results = await pool.fetch(
        "SELECT score FROM exam_results WHERE user_id = ? AND score IS NOT NULL ORDER BY created_at DESC LIMIT 10",
        current_user.user_id,
    )
    if not results:
        return {"predicted": None, "confidence": "low", "sample_size": 0}
    scores = [r["score"] for r in results if r["score"] is not None and 0 <= r["score"] <= 10]
    if not scores:
        return {"predicted": None, "confidence": "low", "sample_size": 0}
    weights = [1.5 ** i for i in range(len(scores))]
    weighted_avg = sum(s * w for s, w in zip(scores, weights)) / sum(weights)
    spread = max(scores) - min(scores)
    confidence = "high" if len(scores) >= 7 and spread < 2 else "medium" if len(scores) >= 4 else "low"
    return {
        "predicted": round(weighted_avg, 1),
        "confidence": confidence,
        "sample_size": len(scores),
        "low": round(max(0, weighted_avg - 0.5), 1),
        "high": round(min(10, weighted_avg + 0.5), 1),
    }


class StrategyRequest(BaseModel):
    pass


@app.post("/strategy")
async def exam_strategy(
    req: StrategyRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    tier_row_st = await pool.fetchrow(
        "SELECT subscription_tier, strategy_used_at FROM users WHERE id = ?", current_user.user_id
    )
    if not tier_row_st or tier_row_st["subscription_tier"] != "complete":
        raise HTTPException(
            status_code=403,
            detail={"code": "tier_required", "required": "complete"},
        )
    if tier_row_st["strategy_used_at"]:
        last = datetime.fromisoformat(tier_row_st["strategy_used_at"])
        if (datetime.utcnow() - last).days < 30:
            next_available = (last + timedelta(days=30)).strftime("%Y-%m-%d")
            raise HTTPException(
                status_code=429,
                detail={"code": "strategy_cooldown", "next_available": next_available},
            )
    await pool.execute(
        "UPDATE users SET strategy_used_at = datetime('now') WHERE id = ?", current_user.user_id
    )
    # Gather topic performance from recent results
    results = await pool.fetch(
        "SELECT score, exam_id, created_at FROM exam_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
        current_user.user_id,
    )
    scores_summary = ", ".join(str(r["score"]) for r in results if r["score"] is not None) or "chưa có"
    settings = get_settings()
    prompt = (
        "Bạn là chuyên gia tư vấn chiến lược ôn thi tuyển sinh lớp 10 môn Toán Việt Nam.\n"
        f"Điểm số gần đây của học sinh (0-10): {scores_summary}\n\n"
        "Hãy viết chiến lược ôn thi cá nhân hóa gồm:\n"
        "1. Đánh giá tổng quan\n2. Các chủ đề cần ưu tiên\n3. Phân bổ thời gian gợi ý\n4. Kế hoạch hành động cụ thể\n"
        "Viết ngắn gọn, thực tế, bằng tiếng Việt."
    )
    try:
        resp = await client.chat.completions.create(
            model=settings.default_model, max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        strategy_text = (resp.choices[0].message.content or "").strip()
        return {"strategy": strategy_text}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Không thể tạo chiến lược: {exc}")


@app.get("/compare/province")
async def compare_province(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    tier_row_cp = await pool.fetchrow(
        "SELECT subscription_tier, province FROM users WHERE id = ?", current_user.user_id
    )
    if not tier_row_cp or tier_row_cp["subscription_tier"] != "complete":
        raise HTTPException(
            status_code=403,
            detail={"code": "tier_required", "required": "complete"},
        )
    province = tier_row_cp["province"]
    if not province:
        raise HTTPException(status_code=422, detail="Chưa cài tỉnh thành trong hồ sơ")
    user_avg_row = await pool.fetchrow(
        "SELECT AVG(score) AS avg FROM exam_results WHERE user_id = ? AND score IS NOT NULL AND created_at > datetime('now', '-30 days')",
        current_user.user_id,
    )
    province_stats = await pool.fetchrow(
        """SELECT AVG(er.score) AS avg, COUNT(DISTINCT er.user_id) AS user_count
           FROM exam_results er JOIN users u ON u.id = er.user_id
           WHERE u.province = ? AND er.score IS NOT NULL AND er.created_at > datetime('now', '-30 days')""",
        province,
    )
    user_avg = user_avg_row["avg"] if user_avg_row else None
    prov_avg = province_stats["avg"] if province_stats else None
    prov_count = province_stats["user_count"] if province_stats else 0
    percentile = None
    if user_avg is not None and prov_count > 1:
        rank_row = await pool.fetchrow(
            """SELECT COUNT(DISTINCT er.user_id) AS better_count
               FROM exam_results er JOIN users u ON u.id = er.user_id
               WHERE u.province = ? AND er.score IS NOT NULL AND er.created_at > datetime('now', '-30 days')
               GROUP BY er.user_id
               HAVING AVG(er.score) > ?""",
            province, user_avg,
        )
        better = rank_row["better_count"] if rank_row else 0
        percentile = round((1 - better / prov_count) * 100)
    return {
        "province": province,
        "your_avg": round(user_avg, 1) if user_avg is not None else None,
        "province_avg": round(prov_avg, 1) if prov_avg is not None else None,
        "province_user_count": prov_count,
        "percentile": percentile,
    }


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
_IMAGE_MAGIC = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG": "image/png",
    b"RIFF": "image/webp",  # RIFF....WEBP — checked further below
}

def _validate_image_magic(data: bytes) -> str:
    """Return detected MIME type or raise 415."""
    for magic, mime in _IMAGE_MAGIC.items():
        if data[:len(magic)] == magic:
            if mime == "image/webp" and data[8:12] != b"WEBP":
                continue
            return mime
    raise HTTPException(status_code=415, detail="File does not match an accepted image format (JPEG, PNG, or WebP).")


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


@app.post("/ocr/exam")
async def ocr_exam(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Extract structured exam questions from an image using vision AI.
    Credits: 3 per call. Max 5 MB. Validates magic bytes; rejects non-images."""
    MAX_SIZE = 5 * 1024 * 1024
    content = await file.read(MAX_SIZE + 1)
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Image too large (max 5 MB)")

    # Magic bytes validation — never trust client MIME type
    detected_mime = _validate_image_magic(content)
    await _spend_credits(pool, current_user.user_id, 3, "ocr_exam")

    client = get_ai_client()
    settings = get_settings()
    import base64
    b64 = base64.standard_b64encode(content).decode()
    prompt = (
        "Extract all math exam questions from this image. "
        "Return a JSON array of objects: "
        '{"question": "question text", "choices": ["A","B","C","D"], "correct": 0, "topic": "algebra", "difficulty": "medium"}. '
        "If choices are not present, use empty array. correct is the 0-based index if determinable, else null. "
        "Use LaTeX for math. Return ONLY the JSON array."
    )
    try:
        response = await client.chat.completions.create(
            model=settings.default_model,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{detected_mime};base64,{b64}"}},
                    {"type": "text", "text": prompt},
                ],
            }],
            max_tokens=4096,
        )
        raw = (response.choices[0].message.content or "").strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        questions = json.loads(raw)
        if not isinstance(questions, list):
            raise ValueError("Expected a JSON array")
    except Exception as exc:
        logger.error("ocr/exam failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"OCR extraction failed: {exc}")

    return {"questions": questions}


@app.post("/math-solve", response_model=MathSolveResponse)
async def math_solve(
    req: MathSolveRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    tier_row_ms = await pool.fetchrow("SELECT subscription_tier FROM users WHERE id = ?", current_user.user_id)
    if tier_row_ms and tier_row_ms["subscription_tier"] == "basic":
        today_uses = await pool.fetchrow(
            "SELECT COUNT(*) AS cnt FROM ai_credits_log WHERE user_id = ? AND reason = 'math_solve' AND created_at >= date('now')",
            current_user.user_id,
        )
        if (today_uses["cnt"] or 0) >= 5:
            raise HTTPException(403, detail={"code": "tier_required", "message": "Đã dùng hết 5 lượt Oracle hôm nay — nâng cấp để dùng không giới hạn"})
    await pool.execute("INSERT INTO ai_credits_log (user_id, delta, reason) VALUES (?, 0, 'math_solve')", current_user.user_id)
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
    tier_row_mr = await pool.fetchrow("SELECT subscription_tier FROM users WHERE id = ?", current_user.user_id)
    if not tier_row_mr or tier_row_mr["subscription_tier"] not in _PAID_TIERS:
        raise HTTPException(403, detail={"code": "tier_required", "message": "Chế độ Chấm bài yêu cầu gói Học sinh trở lên"})
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
    ref: str | None = Field(default=None, max_length=20)


def _normalize_google_avatar(url: str | None) -> str | None:
    if not url:
        return url
    normalized = re.sub(r'=s\d+(-c)?$', '=s200-c', url)
    if normalized == url and 'googleusercontent.com' in url:
        normalized = url + '=s200-c'
    return normalized


@app.post("/auth/google")
async def auth_google(body: GoogleAuthRequest, pool=Depends(get_pool)):
    import secrets as _secrets
    try:
        google_payload = await verify_google_token(body.id_token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired Google token") from exc

    google_sub = google_payload["sub"]
    email = google_payload.get("email", "")
    display_name = google_payload.get("name")
    avatar_url = _normalize_google_avatar(google_payload.get("picture"))

    # Check if this google_sub previously hard-deleted their account to preserve trial_used
    deleted_sub = await pool.fetchrow(
        "SELECT trial_used FROM deleted_google_subs WHERE google_sub = $1",
        google_sub,
    )
    preserved_trial_used = deleted_sub["trial_used"] if deleted_sub else 0

    # Determine new vs existing before upsert (xmax is PostgreSQL-only, not available in SQLite)
    existing = await pool.fetchrow(
        "SELECT id FROM users WHERE google_sub = $1", google_sub
    )
    is_new_user = existing is None

    # Generate a unique referral code for new users
    new_ref_code = _secrets.token_urlsafe(8)

    row = await pool.fetchrow(
        """
        INSERT INTO users (google_sub, email, display_name, avatar_url, trial_used, referral_code, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (google_sub) DO UPDATE
          SET display_name = EXCLUDED.display_name,
              avatar_url = EXCLUDED.avatar_url,
              updated_at = NOW()
        RETURNING id, email, display_name, avatar_url, custom_display_name
        """,
        google_sub, email, display_name, avatar_url, preserved_trial_used, new_ref_code,
    )

    # Process referral — only on new account creation
    if is_new_user and body.ref and len(body.ref) <= 20:
        referrer = await pool.fetchrow(
            "SELECT id, google_sub FROM users WHERE referral_code = $1", body.ref
        )
        if referrer and referrer["id"] != row["id"] and referrer["google_sub"] != google_sub:
            # Check referral cap (max 20 per referrer)
            referral_count = await pool.fetchrow(
                "SELECT COUNT(*) AS cnt FROM referral_grants WHERE referrer_id = $1", referrer["id"]
            )
            if (referral_count["cnt"] or 0) < 20:
                try:
                    await pool.execute(
                        "INSERT INTO referral_grants (referrer_id, referred_user_id) VALUES ($1, $2)",
                        referrer["id"], row["id"],
                    )
                    # Grant 50 credits to both parties
                    await pool.execute(
                        "UPDATE users SET credits_balance = credits_balance + 50 WHERE id IN ($1, $2)",
                        referrer["id"], row["id"],
                    )
                    await pool.execute(
                        "INSERT INTO ai_credits_log (user_id, delta, reason) VALUES ($1, 50, 'referral_grant'), ($2, 50, 'referral_grant')",
                        referrer["id"], row["id"],
                    )
                except Exception:
                    pass  # UNIQUE constraint violation = already processed

    token = create_jwt(row["id"])
    return {
        "access_token": token,
        "user": {
            "id": row["id"],
            "email": row["email"],
            "display_name": row["display_name"],
            "avatar_url": row["avatar_url"],
            "custom_display_name": row["custom_display_name"],
        },
    }


# ── User endpoints ────────────────────────────────────────────────────────────

@app.get("/users/me")
async def get_me(current_user: CurrentUser = Depends(get_current_user), pool=Depends(get_pool)):
    row = await pool.fetchrow(
        """SELECT id, email, display_name, avatar_url, custom_display_name,
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


@app.get("/users/me/referral")
async def get_referral(current_user: CurrentUser = Depends(get_current_user), pool=Depends(get_pool)):
    row = await pool.fetchrow(
        "SELECT referral_code FROM users WHERE id = $1", current_user.user_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    count_row = await pool.fetchrow(
        "SELECT COUNT(*) AS cnt FROM referral_grants WHERE referrer_id = $1", current_user.user_id
    )
    return {
        "referral_code": row["referral_code"],
        "successful_referrals": count_row["cnt"] if count_row else 0,
    }


_VALID_GRADES = {"9", "10", "11", "12"}
_VALID_SCHOOL_TYPES = {"chuyên", "công lập", "quốc tế"}
_USERNAME_RE = re.compile(r'^[\w\s\-]{2,30}$', re.UNICODE)


class UsernameUpdateRequest(BaseModel):
    username: str


@app.patch("/users/me/username")
async def update_username(
    body: UsernameUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    name = body.username.strip()
    name = ' '.join(name.split())
    if not _USERNAME_RE.match(name):
        raise HTTPException(422, detail="Tên phải từ 2–30 ký tự, chỉ gồm chữ, số, dấu gạch và khoảng trắng")
    try:
        await pool.execute(
            "UPDATE users SET custom_display_name = $1, updated_at = NOW() WHERE id = $2",
            name, current_user.user_id,
        )
    except Exception as e:
        if "UNIQUE" in str(e).upper():
            raise HTTPException(409, detail="Tên này đã được người khác sử dụng")
        raise
    row = await pool.fetchrow("SELECT custom_display_name FROM users WHERE id = $1", current_user.user_id)
    return {"custom_display_name": row["custom_display_name"]}


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


@app.get("/payment/config")
async def get_payment_config(current_user: CurrentUser = Depends(get_current_user)):
    """Return bank transfer details for the top-up modal. Requires authentication."""
    return {
        "bank_name": settings.payment_bank_name,
        "account_number": settings.payment_account_number,
        "account_name": settings.payment_account_name,
    }


# ---------------------------------------------------------------------------
# Daily challenge endpoints (B3 + F3)
# ---------------------------------------------------------------------------

@app.get("/daily-challenge")
async def get_daily_challenge(pool=Depends(get_pool)):
    """Return today's 5 question IDs (no auth required). Correct answers omitted."""
    from datetime import datetime, timezone
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        rows = await pool.fetch("SELECT id FROM questions")
        all_ids = [r["id"] for r in rows]
    except Exception:
        # Fallback to file-based key if DB unavailable
        all_ids = list(_load_answer_key().keys())
    if not all_ids:
        raise HTTPException(status_code=503, detail="question_data_unavailable")
    daily_ids = _select_daily_questions(all_ids, date_str)
    return {"date": date_str, "question_ids": daily_ids}


async def _compute_daily_streak(pool, user_id: str, today: str) -> int:
    from datetime import datetime, timedelta
    rows = await pool.fetch(
        "SELECT date FROM daily_challenge_leaderboard WHERE user_id = ? ORDER BY date DESC",
        user_id,
    )
    dates = {r["date"] for r in rows}
    count = 0
    check = datetime.fromisoformat(today).date()
    while str(check) in dates:
        count += 1
        check -= timedelta(days=1)
    return count


class DailyChallengeScoreRequest(BaseModel):
    answers: dict[str, int]  # {question_id: chosen_index}
    time_seconds: int = 0


@app.post("/daily-challenge/score")
async def submit_daily_challenge_score(
    req: DailyChallengeScoreRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Score the daily challenge server-side and record in leaderboard."""
    from datetime import datetime, timezone
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # Load answer key from DB; fallback to JSON file if DB unavailable
    try:
        rows = await pool.fetch("SELECT id, correct FROM questions")
        key = {r["id"]: r["correct"] for r in rows}
        all_ids = list(key.keys())
    except Exception:
        key = _load_answer_key()
        all_ids = list(key.keys())
    if not key:
        raise HTTPException(status_code=503, detail="question_data_unavailable")
    daily_ids = _select_daily_questions(all_ids, date_str)

    # Server-side scoring — never trust client-reported score
    correct = sum(
        1 for qid in daily_ids
        if req.answers.get(qid) == key.get(qid)
    )
    total = len(daily_ids)
    time_s = max(0, min(req.time_seconds, 86400))

    # Check if this is a first submission today (for Tia grant)
    existing = await pool.fetchrow(
        "SELECT score FROM daily_challenge_leaderboard WHERE user_id = ? AND date = ?",
        str(current_user.user_id), date_str,
    )
    first_submission = existing is None

    # Upsert: only keep the better score (higher score, or same score with faster time)
    if first_submission:
        await pool.execute(
            """INSERT INTO daily_challenge_leaderboard
               (user_id, display_name, date, score, total, time_seconds)
               VALUES (?, ?, ?, ?, ?, ?)""",
            str(current_user.user_id),
            current_user.display_name or "",
            date_str, correct, total, time_s,
        )
    else:
        prev_score = existing["score"]
        if correct > prev_score or (correct == prev_score and time_s < (existing.get("time_seconds") or 86400)):
            await pool.execute(
                """UPDATE daily_challenge_leaderboard
                   SET score = ?, time_seconds = ?, display_name = ?, submitted_at = datetime('now')
                   WHERE user_id = ? AND date = ?""",
                correct, time_s, current_user.display_name or "",
                str(current_user.user_id), date_str,
            )

    # Grant 1 Tia on first submission (regardless of score)
    tia_earned = 0
    streak = 0
    if first_submission:
        await pool.execute(
            "UPDATE users SET credits_balance = credits_balance + 1 WHERE id = ?",
            current_user.user_id,
        )
        await pool.execute(
            "INSERT INTO ai_credits_log (user_id, delta, reason) VALUES (?, 1, 'daily_challenge')",
            current_user.user_id,
        )
        tia_earned = 1

        # Streak bonus for paid tiers
        tier_row_dc = await pool.fetchrow("SELECT subscription_tier FROM users WHERE id = ?", current_user.user_id)
        if tier_row_dc and tier_row_dc["subscription_tier"] in _PAID_TIERS:
            streak = await _compute_daily_streak(pool, str(current_user.user_id), date_str)
            bonus_map = {7: 20, 30: 100, 100: 300}
            bonus = bonus_map.get(streak, 0)
            if bonus:
                await pool.execute(
                    "UPDATE users SET credits_balance = credits_balance + ? WHERE id = ?",
                    bonus, current_user.user_id,
                )
                await pool.execute(
                    "INSERT INTO ai_credits_log (user_id, delta, reason) VALUES (?, ?, ?)",
                    current_user.user_id, bonus, f"streak_bonus_{streak}",
                )
                tia_earned += bonus

    return {"score": correct, "total": total, "date": date_str, "tia_earned": tia_earned, "streak": streak}


@app.get("/daily-challenge/leaderboard")
async def get_daily_challenge_leaderboard(pool=Depends(get_pool)):
    """Top 10 scores for today's daily challenge."""
    from datetime import datetime, timezone
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    rows = await pool.fetch(
        """SELECT display_name, score, total, time_seconds
           FROM daily_challenge_leaderboard
           WHERE date = ?
           ORDER BY score DESC, time_seconds ASC
           LIMIT 10""",
        date_str,
    )
    entries = [
        {
            "rank": i + 1,
            "display_name": r["display_name"] or "Ẩn danh",
            "score": r["score"],
            "total": r["total"],
            "time_seconds": r["time_seconds"],
        }
        for i, r in enumerate(rows)
    ]
    return {"date": date_str, "entries": entries}


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
            # Leaderboard — anonymous score insert (no user_id)
            if entry.exam_id and entry.score is not None:
                await conn.execute(
                    "INSERT INTO exam_leaderboard (exam_id, score) VALUES ($1, $2)",
                    entry.exam_id,
                    entry.score,
                )


@app.get("/results/{exam_id}/percentile")
async def get_percentile(
    exam_id: str,
    score: float,
    pool=Depends(get_pool),
):
    """Returns the percentile rank (0–100) for a given score on an exam."""
    if not (0 <= score <= 10):
        raise HTTPException(status_code=422, detail="score must be between 0 and 10")
    row = await pool.fetchrow(
        """
        SELECT
            COUNT(*) FILTER (WHERE score <= $2) AS at_or_below,
            COUNT(*) AS total
        FROM exam_leaderboard
        WHERE exam_id = $1
        """,
        exam_id,
        score,
    )
    if not row or (row["total"] or 0) < 5:
        return {"percentile": None, "total": row["total"] if row else 0}
    percentile = round(100 * (row["at_or_below"] or 0) / row["total"])
    return {"percentile": percentile, "total": row["total"]}


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


@app.get("/exams")
async def list_exams(mode: str | None = None, pool=Depends(get_pool)):
    if mode:
        rows = await pool.fetch(
            "SELECT id,year,title,duration,source,category,mode,total_questions FROM exams WHERE mode=? ORDER BY year DESC",
            mode,
        )
    else:
        rows = await pool.fetch(
            "SELECT id,year,title,duration,source,category,mode,total_questions FROM exams WHERE mode!='retired' ORDER BY year DESC"
        )
    return [dict(r) for r in rows]


@app.get("/exams/{exam_id}")
async def get_exam(exam_id: str, pool=Depends(get_pool)):
    exam = await pool.fetchrow("SELECT * FROM exams WHERE id=?", exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    q_ids = await pool.fetch(
        "SELECT question_id FROM exam_questions WHERE exam_id=? ORDER BY position", exam_id
    )
    return {**dict(exam), "questionIds": [r["question_id"] for r in q_ids]}


@app.post("/questions/batch")
async def batch_questions(
    body: dict,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    ids = body.get("ids", [])[:200]
    if not ids:
        return []
    placeholders = ",".join("?" * len(ids))
    rows = await pool.fetch(f"SELECT * FROM questions WHERE id IN ({placeholders})", *ids)
    return [{**dict(r), "choices": json.loads(r["choices"])} for r in rows]


@app.get("/questions")
async def all_questions(
    topic: str | None = None,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    if topic:
        rows = await pool.fetch("SELECT * FROM questions WHERE topic=?", topic)
    else:
        rows = await pool.fetch("SELECT * FROM questions")
    return [{**dict(r), "choices": json.loads(r["choices"])} for r in rows]


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


# ── Class / teacher mode ─────────────────────────────────────────────────────

class CreateClassRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class JoinClassRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=30)


@app.post("/classes", status_code=201)
async def create_class(
    body: CreateClassRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    import secrets as _secrets
    code = _secrets.token_urlsafe(8)
    row = await pool.fetchrow(
        "INSERT INTO classes (teacher_id, code, name) VALUES ($1, $2, $3) RETURNING id, code, name",
        current_user.user_id, code, body.name,
    )
    return {"id": row["id"], "code": row["code"], "name": row["name"]}


@app.post("/classes/join", status_code=204)
async def join_class(
    body: JoinClassRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    # Always return 204 — do not distinguish "not found" from "full" to prevent enumeration
    cls = await pool.fetchrow(
        "SELECT id, teacher_id, max_students, active FROM classes WHERE code = $1", body.code
    )
    if not cls or not cls["active"] or cls["teacher_id"] == current_user.user_id:
        return  # silently ignore invalid/expired/self-join

    member_count = await pool.fetchrow(
        "SELECT COUNT(*) AS cnt FROM class_members WHERE class_id = $1", cls["id"]
    )
    if (member_count["cnt"] or 0) >= cls["max_students"]:
        return  # silently ignore full class

    try:
        await pool.execute(
            "INSERT INTO class_members (class_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            cls["id"], current_user.user_id,
        )
    except Exception:
        pass


@app.get("/classes")
async def list_my_classes(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    rows = await pool.fetch(
        """SELECT c.id, c.code, c.name, c.created_at,
                  (SELECT COUNT(*) FROM class_members WHERE class_id = c.id) AS member_count
           FROM classes c WHERE c.teacher_id = $1 AND c.active = 1 ORDER BY c.created_at DESC""",
        current_user.user_id,
    )
    return [dict(r) for r in rows]


@app.get("/classes/{class_id}/results")
async def class_results(
    class_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    # Ownership check — only the teacher may access full results
    cls = await pool.fetchrow("SELECT teacher_id FROM classes WHERE id = $1", class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    if cls["teacher_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    rows = await pool.fetch(
        """SELECT u.display_name, u.email,
                  er.exam_id, er.score, er.created_at
           FROM class_members cm
           JOIN users u ON u.id = cm.student_id
           LEFT JOIN exam_results er ON er.user_id = cm.student_id
           WHERE cm.class_id = $1
           ORDER BY u.display_name, er.created_at DESC""",
        class_id,
    )
    # Group by student
    students = {}
    for r in rows:
        key = r["email"]
        if key not in students:
            students[key] = {"display_name": r["display_name"], "email": r["email"], "results": []}
        if r["exam_id"]:
            students[key]["results"].append({
                "exam_id": r["exam_id"], "score": r["score"], "created_at": r["created_at"]
            })
    return list(students.values())


@app.post("/classes/{class_id}/deactivate", status_code=204)
async def deactivate_class(
    class_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    cls = await pool.fetchrow("SELECT teacher_id FROM classes WHERE id = $1", class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    if cls["teacher_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    await pool.execute("UPDATE classes SET active = 0 WHERE id = $1", class_id)


# ── Adaptive practice ─────────────────────────────────────────────────────────

class AdaptivePracticeRequest(BaseModel):
    weak_topics: list[str] = Field(default_factory=list, max_length=10)
    grade: str = Field(..., pattern=r"^(9|10|11|12)$")
    count: int = Field(default=5, ge=1, le=20)


@app.post("/adaptive-practice")
async def adaptive_practice(
    req: AdaptivePracticeRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    from app.math_wiki.taxonomy import CANONICAL_TOPICS
    # Allowlist weak_topics — reject any unknown topic slug
    invalid = [t for t in req.weak_topics if t not in CANONICAL_TOPICS]
    if invalid:
        raise HTTPException(status_code=422, detail=f"Unknown topic(s): {invalid!r}. Must be one of the canonical topic slugs.")

    cost = req.count
    await _spend_credits(pool, current_user.user_id, cost, "adaptive_practice")

    client = get_ai_client()
    settings = get_settings()
    topics_str = ", ".join(req.weak_topics) if req.weak_topics else "mixed"
    prompt = (
        f"Generate {req.count} multiple-choice math practice questions for a grade {req.grade} Vietnamese student. "
        f"Focus on these weak topics: <user_topics>{topics_str}</user_topics>. "
        "Return a JSON array of objects with keys: "
        '{"id": "ap_<uuid4_short>", "question": "question text (in Vietnamese)", "choices": ["A","B","C","D"], "correct": 0, "topic": "<slug>", "difficulty": "medium", "explanation": "step-by-step solution"}. '
        "Choices must be 4 strings. correct is the 0-based index of the correct choice. "
        "Use LaTeX notation for math expressions. Return ONLY the JSON array, no markdown fences."
    )
    try:
        response = await client.chat.completions.create(
            model=settings.default_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4096,
            temperature=0.7,
        )
        raw = (response.choices[0].message.content or "").strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        questions = json.loads(raw)
        if not isinstance(questions, list):
            raise ValueError("Expected a JSON array")
    except Exception as exc:
        logger.error("adaptive-practice generation failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Question generation failed: {exc}")

    return {"questions": questions}


# ── Admin endpoints ───────────────────────────────────────────────────────────

def _require_admin(request: Request):
    settings = get_settings()
    key = request.headers.get("x-admin-key", "")
    if not validate_admin_key(key, settings.admin_master_secret, settings.admin_key_rotation_period):
        request.state.admin_key_failed = True
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")


class SubscriptionUpdate(BaseModel):
    tier: str
    period: str = "monthly"
    expires_at: str | None = None
    bonus_credits: int = 0


class CreditGrant(BaseModel):
    amount: int
    reason: str = "admin_grant"


class ClassifyErrorRequest(BaseModel):
    question: str
    wrong_choice: str
    correct_choice: str


@app.post("/classify-error")
async def classify_error(
    req: ClassifyErrorRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Classify the error type for a wrong answer using Haiku."""
    client = get_ai_client()
    settings = get_settings()
    prompt = (
        f"Câu hỏi: {req.question[:300]}\n"
        f"Học sinh chọn: {req.wrong_choice[:150]}\n"
        f"Đáp án đúng: {req.correct_choice[:150]}\n\n"
        "Phân loại lỗi sai này CHÍNH XÁC một trong các loại sau:\n"
        "sign_error, formula_confusion, procedural_slip, conceptual_gap, calculation\n"
        "Chỉ trả lời DUY NHẤT tên loại lỗi, không giải thích."
    )
    try:
        response = await client.chat.completions.create(
            model=settings.haiku_model,
            max_tokens=20,
            messages=[{"role": "user", "content": prompt}],
        )
        category = response.choices[0].message.content.strip().lower()
        valid = {"sign_error", "formula_confusion", "procedural_slip", "conceptual_gap", "calculation"}
        if category not in valid:
            category = "procedural_slip"
        return {"category": category, "confidence": 0.8}
    except Exception:
        return {"category": None, "confidence": 0.0}


class SuspendRequest(BaseModel):
    reason: str


@app.post("/admin/generate-key-log", status_code=200)
async def generate_key_log(request: Request):
    settings = get_settings()
    cron_secret = settings.cron_secret or ""
    provided = request.headers.get("x-cron-secret", "")
    if not cron_secret or not hmac.compare_digest(provided.encode(), cron_secret.encode()):
        raise HTTPException(status_code=401, detail="Invalid or missing cron secret")
    if not settings.admin_master_secret or not settings.admin_key_log_enabled:
        return {"status": "disabled"}

    period = settings.admin_key_rotation_period
    label = get_window_label(period, offset=0)
    key = derive_key(settings.admin_master_secret, label)
    expiry = get_expiry_date(period)

    import datetime as _dt
    ict = _dt.timezone(_dt.timedelta(hours=7))
    ts = _dt.datetime.now(ict).strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"{label}  |  generated: {ts} ICT  |  expires: {expiry}  |  {key}\n"

    log_path = Path(settings.admin_key_log_path)
    try:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with open(log_path, "a") as f:
            f.write(log_line)
    except OSError as e:
        logger.error("Failed to write admin key log: %s", e)
        raise HTTPException(status_code=500, detail="Failed to write key log")

    return {"status": "ok", "window": label, "expires": expiry}


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
            WHERE rowid IN (SELECT MAX(rowid) FROM exam_results GROUP BY user_id)
        ) beh ON beh.user_id = u.id
    """
    if search:
        pattern = f"%{search}%"
        rows = await pool.fetch(
            f"""SELECT u.id, u.email, u.display_name, u.subscription_tier, u.credits_balance,
                      u.is_suspended, u.suspension_reason, u.is_locked, u.lock_reason,
                      u.is_deactivated, u.trial_used, u.created_at,
                      u.last_seen_at, u.pending_deletion_at,
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
                      u.last_seen_at, u.pending_deletion_at,
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

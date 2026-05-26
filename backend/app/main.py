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
        streak_freeze_count INTEGER NOT NULL DEFAULT 0,
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
    # Sprint 1 — Learning Graph Foundation
    """CREATE TABLE IF NOT EXISTS concepts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_vi TEXT NOT NULL,
        grade INTEGER NOT NULL CHECK(grade IN (9, 10, 11, 12)),
        topic TEXT NOT NULL,
        prerequisite_ids TEXT NOT NULL DEFAULT '[]',
        exam_weight REAL NOT NULL DEFAULT 1.0,
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS concept_mastery (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        concept_id TEXT NOT NULL REFERENCES concepts(id),
        mastery_score REAL NOT NULL DEFAULT 0.0,
        stage INTEGER NOT NULL DEFAULT 0 CHECK(stage BETWEEN 0 AND 5),
        velocity REAL NOT NULL DEFAULT 0.0,
        last_practiced TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, concept_id)
    )""",
    """CREATE TABLE IF NOT EXISTS review_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL,
        concept_id TEXT REFERENCES concepts(id),
        stability REAL NOT NULL DEFAULT 1.0,
        difficulty REAL NOT NULL DEFAULT 5.0,
        elapsed INTEGER NOT NULL DEFAULT 1,
        interval INTEGER NOT NULL DEFAULT 1,
        next_review_date TEXT NOT NULL,
        quality_last INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, question_id)
    )""",
    "CREATE INDEX IF NOT EXISTS idx_review_items_due ON review_items(user_id, next_review_date)",
    "CREATE INDEX IF NOT EXISTS idx_concept_mastery_user ON concept_mastery(user_id)",
    # concept_id on questions — nullable; backfilled gradually as concepts are tagged
    "ALTER TABLE questions ADD COLUMN concept_id TEXT REFERENCES concepts(id)",
    # Sprint 2 — Daily Engine
    """CREATE TABLE IF NOT EXISTS concept_elo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        concept_id TEXT NOT NULL REFERENCES concepts(id),
        rating REAL NOT NULL DEFAULT 1000.0,
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, concept_id)
    )""",
    """CREATE TABLE IF NOT EXISTS learning_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        completed_at TEXT NOT NULL DEFAULT (datetime('now')),
        sm2_reviewed INTEGER NOT NULL DEFAULT 0,
        advance_concept_id TEXT,
        session_date TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_concept_elo_user ON concept_elo(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_learning_sessions_user ON learning_sessions(user_id, session_date)",
    "ALTER TABLE concept_mastery ADD COLUMN review_count INTEGER NOT NULL DEFAULT 0",
    # Sprint 3 — Oracle Memory Layer
    """CREATE TABLE IF NOT EXISTS concept_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        concept_id TEXT NOT NULL REFERENCES concepts(id),
        preferred_style TEXT NOT NULL DEFAULT 'formula' CHECK(preferred_style IN ('visual','formula','example','analogy')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, concept_id)
    )""",
    """CREATE TABLE IF NOT EXISTS error_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        concept_id TEXT REFERENCES concepts(id),
        error_type TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 1,
        last_seen TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, concept_id, error_type)
    )""",
    "CREATE INDEX IF NOT EXISTS idx_error_patterns_user ON error_patterns(user_id, concept_id)",
    # Sprint 4 — Extended Onboarding fields (additive, all nullable)
    "ALTER TABLE users ADD COLUMN target_school TEXT",
    "ALTER TABLE users ADD COLUMN exam_date TEXT",
    "ALTER TABLE users ADD COLUMN weekly_study_hours INTEGER",
    "ALTER TABLE users ADD COLUMN extended_onboarding_done INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN streak_freeze_count INTEGER NOT NULL DEFAULT 0",
    # Sprint 19 — MOAT 3: Teacher/Class Integration Foundation
    """CREATE TABLE IF NOT EXISTS teacher_classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_code TEXT UNIQUE NOT NULL,
        teacher_name TEXT NOT NULL,
        subject TEXT NOT NULL DEFAULT 'Toán',
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS teacher_class_members (
        class_id INTEGER REFERENCES teacher_classes(id),
        user_id INTEGER REFERENCES users(id),
        joined_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (class_id, user_id)
    )""",
    # Sprint 20 — MOAT 4: Longitudinal Learner Memory
    """CREATE TABLE IF NOT EXISTS learner_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        snapshot_date TEXT DEFAULT (datetime('now')),
        topic_id TEXT NOT NULL,
        mastery_score REAL NOT NULL,
        exam_count_at_snapshot INTEGER DEFAULT 0
    )""",
    "CREATE INDEX IF NOT EXISTS idx_learner_memory_user_topic ON learner_memory(user_id, topic_id, snapshot_date)",
    # Sprint 21 — MOAT 5: Study Partner Matching
    """CREATE TABLE IF NOT EXISTS study_partner_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requester_id INTEGER REFERENCES users(id),
        partner_id INTEGER REFERENCES users(id),
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(requester_id, partner_id)
    )""",
    "CREATE INDEX IF NOT EXISTS idx_spr_requester ON study_partner_requests(requester_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_spr_partner ON study_partner_requests(partner_id, status)",
    # Streak mechanics — weekly freeze replenishment tracking
    "ALTER TABLE users ADD COLUMN streak_freeze_reset_at TEXT DEFAULT NULL",
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


_RATE_LIMIT_RETRY_DELAY_S = 2 * 3600  # 2 hours — wait for quota window to reset


async def _fix_english_wiki_units(pool, client) -> None:
    """Translate all English wiki units to Vietnamese; self-disables after success.

    Three-phase design to protect the live app:
      Phase 1 — translate concurrently (API-bound, semaphore=3, no DB contact)
      Phase 2 — batch-embed translated content (BGE-M3, batches of 50, single thread)
      Phase 3 — write to DB sequentially with precomputed embeddings (no re-inference)

    Rate-limit recovery: if ALL phase-1 translations fail the function sleeps
    _RATE_LIMIT_RETRY_DELAY_S then retries automatically, up to 12 times.
    """
    import json as _json
    from app.config import get_settings as _gs
    from app.math_wiki.storage import pg_db
    from app.math_wiki.storage.vectors import embed_texts
    from app.math_wiki.schemas import WikiUnit
    from app.agent.core import call_with_retry

    settings = _gs()
    MAX_RATE_LIMIT_RETRIES = 12

    for rate_attempt in range(MAX_RATE_LIMIT_RETRIES + 1):
        try:
            rows = await pool.fetch(
                "SELECT id, type, topic, subtopic, content, problem_ids, source, source_url "
                "FROM wiki_units WHERE deleted = false"
            )
            english = [r for r in rows if not _VI_RE.search(r["content"])]
            logger.warning("fix-english-wiki: %d total units, %d need translation", len(rows), len(english))
            if not english:
                logger.warning("fix-english-wiki: nothing to do — all units already Vietnamese")
                await _hf_set_space_variable("WIKI_FIX_ENGLISH_ENABLED", "false")
                return

            # ── Phase 1: Translate (API-bound, concurrent) ────────────────
            sem = asyncio.Semaphore(3)
            translated: list[tuple] = []
            failed_ids: list[str] = []

            async def _translate_one(r):
                async with sem:
                    try:
                        resp = await call_with_retry(
                            client,
                            model=settings.default_model,  # Sonnet — 5× less quota than Opus
                            max_tokens=1024,
                            messages=[
                                {"role": "system", "content": _TRANSLATE_SYSTEM},
                                {"role": "user", "content": r["content"]},
                            ],
                        )
                        text = (resp.choices[0].message.content or "").strip()
                        if not text:
                            raise ValueError("empty response")
                        orig_dollar = r["content"].count("$")
                        if orig_dollar > 0 and text.count("$") % 2 != 0:
                            logger.warning("fix-english-wiki: %s — odd $ count after translation, skipping", r["id"])
                            failed_ids.append(r["id"])
                            return
                        translated.append((r, text))
                    except Exception as exc:
                        logger.warning("fix-english-wiki: translate failed %s — %s", r["id"], exc)
                        failed_ids.append(r["id"])

            await asyncio.gather(*(_translate_one(r) for r in english))
            logger.warning("fix-english-wiki phase1 done: %d translated, %d failed", len(translated), len(failed_ids))

            # All units rate-limited → quota exhausted; sleep and retry
            if len(translated) == 0 and len(failed_ids) == len(english):
                if rate_attempt < MAX_RATE_LIMIT_RETRIES:
                    wait_h = _RATE_LIMIT_RETRY_DELAY_S // 3600
                    logger.warning(
                        "fix-english-wiki: quota exhausted (attempt %d/%d) — sleeping %dh before retry",
                        rate_attempt + 1, MAX_RATE_LIMIT_RETRIES, wait_h,
                    )
                    await asyncio.sleep(_RATE_LIMIT_RETRY_DELAY_S)
                    continue
                logger.warning("fix-english-wiki: quota exhausted after %d retries — giving up until next boot", MAX_RATE_LIMIT_RETRIES)
                return

            # ── Phase 2: Batch-embed (CPU-bound, batched for BGE-M3 efficiency)
            loop = asyncio.get_event_loop()
            EMBED_BATCH = 50
            embeddings: list[list[float]] = []
            for i in range(0, len(translated), EMBED_BATCH):
                batch_texts = [t for _, t in translated[i:i + EMBED_BATCH]]
                vecs = await loop.run_in_executor(None, embed_texts, batch_texts, "passage")
                embeddings.extend(vecs)
                logger.warning("fix-english-wiki phase2: embedded %d/%d",
                               min(i + EMBED_BATCH, len(translated)), len(translated))
                await asyncio.sleep(0)

            # ── Phase 3: Write to DB (sequential, precomputed embeddings) ───
            ok = 0
            for (r, text), emb in zip(translated, embeddings):
                try:
                    unit = WikiUnit(
                        id=r["id"], type=r["type"], topic=r["topic"],
                        subtopic=r["subtopic"] or "",
                        content=text,
                        problem_ids=[] if r["problem_ids"] is None else _json.loads(r["problem_ids"]),
                    )
                    await pg_db.upsert_wiki_unit(
                        pool, unit,
                        source=r["source"], source_url=r["source_url"],
                        editor="fix_english_wiki_units",
                        reason="Translated English content to Vietnamese (bulk migration)",
                        embedding=emb,
                    )
                    ok += 1
                    if ok % 100 == 0:
                        logger.warning("fix-english-wiki phase3: %d/%d written", ok, len(translated))
                except Exception as exc:
                    logger.warning("fix-english-wiki: write failed %s — %s", r["id"], exc)
                    failed_ids.append(r["id"])

            logger.warning("fix-english-wiki complete: translated=%d failed=%d", ok, len(failed_ids))
            if not failed_ids:
                await _hf_set_space_variable("WIKI_FIX_ENGLISH_ENABLED", "false")
            else:
                logger.warning("fix-english-wiki: %d failures — flag not auto-disabled (will retry on next boot)",
                               len(failed_ids))
            return  # success — exit retry loop

        except Exception as exc:
            logger.error("fix-english-wiki failed: %s", exc)
            return


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


async def _seed_teacher_classes(pool) -> None:
    """Seed one demo teacher class for Sprint 19 testing (INSERT OR IGNORE)."""
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT OR IGNORE INTO teacher_classes (class_code, teacher_name, subject)
                   VALUES (?, ?, ?)""",
                "ZENITH", "Giáo viên Demo", "Toán",
            )
        logger.info("_seed_teacher_classes: demo class seeded")
    except Exception as exc:
        logger.warning("_seed_teacher_classes failed: %s", exc)


async def _seed_concepts(pool) -> None:
    """Seed the concepts table with the initial 20-concept taxonomy (INSERT OR IGNORE)."""
    import json as _json
    from app.data.concepts import CONCEPTS
    try:
        async with pool.acquire() as conn:
            for c in CONCEPTS:
                await conn.execute(
                    """INSERT OR IGNORE INTO concepts
                       (id, name, name_vi, grade, topic, prerequisite_ids, exam_weight)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    c["id"], c["name"], c["name_vi"], c["grade"], c["topic"],
                    _json.dumps(c["prerequisite_ids"]), c["exam_weight"],
                )
        logger.info("_seed_concepts: seeded %d concepts", len(CONCEPTS))
    except Exception as exc:
        logger.warning("_seed_concepts failed: %s", exc)


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
    await _seed_concepts(app.state.pool)
    await _seed_teacher_classes(app.state.pool)

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
    print(f"[startup] wiki_fix_english_enabled={settings.wiki_fix_english_enabled}", flush=True)
    logger.warning("startup: wiki_fix_english_enabled=%s", settings.wiki_fix_english_enabled)
    if app.state.pool and settings.wiki_fix_english_enabled:
        logger.warning("startup: launching fix-english-wiki background task")
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

# ── Review / Learning Graph models ───────────────────────────────────────────

class ReviewItemIn(BaseModel):
    question_id: str
    stability: float = 1.0
    difficulty: float = 5.0
    elapsed: int = 1
    interval: int = 1
    next_review_date: str  # YYYY-MM-DD

class ReviewItemsBulkRequest(BaseModel):
    items: list[ReviewItemIn]

class ReviewAnswerRequest(BaseModel):
    quality: int              # 1 (forgot) | 3 (good) | 5 (easy)
    response_time_seconds: int | None = None  # collected for future velocity signal

# ── Exam AI models ───────────────────────────────────────────────────────────

class ExamAnalyzeRequest(BaseModel):
    result: dict
    history: list[dict] = []
    student_name: str = ""
    wrong_questions: list[dict] = []
    school_recommendations: list[dict] = []
    exam_category: str = ""
    user_profile: dict = {}
    learner_archetype: str | None = None


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
    hint_style: str = "socratic"
    ai_preferences: dict = {}
    encouragement_level: str = "moderate"   # 'minimal' | 'moderate' | 'high'
    session_length_pref: int = 30           # 15 | 30 | 45 | 60


class HintResponse(BaseModel):
    hint: str
    difficulty_note: str = ""


class TutorChatRequest(BaseModel):
    messages: list[dict]
    exam_context: dict = {}
    student_name: str = ""
    ai_preferences: dict = {}


class TutorChatResponse(BaseModel):
    reply: str
    messages: list[dict]


class ExplainRequest(BaseModel):
    question: dict
    chosen_index: int
    explanation_depth: str = "detailed"
    ai_preferences: dict = {}
    encouragement_level: str = "moderate"   # 'minimal' | 'moderate' | 'high'
    session_length_pref: int = 30           # 15 | 30 | 45 | 60


class ExplainResponse(BaseModel):
    correct_index: int
    explanation: str


class StudyPlanRequest(BaseModel):
    result: dict
    history: list[dict] = []
    wrong_questions: list[dict] = []
    topic_miss_counts: dict = {}
    student_name: str = ""
    learner_archetype: str | None = None
    ai_preferences: dict = {}


class StudyPlanResponse(BaseModel):
    plan: str
    weekly_schedule: list[dict]


class MathIngestRequest(BaseModel):
    text: str


class MathSolveRequest(BaseModel):
    question: str
    image_base64: str | None = None
    image_mime: str | None = None


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


class ChartInsightsRequest(BaseModel):
    spark_data: list[dict] = []
    radar_data: list[dict] = []
    heatmap_summary: dict = {}


class ChartInsightsResponse(BaseModel):
    spark_insight: str
    radar_insight: str
    heatmap_insight: str


# ── Existing routes ──────────────────────────────────────────────────────────

@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    return {"status": "ok"}


@app.get("/wiki/status")
async def wiki_status():
    from app.math_wiki.pipeline import get_wiki_status
    return get_wiki_status()


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
            learner_archetype=req.learner_archetype,
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
    if req.learner_archetype:
        prompt += f"\nLearner type: {req.learner_archetype}"
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
        merged_prefs = {"hint_style": req.hint_style, "encouragement_level": req.encouragement_level, "session_length_pref": req.session_length_pref, **req.ai_preferences}
        data = await generate_hint(client, req.question, req.attempt_count, req.previous_hints, merged_prefs)
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

    # Build memory prefix — layers stack in order: long-term session, concept style, error patterns
    memory_parts: list[str] = []

    # Layer 1: session memory (Complete only)
    if tier_t == "complete":
        mem_row = await pool.fetchrow(
            "SELECT summary FROM tutor_memory WHERE user_id = ?", current_user.user_id
        )
        if mem_row and mem_row["summary"]:
            memory_parts.append(f"Lịch sử học: {mem_row['summary']}")

    # Layer 2: concept explanation style preference (all tiers)
    concept_id = req.exam_context.get("concept_id") if req.exam_context else None
    if concept_id:
        style_row = await pool.fetchrow(
            "SELECT preferred_style FROM concept_memory WHERE user_id = ? AND concept_id = ?",
            current_user.user_id, concept_id,
        )
        if style_row:
            style_map = {"visual": "hình ảnh/sơ đồ", "formula": "công thức trước", "example": "ví dụ cụ thể", "analogy": "so sánh tương tự"}
            memory_parts.append(f"Phong cách giải thích hiệu quả với học sinh này: {style_map.get(style_row['preferred_style'], 'công thức trước')}")

        # Layer 3: error patterns on this concept (all tiers)
        err_rows = await pool.fetch(
            """SELECT error_type, count FROM error_patterns
               WHERE user_id = ? AND concept_id = ? AND count >= 2
               ORDER BY count DESC LIMIT 3""",
            current_user.user_id, concept_id,
        )
        if err_rows:
            err_type_vi = {"sign_error": "sai dấu", "formula_confusion": "nhầm công thức",
                           "procedural_slip": "sai quy trình", "conceptual_gap": "lỗ hổng khái niệm", "calculation": "lỗi tính toán"}
            errs = ", ".join(f"{err_type_vi.get(r['error_type'], r['error_type'])} ({r['count']} lần)" for r in err_rows)
            memory_parts.append(f"Lỗi hay gặp ở chủ đề này: {errs}")

    memory_prefix = f"[{' | '.join(memory_parts)}]\n\n" if memory_parts else ""

    reply, updated = await run_tutor(
        client, req.messages, req.exam_context, req.student_name,
        memory_prefix=memory_prefix,
        ai_preferences=req.ai_preferences,
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
        merged_prefs = {"explanation_depth": req.explanation_depth, "encouragement_level": req.encouragement_level, "session_length_pref": req.session_length_pref, **req.ai_preferences}
        data = await generate_explanation(client, req.question, req.chosen_index, merged_prefs)
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
    session_length_pref = int(req.ai_preferences.get("session_length_pref", 30))
    data = await generate_study_plan(client, req.result, req.history, req.wrong_questions, req.topic_miss_counts, req.student_name, learner_archetype=req.learner_archetype, session_length_pref=session_length_pref)
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


# Static prefix-cache-friendly system prompt (placed first for prefix caching)
_CHART_INSIGHTS_SYSTEM = (
    "You are a Vietnamese study advisor. Given exam performance data, generate exactly 3 "
    "one-line insights in Vietnamese. Each must be ≤25 words and end with a concrete action "
    "recommendation. Return JSON with keys: spark_insight, radar_insight, heatmap_insight."
)

_CHART_INSIGHTS_FALLBACKS = {
    "spark_insight": "Chưa đủ dữ liệu điểm số. Hoàn thành thêm bài thi để xem xu hướng.",
    "radar_insight": "Chưa đủ dữ liệu chủ đề. Làm thêm bài thi đa dạng chủ đề để xem phân tích.",
    "heatmap_insight": "Chưa có dữ liệu hoạt động. Bắt đầu học đều đặn mỗi ngày để xây chuỗi.",
}


@app.post("/insights/charts", response_model=ChartInsightsResponse)
async def chart_insights(
    req: ChartInsightsRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Generate free Haiku-powered one-line insights for the three main analytics charts.
    No credit deduction — this endpoint is FREE.
    """
    from app.agent.core import call_with_retry

    # Return fallbacks immediately when all data is empty
    has_spark = bool(req.spark_data)
    has_radar = bool(req.radar_data)
    has_heatmap = bool(req.heatmap_summary.get("total_sessions") or req.heatmap_summary.get("active_days"))

    if not has_spark and not has_radar and not has_heatmap:
        return ChartInsightsResponse(**_CHART_INSIGHTS_FALLBACKS)

    settings = get_settings()

    # Build dynamic user data payload (appended last, after static prefix)
    spark_text = json.dumps(req.spark_data[-10:], ensure_ascii=False) if has_spark else "[]"
    radar_text = json.dumps(req.radar_data, ensure_ascii=False) if has_radar else "[]"
    heatmap_text = json.dumps(req.heatmap_summary, ensure_ascii=False)

    user_content = (
        f"Score trend data (last 10 exams, score 0–10): {spark_text}\n"
        f"Topic accuracy data (score 0–100 = %): {radar_text}\n"
        f"Activity heatmap summary: {heatmap_text}\n\n"
        "Return JSON only, no other text."
    )

    try:
        resp = await call_with_retry(
            client,
            model=settings.haiku_model,
            max_tokens=300,
            messages=[
                {"role": "system", "content": _CHART_INSIGHTS_SYSTEM},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
        )
        raw = (resp.choices[0].message.content or "{}").strip()
        parsed = json.loads(raw)
        return ChartInsightsResponse(
            spark_insight=parsed.get("spark_insight") or _CHART_INSIGHTS_FALLBACKS["spark_insight"],
            radar_insight=parsed.get("radar_insight") or _CHART_INSIGHTS_FALLBACKS["radar_insight"],
            heatmap_insight=parsed.get("heatmap_insight") or _CHART_INSIGHTS_FALLBACKS["heatmap_insight"],
        )
    except Exception as exc:
        logger.warning("chart_insights failed: %s", exc)
        return ChartInsightsResponse(**_CHART_INSIGHTS_FALLBACKS)


_WEEKLY_INSIGHT_SYSTEM = (
    "You are a Vietnamese study advisor writing a weekly learning summary for a high school student. "
    "Write exactly 2 sentences in Vietnamese. Be specific, encouraging, and actionable. "
    "Focus on what improved and what to prioritize next week. Do not use markdown."
)


class WeeklyInsightRequest(BaseModel):
    exam_count: int
    avg_score: float
    score_delta: float
    top_weak_topic: str | None = None
    streak: int
    days_studied: int


class WeeklyInsightResponse(BaseModel):
    summary: str


@app.post("/insights/weekly", response_model=WeeklyInsightResponse)
async def weekly_insight(
    req: WeeklyInsightRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Generate a free Haiku-powered weekly learning summary in Vietnamese.
    No credit deduction — this endpoint is FREE.
    """
    from app.agent.core import call_with_retry

    settings = get_settings()

    delta_str = f"+{req.score_delta:.1f}" if req.score_delta >= 0 else f"{req.score_delta:.1f}"
    user_content = (
        f"exams_this_week={req.exam_count}, avg_score={req.avg_score:.1f}, "
        f"score_delta_vs_last_week={delta_str}, "
        f"top_weak_topic={req.top_weak_topic or 'none'}, "
        f"streak_days={req.streak}, days_studied_this_week={req.days_studied}"
    )

    def _fallback() -> WeeklyInsightResponse:
        text = f"Tuần này bạn đã làm {req.exam_count} bài thi với điểm TB {req.avg_score:.1f}."
        if req.top_weak_topic:
            text += f" Tuần tới tập trung ôn {req.top_weak_topic} để tăng điểm nhanh nhất."
        return WeeklyInsightResponse(summary=text)

    try:
        resp = await call_with_retry(
            client,
            model=settings.haiku_model,
            max_tokens=200,
            messages=[
                {"role": "system", "content": _WEEKLY_INSIGHT_SYSTEM},
                {"role": "user", "content": user_content},
            ],
        )
        text = (resp.choices[0].message.content or "").strip()
        if not text:
            return _fallback()
        return WeeklyInsightResponse(summary=text)
    except Exception as exc:
        logger.warning("weekly_insight failed: %s", exc)
        return _fallback()


@app.get("/insights/peer-stats")
async def peer_stats(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Return anonymized peer performance stats for students in the same grade.
    Only includes paying users (student/complete tier) for meaningful data.
    FREE — no credit deduction.
    """
    # Get current user's grade
    user_row = await pool.fetchrow(
        "SELECT grade FROM users WHERE id = ?", current_user.user_id
    )
    if not user_row or not user_row["grade"]:
        return {"sample_size": 0, "message": None}

    grade = user_row["grade"]

    # Fetch last 20 exam results for each peer (same grade, paying tier, excluding self)
    peer_rows = await pool.fetch(
        """SELECT er.user_id, er.score, er.created_at
           FROM exam_results er
           JOIN users u ON u.id = er.user_id
           WHERE u.grade = ?
             AND u.subscription_tier IN ('student', 'complete')
             AND er.user_id != ?
             AND er.score IS NOT NULL
           ORDER BY er.user_id, er.created_at DESC""",
        grade, current_user.user_id,
    )

    # Group into per-user result lists (take last 20 per user)
    from collections import defaultdict
    user_results: dict[int, list[float]] = defaultdict(list)
    for row in peer_rows:
        uid = row["user_id"]
        if len(user_results[uid]) < 20:
            user_results[uid].append(row["score"])

    sample_size = len(user_results)
    if sample_size < 5:
        return {"sample_size": 0, "message": None}

    # avg_improvement: compare first 5 vs last 5 for users with >=10 exams
    # Note: rows are DESC by created_at, so index 0 = most recent (last 5), last indices = oldest (first 5)
    improvements = []
    for scores in user_results.values():
        if len(scores) >= 10:
            # scores[0..4] = last 5 (most recent), scores[-5:] = first 5 (oldest)
            recent_avg = sum(scores[:5]) / 5
            early_avg = sum(scores[-5:]) / 5
            improvements.append(recent_avg - early_avg)

    avg_improvement = round(sum(improvements) / len(improvements), 1) if improvements else 0.0

    # avg_weekly_exams: total results / (weeks spanned), approximate via total count / users / ~4 weeks
    total_exams = sum(len(s) for s in user_results.values())
    avg_weekly_exams = round((total_exams / sample_size) / 4, 1)

    # top_percentile_threshold: 80th percentile of peer avg scores
    peer_avgs = sorted(
        sum(scores) / len(scores) for scores in user_results.values()
    )
    p80_idx = max(0, int(len(peer_avgs) * 0.8) - 1)
    top_percentile_threshold = round(peer_avgs[p80_idx], 1)

    # Build message
    grade_label = f"lớp {grade}"
    if avg_improvement > 0:
        message = (
            f"Học sinh {grade_label} cải thiện trung bình {avg_improvement} điểm "
            f"sau 4-6 tuần luyện tập đều đặn."
        )
    else:
        message = (
            f"Học sinh {grade_label} luyện tập trung bình {avg_weekly_exams} bài/tuần."
        )

    return {
        "sample_size": sample_size,
        "avg_improvement": avg_improvement,
        "avg_weekly_exams": avg_weekly_exams,
        "top_percentile_threshold": top_percentile_threshold,
        "message": message,
    }


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
async def math_ocr(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
):
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
    tier_row_ms = await pool.fetchrow("SELECT subscription_tier, tos_accepted_at FROM users WHERE id = ?", current_user.user_id)
    if not tier_row_ms or not tier_row_ms["tos_accepted_at"]:
        raise HTTPException(status_code=403, detail={"code": "tos_not_accepted"})
    if tier_row_ms["subscription_tier"] == "basic":
        today_uses = await pool.fetchrow(
            "SELECT COUNT(*) AS cnt FROM ai_credits_log WHERE user_id = ? AND reason = 'math_solve' AND created_at >= date('now')",
            current_user.user_id,
        )
        if (today_uses["cnt"] or 0) >= 5:
            raise HTTPException(403, detail={"code": "tier_required", "message": "Đã dùng hết 5 lượt Oracle hôm nay — nâng cấp để dùng không giới hạn"})
    await pool.execute("INSERT INTO ai_credits_log (user_id, delta, reason) VALUES (?, 0, 'math_solve')", current_user.user_id)
    image_bytes: bytes | None = None
    if req.image_base64:
        try:
            import base64 as _b64
            raw = req.image_base64
            # Strip data URI prefix if present
            if ',' in raw:
                raw = raw.split(',', 1)[1]
            decoded = _b64.b64decode(raw)
            if len(decoded) > 4 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="Image too large (max 4 MB)")
            image_bytes = decoded
        except Exception as exc:
            if isinstance(exc, HTTPException):
                raise
            raise HTTPException(status_code=400, detail=f"Invalid image_base64: {exc}")

    client = get_ai_client()
    from app.math_wiki.pipeline import run_pipeline
    for attempt in range(2):
        try:
            return await asyncio.wait_for(
                run_pipeline(pool, client, req.question, image_bytes=image_bytes, image_mime=req.image_mime or "image/jpeg"),
                timeout=55,
            )
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

# Weekly streak freeze quota by tier
_FREEZE_QUOTA = {"basic": 0, "student": 1, "complete": 3}


async def _replenish_streak_freeze(pool, user_id: int, tier: str, current_reset_at) -> int | None:
    """Top up streak_freeze_count to the weekly quota if 7+ days have elapsed.

    Returns the new freeze count if a replenishment occurred, else None.
    """
    quota = _FREEZE_QUOTA.get(tier, 0)
    if quota == 0:
        return None

    now = datetime.utcnow()
    should_replenish = (current_reset_at is None)
    if not should_replenish and current_reset_at:
        try:
            last_reset = datetime.fromisoformat(str(current_reset_at))
            should_replenish = (now - last_reset).days >= 7
        except (ValueError, TypeError):
            should_replenish = True

    if not should_replenish:
        return None

    await pool.execute(
        """UPDATE users
           SET streak_freeze_count = $1,
               streak_freeze_reset_at = $2
           WHERE id = $3""",
        quota,
        now.strftime("%Y-%m-%dT%H:%M:%S"),
        user_id,
    )
    return quota


@app.get("/users/me")
async def get_me(current_user: CurrentUser = Depends(get_current_user), pool=Depends(get_pool)):
    row = await pool.fetchrow(
        """SELECT id, email, display_name, avatar_url, custom_display_name,
                  grade, school_type, province,
                  subscription_tier, subscription_period, subscription_expires_at,
                  credits_balance, credits_reset_at,
                  is_suspended, suspension_reason, tos_accepted_at,
                  trial_used, trial_expires_at,
                  is_deactivated, is_locked, lock_reason,
                  target_school, exam_date, weekly_study_hours, extended_onboarding_done,
                  streak_freeze_count, streak_freeze_reset_at
           FROM users WHERE id = $1""",
        current_user.user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    row = dict(row)
    # Weekly streak freeze replenishment
    new_freeze_count = await _replenish_streak_freeze(
        pool,
        current_user.user_id,
        row.get("subscription_tier", "basic"),
        row.get("streak_freeze_reset_at"),
    )
    if new_freeze_count is not None:
        row["streak_freeze_count"] = new_freeze_count
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
    # Compute mastery rank from solid concept count
    solid_row = await pool.fetchrow(
        "SELECT COUNT(*) AS cnt FROM concept_mastery WHERE user_id=$1 AND stage >= 4",
        current_user.user_id,
    )
    solid_count = solid_row["cnt"] if solid_row else 0
    if solid_count >= 56:
        mastery_rank = "Chuyên gia"
    elif solid_count >= 36:
        mastery_rank = "Sinh viên"
    elif solid_count >= 16:
        mastery_rank = "Học sinh"
    else:
        mastery_rank = "Pemula"
    row["mastery_rank"] = mastery_rank
    row["solid_concept_count"] = solid_count
    return row


@app.post("/users/me/streak-freeze")
async def use_streak_freeze(current_user: CurrentUser = Depends(get_current_user), pool=Depends(get_pool)):
    """Spend one streak freeze charge. Returns updated balance."""
    row = await pool.fetchrow(
        "SELECT subscription_tier, streak_freeze_count FROM users WHERE id = $1",
        current_user.user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    tier = row["subscription_tier"]
    if tier == "basic":
        raise HTTPException(status_code=400, detail="streak_freeze_not_available")

    current_balance = row["streak_freeze_count"] or 0
    if current_balance <= 0:
        raise HTTPException(status_code=400, detail="no_freezes_remaining")

    await pool.execute(
        "UPDATE users SET streak_freeze_count = streak_freeze_count - 1 WHERE id = $1",
        current_user.user_id,
    )
    new_balance = current_balance - 1

    # Record credit-style event for auditing
    await pool.execute(
        "INSERT INTO ai_credits_log (user_id, delta, reason) VALUES ($1, $2, $3)",
        current_user.user_id, 0, "streak_freeze_used",
    )

    return {"streak_freeze_count": new_balance}


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


class ExtendedProfileRequest(BaseModel):
    target_school: str | None = None
    exam_date: str | None = None       # YYYY-MM-DD
    weekly_study_hours: int | None = None


@app.post("/users/me/profile/extended", status_code=204)
async def update_extended_profile(
    body: ExtendedProfileRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Save optional post-onboarding fields. Always marks extended_onboarding_done=1."""
    sets, params = ["extended_onboarding_done = 1"], []
    if body.target_school is not None:
        sets.append("target_school = ?"); params.append(body.target_school[:200].strip())
    if body.exam_date is not None:
        # Validate YYYY-MM-DD format
        import re as _re
        if not _re.match(r"^\d{4}-\d{2}-\d{2}$", body.exam_date):
            raise HTTPException(status_code=422, detail="exam_date must be YYYY-MM-DD")
        sets.append("exam_date = ?"); params.append(body.exam_date)
    if body.weekly_study_hours is not None:
        hours = max(1, min(168, body.weekly_study_hours))
        sets.append("weekly_study_hours = ?"); params.append(hours)
    params.append(current_user.user_id)
    await pool.execute(
        f"UPDATE users SET {', '.join(sets)} WHERE id = ?",  # noqa: S608
        *params,
    )


@app.post("/users/me/tos-accept", status_code=204)
async def accept_tos(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    await pool.execute(
        "UPDATE users SET tos_accepted_at = datetime('now') WHERE id = ? AND tos_accepted_at IS NULL",
        current_user.user_id,
    )


# ── Review / Learning Graph endpoints ────────────────────────────────────────

@app.post("/users/me/review-items", status_code=201)
async def bulk_create_review_items(
    body: ReviewItemsBulkRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Migrate localStorage review queue to server. INSERT OR IGNORE (idempotent)."""
    inserted = 0
    for item in body.items:
        result = await pool.execute(
            """INSERT OR IGNORE INTO review_items
               (user_id, question_id, stability, difficulty, interval, next_review_date)
               VALUES ($1, $2, $3, $4, $5, $6)""",
            current_user.user_id,
            item.question_id,
            item.stability,
            item.difficulty,
            item.interval,
            item.next_review_date,
        )
        if result != "INSERT OR IGNORE 0":
            inserted += 1
    return {"inserted": inserted, "total": len(body.items)}


@app.get("/users/me/review-items/due")
async def get_due_review_items(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Return all review items due today or overdue, ordered by most overdue first."""
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    rows = await pool.fetch(
        """SELECT ri.id, ri.question_id, ri.stability, ri.difficulty,
                  ri.interval, ri.repetitions, ri.next_review_date, ri.concept_id
           FROM review_items ri
           WHERE ri.user_id = $1 AND ri.next_review_date <= $2
           ORDER BY ri.next_review_date ASC
           LIMIT 50""",
        current_user.user_id,
        today,
    )
    return {"items": [dict(r) for r in rows], "due_count": len(rows)}


@app.post("/users/me/review-items/{item_id}/answer")
async def answer_review_item(
    item_id: int,
    body: ReviewAnswerRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Apply FSRS update to a review item and update concept mastery."""
    from datetime import datetime, timezone, timedelta
    from app.agent.fsrs import fsrs_update

    if body.quality not in (1, 3, 5):
        raise HTTPException(status_code=422, detail="quality must be 1, 3, or 5")

    row = await pool.fetchrow(
        "SELECT * FROM review_items WHERE id = $1 AND user_id = $2",
        item_id, current_user.user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Review item not found")

    today = datetime.now(timezone.utc).date()
    last_reviewed = datetime.fromisoformat(row["next_review_date"]).date() if row["next_review_date"] else today
    elapsed = max(1, (today - last_reviewed).days + row["interval"])

    new_stability, new_difficulty, interval = fsrs_update(
        row["stability"], row["difficulty"], elapsed, body.quality
    )
    next_date = (today + timedelta(days=interval)).isoformat()

    await pool.execute(
        """UPDATE review_items
           SET stability=$1, difficulty=$2, interval=$3, repetitions=repetitions+1,
               next_review_date=$4, quality_last=$5, updated_at=NOW()
           WHERE id=$6""",
        new_stability, new_difficulty, interval, next_date, body.quality, item_id,
    )

    # Update concept mastery if concept_id is set; track stage advance for mastery moment
    concept_id = row["concept_id"]
    stage_advanced = False
    new_stage = None
    concept_name_vi = None

    if concept_id:
        mastery_row = await pool.fetchrow(
            "SELECT mastery_score, stage, review_count FROM concept_mastery WHERE user_id=$1 AND concept_id=$2",
            current_user.user_id, concept_id,
        )
        if mastery_row:
            old_stage = mastery_row["stage"]
            delta = 5 if body.quality >= 3 else -8
            new_mastery = max(0, min(100, mastery_row["mastery_score"] + delta))
            new_stage = _mastery_to_stage(new_mastery)
            stage_advanced = new_stage > old_stage
            await pool.execute(
                """UPDATE concept_mastery
                   SET mastery_score=$1, stage=$2, review_count=review_count+1,
                       last_practiced=NOW(), updated_at=NOW()
                   WHERE user_id=$3 AND concept_id=$4""",
                new_mastery, new_stage, current_user.user_id, concept_id,
            )
        else:
            initial_mastery = 20 if body.quality >= 3 else 5
            new_stage = _mastery_to_stage(initial_mastery)
            stage_advanced = new_stage > 0
            await pool.execute(
                """INSERT INTO concept_mastery (user_id, concept_id, mastery_score, stage, review_count)
                   VALUES ($1, $2, $3, $4, 1)""",
                current_user.user_id, concept_id, initial_mastery, new_stage,
            )

        if stage_advanced:
            c_row = await pool.fetchrow("SELECT name_vi FROM concepts WHERE id=$1", concept_id)
            concept_name_vi = c_row["name_vi"] if c_row else concept_id

    # Update ELO rating for this concept
    if concept_id:
        elo_row = await pool.fetchrow(
            "SELECT rating FROM concept_elo WHERE user_id=$1 AND concept_id=$2",
            current_user.user_id, concept_id,
        )
        student_elo = elo_row["rating"] if elo_row else 1000.0
        # Map FSRS difficulty (1-10) to question ELO (800-1340)
        q_elo = 800 + (row["difficulty"] - 1) * 60
        K = 32
        expected = 1 / (1 + 10 ** ((q_elo - student_elo) / 400))
        outcome = 1.0 if body.quality >= 3 else 0.0
        new_elo = max(600.0, min(2000.0, student_elo + K * (outcome - expected)))
        if elo_row:
            await pool.execute(
                "UPDATE concept_elo SET rating=$1, updated_at=NOW() WHERE user_id=$2 AND concept_id=$3",
                new_elo, current_user.user_id, concept_id,
            )
        else:
            await pool.execute(
                "INSERT INTO concept_elo (user_id, concept_id, rating) VALUES ($1, $2, $3)",
                current_user.user_id, concept_id, new_elo,
            )

    return {
        "item_id": item_id,
        "new_stability": round(new_stability, 3),
        "new_difficulty": round(new_difficulty, 3),
        "interval": interval,
        "next_review_date": next_date,
        "stage_advanced": stage_advanced,
        "new_stage": new_stage,
        "concept_name_vi": concept_name_vi,
    }


def _mastery_to_stage(score: int) -> int:
    if score <= 0:   return 0
    if score <= 20:  return 1
    if score <= 40:  return 2
    if score <= 60:  return 3
    if score <= 80:  return 4
    return 5


@app.get("/users/me/concept-mastery")
async def get_concept_mastery(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Return all concepts with user's current mastery (0 if not started)."""
    rows = await pool.fetch(
        """SELECT c.id, c.name, c.name_vi, c.grade, c.topic, c.exam_weight,
                  c.prerequisite_ids,
                  COALESCE(cm.mastery_score, 0) AS mastery_score,
                  COALESCE(cm.stage, 0) AS stage,
                  cm.last_practiced, cm.review_count
           FROM concepts c
           LEFT JOIN concept_mastery cm ON cm.concept_id = c.id AND cm.user_id = $1
           ORDER BY c.grade, c.topic, c.id""",
        current_user.user_id,
    )
    import json
    concepts = []
    for r in rows:
        d = dict(r)
        if isinstance(d.get("prerequisite_ids"), str):
            try:
                d["prerequisite_ids"] = json.loads(d["prerequisite_ids"])
            except Exception:
                d["prerequisite_ids"] = []
        concepts.append(d)
    return {"concepts": concepts}


# ── Session / Daily Engine endpoints ─────────────────────────────────────────

@app.get("/users/me/session/today")
async def get_session_today(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Compose today's learning session: SM-2 due count, advance concept, remediation, challenge."""
    from datetime import datetime, timezone
    import json as _json

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    uid = current_user.user_id

    # SM-2 due count
    due_row = await pool.fetchrow(
        "SELECT COUNT(*) AS cnt FROM review_items WHERE user_id=$1 AND next_review_date<=$2",
        uid, today,
    )
    due_count = due_row["cnt"] if due_row else 0

    # Check if session already completed today
    session_row = await pool.fetchrow(
        "SELECT id FROM learning_sessions WHERE user_id=$1 AND session_date=$2",
        uid, today,
    )
    is_complete = session_row is not None

    # Advance concept: highest mastery SOLID (stage 4) concept whose successors are unstarted
    mastery_rows = await pool.fetch(
        """SELECT cm.concept_id, cm.mastery_score, cm.stage, c.prerequisite_ids, c.name_vi, c.exam_weight
           FROM concept_mastery cm JOIN concepts c ON c.id = cm.concept_id
           WHERE cm.user_id=$1 AND cm.stage >= 3
           ORDER BY cm.mastery_score DESC""",
        uid,
    )
    all_concepts = await pool.fetch("SELECT id, prerequisite_ids, name_vi, grade, topic FROM concepts")
    mastered_ids = {r["concept_id"] for r in mastery_rows}

    advance_concept = None
    for concept in all_concepts:
        prereqs = _json.loads(concept["prerequisite_ids"]) if isinstance(concept["prerequisite_ids"], str) else (concept["prerequisite_ids"] or [])
        if concept["id"] in mastered_ids:
            continue
        if prereqs and all(p in mastered_ids for p in prereqs):
            advance_concept = {"id": concept["id"], "name_vi": concept["name_vi"],
                               "grade": concept["grade"], "topic": concept["topic"]}
            break

    # Remediation: prefer concepts with high error counts (>=3) at stage <=3,
    # then fall back to stage-2 concepts with lowest mastery
    remediaton_row = await pool.fetchrow(
        """SELECT cm.concept_id, c.name_vi, cm.mastery_score, cm.stage,
                  COALESCE(ep.total_errors, 0) AS error_count,
                  ep.top_error_type
           FROM concept_mastery cm
           JOIN concepts c ON c.id = cm.concept_id
           LEFT JOIN (
               SELECT concept_id,
                      SUM(count) AS total_errors,
                      error_type AS top_error_type
               FROM error_patterns
               WHERE user_id=$1
               GROUP BY concept_id, error_type
               ORDER BY total_errors DESC
               LIMIT 1
           ) ep ON ep.concept_id = cm.concept_id
           WHERE cm.user_id=$1 AND cm.stage <= 3 AND cm.stage >= 1
           ORDER BY
             CASE WHEN COALESCE(ep.total_errors, 0) >= 3 THEN 0 ELSE 1 END,
             COALESCE(ep.total_errors, 0) DESC,
             cm.mastery_score ASC
           LIMIT 1""",
        uid, uid,
    )
    remediation_concept = dict(remediaton_row) if remediaton_row else None

    # Compute learning streak (consecutive days with sessions)
    streak_rows = await pool.fetch(
        "SELECT session_date FROM learning_sessions WHERE user_id=$1 ORDER BY session_date DESC LIMIT 60",
        uid,
    )
    streak = 0
    from datetime import date, timedelta
    check = date.today()
    session_dates = {r["session_date"] for r in streak_rows}
    while str(check) in session_dates or (streak == 0 and str(check - timedelta(days=1)) in session_dates):
        if str(check) in session_dates:
            streak += 1
        check -= timedelta(days=1)

    # Trajectory: predict exam score from mastery velocity + exam_date
    user_row = await pool.fetchrow(
        "SELECT exam_date, weekly_study_hours FROM users WHERE id=$1", uid
    )
    days_remaining = None
    predicted_score = None
    on_track = None
    if user_row and user_row["exam_date"]:
        try:
            from datetime import date as _date
            exam_dt = _date.fromisoformat(user_row["exam_date"])
            days_remaining = (exam_dt - _date.today()).days
            if days_remaining > 0:
                solid_row = await pool.fetchrow(
                    "SELECT COUNT(*) AS cnt FROM concept_mastery WHERE user_id=$1 AND stage>=4", uid
                )
                total_row = await pool.fetchrow("SELECT COUNT(*) AS cnt FROM concepts")
                solid_count = solid_row["cnt"] if solid_row else 0
                total_concepts = total_row["cnt"] if total_row else 20
                weekly_hours = (user_row["weekly_study_hours"] or 5)
                concepts_per_week = max(0.3, weekly_hours / 3.5)
                weeks_remaining = max(1, days_remaining // 7)
                predicted_solid = min(total_concepts, solid_count + concepts_per_week * weeks_remaining)
                if total_concepts > 0:
                    predicted_score = round(5 + (predicted_solid / total_concepts) * 5, 1)
                    predicted_score = min(10.0, max(5.0, predicted_score))
                on_track = (predicted_score or 0) >= 8.0
        except Exception:
            pass

    return {
        "due_count": due_count,
        "is_complete": is_complete,
        "advance_concept": advance_concept,
        "remediation_concept": remediation_concept,
        "learning_streak": streak,
        "session_date": today,
        "days_remaining": days_remaining,
        "predicted_score": predicted_score,
        "on_track": on_track,
    }


@app.post("/users/me/session/complete", status_code=201)
async def complete_session(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Mark today's learning session as complete (idempotent)."""
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    uid = current_user.user_id

    existing = await pool.fetchrow(
        "SELECT id FROM learning_sessions WHERE user_id=$1 AND session_date=$2",
        uid, today,
    )
    if existing:
        return {"already_complete": True, "session_date": today}

    # Count how many SM-2 items were reviewed today
    reviewed_row = await pool.fetchrow(
        "SELECT COUNT(*) AS cnt FROM review_items WHERE user_id=$1 AND updated_at >= $2",
        uid, today,
    )
    sm2_count = reviewed_row["cnt"] if reviewed_row else 0

    await pool.execute(
        """INSERT INTO learning_sessions (user_id, session_date, sm2_reviewed)
           VALUES ($1, $2, $3)""",
        uid, today, sm2_count,
    )
    return {"already_complete": False, "session_date": today, "sm2_reviewed": sm2_count}


@app.get("/users/me/adaptive-study-plan")
async def get_adaptive_study_plan(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Return a data-driven adaptive study plan computed from the Learning Graph."""
    from datetime import date as _date
    import json as _json

    uid = current_user.user_id

    user_row = await pool.fetchrow(
        "SELECT exam_date, weekly_study_hours FROM users WHERE id=$1", uid
    )
    exam_date_str = user_row["exam_date"] if user_row else None
    weekly_hours = (user_row["weekly_study_hours"] if user_row else None) or 5

    days_remaining = None
    weeks_remaining = 4
    if exam_date_str:
        try:
            exam_dt = _date.fromisoformat(exam_date_str)
            days_remaining = (exam_dt - _date.today()).days
            weeks_remaining = max(1, days_remaining // 7)
        except Exception:
            pass

    mastery_rows = await pool.fetch(
        """SELECT cm.concept_id, cm.mastery_score, cm.stage, cm.review_count,
                  c.name_vi, c.grade, c.topic, c.exam_weight, c.prerequisite_ids
           FROM concept_mastery cm
           JOIN concepts c ON c.id = cm.concept_id
           WHERE cm.user_id=$1""",
        uid,
    )
    all_concept_rows = await pool.fetch(
        "SELECT id, name_vi, grade, topic, exam_weight, prerequisite_ids FROM concepts"
    )
    error_rows = await pool.fetch(
        "SELECT concept_id, error_type, count FROM error_patterns WHERE user_id=$1 ORDER BY count DESC",
        uid,
    )

    error_by_concept: dict[str, list] = {}
    for er in error_rows:
        cid = er["concept_id"]
        if cid not in error_by_concept:
            error_by_concept[cid] = []
        error_by_concept[cid].append({"type": er["error_type"], "count": er["count"]})

    mastery_dict = {r["concept_id"]: dict(r) for r in mastery_rows}
    mastered_ids = {cid for cid, m in mastery_dict.items() if m["stage"] >= 4}
    solid_count = len(mastered_ids)
    total_concepts = len(all_concept_rows)
    in_progress_count = sum(1 for m in mastery_dict.values() if 1 <= m["stage"] <= 3)

    # Trajectory
    concepts_per_week = max(0.3, weekly_hours / 3.5)
    predicted_solid = solid_count
    if days_remaining is not None and days_remaining > 0:
        predicted_solid = min(total_concepts, solid_count + concepts_per_week * weeks_remaining)

    if total_concepts > 0:
        predicted_score = round(5 + (predicted_solid / total_concepts) * 5, 1)
        predicted_score = min(10.0, max(5.0, predicted_score))
    else:
        predicted_score = 5.0
    on_track = predicted_score >= 8.0

    if days_remaining is not None and days_remaining > 0:
        if on_track:
            trajectory_message = (
                f"Với tốc độ hiện tại, bạn dự kiến đạt {predicted_score:.1f} vào kỳ thi. Đang đúng hướng!"
            )
        else:
            needed = max(0, round((8.0 - 5) / 5 * (total_concepts or 1)) - solid_count)
            hours_needed = max(weekly_hours + 2, 7)
            trajectory_message = (
                f"Cần thêm {needed} khái niệm vững để đạt 8.0. "
                f"Hãy tăng thời gian luyện tập lên {hours_needed} giờ/tuần."
            )
    else:
        trajectory_message = "Nhập ngày thi để xem dự đoán điểm số của bạn."

    # Build priority-ranked focus pool
    focus_pool = []
    started_ids = set(mastery_dict.keys())

    for r in mastery_rows:
        m = dict(r)
        if m["stage"] == 0 or m["stage"] >= 5:
            continue
        priority = (100 - m["mastery_score"]) * m["exam_weight"] / max(1, m["stage"])
        focus_pool.append({
            "concept_id": m["concept_id"],
            "name_vi": m["name_vi"],
            "grade": m["grade"],
            "topic": m["topic"],
            "mastery_score": round(m["mastery_score"]),
            "stage": m["stage"],
            "exam_weight": m["exam_weight"],
            "priority": round(priority, 2),
            "error_types": [e["type"] for e in error_by_concept.get(m["concept_id"], [])[:2]],
        })

    # Also include unlocked but unstarted concepts
    for r in all_concept_rows:
        if r["id"] in started_ids:
            continue
        prereqs = _json.loads(r["prerequisite_ids"]) if isinstance(r["prerequisite_ids"], str) else (r["prerequisite_ids"] or [])
        if prereqs and not all(p in mastered_ids for p in prereqs):
            continue
        focus_pool.append({
            "concept_id": r["id"],
            "name_vi": r["name_vi"],
            "grade": r["grade"],
            "topic": r["topic"],
            "mastery_score": 0,
            "stage": 0,
            "exam_weight": r["exam_weight"],
            "priority": 0.5 * r["exam_weight"],
            "error_types": [],
        })

    focus_pool.sort(key=lambda x: -x["priority"])

    # Build interleaved weekly schedule (up to 4 weeks, 3 concepts/week)
    DAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"]
    concepts_per_week_slot = 3
    weekly_schedule = []

    for week_idx in range(min(weeks_remaining, 4)):
        week_concepts = focus_pool[
            week_idx * concepts_per_week_slot: (week_idx + 1) * concepts_per_week_slot
        ]
        if not week_concepts:
            break

        daily_plan = []
        for day_idx, day_name in enumerate(DAYS):
            day_items = []
            if day_idx in (0, 2, 4):  # Mon/Wed/Fri: include SM-2 review
                day_items.append({"type": "sm2", "label": "Ôn lại (FSRS)"})
            concept_today = week_concepts[day_idx % len(week_concepts)]
            day_items.append({
                "type": "concept",
                "concept_id": concept_today["concept_id"],
                "name_vi": concept_today["name_vi"],
            })
            if day_idx == 5:  # Saturday: add challenge
                day_items.append({"type": "challenge", "label": "Bài khó"})
            daily_plan.append({"day": day_name, "items": day_items})

        weekly_schedule.append({
            "week": week_idx + 1,
            "focus_concepts": week_concepts,
            "daily_plan": daily_plan,
        })

    return {
        "solid_count": solid_count,
        "total_concepts": total_concepts,
        "in_progress_count": in_progress_count,
        "days_remaining": days_remaining,
        "weeks_remaining": weeks_remaining if days_remaining else None,
        "predicted_score": predicted_score,
        "on_track": on_track,
        "trajectory_message": trajectory_message,
        "weekly_schedule": weekly_schedule,
        "focus_concepts": focus_pool[:6],
    }


class DiagnosticSeedRequest(BaseModel):
    weights: dict  # {topic: weight} where weight = 1 - accuracy (high = weak)


@app.post("/users/me/diagnostic-seed", status_code=201)
async def diagnostic_seed(
    body: DiagnosticSeedRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Seed the Learning Graph from diagnostic test results.

    For each concept matching a topic, create an initial concept_mastery row
    calibrated from the diagnostic accuracy. Only seeds concepts that haven't
    been started (stage = 0 or no row). Never overwrites existing progress.
    """
    if not body.weights:
        return {"seeded": 0}

    uid = current_user.user_id
    concept_rows = await pool.fetch(
        "SELECT id, topic FROM concepts"
    )

    seeded = 0
    for c in concept_rows:
        topic = c["topic"]
        weight = body.weights.get(topic)
        if weight is None:
            continue
        # weight is (1 - accuracy): 0.1 = perfect, 1.0 = all wrong
        # mastery_score = accuracy * 50 = (1 - weight) * 50, range 5-45
        accuracy = max(0.0, min(1.0, 1.0 - weight))
        mastery_score = round(accuracy * 50)

        existing = await pool.fetchrow(
            "SELECT stage FROM concept_mastery WHERE user_id=$1 AND concept_id=$2",
            uid, c["id"],
        )
        if existing and existing["stage"] > 0:
            continue  # never overwrite real progress

        stage = _mastery_to_stage(mastery_score)
        if existing:
            await pool.execute(
                """UPDATE concept_mastery
                   SET mastery_score=$1, stage=$2, updated_at=NOW()
                   WHERE user_id=$3 AND concept_id=$4""",
                mastery_score, stage, uid, c["id"],
            )
        else:
            await pool.execute(
                """INSERT INTO concept_mastery (user_id, concept_id, mastery_score, stage)
                   VALUES ($1, $2, $3, $4)""",
                uid, c["id"], mastery_score, stage,
            )
        seeded += 1

    return {"seeded": seeded}


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


@app.post("/users/me/history")
async def post_history(
    entries: list[HistoryEntry],
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    if not entries:
        return {"streak_recovered": False}
    for entry in entries:
        if entry.score is not None and not (0 <= entry.score <= 10):
            raise HTTPException(status_code=422, detail=f"score must be between 0 and 10, got {entry.score}")
        if entry.payload:
            acc = entry.payload.get("accuracy")
            if acc is not None and not (0 <= float(acc) <= 1):
                raise HTTPException(status_code=422, detail=f"accuracy must be between 0 and 1, got {acc}")

    # Streak recovery: check BEFORE inserting new results
    user_streak_row = await pool.fetchrow(
        "SELECT streak_freeze_count FROM users WHERE id = $1",
        current_user.user_id,
    )
    # Get the last exam date before the new entries
    last_exam_row = await pool.fetchrow(
        "SELECT created_at FROM exam_results WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        current_user.user_id,
    )
    today_str = datetime.utcnow().strftime("%Y-%m-%d")

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

    # Streak recovery check: missed exactly 1 day + 2+ exams today after insert
    streak_recovered = False
    new_streak = None
    if last_exam_row and last_exam_row["created_at"]:
        last_date_str = str(last_exam_row["created_at"])[:10]
        try:
            last_date = datetime.strptime(last_date_str, "%Y-%m-%d")
            today_date = datetime.strptime(today_str, "%Y-%m-%d")
            gap_days = (today_date - last_date).days
        except (ValueError, TypeError):
            gap_days = 0

        if gap_days == 2:
            # Count today's results after the insert
            today_count_row = await pool.fetchrow(
                """SELECT COUNT(*) AS cnt FROM exam_results
                   WHERE user_id = $1 AND created_at >= $2""",
                current_user.user_id,
                today_str + "T00:00:00",
            )
            today_count = today_count_row["cnt"] if today_count_row else 0
            if today_count >= 2:
                # Fetch current streak from learning_sessions (best proxy)
                # Use exam_results count of consecutive days as an approximation
                streak_count_row = await pool.fetchrow(
                    """SELECT COUNT(DISTINCT substr(created_at, 1, 10)) AS cnt
                       FROM exam_results WHERE user_id = $1
                       AND created_at >= datetime('now', '-30 days')""",
                    current_user.user_id,
                )
                base_streak = streak_count_row["cnt"] if streak_count_row else 0
                # Restore: +1 for missed day +1 for today (both count)
                new_streak = base_streak
                streak_recovered = True

    return {"streak_recovered": streak_recovered, "streak": new_streak}


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


# ── Sprint 19: Teacher class join & rank endpoints ────────────────────────────

class TeacherClassJoinRequest(BaseModel):
    class_code: str = Field(..., min_length=1, max_length=10)


@app.post("/teacher-classes/join")
async def teacher_class_join(
    body: TeacherClassJoinRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Join a teacher class by its 6-char class_code."""
    cls = await pool.fetchrow(
        "SELECT id, teacher_name, subject FROM teacher_classes WHERE class_code = ?",
        body.class_code.upper(),
    )
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    await pool.execute(
        "INSERT OR IGNORE INTO teacher_class_members (class_id, user_id) VALUES (?, ?)",
        cls["id"], current_user.user_id,
    )
    member_count_row = await pool.fetchrow(
        "SELECT COUNT(*) AS cnt FROM teacher_class_members WHERE class_id = ?", cls["id"]
    )
    member_count = member_count_row["cnt"] if member_count_row else 0
    return {
        "class_id": cls["id"],
        "teacher_name": cls["teacher_name"],
        "subject": cls["subject"],
        "member_count": member_count,
    }


@app.get("/teacher-classes/me")
async def teacher_class_me(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Return the class the current user belongs to plus their rank. 200 with class_id=null if not enrolled."""
    membership = await pool.fetchrow(
        """SELECT tc.id, tc.class_code, tc.teacher_name, tc.subject
           FROM teacher_class_members tcm
           JOIN teacher_classes tc ON tc.id = tcm.class_id
           WHERE tcm.user_id = ?""",
        current_user.user_id,
    )
    if not membership:
        return {"class_id": None}

    class_id = membership["id"]

    # All members with their avg score
    members = await pool.fetch(
        """SELECT tcm.user_id,
                  COALESCE(AVG(er.score), 0.0) AS avg_score
           FROM teacher_class_members tcm
           LEFT JOIN exam_results er ON er.user_id = tcm.user_id
           WHERE tcm.class_id = ?
           GROUP BY tcm.user_id
           ORDER BY avg_score DESC""",
        class_id,
    )

    member_count = len(members)
    your_rank = 1
    your_avg = 0.0
    class_total = 0.0

    for i, m in enumerate(members):
        if m["user_id"] == current_user.user_id:
            your_rank = i + 1
            your_avg = m["avg_score"]
        class_total += m["avg_score"]

    class_avg = class_total / member_count if member_count else 0.0

    return {
        "class_id": class_id,
        "class_code": membership["class_code"],
        "teacher_name": membership["teacher_name"],
        "subject": membership["subject"],
        "member_count": member_count,
        "your_rank": your_rank,
        "your_avg_score": round(your_avg, 2),
        "class_avg_score": round(class_avg, 2),
    }


# ── MOAT 5: Study Partner Matching ───────────────────────────────────────────

class ConnectPartnerRequest(BaseModel):
    partner_id: int

class RespondPartnerRequest(BaseModel):
    request_id: int
    action: str  # 'accept' | 'decline'


def _partner_display_name(province: str | None) -> str:
    return f"Học sinh {province}" if province else "Học sinh"


@app.get("/study-partners/candidates")
async def get_partner_candidates(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Find up to 3 study partner candidates. Complete tier only. FREE."""
    user_row = await pool.fetchrow(
        "SELECT grade, province, subscription_tier FROM users WHERE id = ?",
        current_user.user_id,
    )
    if not user_row or user_row["subscription_tier"] != "complete":
        raise HTTPException(status_code=403, detail="complete_tier_required")

    grade = user_row["grade"]
    province = user_row["province"]

    # Compute current user's avg score
    self_avg_row = await pool.fetchrow(
        "SELECT AVG(score) AS avg FROM exam_results WHERE user_id = ? AND score IS NOT NULL",
        current_user.user_id,
    )
    self_avg = self_avg_row["avg"] if self_avg_row and self_avg_row["avg"] is not None else None

    # Build province filter clause
    if province:
        province_clause = "AND u.province = ?"
        province_params = [province]
    else:
        province_clause = ""
        province_params = []

    query = f"""
        SELECT
            u.id AS partner_id,
            u.province,
            u.grade,
            AVG(er.score) AS avg_score,
            COUNT(er.result_id) AS exam_count
        FROM users u
        LEFT JOIN exam_results er ON er.user_id = u.id AND er.score IS NOT NULL
        WHERE u.grade = ?
          {province_clause}
          AND u.subscription_tier IN ('student', 'complete')
          AND u.id != ?
          AND u.id NOT IN (
              SELECT partner_id FROM study_partner_requests
              WHERE requester_id = ? AND status = 'accepted'
              UNION
              SELECT requester_id FROM study_partner_requests
              WHERE partner_id = ? AND status = 'accepted'
          )
        GROUP BY u.id
        LIMIT 20
    """
    params = [grade] + province_params + [current_user.user_id, current_user.user_id, current_user.user_id]
    rows = await pool.fetch(query, *params)

    # Sort by closeness to self_avg; if no score data, keep original order
    def _sort_key(r):
        avg = r["avg_score"]
        if self_avg is not None and avg is not None:
            return abs(avg - self_avg)
        return 0

    sorted_rows = sorted(rows, key=_sort_key)[:3]

    candidates = []
    for r in sorted_rows:
        avg = r["avg_score"]
        score_diff = round(abs(avg - self_avg), 1) if (avg is not None and self_avg is not None) else None
        candidates.append({
            "partner_id": r["partner_id"],
            "display_name": _partner_display_name(r["province"]),
            "grade": r["grade"],
            "province": r["province"],
            "avg_score": round(avg, 1) if avg is not None else None,
            "exam_count": r["exam_count"] or 0,
            "score_diff": score_diff,
        })

    return {"candidates": candidates}


@app.post("/study-partners/connect")
async def connect_partner(
    req: ConnectPartnerRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Send a study partner connection request. Auth required."""
    partner = await pool.fetchrow("SELECT id FROM users WHERE id = ?", req.partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="partner_not_found")

    await pool.execute(
        "INSERT OR IGNORE INTO study_partner_requests (requester_id, partner_id, status) VALUES (?, ?, 'pending')",
        current_user.user_id, req.partner_id,
    )
    return {"status": "pending", "partner_id": req.partner_id}


@app.get("/study-partners/me")
async def get_my_partners(
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Return accepted connections + pending requests for current user."""
    uid = current_user.user_id

    # Accepted: either requester or partner side
    accepted_rows = await pool.fetch(
        """SELECT spr.id AS request_id,
                  CASE WHEN spr.requester_id = ? THEN spr.partner_id ELSE spr.requester_id END AS partner_id,
                  u.grade, u.province,
                  AVG(er.score) AS avg_score
           FROM study_partner_requests spr
           JOIN users u ON u.id = CASE WHEN spr.requester_id = ? THEN spr.partner_id ELSE spr.requester_id END
           LEFT JOIN exam_results er ON er.user_id = u.id AND er.score IS NOT NULL
           WHERE (spr.requester_id = ? OR spr.partner_id = ?) AND spr.status = 'accepted'
           GROUP BY spr.id, partner_id, u.grade, u.province""",
        uid, uid, uid, uid,
    )

    # Pending sent
    pending_sent_rows = await pool.fetch(
        """SELECT spr.partner_id, u.grade, u.province
           FROM study_partner_requests spr
           JOIN users u ON u.id = spr.partner_id
           WHERE spr.requester_id = ? AND spr.status = 'pending'""",
        uid,
    )

    # Pending received
    pending_received_rows = await pool.fetch(
        """SELECT spr.id AS request_id, spr.requester_id AS partner_id, u.grade, u.province
           FROM study_partner_requests spr
           JOIN users u ON u.id = spr.requester_id
           WHERE spr.partner_id = ? AND spr.status = 'pending'""",
        uid,
    )

    def _fmt_accepted(r):
        avg = r["avg_score"]
        return {
            "partner_id": r["partner_id"],
            "display_name": _partner_display_name(r["province"]),
            "grade": r["grade"],
            "province": r["province"],
            "avg_score": round(avg, 1) if avg is not None else None,
        }

    def _fmt_pending(r):
        return {
            "partner_id": r["partner_id"],
            "display_name": _partner_display_name(r["province"]),
        }

    def _fmt_received(r):
        return {
            "partner_id": r["partner_id"],
            "display_name": _partner_display_name(r["province"]),
            "request_id": r["request_id"],
        }

    return {
        "accepted": [_fmt_accepted(r) for r in accepted_rows],
        "pending_sent": [_fmt_pending(r) for r in pending_sent_rows],
        "pending_received": [_fmt_received(r) for r in pending_received_rows],
    }


@app.post("/study-partners/respond")
async def respond_to_partner(
    req: RespondPartnerRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Accept or decline an incoming partner request."""
    if req.action not in ("accept", "decline"):
        raise HTTPException(status_code=422, detail="action must be 'accept' or 'decline'")

    row = await pool.fetchrow(
        "SELECT id FROM study_partner_requests WHERE id = ? AND partner_id = ?",
        req.request_id, current_user.user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="request_not_found")

    new_status = "accepted" if req.action == "accept" else "declined"
    await pool.execute(
        "UPDATE study_partner_requests SET status = ? WHERE id = ?",
        new_status, req.request_id,
    )
    return {"status": new_status, "request_id": req.request_id}


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
    concept_id: str | None = None  # optional; when set, error is persisted to error_patterns


@app.post("/classify-error")
async def classify_error(
    req: ClassifyErrorRequest,
    current_user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Classify the error type for a wrong answer using Haiku; persist to error_patterns."""
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
    except Exception:
        return {"category": None, "confidence": 0.0}

    # Persist to error_patterns (upsert: increment count on conflict)
    try:
        await pool.execute(
            """INSERT INTO error_patterns (user_id, concept_id, error_type, count, last_seen)
               VALUES ($1, $2, $3, 1, datetime('now'))
               ON CONFLICT(user_id, concept_id, error_type)
               DO UPDATE SET count = count + 1, last_seen = datetime('now')""",
            current_user.user_id, req.concept_id, category,
        )
    except Exception:
        pass  # non-fatal — classification still returns

    return {"category": category, "confidence": 0.8}


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


# ── Sprint 20: MOAT 4 — Longitudinal Learner Memory ─────────────────────────

class LearnerMemorySnapshotItem(BaseModel):
    topic_id: str
    mastery_score: float = Field(..., ge=0.0, le=1.0)
    exam_count: int = 0


class LearnerMemorySnapshotRequest(BaseModel):
    snapshots: list[LearnerMemorySnapshotItem]


@app.post("/learner-memory/snapshot")
async def record_learner_memory_snapshot(
    body: LearnerMemorySnapshotRequest,
    user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Record per-topic mastery snapshots for the current user.
    Deduplicates: if a snapshot for user+topic already exists today, UPDATE it.
    """
    today = datetime.utcnow().strftime("%Y-%m-%d")
    recorded = 0
    for item in body.snapshots:
        existing = await pool.fetchrow(
            "SELECT id FROM learner_memory WHERE user_id = ? AND topic_id = ? AND date(snapshot_date) = ?",
            user.id, item.topic_id, today,
        )
        if existing:
            await pool.execute(
                "UPDATE learner_memory SET mastery_score = ?, exam_count_at_snapshot = ?, snapshot_date = datetime('now') WHERE id = ?",
                item.mastery_score, item.exam_count, existing["id"],
            )
        else:
            await pool.execute(
                "INSERT INTO learner_memory (user_id, topic_id, mastery_score, exam_count_at_snapshot) VALUES (?, ?, ?, ?)",
                user.id, item.topic_id, item.mastery_score, item.exam_count,
            )
        recorded += 1
    return {"recorded": recorded}


@app.get("/learner-memory/me")
async def get_learner_memory(
    user: CurrentUser = Depends(get_current_user),
    pool=Depends(get_pool),
):
    """Return all mastery snapshots for the current user, grouped by topic_id."""
    rows = await pool.fetchall(
        """SELECT topic_id, date(snapshot_date) AS snap_date, mastery_score, exam_count_at_snapshot
           FROM learner_memory
           WHERE user_id = ?
           ORDER BY snapshot_date ASC""",
        user.id,
    )
    if not rows:
        return {"topics": {}, "first_snapshot_date": None, "snapshot_count": 0}

    topics: dict[str, list[dict]] = {}
    for row in rows:
        tid = row["topic_id"]
        if tid not in topics:
            topics[tid] = []
        topics[tid].append({
            "date": row["snap_date"],
            "mastery": row["mastery_score"],
            "exam_count": row["exam_count_at_snapshot"],
        })

    first_snapshot_date = rows[0]["snap_date"]
    return {
        "topics": topics,
        "first_snapshot_date": first_snapshot_date,
        "snapshot_count": len(rows),
    }


# ─── Exam-day simulation brief ───────────────────────────────────────────────

# Static prefix-cache-friendly system prompt
_SIMULATION_BRIEF_SYSTEM = (
    "You are a Vietnamese exam coach. The student is preparing for THPT. "
    "Write a 2-sentence motivational briefing in Vietnamese that is specific to their situation. "
    "Be direct and action-oriented. No markdown."
)


class SimulationBriefRequest(BaseModel):
    days_until_exam: int
    projected_score: float | None = None
    target_score: float | None = None
    weak_topics: list[str] = []
    exam_count: int = 0


class SimulationBriefResponse(BaseModel):
    briefing: str


@app.post("/insights/simulation-brief", response_model=SimulationBriefResponse)
async def simulation_brief(
    req: SimulationBriefRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Generate a free Haiku-powered daily simulation briefing in Vietnamese.
    Auth required. No credit deduction — this endpoint is FREE.
    """
    from app.agent.core import call_with_retry

    settings = get_settings()

    weak_topics_str = ", ".join(req.weak_topics[:3]) if req.weak_topics else "chưa xác định"
    score_info = (
        f"projected_score={req.projected_score:.1f}" if req.projected_score is not None else "no_score_data"
    )
    target_info = (
        f"target_score={req.target_score:.1f}" if req.target_score is not None else "no_target"
    )

    user_content = (
        f"days_until_exam={req.days_until_exam}, "
        f"{score_info}, {target_info}, "
        f"weak_topics=[{weak_topics_str}], "
        f"total_exams_completed={req.exam_count}"
    )

    def _fallback() -> SimulationBriefResponse:
        first_topic = req.weak_topics[0] if req.weak_topics else "các chủ đề yếu"
        text = (
            f"Còn {req.days_until_exam} ngày — mỗi buổi thi thử hôm nay đều quan trọng. "
            f"Tập trung vào {first_topic} để tăng điểm nhanh nhất."
        )
        return SimulationBriefResponse(briefing=text)

    try:
        resp = await call_with_retry(
            client,
            model=settings.haiku_model,
            max_tokens=150,
            messages=[
                {"role": "system", "content": _SIMULATION_BRIEF_SYSTEM},
                {"role": "user", "content": user_content},
            ],
        )
        text = (resp.choices[0].message.content or "").strip()
        if not text:
            return _fallback()
        return SimulationBriefResponse(briefing=text)
    except Exception as exc:
        logger.warning("simulation_brief failed: %s", exc)
        return _fallback()

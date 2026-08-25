import json
import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings

logger = logging.getLogger(__name__)

_SCHEMA_DDL = [
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
    # Additive columns for the content pipeline (Ascent Roadmap Phase 1/3) — not CREATE IF
    # NOT EXISTS like the rest of this list, so failures on a re-run are expected and are
    # swallowed by _apply_schema's per-statement try/except below.
    "ALTER TABLE questions ADD COLUMN origin TEXT DEFAULT 'human'",
    "ALTER TABLE questions ADD COLUMN qti_identifier TEXT",
    """CREATE TABLE IF NOT EXISTS content_reports (
        id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL REFERENCES questions(id),
        kind TEXT NOT NULL,
        note TEXT,
        reported_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS pending_questions (
        id TEXT PRIMARY KEY,
        draft_json TEXT NOT NULL,
        status TEXT NOT NULL,
        verification_log TEXT,
        attempt INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS content_ledger (
        content_hash TEXT PRIMARY KEY,
        topic TEXT,
        difficulty TEXT,
        status TEXT NOT NULL,
        verified_at TEXT DEFAULT (datetime('now'))
    )""",
]


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
    data_dir = Path(__file__).parent.parent.parent / "exam-app" / "src" / "data"
    try:
        exams_path = data_dir / "exams.json"
        questions_path = data_dir / "questions.json"
        if not exams_path.exists() or not questions_path.exists():
            logger.warning("_seed_from_json: JSON files not found at %s — skipping seed", data_dir)
            return
        exams = json.loads(exams_path.read_text(encoding="utf-8"))
        questions = json.loads(questions_path.read_text(encoding="utf-8"))
        async with pool.acquire() as conn:
            async with conn.transaction():
                for e in exams:
                    await conn.execute(
                        "INSERT OR IGNORE INTO exams (id, year, title, duration, source, category, mode, total_questions) VALUES (?,?,?,?,?,?,?,?)",
                        e["id"], e.get("year"), e["title"], e.get("duration"), e.get("source"),
                        e["category"], e.get("mode"), e.get("totalQuestions"),
                    )
                for q in questions:
                    await conn.execute(
                        "INSERT OR IGNORE INTO questions (id, source, year, topic, difficulty, question, choices, correct, explanation) VALUES (?,?,?,?,?,?,?,?,?)",
                        q["id"], q.get("source"), q.get("year"), q.get("topic"), q.get("difficulty"),
                        q["question"], json.dumps(q.get("choices", []), ensure_ascii=False),
                        q["correct"], q.get("explanation"),
                    )
                for e in exams:
                    for i, qid in enumerate(e.get("questionIds", [])):
                        await conn.execute(
                            "INSERT OR IGNORE INTO exam_questions (exam_id, question_id, position) VALUES (?,?,?)",
                            e["id"], qid, i,
                        )
        logger.info("_seed_from_json: seeded %d exams, %d questions", len(exams), len(questions))
    except Exception as exc:
        logger.warning("_seed_from_json failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db import AsyncSQLitePool

    settings = get_settings()
    pool = AsyncSQLitePool(settings.sqlite_path)
    await pool.initialize()
    app.state.pool = pool
    await _apply_schema(app.state.pool)
    logger.info("SQLite pool ready at %s", settings.sqlite_path)

    exam_count = await app.state.pool.fetchrow("SELECT COUNT(*) AS cnt FROM exams")
    q_count = await app.state.pool.fetchrow("SELECT COUNT(*) AS cnt FROM questions")
    if (exam_count and exam_count["cnt"] == 0) or (q_count and q_count["cnt"] == 0):
        await _seed_from_json(app.state.pool)

    yield

    if app.state.pool:
        await app.state.pool.close()


def get_pool(request: Request):
    return getattr(request.app.state, "pool", None)


app = FastAPI(title="AI Agent App", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
@app.head("/health")
async def health():
    return {"status": "ok"}


@app.get("/exams")
async def list_exams(mode: str | None = None, pool=Depends(get_pool)):
    if mode:
        rows = await pool.fetch(
            "SELECT id,year,title,duration,source,category,mode,total_questions AS totalQuestions FROM exams WHERE mode=? ORDER BY year DESC",
            mode,
        )
    else:
        rows = await pool.fetch(
            "SELECT id,year,title,duration,source,category,mode,total_questions AS totalQuestions FROM exams WHERE mode!='retired' ORDER BY year DESC"
        )
    return [dict(r) for r in rows]


@app.get("/exams/{exam_id}")
async def get_exam(exam_id: str, pool=Depends(get_pool)):
    exam = await pool.fetchrow(
        "SELECT id,year,title,duration,source,category,mode,total_questions AS totalQuestions FROM exams WHERE id=?",
        exam_id,
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    q_ids = await pool.fetch(
        "SELECT question_id FROM exam_questions WHERE exam_id=? ORDER BY position", exam_id
    )
    return {**dict(exam), "questionIds": [r["question_id"] for r in q_ids]}


@app.post("/questions/batch")
async def batch_questions(body: dict, pool=Depends(get_pool)):
    ids = body.get("ids", [])[:200]
    if not ids:
        return []
    placeholders = ",".join("?" * len(ids))
    rows = await pool.fetch(f"SELECT * FROM questions WHERE id IN ({placeholders})", *ids)
    return [{**dict(r), "choices": json.loads(r["choices"])} for r in rows]


@app.get("/questions")
async def all_questions(topic: str | None = None, pool=Depends(get_pool)):
    if topic:
        rows = await pool.fetch("SELECT * FROM questions WHERE topic=?", topic)
    else:
        rows = await pool.fetch("SELECT * FROM questions")
    return [{**dict(r), "choices": json.loads(r["choices"])} for r in rows]


@app.post("/questions/{question_id}/report")
async def report_question(question_id: str, body: dict, pool=Depends(get_pool)):
    """Content-issue reporting (Phase 2) — a bug report on the content, not a survey.

    kind: one of render | answer_key | ambiguous | other
    """
    exists = await pool.fetchrow("SELECT id FROM questions WHERE id=?", question_id)
    if not exists:
        raise HTTPException(status_code=404, detail="Question not found")
    kind = body.get("kind")
    if kind not in {"render", "answer_key", "ambiguous", "other"}:
        raise HTTPException(status_code=422, detail="kind must be one of render, answer_key, ambiguous, other")
    report_id = f"rpt_{uuid.uuid4().hex[:12]}"
    await pool.execute(
        "INSERT INTO content_reports (id, question_id, kind, note) VALUES (?,?,?,?)",
        report_id, question_id, kind, body.get("note"),
    )
    return {"id": report_id, "questionId": question_id, "kind": kind}


@app.get("/content-reports")
async def list_content_reports(kind: str | None = None, pool=Depends(get_pool)):
    """Review queue for content_reports — student-submitted (ReportIssueButton) and
    AI-audit-filed (note prefixed 'AI audit:') rows live in the same table/kind space.
    """
    query = (
        "SELECT r.id, r.question_id AS questionId, r.kind, r.note, r.reported_at AS reportedAt, "
        "q.question, q.choices, q.correct FROM content_reports r "
        "JOIN questions q ON q.id = r.question_id"
    )
    if kind:
        rows = await pool.fetch(query + " WHERE r.kind=? ORDER BY r.reported_at DESC", kind)
    else:
        rows = await pool.fetch(query + " ORDER BY r.reported_at DESC")
    return [{**dict(r), "choices": json.loads(r["choices"])} for r in rows]


def _get_router_client():
    from app.agent.router_client import AiRouterClient, RouterNotConfiguredError

    try:
        return AiRouterClient(get_settings())
    except RouterNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/agent/generate")
async def agent_generate(body: dict, pool=Depends(get_pool)):
    """Phase 3 — draft, independently verify, and auto-promote math questions.

    Body: {topic, difficulty, count} — count is capped at 10 per call to keep a single
    request bounded; batching a larger run is the caller's job, not this endpoint's.
    """
    from app.agent.orchestrator import generate_batch

    topic = body.get("topic")
    difficulty = body.get("difficulty")
    count = min(int(body.get("count", 1)), 10)
    if not topic or not difficulty:
        raise HTTPException(status_code=422, detail="topic and difficulty are required")

    client = _get_router_client()
    results = await generate_batch(pool, client, topic, difficulty, count)
    return {"results": results}


@app.post("/agent/audit")
async def agent_audit(body: dict, pool=Depends(get_pool)):
    """Audits existing questions already in the bank (static or agent-origin) — independent
    of /agent/generate's write-path gate. A mismatch auto-files a content_reports row
    (kind='answer_key') for human review; it never rewrites the stored answer itself.

    Body: {question_ids: [...]} — capped at 20 per call, same bounded-request rule as
    /agent/generate.
    """
    from app.agent.auditor import audit_question

    question_ids = body.get("question_ids", [])[:20]
    if not question_ids:
        raise HTTPException(status_code=422, detail="question_ids is required")

    client = _get_router_client()
    results = []
    for qid in question_ids:
        row = await pool.fetchrow("SELECT id, question, choices, correct FROM questions WHERE id=?", qid)
        if not row:
            results.append({"questionId": qid, "status": "not_found"})
            continue

        question_row = {**dict(row), "choices": json.loads(row["choices"])}
        result = await audit_question(client, question_row)

        if result.status == "mismatch":
            report_id = f"rpt_{uuid.uuid4().hex[:12]}"
            await pool.execute(
                "INSERT INTO content_reports (id, question_id, kind, note) VALUES (?,?,?,?)",
                report_id, qid, "answer_key", f"AI audit: {result.reason}",
            )

        results.append({
            "questionId": qid,
            "status": result.status,
            "storedIndex": result.stored_index,
            "verifiedIndex": result.verified_index,
            "reason": result.reason,
        })
    return {"results": results}


@app.get("/agent/pending")
async def agent_pending(status: str | None = None, pool=Depends(get_pool)):
    if status:
        rows = await pool.fetch("SELECT * FROM pending_questions WHERE status=? ORDER BY created_at DESC", status)
    else:
        rows = await pool.fetch("SELECT * FROM pending_questions ORDER BY created_at DESC")
    return [dict(r) for r in rows]


@app.post("/agent/pending/{pending_id}/reject")
async def agent_reject_pending(pending_id: str, pool=Depends(get_pool)):
    """Manual override for a verified-but-suspect item — the safety valve, not the default path."""
    row = await pool.fetchrow("SELECT * FROM pending_questions WHERE id=?", pending_id)
    if not row:
        raise HTTPException(status_code=404, detail="Pending item not found")
    await pool.execute("UPDATE pending_questions SET status='rejected' WHERE id=?", pending_id)
    return {"id": pending_id, "status": "rejected"}

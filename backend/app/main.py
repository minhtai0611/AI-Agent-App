import json
import logging
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

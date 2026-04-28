import sqlite3
import json
from app.config import get_settings
from app.math_wiki.schemas import WikiUnit, Problem


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(get_settings().math_wiki_db_path, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.row_factory = sqlite3.Row
    return conn


def _init_db(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS wiki_units (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            topic TEXT NOT NULL,
            subtopic TEXT NOT NULL,
            content TEXT NOT NULL,
            problem_ids TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS problems (
            problem_id TEXT PRIMARY KEY,
            problem_text TEXT NOT NULL,
            choices TEXT,
            correct_answer TEXT,
            topic TEXT NOT NULL,
            subtopic TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            problem_type TEXT NOT NULL
        );
    """)
    conn.commit()
    # Migrate: add source column if absent (SQLite doesn't support IF NOT EXISTS on ADD COLUMN)
    existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(wiki_units)").fetchall()}
    if "source" not in existing_cols:
        conn.execute("ALTER TABLE wiki_units ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'")
        conn.commit()


def _ensure_tables(conn: sqlite3.Connection) -> None:
    _init_db(conn)


def upsert_wiki_unit(unit: WikiUnit, source: str = "manual") -> None:
    with _get_conn() as conn:
        _ensure_tables(conn)
        conn.execute(
            """INSERT OR REPLACE INTO wiki_units
               (id, type, topic, subtopic, content, problem_ids, source)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (unit.id, unit.type, unit.topic, unit.subtopic,
             unit.content, json.dumps(unit.problem_ids), source),
        )
        conn.commit()


def upsert_problem(problem: Problem) -> None:
    with _get_conn() as conn:
        _ensure_tables(conn)
        conn.execute(
            """INSERT OR REPLACE INTO problems
               (problem_id, problem_text, choices, correct_answer, topic, subtopic, difficulty, problem_type)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                problem.problem_id,
                problem.problem_text,
                json.dumps(problem.choices) if problem.choices is not None else None,
                problem.correct_answer,
                problem.topic,
                problem.subtopic,
                problem.difficulty,
                problem.problem_type,
            ),
        )
        conn.commit()


def get_all_wiki_units() -> list[WikiUnit]:
    with _get_conn() as conn:
        _ensure_tables(conn)
        rows = conn.execute("SELECT * FROM wiki_units").fetchall()
    return [_row_to_wiki_unit(r) for r in rows]


def count_problems() -> int:
    with _get_conn() as conn:
        _ensure_tables(conn)
        return conn.execute("SELECT COUNT(*) FROM problems").fetchone()[0]


def count_wiki_units() -> int:
    with _get_conn() as conn:
        _ensure_tables(conn)
        return conn.execute("SELECT COUNT(*) FROM wiki_units").fetchone()[0]


def count_wiki_units_by_topic() -> dict[str, int]:
    with _get_conn() as conn:
        _ensure_tables(conn)
        rows = conn.execute(
            "SELECT topic, COUNT(*) as cnt FROM wiki_units GROUP BY topic"
        ).fetchall()
    return {row["topic"]: row["cnt"] for row in rows}


def get_wiki_units_by_ids(ids: list[str]) -> list[WikiUnit]:
    if not ids:
        return []
    with _get_conn() as conn:
        _ensure_tables(conn)
        placeholders = ",".join("?" * len(ids))
        rows = conn.execute(
            f"SELECT * FROM wiki_units WHERE id IN ({placeholders})", ids
        ).fetchall()
    by_id = {r["id"]: _row_to_wiki_unit(r) for r in rows}
    return [by_id[i] for i in ids if i in by_id]


def _row_to_wiki_unit(row: sqlite3.Row) -> WikiUnit:
    return WikiUnit(
        id=row["id"],
        type=row["type"],
        topic=row["topic"],
        subtopic=row["subtopic"],
        content=row["content"],
        problem_ids=json.loads(row["problem_ids"]),
    )

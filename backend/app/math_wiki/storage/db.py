import sqlite3
import json
import threading
from datetime import datetime
from app.config import get_settings
from app.math_wiki.schemas import WikiUnit, Problem

_thread_local = threading.local()


def _get_conn() -> sqlite3.Connection:
    """Return a per-thread cached SQLite connection, creating it on first use."""
    conn = getattr(_thread_local, "conn", None)
    db_path = get_settings().math_wiki_db_path
    if conn is None or getattr(_thread_local, "db_path", None) != db_path:
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.row_factory = sqlite3.Row
        _thread_local.conn = conn
        _thread_local.db_path = db_path
    return conn


def _init_db(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS wiki_units (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            topic TEXT NOT NULL,
            subtopic TEXT NOT NULL,
            content TEXT NOT NULL,
            problem_ids TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'manual',
            source_url TEXT,
            deleted INTEGER NOT NULL DEFAULT 0,
            version INTEGER NOT NULL DEFAULT 1,
            last_edited_by TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
        CREATE TABLE IF NOT EXISTS wiki_unit_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unit_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            content TEXT NOT NULL,
            edited_by TEXT,
            reason TEXT,
            edited_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS unit_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unit_id TEXT NOT NULL,
            problem_text TEXT,
            feedback_type TEXT NOT NULL DEFAULT 'general',
            comment TEXT,
            resolved INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS flagged_solutions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            problem_text TEXT NOT NULL,
            problem_hash TEXT NOT NULL,
            solver_output TEXT NOT NULL,
            flag_reason TEXT,
            reviewed INTEGER NOT NULL DEFAULT 0,
            flagged_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS wiki_drafts (
            draft_id TEXT PRIMARY KEY,
            source_url TEXT,
            source_text TEXT NOT NULL,
            proposed_units_json TEXT NOT NULL DEFAULT '[]',
            final_units_json TEXT,
            topic_hint TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            reviewed_by TEXT,
            reviewed_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS solution_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            problem_text TEXT NOT NULL,
            problem_hash TEXT NOT NULL,
            classified_topic TEXT NOT NULL,
            retrieved_ids TEXT NOT NULL DEFAULT '[]',
            used_knowledge_ids TEXT NOT NULL DEFAULT '[]',
            solver_confidence TEXT NOT NULL DEFAULT 'medium',
            validation_valid INTEGER NOT NULL DEFAULT 0,
            validation_issues TEXT NOT NULL DEFAULT '[]',
            wiki_assisted INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS staged_wiki_units (
            staged_id TEXT PRIMARY KEY,
            unit_data TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'manual',
            source_url TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            proposed_by TEXT NOT NULL DEFAULT 'system',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    _migrate_wiki_units(conn)
    _migrate_problems(conn)


def _migrate_problems(conn: sqlite3.Connection) -> None:
    existing = {row[1] for row in conn.execute("PRAGMA table_info(problems)").fetchall()}
    migrations = [
        ("figure_svg", "ALTER TABLE problems ADD COLUMN figure_svg TEXT"),
        ("problem_hash", "ALTER TABLE problems ADD COLUMN problem_hash TEXT"),
        ("figure_type", "ALTER TABLE problems ADD COLUMN figure_type TEXT NOT NULL DEFAULT 'svg'"),
    ]
    for col, stmt in migrations:
        if col not in existing:
            conn.execute(stmt)
    conn.commit()


def _migrate_wiki_units(conn: sqlite3.Connection) -> None:
    existing = {row[1] for row in conn.execute("PRAGMA table_info(wiki_units)").fetchall()}
    migrations = [
        ("source", "ALTER TABLE wiki_units ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'"),
        ("source_url", "ALTER TABLE wiki_units ADD COLUMN source_url TEXT"),
        ("deleted", "ALTER TABLE wiki_units ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0"),
        ("version", "ALTER TABLE wiki_units ADD COLUMN version INTEGER NOT NULL DEFAULT 1"),
        ("last_edited_by", "ALTER TABLE wiki_units ADD COLUMN last_edited_by TEXT"),
        ("created_at", "ALTER TABLE wiki_units ADD COLUMN created_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00'"),
        ("updated_at", "ALTER TABLE wiki_units ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00'"),
    ]
    for col, stmt in migrations:
        if col not in existing:
            conn.execute(stmt)
    conn.commit()


def _ensure_tables(conn: sqlite3.Connection) -> None:
    _init_db(conn)


# ── Core CRUD ─────────────────────────────────────────────────────────────────

def upsert_wiki_unit(
    unit: WikiUnit,
    source: str = "manual",
    source_url: str | None = None,
    editor: str | None = None,
    reason: str | None = None,
) -> None:
    now = datetime.now().isoformat()
    with _get_conn() as conn:
        _ensure_tables(conn)
        row = conn.execute(
            "SELECT version, content, created_at FROM wiki_units WHERE id = ?", (unit.id,)
        ).fetchone()
        if row:
            conn.execute(
                """INSERT INTO wiki_unit_history (unit_id, version, content, edited_by, reason)
                   VALUES (?, ?, ?, ?, ?)""",
                (unit.id, row["version"], row["content"], editor, reason),
            )
            conn.execute(
                """UPDATE wiki_units
                   SET type=?, topic=?, subtopic=?, content=?, problem_ids=?,
                       source=?, source_url=?, version=?, last_edited_by=?, updated_at=?
                   WHERE id=?""",
                (unit.type, unit.topic, unit.subtopic, unit.content,
                 json.dumps(unit.problem_ids), source, source_url,
                 row["version"] + 1, editor, now, unit.id),
            )
        else:
            conn.execute(
                """INSERT INTO wiki_units
                   (id, type, topic, subtopic, content, problem_ids, source, source_url,
                    deleted, version, last_edited_by, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?)""",
                (unit.id, unit.type, unit.topic, unit.subtopic,
                 unit.content, json.dumps(unit.problem_ids), source, source_url,
                 editor, now, now),
            )
        conn.commit()


def upsert_problem(
    problem: Problem,
    figure_svg: str | None = None,
    problem_hash: str | None = None,
    figure_type: str = "svg",
) -> None:
    with _get_conn() as conn:
        _ensure_tables(conn)
        conn.execute(
            """INSERT OR REPLACE INTO problems
               (problem_id, problem_text, choices, correct_answer, topic, subtopic, difficulty,
                problem_type, figure_svg, problem_hash, figure_type)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                problem.problem_id,
                problem.problem_text,
                json.dumps(problem.choices) if problem.choices is not None else None,
                problem.correct_answer,
                problem.topic,
                problem.subtopic,
                problem.difficulty,
                problem.problem_type,
                figure_svg,
                problem_hash,
                figure_type,
            ),
        )
        conn.commit()


def get_cached_figure(problem_hash: str) -> tuple[str, str] | None:
    """Returns (figure_data, figure_type) or None."""
    with _get_conn() as conn:
        _ensure_tables(conn)
        row = conn.execute(
            "SELECT figure_svg, figure_type FROM problems WHERE problem_hash = ? AND figure_svg IS NOT NULL LIMIT 1",
            (problem_hash,),
        ).fetchone()
    if row is None:
        return None
    return row["figure_svg"], row["figure_type"] or "svg"


def get_all_content_hashes() -> set[str]:
    """Return MD5 hashes of all non-deleted unit content. Cheaper than get_all_wiki_units for dedup."""
    import hashlib
    with _get_conn() as conn:
        _ensure_tables(conn)
        rows = conn.execute("SELECT content FROM wiki_units WHERE deleted = 0").fetchall()
    return {hashlib.md5(r["content"].encode()).hexdigest() for r in rows}


def get_all_wiki_units() -> list[WikiUnit]:
    with _get_conn() as conn:
        _ensure_tables(conn)
        rows = conn.execute("SELECT * FROM wiki_units WHERE deleted = 0").fetchall()
    return [_row_to_wiki_unit(r) for r in rows]


def count_problems() -> int:
    with _get_conn() as conn:
        _ensure_tables(conn)
        return conn.execute("SELECT COUNT(*) FROM problems").fetchone()[0]


def count_wiki_units() -> int:
    with _get_conn() as conn:
        _ensure_tables(conn)
        return conn.execute("SELECT COUNT(*) FROM wiki_units WHERE deleted = 0").fetchone()[0]


def count_wiki_units_by_topic() -> dict[str, int]:
    with _get_conn() as conn:
        _ensure_tables(conn)
        rows = conn.execute(
            "SELECT topic, COUNT(*) as cnt FROM wiki_units WHERE deleted = 0 GROUP BY topic"
        ).fetchall()
    return {row["topic"]: row["cnt"] for row in rows}


def get_wiki_units_by_ids(ids: list[str]) -> list[WikiUnit]:
    if not ids:
        return []
    with _get_conn() as conn:
        _ensure_tables(conn)
        placeholders = ",".join("?" * len(ids))
        rows = conn.execute(
            f"SELECT * FROM wiki_units WHERE id IN ({placeholders}) AND deleted = 0", ids
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


# ── Admin read/write ──────────────────────────────────────────────────────────

def list_wiki_units_admin(
    topic: str | None = None,
    source: str | None = None,
    include_deleted: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    conditions: list[str] = []
    params: list = []
    if not include_deleted:
        conditions.append("deleted = 0")
    if topic:
        conditions.append("topic = ?")
        params.append(topic)
    if source:
        conditions.append("source = ?")
        params.append(source)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    params += [limit, offset]
    with _get_conn() as conn:
        _ensure_tables(conn)
        rows = conn.execute(
            f"SELECT * FROM wiki_units {where} ORDER BY updated_at DESC LIMIT ? OFFSET ?",
            params,
        ).fetchall()
    return [dict(r) for r in rows]


def get_wiki_unit_with_history(unit_id: str) -> dict | None:
    with _get_conn() as conn:
        _ensure_tables(conn)
        row = conn.execute("SELECT * FROM wiki_units WHERE id = ?", (unit_id,)).fetchone()
        if not row:
            return None
        history = conn.execute(
            "SELECT * FROM wiki_unit_history WHERE unit_id = ? ORDER BY version DESC",
            (unit_id,),
        ).fetchall()
    return {"unit": dict(row), "history": [dict(h) for h in history]}


def soft_delete_wiki_unit(unit_id: str, editor: str = "admin") -> bool:
    now = datetime.now().isoformat()
    with _get_conn() as conn:
        _ensure_tables(conn)
        row = conn.execute(
            "SELECT version, content FROM wiki_units WHERE id = ? AND deleted = 0", (unit_id,)
        ).fetchone()
        if not row:
            return False
        conn.execute(
            """INSERT INTO wiki_unit_history (unit_id, version, content, edited_by, reason)
               VALUES (?, ?, ?, ?, ?)""",
            (unit_id, row["version"], row["content"], editor, "soft_delete"),
        )
        conn.execute(
            "UPDATE wiki_units SET deleted = 1, last_edited_by = ?, updated_at = ? WHERE id = ?",
            (editor, now, unit_id),
        )
        conn.commit()
    return True


def restore_wiki_unit(
    unit_id: str, version: int | None = None, editor: str = "admin"
) -> bool:
    now = datetime.now().isoformat()
    with _get_conn() as conn:
        _ensure_tables(conn)
        row = conn.execute("SELECT id FROM wiki_units WHERE id = ?", (unit_id,)).fetchone()
        if not row:
            return False
        if version is not None:
            hist = conn.execute(
                "SELECT content FROM wiki_unit_history WHERE unit_id = ? AND version = ?",
                (unit_id, version),
            ).fetchone()
            if not hist:
                return False
            conn.execute(
                "UPDATE wiki_units SET content = ?, deleted = 0, last_edited_by = ?, updated_at = ? WHERE id = ?",
                (hist["content"], editor, now, unit_id),
            )
        else:
            conn.execute(
                "UPDATE wiki_units SET deleted = 0, last_edited_by = ?, updated_at = ? WHERE id = ?",
                (editor, now, unit_id),
            )
        conn.commit()
    return True


def list_feedback(unresolved_only: bool = True) -> list[dict]:
    with _get_conn() as conn:
        _ensure_tables(conn)
        if unresolved_only:
            rows = conn.execute(
                "SELECT * FROM unit_feedback WHERE resolved = 0 ORDER BY created_at DESC"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM unit_feedback ORDER BY created_at DESC"
            ).fetchall()
    return [dict(r) for r in rows]


def resolve_feedback(feedback_id: int) -> bool:
    with _get_conn() as conn:
        _ensure_tables(conn)
        cur = conn.execute("UPDATE unit_feedback SET resolved = 1 WHERE id = ?", (feedback_id,))
        conn.commit()
    return cur.rowcount > 0


def get_flagged_solutions(unreviewed_only: bool = True) -> list[dict]:
    with _get_conn() as conn:
        _ensure_tables(conn)
        if unreviewed_only:
            rows = conn.execute(
                "SELECT * FROM flagged_solutions WHERE reviewed = 0 ORDER BY flagged_at DESC"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM flagged_solutions ORDER BY flagged_at DESC"
            ).fetchall()
    return [dict(r) for r in rows]


# ── Staged units ──────────────────────────────────────────────────────────────

def get_staged_wiki_units(status: str = "pending") -> list[dict]:
    with _get_conn() as conn:
        _ensure_tables(conn)
        rows = conn.execute(
            "SELECT * FROM staged_wiki_units WHERE status = ? ORDER BY created_at DESC",
            (status,),
        ).fetchall()
    result = []
    for row in rows:
        d = dict(row)
        unit_data = json.loads(d.pop("unit_data"))
        result.append({**d, **unit_data})
    return result


def approve_staged_wiki_unit(staged_id: str) -> WikiUnit | None:
    now = datetime.now().isoformat()
    with _get_conn() as conn:
        _ensure_tables(conn)
        row = conn.execute(
            "SELECT * FROM staged_wiki_units WHERE staged_id = ? AND status = 'pending'",
            (staged_id,),
        ).fetchone()
        if not row:
            return None
        unit_data = json.loads(row["unit_data"])
        unit = WikiUnit(**unit_data)
        upsert_wiki_unit(unit, source=row["source"], source_url=row["source_url"])
        conn.execute(
            "UPDATE staged_wiki_units SET status = 'approved', updated_at = ? WHERE staged_id = ?",
            (now, staged_id),
        )
        conn.commit()
    return unit


def delete_staged_wiki_unit(staged_id: str) -> None:
    with _get_conn() as conn:
        _ensure_tables(conn)
        conn.execute("DELETE FROM staged_wiki_units WHERE staged_id = ?", (staged_id,))
        conn.commit()

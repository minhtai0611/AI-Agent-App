import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Optional
from app.math_wiki.storage.db import _get_conn, _ensure_tables

logger = logging.getLogger(__name__)


def log_solution(
    problem_text: str,
    classified_topic: str,
    retrieved_ids: list[str],
    used_ids: list[str],
    confidence: str,
    valid: bool,
    issues: Optional[list[str]],
    wiki_assisted: bool,
) -> int:
    """Log a solved problem for analytics. Returns the log ID."""
    problem_hash = hashlib.md5(problem_text.encode()).hexdigest()
    with _get_conn() as conn:
        _ensure_tables(conn)
        cursor = conn.execute(
            """
            INSERT INTO solution_logs
                (problem_text, problem_hash, classified_topic, retrieved_ids,
                 used_knowledge_ids, solver_confidence, validation_valid,
                 validation_issues, wiki_assisted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                problem_text,
                problem_hash,
                classified_topic,
                json.dumps(retrieved_ids),
                json.dumps(used_ids),
                confidence,
                valid,
                json.dumps(issues or []),
                wiki_assisted,
            ),
        )
        conn.commit()
        return cursor.lastrowid


def get_unit_usage_stats(days: int = 30) -> list[dict]:
    """Return usage stats for each wiki unit over the last N days."""
    cutoff = datetime.now() - timedelta(days=days)
    with _get_conn() as conn:
        _ensure_tables(conn)
        rows = conn.execute(
            """
            SELECT
                used_knowledge_ids,
                solver_confidence,
                validation_valid,
                created_at
            FROM solution_logs
            WHERE created_at >= ?
            """,
            (cutoff.isoformat(),),
        ).fetchall()

    # Aggregate by unit ID
    stats: dict[str, dict] = {}
    for row in rows:
        used_ids = json.loads(row["used_knowledge_ids"])
        for uid in used_ids:
            if uid not in stats:
                stats[uid] = {"times_used": 0, "high_conf": 0, "valid_count": 0}
            stats[uid]["times_used"] += 1
            if row["solver_confidence"] == "high":
                stats[uid]["high_conf"] += 1
            if row["validation_valid"]:
                stats[uid]["valid_count"] += 1

    result = []
    for uid, s in stats.items():
        total = s["times_used"]
        result.append({
            "unit_id": uid,
            "times_used": total,
            "avg_confidence": "high" if s["high_conf"] / total > 0.5 else "medium",
            "validation_rate": round(s["valid_count"] / total, 4) if total else 0.0,
        })
    return sorted(result, key=lambda x: x["times_used"], reverse=True)


def get_retrieval_effectiveness(days: int = 30) -> dict:
    """System-wide effectiveness metrics."""
    cutoff = datetime.now() - timedelta(days=days)
    with _get_conn() as conn:
        _ensure_tables(conn)
        row = conn.execute(
            """
            SELECT
                COUNT(*) as total_solutions,
                AVG(CASE WHEN wiki_assisted THEN 1 ELSE 0 END) as wiki_assisted_rate,
                AVG(CASE WHEN validation_valid THEN 1 ELSE 0 END) as validation_rate,
                COUNT(DISTINCT used_knowledge_ids) as unique_units_used
            FROM solution_logs
            WHERE created_at >= ?
            """,
            (cutoff.isoformat(),),
        ).fetchone()

    if row["total_solutions"] == 0:
        return {"error": "no data"}

    return {
        "total_solutions": row["total_solutions"],
        "wiki_assisted_rate": round(float(row["wiki_assisted_rate"] or 0), 4),
        "validation_rate": round(float(row["validation_rate"] or 0), 4),
        "unique_units_used": row["unique_units_used"],
    }


def get_top_units_by_usage(limit: int = 10, days: int = 30) -> list[dict]:
    stats = get_unit_usage_stats(days)
    return stats[:limit]


def get_flagged_count(days: int = 7) -> int:
    cutoff = datetime.now() - timedelta(days=days)
    with _get_conn() as conn:
        _ensure_tables(conn)
        row = conn.execute(
            "SELECT COUNT(*) FROM flagged_solutions WHERE reviewed = 0 AND flagged_at >= ?",
            (cutoff.isoformat(),),
        ).fetchone()
    return row[0]

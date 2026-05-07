import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


async def log_solution(
    pool,
    problem_text: str,
    classified_topic: str,
    retrieved_ids: list[str],
    used_ids: list[str],
    confidence: str,
    valid: bool,
    issues: Optional[list[str]],
    wiki_assisted: bool,
) -> int:
    """Log a solved problem for analytics. Returns the log ID. Non-fatal: all exceptions are caught."""
    problem_hash = hashlib.md5(problem_text.encode()).hexdigest()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO solution_logs
                    (problem_text, problem_hash, classified_topic, retrieved_ids,
                     used_knowledge_ids, solver_confidence, validation_valid,
                     validation_issues, wiki_assisted)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                RETURNING id
                """,
                problem_text,
                problem_hash,
                classified_topic,
                json.dumps(retrieved_ids),
                json.dumps(used_ids),
                confidence,
                valid,
                json.dumps(issues or []),
                wiki_assisted,
            )
            return row["id"]
    except Exception as exc:
        logger.warning("log_solution failed (non-fatal): %s", exc)
        return -1


async def get_unit_usage_stats(pool, days: int = 30) -> list[dict]:
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT used_knowledge_ids, solver_confidence, validation_valid
                FROM solution_logs
                WHERE created_at >= $1
                """,
                cutoff,
            )
    except Exception as exc:
        logger.warning("get_unit_usage_stats failed: %s", exc)
        return []

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


async def get_retrieval_effectiveness(pool, days: int = 30) -> dict:
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT
                    COUNT(*) AS total_solutions,
                    AVG(CASE WHEN wiki_assisted THEN 1.0 ELSE 0.0 END) AS wiki_assisted_rate,
                    AVG(CASE WHEN validation_valid THEN 1.0 ELSE 0.0 END) AS validation_rate,
                    COUNT(DISTINCT used_knowledge_ids) AS unique_units_used
                FROM solution_logs
                WHERE created_at >= $1
                """,
                cutoff,
            )
    except Exception as exc:
        logger.warning("get_retrieval_effectiveness failed: %s", exc)
        return {"error": str(exc)}

    if not row or row["total_solutions"] == 0:
        return {"error": "no data"}

    return {
        "total_solutions": row["total_solutions"],
        "wiki_assisted_rate": round(float(row["wiki_assisted_rate"] or 0), 4),
        "validation_rate": round(float(row["validation_rate"] or 0), 4),
        "unique_units_used": row["unique_units_used"],
    }


async def get_flagged_count(pool, days: int = 7) -> int:
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()
    try:
        async with pool.acquire() as conn:
            return await conn.fetchval(
                "SELECT COUNT(*) FROM flagged_solutions WHERE reviewed = false AND flagged_at >= $1",
                cutoff,
            )
    except Exception as exc:
        logger.warning("get_flagged_count failed: %s", exc)
        return 0

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


async def log_solution_feedback(pool, log_id: int, actual_correct: bool) -> None:
    """Record whether a solution was actually correct (user-confirmed or test-verified)."""
    if log_id < 0 or pool is None:
        return
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE solution_logs SET actual_correct = $1 WHERE id = $2",
                int(actual_correct), log_id,
            )
    except Exception as exc:
        logger.warning("log_solution_feedback failed (non-fatal): %s", exc)


async def get_calibration_report(pool, days: int = 30) -> dict:
    """Return confidence calibration cross-tab for the last N days.

    Reports:
      - Overall pass rate (validation_valid)
      - For each confidence level: total, correct (actual_correct=1), rate
      - High-confidence wrong count (critical failures)
    """
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT solver_confidence, validation_valid, actual_correct
                FROM solution_logs
                WHERE created_at >= $1
                """,
                cutoff,
            )
    except Exception as exc:
        logger.warning("get_calibration_report failed: %s", exc)
        return {"error": str(exc)}

    if not rows:
        return {"error": "no data", "days": days}

    by_conf: dict[str, dict] = {
        "high":   {"total": 0, "validated": 0, "confirmed_correct": 0, "confirmed_wrong": 0},
        "medium": {"total": 0, "validated": 0, "confirmed_correct": 0, "confirmed_wrong": 0},
        "low":    {"total": 0, "validated": 0, "confirmed_correct": 0, "confirmed_wrong": 0},
    }
    for row in rows:
        conf = row["solver_confidence"] or "medium"
        if conf not in by_conf:
            conf = "medium"
        by_conf[conf]["total"] += 1
        if row["validation_valid"]:
            by_conf[conf]["validated"] += 1
        if row["actual_correct"] is not None:
            if row["actual_correct"]:
                by_conf[conf]["confirmed_correct"] += 1
            else:
                by_conf[conf]["confirmed_wrong"] += 1

    total = len(rows)
    validated = sum(r["validation_valid"] for r in rows)
    high_conf_wrong = by_conf["high"]["confirmed_wrong"]

    high_total = by_conf["high"]["total"]
    high_confirmed = by_conf["high"]["confirmed_correct"] + by_conf["high"]["confirmed_wrong"]
    high_correct_rate = (
        round(by_conf["high"]["confirmed_correct"] / high_confirmed, 3) if high_confirmed else None
    )

    return {
        "days": days,
        "total_solutions": total,
        "validation_rate": round(validated / total, 3) if total else 0,
        "high_confidence_wrong": high_conf_wrong,
        "high_confidence_correct_rate": high_correct_rate,
        "calibration_target": 0.85,
        "calibration_ok": (high_correct_rate or 0) >= 0.85 if high_correct_rate is not None else None,
        "by_confidence": {
            conf: {
                "total": s["total"],
                "validation_rate": round(s["validated"] / s["total"], 3) if s["total"] else 0,
                "confirmed_correct": s["confirmed_correct"],
                "confirmed_wrong": s["confirmed_wrong"],
            }
            for conf, s in by_conf.items()
        },
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

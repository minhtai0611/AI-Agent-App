"""
Background abuse detection loop — runs every 5 minutes, no external infrastructure needed.
Launched in lifespan() via asyncio.ensure_future().
"""
import asyncio
import json
import logging

logger = logging.getLogger(__name__)

_INTERVAL = 300  # 5 minutes


async def _log_event(pool, user_id, ip, event_type, confidence, detail):
    try:
        await pool.execute(
            "INSERT INTO security_events (user_id, ip, event_type, confidence, detail) VALUES (?, ?, ?, ?, ?)",
            user_id, ip, event_type, confidence, json.dumps(detail) if isinstance(detail, dict) else detail,
        )
    except Exception as exc:
        logger.warning("abuse_detector: could not log event: %s", exc)


async def _auto_suspend(pool, user_id, reason):
    try:
        await pool.execute(
            "UPDATE users SET is_suspended = 1, suspension_reason = ? WHERE id = ?",
            reason, user_id,
        )
        await _log_event(pool, user_id, None, "auto_suspend", "high", reason)
        logger.warning("abuse_detector: AUTO-SUSPENDED user %s — %s", user_id, reason)
    except Exception as exc:
        logger.error("abuse_detector: failed to suspend user %s: %s", user_id, exc)


async def _flag_for_review(pool, user_id, detail):
    try:
        await _log_event(pool, user_id, None, "flagged_for_review", "medium", detail)
        logger.info("abuse_detector: flagged user %s for review — %s", user_id, detail)
    except Exception as exc:
        logger.error("abuse_detector: failed to flag user %s: %s", user_id, exc)


async def _check_credit_velocity(pool):
    """Credits 0→50+ in <1h after reset → HIGH confidence abuse."""
    try:
        rows = await pool.fetch(
            """SELECT user_id, COUNT(*) as gains
               FROM ai_credits_log
               WHERE delta > 0 AND created_at > datetime('now', '-1 hour')
               GROUP BY user_id HAVING gains >= 3"""
        )
        for row in rows:
            await _auto_suspend(pool, row["user_id"], "credit_velocity: rapid credit gains detected")
    except Exception as exc:
        logger.warning("abuse_detector: credit_velocity check error: %s", exc)


async def _check_burst_patterns(pool):
    """More than 100 AI requests in a 10-min window → HIGH confidence."""
    try:
        rows = await pool.fetch(
            """SELECT user_id, COUNT(*) as cnt
               FROM ai_credits_log
               WHERE created_at > datetime('now', '-10 minutes')
               GROUP BY user_id HAVING cnt > 100"""
        )
        for row in rows:
            await _auto_suspend(
                pool, row["user_id"],
                f"burst_pattern: {row['cnt']} AI requests in 10 minutes"
            )
    except Exception as exc:
        logger.warning("abuse_detector: burst_patterns check error: %s", exc)


async def _check_score_anomalies(pool):
    """Score=10 on >3 exams in 30 min by same user → flag for review."""
    try:
        rows = await pool.fetch(
            """SELECT user_id, COUNT(*) as cnt
               FROM exam_results
               WHERE score = 10 AND created_at > datetime('now', '-30 minutes')
               GROUP BY user_id HAVING cnt > 3"""
        )
        for row in rows:
            await _flag_for_review(
                pool, row["user_id"],
                f"score_anomaly: {row['cnt']} perfect-score exams in 30 minutes"
            )
    except Exception as exc:
        logger.warning("abuse_detector: score_anomalies check error: %s", exc)


async def _check_new_account_burst(pool):
    """Account age <2h AND credits=0 (exhausted immediately) → flag for review."""
    try:
        rows = await pool.fetch(
            """SELECT id FROM users
               WHERE credits_balance = 0
                 AND created_at > datetime('now', '-2 hours')
                 AND is_suspended = 0"""
        )
        for row in rows:
            await _flag_for_review(
                pool, row["id"],
                "new_account_burst: new account exhausted credits within 2 hours"
            )
    except Exception as exc:
        logger.warning("abuse_detector: new_account_burst check error: %s", exc)


async def _run_abuse_detector(pool):
    """Main detection loop — runs every 5 minutes."""
    logger.info("abuse_detector: starting background loop (interval=%ds)", _INTERVAL)
    while True:
        try:
            await asyncio.sleep(_INTERVAL)
            await _check_credit_velocity(pool)
            await _check_burst_patterns(pool)
            await _check_score_anomalies(pool)
            await _check_new_account_burst(pool)
        except asyncio.CancelledError:
            logger.info("abuse_detector: loop cancelled, shutting down")
            break
        except Exception as exc:
            logger.error("abuse_detector: unhandled error in loop: %s", exc)

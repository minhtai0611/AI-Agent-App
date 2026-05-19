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
               WHERE delta > 0
                 AND reason NOT LIKE 'admin_%'
                 AND reason NOT LIKE 'subscription_%'
                 AND created_at > datetime('now', '-1 hour')
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


async def _check_behavioral_anomalies(pool):
    """Tab switches >10 or DevTools detected in a single day → behavior_anomaly event."""
    try:
        rows = await pool.fetch(
            """SELECT user_id,
                      SUM(CAST(json_extract(payload, '$.tab_switches') AS INTEGER)) AS total_tabs,
                      MAX(CAST(json_extract(payload, '$.devtools_detected') AS INTEGER)) AS any_devtools
               FROM exam_results
               WHERE created_at > datetime('now', '-1 day')
               GROUP BY user_id
               HAVING total_tabs > 10 OR any_devtools = 1"""
        )
        for row in rows:
            reason = f"behavior_anomaly: tab_switches={row['total_tabs']}, devtools={row['any_devtools']}"
            await _log_event(pool, row["user_id"], None, "behavior_anomaly", "medium", reason)
            # If user already has a HIGH event in the same window, auto-lock
            high_events = await pool.fetchrow(
                """SELECT COUNT(*) AS cnt FROM security_events
                   WHERE user_id = ? AND confidence = 'high'
                     AND created_at > datetime('now', '-1 day')""",
                row["user_id"],
            )
            if high_events and high_events["cnt"] > 0:
                await pool.execute(
                    "UPDATE users SET is_locked = 1, lock_reason = ? WHERE id = ? AND is_locked = 0",
                    f"auto-lock: {reason}", row["user_id"],
                )
                await _log_event(pool, row["user_id"], None, "auto_lock", "high", f"auto-lock: {reason}")
                from app.dependencies import invalidate_account_cache
                invalidate_account_cache(row["user_id"])
    except Exception as exc:
        logger.warning("abuse_detector: behavioral_anomalies check error: %s", exc)


async def _auto_lock_on_high_confidence(pool):
    """Auto-lock users with HIGH confidence abuse events if not already locked."""
    try:
        rows = await pool.fetch(
            """SELECT DISTINCT user_id FROM security_events
               WHERE confidence = 'high'
                 AND event_type IN ('credit_velocity', 'burst_pattern', 'exam_anomaly')
                 AND created_at > datetime('now', '-1 hour')"""
        )
        for row in rows:
            result = await pool.execute(
                "UPDATE users SET is_locked = 1, lock_reason = 'auto-lock: high-confidence abuse' WHERE id = ? AND is_locked = 0",
                row["user_id"],
            )
            if result:
                await _log_event(pool, row["user_id"], None, "auto_lock", "high", "auto-lock: high-confidence abuse event")
                from app.dependencies import invalidate_account_cache
                invalidate_account_cache(row["user_id"])
    except Exception as exc:
        logger.warning("abuse_detector: auto_lock check error: %s", exc)


_DORMANT_DAYS = 365
_DELETION_WARNING_DAYS = 30


async def _mark_dormant_accounts(pool):
    """Phase 1: mark basic-tier accounts inactive > _DORMANT_DAYS as pending deletion."""
    try:
        await pool.execute(
            f"""UPDATE users
               SET pending_deletion_at = datetime('now', '+{_DELETION_WARNING_DAYS} days')
               WHERE subscription_tier = 'basic'
                 AND is_suspended = 0 AND is_locked = 0 AND is_deactivated = 0
                 AND pending_deletion_at IS NULL
                 AND (last_seen_at IS NULL
                      OR last_seen_at < datetime('now', '-{_DORMANT_DAYS} days'))
            """
        )
    except Exception as exc:
        logger.warning("abuse_detector: mark_dormant error: %s", exc)


async def _deactivate_expired_pending(pool):
    """Phase 2: deactivate accounts whose warning period has expired."""
    try:
        rows = await pool.fetch(
            """SELECT id FROM users
               WHERE pending_deletion_at IS NOT NULL
                 AND pending_deletion_at < datetime('now')
                 AND is_deactivated = 0"""
        )
        for row in rows:
            await pool.execute(
                "UPDATE users SET is_deactivated = 1 WHERE id = ?",
                row["id"],
            )
            await _log_event(pool, row["id"], None, "auto_deactivated", "low",
                             f"dormant account — no login for {_DORMANT_DAYS} days")
            logger.info("abuse_detector: deactivated dormant account %s", row["id"])
    except Exception as exc:
        logger.warning("abuse_detector: deactivate_expired_pending error: %s", exc)


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
            await _check_behavioral_anomalies(pool)
            await _auto_lock_on_high_confidence(pool)
            await _mark_dormant_accounts(pool)
            await _deactivate_expired_pending(pool)
        except asyncio.CancelledError:
            logger.info("abuse_detector: loop cancelled, shutting down")
            break
        except Exception as exc:
            logger.error("abuse_detector: unhandled error in loop: %s", exc)

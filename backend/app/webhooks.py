"""Institutions Phase 2 — outbound org webhooks (attempt.completed, roster.updated, ...).

No scheduler/queue infra exists in this repo — retry delivery runs as a lightweight
in-process asyncio task started alongside lifespan. Fine for the current single-instance
SQLite deployment; would need revisiting for multiple replicas.
"""
import asyncio
import hashlib
import hmac
import json
import logging
import uuid

import httpx

logger = logging.getLogger(__name__)

MAX_DELIVERY_ATTEMPTS = 5
RETRY_SWEEP_INTERVAL_SECONDS = 60


async def create_webhook(pool, org_id: str, url: str, secret: str, event_types: str) -> dict:
    webhook_id = f"whk_{uuid.uuid4().hex[:12]}"
    await pool.execute(
        "INSERT INTO org_webhooks (id, org_id, url, secret, event_types) VALUES (?,?,?,?,?)",
        webhook_id, org_id, url, secret, event_types,
    )
    return dict(await pool.fetchrow("SELECT * FROM org_webhooks WHERE id=?", webhook_id))


async def list_webhooks(pool, org_id: str) -> list[dict]:
    rows = await pool.fetch("SELECT * FROM org_webhooks WHERE org_id=? ORDER BY created_at DESC", org_id)
    return [dict(r) for r in rows]


def _sign(secret: str, payload: str) -> str:
    return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


async def enqueue_delivery(pool, org_id: str, event_type: str, data: dict) -> None:
    hooks = await pool.fetch(
        "SELECT * FROM org_webhooks WHERE org_id=? AND active=1", org_id,
    )
    payload = json.dumps(data, ensure_ascii=False)
    for hook in hooks:
        if event_type not in [e.strip() for e in hook["event_types"].split(",")]:
            continue
        delivery_id = f"whd_{uuid.uuid4().hex[:12]}"
        await pool.execute(
            "INSERT INTO org_webhook_deliveries (id, webhook_id, event_type, payload) VALUES (?,?,?,?)",
            delivery_id, hook["id"], event_type, payload,
        )


async def _deliver_one(pool, delivery: dict, webhook: dict) -> None:
    signature = _sign(webhook["secret"], delivery["payload"])
    headers = {"Content-Type": "application/json", "X-Webhook-Signature": signature}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook["url"], content=delivery["payload"], headers=headers)
        if resp.status_code < 300:
            await pool.execute(
                "UPDATE org_webhook_deliveries SET status='delivered', delivered_at=datetime('now') WHERE id=?",
                delivery["id"],
            )
            return
        raise RuntimeError(f"delivery returned {resp.status_code}")
    except Exception as exc:
        attempt = delivery["attempt"] + 1
        status = "failed" if attempt >= MAX_DELIVERY_ATTEMPTS else "pending"
        await pool.execute(
            "UPDATE org_webhook_deliveries SET attempt=?, status=?, last_error=? WHERE id=?",
            attempt, status, str(exc)[:300], delivery["id"],
        )


async def retry_sweep_once(pool) -> None:
    pending = await pool.fetch(
        "SELECT * FROM org_webhook_deliveries WHERE status='pending' ORDER BY created_at LIMIT 50",
    )
    for delivery in pending:
        webhook = await pool.fetchrow("SELECT * FROM org_webhooks WHERE id=?", delivery["webhook_id"])
        if webhook:
            await _deliver_one(pool, dict(delivery), dict(webhook))


async def retry_sweep_loop(pool) -> None:
    while True:
        try:
            await asyncio.sleep(RETRY_SWEEP_INTERVAL_SECONDS)
            await retry_sweep_once(pool)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("webhook retry sweep failed: %s", exc)

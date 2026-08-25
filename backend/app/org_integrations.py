"""Institutions Phase 2 — roster/LMS integrations. Machine-to-machine API keys,
parallel to org_auth.require_role()'s human-session RBAC.
"""
import hashlib
import secrets
import uuid

from fastapi import Header, HTTPException, Request


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


async def create_api_key(pool, org_id: str, label: str, scopes: str) -> dict:
    raw_key = f"vk_{secrets.token_hex(24)}"
    key_id = f"key_{uuid.uuid4().hex[:12]}"
    await pool.execute(
        "INSERT INTO org_api_keys (id, org_id, key_hash, label, scopes) VALUES (?,?,?,?,?)",
        key_id, org_id, _hash_key(raw_key), label, scopes,
    )
    # The raw key is returned exactly once — only the hash is ever persisted.
    return {"id": key_id, "label": label, "scopes": scopes, "apiKey": raw_key}


async def list_api_keys(pool, org_id: str) -> list[dict]:
    rows = await pool.fetch(
        "SELECT id, org_id, label, scopes, created_at, revoked_at FROM org_api_keys WHERE org_id=? ORDER BY created_at DESC",
        org_id,
    )
    return [dict(r) for r in rows]


async def resolve_api_key(pool, raw_key: str) -> dict | None:
    row = await pool.fetchrow(
        "SELECT * FROM org_api_keys WHERE key_hash=? AND revoked_at IS NULL", _hash_key(raw_key),
    )
    return dict(row) if row else None


async def require_api_key(request: Request, x_api_key: str = Header(default=None)):
    if not x_api_key:
        raise HTTPException(status_code=401, detail="X-Api-Key header required")
    pool = getattr(request.app.state, "pool", None)
    key_row = await resolve_api_key(pool, x_api_key)
    if not key_row:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key")
    return key_row

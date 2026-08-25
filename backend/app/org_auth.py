"""Org/tenant identity — Institutions Phase 1.

SSO/SCIM/audit are bought, not built: WorkOS's hosted AuthKit page handles IdP
selection (SAML 2.0 + OIDC) and Directory Sync pushes provisioning events to our
webhook. This module owns everything downstream of that: our own opaque session
token, RBAC, and the local org tables — never SAML/OIDC/SCIM protocol handling
itself. Mirrors the app.agent.router_client.py pattern: unconfigured -> a typed
error the caller turns into a 503, so the whole feature is dark without env vars.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request

from app.config import OrgAuthNotConfiguredError, Settings, get_settings

logger = logging.getLogger(__name__)

SESSION_TTL = timedelta(days=7)
ROLE_ORDER = ["learner", "proctor", "admin", "owner"]


def _get_workos_client(settings: Settings):
    if not settings.workos_api_key or not settings.workos_client_id:
        raise OrgAuthNotConfiguredError(
            "workos_api_key/workos_client_id are not set — configure them before calling the org/SSO endpoints"
        )
    import workos

    return workos.WorkOSClient(api_key=settings.workos_api_key, client_id=settings.workos_client_id)


async def create_session(pool, org_member_id: str) -> str:
    token = f"sess_{uuid.uuid4().hex}"
    expires_at = (datetime.now(timezone.utc) + SESSION_TTL).isoformat()
    await pool.execute(
        "INSERT INTO org_sessions (id, org_member_id, expires_at) VALUES (?,?,?)",
        token, org_member_id, expires_at,
    )
    return token


async def resolve_session(pool, token: str) -> dict | None:
    if not token:
        return None
    row = await pool.fetchrow(
        """SELECT m.id AS member_id, m.org_id, m.email, m.role, m.source, m.status AS member_status,
                  o.id AS org_id_dup, o.name AS org_name, o.status AS org_status, s.expires_at
           FROM org_sessions s
           JOIN org_members m ON m.id = s.org_member_id
           JOIN orgs o ON o.id = m.org_id
           WHERE s.id = ?""",
        token,
    )
    if not row:
        return None
    if row["expires_at"] < datetime.now(timezone.utc).isoformat():
        return None
    if row["member_status"] != "active":
        return None
    return {
        "member": {
            "id": row["member_id"], "org_id": row["org_id"], "email": row["email"],
            "role": row["role"], "source": row["source"], "status": row["member_status"],
        },
        "org": {"id": row["org_id"], "name": row["org_name"], "status": row["org_status"]},
    }


async def get_current_member(request: Request):
    pool = getattr(request.app.state, "pool", None)
    token = request.cookies.get("org_session")
    resolved = await resolve_session(pool, token)
    if not resolved:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return resolved


def require_role(min_role: str):
    async def _dependency(current=Depends(get_current_member)):
        role = current["member"]["role"]
        if ROLE_ORDER.index(role) < ROLE_ORDER.index(min_role):
            raise HTTPException(status_code=403, detail=f"Requires role >= {min_role}")
        return current

    return _dependency


async def record_audit(pool, org_id: str, actor_member_id: str | None, action: str, target: str | None = None, metadata: str | None = None) -> None:
    audit_id = f"aud_{uuid.uuid4().hex[:12]}"
    await pool.execute(
        "INSERT INTO org_audit_log (id, org_id, actor_member_id, action, target, metadata_json) VALUES (?,?,?,?,?,?)",
        audit_id, org_id, actor_member_id, action, target, metadata or "{}",
    )


async def provision_or_update_member(pool, org_id: str, email: str, workos_user_id: str | None, role: str, source: str) -> dict:
    """Upsert an org_members row for SSO JIT-provisioning or SCIM sync.

    First member of a brand-new org is force-promoted to owner regardless of the
    caller-supplied role, so every org always has someone able to manage it.
    """
    existing_count = await pool.fetchval("SELECT COUNT(*) FROM org_members WHERE org_id=?", org_id)
    effective_role = "owner" if existing_count == 0 else role

    existing = await pool.fetchrow("SELECT * FROM org_members WHERE org_id=? AND email=?", org_id, email)
    if existing:
        await pool.execute(
            "UPDATE org_members SET workos_user_id=?, source=?, status='active', updated_at=datetime('now') WHERE id=?",
            workos_user_id, source, existing["id"],
        )
        member_id = existing["id"]
    else:
        member_id = f"mem_{uuid.uuid4().hex[:12]}"
        await pool.execute(
            "INSERT INTO org_members (id, org_id, email, workos_user_id, role, source) VALUES (?,?,?,?,?,?)",
            member_id, org_id, email, workos_user_id, effective_role, source,
        )
    return await pool.fetchrow("SELECT * FROM org_members WHERE id=?", member_id)

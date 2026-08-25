"""Institutions Phase 2 — data residency & retention."""


async def export_evidence(pool, org_id: str) -> dict:
    org = await pool.fetchrow("SELECT id, name, retention_days, support_tier FROM orgs WHERE id=?", org_id)
    audit_rows = await pool.fetch("SELECT * FROM org_audit_log WHERE org_id=? ORDER BY created_at DESC", org_id)
    return {
        "org": dict(org) if org else None,
        "auditLog": [dict(r) for r in audit_rows],
    }


async def purge_expired(pool, org_id: str) -> int:
    org = await pool.fetchrow("SELECT retention_days FROM orgs WHERE id=?", org_id)
    if not org or not org["retention_days"]:
        return 0
    cutoff_days = int(org["retention_days"])
    result = await pool.execute(
        f"DELETE FROM org_exam_attempts WHERE org_id=? AND submitted_at < datetime('now', '-{cutoff_days} days')",
        org_id,
    )
    await pool.execute(
        f"DELETE FROM org_audit_log WHERE org_id=? AND created_at < datetime('now', '-{cutoff_days} days')",
        org_id,
    )
    try:
        return int(result.split()[-1])
    except (ValueError, IndexError):
        return 0

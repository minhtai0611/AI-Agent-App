"""Institutions Phase 2 — org branding.

GET is unauthenticated on purpose: the learner-facing portal needs to theme itself
(logo/colors) before an SSO login has even happened.
"""


async def get_branding(pool, org_id: str) -> dict | None:
    row = await pool.fetchrow(
        "SELECT id, name, branding_logo_url, branding_primary_color, branding_secondary_color, "
        "support_tier, status_page_url FROM orgs WHERE id=?",
        org_id,
    )
    return dict(row) if row else None


async def set_branding(pool, org_id: str, patch: dict) -> dict:
    fields = {
        "branding_logo_url": patch.get("logoUrl"),
        "branding_primary_color": patch.get("primaryColor"),
        "branding_secondary_color": patch.get("secondaryColor"),
    }
    for column, value in fields.items():
        if value is not None:
            await pool.execute(f"UPDATE orgs SET {column}=? WHERE id=?", value, org_id)
    return await get_branding(pool, org_id)

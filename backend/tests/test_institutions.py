import os

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.org_auth import create_session, provision_or_update_member, record_audit


@pytest.fixture(scope="module")
async def client(tmp_path_factory):
    db_path = str(tmp_path_factory.mktemp("db") / "test.db")
    os.environ["SQLITE_PATH"] = db_path
    # Force WorkOS "unconfigured" so this suite never makes a live network call.
    os.environ["WORKOS_API_KEY"] = ""
    os.environ["WORKOS_CLIENT_ID"] = ""
    from app.config import get_settings
    get_settings.cache_clear()

    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
    del os.environ["SQLITE_PATH"]
    del os.environ["WORKOS_API_KEY"]
    del os.environ["WORKOS_CLIENT_ID"]
    get_settings.cache_clear()


async def _seed_org(pool, org_id="org_test1", name="Test Org"):
    await pool.execute("INSERT OR IGNORE INTO orgs (id, name) VALUES (?,?)", org_id, name)
    return org_id


async def _seed_member(pool, org_id, email, role, source="manual"):
    member_id = f"mem_{org_id}_{email.split('@')[0]}"
    await pool.execute(
        "INSERT OR IGNORE INTO org_members (id, org_id, email, role, source) VALUES (?,?,?,?,?)",
        member_id, org_id, email, role, source,
    )
    return member_id


async def _cookie_for(pool, member_id):
    token = await create_session(pool, member_id)
    return {"org_session": token}


# --- WorkOS-dependent routes: unconfigured -> 503 --------------------------------------

@pytest.mark.asyncio
async def test_auth_login_503_when_unconfigured(client):
    resp = await client.get("/auth/login", follow_redirects=False)
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_auth_callback_503_when_unconfigured(client):
    resp = await client.get("/auth/callback", params={"code": "x"}, follow_redirects=False)
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_webhook_503_when_secret_unset(client):
    resp = await client.post("/webhooks/workos", json={"event": "dsync.user.created", "data": {}})
    assert resp.status_code == 503


# --- Session / RBAC on local (non-WorkOS) logic -----------------------------------------

@pytest.mark.asyncio
async def test_auth_me_requires_session(client):
    resp = await client.get("/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_org_members_role_gating(client):
    pool = app.state.pool
    org_id = await _seed_org(pool, "org_rbac", "RBAC Org")
    learner_id = await _seed_member(pool, org_id, "learner@rbac.test", "learner")
    admin_id = await _seed_member(pool, org_id, "admin@rbac.test", "admin")

    learner_cookies = await _cookie_for(pool, learner_id)
    admin_cookies = await _cookie_for(pool, admin_id)

    resp = await client.get("/org/members", cookies=learner_cookies)
    assert resp.status_code == 403

    resp = await client.get("/org/members", cookies=admin_cookies)
    assert resp.status_code == 200
    emails = {m["email"] for m in resp.json()}
    assert {"learner@rbac.test", "admin@rbac.test"} <= emails


@pytest.mark.asyncio
async def test_scim_member_edit_locked(client):
    pool = app.state.pool
    org_id = await _seed_org(pool, "org_scim", "SCIM Org")
    admin_id = await _seed_member(pool, org_id, "admin@scim.test", "admin")
    scim_member_id = await _seed_member(pool, org_id, "scim@scim.test", "learner", source="scim")
    admin_cookies = await _cookie_for(pool, admin_id)

    resp = await client.patch(f"/org/members/{scim_member_id}", json={"role": "admin"}, cookies=admin_cookies)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_admin_can_change_manual_member_role(client):
    pool = app.state.pool
    org_id = await _seed_org(pool, "org_edit", "Edit Org")
    admin_id = await _seed_member(pool, org_id, "admin@edit.test", "admin")
    member_id = await _seed_member(pool, org_id, "member@edit.test", "learner")
    admin_cookies = await _cookie_for(pool, admin_id)

    resp = await client.patch(f"/org/members/{member_id}", json={"role": "proctor"}, cookies=admin_cookies)
    assert resp.status_code == 200
    assert resp.json()["role"] == "proctor"


@pytest.mark.asyncio
async def test_invite_member_preprovisions(client):
    pool = app.state.pool
    org_id = await _seed_org(pool, "org_invite", "Invite Org")
    admin_id = await _seed_member(pool, org_id, "admin@invite.test", "admin")
    admin_cookies = await _cookie_for(pool, admin_id)

    resp = await client.post("/org/members/invite", json={"email": "new@invite.test", "role": "learner"}, cookies=admin_cookies)
    assert resp.status_code == 200
    assert resp.json()["email"] == "new@invite.test"
    assert resp.json()["source"] == "manual"


@pytest.mark.asyncio
async def test_audit_log_records_role_change(client):
    pool = app.state.pool
    org_id = await _seed_org(pool, "org_audit", "Audit Org")
    admin_id = await _seed_member(pool, org_id, "admin@audit.test", "admin")
    member_id = await _seed_member(pool, org_id, "member@audit.test", "learner")
    admin_cookies = await _cookie_for(pool, admin_id)

    await client.patch(f"/org/members/{member_id}", json={"role": "proctor"}, cookies=admin_cookies)
    resp = await client.get("/org/audit-log", cookies=admin_cookies)
    assert resp.status_code == 200
    actions = [row["action"] for row in resp.json()["local"]]
    assert "member.role_changed" in actions


@pytest.mark.asyncio
async def test_org_settings_get_and_patch(client):
    pool = app.state.pool
    org_id = await _seed_org(pool, "org_settings", "Settings Org")
    admin_id = await _seed_member(pool, org_id, "admin@settings.test", "admin")
    admin_cookies = await _cookie_for(pool, admin_id)

    resp = await client.patch("/org/settings", json={"name": "Renamed Org"}, cookies=admin_cookies)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed Org"

    resp = await client.get("/org/settings", cookies=admin_cookies)
    assert resp.json()["name"] == "Renamed Org"


# --- provision_or_update_member: first-user-becomes-owner rule --------------------------

@pytest.mark.asyncio
async def test_first_member_becomes_owner(client):
    pool = app.state.pool
    org_id = await _seed_org(pool, "org_bootstrap", "Bootstrap Org")
    member = await provision_or_update_member(pool, org_id, "first@bootstrap.test", "wu_1", "learner", "sso_jit")
    assert member["role"] == "owner"

    second = await provision_or_update_member(pool, org_id, "second@bootstrap.test", "wu_2", "learner", "sso_jit")
    assert second["role"] == "learner"

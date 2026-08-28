import os

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.org_auth import create_session


@pytest.fixture(scope="module")
async def client(tmp_path_factory):
    db_path = str(tmp_path_factory.mktemp("db") / "test.db")
    os.environ["SQLITE_PATH"] = db_path
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


async def _seed_org_with_admin(pool, org_id, admin_email):
    await pool.execute("INSERT OR IGNORE INTO orgs (id, name) VALUES (?,?)", org_id, f"{org_id} name")
    admin_id = f"mem_{org_id}_admin"
    await pool.execute(
        "INSERT OR IGNORE INTO org_members (id, org_id, email, role, source) VALUES (?,?,?,?,?)",
        admin_id, org_id, admin_email, "admin", "manual",
    )
    token = await create_session(pool, admin_id)
    return admin_id, {"org_session": token}


@pytest.mark.asyncio
async def test_content_ledger_requires_admin(client):
    resp = await client.get("/org/content-ledger")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_content_ledger_lists_entries_across_orgs(client):
    pool = app.state.pool
    _, cookies = await _seed_org_with_admin(pool, "org_ledger", "admin@ledger.test")

    await pool.execute(
        "INSERT OR REPLACE INTO content_ledger (content_hash, topic, difficulty, status) VALUES (?,?,?,?)",
        "hash_verified", "algebra", "medium", "verified",
    )
    await pool.execute(
        "INSERT OR REPLACE INTO content_ledger (content_hash, topic, difficulty, status) VALUES (?,?,?,?)",
        "hash_rejected", "geometry", "hard", "rejected",
    )

    resp = await client.get("/org/content-ledger", cookies=cookies)
    assert resp.status_code == 200
    body = resp.json()
    hashes = {e["content_hash"] for e in body["entries"]}
    assert {"hash_verified", "hash_rejected"} <= hashes
    assert body["verified_count"] >= 1
    assert body["rejected_count"] >= 1

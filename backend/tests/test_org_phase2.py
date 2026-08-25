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
async def test_public_branding_no_auth_required(client):
    pool = app.state.pool
    await _seed_org_with_admin(pool, "org_brand", "admin@brand.test")
    resp = await client.get("/org/org_brand/branding")
    assert resp.status_code == 200
    assert resp.json()["id"] == "org_brand"


@pytest.mark.asyncio
async def test_branding_update_and_read(client):
    pool = app.state.pool
    _, cookies = await _seed_org_with_admin(pool, "org_brand2", "admin@brand2.test")
    resp = await client.put("/org/settings/branding", json={"primaryColor": "#123456"}, cookies=cookies)
    assert resp.status_code == 200
    assert resp.json()["branding_primary_color"] == "#123456"


@pytest.mark.asyncio
async def test_content_draft_submit_approve(client):
    pool = app.state.pool
    admin_id, cookies = await _seed_org_with_admin(pool, "org_content", "admin@content.test")

    resp = await client.post("/org/content", json={"question": "2+2=?", "choices": ["3", "4"], "correct": 1}, cookies=cookies)
    assert resp.status_code == 200
    item = resp.json()
    assert item["status"] == "draft"

    resp = await client.post(f"/org/content/{item['id']}/submit", cookies=cookies)
    assert resp.json()["status"] == "pending_review"

    resp = await client.post(f"/org/content/{item['id']}/approve", cookies=cookies)
    assert resp.json()["status"] == "approved"
    assert resp.json()["approved_by"] == admin_id


@pytest.mark.asyncio
async def test_org_exam_mixes_global_and_custom_content(client):
    pool = app.state.pool
    admin_id, cookies = await _seed_org_with_admin(pool, "org_exam", "admin@exam.test")
    questions = (await client.get("/questions")).json()
    global_qid = questions[0]["id"]

    resp = await client.post("/org/content", json={"question": "custom Q", "choices": ["a", "b"], "correct": 0}, cookies=cookies)
    custom_id = resp.json()["id"]

    resp = await client.post(
        "/org/exams",
        json={"title": "Mixed Exam", "items": [{"questionId": global_qid}, {"orgContentItemId": custom_id}]},
        cookies=cookies,
    )
    assert resp.status_code == 200
    exam = resp.json()
    assert len(exam["items"]) == 2

    resp = await client.get(f"/org/exams/{exam['id']}", cookies=cookies)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 2


@pytest.mark.asyncio
async def test_attempt_and_cohort_analytics_isolated_across_orgs(client):
    pool = app.state.pool
    admin_a, cookies_a = await _seed_org_with_admin(pool, "org_a", "admin@orga.test")
    admin_b, cookies_b = await _seed_org_with_admin(pool, "org_b", "admin@orgb.test")

    await pool.execute("INSERT INTO org_cohorts (id, org_id, name) VALUES (?,?,?)", "cohort_a", "org_a", "Cohort A")

    resp = await client.post(
        "/org/exam-attempts",
        json={"examId": "e1", "score": 0.8, "cohortId": "cohort_a", "itemResponses": [{"question_id": "q1", "correct": True}]},
        cookies=cookies_a,
    )
    assert resp.status_code == 200

    resp = await client.get("/org/analytics/cohorts/cohort_a", cookies=cookies_a)
    assert resp.status_code == 200
    assert resp.json()["attempts"] == 1

    # Org B has no attempts in cohort_a's org, and can't see org A's item analytics.
    resp = await client.get("/org/analytics/items", cookies=cookies_b)
    assert resp.status_code == 200
    assert resp.json() == []

    resp = await client.get("/org/analytics/items", cookies=cookies_a)
    assert any(item["question_id"] == "q1" for item in resp.json())


@pytest.mark.asyncio
async def test_api_key_roundtrip_and_roster(client):
    pool = app.state.pool
    admin_id, cookies = await _seed_org_with_admin(pool, "org_int", "admin@int.test")

    resp = await client.post("/org/integrations/keys", json={"label": "LMS", "scopes": "roster:read"}, cookies=cookies)
    assert resp.status_code == 200
    raw_key = resp.json()["apiKey"]
    assert raw_key.startswith("vk_")

    # Raw key never persisted — only its hash.
    row = await pool.fetchrow("SELECT key_hash FROM org_api_keys WHERE org_id=?", "org_int")
    assert raw_key not in row["key_hash"]

    resp = await client.get("/api/v1/org/roster", headers={"X-Api-Key": raw_key})
    assert resp.status_code == 200
    assert any(m["email"] == "admin@int.test" for m in resp.json())

    resp = await client.get("/api/v1/org/roster", headers={"X-Api-Key": "not-a-real-key"})
    assert resp.status_code == 401

    resp = await client.get("/api/v1/org/roster")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_webhook_delivery_signs_payload(client, monkeypatch):
    pool = app.state.pool
    admin_id, cookies = await _seed_org_with_admin(pool, "org_hook", "admin@hook.test")

    resp = await client.post(
        "/org/webhooks", json={"url": "https://example.test/hook", "secret": "shh", "eventTypes": "attempt.completed"}, cookies=cookies,
    )
    assert resp.status_code == 200

    captured = {}

    class _FakeResponse:
        status_code = 200

    class _FakeAsyncClient:
        def __init__(self, *a, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, content=None, headers=None):
            captured["url"] = url
            captured["headers"] = headers
            captured["content"] = content
            return _FakeResponse()

    import app.webhooks as webhooks_module
    monkeypatch.setattr(webhooks_module.httpx, "AsyncClient", _FakeAsyncClient)

    await client.post("/org/exam-attempts", json={"examId": "e2", "score": 1.0}, cookies=cookies)
    await webhooks_module.retry_sweep_once(pool)

    assert captured["url"] == "https://example.test/hook"
    assert "X-Webhook-Signature" in captured["headers"]


@pytest.mark.asyncio
async def test_compliance_export_returns_org_and_audit(client):
    pool = app.state.pool
    admin_id, cookies = await _seed_org_with_admin(pool, "org_comp", "admin@comp.test")
    resp = await client.get("/org/compliance/export", cookies=cookies)
    assert resp.status_code == 200
    assert resp.json()["org"]["id"] == "org_comp"

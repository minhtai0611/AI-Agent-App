import os

import pytest


@pytest.fixture(scope="module")
async def client(tmp_path_factory):
    from httpx import ASGITransport, AsyncClient
    from app.main import app

    db_path = str(tmp_path_factory.mktemp("db") / "test.db")
    os.environ["SQLITE_PATH"] = db_path
    from app.config import get_settings

    get_settings.cache_clear()

    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
    del os.environ["SQLITE_PATH"]
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_cas_evaluate_simplifies_a_valid_expression(client):
    resp = await client.post("/cas/evaluate", json={"expr": "x + x"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is True
    assert body["simplified"] == "2*x"


@pytest.mark.asyncio
async def test_cas_evaluate_handles_implicit_multiplication_and_caret_power(client):
    resp = await client.post("/cas/evaluate", json={"expr": "2x^2"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is True
    assert body["simplified"] == "2*x**2"


@pytest.mark.asyncio
async def test_cas_evaluate_returns_available_false_not_500_on_bad_input(client):
    resp = await client.post("/cas/evaluate", json={"expr": "2 +* 3"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is False

"""Tests for /users/me/history endpoints."""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone

from app.auth import create_jwt


@pytest.fixture
def mock_pool():
    pool = MagicMock()
    pool.acquire = MagicMock()
    conn = AsyncMock()
    conn.__aenter__ = AsyncMock(return_value=conn)
    conn.__aexit__ = AsyncMock(return_value=False)
    pool.acquire.return_value = conn
    pool.fetchrow = AsyncMock()
    pool.fetch = AsyncMock(return_value=[])
    return pool, conn


@pytest.fixture
def app_with_pool(mock_pool):
    pool, _ = mock_pool
    from app.main import app
    app.state.pool = pool
    return app


@pytest.mark.asyncio
async def test_post_history_requires_auth(app_with_pool):
    async with AsyncClient(transport=ASGITransport(app=app_with_pool), base_url="http://test") as client:
        resp = await client.post("/users/me/history", json=[])
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_history_requires_auth(app_with_pool):
    async with AsyncClient(transport=ASGITransport(app=app_with_pool), base_url="http://test") as client:
        resp = await client.get("/users/me/history")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_post_history_idempotent(app_with_pool, mock_pool):
    _, conn = mock_pool
    token = create_jwt(1)
    entries = [{"result_id": "r1", "exam_id": "e1", "score": 0.9, "payload": {"q": 1}, "created_at": None}]
    async with AsyncClient(transport=ASGITransport(app=app_with_pool), base_url="http://test") as client:
        resp = await client.post(
            "/users/me/history",
            json=entries,
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 204
    conn.execute.assert_awaited_once()
    # ON CONFLICT DO NOTHING — second identical call is safe
    call_sql = conn.execute.call_args[0][0]
    assert "ON CONFLICT" in call_sql


@pytest.mark.asyncio
async def test_get_history_returns_user_rows(app_with_pool, mock_pool):
    pool, _ = mock_pool
    ts = datetime(2025, 1, 1, tzinfo=timezone.utc)
    pool.fetch = AsyncMock(return_value=[
        {"result_id": "r1", "exam_id": "e1", "score": 0.8, "payload": None, "created_at": ts}
    ])
    token = create_jwt(1)
    async with AsyncClient(transport=ASGITransport(app=app_with_pool), base_url="http://test") as client:
        resp = await client.get(
            "/users/me/history",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["result_id"] == "r1"
    assert "2025" in data[0]["created_at"]

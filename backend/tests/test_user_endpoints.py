"""Tests for /users/me/history endpoints."""
import json
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone

os.environ.setdefault("JWT_SECRET", "test-secret-at-least-32-chars-long!")
os.environ.setdefault("ANTHROPIC_AUTH_TOKEN", "test-token")

from app.auth import create_jwt
from tests.builders import FULL_USER_ROW


@pytest.fixture
def mock_pool():
    pool = MagicMock()
    # async context manager for pool.acquire()
    conn = AsyncMock()
    conn.__aenter__ = AsyncMock(return_value=conn)
    conn.__aexit__ = AsyncMock(return_value=False)
    pool.acquire = MagicMock(return_value=conn)
    # FULL_USER_ROW satisfies every fetchrow call including get_current_user's
    # is_suspended / is_locked / is_deactivated checks.
    pool.fetchrow = AsyncMock(return_value=dict(FULL_USER_ROW))
    pool.fetch = AsyncMock(return_value=[])
    pool.execute = AsyncMock(return_value="UPDATE 1")
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
    # Endpoint returns 200 with {"streak_recovered": ..., "streak": ...}
    assert resp.status_code == 200
    # The endpoint calls conn.execute at least once (INSERT exam_results) and
    # may call it again for exam_leaderboard — assert it was called, not just once.
    assert conn.execute.await_count >= 1
    # The first execute must be the idempotent INSERT with ON CONFLICT DO NOTHING
    first_sql = conn.execute.call_args_list[0][0][0]
    assert "ON CONFLICT" in first_sql


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

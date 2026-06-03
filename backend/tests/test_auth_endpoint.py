"""Integration-style tests for /auth/google and get_current_user — DB + google mocked."""
import os
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport
import jwt as pyjwt

os.environ.setdefault("JWT_SECRET", "test-secret-at-least-32-chars-long!")
os.environ.setdefault("ANTHROPIC_AUTH_TOKEN", "test-token")

from app.auth import create_jwt
from app.config import get_settings
from tests.builders import FULL_USER_ROW


@pytest.fixture
def fake_google_payload():
    return {
        "sub": "google-sub-123",
        "email": "user@example.com",
        "name": "Test User",
        "picture": "https://example.com/avatar.jpg",
    }


@pytest.fixture
def mock_pool():
    pool = MagicMock()
    # FULL_USER_ROW satisfies every pool.fetchrow call across get_current_user,
    # auth_google (trial_used, id, INSERT RETURNING), and get_me.
    pool.fetchrow = AsyncMock(return_value=dict(FULL_USER_ROW))
    pool.fetch = AsyncMock(return_value=[])
    pool.execute = AsyncMock(return_value="UPDATE 1")
    return pool


@pytest.fixture
def app_with_pool(mock_pool):
    from app.main import app
    app.state.pool = mock_pool
    return app


@pytest.mark.asyncio
async def test_auth_google_success(app_with_pool, fake_google_payload):
    with patch("app.main.verify_google_token", new=AsyncMock(return_value=fake_google_payload)):
        async with AsyncClient(transport=ASGITransport(app=app_with_pool), base_url="http://test") as client:
            resp = await client.post("/auth/google", json={"id_token": "valid-token"})

    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == "user@example.com"
    settings = get_settings()
    # create_jwt encodes with aud="exam-app" — must pass audience= when decoding
    payload = pyjwt.decode(
        data["access_token"], settings.jwt_secret, algorithms=["HS256"], audience="exam-app"
    )
    assert payload["sub"] == "1"


@pytest.mark.asyncio
async def test_auth_google_invalid_token(app_with_pool):
    with patch("app.main.verify_google_token", new=AsyncMock(side_effect=ValueError("bad token"))):
        async with AsyncClient(transport=ASGITransport(app=app_with_pool), base_url="http://test") as client:
            resp = await client.post("/auth/google", json={"id_token": "bad-token"})

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid or expired Google token"


@pytest.mark.asyncio
async def test_get_me_no_auth(app_with_pool):
    async with AsyncClient(transport=ASGITransport(app=app_with_pool), base_url="http://test") as client:
        resp = await client.get("/users/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me_expired_token(app_with_pool):
    import time
    settings = get_settings()
    expired = pyjwt.encode(
        {"sub": "1", "iat": int(time.time()) - 100, "exp": int(time.time()) - 1},
        settings.jwt_secret,
        algorithm="HS256",
    )
    async with AsyncClient(transport=ASGITransport(app=app_with_pool), base_url="http://test") as client:
        resp = await client.get("/users/me", headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401
    assert "expired" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_me_valid_token(app_with_pool, mock_pool):
    token = create_jwt(1)
    # The fixture already provides FULL_USER_ROW which has all required fields.
    # Do NOT override mock_pool.fetchrow here — a partial dict causes KeyError
    # in the /users/me handler when it calls COUNT(*) queries (missing 'cnt' key).
    async with AsyncClient(transport=ASGITransport(app=app_with_pool), base_url="http://test") as client:
        resp = await client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "user@example.com"

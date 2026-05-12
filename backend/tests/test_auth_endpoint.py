"""Integration-style tests for /auth/google and get_current_user — DB + google mocked."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport
import jwt as pyjwt

from app.auth import create_jwt
from app.config import get_settings


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
    row = {"id": 1, "email": "user@example.com", "display_name": "Test User", "avatar_url": "https://example.com/avatar.jpg"}
    pool.fetchrow = AsyncMock(return_value=row)
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
    payload = pyjwt.decode(data["access_token"], settings.jwt_secret, algorithms=["HS256"])
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
    mock_pool.fetchrow = AsyncMock(return_value={
        "id": 1, "email": "user@example.com",
        "display_name": "Test User", "avatar_url": "https://example.com/avatar.jpg"
    })
    async with AsyncClient(transport=ASGITransport(app=app_with_pool), base_url="http://test") as client:
        resp = await client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "user@example.com"

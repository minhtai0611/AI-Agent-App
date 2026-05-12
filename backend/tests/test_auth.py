"""Unit tests for auth.py — no network calls."""
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
import pytest
import jwt as pyjwt

from app.auth import create_jwt, decode_jwt


def test_create_jwt_structure():
    token = create_jwt(42)
    assert isinstance(token, str)
    from app.config import get_settings
    payload = pyjwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    assert payload["sub"] == "42"
    assert "exp" in payload
    assert "iat" in payload


def test_decode_jwt_roundtrip():
    token = create_jwt(7)
    payload = decode_jwt(token)
    assert payload["sub"] == "7"


def test_decode_jwt_invalid():
    with pytest.raises(pyjwt.InvalidTokenError):
        decode_jwt("garbage.token.value")


def test_decode_jwt_tampered():
    token = create_jwt(1)
    parts = token.split(".")
    tampered = parts[0] + "." + parts[1] + ".invalidsignature"
    with pytest.raises(pyjwt.InvalidTokenError):
        decode_jwt(tampered)


@pytest.mark.asyncio
async def test_verify_google_token_success():
    from app.auth import verify_google_token
    fake_payload = {"sub": "12345", "email": "user@example.com", "name": "Test User"}
    with patch("app.auth.asyncio.to_thread", new=AsyncMock(return_value=fake_payload)):
        result = await verify_google_token("fake-id-token")
    assert result["sub"] == "12345"


@pytest.mark.asyncio
async def test_verify_google_token_invalid():
    from app.auth import verify_google_token
    import google.auth.exceptions
    with patch(
        "app.auth.asyncio.to_thread",
        new=AsyncMock(side_effect=google.auth.exceptions.GoogleAuthError("bad token")),
    ):
        with pytest.raises(ValueError, match="Invalid or expired Google token"):
            await verify_google_token("bad-token")

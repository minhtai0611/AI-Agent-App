import asyncio
from datetime import datetime, timedelta, timezone

import jwt
import google.auth.exceptions
import google.auth.transport.requests
import google.oauth2.id_token

from app.config import get_settings


async def verify_google_token(id_token_str: str) -> dict:
    """Verify a Google ID token and return its payload. Raises ValueError on failure."""
    settings = get_settings()
    try:
        payload = await asyncio.to_thread(
            google.oauth2.id_token.verify_oauth2_token,
            id_token_str,
            google.auth.transport.requests.Request(),
            settings.google_client_id,
        )
        return payload
    except google.auth.exceptions.GoogleAuthError as exc:
        raise ValueError(f"Invalid or expired Google token: {exc}") from exc


def create_jwt(user_id: int) -> str:
    settings = get_settings()
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(days=7),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_jwt(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])

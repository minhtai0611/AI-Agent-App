import asyncio
import re
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
import google.auth.exceptions
import google.auth.transport.requests
import google.oauth2.id_token

from app.config import get_settings

# ── Password utilities ────────────────────────────────────────────────────────

PASSWORD_RE = re.compile(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+\[\]{}|;:\'",.<>?/`~]).{8,128}$'
)

def validate_password_strength(pw: str) -> bool:
    return bool(PASSWORD_RE.match(pw))

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())


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
    except Exception as exc:
        raise ValueError(f"Google token verification failed: {exc}") from exc


def create_jwt(user_id: int) -> str:
    settings = get_settings()
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(days=7),
        "aud": "exam-app",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_jwt(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"], audience="exam-app")


# ── Cookie-based session token helpers ───────────────────────────────────────

import hashlib
import uuid

ACCESS_TTL_SECS  = 900      # 15 min
REFRESH_TTL_SECS = 604_800  # 7 days


def create_access_jwt(user_id: int) -> str:
    settings = get_settings()
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(seconds=ACCESS_TTL_SECS),
        "aud": "exam-app",
        "typ": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def create_refresh_jwt(user_id: int) -> str:
    settings = get_settings()
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(seconds=REFRESH_TTL_SECS),
        "aud": "exam-app",
        "typ": "refresh",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_family_id() -> str:
    return str(uuid.uuid4())

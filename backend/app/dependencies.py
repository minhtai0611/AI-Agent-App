import time
from functools import lru_cache
from openai import AsyncOpenAI
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt
from cachetools import TTLCache

from app.config import get_settings
from app.auth import decode_jwt

# Cache account status (suspended/locked/deactivated) for 30 s per user.
_account_status_cache: TTLCache = TTLCache(maxsize=500, ttl=30)

_last_seen_flush: dict[int, float] = {}
_SEEN_DEBOUNCE = 60  # seconds


def invalidate_account_cache(user_id: int) -> None:
    _account_status_cache.pop(user_id, None)


@lru_cache
def get_ai_client() -> AsyncOpenAI:
    settings = get_settings()
    router_root = settings.anthropic_base_url.rstrip("/")
    return AsyncOpenAI(
        api_key=settings.anthropic_auth_token,
        base_url=f"{router_root}/v2",
    )


# Backward-compat alias
get_anthropic_client = get_ai_client


class CurrentUser(BaseModel):
    user_id: int
    email: str


_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_jwt(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = CurrentUser(user_id=int(payload["sub"]), email=payload.get("email", ""))

    pool = getattr(request.app.state, "pool", None)
    if not pool:
        raise HTTPException(status_code=503, detail="Service unavailable")
    ip = request.client.host if request.client else None

    cached = _account_status_cache.get(user.user_id)
    if cached is None:
        row = await pool.fetchrow(
            "SELECT is_suspended, suspension_reason, is_locked, lock_reason, is_deactivated FROM users WHERE id = ?",
            user.user_id,
        )
        cached = {
            "suspended": bool(row and row["is_suspended"]),
            "suspension_reason": (row["suspension_reason"] or "") if row else "",
            "locked": bool(row and row["is_locked"]),
            "lock_reason": (row["lock_reason"] or "") if row else "",
            "deactivated": bool(row and row["is_deactivated"]),
        }
        _account_status_cache[user.user_id] = cached

    if cached["locked"]:
        raise HTTPException(
            status_code=403,
            detail={"code": "account_locked", "reason": cached["lock_reason"]},
        )
    if cached["suspended"]:
        raise HTTPException(
            status_code=403,
            detail={"code": "account_suspended", "reason": cached["suspension_reason"]},
        )
    if cached["deactivated"]:
        raise HTTPException(
            status_code=403,
            detail={"code": "account_deactivated"},
        )
    if ip:
        now_mono = time.monotonic()
        needs_seen = (now_mono - _last_seen_flush.get(user.user_id, 0)) >= _SEEN_DEBOUNCE
        if needs_seen:
            _last_seen_flush[user.user_id] = now_mono
            await pool.execute(
                "UPDATE users SET last_ip = ?, last_seen_at = datetime('now') WHERE id = ?",
                ip, user.user_id,
            )
        else:
            await pool.execute("UPDATE users SET last_ip = ? WHERE id = ?", ip, user.user_id)

    return user

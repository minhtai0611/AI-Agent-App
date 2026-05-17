from functools import lru_cache
from openai import AsyncOpenAI
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt
from cachetools import TTLCache

from app.config import get_settings
from app.auth import decode_jwt

# Cache user suspension status for 30 s — avoids a DB read on every request
# for the ~50 active users under load.  Invalidated implicitly on TTL expiry.
_suspension_cache: TTLCache = TTLCache(maxsize=500, ttl=30)


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

    cached = _suspension_cache.get(user.user_id)
    if cached is None:
        row = await pool.fetchrow(
            "SELECT is_suspended, suspension_reason FROM users WHERE id = ?", user.user_id
        )
        cached = {"suspended": bool(row and row["is_suspended"]),
                  "reason": (row["suspension_reason"] or "") if row else ""}
        _suspension_cache[user.user_id] = cached

    if cached["suspended"]:
        raise HTTPException(
            status_code=403,
            detail={"code": "account_suspended", "reason": cached["reason"]},
        )
    if ip:
        await pool.execute("UPDATE users SET last_ip = ? WHERE id = ?", ip, user.user_id)

    return user

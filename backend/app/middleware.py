import time
from collections import defaultdict, deque
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

_AI_PATHS = {"/analyze", "/hint", "/tutor", "/study-plan", "/explain"}
_AUTH_PATHS = {"/auth/google"}
_WINDOW = 60        # seconds
_IP_LIMIT = 20      # requests per window per IP
_AUTH_LIMIT = 10    # tighter limit for auth endpoints
_USER_LIMIT = 60    # requests per minute per authenticated user
_HINT_RAPID_WINDOW = 10   # seconds
_HINT_RAPID_LIMIT = 5     # max hint requests per user in rapid window


def _extract_user_id(request: Request) -> str | None:
    """Decode JWT from Authorization header to get user_id (no DB lookup)."""
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    token = auth[7:]
    try:
        from app.auth import decode_jwt
        payload = decode_jwt(token)
        return str(payload.get("sub", ""))
    except Exception:
        return None


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._ip_buckets: dict[str, deque] = defaultdict(deque)
        self._auth_buckets: dict[str, deque] = defaultdict(deque)
        self._user_buckets: dict[str, deque] = defaultdict(deque)
        self._hint_buckets: dict[str, deque] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()

        # Auth endpoint — tight IP-based limit
        if request.url.path in _AUTH_PATHS:
            bucket = self._auth_buckets[ip]
            while bucket and bucket[0] < now - _WINDOW:
                bucket.popleft()
            if len(bucket) >= _AUTH_LIMIT:
                return Response(
                    content='{"detail":"Quá nhiều yêu cầu, vui lòng thử lại sau."}',
                    status_code=429,
                    media_type="application/json",
                )
            bucket.append(now)
            return await call_next(request)

        if request.url.path not in _AI_PATHS:
            return await call_next(request)

        # IP-based limit (catches unauthenticated bursts)
        ip_bucket = self._ip_buckets[ip]
        while ip_bucket and ip_bucket[0] < now - _WINDOW:
            ip_bucket.popleft()
        if len(ip_bucket) >= _IP_LIMIT:
            return Response(
                content='{"detail":"Quá nhiều yêu cầu, vui lòng thử lại sau."}',
                status_code=429,
                media_type="application/json",
            )
        ip_bucket.append(now)

        # Per-user limits (authenticated users)
        user_id = _extract_user_id(request)
        if user_id:
            # 60 req/min per user across all AI paths
            u_bucket = self._user_buckets[user_id]
            while u_bucket and u_bucket[0] < now - _WINDOW:
                u_bucket.popleft()
            if len(u_bucket) >= _USER_LIMIT:
                return Response(
                    content='{"detail":"Vui lòng chờ một chút trước khi tiếp tục."}',
                    status_code=429,
                    media_type="application/json",
                )
            u_bucket.append(now)

            # Rapid-fire hint detection: >5 hint requests in 10s
            if request.url.path == "/hint":
                h_bucket = self._hint_buckets[user_id]
                while h_bucket and h_bucket[0] < now - _HINT_RAPID_WINDOW:
                    h_bucket.popleft()
                if len(h_bucket) >= _HINT_RAPID_LIMIT:
                    return Response(
                        content='{"detail":"Vui lòng chờ trước khi yêu cầu gợi ý tiếp theo."}',
                        status_code=429,
                        media_type="application/json",
                    )
                h_bucket.append(now)

        return await call_next(request)

import time
from collections import defaultdict, deque
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

_AI_PATHS = {
    "/analyze", "/hint", "/study-plan", "/explain",
    "/chat", "/compress", "/math-solve", "/math-review", "/math-ingest", "/math-upload",
    "/study-plan-quiz",
}
_WINDOW = 60        # seconds (AI paths)
_IP_LIMIT = 20      # requests per window per IP (AI paths)
_USER_LIMIT = 60    # requests per minute per authenticated user (AI paths)
_HINT_RAPID_WINDOW = 10   # seconds
_HINT_RAPID_LIMIT = 5     # max hint requests per user in rapid window

_ADMIN_PATHS_PREFIX = "/admin"
_ADMIN_IP_LIMIT = 10       # 10 requests/min per IP to any /admin/* path
_ADMIN_FAIL_LIMIT = 5      # block IP after 5 failed key attempts
_ADMIN_FAIL_WINDOW = 900   # 15-minute lockout window

# Per-path rate limits for auth endpoints (IP-based, independent windows)
_AUTH_PATH_LIMITS: dict[str, tuple[int, int]] = {
    "/auth/google":                   (10, 60),
    "/auth/email/register":           (5,  3600),
    "/auth/email/login":              (10, 600),
    "/auth/email/forgot-password":    (5,  3600),
    "/auth/email/resend-verify":      (5,  3600),
    "/auth/email/reset-password":     (5,  3600),
}

_CSRF_EXEMPT_PREFIXES = ("/auth/", "/api/refresh", "/api/logout")
_CSRF_MUTATION_METHODS = {"POST", "PUT", "DELETE", "PATCH"}


def _extract_user_id(request: Request) -> str | None:
    """Decode JWT from cookie or Authorization header to get user_id (no DB lookup)."""
    token = request.cookies.get("__Host-auth_token")
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth[7:]
    if not token:
        return None
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
        self._admin_ip_buckets: dict[str, deque] = defaultdict(deque)
        self._admin_fail_counts: dict[str, list] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()

        # CSRF check — required on mutation requests authenticated via cookie
        # (custom header CSRF defense: any cross-origin request with a custom header
        #  must pass a CORS preflight, so a third-party page cannot forge this)
        path = request.url.path
        if (request.method in _CSRF_MUTATION_METHODS
                and not any(path.startswith(p) for p in _CSRF_EXEMPT_PREFIXES)
                and request.cookies.get("__Host-auth_token")):
            if not request.headers.get("X-CSRF-Token"):
                return Response('{"detail":"csrf_token_missing"}', status_code=403, media_type="application/json")

        # Admin endpoints — tight IP rate limit + failed-attempt lockout
        if request.url.path.startswith(_ADMIN_PATHS_PREFIX):
            # IP rate limit
            ab = self._admin_ip_buckets[ip]
            while ab and ab[0] < now - _WINDOW:
                ab.popleft()
            if len(ab) >= _ADMIN_IP_LIMIT:
                return Response('{"detail":"Too many requests"}', status_code=429, media_type="application/json")
            ab.append(now)
            # Failed-attempt lockout
            self._admin_fail_counts[ip] = [t for t in self._admin_fail_counts[ip] if t > now - _ADMIN_FAIL_WINDOW]
            if len(self._admin_fail_counts[ip]) >= _ADMIN_FAIL_LIMIT:
                return Response('{"detail":"Too many requests"}', status_code=429, media_type="application/json")
            # Call next and record failure if key was bad
            response = await call_next(request)
            if getattr(request.state, "admin_key_failed", False):
                self._admin_fail_counts[ip].append(now)
            return response

        # Auth endpoints — per-path IP rate limits
        if path in _AUTH_PATH_LIMITS:
            limit, window = _AUTH_PATH_LIMITS[path]
            bucket_key = f"{ip}:{path}"
            bucket = self._auth_buckets[bucket_key]
            while bucket and bucket[0] < now - window:
                bucket.popleft()
            if len(bucket) >= limit:
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

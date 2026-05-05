import time
from collections import defaultdict, deque
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

_AI_PATHS = {"/analyze", "/hint", "/tutor", "/study-plan"}
_WINDOW = 60  # seconds
_LIMIT = 20   # requests per window per IP


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._buckets: dict[str, deque] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        if request.url.path not in _AI_PATHS:
            return await call_next(request)

        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        bucket = self._buckets[ip]

        while bucket and bucket[0] < now - _WINDOW:
            bucket.popleft()

        if len(bucket) >= _LIMIT:
            return Response(
                content='{"detail":"Quá nhiều yêu cầu, vui lòng thử lại sau."}',
                status_code=429,
                media_type="application/json",
            )

        bucket.append(now)
        return await call_next(request)

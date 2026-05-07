import asyncio
import itertools
import logging
import random
import httpx

logger = logging.getLogger(__name__)

# Rotate through realistic browser User-Agent strings so requests look organic.
_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]
_ua_cycle = itertools.cycle(_USER_AGENTS)

_BASE_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
}

# Serial fetching (1 in-flight request) + generous gap — avoids triggering
# per-IP rate limiting on AoPS and Paul's Online Math Notes.
_CONCURRENCY = 1
_MIN_DELAY = 2.0   # seconds between requests
_MAX_DELAY = 4.0   # upper bound of random jitter window

# Codes that warrant a retry with backoff (server-side transient errors).
_RETRYABLE_CODES = frozenset({429, 500, 502, 503, 504})

# Max retry attempts per URL.
_MAX_ATTEMPTS = 5

# Lazy semaphore — created on first use inside a running event loop.
_semaphore: asyncio.Semaphore | None = None

# Shared client — single connection pool for the lifetime of the crawl run.
_client: httpx.AsyncClient | None = None


def _next_headers() -> dict[str, str]:
    return {**_BASE_HEADERS, "User-Agent": next(_ua_cycle)}


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            headers=_next_headers(),
            timeout=30,
            follow_redirects=True,
            limits=httpx.Limits(
                max_connections=_CONCURRENCY,
                max_keepalive_connections=_CONCURRENCY,
            ),
        )
    return _client


def safe_text(resp: httpx.Response) -> str:
    """Decode response body, replacing un-decodable bytes instead of raising."""
    encoding = resp.encoding or "utf-8"
    return resp.content.decode(encoding, errors="replace")


def safe_json(resp: httpx.Response) -> object:
    """Parse JSON from response without raising on encoding errors."""
    import json
    return json.loads(safe_text(resp))


async def close_client() -> None:
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
    _client = None


def _get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(_CONCURRENCY)
    return _semaphore


async def fetch_with_retry(
    url: str,
    params: dict | None = None,
    max_attempts: int = _MAX_ATTEMPTS,
) -> httpx.Response:
    """GET with exponential backoff + jitter on transient 5xx/429.

    Rotates the User-Agent on each request.  Honours Retry-After when
    present; otherwise uses full-jitter exponential back-off:
        delay = uniform(0, min(cap, base * 2**attempt))
    with cap=60 s and base=2 s.
    """
    sem = _get_semaphore()
    client = get_client()
    async with sem:
        resp: httpx.Response | None = None
        for attempt in range(max_attempts):
            headers = _next_headers()
            try:
                resp = await client.get(url, params=params, headers=headers)
            except (httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError) as exc:
                # Network-level failure — back off and retry.
                wait = random.uniform(2.0, min(60.0, 2.0 * (2 ** attempt)))
                logger.warning(
                    "Network error on attempt %d/%d for %s: %s — retrying in %.1fs",
                    attempt + 1, max_attempts, url, exc, wait,
                )
                await asyncio.sleep(wait)
                continue

            if resp.status_code in _RETRYABLE_CODES:
                retry_after_raw = resp.headers.get("retry-after")
                if retry_after_raw and retry_after_raw.isdigit():
                    wait = float(retry_after_raw)
                else:
                    # Full-jitter: uniform(0, cap) where cap grows with each attempt.
                    cap = min(60.0, 2.0 * (2 ** attempt))
                    wait = random.uniform(cap / 2, cap)
                logger.warning(
                    "HTTP %d on attempt %d/%d for %s — retrying in %.1fs",
                    resp.status_code, attempt + 1, max_attempts, url, wait,
                )
                await asyncio.sleep(wait)
                continue

            resp.raise_for_status()
            # Politeness delay with jitter so the inter-request gap looks natural.
            await asyncio.sleep(random.uniform(_MIN_DELAY, _MAX_DELAY))
            return resp

        # All attempts exhausted.
        assert resp is not None
        resp.raise_for_status()

import asyncio
import httpx

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; MathWikiCrawler/1.0; +https://github.com/your-repo)"
}

# Politeness: max 2 concurrent requests; 0.4 s gap between each request.
_CONCURRENCY = 2
_INTER_REQUEST_DELAY = 0.4  # seconds

# Lazy semaphore — created on first use inside a running event loop.
_semaphore: asyncio.Semaphore | None = None

# Shared client — single connection pool for the lifetime of the crawl run.
# Callers must call get_client() / close_client() around their work.
_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            headers=HEADERS,
            timeout=25,
            follow_redirects=True,
            limits=httpx.Limits(max_connections=_CONCURRENCY, max_keepalive_connections=_CONCURRENCY),
        )
    return _client


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


async def fetch_with_retry(url: str, params: dict | None = None, max_attempts: int = 3) -> httpx.Response:
    """GET with exponential backoff on 429/503/500. Respects Retry-After header."""
    sem = _get_semaphore()
    client = get_client()
    async with sem:
        resp: httpx.Response | None = None
        for attempt in range(max_attempts):
            resp = await client.get(url, params=params)
            if resp.status_code in (429, 500, 503):
                retry_after = float(resp.headers.get("retry-after", 2 ** attempt))
                await asyncio.sleep(retry_after)
                continue
            resp.raise_for_status()
            await asyncio.sleep(_INTER_REQUEST_DELAY)
            return resp
        # All attempts hit a retryable status — raise on the last response.
        assert resp is not None
        resp.raise_for_status()

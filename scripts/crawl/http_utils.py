import asyncio
import httpx

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; MathWikiCrawler/1.0; +https://github.com/your-repo)"
}

SEMAPHORE = asyncio.Semaphore(2)


async def fetch_with_retry(url: str, params: dict = None, max_attempts: int = 3) -> httpx.Response:
    """GET with exponential backoff on 429/503. Raises httpx.HTTPStatusError on final failure."""
    async with SEMAPHORE:
        async with httpx.AsyncClient(headers=HEADERS, timeout=20) as client:
            for attempt in range(max_attempts):
                resp = await client.get(url, params=params)
                if resp.status_code in (429, 503):
                    await asyncio.sleep(2 ** attempt)
                    continue
                resp.raise_for_status()
                return resp
            resp.raise_for_status()

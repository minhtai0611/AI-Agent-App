import logging
import httpx
from crawl.http_utils import fetch_with_retry

logger = logging.getLogger(__name__)

_SEARCH_URL = "https://artofproblemsolving.com/wiki/api.php"
_PARSE_URL  = "https://artofproblemsolving.com/wiki/api.php"
_BASE_URL   = "https://artofproblemsolving.com/wiki/index.php/"


async def fetch_aops(
    queries: list[str],
    seen: set[str],
    results_per_query: int = 3,
) -> tuple[list[tuple[str, str]], int]:
    """Returns ([(page_url, html), ...], skipped_count) for AoPS pages matching the queries."""
    seen_pageids: set[int] = set()
    titles_to_fetch: list[tuple[str, str]] = []
    skipped = 0

    for query in queries:
        try:
            resp = await fetch_with_retry(
                _SEARCH_URL,
                params={
                    "action": "query",
                    "list": "search",
                    "srsearch": query,
                    "srlimit": results_per_query,
                    "format": "json",
                },
            )
            data = resp.json()
            for item in data.get("query", {}).get("search", []):
                pageid = item["pageid"]
                title = item["title"]
                if pageid in seen_pageids:
                    continue
                seen_pageids.add(pageid)
                canonical_url = _BASE_URL + title.replace(" ", "_")
                if canonical_url in seen:
                    skipped += 1
                else:
                    titles_to_fetch.append((canonical_url, title))
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            logger.warning("AoPS search failed for %r: %s", query, exc)

    results: list[tuple[str, str]] = []
    for canonical_url, title in titles_to_fetch:
        try:
            resp = await fetch_with_retry(
                _PARSE_URL,
                params={
                    "action": "parse",
                    "page": title,
                    "prop": "text",
                    "format": "json",
                    "redirects": "1",
                },
            )
            html = resp.json().get("parse", {}).get("text", {}).get("*", "")
            if html:
                results.append((canonical_url, html))
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            logger.warning("AoPS fetch failed for %r: %s", title, exc)

    return results, skipped

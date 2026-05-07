import logging
import httpx
from crawl.http_utils import fetch_with_retry, safe_json

logger = logging.getLogger(__name__)

_API_URL  = "https://artofproblemsolving.com/wiki/api.php"
_BASE_URL = "https://artofproblemsolving.com/wiki/index.php/"

# Pages that are navigation/index stubs — not worth ingesting.
_SKIP_TITLE_PREFIXES = (
    "Category:", "Talk:", "User:", "AoPS Wiki:", "Help:", "File:",
)
_SKIP_TITLES = frozenset({
    "Combinatorics", "Combinatorics/Introduction", "Combinatorics/Intermediate",
    "Combinatorics/Olympiad", "Number theory", "Geometry",
    "Statistical mechanics", "Discrete mathematics", "Discrete quantity",
})


async def _fetch_category_titles(category: str, seen_pageids: set[int]) -> list[tuple[str, str]]:
    """Return (canonical_url, title) for all pages in an AoPS category."""
    titles: list[tuple[str, str]] = []
    params: dict = {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": f"Category:{category}",
        "cmlimit": "100",
        "cmtype": "page",
        "format": "json",
    }
    while True:
        try:
            resp = await fetch_with_retry(_API_URL, params=params)
            data = safe_json(resp)
            for item in data.get("query", {}).get("categorymembers", []):
                title = item["title"]
                pageid = item["pageid"]
                if pageid in seen_pageids:
                    continue
                if any(title.startswith(p) for p in _SKIP_TITLE_PREFIXES):
                    continue
                if title in _SKIP_TITLES:
                    continue
                seen_pageids.add(pageid)
                titles.append((_BASE_URL + title.replace(" ", "_"), title))
            # Handle continuation
            cont = data.get("continue", {}).get("cmcontinue")
            if not cont:
                break
            params = {**params, "cmcontinue": cont}
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            logger.warning("AoPS category fetch failed for %r: %s", category, exc)
            break
    return titles


async def fetch_aops(
    queries: list[str],
    seen: set[str],
    results_per_query: int = 3,
    category: str | None = None,
) -> tuple[list[tuple[str, str]], int]:
    """Returns ([(page_url, html), ...], skipped_count).

    Discovers pages via keyword search (queries) and optionally via category listing.
    De-duplicates by pageid; skips URLs already in seen.
    """
    seen_pageids: set[int] = set()
    titles_to_fetch: list[tuple[str, str]] = []
    skipped = 0

    # --- keyword search ---
    for query in queries:
        try:
            resp = await fetch_with_retry(
                _API_URL,
                params={
                    "action": "query",
                    "list": "search",
                    "srsearch": query,
                    "srlimit": results_per_query,
                    "format": "json",
                },
            )
            data = safe_json(resp)
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

    # --- category listing (supplementary) ---
    if category:
        for canonical_url, title in await _fetch_category_titles(category, seen_pageids):
            if canonical_url in seen:
                skipped += 1
            else:
                titles_to_fetch.append((canonical_url, title))

    # --- fetch HTML for each discovered page ---
    results: list[tuple[str, str]] = []
    for canonical_url, title in titles_to_fetch:
        try:
            resp = await fetch_with_retry(
                _API_URL,
                params={
                    "action": "parse",
                    "page": title,
                    "prop": "text",
                    "format": "json",
                    "redirects": "1",
                },
            )
            html = safe_json(resp).get("parse", {}).get("text", {}).get("*", "")
            if html:
                results.append((canonical_url, html))
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            logger.warning("AoPS fetch failed for %r: %s", title, exc)

    return results, skipped

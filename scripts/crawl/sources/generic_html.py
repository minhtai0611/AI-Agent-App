import logging
import re
from urllib.parse import urljoin, urlparse
import httpx
from bs4 import BeautifulSoup
from crawl.http_utils import fetch_with_retry

logger = logging.getLogger(__name__)


async def fetch_generic_html(
    index_url: str,
    seen: set[str],
    link_pattern: str = r".*",
    max_pages: int = 150,
) -> tuple[list[tuple[str, str]], int]:
    """Fetch index_url, follow links matching link_pattern, return (pages, skipped_count).

    Discovered links are de-duplicated and fragments stripped before comparison.
    The index page itself is never returned as a content page.
    """
    try:
        index_resp = await fetch_with_retry(index_url)
    except (httpx.HTTPStatusError, httpx.RequestError) as exc:
        logger.warning("Generic index fetch failed for %r: %s", index_url, exc)
        return [], 0

    soup = BeautifulSoup(index_resp.text, "html.parser")
    pattern = re.compile(link_pattern)
    index_bare = index_url.split("#")[0]

    seen_urls: set[str] = set()
    discovered: list[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith("mailto:") or href.startswith("javascript:"):
            continue
        url = urljoin(index_url, href).split("#")[0]
        if url == index_bare or url in seen_urls:
            continue
        if pattern.search(url):
            seen_urls.add(url)
            discovered.append(url)

    discovered = discovered[:max_pages]
    logger.info("Generic source: found %d candidate pages from %s", len(discovered), index_url)

    results: list[tuple[str, str]] = []
    skipped = 0
    for url in discovered:
        if url in seen:
            skipped += 1
            continue
        try:
            page_resp = await fetch_with_retry(url)
            results.append((url, page_resp.text))
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            logger.warning("Generic page fetch failed for %r: %s", url, exc)

    return results, skipped

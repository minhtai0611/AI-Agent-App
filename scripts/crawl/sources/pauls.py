import logging
import re
from urllib.parse import urlparse
import httpx
from bs4 import BeautifulSoup
from crawl.http_utils import fetch_with_retry

logger = logging.getLogger(__name__)

_BASE = "https://tutorial.math.lamar.edu"


async def fetch_pauls(
    index_url: str | None,
    seen: set[str],
) -> tuple[list[tuple[str, str]], int]:
    """Scrapes index_url, then fetches each unseen section page. Returns (pages, skipped_count)."""
    if index_url is None:
        return [], 0

    try:
        resp = await fetch_with_retry(index_url)
    except (httpx.HTTPStatusError, httpx.RequestError) as exc:
        logger.warning("Paul's index fetch failed for %r: %s", index_url, exc)
        return [], 0

    soup = BeautifulSoup(resp.text, "html.parser")
    index_path = urlparse(index_url).path
    section_urls = [
        _BASE + a["href"]
        for a in soup.find_all("a", href=True)
        if re.match(r"/Classes/\w+/\w+\.aspx", a["href"])
        and a["href"] != index_path
    ]
    # deduplicate while preserving order
    dedup: set[str] = set()
    unique_sections: list[str] = []
    for url in section_urls:
        if url not in dedup:
            dedup.add(url)
            unique_sections.append(url)

    results: list[tuple[str, str]] = []
    skipped = 0
    for section_url in unique_sections:
        if section_url in seen:
            skipped += 1
            continue
        try:
            page_resp = await fetch_with_retry(section_url)
            results.append((section_url, page_resp.text))
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            logger.warning("Paul's section fetch failed for %r: %s", section_url, exc)

    return results, skipped

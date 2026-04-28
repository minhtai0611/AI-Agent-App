import asyncio
import json
import logging
import httpx
from openai import AsyncOpenAI

from crawl.topic_map import AOPS_QUERIES, PAULS_INDEX_URLS
from crawl.cleaner import html_to_chunks
from crawl.progress import load_seen, mark_seen, reset
from crawl.sources.aops import fetch_aops
from crawl.sources.pauls import fetch_pauls

logger = logging.getLogger(__name__)


async def fetch_gap_topics(api_base: str, limit: int) -> list[str]:
    """GET /math-gaps → top topic labels. Fallback: all 8 labels."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{api_base}/math-gaps")
            resp.raise_for_status()
            data = resp.json()
            labels = [
                item["topic"]
                for item in data
                if item.get("topic") in AOPS_QUERIES
            ][:limit]
            if labels:
                return labels
    except Exception as exc:
        logger.warning("Could not fetch /math-gaps: %s — using all topics", exc)
    return list(AOPS_QUERIES.keys())


async def crawl_and_ingest(
    client: AsyncOpenAI,
    topics: list[str],
    sources: list[str] = ("aops", "pauls"),
    dry_run: bool = False,
    reset_progress: bool = False,
) -> dict[str, int]:
    from app.math_wiki.agents.concept_ingest import concept_ingest

    if reset_progress:
        reset()

    seen = load_seen()
    stats = {
        "topics": len(topics),
        "pages_fetched": 0,
        "chunks_sent": 0,
        "wiki_units_added": 0,
        "skipped_seen": 0,
        "errors": 0,
    }

    for topic in topics:
        aops_pages: list[tuple[str, str]] = []
        pauls_pages: list[tuple[str, str]] = []

        if "aops" in sources:
            pages, skipped = await fetch_aops(AOPS_QUERIES.get(topic, []), seen)
            aops_pages = pages
            stats["skipped_seen"] += skipped
        if "pauls" in sources:
            pages, skipped = await fetch_pauls(PAULS_INDEX_URLS.get(topic), seen)
            pauls_pages = pages
            stats["skipped_seen"] += skipped

        all_pages = aops_pages + pauls_pages
        topic_units = 0

        for url, html in all_pages:
            chunks = html_to_chunks(html)
            stats["pages_fetched"] += 1
            for chunk in chunks:
                stats["chunks_sent"] += 1
                if not dry_run:
                    try:
                        out = await concept_ingest(client, chunk)
                        added = len(out.wiki_units)
                        stats["wiki_units_added"] += added
                        topic_units += added
                    except (ValueError, json.JSONDecodeError) as exc:
                        logger.warning("concept_ingest error: %s", exc)
                        stats["errors"] += 1
            if not dry_run:
                mark_seen(url)
                seen.add(url)

        print(
            f"[{topic}] AoPS: {len(aops_pages)} pages | Paul's: {len(pauls_pages)} pages"
            f" | units: {topic_units}"
        )

    return stats

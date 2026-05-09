import asyncio
import json
import logging
import httpx
from openai import AsyncOpenAI

from crawl.topic_map import AOPS_QUERIES, AOPS_CATEGORIES, PAULS_INDEX_URLS, GENERIC_HTML_SOURCES
from crawl.cleaner import html_to_chunks
from crawl.http_utils import close_client
from crawl.progress import load_seen, mark_seen, flush_seen, reset
from crawl.sources.aops import fetch_aops
from crawl.sources.pauls import fetch_pauls
from crawl.sources.generic_html import fetch_generic_html

logger = logging.getLogger(__name__)


async def fetch_gap_topics(api_base: str, limit: int) -> list[str]:
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
    sources: list[str] = ("aops", "pauls", "generic"),
    dry_run: bool = False,
    reset_progress: bool = False,
    pool=None,
) -> dict[str, int]:
    from app.math_wiki.agents.concept_ingest import concept_ingest

    if reset_progress:
        reset()

    seen = load_seen()
    stats = {
        "topics": len(topics),
        "pages_fetched": 0,
        "chunks_sent": 0,
        "wiki_units_added": 0,  # LLM output count; may overcount on re-crawl due to DB upserts
        "skipped_seen": 0,
        "errors": 0,
    }

    try:
        for topic in topics:
            # Collect (url, html, source_tag) tuples from all enabled sources
            all_pages: list[tuple[str, str, str]] = []

            if "aops" in sources:
                pages, skipped = await fetch_aops(
                    AOPS_QUERIES.get(topic, []),
                    seen,
                    category=AOPS_CATEGORIES.get(topic),
                )
                all_pages += [(url, html, "aops") for url, html in pages]
                stats["skipped_seen"] += skipped

            if "pauls" in sources:
                pages, skipped = await fetch_pauls(PAULS_INDEX_URLS.get(topic), seen)
                all_pages += [(url, html, "pauls") for url, html in pages]
                stats["skipped_seen"] += skipped

            if "generic" in sources:
                for source_cfg in GENERIC_HTML_SOURCES.get(topic, []):
                    pages, skipped = await fetch_generic_html(
                        index_url=source_cfg["index_url"],
                        seen=seen,
                        link_pattern=source_cfg["link_pattern"],
                        max_pages=source_cfg.get("max_pages", 150),
                        crawl_delay=source_cfg.get("crawl_delay_seconds", 0.0),
                    )
                    tag = source_cfg["source_tag"]
                    all_pages += [(url, html, tag) for url, html in pages]
                    stats["skipped_seen"] += skipped

            topic_units = 0

            for page_idx, (url, html, page_source) in enumerate(all_pages, 1):
                chunks = html_to_chunks(html, source=page_source)
                stats["pages_fetched"] += 1
                page_units = 0
                print(f"  [{topic}/{page_source}] page {page_idx}/{len(all_pages)}: {url[:80]}", flush=True)
                print(f"    chunks: {len(chunks)}", flush=True)
                for chunk in chunks:
                    stats["chunks_sent"] += 1
                    if not dry_run:
                        try:
                            out = await concept_ingest(client, chunk, pool=pool, source=page_source, source_url=url, fallback_topic=topic)
                            added = len(out.wiki_units)
                            stats["wiki_units_added"] += added
                            topic_units += added
                            page_units += added
                        except (ValueError, json.JSONDecodeError) as exc:
                            logger.warning("concept_ingest error: %s", exc)
                            stats["errors"] += 1
                if not dry_run:
                    mark_seen(url)
                    seen.add(url)
                    print(f"    → {page_units} units added (total: {stats['wiki_units_added']})", flush=True)

            if not dry_run:
                flush_seen()

            source_counts = {}
            for _, _, tag in all_pages:
                source_counts[tag] = source_counts.get(tag, 0) + 1
            counts_str = " | ".join(f"{tag}: {n}" for tag, n in source_counts.items())
            print(f"[{topic}] pages — {counts_str} | units: {topic_units}")

    finally:
        await close_client()

    return stats

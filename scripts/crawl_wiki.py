#!/usr/bin/env python3
"""Gap-driven web crawler: AoPS Wiki + Paul's Notes → math_wiki DB."""
import argparse
import asyncio
import sys
import os

# Ensure both the scripts/ dir (for crawl.*) and backend/ (for app.*) are on the path.
_SCRIPTS_DIR = os.path.dirname(__file__)
_BACKEND_DIR = os.path.join(os.path.dirname(_SCRIPTS_DIR), "backend")
for _p in (_SCRIPTS_DIR, _BACKEND_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from crawl.topic_map import AOPS_QUERIES
from crawl.runner import crawl_and_ingest, fetch_gap_topics


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Crawl AoPS Wiki and Paul's Notes, ingest into math_wiki DB."
    )
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument(
        "--gap-driven",
        action="store_true",
        help="Pull topics from /math-gaps on the running backend.",
    )
    source_group.add_argument(
        "--topics",
        metavar="TOPICS",
        help='Comma-separated topic labels, or "all".',
    )
    parser.add_argument(
        "--sources",
        default="aops,pauls,generic",
        help='Comma-separated sources: "aops", "pauls", "generic" (default: aops,pauls,generic).',
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Max topics when --gap-driven (default: 5).",
    )
    parser.add_argument(
        "--api-base",
        default="http://localhost:8000",
        help="Backend URL for gap fetch (default: http://localhost:8000).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and chunk, but skip concept_ingest and progress writes.",
    )
    parser.add_argument(
        "--reset-progress",
        action="store_true",
        help="Clear crawl_progress.json before starting.",
    )
    return parser


async def _main(args: argparse.Namespace) -> int:
    from app.dependencies import get_ai_client

    prefix = "[DRY RUN] " if args.dry_run else ""
    sources = [s.strip() for s in args.sources.split(",")]

    if args.gap_driven:
        print(f"{prefix}Fetching gap topics from {args.api_base} …")
        topics = await fetch_gap_topics(args.api_base, args.limit)
    else:
        raw = args.topics
        if raw == "all":
            topics = list(AOPS_QUERIES.keys())
        else:
            topics = [t.strip() for t in raw.split(",")]

    unknown = [t for t in topics if t not in AOPS_QUERIES]
    if unknown:
        print(f"Unknown topics: {unknown}. Valid: {list(AOPS_QUERIES)}", file=sys.stderr)
        return 1

    print(f"{prefix}Topics: {topics}")
    print(f"{prefix}Sources: {sources}")

    client = get_ai_client()
    stats = await crawl_and_ingest(
        client,
        topics=topics,
        sources=sources,
        dry_run=args.dry_run,
        reset_progress=args.reset_progress,
    )

    print(
        f"\n{prefix}Done.\n"
        f"  Topics crawled  : {stats['topics']}\n"
        f"  Pages fetched   : {stats['pages_fetched']}\n"
        f"  Chunks sent     : {stats['chunks_sent']}\n"
        f"  Wiki units added: {stats['wiki_units_added']}\n"
        f"  Pages skipped   : {stats['skipped_seen']} (already seen)\n"
        f"  Errors          : {stats['errors']}"
    )
    return 0


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()
    sys.exit(asyncio.run(_main(args)))


if __name__ == "__main__":
    main()

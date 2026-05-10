"""Async PostgreSQL sanitizer: fix non-canonical labels and remove duplicate wiki units."""
import hashlib
import logging
from datetime import datetime

from app.math_wiki.taxonomy import CANONICAL_TOPICS, CANONICAL_TYPES, TOPIC_MAP, TYPE_MAP

logger = logging.getLogger(__name__)


async def fix_topic_slugs(pool, dry_run: bool = False) -> dict:
    """Remap non-canonical topic slugs to canonical ones; soft-delete unmappable units."""
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT id, topic FROM wiki_units WHERE deleted = false")

    updates: list[tuple[str, str]] = []  # (new_topic, id)
    deletes: list[str] = []

    for row in rows:
        topic = row["topic"]
        if topic in CANONICAL_TOPICS:
            continue
        canonical = TOPIC_MAP.get(topic)
        if canonical:
            updates.append((canonical, row["id"]))
        else:
            deletes.append(row["id"])

    logger.info(
        "fix_topic_slugs: %d remaps, %d soft-deletes%s",
        len(updates), len(deletes), " (dry_run)" if dry_run else "",
    )

    if not dry_run:
        now = datetime.now()
        async with pool.acquire() as conn:
            for new_topic, uid in updates:
                await conn.execute(
                    "UPDATE wiki_units SET topic=$1, updated_at=$2 WHERE id=$3",
                    new_topic, now, uid,
                )
            for uid in deletes:
                await conn.execute(
                    "UPDATE wiki_units SET deleted=true, updated_at=$1 WHERE id=$2",
                    now, uid,
                )

    return {"topic_remaps": len(updates), "topic_deletes": len(deletes), "dry_run": dry_run}


async def fix_unit_types(pool, dry_run: bool = False) -> dict:
    """Remap non-canonical type values; unknown types collapse to 'concept'."""
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT id, type FROM wiki_units WHERE deleted = false")

    updates: list[tuple[str, str]] = []  # (new_type, id)

    for row in rows:
        t = row["type"]
        if t in CANONICAL_TYPES:
            continue
        canonical = TYPE_MAP.get(t, "concept")
        updates.append((canonical, row["id"]))

    logger.info(
        "fix_unit_types: %d remaps%s",
        len(updates), " (dry_run)" if dry_run else "",
    )

    if not dry_run:
        now = datetime.now()
        async with pool.acquire() as conn:
            for new_type, uid in updates:
                await conn.execute(
                    "UPDATE wiki_units SET type=$1, updated_at=$2 WHERE id=$3",
                    new_type, now, uid,
                )

    return {"type_remaps": len(updates), "dry_run": dry_run}


async def dedup_wiki_units(pool, dry_run: bool = False) -> dict:
    """Soft-delete duplicate wiki units that share the same content hash.

    For each group of duplicates, the oldest unit (earliest created_at) is kept;
    all newer duplicates are soft-deleted.
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, content, created_at FROM wiki_units WHERE deleted = false ORDER BY created_at ASC"
        )

    seen: dict[str, str] = {}  # content_hash → first id (to keep)
    deletes: list[str] = []

    for row in rows:
        h = hashlib.md5(row["content"].encode()).hexdigest()
        if h in seen:
            deletes.append(row["id"])
        else:
            seen[h] = row["id"]

    logger.info(
        "dedup_wiki_units: %d duplicates found%s",
        len(deletes), " (dry_run)" if dry_run else "",
    )

    if not dry_run and deletes:
        now = datetime.now()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE wiki_units SET deleted=true, updated_at=$1 WHERE id = ANY($2)",
                now, deletes,
            )

    return {"duplicates_removed": len(deletes), "dry_run": dry_run}


async def run_all(pool, dry_run: bool = False) -> dict:
    """Run all sanitization steps and return a combined report."""
    topic_result = await fix_topic_slugs(pool, dry_run=dry_run)
    type_result = await fix_unit_types(pool, dry_run=dry_run)
    dedup_result = await dedup_wiki_units(pool, dry_run=dry_run)
    return {**topic_result, **type_result, **dedup_result}

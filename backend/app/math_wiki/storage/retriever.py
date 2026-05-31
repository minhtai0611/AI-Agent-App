"""Retrieval layer: vector search + concept-graph prerequisite expansion."""
from __future__ import annotations
import logging
from app.math_wiki.storage.pg_vectors import query_pgvector

logger = logging.getLogger(__name__)


async def vector_retrieve(pool, query: str, top_k: int = 15) -> list[str]:
    if pool is None:
        return []
    return await query_pgvector(pool, query, top_k=top_k)


async def retrieve_with_prerequisites(
    pool,
    query: str,
    topic: str | None = None,
    top_k: int = 15,
    bloom_min: int = 0,
) -> list[str]:
    """Retrieve wiki unit IDs for a query, then expand with prerequisite concept units.

    Args:
        pool:       DB connection pool.
        query:      The search query string.
        topic:      Detected topic label (used for graph-based prerequisite expansion).
        top_k:      Number of units to retrieve by vector similarity.
        bloom_min:  Minimum Bloom's level to include (0 = all).

    Returns:
        Ordered list of wiki unit IDs (primary results first, prerequisite expansions appended).
    """
    if pool is None:
        return []

    primary_ids = await query_pgvector(pool, query, top_k=top_k)

    # Expand with prerequisite concept units when topic is provided
    prereq_ids: list[str] = []
    if topic:
        try:
            from app.math_wiki.graph import topic_to_concepts, get_prerequisites
            concept_ids = topic_to_concepts(topic)
            all_prereq_concepts: set[str] = set()
            for cid in concept_ids:
                for pre in get_prerequisites(cid, depth=1):
                    all_prereq_concepts.add(pre)
            if all_prereq_concepts:
                prereq_ids = await _fetch_units_for_concepts(pool, list(all_prereq_concepts), top_k=5)
        except Exception as exc:
            logger.debug("Prerequisite expansion failed (non-fatal): %s", exc)

    # Merge: primary first, then unique prerequisite additions
    seen = set(primary_ids)
    result = list(primary_ids)
    for uid in prereq_ids:
        if uid not in seen:
            seen.add(uid)
            result.append(uid)

    # Optional Bloom's level filter
    if bloom_min > 0:
        result = await _filter_by_bloom(pool, result, bloom_min)

    return result


async def _fetch_units_for_concepts(pool, concept_ids: list[str], top_k: int = 5) -> list[str]:
    """Fetch wiki unit IDs whose subtopic matches any of the given concept ids."""
    if not concept_ids or pool is None:
        return []
    try:
        placeholders = ",".join(f"${i+1}" for i in range(len(concept_ids)))
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                f"SELECT id FROM wiki_units WHERE deleted = 0 AND subtopic IN ({placeholders}) LIMIT {top_k}",
                *concept_ids,
            )
        return [row["id"] for row in rows]
    except Exception as exc:
        logger.debug("_fetch_units_for_concepts failed: %s", exc)
        return []


async def _filter_by_bloom(pool, unit_ids: list[str], bloom_min: int) -> list[str]:
    """Return only those unit_ids whose bloom_level >= bloom_min."""
    if not unit_ids or pool is None:
        return unit_ids
    try:
        placeholders = ",".join(f"${i+1}" for i in range(len(unit_ids)))
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                f"SELECT id FROM wiki_units WHERE id IN ({placeholders}) AND bloom_level >= ${len(unit_ids)+1}",
                *unit_ids, bloom_min,
            )
        kept = {row["id"] for row in rows}
        return [uid for uid in unit_ids if uid in kept]
    except Exception as exc:
        logger.debug("_filter_by_bloom failed: %s", exc)
        return unit_ids

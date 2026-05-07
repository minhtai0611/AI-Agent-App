import asyncio
import logging

logger = logging.getLogger(__name__)


async def query_pgvector(pool, query_text: str, top_k: int = 10, min_score: float = 0.55) -> list[str]:
    from app.math_wiki.storage.vectors import embed_texts
    loop = asyncio.get_event_loop()
    vecs = await loop.run_in_executor(None, embed_texts, [query_text], "query")
    query_vec = vecs[0]

    max_dist = 1.0 - min_score
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, embedding <=> $1 AS dist
               FROM wiki_units
               WHERE deleted = false AND embedding IS NOT NULL
               ORDER BY embedding <=> $1
               LIMIT $2""",
            query_vec,
            top_k,
        )
    return [r["id"] for r in rows if r["dist"] <= max_dist]


async def is_near_duplicate_pg(pool, text: str, threshold: float = 0.92) -> bool:
    from app.math_wiki.storage.vectors import embed_texts
    loop = asyncio.get_event_loop()
    vecs = await loop.run_in_executor(None, embed_texts, [text], "passage")
    query_vec = vecs[0]

    max_dist = 1.0 - threshold
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT embedding <=> $1 AS dist
               FROM wiki_units
               WHERE deleted = false AND embedding IS NOT NULL
               ORDER BY embedding <=> $1
               LIMIT 1""",
            query_vec,
        )
    if row is None:
        return False
    return float(row["dist"]) <= max_dist

"""Vector similarity search backed by SQLite + numpy (replaces pgvector/HNSW).

Embeddings are stored as JSON arrays in the `embedding` TEXT column.
Similarity is computed in-process with numpy cosine similarity — fast enough
for the expected dataset size (hundreds to a few thousand wiki units).
"""
import asyncio
import json
import logging

import numpy as np

logger = logging.getLogger(__name__)


async def query_pgvector(pool, query_text: str, top_k: int = 10, min_score: float = 0.55) -> list[str]:
    from app.math_wiki.storage.vectors import embed_texts

    loop = asyncio.get_event_loop()
    vecs = await loop.run_in_executor(None, embed_texts, [query_text], "query")
    query_vec = np.array(vecs[0], dtype=np.float32)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, embedding FROM wiki_units WHERE deleted = 0 AND embedding IS NOT NULL"
        )

    if not rows:
        return []

    ids = [r["id"] for r in rows]
    embeddings = np.array(
        [json.loads(r["embedding"]) for r in rows], dtype=np.float32
    )

    q_norm = query_vec / (np.linalg.norm(query_vec) + 1e-10)
    e_norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    scores = (embeddings / (e_norms + 1e-10)) @ q_norm

    mask = scores >= min_score
    filtered = [(ids[i], float(scores[i])) for i in range(len(ids)) if mask[i]]
    filtered.sort(key=lambda x: x[1], reverse=True)
    return [fid for fid, _ in filtered[:top_k]]


async def is_near_duplicate_pg(pool, text: str, threshold: float = 0.92) -> bool:
    from app.math_wiki.storage.vectors import embed_texts

    loop = asyncio.get_event_loop()
    vecs = await loop.run_in_executor(None, embed_texts, [text], "passage")
    query_vec = np.array(vecs[0], dtype=np.float32)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT embedding FROM wiki_units WHERE deleted = 0 AND embedding IS NOT NULL"
        )

    if not rows:
        return False

    embeddings = np.array(
        [json.loads(r["embedding"]) for r in rows], dtype=np.float32
    )
    q_norm = query_vec / (np.linalg.norm(query_vec) + 1e-10)
    e_norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    scores = (embeddings / (e_norms + 1e-10)) @ q_norm
    return float(np.max(scores)) >= threshold

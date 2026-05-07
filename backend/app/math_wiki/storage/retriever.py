from app.math_wiki.storage.pg_vectors import query_pgvector


async def vector_retrieve(pool, query: str, top_k: int = 15) -> list[str]:
    if pool is None:
        return []
    return await query_pgvector(pool, query, top_k=top_k)

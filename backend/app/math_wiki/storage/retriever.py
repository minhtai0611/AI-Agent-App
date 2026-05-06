from app.math_wiki.storage.vectors import VectorIndex, query_vector


def vector_retrieve(
    query: str,
    vector_index: VectorIndex | None,
    top_k: int = 15,
) -> list[str]:
    if vector_index is None:
        return []
    return query_vector(vector_index, query, top_k=top_k)

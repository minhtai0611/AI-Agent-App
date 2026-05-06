from rank_bm25 import BM25Okapi
from app.math_wiki.storage.bm25 import query_bm25
from app.math_wiki.storage.vectors import VectorIndex, query_vector


def hybrid_retrieve(
    query: str,
    bm25_index: BM25Okapi | None,
    bm25_id_map: list[str],
    vector_index: VectorIndex | None,
    top_k: int = 15,
) -> list[str]:
    bm25_ids = query_bm25(bm25_index, bm25_id_map, query, top_k=top_k)
    vec_ids = query_vector(vector_index, query, top_k=top_k) if vector_index is not None else []

    if not bm25_ids and not vec_ids:
        return []

    # Reciprocal Rank Fusion: score = Σ 1/(60 + rank)
    scores: dict[str, float] = {}
    for rank, uid in enumerate(bm25_ids):
        scores[uid] = scores.get(uid, 0.0) + 1.0 / (60 + rank)
    for rank, uid in enumerate(vec_ids):
        scores[uid] = scores.get(uid, 0.0) + 1.0 / (60 + rank)

    ranked = sorted(scores, key=lambda uid: scores[uid], reverse=True)
    return ranked[:top_k]

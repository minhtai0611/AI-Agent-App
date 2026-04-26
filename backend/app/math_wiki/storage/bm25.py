from rank_bm25 import BM25Okapi
from app.math_wiki.schemas import WikiUnit


def build_bm25_index(units: list[WikiUnit]) -> tuple[BM25Okapi | None, list[str]]:
    if not units:
        return None, []
    corpus = [u.content.split() for u in units]
    id_map = [u.id for u in units]
    return BM25Okapi(corpus), id_map


def query_bm25(
    index: BM25Okapi | None,
    id_map: list[str],
    query: str,
    top_k: int = 10,
) -> list[str]:
    if index is None or not id_map:
        return []
    tokens = query.split()
    scores = index.get_scores(tokens)
    ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    return [id_map[i] for i in ranked[:top_k] if scores[i] > 0]

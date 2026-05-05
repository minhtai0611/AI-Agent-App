import re
from rank_bm25 import BM25Okapi
from app.math_wiki.schemas import WikiUnit

# Split on whitespace and math/punctuation boundaries.
# Handles both Vietnamese multi-word terms (split at space) and math notation
# like "f(x)=2x+1" → ["f", "x", "2x", "1"].
_SPLIT_RE = re.compile(r'[\s.,;:()\[\]{}\-+*/=^|<>!?\\]+')


def _tokenize(text: str) -> list[str]:
    return [t for t in _SPLIT_RE.split(text.lower()) if len(t) > 1]


def build_bm25_index(units: list[WikiUnit]) -> tuple[BM25Okapi | None, list[str]]:
    if not units:
        return None, []
    corpus = [_tokenize(u.content) for u in units]
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
    tokens = _tokenize(query)
    scores = index.get_scores(tokens)
    ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    return [id_map[i] for i in ranked[:top_k] if scores[i] > 0]

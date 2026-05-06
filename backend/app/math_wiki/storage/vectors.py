from __future__ import annotations
import logging
from dataclasses import dataclass, field

import numpy as np

from app.math_wiki.schemas import WikiUnit
from app.config import get_settings

logger = logging.getLogger(__name__)

_local_model = None


def _get_local_model():
    global _local_model
    if _local_model is None:
        from FlagEmbedding import BGEM3FlagModel
        _local_model = BGEM3FlagModel(
            get_settings().embedding_model_name,
            use_fp16=False,  # CPU-only deployment; fp16 on CPU → NaN vectors
        )
    return _local_model


def embed_texts(texts: list[str], prefix: str = "passage") -> list[list[float]]:
    if not texts:
        return []
    model = _get_local_model()
    prefixed = [f"{prefix}: {t}" for t in texts]
    out = model.encode(prefixed, return_dense=True, return_sparse=False, return_colbert_vecs=False)
    return out["dense_vecs"].tolist()


@dataclass
class VectorIndex:
    index: object  # usearch.index.Index
    id_map: list[str] = field(default_factory=list)
    dim: int = 0


def build_vector_index(units: list[WikiUnit]) -> VectorIndex:
    from usearch.index import Index

    if not units:
        dummy = Index(ndim=1, metric="cos")
        return VectorIndex(index=dummy, id_map=[], dim=1)

    texts = [u.content for u in units]
    vecs = embed_texts(texts, prefix="passage")
    arr = np.array(vecs, dtype=np.float32)
    dim = arr.shape[1]
    idx = Index(ndim=dim, metric="cos")
    keys = np.arange(len(units), dtype=np.uint64)
    idx.add(keys, arr)
    return VectorIndex(index=idx, id_map=[u.id for u in units], dim=dim)


def query_vector(vi: VectorIndex, query: str, top_k: int = 10, min_score: float = 0.55) -> list[str]:
    if not vi.id_map:
        return []
    vecs = embed_texts([query], prefix="query")
    q = np.array(vecs[0], dtype=np.float32)
    k = min(top_k, len(vi.id_map))
    matches = vi.index.search(q, k)
    # usearch cosine metric stores 1 - cosine_similarity as distance.
    # Filter out results below min_score to avoid injecting irrelevant context.
    max_dist = 1.0 - min_score
    return [
        vi.id_map[int(key)]
        for key, dist in zip(matches.keys, matches.distances)
        if float(dist) <= max_dist
    ]

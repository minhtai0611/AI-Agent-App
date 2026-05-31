from __future__ import annotations
import logging

from app.config import get_settings

logger = logging.getLogger(__name__)

_local_model = None


_model_unavailable = False  # set True once after a failed import


def _get_local_model():
    global _local_model, _model_unavailable
    if _model_unavailable:
        return None
    if _local_model is None:
        try:
            from FlagEmbedding import BGEM3FlagModel
            _local_model = BGEM3FlagModel(
                get_settings().embedding_model_name,
                use_fp16=False,
            )
        except ImportError:
            logger.warning("FlagEmbedding not installed — vector search disabled, BM25-only mode")
            _model_unavailable = True
            return None
    return _local_model


def embed_texts(texts: list[str], prefix: str = "passage") -> list[list[float]]:
    if not texts:
        return []
    model = _get_local_model()
    if model is None:
        return []  # graceful fallback: no embeddings
    prefixed = [f"{prefix}: {t}" for t in texts]
    out = model.encode(prefixed, return_dense=True, return_sparse=False, return_colbert_vecs=False)
    return out["dense_vecs"].tolist()

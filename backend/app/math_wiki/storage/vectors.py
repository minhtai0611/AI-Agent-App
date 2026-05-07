from __future__ import annotations
import logging

from app.config import get_settings

logger = logging.getLogger(__name__)

_local_model = None


def _get_local_model():
    global _local_model
    if _local_model is None:
        from FlagEmbedding import BGEM3FlagModel
        _local_model = BGEM3FlagModel(
            get_settings().embedding_model_name,
            use_fp16=False,
        )
    return _local_model


def embed_texts(texts: list[str], prefix: str = "passage") -> list[list[float]]:
    if not texts:
        return []
    model = _get_local_model()
    prefixed = [f"{prefix}: {t}" for t in texts]
    out = model.encode(prefixed, return_dense=True, return_sparse=False, return_colbert_vecs=False)
    return out["dense_vecs"].tolist()

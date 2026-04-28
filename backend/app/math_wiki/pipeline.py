import asyncio
import hashlib
import logging
import os
import pickle
import threading
from openai import AsyncOpenAI
from app.math_wiki.storage.db import get_all_wiki_units, get_wiki_units_by_ids, count_wiki_units
from app.math_wiki.storage.bm25 import build_bm25_index, query_bm25
from app.math_wiki.storage.vectors import build_vector_index, VectorIndex
from app.math_wiki.storage.retriever import hybrid_retrieve
from app.math_wiki.agents.classifier import classify_problem
from app.math_wiki.agents.reranker import rerank
from app.math_wiki.agents.solver import solve
from app.math_wiki.agents.validator import validate
from app.config import get_settings

logger = logging.getLogger(__name__)

# Indexes built once at module level on first use
_bm25_index = None
_bm25_id_map: list[str] = []
_vector_index: VectorIndex | None = None
_index_lock = threading.Lock()

# Background enrichment: cooldown set (in-memory, per session) + semaphore
_ENRICH_COOLDOWN: set[str] = set()
_ENRICH_COOLDOWN_MAX = 500
_enrich_semaphore: asyncio.Semaphore | None = None


def _get_enrich_semaphore() -> asyncio.Semaphore:
    global _enrich_semaphore
    if _enrich_semaphore is None:
        _enrich_semaphore = asyncio.Semaphore(2)
    return _enrich_semaphore


async def _background_enrich(client: AsyncOpenAI, question: str) -> None:
    from app.math_wiki.agents.auto_enricher import auto_enrich
    key = hashlib.md5(question.encode()).hexdigest()
    if key in _ENRICH_COOLDOWN:
        logger.info("Enrichment skipped (cooldown): %s", question[:60])
        return
    if len(_ENRICH_COOLDOWN) >= _ENRICH_COOLDOWN_MAX:
        _ENRICH_COOLDOWN.clear()
    _ENRICH_COOLDOWN.add(key)
    async with _get_enrich_semaphore():
        try:
            new_count, subtopics, new_units = await asyncio.wait_for(
                auto_enrich(client, question), timeout=30
            )
            if new_units:
                await asyncio.get_event_loop().run_in_executor(None, _append_to_indexes, new_units)
            logger.info("Auto-enriched %d new unit(s) for: %s", new_count, question[:60])
        except Exception as exc:
            logger.warning("Background enrichment failed: %s", exc)


def _cache_paths() -> tuple[str, str, str]:
    db_path = get_settings().math_wiki_db_path
    base = os.path.splitext(db_path)[0]
    return base + ".bm25.pkl", base + ".faiss", base + ".meta.pkl"


def _load_cached_indexes() -> bool:
    """Return True if valid cached indexes were loaded."""
    global _bm25_index, _bm25_id_map, _vector_index
    bm25_path, faiss_path, meta_path = _cache_paths()
    if not all(os.path.exists(p) for p in (bm25_path, faiss_path, meta_path)):
        return False
    try:
        import faiss
        with open(meta_path, "rb") as f:
            meta = pickle.load(f)
        if meta.get("unit_count") != count_wiki_units():
            return False  # DB changed — rebuild
        with open(bm25_path, "rb") as f:
            bm25_data = pickle.load(f)
        _bm25_index = bm25_data["index"]
        _bm25_id_map = bm25_data["id_map"]
        raw = faiss.read_index(faiss_path)
        _vector_index = VectorIndex(index=raw, id_map=meta["vector_id_map"], dim=meta["dim"])
        logger.info("Loaded cached indexes (%d units)", meta["unit_count"])
        return True
    except Exception as exc:
        logger.warning("Cache load failed (%s), rebuilding", exc)
        return False


def _save_cached_indexes(unit_count: int) -> None:
    bm25_path, faiss_path, meta_path = _cache_paths()
    try:
        import faiss
        with open(bm25_path, "wb") as f:
            pickle.dump({"index": _bm25_index, "id_map": _bm25_id_map}, f)
        faiss.write_index(_vector_index.index, faiss_path)
        with open(meta_path, "wb") as f:
            pickle.dump({
                "unit_count": unit_count,
                "vector_id_map": _vector_index.id_map,
                "dim": _vector_index.dim,
            }, f)
        logger.info("Cached indexes saved (%d units)", unit_count)
    except Exception as exc:
        logger.warning("Cache save failed: %s", exc)


def _ensure_indexes() -> None:
    global _bm25_index, _bm25_id_map, _vector_index
    if _vector_index is not None:
        return
    with _index_lock:
        if _vector_index is not None:
            return
        if _load_cached_indexes():
            return
        units = get_all_wiki_units()
        _bm25_index, _bm25_id_map = build_bm25_index(units)
        _vector_index = build_vector_index(units)
        logger.info("Indexes built from scratch: %d units", len(units))
        _save_cached_indexes(len(units))


def _append_to_indexes(new_units: list) -> None:
    """Append new units to the live FAISS index. Thread-safe.
    BM25 is NOT rebuilt here — new units are still found by vector search.
    The full cache (including updated BM25) is written in a background thread.
    """
    global _vector_index
    if not new_units:
        return
    import numpy as np
    from app.math_wiki.storage.vectors import embed_texts
    texts = [u.content for u in new_units]
    new_vecs = embed_texts(texts)
    arr = np.array(new_vecs, dtype=np.float32)
    with _index_lock:
        if _vector_index is not None and _vector_index.id_map:
            _vector_index.index.add(arr)
            _vector_index.id_map.extend([u.id for u in new_units])
    # Persist updated cache in background so next server restart is fast
    unit_count = len(_vector_index.id_map) if _vector_index else 0
    threading.Thread(
        target=_save_cached_indexes, args=(unit_count,), daemon=True
    ).start()


async def _retrieve_rerank_context(client: AsyncOpenAI, question: str):
    """Shared retrieval+rerank step used by both the main path and the retry."""
    retrieved_ids = hybrid_retrieve(question, _bm25_index, _bm25_id_map, _vector_index)
    candidates = get_wiki_units_by_ids(retrieved_ids)
    if candidates:
        try:
            top_ids = await rerank(client, question, candidates)
        except Exception as exc:
            logger.warning("Reranker failed (%s), using raw retrieval order", exc)
            top_ids = []
    else:
        top_ids = []
    context = get_wiki_units_by_ids(top_ids) if top_ids else candidates
    return retrieved_ids, context


async def run_pipeline(client: AsyncOpenAI, question: str) -> dict:
    await asyncio.get_event_loop().run_in_executor(None, _ensure_indexes)

    label = await classify_problem(client, question)
    logger.debug("Classified as: %s", label)

    retrieved_ids, context = await _retrieve_rerank_context(client, question)
    logger.debug("Retrieved %d units: %s", len(retrieved_ids), retrieved_ids)

    if not context:
        asyncio.create_task(_background_enrich(client, question))

    solver_output = await solve(client, question, context)
    logger.debug("Solver confidence: %s", solver_output.confidence)

    validation = await validate(client, solver_output, context)
    logger.debug("Validation: valid=%s issues=%s", validation.valid, validation.issues)

    return {
        "label": label,
        "answer": solver_output.model_dump(),
        "validation": validation.model_dump(),
        "retrieved_ids": retrieved_ids,
        "wiki_assisted": bool(context),
    }

import asyncio
import hashlib
import logging
import os
import pickle
import threading
from openai import AsyncOpenAI
from app.math_wiki.storage.db import get_all_wiki_units, get_wiki_units_by_ids, count_wiki_units, get_cached_figure, upsert_problem
from app.math_wiki.storage.analytics import log_solution
from app.metrics import record_validation, inc_bm25_rebuild
from app.math_wiki.storage.bm25 import build_bm25_index, query_bm25
from app.math_wiki.storage.vectors import build_vector_index, VectorIndex
from app.math_wiki.storage.retriever import hybrid_retrieve
from app.math_wiki.agents.classifier import classify_problem
from app.math_wiki.agents.reranker import rerank
from app.math_wiki.agents.solver import solve
from app.math_wiki.agents.validator import validate
from app.math_wiki.schemas import ValidationResult, FigureOutput, Problem
from app.math_wiki.figures import generate_figure
from app.config import get_settings

logger = logging.getLogger(__name__)

# Indexes built once at module level on first use
_bm25_index = None
_bm25_id_map: list[str] = []
_vector_index: VectorIndex | None = None
_index_lock = threading.Lock()

_wiki_status: dict = {"phase": "starting", "progress": 0, "error": None}


def get_wiki_status() -> dict:
    return dict(_wiki_status)


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
        if meta.get("embedding_model") != get_settings().embedding_model_name:
            return False  # model changed — rebuild
        if meta.get("dim") != get_settings().embedding_dim:
            return False  # dim mismatch — rebuild
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
                "embedding_model": get_settings().embedding_model_name,
            }, f)
        logger.info("Cached indexes saved (%d units)", unit_count)
    except Exception as exc:
        logger.warning("Cache save failed: %s", exc)


def _ensure_indexes() -> None:
    global _bm25_index, _bm25_id_map, _vector_index
    if _vector_index is not None:
        _wiki_status.update({"phase": "ready", "progress": 100, "error": None})
        return
    try:
        with _index_lock:
            if _vector_index is not None:
                _wiki_status.update({"phase": "ready", "progress": 100, "error": None})
                return
            _wiki_status.update({"phase": "checking_cache", "progress": 15, "error": None})
            if _load_cached_indexes():
                _wiki_status.update({"phase": "ready", "progress": 100, "error": None})
                return
            _wiki_status.update({"phase": "loading_units", "progress": 30, "error": None})
            units = get_all_wiki_units()
            _wiki_status.update({"phase": "building_bm25", "progress": 50, "error": None})
            _bm25_index, _bm25_id_map = build_bm25_index(units)
            _wiki_status.update({"phase": "building_vectors", "progress": 75, "error": None})
            _vector_index = build_vector_index(units)
            _wiki_status.update({"phase": "saving", "progress": 92, "error": None})
            logger.info("Indexes built from scratch: %d units", len(units))
            _save_cached_indexes(len(units))
            _wiki_status.update({"phase": "ready", "progress": 100, "error": None})
    except Exception as exc:
        _wiki_status.update({"phase": "failed", "progress": 0, "error": str(exc)})


def _append_to_indexes(new_units: list) -> None:
    """Append new units to the live FAISS and BM25 indexes. Thread-safe."""
    global _vector_index, _bm25_index, _bm25_id_map
    if not new_units:
        return
    import numpy as np
    from app.math_wiki.storage.vectors import embed_texts
    texts = [u.content for u in new_units]
    new_vecs = embed_texts(texts, prefix="passage")
    arr = np.array(new_vecs, dtype=np.float32)
    with _index_lock:
        if _vector_index is not None and _vector_index.id_map:
            _vector_index.index.add(arr)
            _vector_index.id_map.extend([u.id for u in new_units])
        # Rebuild BM25 from DB so the hybrid retriever stays in sync
        all_units = get_all_wiki_units()
        import time as _time
        _t0 = _time.monotonic()
        _bm25_index, _bm25_id_map = build_bm25_index(all_units)
        inc_bm25_rebuild(_time.monotonic() - _t0)
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


def _problem_hash(question: str) -> str:
    return hashlib.sha256(question.strip().lower().encode()).hexdigest()


async def run_pipeline(client: AsyncOpenAI, question: str) -> dict:
    await asyncio.get_event_loop().run_in_executor(None, _ensure_indexes)

    label = await classify_problem(client, question)
    logger.debug("Classified as: %s", label)

    retrieved_ids, context = await _retrieve_rerank_context(client, question)
    logger.debug("Retrieved %d units: %s", len(retrieved_ids), retrieved_ids)

    solver_output = await solve(client, question, context, label=label)
    logger.debug("Solver confidence: %s", solver_output.confidence)

    # Figure generation (concurrent with validation, skipped on low confidence)
    figure: FigureOutput | None = None
    prob_hash = _problem_hash(question)

    async def _figure_task():
        nonlocal figure
        if solver_output.confidence == "low":
            logger.debug("Skipping figure: low confidence")
            return
        cached = get_cached_figure(prob_hash)
        if cached is not None:
            cached_data, cached_type = cached
            logger.debug("Figure cache hit for hash %s (type=%s)", prob_hash[:8], cached_type)
            figure = FigureOutput(type=cached_type, data=cached_data)
            return
        try:
            figure = await generate_figure(client, question, label, solver_output)
            if figure and figure.data:
                stub = Problem(
                    problem_id=prob_hash[:16],
                    problem_text=question,
                    topic=label,
                    subtopic=label,
                    difficulty="medium",
                    problem_type=label,
                )
                upsert_problem(stub, figure_svg=figure.data, problem_hash=prob_hash, figure_type=figure.type)
        except Exception as exc:
            logger.warning("Figure generation failed (non-fatal): %s", exc)

    if solver_output.confidence == "high":
        validation = ValidationResult(valid=True, issues=[])
        logger.debug("Skipping validation for high-confidence result")
        await _figure_task()
    else:
        results = await asyncio.gather(
            validate(client, solver_output, context),
            _figure_task(),
            return_exceptions=True,
        )
        val_result = results[0]
        validation = val_result if isinstance(val_result, ValidationResult) else ValidationResult(valid=False, issues=["validation error"])
        logger.debug("Validation: valid=%s issues=%s", validation.valid, validation.issues)

    record_validation(validation.valid)

    solver_output.figure = figure

    try:
        log_solution(
            problem_text=question,
            classified_topic=label,
            retrieved_ids=retrieved_ids,
            used_ids=solver_output.used_knowledge_ids,
            confidence=solver_output.confidence,
            valid=validation.valid,
            issues=validation.issues,
            wiki_assisted=bool(context),
        )
    except Exception as exc:
        logger.warning("log_solution failed (non-fatal): %s", exc)

    return {
        "label": label,
        "answer": solver_output.model_dump(),
        "validation": validation.model_dump(),
        "retrieved_ids": retrieved_ids,
        "wiki_assisted": bool(context),
    }

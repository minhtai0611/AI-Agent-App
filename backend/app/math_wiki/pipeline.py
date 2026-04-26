import logging
from openai import AsyncOpenAI
from app.math_wiki.storage.db import get_all_wiki_units, get_wiki_units_by_ids
from app.math_wiki.storage.bm25 import build_bm25_index, query_bm25
from app.math_wiki.storage.vectors import build_vector_index, VectorIndex
from app.math_wiki.storage.retriever import hybrid_retrieve
from app.math_wiki.agents.classifier import classify_problem
from app.math_wiki.agents.reranker import rerank
from app.math_wiki.agents.solver import solve
from app.math_wiki.agents.validator import validate
from app.math_wiki.utils import InsufficientKnowledgeError

logger = logging.getLogger(__name__)

# Indexes built once at module level on first use
_bm25_index = None
_bm25_id_map: list[str] = []
_vector_index: VectorIndex | None = None


def _ensure_indexes() -> None:
    global _bm25_index, _bm25_id_map, _vector_index
    if _vector_index is None:
        units = get_all_wiki_units()
        _bm25_index, _bm25_id_map = build_bm25_index(units)
        _vector_index = build_vector_index(units)
        logger.debug("Indexes built: %d units", len(units))


async def run_pipeline(client: AsyncOpenAI, question: str) -> dict:
    _ensure_indexes()

    try:
        label = await classify_problem(client, question)
        logger.debug("Classified as: %s", label)

        retrieved_ids = hybrid_retrieve(
            question, _bm25_index, _bm25_id_map, _vector_index
        )
        logger.debug("Retrieved %d units: %s", len(retrieved_ids), retrieved_ids)

        candidates = get_wiki_units_by_ids(retrieved_ids)

        top_ids = await rerank(client, question, candidates) if candidates else []
        logger.debug("Reranked to: %s", top_ids)

        context = get_wiki_units_by_ids(top_ids) if top_ids else candidates

        solver_output = await solve(client, question, context)
        logger.debug("Solver confidence: %s", solver_output.confidence)

        validation = await validate(client, solver_output, context)
        logger.debug("Validation: valid=%s issues=%s", validation.valid, validation.issues)

        return {
            "label": label,
            "answer": solver_output.model_dump(),
            "validation": validation.model_dump(),
            "retrieved_ids": retrieved_ids,
        }

    except InsufficientKnowledgeError:
        return {"error": "INSUFFICIENT_KNOWLEDGE"}

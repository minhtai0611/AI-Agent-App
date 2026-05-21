import asyncio
import hashlib
import json
import logging
import re
from openai import AsyncOpenAI
from app.math_wiki.storage import pg_db, pg_vectors
from app.math_wiki.storage.analytics import log_solution
from app.metrics import record_validation
from app.math_wiki.agents.classifier import classify_problem
from app.math_wiki.agents.reranker import rerank
from app.math_wiki.agents.solver import solve
from app.math_wiki.agents.validator import validate
from app.math_wiki.schemas import ValidationResult, FigureOutput, Problem, SolverOutput
from app.math_wiki.utils import InsufficientKnowledgeError
from app.math_wiki.figures import generate_figure

logger = logging.getLogger(__name__)

_wiki_status: dict = {"phase": "starting", "progress": 0, "error": None}
_bm25_index = None   # BM25Okapi instance
_bm25_id_map: list[str] = []
_bm25_ready_event = asyncio.Event()


def get_wiki_status() -> dict:
    return dict(_wiki_status)


async def _ensure_bm25(pool) -> None:
    global _bm25_index, _bm25_id_map
    try:
        _wiki_status.update({"phase": "loading_units", "progress": 40, "error": None})
        if pool is None:
            logger.warning("No pool available — BM25 index will be empty")
            _bm25_ready_event.set()
            _wiki_status.update({"phase": "ready", "progress": 100, "error": None})
            return

        units = await pg_db.get_all_wiki_units(pool)
        _wiki_status.update({"phase": "building_bm25", "progress": 70, "error": None})

        loop = asyncio.get_event_loop()
        _bm25_index, _bm25_id_map = await loop.run_in_executor(None, _build_bm25, units)

        _bm25_ready_event.set()
        _wiki_status.update({"phase": "ready", "progress": 100, "error": None})
        logger.info("BM25 index built: %d units", len(units))
    except Exception as exc:
        _bm25_ready_event.set()
        _wiki_status.update({"phase": "failed", "progress": 0, "error": str(exc)})
        logger.error("_ensure_bm25 failed: %s", exc)


def _build_bm25(units):
    from app.math_wiki.storage.bm25 import build_bm25_index
    if not units:
        return None, []
    return build_bm25_index(units)


async def _retrieve_rerank_context(pool, client: AsyncOpenAI, question: str):
    retrieved_ids = await pg_vectors.query_pgvector(pool, question) if pool else []
    candidates = await pg_db.get_wiki_units_by_ids(pool, retrieved_ids) if pool else []
    if candidates:
        try:
            top_ids = await rerank(client, question, candidates)
        except Exception as exc:
            logger.warning("Reranker failed (%s), using raw retrieval order", exc)
            top_ids = []
    else:
        top_ids = []
    context = await pg_db.get_wiki_units_by_ids(pool, top_ids) if top_ids and pool else candidates
    return retrieved_ids, context


def _problem_hash(question: str) -> str:
    normalized = re.sub(r'\s+', ' ', question.strip().lower())
    return hashlib.sha256(normalized.encode()).hexdigest()


_PART_HEADER_RE = re.compile(r'^\*\*Phần\s+([a-d])\w*\)\*\*$')

def _split_parts(steps: list[str]) -> dict[str, list[str]]:
    parts: dict[str, list[str]] = {}
    current: str | None = None
    for s in steps:
        m = _PART_HEADER_RE.match(s)
        if m:
            current = m.group(1)
            parts[current] = []
        elif current:
            parts[current].append(s)
    return parts


async def run_pipeline(
    pool,
    client: AsyncOpenAI,
    question: str,
    image_bytes: bytes | None = None,
    image_mime: str | None = None,
) -> dict:
    await asyncio.wait_for(_bm25_ready_event.wait(), timeout=120)

    label = await classify_problem(client, question)
    logger.debug("Classified as: %s", label)

    retrieved_ids, context = await _retrieve_rerank_context(pool, client, question)
    logger.debug("Retrieved %d units: %s", len(retrieved_ids), retrieved_ids)

    try:
        solver_output = await solve(client, question, context, label=label)
    except InsufficientKnowledgeError:
        return {"error": "INSUFFICIENT_KNOWLEDGE"}
    logger.debug("Solver confidence: %s", solver_output.confidence)

    figure: FigureOutput | None = None
    prob_hash = _problem_hash(question)

    async def _figure_task():
        nonlocal figure
        if solver_output.confidence == "low":
            logger.debug("Skipping figure: low confidence")
            return

        parts = _split_parts(solver_output.steps)
        if len(parts) > 1:
            # Multi-part problem: generate one figure per part (cap at 3)
            part_labels = list(parts.keys())[:3]

            async def _gen_part(part_label: str) -> tuple[str, FigureOutput | None]:
                part_hash = _problem_hash(question + ":part:" + part_label)
                if pool:
                    cached = await pg_db.get_cached_figure(pool, part_hash)
                    if cached is not None:
                        cached_data, cached_type = cached
                        return part_label, FigureOutput(type=cached_type, data=cached_data)
                part_solver = SolverOutput(
                    problem_type=solver_output.problem_type,
                    used_knowledge_ids=solver_output.used_knowledge_ids,
                    steps=parts[part_label],
                    final_answer=solver_output.final_answer,
                    confidence=solver_output.confidence,
                )
                part_fig = await generate_figure(client, question, label, part_solver, image_bytes, image_mime)
                if part_fig and part_fig.data and pool:
                    stub = Problem(
                        problem_id=part_hash[:16],
                        problem_text=question,
                        topic=label,
                        subtopic=label,
                        difficulty="medium",
                        problem_type=label,
                    )
                    await pg_db.upsert_problem(pool, stub, figure_svg=part_fig.data, problem_hash=part_hash, figure_type=part_fig.type)
                return part_label, part_fig

            results_parts = await asyncio.gather(*[_gen_part(pl) for pl in part_labels], return_exceptions=True)
            for res in results_parts:
                if isinstance(res, Exception):
                    logger.warning("Per-part figure generation failed: %s", res)
                    continue
                pl, pf = res
                if pf is not None:
                    solver_output.figures[pl] = pf
            if solver_output.figures:
                figure = next(iter(solver_output.figures.values()))
            return

        # Single-part path (original logic)
        if pool:
            cached = await pg_db.get_cached_figure(pool, prob_hash)
            if cached is not None:
                cached_data, cached_type = cached
                logger.debug("Figure cache hit for hash %s (type=%s)", prob_hash[:8], cached_type)
                figure = FigureOutput(type=cached_type, data=cached_data)
                return
        try:
            figure = await generate_figure(client, question, label, solver_output, image_bytes, image_mime)
            if figure and figure.data and pool:
                stub = Problem(
                    problem_id=prob_hash[:16],
                    problem_text=question,
                    topic=label,
                    subtopic=label,
                    difficulty="medium",
                    problem_type=label,
                )
                await pg_db.upsert_problem(pool, stub, figure_svg=figure.data, problem_hash=prob_hash, figure_type=figure.type)
        except Exception as exc:
            logger.warning("Figure generation failed (non-fatal): %s", exc)

    results = await asyncio.gather(
        validate(client, solver_output, context, problem_text=question),
        _figure_task(),
        return_exceptions=True,
    )
    val_result = results[0]
    validation = val_result if isinstance(val_result, ValidationResult) else ValidationResult(valid=False, issues=["validation error"])
    logger.debug("Validation: valid=%s issues=%s", validation.valid, validation.issues)

    record_validation(validation.valid)

    solver_output.figure = figure

    if pool:
        try:
            await log_solution(
                pool,
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

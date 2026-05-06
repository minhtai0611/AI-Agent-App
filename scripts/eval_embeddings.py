#!/usr/bin/env python3
"""
Embedding quality evaluation script.

Benchmarks embedding models on retrieval effectiveness using historical solution logs
as ground truth (query → used_knowledge_ids relevance judgments).

Usage:
    python scripts/eval_embeddings.py [--model MODEL_NAME] [--samples N]

Models to compare (if no --model specified):
    - all-MiniLM-L6-v2 (baseline)
    - paraphrase-multilingual-MiniLM-L12-v2
    - sentence-transformers/msmarco-MiniLM-L6-en
    - keepitreal/vietnamese-sbert (if available)
"""

import argparse
import hashlib
import json
import logging
import os
import sys
from collections import defaultdict
from typing import Optional

import numpy as np

# Add project root to path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(project_root, 'backend'))

from app.math_wiki.storage.db import _get_conn, _ensure_tables
from app.math_wiki.storage.vectors import embed_texts, build_vector_index, VectorIndex
from app.math_wiki.schemas import WikiUnit
from app.config import get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_solution_logs(limit: int = 200) -> list[dict]:
    """Fetch recent solution logs with used_knowledge_ids for relevance judgments."""
    with _get_conn() as conn:
        _ensure_tables(conn)
        rows = conn.execute(
            """
            SELECT problem_text, used_knowledge_ids
            FROM solution_logs
            WHERE json_array_length(used_knowledge_ids) > 0
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [{"query": r["problem_text"], "relevant": json.loads(r["used_knowledge_ids"])} for r in rows]


def get_all_units() -> list[WikiUnit]:
    """Load all wiki units from DB."""
    with _get_conn() as conn:
        _ensure_tables(conn)
        rows = conn.execute("SELECT * FROM wiki_units WHERE deleted = FALSE").fetchall()
    return [
        WikiUnit(
            id=r["id"],
            type=r["type"],
            topic=r["topic"],
            subtopic=r["subtopic"],
            content=r["content"],
            problem_ids=json.loads(r["problem_ids"]),
        )
        for r in rows
    ]


def _load_eval_model(model_name: str):
    if model_name == "BAAI/bge-m3":
        from FlagEmbedding import BGEM3FlagModel
        return ("bge-m3", BGEM3FlagModel(model_name, use_fp16=False))
    else:
        from sentence_transformers import SentenceTransformer
        return ("st", SentenceTransformer(model_name, device="cpu"))


def _encode(model_tuple, texts, prefix="passage"):
    kind, model = model_tuple
    if kind == "bge-m3":
        prefixed = [f"{prefix}: {t}" for t in texts]
        return model.encode(prefixed, return_dense=True, return_sparse=False, return_colbert_vecs=False)["dense_vecs"]
    return model.encode(texts, convert_to_numpy=True, show_progress_bar=False)


def evaluate_model(model_name: str, queries: list[dict], units: list[WikiUnit], top_k: int = 5) -> dict:
    """Evaluate an embedding model on retrieval effectiveness."""
    logger.info("Evaluating model: %s", model_name)

    try:
        model_tuple = _load_eval_model(model_name)
    except Exception as exc:
        logger.error("Failed to load model %s: %s", model_name, exc)
        return {"model": model_name, "error": str(exc)}

    unit_texts = [u.content for u in units]
    unit_embeds = _encode(model_tuple, unit_texts, prefix="passage")

    dim = unit_embeds.shape[1]
    import faiss
    index = faiss.IndexFlatL2(dim)
    index.add(unit_embeds.astype(np.float32))
    id_map = [u.id for u in units]

    mrr_scores = []
    p_at_k_scores = []
    query_embeds = _encode(model_tuple, [q["query"] for q in queries], prefix="query")

    for q_vec, query_data in zip(query_embeds, queries):
        q_vec_np = np.array([q_vec], dtype=np.float32)
        _, indices = index.search(q_vec_np, top_k)
        retrieved_ids = [id_map[i] for i in indices[0] if i >= 0]
        relevant = set(query_data["relevant"])

        # Precision@k
        hits = [rid for rid in retrieved_ids if rid in relevant]
        p_at_k_scores.append(len(hits) / top_k)

        # MRR
        rank = next((i + 1 for i, rid in enumerate(retrieved_ids) if rid in relevant), None)
        mrr_scores.append(1.0 / rank if rank else 0.0)

    return {
        "model": model_name,
        "samples": len(queries),
        "mrr": round(sum(mrr_scores) / len(mrr_scores), 4),
        "p@5": round(sum(p_at_k_scores) / len(p_at_k_scores), 4),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=None, help="Single model to evaluate (default: all)")
    parser.add_argument("--samples", type=int, default=200, help="Number of query samples")
    parser.add_argument("--k", type=int, default=5, help="Top-k for metrics")
    args = parser.parse_args()

    # Load data
    logger.info("Loading evaluation data...")
    queries = get_solution_logs(limit=args.samples)
    if not queries:
        logger.error("No solution logs available. Run the system with some activity first.")
        sys.exit(1)

    units = get_all_units()
    if len(units) < 2:
        logger.error("Need at least 2 wiki units to evaluate.")
        sys.exit(1)

    logger.info("Loaded %d queries, %d units", len(queries), len(units))

    models_to_test = [
        args.model,
    ] if args.model else [
        "BAAI/bge-m3",
        "all-MiniLM-L6-v2",
        "paraphrase-multilingual-MiniLM-L12-v2",
        "keepitreal/vietnamese-sbert",
    ]

    results = []
    for model_name in models_to_test:
        try:
            metrics = evaluate_model(model_name, queries, units, top_k=args.k)
            results.append(metrics)
        except Exception as exc:
            logger.exception("Failed to evaluate %s: %s", model_name, exc)
            results.append({"model": model_name, "error": str(exc)})

    # Print comparison table
    print("\n=== Embedding Quality Evaluation ===")
    print(f"{'Model':<45} {'MRR':>6} {'P@5':>6} {'Samples':>8}")
    print("-" * 70)
    for r in results:
        if "error" in r:
            print(f"{r['model']:<45} ERROR: {r['error']}")
        else:
            print(f"{r['model']:<45} {r['mrr']:>6} {r['p@5']:>6} {r['samples']:>8}")

    # Suggest switch if improvement >30%
    if len(results) >= 2 and "error" not in results[0] and "error" not in results[1]:
        baseline = results[0]
        best = max(results, key=lambda x: x.get("mrr", 0))
        if best != baseline:
            improvement = (best["mrr"] - baseline["mrr"]) / baseline["mrr"] if baseline["mrr"] > 0 else 0
            if improvement > 0.3:
                print(f"\n→ {best['model']} improves MRR by {improvement*100:.1f}% over baseline.")
                print(f"  Consider setting embedding_model_name = \"{best['model']}\" in config.")
            else:
                print(f"\nNo model exceeds baseline by >30%. Keep current model.")


if __name__ == "__main__":
    main()

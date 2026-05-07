"""Tests for math wiki system — storage, agents, pipeline, routes."""
import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _mock_completion(content: str):
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    choice.finish_reason = "stop"
    response = MagicMock()
    response.choices = [choice]
    return response


# ── test_bm25 ─────────────────────────────────────────────────────────────────

def test_bm25_empty_returns_empty():
    from app.math_wiki.storage.bm25 import build_bm25_index, query_bm25
    idx, id_map = build_bm25_index([])
    result = query_bm25(idx, id_map, "algebra", top_k=5)
    assert result == []


def test_bm25_ranking():
    from app.math_wiki.schemas import WikiUnit
    from app.math_wiki.storage.bm25 import build_bm25_index, query_bm25

    units = [
        WikiUnit(id="u1", type="concept", topic="algebra", subtopic="x",
                 content="linear equation solving", problem_ids=[]),
        WikiUnit(id="u2", type="concept", topic="geometry", subtopic="y",
                 content="triangle area formula", problem_ids=[]),
        WikiUnit(id="u3", type="concept", topic="algebra", subtopic="z",
                 content="quadratic equation roots", problem_ids=[]),
        WikiUnit(id="u4", type="concept", topic="algebra", subtopic="a",
                 content="linear algebra matrix", problem_ids=[]),
        WikiUnit(id="u5", type="concept", topic="geometry", subtopic="b",
                 content="circle circumference", problem_ids=[]),
    ]
    idx, id_map = build_bm25_index(units)
    result = query_bm25(idx, id_map, "linear equation", top_k=2)
    assert "u1" in result


# ── test_retriever ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_retriever_no_pool_returns_empty():
    from app.math_wiki.storage.retriever import vector_retrieve
    result = await vector_retrieve(None, "algebra")
    assert result == []


@pytest.mark.asyncio
async def test_retriever_with_pool():
    from app.math_wiki.storage.retriever import vector_retrieve
    mock_pool = MagicMock()
    with patch("app.math_wiki.storage.retriever.query_pgvector", new_callable=AsyncMock,
               return_value=["u1", "u2"]) as mock_qpg:
        result = await vector_retrieve(mock_pool, "algebra", top_k=5)
    assert result == ["u1", "u2"]
    mock_qpg.assert_called_once_with(mock_pool, "algebra", top_k=5)


# ── test_classifier ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_classifier_valid_label():
    from app.math_wiki.agents.classifier import classify_problem
    with patch("app.math_wiki.agents.classifier.call_with_retry", new_callable=AsyncMock) as mock:
        mock.return_value = _mock_completion('{"label": "algebra"}')
        result = await classify_problem(MagicMock(), "solve 2x+3=7")
    assert result == "algebra"


@pytest.mark.asyncio
async def test_classifier_invalid_label_falls_back():
    from app.math_wiki.agents.classifier import classify_problem
    with patch("app.math_wiki.agents.classifier.call_with_retry", new_callable=AsyncMock) as mock:
        mock.return_value = _mock_completion('{"label": "unknown_topic"}')
        result = await classify_problem(MagicMock(), "test problem")
    assert result == "algebra"


# ── test_reranker ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reranker_returns_top5():
    from app.math_wiki.schemas import WikiUnit
    from app.math_wiki.agents.reranker import rerank

    candidates = [
        WikiUnit(id=f"u{i}", type="concept", topic="algebra", subtopic="x",
                 content=f"content {i}", problem_ids=[])
        for i in range(10)
    ]
    top_ids = [f"u{i}" for i in range(5)]
    with patch("app.math_wiki.agents.reranker.call_with_retry", new_callable=AsyncMock) as mock:
        mock.return_value = _mock_completion(json.dumps({"top_ids": top_ids}))
        result = await rerank(MagicMock(), "algebra query", candidates)
    assert len(result) <= 5
    assert all(uid in {c.id for c in candidates} for uid in result)


@pytest.mark.asyncio
async def test_reranker_hallucinated_id_filtered():
    from app.math_wiki.schemas import WikiUnit
    from app.math_wiki.agents.reranker import rerank

    candidates = [
        WikiUnit(id="u1", type="concept", topic="algebra", subtopic="x",
                 content="content", problem_ids=[])
    ]
    with patch("app.math_wiki.agents.reranker.call_with_retry", new_callable=AsyncMock) as mock:
        mock.return_value = _mock_completion(json.dumps({"top_ids": ["hallucinated_id"]}))
        result = await rerank(MagicMock(), "query", candidates)
    assert result == []


# ── test_solver ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_solver_valid():
    from app.math_wiki.schemas import WikiUnit
    from app.math_wiki.agents.solver import solve

    context = [WikiUnit(id="u1", type="concept", topic="algebra", subtopic="x",
                        content="linear equations", problem_ids=[])]
    output_data = {
        "problem_type": "linear_equation",
        "used_knowledge_ids": ["u1"],
        "steps": ["step1", "step2"],
        "final_answer": "x=2",
        "confidence": "high",
    }
    with patch("app.math_wiki.agents.solver.call_with_retry", new_callable=AsyncMock) as mock:
        mock.return_value = _mock_completion(json.dumps(output_data))
        result = await solve(MagicMock(), "solve 2x=4", context)
    assert result.final_answer == "x=2"
    assert result.confidence == "high"


@pytest.mark.asyncio
async def test_solver_insufficient_knowledge():
    from app.math_wiki.schemas import WikiUnit
    from app.math_wiki.agents.solver import solve
    from app.math_wiki.utils import InsufficientKnowledgeError

    context = [WikiUnit(id="u1", type="concept", topic="algebra", subtopic="x",
                        content="content", problem_ids=[])]
    with patch("app.math_wiki.agents.solver.call_with_retry", new_callable=AsyncMock) as mock:
        mock.return_value = _mock_completion('{"result": "INSUFFICIENT_KNOWLEDGE"}')
        with pytest.raises(InsufficientKnowledgeError):
            await solve(MagicMock(), "impossible problem", context)


@pytest.mark.asyncio
async def test_solver_hallucinated_knowledge_id_filtered():
    from app.math_wiki.schemas import WikiUnit
    from app.math_wiki.agents.solver import solve

    context = [WikiUnit(id="u1", type="concept", topic="algebra", subtopic="x",
                        content="content", problem_ids=[])]
    output_data = {
        "problem_type": "linear_equation",
        "used_knowledge_ids": ["hallucinated_id"],
        "steps": ["step1"],
        "final_answer": "x=2",
        "confidence": "high",
    }
    with patch("app.math_wiki.agents.solver.call_with_retry", new_callable=AsyncMock) as mock:
        mock.return_value = _mock_completion(json.dumps(output_data))
        result = await solve(MagicMock(), "solve 2x=4", context)
    assert result.used_knowledge_ids == []


# ── test_validator ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_validator_valid():
    from app.math_wiki.schemas import SolverOutput
    from app.math_wiki.agents.validator import validate

    solver_out = SolverOutput(
        problem_type="linear", used_knowledge_ids=[], steps=["step1"],
        final_answer="x=2", confidence="high"
    )
    with patch("app.math_wiki.agents.validator.call_with_retry", new_callable=AsyncMock) as mock:
        mock.return_value = _mock_completion('{"valid": true, "issues": []}')
        result = await validate(MagicMock(), solver_out, [])
    assert result.valid is True
    assert result.issues == []


@pytest.mark.asyncio
async def test_validator_invalid():
    from app.math_wiki.schemas import SolverOutput
    from app.math_wiki.agents.validator import validate

    solver_out = SolverOutput(
        problem_type="linear", used_knowledge_ids=[], steps=["step1"],
        final_answer="wrong", confidence="low"
    )
    with patch("app.math_wiki.agents.validator.call_with_retry", new_callable=AsyncMock) as mock:
        mock.return_value = _mock_completion('{"valid": false, "issues": ["Wrong answer"]}')
        result = await validate(MagicMock(), solver_out, [])
    assert result.valid is False
    assert len(result.issues) > 0


# ── test_pipeline ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_pipeline_end_to_end():
    from app.math_wiki.pipeline import run_pipeline
    import app.math_wiki.pipeline as pipeline_mod

    pipeline_mod._bm25_ready_event.set()

    with patch("app.math_wiki.pipeline.classify_problem", new_callable=AsyncMock, return_value="algebra"), \
         patch("app.math_wiki.pipeline._retrieve_rerank_context", new_callable=AsyncMock, return_value=([], [])), \
         patch("app.math_wiki.pipeline.solve", new_callable=AsyncMock) as mock_solve, \
         patch("app.math_wiki.pipeline.validate", new_callable=AsyncMock) as mock_validate, \
         patch("app.math_wiki.pipeline.generate_figure", new_callable=AsyncMock, return_value=None), \
         patch("app.math_wiki.pipeline.log_solution", new_callable=AsyncMock):

        from app.math_wiki.schemas import SolverOutput, ValidationResult
        mock_solve.return_value = SolverOutput(
            problem_type="linear", used_knowledge_ids=[],
            steps=["step1"], final_answer="x=2", confidence="medium"
        )
        mock_validate.return_value = ValidationResult(valid=True, issues=[])

        result = await run_pipeline(MagicMock(), MagicMock(), "solve 2x=4")

    assert "label" in result
    assert "answer" in result
    assert "validation" in result
    assert result["label"] == "algebra"


@pytest.mark.asyncio
async def test_pipeline_insufficient_knowledge():
    from app.math_wiki.pipeline import run_pipeline
    from app.math_wiki.utils import InsufficientKnowledgeError
    import app.math_wiki.pipeline as pipeline_mod

    pipeline_mod._bm25_ready_event.set()

    with patch("app.math_wiki.pipeline.classify_problem", new_callable=AsyncMock, return_value="algebra"), \
         patch("app.math_wiki.pipeline._retrieve_rerank_context", new_callable=AsyncMock, return_value=([], [])), \
         patch("app.math_wiki.pipeline.solve", new_callable=AsyncMock, side_effect=InsufficientKnowledgeError()):

        result = await run_pipeline(MagicMock(), MagicMock(), "impossible problem")

    assert result == {"error": "INSUFFICIENT_KNOWLEDGE"}


# ── test_routes ────────────────────────────────────────────────────────────────

def test_math_ingest_happy_path():
    from app.math_wiki.schemas import IngestOutput, Problem, WikiUnit

    output = IngestOutput(
        problems=[Problem(
            problem_id="p1", problem_text="Solve 2x=4", topic="algebra",
            subtopic="linear", difficulty="easy", problem_type="equation"
        )],
        wiki_units=[
            WikiUnit(id="u1", type="concept", topic="algebra", subtopic="linear",
                     content="linear equations", problem_ids=["p1"]),
            WikiUnit(id="u2", type="procedure", topic="algebra", subtopic="linear",
                     content="solving steps", problem_ids=["p1"]),
        ],
    )
    with patch("app.math_wiki.agents.ingest.ingest_exam", new_callable=AsyncMock, return_value=output):
        r = client.post("/math-ingest", json={"text": "Solve 2x=4"})
    assert r.status_code == 200
    body = r.json()
    assert "problems" in body
    assert "wiki_units" in body


def test_math_solve_happy_path():
    expected = {
        "label": "algebra",
        "answer": {"problem_type": "linear", "used_knowledge_ids": [],
                   "steps": ["step1"], "final_answer": "x=2", "confidence": "high"},
        "validation": {"valid": True, "issues": []},
        "retrieved_ids": [],
    }
    with patch("app.math_wiki.pipeline.run_pipeline", new_callable=AsyncMock, return_value=expected):
        r = client.post("/math-solve", json={"question": "solve 2x=4"})
    assert r.status_code == 200
    body = r.json()
    assert body["label"] == "algebra"


def test_math_solve_insufficient_knowledge():
    with patch("app.math_wiki.pipeline.run_pipeline", new_callable=AsyncMock,
               return_value={"error": "INSUFFICIENT_KNOWLEDGE"}):
        r = client.post("/math-solve", json={"question": "impossible"})
    assert r.status_code == 200
    assert r.json()["error"] == "INSUFFICIENT_KNOWLEDGE"


# ── test_stats ─────────────────────────────────────────────────────────────────

def test_math_stats_empty():
    with patch("app.math_wiki.storage.pg_db.count_problems", new_callable=AsyncMock, return_value=0), \
         patch("app.math_wiki.storage.pg_db.count_wiki_units", new_callable=AsyncMock, return_value=0), \
         patch("app.math_wiki.storage.pg_db.count_wiki_units_by_topic", new_callable=AsyncMock, return_value={}):
        r = client.get("/math-stats")
    assert r.status_code == 200
    body = r.json()
    assert body["problems"] == 0
    assert body["wiki_units"] == 0
    assert body["topics"] == {}


def test_math_stats_with_data():
    with patch("app.math_wiki.storage.pg_db.count_problems", new_callable=AsyncMock, return_value=10), \
         patch("app.math_wiki.storage.pg_db.count_wiki_units", new_callable=AsyncMock, return_value=25), \
         patch("app.math_wiki.storage.pg_db.count_wiki_units_by_topic", new_callable=AsyncMock,
               return_value={"algebra": 15, "geometry": 10}):
        r = client.get("/math-stats")
    assert r.status_code == 200
    body = r.json()
    assert body["problems"] == 10
    assert body["wiki_units"] == 25
    assert body["topics"]["algebra"] == 15


def test_math_upload_txt():
    from app.math_wiki.schemas import IngestOutput, Problem, WikiUnit

    output = IngestOutput(
        problems=[Problem(
            problem_id="p1", problem_text="Solve x=1", topic="algebra",
            subtopic="linear", difficulty="easy", problem_type="equation"
        )],
        wiki_units=[
            WikiUnit(id="u1", type="concept", topic="algebra", subtopic="linear",
                     content="linear equations", problem_ids=["p1"]),
            WikiUnit(id="u2", type="procedure", topic="algebra", subtopic="linear",
                     content="steps", problem_ids=["p1"]),
        ],
    )
    with patch("app.math_wiki.agents.ingest.ingest_exam", new_callable=AsyncMock, return_value=output):
        r = client.post("/math-upload", files={"file": ("test.txt", b"Cau 1. x = 1?", "text/plain")})
    assert r.status_code == 200
    body = r.json()
    assert "chunks_ingested" in body
    assert "problems" in body
    assert "wiki_units" in body


def test_math_upload_too_large():
    big = b"x" * (10 * 1024 * 1024 + 1)
    r = client.post("/math-upload", files={"file": ("big.txt", big, "text/plain")})
    assert r.status_code == 413


# ── test_math_ocr ──────────────────────────────────────────────────────────────

def test_math_ocr_success():
    with patch("app.math_wiki.agents.ocr.extract_math_from_image",
               new_callable=AsyncMock, return_value="x^2 + 1 = 0"):
        r = client.post("/math-ocr", files={"file": ("test.jpg", b"fakejpeg", "image/jpeg")})
    assert r.status_code == 200
    assert r.json()["text"] == "x^2 + 1 = 0"


def test_math_ocr_too_large():
    big = b"x" * (5 * 1024 * 1024 + 1)
    r = client.post("/math-ocr", files={"file": ("big.jpg", big, "image/jpeg")})
    assert r.status_code == 413


def test_math_ocr_unsupported_type():
    r = client.post("/math-ocr", files={"file": ("malware.exe", b"MZ", "application/octet-stream")})
    assert r.status_code == 415


# ── test_bge_m3 ───────────────────────────────────────────────────────────────

def test_embed_dim():
    import numpy as np
    mock_model = MagicMock()
    mock_model.encode.return_value = {"dense_vecs": np.zeros((1, 1024), dtype=np.float32)}

    with patch("app.math_wiki.storage.vectors._local_model", mock_model):
        from app.math_wiki.storage.vectors import embed_texts
        result = embed_texts(["test"])
    assert len(result) == 1
    assert len(result[0]) == 1024


def test_prefix_distinction():
    import numpy as np
    mock_model = MagicMock()

    def _fake_encode(texts, **kwargs):
        val = 1.0 if texts[0].startswith("query:") else 0.0
        return {"dense_vecs": np.full((len(texts), 1024), val, dtype=np.float32)}

    mock_model.encode.side_effect = _fake_encode

    with patch("app.math_wiki.storage.vectors._local_model", mock_model):
        from app.math_wiki.storage.vectors import embed_texts
        q_vec = embed_texts(["x"], prefix="query")[0]
        p_vec = embed_texts(["x"], prefix="passage")[0]
    assert q_vec[0] != p_vec[0]

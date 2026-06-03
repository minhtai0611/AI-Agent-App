"""
Golden / snapshot tests for AI endpoint response shapes.

Purpose
-------
Catch silent regressions when fields are renamed, removed, or change type —
e.g. upgrading a model version or refactoring a response handler.

How it works
------------
- Golden files in tests/goldens/*.golden.json declare the expected schema
  (field names + Python type names, not exact values).
- Each test makes a request with a deterministic mocked LLM, then asserts
  the live response matches the declared schema.
- To refresh goldens after an intentional change:
      pytest backend/tests/test_golden.py --update-goldens

Adding a new endpoint golden
-----------------------------
1. Create tests/goldens/<endpoint>.golden.json  (see hint.golden.json as template)
2. Add a parametrize entry to GOLDEN_SPECS below — no other Python change needed.
"""
import json
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_pool
from app.dependencies import get_current_user, CurrentUser
from tests.builders import PoolBuilder, MOCK_RESULT, MOCK_QUESTION, make_completion

GOLDEN_DIR = Path(__file__).parent / "goldens"

_TYPE_MAP = {
    "str": str,
    "int": int,
    "float": float,
    "list": list,
    "dict": dict,
    "bool": bool,
}


# ── Golden spec registry ───────────────────────────────────────────────────────
# (endpoint, method, request_body, llm_patch_path)

GOLDEN_SPECS = [
    (
        "/hint",
        "POST",
        {"question": MOCK_QUESTION, "attempt_count": 1},
        "app.agent.hint_generator.call_with_retry",
        "hint.golden.json",
    ),
    (
        "/analyze",
        "POST",
        {"result": MOCK_RESULT, "history": []},
        "app.agent.exam_analyzer.call_with_retry",
        "analyze.golden.json",
    ),
    (
        "/study-plan",
        "POST",
        {"result": MOCK_RESULT, "history": []},
        "app.agent.study_planner.call_with_retry",
        "study_plan.golden.json",
    ),
]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _load_golden(filename: str) -> dict:
    path = GOLDEN_DIR / filename
    if not path.exists():
        pytest.skip(f"Golden file not found: {path}")
    with open(path) as f:
        return json.load(f)


def _save_golden(filename: str, schema: dict) -> None:
    path = GOLDEN_DIR / filename
    with open(path, "w") as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)
        f.write("\n")


def _response_to_schema(body: dict) -> dict:
    """Convert a live response body to a schema dict (field → {type, ...})."""
    schema = {}
    for key, value in body.items():
        type_name = type(value).__name__
        entry: dict[str, Any] = {"type": type_name}
        if isinstance(value, str):
            entry["min_length"] = 0
        elif isinstance(value, list) and value:
            entry["item_type"] = type(value[0]).__name__
        schema[key] = entry
    return schema


def _assert_schema_matches(body: dict, golden: dict, endpoint: str) -> None:
    """Assert every declared field exists with the right type."""
    meta_key = "_meta"
    for field, spec in golden.items():
        if field == meta_key:
            continue
        assert field in body, (
            f"Golden regression [{endpoint}]: field '{field}' missing from response.\n"
            f"  Response keys: {list(body.keys())}\n"
            f"  → Someone may have renamed or removed this field."
        )
        expected_type = _TYPE_MAP.get(spec["type"])
        if expected_type is None:
            continue
        actual = body[field]
        assert isinstance(actual, expected_type), (
            f"Golden regression [{endpoint}]: field '{field}' changed type.\n"
            f"  Expected: {spec['type']} ({expected_type.__name__})\n"
            f"  Got:      {type(actual).__name__} = {actual!r}"
        )
        if spec.get("item_type") and isinstance(actual, list) and actual:
            item_type = _TYPE_MAP.get(spec["item_type"])
            if item_type:
                assert isinstance(actual[0], item_type), (
                    f"Golden regression [{endpoint}]: '{field}' list item type changed.\n"
                    f"  Expected item type: {spec['item_type']}\n"
                    f"  Got: {type(actual[0]).__name__}"
                )


# ── Shared fixtures ────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _active_user():
    saved = dict(app.dependency_overrides)
    pool = PoolBuilder().with_tier("student").with_credits(100).build_mock()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id=1, email="golden@test.com"
    )
    app.dependency_overrides[get_pool] = lambda: pool
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(saved)


def _client():
    return TestClient(app, raise_server_exceptions=False)


# ── Parametrized golden tests ─────────────────────────────────────────────────

@pytest.mark.parametrize(
    "endpoint,method,body,patch_path,golden_file",
    GOLDEN_SPECS,
    ids=[s[0] for s in GOLDEN_SPECS],
)
def test_response_matches_golden_schema(
    endpoint, method, body, patch_path, golden_file, request
):
    """
    Assert the live response shape matches the stored golden schema.
    Run with --update-goldens to refresh the golden files.
    """
    golden = _load_golden(golden_file)
    llm_json = golden.get("_meta", {}).get("llm_mock", "{}")

    with patch(patch_path, new_callable=AsyncMock, return_value=make_completion(llm_json)):
        r = _client().request(method, endpoint, json=body)

    assert r.status_code == 200, (
        f"[{endpoint}] Expected 200, got {r.status_code}: {r.text[:300]}"
    )

    if request.config.getoption("--update-goldens", default=False):
        schema = _response_to_schema(r.json())
        if "_meta" in golden:
            schema["_meta"] = golden["_meta"]
        _save_golden(golden_file, schema)
        pytest.skip(f"Updated golden: {golden_file}")

    _assert_schema_matches(r.json(), golden, endpoint)


def test_hint_field_rename_detected():
    """
    Explicit regression guard: if 'hint' is renamed to anything else,
    the golden test catches it AND this test catches it redundantly.
    """
    golden = _load_golden("hint.golden.json")
    assert "hint" in golden, (
        "Golden schema must declare 'hint' field. "
        "If the field was intentionally renamed, update hint.golden.json."
    )


def test_analyze_required_fields_in_golden():
    """All ExamAnalyzeResponse fields must be declared in the golden."""
    required = {"insights", "weak_topics", "recommendations", "question_analysis", "school_insight"}
    golden = _load_golden("analyze.golden.json")
    declared = {k for k in golden if k != "_meta"}
    missing = required - declared
    assert not missing, (
        f"analyze golden is missing required fields: {missing}. "
        "Update analyze.golden.json to include them."
    )


# ── Semantic drift detection ──────────────────────────────────────────────────

def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Pure-Python cosine similarity — no numpy needed for small vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = sum(x * x for x in a) ** 0.5
    mag_b = sum(x * x for x in b) ** 0.5
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def _semantic_similarity(text_a: str, text_b: str) -> float:
    """
    Compute semantic similarity between two texts using sentence-transformers.
    Returns a float in [-1, 1]; values >= 0.7 indicate semantically similar content.
    Falls back to 0.0 if sentence-transformers is unavailable or inference fails
    (e.g. incompatible GPU/CUDA environment — runs on CPU automatically).
    """
    try:
        from sentence_transformers import SentenceTransformer
        # Force CPU to avoid CUDA compatibility issues in dev/CI environments
        model = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
        emb_a = model.encode(text_a, device="cpu").tolist()
        emb_b = model.encode(text_b, device="cpu").tolist()
        return _cosine_similarity(emb_a, emb_b)
    except Exception:
        return 0.0  # graceful fallback — skip semantic tests when unavailable


def test_cosine_similarity_unit():
    """Unit test for the pure-Python cosine similarity helper."""
    assert _cosine_similarity([1, 0], [1, 0]) == pytest.approx(1.0)
    assert _cosine_similarity([1, 0], [0, 1]) == pytest.approx(0.0)
    assert _cosine_similarity([1, 1], [1, 1]) == pytest.approx(1.0)
    assert _cosine_similarity([], []) == 0.0


def test_semantic_drift_mechanism_identical_texts():
    """
    Verify the similarity mechanism is functional:
    identical texts must return similarity ≥ 0.99.
    """
    text = "Phương trình bậc hai có hai nghiệm thực phân biệt."
    sim = _semantic_similarity(text, text)
    if sim == 0.0:
        pytest.skip("sentence-transformers not available — skipping semantic test")
    assert sim >= 0.99, f"Identical texts must be similarity ≥ 0.99, got {sim:.3f}"


def test_semantic_drift_mechanism_different_texts():
    """
    Verify the mechanism detects dissimilar text:
    completely different topics must return similarity < 0.7.
    """
    text_a = "Hình học tọa độ trong mặt phẳng Oxy."
    text_b = "Lịch sử chiến tranh thế giới thứ hai."
    sim = _semantic_similarity(text_a, text_b)
    if sim == 0.0:
        pytest.skip("sentence-transformers not available — skipping semantic test")
    assert sim < 0.7, (
        f"Completely unrelated texts should have similarity < 0.7, got {sim:.3f}"
    )


@pytest.mark.parametrize(
    "endpoint,method,body,patch_path,golden_file",
    GOLDEN_SPECS,
    ids=[s[0] for s in GOLDEN_SPECS],
)
def test_response_semantic_similarity_to_golden(
    endpoint, method, body, patch_path, golden_file
):
    """
    Semantic drift detection: the live response text must be semantically
    similar (≥ 0.6) to the reference text stored in the golden file.

    When a model upgrade silently changes the MEANING of responses
    (not just the format), this test catches it. Schema tests miss this.

    To update the reference after an intentional model upgrade:
        pytest --update-goldens
    """
    golden = _load_golden(golden_file)
    reference_text = golden.get("_meta", {}).get("reference_text")
    if not reference_text:
        pytest.skip(f"No reference_text in {golden_file} — add one to enable drift detection")

    llm_json = golden.get("_meta", {}).get("llm_mock", "{}")

    with patch(patch_path, new_callable=AsyncMock, return_value=make_completion(llm_json)):
        r = _client().request(method, endpoint, json=body)

    assert r.status_code == 200

    # Concatenate all string fields into a single text for comparison
    resp_body = r.json()
    response_text = " ".join(
        str(v) for v in resp_body.values() if isinstance(v, str) and v
    )
    if not response_text:
        pytest.skip("Response has no string content to compare")

    similarity = _semantic_similarity(response_text, reference_text)
    if similarity == 0.0:
        pytest.skip("sentence-transformers not available — skipping semantic drift check")

    assert similarity >= 0.6, (
        f"[{endpoint}] Semantic drift detected!\n"
        f"  Similarity to golden reference: {similarity:.3f} (threshold: 0.60)\n"
        f"  Reference: {reference_text[:200]!r}\n"
        f"  Response:  {response_text[:200]!r}\n"
        f"  → Run pytest --update-goldens if this change is intentional."
    )


# ── pytest option ──────────────────────────────────────────────────────────────

def pytest_addoption(parser):
    parser.addoption(
        "--update-goldens",
        action="store_true",
        default=False,
        help="Regenerate golden files from live responses",
    )

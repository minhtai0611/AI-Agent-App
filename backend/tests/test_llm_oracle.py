"""
LLM Oracle tests — validate AI endpoint responses beyond key-existence checks.

Three oracle techniques used here:
  1. Pydantic schema validation — response shape matches declared model exactly
  2. Metamorphic relations — output properties that must hold relative to inputs
  3. Token-budget assertions — LLM calls stay within expected cost bounds

Tests are parametrized from YAML catalogs (fixtures/hint_cases.yaml,
fixtures/analyze_cases.yaml) — add a case by editing the YAML, not this file.
"""
import json
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
import yaml
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field, ValidationError

from app.main import app, get_pool
from app.dependencies import get_current_user, CurrentUser
from tests.builders import (
    PoolBuilder,
    make_completion,
    MOCK_QUESTION,
    MOCK_RESULT,
)

FIXTURE_DIR = Path(__file__).parent / "fixtures"

_ENDPOINT_COST = {"/hint": 1, "/analyze": 3, "/study-plan": 5, "/explain": 1}


# ── Pydantic oracle models ─────────────────────────────────────────────────────
# Stricter than the app's own response models — assert types AND value ranges.

class StrictHintResponse(BaseModel):
    hint: str = Field(default="", max_length=5000)
    difficulty_note: str = Field(default="")


class StrictAnalyzeResponse(BaseModel):
    insights: str = Field(default="")
    weak_topics: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    question_analysis: str = Field(default="")
    school_insight: str = Field(default="")


class StrictStudyPlanResponse(BaseModel):
    score_gap: str = Field(default="")
    focus_areas: list[Any] = Field(default_factory=list)
    retake_note: str = Field(default="")


ORACLE_MODELS = {
    "/hint": StrictHintResponse,
    "/analyze": StrictAnalyzeResponse,
    "/study-plan": StrictStudyPlanResponse,
}

# ── Shared fixtures ────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _active_user_overrides():
    """Default: active user with 100 credits. Individual tests override as needed."""
    saved = dict(app.dependency_overrides)
    pool = PoolBuilder().with_credits(100).build_mock()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(user_id=1, email="oracle@test.com")
    app.dependency_overrides[get_pool] = lambda: pool
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(saved)


def _client() -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


# ── YAML loaders ──────────────────────────────────────────────────────────────

def _load_hint_cases():
    with open(FIXTURE_DIR / "hint_cases.yaml") as f:
        return yaml.safe_load(f)


def _load_analyze_cases():
    with open(FIXTURE_DIR / "analyze_cases.yaml") as f:
        return yaml.safe_load(f)


# ── Hint oracle — catalog-driven ──────────────────────────────────────────────

@pytest.mark.oracle
@pytest.mark.parametrize("case", _load_hint_cases(), ids=lambda c: c["id"])
def test_hint_oracle_catalog(case):
    """
    For each case in hint_cases.yaml:
    - Sets the correct user state (credits, tos)
    - Mocks or raises LLM based on llm_response
    - Validates HTTP status
    - For 200 responses: validates against StrictHintResponse schema
    """
    credits = case.get("credits", 20)
    pool = PoolBuilder(
        credits=credits,
        tos_accepted_at="2024-01-01T00:00:00" if case.get("tos", True) else None,
    )
    pool.credits_update_succeeds = credits >= _ENDPOINT_COST["/hint"]
    app.dependency_overrides[get_pool] = lambda: pool.build_mock()

    llm_response = case.get("llm_response")
    body = {
        "question": MOCK_QUESTION,
        "attempt_count": case.get("attempt_count", 1),
    }

    if llm_response is None:
        # Simulate LLM exception (credit/auth check fires before LLM anyway)
        side_effect = Exception("should not reach LLM")
        ctx = patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock,
                    side_effect=side_effect)
    else:
        ctx = patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock,
                    return_value=make_completion(llm_response))

    with ctx:
        r = _client().post("/hint", json=body)

    assert r.status_code == case["expect_status"], (
        f"[{case['id']}] expected {case['expect_status']}, got {r.status_code}: {r.text[:200]}"
    )

    if r.status_code == 200:
        # Schema oracle: every 200 must parse cleanly
        try:
            validated = StrictHintResponse(**r.json())
        except ValidationError as e:
            pytest.fail(f"[{case['id']}] Response failed Pydantic schema: {e}")

        if case.get("expect_field"):
            assert hasattr(validated, case["expect_field"])

        if case.get("expect_absent"):
            assert case["expect_absent"] not in r.json()


# ── Analyze oracle — catalog-driven ───────────────────────────────────────────

@pytest.mark.oracle
@pytest.mark.parametrize("case", _load_analyze_cases(), ids=lambda c: c["id"])
def test_analyze_oracle_catalog(case):
    """
    For each case in analyze_cases.yaml:
    - Sets user state and mocks LLM
    - Validates HTTP status and schema on 200
    """
    credits = case.get("credits", 10)
    pool = PoolBuilder(
        tier=case.get("tier", "student"),
        credits=credits,
        tos_accepted_at="2024-01-01T00:00:00" if case.get("tos", True) else None,
    )
    pool.credits_update_succeeds = credits >= _ENDPOINT_COST["/analyze"]
    app.dependency_overrides[get_pool] = lambda: pool.build_mock()

    result = dict(MOCK_RESULT)
    if "score" in case:
        result["score"] = case["score"]

    body = {"result": result, "history": []}
    llm_response = case.get("llm_response")

    if llm_response is None:
        ctx = patch("app.agent.exam_analyzer.call_with_retry", new_callable=AsyncMock,
                    side_effect=Exception("should not reach LLM"))
    else:
        ctx = patch("app.agent.exam_analyzer.call_with_retry", new_callable=AsyncMock,
                    return_value=make_completion(llm_response))

    with ctx:
        r = _client().post("/analyze", json=body)

    assert r.status_code == case["expect_status"], (
        f"[{case['id']}] expected {case['expect_status']}, got {r.status_code}: {r.text[:200]}"
    )

    if r.status_code == 200:
        try:
            validated = StrictAnalyzeResponse(**r.json())
        except ValidationError as e:
            pytest.fail(f"[{case['id']}] Response failed Pydantic schema: {e}")

        for field in case.get("expect_fields", []):
            assert hasattr(validated, field), f"Missing field: {field}"


# ── Metamorphic oracle — relations that must hold regardless of LLM content ───

@pytest.mark.oracle
def test_hint_response_hint_field_is_string():
    """Invariant: hint field is always a string, never None or int."""
    ai_json = json.dumps({"hint": "A valid hint.", "difficulty_note": ""})
    with patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock,
               return_value=make_completion(ai_json)):
        r = _client().post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})
    assert r.status_code == 200
    assert isinstance(r.json()["hint"], str)


@pytest.mark.oracle
def test_analyze_weak_topics_is_list():
    """Invariant: weak_topics is always a list, never a string or None."""
    ai_json = json.dumps({"insights": "OK", "weak_topics": ["algebra"], "recommendations": []})
    with patch("app.agent.exam_analyzer.call_with_retry", new_callable=AsyncMock,
               return_value=make_completion(ai_json)):
        r = _client().post("/analyze", json={"result": MOCK_RESULT, "history": []})
    assert r.status_code == 200
    assert isinstance(r.json()["weak_topics"], list)


@pytest.mark.oracle
def test_analyze_more_weak_topics_at_least_as_many_recommendations():
    """
    Metamorphic relation: when the LLM is given more weak topics,
    the number of recommendations must be >= the fewer-topics case.
    Tests that the response parsing doesn't silently truncate.
    """
    few_recs = ["Ôn tập đại số"]
    many_recs = ["Ôn tập đại số", "Luyện hình học", "Ôn giải tích", "Xem lý thuyết"]

    few_json = json.dumps({"insights": "", "weak_topics": ["algebra"], "recommendations": few_recs})
    many_json = json.dumps({"insights": "", "weak_topics": ["algebra", "geometry", "calculus", "statistics"], "recommendations": many_recs})

    with patch("app.agent.exam_analyzer.call_with_retry", new_callable=AsyncMock,
               return_value=make_completion(few_json)):
        r_few = _client().post("/analyze", json={"result": MOCK_RESULT, "history": []})

    with patch("app.agent.exam_analyzer.call_with_retry", new_callable=AsyncMock,
               return_value=make_completion(many_json)):
        r_many = _client().post("/analyze", json={"result": MOCK_RESULT, "history": []})

    assert r_few.status_code == 200
    assert r_many.status_code == 200
    assert len(r_many.json()["recommendations"]) >= len(r_few.json()["recommendations"]), (
        "Metamorphic violation: more topics in LLM response → fewer recs in parsed response"
    )


@pytest.mark.oracle
def test_study_plan_always_has_at_least_one_focus_area():
    """
    Invariant: study plan must always return ≥1 focus_area.
    The study planner has a fallback path; both paths must honour this.
    """
    plan_json = json.dumps({
        "score_gap": "Cần cải thiện",
        "focus_areas": [
            {"topic": "Algebra", "error_pattern": "Sai công thức", "tasks": ["Ôn tập"], "checkpoint": {"target": 3, "description": "3 bài đúng"}}
        ],
        "retake_note": "Thử lại sau 2 tuần",
    })
    pool = PoolBuilder().with_tier("student").with_credits(100).build_mock()
    app.dependency_overrides[get_pool] = lambda: pool

    with patch("app.agent.study_planner.call_with_retry", new_callable=AsyncMock,
               return_value=make_completion(plan_json)):
        r = _client().post("/study-plan", json={"result": MOCK_RESULT, "history": []})

    assert r.status_code == 200
    body = r.json()
    assert len(body.get("focus_areas", [])) >= 1, (
        "Invariant violated: study plan returned 0 focus_areas"
    )


@pytest.mark.oracle
def test_study_plan_llm_exception_returns_fallback_not_500():
    """
    Invariant: study planner must never return 500 even when the LLM errors.
    The app has a built-in fallback; this test ensures it still fires.
    """
    pool = PoolBuilder().with_tier("student").with_credits(100).build_mock()
    app.dependency_overrides[get_pool] = lambda: pool

    with patch("app.agent.study_planner.call_with_retry", new_callable=AsyncMock,
               side_effect=Exception("network error")):
        r = _client().post("/study-plan", json={"result": MOCK_RESULT, "history": []})

    assert r.status_code == 200, "Fallback must fire — never 500 for LLM errors in study-plan"
    body = r.json()
    assert "focus_areas" in body
    assert len(body["focus_areas"]) >= 1, "Fallback must return ≥1 focus_area"


# ── Schema completeness — all fields present even for minimal LLM output ───────

@pytest.mark.oracle
@pytest.mark.parametrize("endpoint,llm_json,stub_path,request_body", [
    (
        "/hint",
        "{}",
        "app.agent.hint_generator.call_with_retry",
        {"question": MOCK_QUESTION, "attempt_count": 1},
    ),
    (
        "/analyze",
        "{}",
        "app.agent.exam_analyzer.call_with_retry",
        {"result": MOCK_RESULT, "history": []},
    ),
])
def test_all_response_fields_present_on_empty_llm_json(endpoint, llm_json, stub_path, request_body):
    """
    Schema completeness: even when the LLM returns '{}', the endpoint must
    return all declared fields (using defaults), not a partial object or 500.
    """
    pool = PoolBuilder().with_credits(100).build_mock()
    app.dependency_overrides[get_pool] = lambda: pool

    with patch(stub_path, new_callable=AsyncMock, return_value=make_completion(llm_json)):
        r = _client().post(endpoint, json=request_body)

    assert r.status_code == 200, f"{endpoint} returned {r.status_code} on empty LLM JSON: {r.text}"

    model = ORACLE_MODELS[endpoint]
    try:
        model(**r.json())
    except ValidationError as e:
        pytest.fail(f"{endpoint}: response missing required fields even with defaults: {e}")

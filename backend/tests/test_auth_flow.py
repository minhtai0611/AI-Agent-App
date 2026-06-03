"""
Auth state machine tests — parametrized from fixtures/auth_flow_cases.yaml.

Adding a new test case: edit the YAML file only — no Python changes needed.

Coverage matrix (state × endpoint):
  anonymous    → /hint, /analyze, /study-plan → 401
  active       → /hint, /analyze, /study-plan → 200
  zero_credits → /hint, /analyze, /study-plan → 402
  tos_pending  → /hint, /analyze, /study-plan → 403 tos_not_accepted
  suspended    → /hint, /analyze             → 403 account_suspended
  basic_tier   → /study-plan                 → 403 tier_required
  boundary     → credits at exact cost point → 200 or 402
"""
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import yaml
from fastapi.testclient import TestClient
from fastapi import HTTPException

from app.main import app, get_pool
from app.dependencies import get_current_user, CurrentUser
from tests.builders import (
    PoolBuilder,
    make_completion,
    MOCK_QUESTION,
    MOCK_RESULT,
    ENDPOINT_DEFAULT_BODIES,
)

FIXTURE_DIR = Path(__file__).parent / "fixtures"

# Credits each endpoint deducts (used to set credits_update_succeeds correctly)
_ENDPOINT_COST = {"/hint": 1, "/analyze": 3, "/study-plan": 5, "/explain": 1}


# ── YAML loader ────────────────────────────────────────────────────────────────

def _load_auth_cases():
    with open(FIXTURE_DIR / "auth_flow_cases.yaml") as f:
        return yaml.safe_load(f)


# ── LLM stub ──────────────────────────────────────────────────────────────────

_HINT_JSON = json.dumps({"hint": "Test hint.", "difficulty_note": ""})
_ANALYZE_JSON = json.dumps({"insights": "Test.", "weak_topics": [], "recommendations": []})
_PLAN_JSON = json.dumps({
    "score_gap": "",
    "focus_areas": [{"topic": "Algebra", "error_pattern": "", "tasks": ["Task 1"], "checkpoint": {"target": 1, "description": "ok"}}],
    "retake_note": "",
})


@pytest.fixture(autouse=True)
def _stub_llm():
    """Patch all LLM call paths so auth tests never hit the real API."""
    with (
        patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock) as h,
        patch("app.agent.exam_analyzer.call_with_retry", new_callable=AsyncMock) as a,
        patch("app.agent.study_planner.call_with_retry", new_callable=AsyncMock) as p,
    ):
        h.return_value = make_completion(_HINT_JSON)
        a.return_value = make_completion(_ANALYZE_JSON)
        p.return_value = make_completion(_PLAN_JSON)
        yield


# ── Fixture helpers ────────────────────────────────────────────────────────────

def _build_pool(case: dict) -> MagicMock:
    """Build the right pool mock from a YAML case.
    Sets credits_update_succeeds=False whenever credits < endpoint cost,
    which causes _spend_credits to raise 402 as the real DB would.
    """
    credits = case.get("credits", 20)
    cost = _ENDPOINT_COST.get(case.get("endpoint", "/hint"), 1)
    builder = PoolBuilder(
        tier=case.get("tier", "student"),
        credits=credits,
        tos_accepted_at="2024-01-01T00:00:00" if case.get("tos", True) else None,
    )
    builder.credits_update_succeeds = credits >= cost
    return builder.build_mock()


def _make_suspended_user():
    """Mock get_current_user that raises 403 account_suspended."""
    def _suspended():
        raise HTTPException(
            status_code=403,
            detail={"code": "account_suspended", "reason": "Test suspension"},
        )
    return _suspended


@pytest.fixture
def _save_restore_overrides():
    """Save and restore app.dependency_overrides around each test."""
    saved = dict(app.dependency_overrides)
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(saved)


# ── Parametrized state machine test ───────────────────────────────────────────

@pytest.mark.parametrize("case", _load_auth_cases(), ids=lambda c: c["id"])
def test_auth_state_machine(case, _save_restore_overrides):
    """
    Each YAML row is one transition in the auth state machine.
    The test verifies the correct HTTP status is returned and, when specified,
    the correct error_code appears in the response body.
    """
    auth_state = case.get("auth", "active")
    endpoint = case["endpoint"]
    expect_status = case["expect_status"]
    expect_error_code = case.get("expect_error_code")

    body = ENDPOINT_DEFAULT_BODIES.get(endpoint, {})

    if auth_state == "anonymous":
        # Remove all auth overrides — raw request with no JWT
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_pool, None)
        client = TestClient(app, raise_server_exceptions=False)

    elif auth_state == "suspended":
        app.dependency_overrides[get_current_user] = _make_suspended_user()
        app.dependency_overrides[get_pool] = lambda: PoolBuilder().build_mock()
        client = TestClient(app, raise_server_exceptions=False)

    else:  # "active" with various credit/tos/tier states
        pool_mock = _build_pool(case)
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(user_id=1, email="test@example.com")
        app.dependency_overrides[get_pool] = lambda: pool_mock
        client = TestClient(app, raise_server_exceptions=False)

    r = client.post(endpoint, json=body)

    assert r.status_code == expect_status, (
        f"[{case['id']}] Expected HTTP {expect_status}, got {r.status_code}.\n"
        f"  description: {case['description']}\n"
        f"  body: {r.text[:300]}"
    )

    if expect_error_code:
        body_json = r.json()
        detail = body_json.get("detail", {})
        if isinstance(detail, dict):
            actual_code = detail.get("code", "")
        else:
            actual_code = str(detail)
        assert expect_error_code in actual_code, (
            f"[{case['id']}] Expected error_code '{expect_error_code}' in detail, "
            f"got: {detail!r}"
        )

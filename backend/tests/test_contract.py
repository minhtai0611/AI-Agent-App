"""
Contract tests — Schemathesis auto-generates inputs from the OpenAPI schema
and fires them against the live ASGI app (no live server needed).

What this catches that unit tests cannot:
  - Any endpoint returning 500 on edge-value inputs (boundary values, nulls, etc.)
  - Response bodies that don't match the declared schema
  - Light security fuzzing: oversized strings, special characters

Run with:
    PYTHONPATH=backend pytest backend/tests/test_contract.py -v
    PYTHONPATH=backend pytest backend/tests/test_contract.py -v --hypothesis-seed=0

Adding new assertions: add another @schema.parametrize() function below.
"""
import json
import os

import pytest
from unittest.mock import AsyncMock, patch

schemathesis = pytest.importorskip("schemathesis", reason="pip install schemathesis")

os.environ.setdefault("ANTHROPIC_AUTH_TOKEN", "test-token")
os.environ.setdefault("JWT_SECRET", "x" * 32)
os.environ.setdefault("ADMIN_KEY", "test-admin-key-static")
os.environ.setdefault("ADMIN_MASTER_SECRET", "")

from app.main import app, get_pool  # noqa: E402
from app.dependencies import get_current_user, CurrentUser  # noqa: E402
from tests.builders import PoolBuilder, make_completion  # noqa: E402

# ── Schema ────────────────────────────────────────────────────────────────────
# Build the schema once at module level. /openapi.json is public so no auth needed.
_pool = PoolBuilder().with_tier("student").with_credits(100).build_mock()

schema = schemathesis.openapi.from_asgi("/openapi.json", app)

# ── Shared fixtures ───────────────────────────────────────────────────────────

_HINT_JSON    = json.dumps({"hint": "stub", "difficulty_note": ""})
_ANALYZE_JSON = json.dumps({"insights": "", "weak_topics": [], "recommendations": []})
_PLAN_JSON    = json.dumps({
    "score_gap": "",
    "focus_areas": [{"topic": "t", "error_pattern": "", "tasks": [],
                     "checkpoint": {"target": 1, "description": ""}}],
    "retake_note": "",
})



@pytest.fixture(autouse=True)
def _set_contract_overrides():
    """Set auth + pool overrides for each test; restore afterwards."""
    saved = dict(app.dependency_overrides)
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id=1, email="contract@test.com"
    )
    app.dependency_overrides[get_pool] = lambda: _pool
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(saved)


@pytest.fixture(autouse=True)
def _stub_all_llm():
    """Prevent generated requests from calling the real LLM API."""
    with (
        patch("app.agent.hint_generator.call_with_retry",
              new_callable=AsyncMock, return_value=make_completion(_HINT_JSON)),
        patch("app.agent.exam_analyzer.call_with_retry",
              new_callable=AsyncMock, return_value=make_completion(_ANALYZE_JSON)),
        patch("app.agent.study_planner.call_with_retry",
              new_callable=AsyncMock, return_value=make_completion(_PLAN_JSON)),
    ):
        yield


# ── Contract rule 1: no 500s on any generated input ──────────────────────────

@schema.parametrize()
def test_no_server_error_on_generated_input(case):
    """
    Core invariant: the server must NEVER return 500 for any input.

    Schemathesis auto-generates:
      - Valid boundary values (min, max, empty string, None)
      - Oversized strings (potential injection / buffer overflow)
      - Type mismatches (string where int expected, etc.)

    400/401/402/403/422/429 are expected and acceptable.
    500 = unhandled exception = bug.
    """
    response = case.call()
    assert response.status_code != 500, (
        f"[{case.method} {case.path}] returned 500 on generated input.\n"
        f"  body: {getattr(case, 'body', None)}\n"
        f"  response: {response.text[:400]}"
    )


# ── Contract rule 2: response shape matches declared schema ──────────────────

@schema.parametrize()
def test_get_responses_conform_to_schema(case):
    """
    Every 200 response from a GET endpoint must validate against the
    declared OpenAPI response schema. POST endpoints are skipped because
    many require specific DB state to reach 200.
    """
    if case.method.upper() != "GET":
        pytest.skip("Schema conformance only checked for GET endpoints")
    response = case.call()
    if response.status_code == 200:
        try:
            case.validate_response(response)
        except Exception as exc:
            pytest.fail(
                f"GET {case.path}: response body doesn't match OpenAPI schema.\n"
                f"  error: {exc}\n"
                f"  body: {response.text[:300]}"
            )


# ── Smoke checks (always run, fast, no Hypothesis) ────────────────────────────

def test_health_endpoint():
    from fastapi.testclient import TestClient
    r = TestClient(app).get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_openapi_schema_has_minimum_endpoints():
    from fastapi.testclient import TestClient
    r = TestClient(app).get("/openapi.json")
    assert r.status_code == 200
    paths = r.json().get("paths", {})
    assert len(paths) >= 10, f"Schema only has {len(paths)} paths — may be misconfigured"

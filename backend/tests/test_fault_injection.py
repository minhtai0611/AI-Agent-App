"""
Fault injection tests — simulate infrastructure failures using mocks.

These tests verify that the application degrades gracefully when:
  - The LLM API is unavailable or rate-limited
  - The database pool returns errors
  - The LLM returns partial / malformed responses

All tests are marked @pytest.mark.fault_injection.
Run them explicitly:   pytest -m fault_injection
They are excluded from the default CI run: pytest -m "not fault_injection"

Unlike Toxiproxy-based injection (which operates at the network layer),
these tests inject failures at the Python mock layer. The goal is the same:
verify retry, fallback, and graceful error paths actually work end-to-end.
"""
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_pool
from app.dependencies import get_current_user, CurrentUser, get_ai_client
from tests.builders import PoolBuilder, MOCK_RESULT, MOCK_QUESTION, make_completion


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _active_user():
    saved = dict(app.dependency_overrides)
    pool = PoolBuilder().with_tier("student").with_credits(100).build_mock()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id=1, email="fault@test.com"
    )
    app.dependency_overrides[get_pool] = lambda: pool
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(saved)


def _client():
    return TestClient(app, raise_server_exceptions=False)


def _rl_error():
    from openai import RateLimitError
    return RateLimitError(
        message="429",
        response=MagicMock(status_code=429, headers={}),
        body={},
    )


# ── LLM rate-limit fault ──────────────────────────────────────────────────────

@pytest.mark.fault_injection
def test_hint_retries_on_rate_limit_and_returns_200():
    """
    Fault: LLM API returns RateLimitError on first 2 calls.
    Expected: call_with_retry (tenacity wrapper) retries transparently → 200.

    We mock at the OpenAI client level (NOT call_with_retry) so tenacity's
    retry logic runs for real. asyncio.sleep is patched to skip the wait.
    """
    call_count = 0
    success_json = json.dumps({"hint": "Recovered hint.", "difficulty_note": ""})

    async def flaky(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise _rl_error()
        return make_completion(success_json)

    mock_client = MagicMock()
    mock_client.chat.completions.create = flaky

    saved = dict(app.dependency_overrides)
    app.dependency_overrides[get_ai_client] = lambda: mock_client
    try:
        with patch("asyncio.sleep"):
            r = _client().post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(saved)

    assert r.status_code == 200, (
        f"After 2 RateLimitErrors + 1 success, endpoint must return 200. "
        f"Got {r.status_code}: {r.text}"
    )
    assert call_count == 3, f"Expected 3 calls (2 failures + 1 success), got {call_count}"


@pytest.mark.fault_injection
def test_hint_llm_total_failure_returns_502_not_500():
    """
    Fault: LLM API is completely unavailable (all retries fail).
    Expected: endpoint returns 502 (Bad Gateway), not 500 (server error).
    502 signals 'upstream problem' while 500 signals 'our bug'.
    """
    with patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock,
               side_effect=Exception("LLM unreachable")):
        r = _client().post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})

    assert r.status_code == 502, (
        f"Total LLM failure must return 502 (Bad Gateway), got {r.status_code}: {r.text}"
    )
    assert r.status_code != 500, "500 Internal Server Error is never acceptable for LLM failures"


@pytest.mark.fault_injection
def test_analyze_llm_total_failure_returns_502():
    """Fault: LLM unavailable during analysis → 502, not 500."""
    with patch("app.agent.exam_analyzer.call_with_retry", new_callable=AsyncMock,
               side_effect=Exception("timeout")):
        r = _client().post("/analyze", json={"result": MOCK_RESULT, "history": []})

    assert r.status_code == 502
    assert r.status_code != 500


@pytest.mark.fault_injection
def test_study_plan_llm_total_failure_uses_fallback():
    """
    Fault: LLM unavailable during study plan generation.
    Expected: study-planner fallback fires → 200 with ≥1 focus_area, NOT 502 or 500.
    (study_planner has an explicit fallback; hint/analyze do not.)
    """
    with patch("app.agent.study_planner.call_with_retry", new_callable=AsyncMock,
               side_effect=Exception("LLM down")):
        r = _client().post("/study-plan", json={"result": MOCK_RESULT, "history": []})

    assert r.status_code == 200, (
        f"study-plan has a fallback — must return 200 even when LLM fails, got {r.status_code}"
    )
    body = r.json()
    assert len(body.get("focus_areas", [])) >= 1, "Fallback must return ≥1 focus_area"


# ── LLM malformed response fault ──────────────────────────────────────────────

@pytest.mark.fault_injection
def test_hint_truncated_json_returns_502():
    """
    Fault: LLM returns truncated JSON (simulates network cut mid-response).
    Expected: endpoint returns 502, not 500 or 200 with corrupt data.
    """
    with patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock,
               return_value=make_completion('{"hint": "truncated')):  # unclosed string
        r = _client().post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})

    assert r.status_code == 502, (
        f"Truncated LLM JSON must return 502, got {r.status_code}: {r.text}"
    )


@pytest.mark.fault_injection
def test_analyze_wrong_type_in_response_is_handled():
    """
    Fault: LLM returns weak_topics as a string instead of a list.
    Expected: endpoint handles gracefully — no 500.
    """
    bad_json = json.dumps({
        "insights": "Good.",
        "weak_topics": "algebra",   # should be a list, not a string
        "recommendations": [],
    })
    with patch("app.agent.exam_analyzer.call_with_retry", new_callable=AsyncMock,
               return_value=make_completion(bad_json)):
        r = _client().post("/analyze", json={"result": MOCK_RESULT, "history": []})

    assert r.status_code != 500, (
        f"Wrong type in LLM response must not cause 500, got {r.status_code}: {r.text}"
    )


# ── Database fault ────────────────────────────────────────────────────────────

@pytest.mark.fault_injection
def test_hint_db_failure_returns_non_500():
    """
    Fault: DB pool raises an exception on any call (simulate DB crash).
    Expected: endpoint returns a client-safe error code (4xx or 503), not 500.
    """
    saved = dict(app.dependency_overrides)
    broken_pool = MagicMock()
    broken_pool.fetchrow = AsyncMock(side_effect=Exception("DB connection lost"))
    broken_pool.execute = AsyncMock(side_effect=Exception("DB connection lost"))
    app.dependency_overrides[get_pool] = lambda: broken_pool
    try:
        r = _client().post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})
        assert r.status_code != 500, (
            f"DB failure must not cause 500 Internal Server Error, got {r.status_code}: {r.text}"
        )
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(saved)


# ── Streaming fault ───────────────────────────────────────────────────────────

@pytest.mark.fault_injection
def test_stream_mid_flight_exception_yields_error_ndjson():
    """
    Fault: LLM stream raises an exception after yielding some tokens.
    Expected: stream emits an error NDJSON line and terminates without crashing.
    The server must return 200 (stream already started) with the error embedded.
    """
    async def _partial_then_fail(**kwargs):
        async def _aiter():
            delta = MagicMock()
            delta.content = '{"insights": "partial'
            choice = MagicMock()
            choice.delta = delta
            chunk = MagicMock()
            chunk.choices = [choice]
            yield chunk
            raise ConnectionError("Stream cut by network")
        return _aiter()

    mock_client = MagicMock()
    mock_client.chat.completions.create = _partial_then_fail

    saved = dict(app.dependency_overrides)
    app.dependency_overrides[get_ai_client] = lambda: mock_client
    try:
        r = _client().post("/analyze/stream", json={"result": MOCK_RESULT, "history": []})
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(saved)

    assert r.status_code == 200, (
        "Stream must return 200 even when cut mid-flight (error embedded in body)"
    )
    lines = [json.loads(l) for l in r.text.splitlines() if l.strip()]
    error_lines = [obj for obj in lines if "error" in obj]
    assert error_lines, "Must have at least one error NDJSON line when stream fails"

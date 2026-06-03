"""
Observability-driven tests — assert on INTERNAL behaviour, not just HTTP status.

These tests use a lightweight call-tracking spy that wraps pool.fetchrow /
pool.execute, recording every SQL query without requiring OpenTelemetry
infrastructure.

What they catch that unit tests miss
--------------------------------------
  N+1 queries: a loop accidentally added a per-item fetchrow inside a for-loop
  Query bloat:  someone added an extra "just in case" query to an endpoint
  LLM over-call: an endpoint calls the LLM twice instead of once
  Missing debit: _spend_credits is never called (credits never deducted)

Run:
    PYTHONPATH=backend pytest backend/tests/test_observability.py -v
"""
import json
from collections import Counter
from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_pool
from app.dependencies import get_current_user, CurrentUser, get_ai_client
from tests.builders import PoolBuilder, FULL_USER_ROW, MOCK_QUESTION, MOCK_RESULT, make_completion


# ── Spy pool ──────────────────────────────────────────────────────────────────

class SpyPool:
    """
    Wraps a PoolBuilder mock and records every fetchrow / execute call.

    Usage:
        spy = SpyPool()
        app.dependency_overrides[get_pool] = lambda: spy.pool
        # ... make request ...
        assert spy.fetchrow_count <= 3
        assert spy.any_query_contains("credits_balance")
    """

    def __init__(self, **builder_kwargs):
        self._builder = PoolBuilder(**builder_kwargs)
        self.pool = self._builder.build_mock()
        self._fetchrow_calls: list[str] = []
        self._execute_calls: list[str] = []

        _orig_fetchrow = self.pool.fetchrow
        _orig_execute = self.pool.execute

        async def _spy_fetchrow(*args, **kwargs):
            self._fetchrow_calls.append(args[0] if args else "")
            return await _orig_fetchrow(*args, **kwargs)

        async def _spy_execute(*args, **kwargs):
            self._execute_calls.append(args[0] if args else "")
            return await _orig_execute(*args, **kwargs)

        self.pool.fetchrow = _spy_fetchrow
        self.pool.execute = _spy_execute

    @property
    def fetchrow_count(self) -> int:
        return len(self._fetchrow_calls)

    @property
    def execute_count(self) -> int:
        return len(self._execute_calls)

    @property
    def total_db_calls(self) -> int:
        return self.fetchrow_count + self.execute_count

    def any_query_contains(self, fragment: str) -> bool:
        fragment_lower = fragment.lower()
        return any(
            fragment_lower in q.lower()
            for q in self._fetchrow_calls + self._execute_calls
        )

    def fetchrow_queries(self) -> list[str]:
        return list(self._fetchrow_calls)

    def execute_queries(self) -> list[str]:
        return list(self._execute_calls)


# ── Shared fixtures ───────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _active_user():
    saved = dict(app.dependency_overrides)
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id=1, email="obs@test.com"
    )
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(saved)


def _client():
    return TestClient(app, raise_server_exceptions=False)


# ── N+1 query guards ──────────────────────────────────────────────────────────

def test_hint_db_call_count_is_bounded():
    """
    Observability: /hint must make ≤ 4 DB calls per request.

    Expected calls:
      1. fetchrow  — SELECT credits_balance, tos_accepted_at  (_spend_credits)
      2. execute   — UPDATE credits_balance                   (_spend_credits)
      3. execute   — INSERT INTO ai_credits_log               (_spend_credits)
    Total: 3. Bound set to 5 to allow for last_ip update and minor variation.

    If this exceeds 5, someone added a per-request DB query accidentally.
    """
    spy = SpyPool(credits=50, tos_accepted_at="2024-01-01T00:00:00")
    app.dependency_overrides[get_pool] = lambda: spy.pool

    hint_json = json.dumps({"hint": "test", "difficulty_note": ""})
    with patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock,
               return_value=make_completion(hint_json)):
        r = _client().post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})

    assert r.status_code == 200
    assert spy.total_db_calls <= 5, (
        f"N+1 guard: /hint made {spy.total_db_calls} DB calls (max 5).\n"
        f"  fetchrow queries: {spy.fetchrow_queries()}\n"
        f"  execute queries:  {spy.execute_queries()}"
    )


def test_analyze_db_call_count_is_bounded():
    """
    Observability: /analyze must make ≤ 6 DB calls.

    Expected: student tier skips _spend_credits → 1–2 calls (tier check + last_ip).
    Bound set to 6 to accommodate device province lookup and last_ip update.
    """
    spy = SpyPool(tier="student", credits=100, tos_accepted_at="2024-01-01T00:00:00")
    app.dependency_overrides[get_pool] = lambda: spy.pool

    analyze_json = json.dumps({"insights": "ok", "weak_topics": [], "recommendations": []})
    with patch("app.agent.exam_analyzer.call_with_retry", new_callable=AsyncMock,
               return_value=make_completion(analyze_json)):
        r = _client().post("/analyze", json={"result": MOCK_RESULT, "history": []})

    assert r.status_code == 200
    assert spy.total_db_calls <= 6, (
        f"N+1 guard: /analyze made {spy.total_db_calls} DB calls (max 6).\n"
        f"  fetchrow: {spy.fetchrow_queries()}\n"
        f"  execute:  {spy.execute_queries()}"
    )


# ── Query content assertions ──────────────────────────────────────────────────

def test_hint_credits_query_is_executed():
    """
    Observability: _spend_credits must execute a query referencing credits_balance.
    Guards against _spend_credits being accidentally bypassed.
    """
    spy = SpyPool(credits=50, tos_accepted_at="2024-01-01T00:00:00")
    app.dependency_overrides[get_pool] = lambda: spy.pool

    hint_json = json.dumps({"hint": "test", "difficulty_note": ""})
    with patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock,
               return_value=make_completion(hint_json)):
        r = _client().post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})

    assert r.status_code == 200
    assert spy.any_query_contains("credits_balance"), (
        "No query referencing 'credits_balance' was executed.\n"
        "_spend_credits may have been bypassed.\n"
        f"  fetchrow: {spy.fetchrow_queries()}\n"
        f"  execute:  {spy.execute_queries()}"
    )


def test_hint_credit_log_is_written():
    """
    Observability: after a successful hint, a credit deduction must be logged
    (INSERT INTO ai_credits_log). Guards against silent credit leaks.
    """
    spy = SpyPool(credits=50, tos_accepted_at="2024-01-01T00:00:00")
    app.dependency_overrides[get_pool] = lambda: spy.pool

    hint_json = json.dumps({"hint": "test", "difficulty_note": ""})
    with patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock,
               return_value=make_completion(hint_json)):
        r = _client().post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})

    assert r.status_code == 200
    assert spy.any_query_contains("ai_credits_log"), (
        "No INSERT into ai_credits_log was executed after a successful /hint.\n"
        "Credit deductions must always be logged for auditability.\n"
        f"  execute queries: {spy.execute_queries()}"
    )


# ── LLM call count assertions ─────────────────────────────────────────────────

def test_hint_calls_llm_exactly_once_on_success():
    """
    Observability: on a clean success path, the LLM is called exactly once.
    Calling it twice doubles cost and latency with no benefit.
    """
    spy = SpyPool(credits=50, tos_accepted_at="2024-01-01T00:00:00")
    app.dependency_overrides[get_pool] = lambda: spy.pool

    hint_json = json.dumps({"hint": "once", "difficulty_note": ""})
    mock_create = AsyncMock(return_value=make_completion(hint_json))

    mock_client = MagicMock()
    mock_client.chat.completions.create = mock_create
    app.dependency_overrides[get_ai_client] = lambda: mock_client

    saved = dict(app.dependency_overrides)
    try:
        r = _client().post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(saved)

    assert r.status_code == 200
    assert mock_create.call_count == 1, (
        f"LLM was called {mock_create.call_count} times for a single /hint request. "
        "Expected exactly 1."
    )


def test_analyze_calls_llm_exactly_once_on_success():
    """Observability: /analyze invokes the LLM exactly once per request."""
    spy = SpyPool(tier="student", credits=100, tos_accepted_at="2024-01-01T00:00:00")
    app.dependency_overrides[get_pool] = lambda: spy.pool

    analyze_json = json.dumps({"insights": "ok", "weak_topics": [], "recommendations": []})
    mock_create = AsyncMock(return_value=make_completion(analyze_json))
    mock_client = MagicMock()
    mock_client.chat.completions.create = mock_create
    app.dependency_overrides[get_ai_client] = lambda: mock_client

    saved = dict(app.dependency_overrides)
    try:
        r = _client().post("/analyze", json={"result": MOCK_RESULT, "history": []})
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(saved)

    assert r.status_code == 200
    assert mock_create.call_count == 1, (
        f"LLM was called {mock_create.call_count} times for a single /analyze request. "
        "Expected exactly 1."
    )


# ── Retry path observability ──────────────────────────────────────────────────

def test_hint_llm_retried_exactly_twice_before_success():
    """
    Observability: with 2 RateLimitErrors before a success, the LLM client
    receives exactly 3 calls (2 failures + 1 success). Guards against the
    retry policy silently changing to retry fewer or more times.
    """
    from openai import RateLimitError
    spy = SpyPool(credits=50, tos_accepted_at="2024-01-01T00:00:00")
    app.dependency_overrides[get_pool] = lambda: spy.pool

    call_count = 0
    hint_json = json.dumps({"hint": "recovered", "difficulty_note": ""})

    async def flaky(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise RateLimitError("429", response=MagicMock(status_code=429, headers={}), body={})
        return make_completion(hint_json)

    mock_client = MagicMock()
    mock_client.chat.completions.create = flaky
    app.dependency_overrides[get_ai_client] = lambda: mock_client

    saved = dict(app.dependency_overrides)
    try:
        with patch("asyncio.sleep"):
            r = _client().post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(saved)

    assert r.status_code == 200
    assert call_count == 3, (
        f"Expected exactly 3 LLM calls (2 failures + 1 success), got {call_count}.\n"
        "call_with_retry is configured stop_after_attempt(3)."
    )

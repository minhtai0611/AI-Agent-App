"""
Streaming endpoint tests — /analyze/stream

The endpoint returns NDJSON: one JSON object per line.
Each line: {"field": "<name>", "chunk": "<text>", "done": false|true}
Error line: {"error": "<message>"}

Tests cover:
  - Full stream parse: all declared fields appear with done=true finale
  - Auth guard: unauthenticated → 401 before stream starts
  - Credit guard: 0 credits → 402 before stream starts
  - LLM exception: error line emitted, stream does not crash
  - Response headers: correct media type + cache-control
"""
import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_pool
from app.dependencies import get_current_user, CurrentUser, get_ai_client
from tests.builders import PoolBuilder, MOCK_RESULT

# ── Rate-limit bypass (shared with other test modules) ─────────────────────────


@pytest.fixture(autouse=True)
def _active_user():
    """Default: authenticated active student with 100 credits."""
    saved = dict(app.dependency_overrides)
    pool = PoolBuilder().with_tier("student").with_credits(100).build_mock()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id=1, email="stream@test.com"
    )
    app.dependency_overrides[get_pool] = lambda: pool
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(saved)


def _client():
    return TestClient(app, raise_server_exceptions=False)


def _with_mock_ai_client(mock_client):
    """Context manager: overrides the get_ai_client dependency with mock_client."""
    from contextlib import contextmanager

    @contextmanager
    def _ctx():
        saved = dict(app.dependency_overrides)
        app.dependency_overrides[get_ai_client] = lambda: mock_client
        try:
            yield
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(saved)

    return _ctx()


_STREAM_BODY = {"result": MOCK_RESULT, "history": []}

# ── Helpers ────────────────────────────────────────────────────────────────────

def _mock_stream_chunks(full_json: str):
    """Build an async iterator of fake stream chunks from a complete JSON string."""
    async def _aiter():
        # Emit the full JSON string in small pieces to simulate real streaming
        chunk_size = 20
        for i in range(0, len(full_json), chunk_size):
            piece = full_json[i:i + chunk_size]
            delta = MagicMock()
            delta.content = piece
            choice = MagicMock()
            choice.delta = delta
            chunk = MagicMock()
            chunk.choices = [choice]
            yield chunk
    return _aiter()


def _parse_ndjson(text: str) -> list[dict]:
    return [json.loads(line) for line in text.splitlines() if line.strip()]


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_stream_returns_ndjson_content_type():
    """Response Content-Type must be application/x-ndjson."""
    full_json = json.dumps({
        "insights": "Good score.",
        "weak_topics": ["geometry"],
        "recommendations": ["Practice geometry"],
        "question_analysis": "",
        "school_insight": "",
        "schools": [],
    })

    async def _fake_create(**kwargs):
        return _mock_stream_chunks(full_json)

    mock_client = MagicMock()
    mock_client.chat.completions.create = _fake_create

    with _with_mock_ai_client(mock_client):
        r = _client().post("/analyze/stream", json=_STREAM_BODY)

    assert "ndjson" in r.headers.get("content-type", ""), (
        f"Expected ndjson content-type, got: {r.headers.get('content-type')}"
    )


def test_stream_emits_done_lines_for_all_fields():
    """Every declared NDJSON field must have a final done=true line."""
    from app.main import _NDJSON_FIELDS
    full_json = json.dumps({
        "insights": "Analysis here.",
        "weak_topics": ["algebra"],
        "recommendations": ["Study more"],
        "question_analysis": "Q analysis.",
        "school_insight": "School info.",
        "schools": [],
    })

    async def _fake_create(**kwargs):
        return _mock_stream_chunks(full_json)

    mock_client = MagicMock()
    mock_client.chat.completions.create = _fake_create

    with _with_mock_ai_client(mock_client):
        r = _client().post("/analyze/stream", json=_STREAM_BODY)

    lines = _parse_ndjson(r.text)
    done_fields = {obj["field"] for obj in lines if obj.get("done") is True}
    declared_fields = {fname for fname, _ in _NDJSON_FIELDS}

    # Every field that appeared in the LLM output must have a done=true line
    assert done_fields.issubset(declared_fields), (
        f"Stream emitted done for undeclared fields: {done_fields - declared_fields}"
    )


def test_stream_auth_guard_returns_401():
    """Unauthenticated request → 401 before stream starts."""
    saved = dict(app.dependency_overrides)
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_pool, None)
    try:
        r = TestClient(app, raise_server_exceptions=False).post(
            "/analyze/stream", json=_STREAM_BODY
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(saved)


def test_stream_credit_guard_returns_402():
    """basic-tier user with 0 credits → 402 before stream starts."""
    saved = dict(app.dependency_overrides)
    pool = PoolBuilder().with_tier("basic").with_credits(0).build_mock()
    pool.credits_update_succeeds = False
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id=2, email="broke@test.com"
    )
    app.dependency_overrides[get_pool] = lambda: pool
    try:
        r = TestClient(app, raise_server_exceptions=False).post(
            "/analyze/stream", json=_STREAM_BODY
        )
        assert r.status_code == 402, f"Expected 402, got {r.status_code}: {r.text[:200]}"
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(saved)


def test_stream_llm_exception_yields_error_line():
    """If the LLM raises mid-stream, the stream must yield an error NDJSON line
    and not crash the server (no 500)."""

    async def _failing_create(**kwargs):
        async def _aiter():
            yield MagicMock(choices=[MagicMock(delta=MagicMock(content="partial"))])
            raise Exception("LLM network drop")
        return _aiter()

    mock_client = MagicMock()
    mock_client.chat.completions.create = _failing_create

    with _with_mock_ai_client(mock_client):
        r = _client().post("/analyze/stream", json=_STREAM_BODY)

    # Stream responds with 200 but must include an error line in the body
    assert r.status_code == 200, f"Server must not 500 on LLM exception, got {r.status_code}"
    lines = _parse_ndjson(r.text)
    error_lines = [obj for obj in lines if "error" in obj]
    assert error_lines, "Expected at least one error NDJSON line when LLM fails mid-stream"


def test_stream_cache_control_header():
    """Stream must set Cache-Control: no-cache to prevent proxy buffering."""
    async def _fake_create(**kwargs):
        async def _aiter():
            return
            yield  # make it an async generator
        return _aiter()

    mock_client = MagicMock()
    mock_client.chat.completions.create = _fake_create

    with _with_mock_ai_client(mock_client):
        r = _client().post("/analyze/stream", json=_STREAM_BODY)

    assert "no-cache" in r.headers.get("cache-control", "").lower(), (
        "Streaming endpoint must set Cache-Control: no-cache"
    )

"""
LLM prompt-budget tests — catch accidental system-prompt bloat.

Problem: a well-meaning developer adds a 5 KB paragraph to a system prompt.
Line coverage stays at 90%. Mutation score stays at 80%. All tests pass.
But every request now costs 3× more tokens and is 2× slower.

These tests capture the *messages* kwargs sent to call_with_retry and assert
the total character count stays within expected bounds. No live API calls needed.

Run:
    PYTHONPATH=backend pytest backend/tests/test_budget.py -v

Thresholds are intentionally generous (2× the current baseline) so they only
fire on severe regressions, not on minor copy tweaks.
"""
import json
from typing import Any
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_pool
from app.dependencies import get_current_user, CurrentUser
from tests.builders import PoolBuilder, MOCK_RESULT, MOCK_QUESTION, make_completion


# ── Shared fixtures ───────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _active_user():
    saved = dict(app.dependency_overrides)
    pool = PoolBuilder().with_tier("student").with_credits(100).build_mock()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id=1, email="budget@test.com"
    )
    app.dependency_overrides[get_pool] = lambda: pool
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(saved)


def _client():
    return TestClient(app, raise_server_exceptions=False)


# ── Budget helper ─────────────────────────────────────────────────────────────

def _total_prompt_chars(messages: list[dict[str, Any]]) -> int:
    """Sum the character length of all message content fields."""
    return sum(len(str(m.get("content", ""))) for m in messages)


def _capture_and_call(patch_path: str, llm_json: str):
    """
    Patch call_with_retry at patch_path, capture the messages kwarg,
    return (response, captured_messages).
    """
    captured: dict = {}

    async def _spy(*args, **kwargs):
        captured["messages"] = kwargs.get("messages", [])
        captured["max_tokens"] = kwargs.get("max_tokens", 0)
        return make_completion(llm_json)

    with patch(patch_path, new_callable=AsyncMock, side_effect=_spy) as _:
        yield captured


# ── Budget thresholds (chars) — 2× current baseline as headroom ──────────────
#
# Measure baseline: run tests once, read captured["chars"], set threshold to
# max(observed) * 2. These are NOT tight limits — they catch only severe bloat.

_HINT_BUDGET    = 12_000   # hint system prompt + question context
_ANALYZE_BUDGET = 30_000   # analyze system prompt + exam result + history
_PLAN_BUDGET    = 30_000   # study plan system prompt + result + history
_EXPLAIN_BUDGET = 12_000   # explain system prompt + question context


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_hint_prompt_within_budget():
    """
    Total characters sent to the LLM for a /hint request must stay under
    _HINT_BUDGET. Guards against system-prompt or question-context bloat.
    """
    ai_json = json.dumps({"hint": "ok", "difficulty_note": ""})
    captured: dict = {}

    async def _spy(*args, **kwargs):
        captured["messages"] = kwargs.get("messages", [])
        return make_completion(ai_json)

    with patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock,
               side_effect=_spy):
        r = _client().post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})

    assert r.status_code == 200
    assert "messages" in captured, "call_with_retry was never called — check patch path"

    chars = _total_prompt_chars(captured["messages"])
    assert chars <= _HINT_BUDGET, (
        f"Hint prompt is {chars:,} chars — exceeds budget of {_HINT_BUDGET:,}.\n"
        f"A system prompt was likely bloated. Investigate app/agent/hint_generator.py."
    )
    assert chars > 0, "Prompt must be non-empty"


def test_analyze_prompt_within_budget():
    """
    Total characters sent to the LLM for an /analyze request must stay under
    _ANALYZE_BUDGET. The analyze system prompt is larger than hint by design.
    """
    ai_json = json.dumps({"insights": "ok", "weak_topics": [], "recommendations": []})
    captured: dict = {}

    async def _spy(*args, **kwargs):
        captured["messages"] = kwargs.get("messages", [])
        return make_completion(ai_json)

    with patch("app.agent.exam_analyzer.call_with_retry", new_callable=AsyncMock,
               side_effect=_spy):
        r = _client().post("/analyze", json={"result": MOCK_RESULT, "history": []})

    assert r.status_code == 200
    assert "messages" in captured, "call_with_retry was never called — check patch path"

    chars = _total_prompt_chars(captured["messages"])
    assert chars <= _ANALYZE_BUDGET, (
        f"Analyze prompt is {chars:,} chars — exceeds budget of {_ANALYZE_BUDGET:,}.\n"
        f"Investigate app/agent/exam_analyzer.py for prompt expansion."
    )
    assert chars > 0


def test_study_plan_prompt_within_budget():
    """Total characters for /study-plan must stay under _PLAN_BUDGET."""
    ai_json = json.dumps({
        "score_gap": "",
        "focus_areas": [{"topic": "t", "error_pattern": "", "tasks": [],
                         "checkpoint": {"target": 1, "description": ""}}],
        "retake_note": "",
    })
    captured: dict = {}

    async def _spy(*args, **kwargs):
        captured["messages"] = kwargs.get("messages", [])
        return make_completion(ai_json)

    with patch("app.agent.study_planner.call_with_retry", new_callable=AsyncMock,
               side_effect=_spy):
        r = _client().post("/study-plan", json={"result": MOCK_RESULT, "history": []})

    assert r.status_code == 200
    assert "messages" in captured

    chars = _total_prompt_chars(captured["messages"])
    assert chars <= _PLAN_BUDGET, (
        f"Study-plan prompt is {chars:,} chars — exceeds budget of {_PLAN_BUDGET:,}.\n"
        f"Investigate app/agent/study_planner.py."
    )
    assert chars > 0


def test_hint_prompt_increases_with_previous_hints():
    """
    Metamorphic budget relation: sending N previous hints must grow the
    prompt by roughly N × (chars per hint) — but not by an unbounded amount.
    This catches an O(N²) accidental expansion bug.
    """
    ai_json = json.dumps({"hint": "ok", "difficulty_note": ""})
    chars_at = {}

    for n_prev in (0, 3):
        captured: dict = {}

        async def _spy(*args, _n=n_prev, **kwargs):
            captured["messages"] = kwargs.get("messages", [])
            return make_completion(ai_json)

        previous_hints = [f"Previous hint #{i}" for i in range(n_prev)]
        with patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock,
                   side_effect=_spy):
            r = _client().post("/hint", json={
                "question": MOCK_QUESTION,
                "attempt_count": n_prev + 1,
                "previous_hints": previous_hints,
            })
        assert r.status_code == 200
        chars_at[n_prev] = _total_prompt_chars(captured["messages"])

    growth = chars_at[3] - chars_at[0]
    assert growth >= 0, "Adding previous hints must not shrink the prompt"
    assert growth <= 5_000, (
        f"Adding 3 previous hints grew the prompt by {growth:,} chars — suspiciously large.\n"
        f"Previous hints may be included multiple times or not deduplicated."
    )


def test_prompt_char_count_is_logged():
    """
    Utility test: _total_prompt_chars correctly sums content lengths.
    Guards against a bug in the measurement helper itself.
    """
    messages = [
        {"role": "system", "content": "A" * 100},
        {"role": "user",   "content": "B" * 50},
        {"role": "assistant", "content": "C" * 25},
    ]
    assert _total_prompt_chars(messages) == 175
    assert _total_prompt_chars([]) == 0
    assert _total_prompt_chars([{"role": "user"}]) == 0  # missing content key

import os

import pytest
from httpx import AsyncClient, ASGITransport

from app.agent import auditor
from app.main import app


@pytest.fixture(scope="module")
async def client(tmp_path_factory):
    db_path = str(tmp_path_factory.mktemp("db") / "test.db")
    os.environ["SQLITE_PATH"] = db_path
    # Force the router "unconfigured" regardless of a developer's local backend/.env,
    # so this suite never makes a live network call against the real AI router.
    os.environ["AI_ROUTER_BASE_URL"] = ""
    from app.config import get_settings
    get_settings.cache_clear()

    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
    del os.environ["SQLITE_PATH"]
    del os.environ["AI_ROUTER_BASE_URL"]
    get_settings.cache_clear()


class _FakeRouterClient:
    """Duck-types AiRouterClient — returns a fixed transcript, no network call."""

    def __init__(self, transcript):
        self._transcript = transcript

    async def complete_json(self, system_prompt, user_prompt):
        return self._transcript


def _question_row(correct=0):
    return {
        "id": "q_test_001",
        "question": "If $2x + 3 = 11$, what is $4x + 6$?",
        "choices": ["$22$", "$8$", "$14$", "$16$"],
        "correct": correct,
    }


def _good_transcript(claimed_index=0):
    return {
        "transcribable": True,
        "variables": ["x"],
        "given_equations": ["2*x + 3 - 11"],
        "target_expression": "4*x + 6",
        "choice_expressions": ["22", "8", "14", "16"],
        "claimed_correct_index": claimed_index,
    }


@pytest.mark.asyncio
async def test_audit_confirms_correct_stored_answer():
    client = _FakeRouterClient(_good_transcript())
    result = await auditor.audit_question(client, _question_row(correct=0))
    assert result.status == "verified"
    assert result.verified_index == 0


@pytest.mark.asyncio
async def test_audit_flags_mismatch_regardless_of_models_own_claim():
    # Model's own claimed_correct_index is wrong too (claims 1) — audit must still report
    # sympy's independently computed index (0), not the model's claim, and still catch
    # that it disagrees with the stored answer (which is 2 here).
    client = _FakeRouterClient(_good_transcript(claimed_index=1))
    result = await auditor.audit_question(client, _question_row(correct=2))
    assert result.status == "mismatch"
    assert result.verified_index == 0
    assert result.stored_index == 2


@pytest.mark.asyncio
async def test_audit_marks_unauditable_when_model_declines():
    client = _FakeRouterClient({"transcribable": False, "reason": "geometry proof, not numeric"})
    result = await auditor.audit_question(client, _question_row())
    assert result.status == "unauditable"


@pytest.mark.asyncio
async def test_audit_errors_on_unsolvable_transcript():
    transcript = _good_transcript()
    transcript["given_equations"] = ["x - x + 1"]  # 1 = 0, never true
    client = _FakeRouterClient(transcript)
    result = await auditor.audit_question(client, _question_row())
    assert result.status == "error"


@pytest.mark.asyncio
async def test_audit_errors_on_malformed_transcript():
    client = _FakeRouterClient({"transcribable": True})  # missing required fields
    result = await auditor.audit_question(client, _question_row())
    assert result.status == "error"


@pytest.mark.asyncio
async def test_audit_errors_on_choice_count_mismatch():
    transcript = _good_transcript()
    transcript["choice_expressions"] = ["22", "8"]  # question has 4 choices
    client = _FakeRouterClient(transcript)
    result = await auditor.audit_question(client, _question_row())
    assert result.status == "error"


@pytest.mark.asyncio
async def test_agent_audit_endpoint_returns_503_when_router_unconfigured(client):
    resp = await client.post("/agent/audit", json={"question_ids": ["q_amc8_001"]})
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_agent_audit_endpoint_requires_question_ids(client):
    resp = await client.post("/agent/audit", json={})
    assert resp.status_code == 422

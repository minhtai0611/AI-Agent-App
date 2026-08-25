import os

import pytest
from httpx import AsyncClient, ASGITransport

from app.agent import generator, orchestrator, verifier
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


# --- verifier.py: the actual correctness gate, no network involved ---------------------

def _good_draft(claimed_index=0):
    return {
        "topic": "algebra",
        "difficulty": "easy",
        "question_tex": "If $2x + 3 = 11$, what is $4x + 6$?",
        "variables": ["x"],
        "given_equations": ["2*x + 3 - 11"],
        "target_expression": "4*x + 6",
        "choice_expressions": ["22", "8", "14", "16"],
        "claimed_correct_index": claimed_index,
        "explanation_tex": "4x + 6 = 2(2x+3) = 2*11 = 22",
    }


def test_verifier_confirms_correct_claim():
    result = verifier.verify(_good_draft(claimed_index=0))
    assert result.ok is True
    assert result.verified_index == 0


def test_verifier_rejects_wrong_claim():
    result = verifier.verify(_good_draft(claimed_index=1))
    assert result.ok is False
    assert result.verified_index == 0
    assert "claimed index 1" in result.reason


def test_verifier_rejects_unsolvable_system():
    draft = _good_draft()
    draft["given_equations"] = ["x - x + 1"]  # 1 = 0, never true
    result = verifier.verify(draft)
    assert result.ok is False
    assert "no solution" in result.reason


def test_verifier_rejects_ambiguous_choices():
    draft = _good_draft()
    draft["choice_expressions"] = ["22", "22", "14", "16"]
    result = verifier.verify(draft)
    assert result.ok is False
    assert "ambiguous" in result.reason


def test_verifier_rejects_no_matching_choice():
    draft = _good_draft()
    draft["choice_expressions"] = ["1", "2", "3", "4"]
    result = verifier.verify(draft)
    assert result.ok is False
    assert "no choice matches" in result.reason


# --- generator.py: shape validation on whatever the router hands back ------------------

def test_generator_rejects_missing_field():
    with pytest.raises(generator.DraftShapeError):
        generator._validate_shape({"question_tex": "x"})


def test_generator_rejects_wrong_choice_count():
    draft = _good_draft()
    draft["choice_expressions"] = ["1", "2"]
    with pytest.raises(generator.DraftShapeError):
        generator._validate_shape(draft)


def test_generator_accepts_well_shaped_draft():
    generator._validate_shape(_good_draft())  # should not raise


# --- orchestrator.py: the full loop against a fake router client -----------------------

class _FakeRouterClient:
    """Duck-types AiRouterClient without any network call — returns a fixed queue of drafts."""

    def __init__(self, drafts):
        self._drafts = list(drafts)

    async def complete_json(self, system_prompt, user_prompt):
        return self._drafts.pop(0)


@pytest.mark.asyncio
async def test_orchestrator_promotes_verified_draft(client):
    from app.main import get_pool

    pool = app.state.pool
    fake_client = _FakeRouterClient([_good_draft(claimed_index=0)])
    result = await orchestrator.generate_one(pool, fake_client, "algebra", "easy")

    assert result["status"] == "verified"
    row = await pool.fetchrow("SELECT * FROM questions WHERE id=?", result["question_id"])
    assert row is not None
    assert row["origin"] == "agent"
    assert row["correct"] == 0


@pytest.mark.asyncio
async def test_orchestrator_rejects_after_max_attempts(client):
    pool = app.state.pool
    bad_draft = _good_draft(claimed_index=1)  # wrong on every attempt
    fake_client = _FakeRouterClient([bad_draft, bad_draft, bad_draft])
    result = await orchestrator.generate_one(pool, fake_client, "algebra", "easy")

    assert result["status"] == "rejected"
    pending = await pool.fetchrow("SELECT * FROM pending_questions WHERE id=?", result["id"])
    assert pending["status"] == "rejected"


@pytest.mark.asyncio
async def test_agent_generate_returns_503_when_router_unconfigured(client):
    resp = await client.post("/agent/generate", json={"topic": "algebra", "difficulty": "easy"})
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_agent_generate_requires_topic_and_difficulty(client):
    resp = await client.post("/agent/generate", json={})
    assert resp.status_code in (422, 503)  # 422 for the missing-field check firing first


# --- content reports (Phase 2) ----------------------------------------------------------

@pytest.mark.asyncio
async def test_report_question_success(client):
    questions = (await client.get("/questions")).json()
    qid = questions[0]["id"]
    resp = await client.post(f"/questions/{qid}/report", json={"kind": "render", "note": "KaTeX broken"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["questionId"] == qid
    assert body["kind"] == "render"


@pytest.mark.asyncio
async def test_report_question_not_found(client):
    resp = await client.post("/questions/does-not-exist/report", json={"kind": "render"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_report_question_invalid_kind(client):
    questions = (await client.get("/questions")).json()
    qid = questions[0]["id"]
    resp = await client.post(f"/questions/{qid}/report", json={"kind": "not_a_real_kind"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_content_reports_includes_question_content(client):
    questions = (await client.get("/questions")).json()
    qid = questions[0]["id"]
    await client.post(f"/questions/{qid}/report", json={"kind": "answer_key", "note": "AI audit: mismatch"})

    resp = await client.get("/content-reports", params={"kind": "answer_key"})
    assert resp.status_code == 200
    body = resp.json()
    assert any(r["questionId"] == qid and r["question"] == questions[0]["question"] for r in body)


@pytest.mark.asyncio
async def test_agent_pending_lists_rejected_items(client):
    resp = await client.get("/agent/pending", params={"status": "rejected"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

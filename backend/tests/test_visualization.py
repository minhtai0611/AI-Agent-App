import json
import os

import pytest

from app.agent import visualization_generator as vg
from app.agent.verifier import VerificationResult
from app.main import app


@pytest.fixture(scope="module")
async def client(tmp_path_factory):
    from httpx import ASGITransport, AsyncClient

    db_path = str(tmp_path_factory.mktemp("db") / "test.db")
    os.environ["SQLITE_PATH"] = db_path
    os.environ["AI_ROUTER_BASE_URL"] = ""
    from app.config import get_settings

    get_settings.cache_clear()

    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
    del os.environ["SQLITE_PATH"]
    del os.environ["AI_ROUTER_BASE_URL"]
    get_settings.cache_clear()


# --- verify_visualization: the actual correctness gate, no network involved ------------

def _pyramid_question_row(correct_volume: str):
    return {
        "id": "q_test_pyramid",
        "topic": "hình chóp",
        "question": "Tính thể tích hình chóp tứ giác đều có cạnh đáy 4 và chiều cao 6.",
        "choices": [f"${correct_volume}$", "$99$", "$1$", "$2$"],
        "correct": 0,
        "explanation": f"V = (1/3)*16*6 = {correct_volume}",
    }


def _pyramid_draft(base_side=4, apex_height=6, available=True):
    if not available:
        return {"available": False, "reason": "no fitting template"}
    return {
        "available": True,
        "spec": {"template": "pyramid", "base": "square", "base_side": base_side, "apex_height": apex_height, "highlight": "none"},
        "annotation": "Hình chóp tứ giác đều",
    }


def test_verify_pyramid_matches_stored_answer():
    question_row = _pyramid_question_row("32")  # (1/3)*16*6 = 32
    result = vg.verify_visualization(question_row, _pyramid_draft(base_side=4, apex_height=6))
    assert result.ok is True


def test_verify_pyramid_rejects_wrong_volume():
    question_row = _pyramid_question_row("32")
    # apex_height=9 gives volume 48, which does not match the stored answer of 32
    result = vg.verify_visualization(question_row, _pyramid_draft(base_side=4, apex_height=9))
    assert result.ok is False
    assert "does not match" in result.reason


def test_verify_sphere_matches_stored_answer():
    import sympy

    r = 3
    volume = sympy.simplify(sympy.Rational(4, 3) * sympy.pi * sympy.Integer(r) ** 3)
    question_row = {
        "id": "q_test_sphere", "topic": "hình cầu", "question": "...",
        "choices": [f"${volume}$", "$0$"], "correct": 0, "explanation": "...",
    }
    draft = {"available": True, "spec": {"template": "sphere_cone", "shape": "sphere", "radius": r, "highlight": "none"}, "annotation": None}
    result = vg.verify_visualization(question_row, draft)
    assert result.ok is True


def test_verify_function_surface_rejects_bad_domain():
    draft = {
        "available": True,
        "spec": {"template": "function_surface", "expr": "x**2 + y**2", "domain": [5, 1, -1, 1]},
        "annotation": None,
    }
    result = vg.verify_visualization({"choices": [], "correct": None}, draft)
    assert result.ok is False
    assert "not well-ordered" in result.reason


def test_verify_vector_add_rejects_dimension_mismatch():
    draft = {
        "available": True,
        "spec": {"template": "vector_add", "dim": 3, "vectors": [[1, 2]], "show_sum": True},
        "annotation": None,
    }
    result = vg.verify_visualization({"choices": [], "correct": None}, draft)
    assert result.ok is False
    assert "3 components" in result.reason


def test_verify_returns_abstention_reason_when_draft_unavailable():
    result = vg.verify_visualization({"choices": [], "correct": None}, _pyramid_draft(available=False))
    assert result.ok is False
    assert result.reason == "no fitting template"


# --- generate_visualization: the full generate-verify-gate loop against a fake client ---

class _FakeRouterClient:
    """Duck-types AiRouterClient without any network call — returns a fixed queue of drafts."""

    def __init__(self, drafts):
        self._drafts = list(drafts)

    async def complete_json(self, system_prompt, user_prompt):
        return self._drafts.pop(0)


@pytest.mark.asyncio
async def test_generate_visualization_returns_verified_spec():
    question_row = _pyramid_question_row("32")
    fake_client = _FakeRouterClient([
        {"available": True, "template": "pyramid", "base": "square", "base_side": 4, "apex_height": 6, "highlight": "none", "annotation": "Hình chóp"}
    ])
    result = await vg.generate_visualization(fake_client, question_row)
    assert result["available"] is True
    assert result["spec"]["template"] == "pyramid"
    assert result["reason"] is None


@pytest.mark.asyncio
async def test_generate_visualization_abstains_after_max_attempts():
    question_row = _pyramid_question_row("32")
    bad_draft = {"available": True, "template": "pyramid", "base": "square", "base_side": 4, "apex_height": 9, "highlight": "none"}
    fake_client = _FakeRouterClient([bad_draft, bad_draft])  # MAX_ATTEMPTS = 2, wrong every time
    result = await vg.generate_visualization(fake_client, question_row)
    assert result["available"] is False
    assert result["spec"] is None
    assert result["reason"] is not None


@pytest.mark.asyncio
async def test_generate_visualization_handles_malformed_json_without_raising():
    question_row = _pyramid_question_row("32")
    fake_client = _FakeRouterClient([{"template": "not_a_real_template"}, {"available": False, "reason": "no fit"}])
    result = await vg.generate_visualization(fake_client, question_row)
    assert result["available"] is False  # never raises — abstains instead


# --- route: /agent/visualize/{question_id} ----------------------------------------------

@pytest.mark.asyncio
async def test_agent_visualize_returns_503_when_router_unconfigured(client):
    questions = (await client.get("/questions")).json()
    qid = questions[0]["id"]
    resp = await client.post(f"/agent/visualize/{qid}")
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_agent_visualize_404_for_unknown_question(client):
    resp = await client.post("/agent/visualize/does-not-exist")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_agent_get_visualization_returns_unavailable_when_not_generated(client):
    questions = (await client.get("/questions")).json()
    qid = questions[1]["id"]
    resp = await client.get(f"/agent/visualize/{qid}")
    assert resp.status_code == 200
    assert resp.json()["available"] is False


@pytest.mark.asyncio
async def test_agent_visualize_cache_hit_short_circuits_router_call(client):
    """A cached row must be served without ever calling the (unconfigured) router —
    proving the cache check happens before _get_router_client(), not after.
    """
    from app.main import get_pool

    questions = (await client.get("/questions")).json()
    qid = questions[2]["id"]
    pool = app.state.pool
    spec = {"template": "pyramid", "base": "square", "base_side": 4, "apex_height": 6, "highlight": "none"}
    await pool.execute(
        "INSERT INTO question_visualizations (question_id, status, template, params_json, annotation, verification_log) "
        "VALUES (?,?,?,?,?,?)",
        qid, "verified", "pyramid", json.dumps(spec), "Hình chóp", None,
    )

    resp = await client.post(f"/agent/visualize/{qid}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is True
    assert body["spec"]["template"] == "pyramid"


@pytest.mark.asyncio
async def test_agent_get_visualization_returns_abstention_not_500(client):
    """A cached 'unavailable' row must come back as HTTP 200 with available=False,
    never a 500 — abstain-over-fabricate applies to the read path too.
    """
    questions = (await client.get("/questions")).json()
    qid = questions[3]["id"]
    pool = app.state.pool
    await pool.execute(
        "INSERT INTO question_visualizations (question_id, status, template, params_json, annotation, verification_log) "
        "VALUES (?,?,?,?,?,?)",
        qid, "unavailable", None, None, None, "no fitting template",
    )

    resp = await client.get(f"/agent/visualize/{qid}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is False
    assert body["reason"] == "no fitting template"

import json
import os

import pytest
import sympy

from app.agent import step_solver as ss
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


# --- solve_steps: the deterministic derivation --------------------------------------

def test_solve_steps_produces_exact_expected_sequence_for_a_quadratic():
    derivation = ss.solve_steps("x**2 - 5*x + 6", "0", "x")
    ops = [s["op"] for s in derivation["steps"]]
    assert ops == ["factor", "substitute"]  # already in zero-form, so no separate "isolate" rewrite
    assert set(derivation["solutions"]) == {sympy.Integer(2), sympy.Integer(3)}


def test_solve_steps_includes_isolate_step_when_equation_is_not_already_zero_form():
    derivation = ss.solve_steps("x + 3", "7", "x")
    ops = [s["op"] for s in derivation["steps"]]
    assert ops[0] == "isolate"
    assert derivation["solutions"] == [sympy.Integer(4)]


def test_solve_steps_rejects_variable_not_present_in_equation():
    with pytest.raises(ValueError, match="does not appear"):
        ss.solve_steps("y + 1", "2", "x")


# --- verify_steps: the correctness gate ----------------------------------------------

def test_verify_steps_accepts_a_genuine_derivation():
    derivation = ss.solve_steps("x**2 - 5*x + 6", "0", "x")
    result = ss.verify_steps(derivation)
    assert result.ok is True


def test_verify_steps_rejects_a_tampered_intermediate_step():
    derivation = ss.solve_steps("x**2 - 5*x + 6", "0", "x")
    # Corrupt the factored form so it no longer matches the zero-form.
    derivation["steps"][0]["after"] = sympy.Eq(sympy.sympify("(x-1)*(x-2)"), 0)
    result = ss.verify_steps(derivation)
    assert result.ok is False
    assert "not equivalent" in result.reason


def test_verify_steps_rejects_a_wrong_claimed_solution():
    derivation = ss.solve_steps("x**2 - 5*x + 6", "0", "x")
    derivation["steps"][-1]["after"] = sympy.Eq(derivation["variable_symbol"], sympy.FiniteSet(99), evaluate=False)
    result = ss.verify_steps(derivation)
    assert result.ok is False
    assert "does not satisfy" in result.reason


# --- generate_solution: the full generate-verify-gate loop against a fake client ----

class _FakeRouterClient:
    def __init__(self, drafts):
        self._drafts = list(drafts)

    async def complete_json(self, system_prompt, user_prompt):
        return self._drafts.pop(0)


@pytest.mark.asyncio
async def test_generate_solution_returns_verified_steps_with_captions():
    fake_client = _FakeRouterClient([
        {"available": True, "lhs": "x**2 - 5*x + 6", "rhs": "0", "variable": "x"},
        ["Đưa về dạng tích", "Giải từng nhân tử"],
    ])
    result = await ss.generate_solution(fake_client, {"question": "Giải x^2-5x+6=0", "explanation": ""})
    assert result["available"] is True
    assert len(result["steps"]) == 2
    assert result["steps"][0]["caption"] == "Đưa về dạng tích"


@pytest.mark.asyncio
async def test_generate_solution_abstains_when_model_self_abstains():
    fake_client = _FakeRouterClient([
        {"available": False, "reason": "not an equation"},
        {"available": False, "reason": "not an equation"},
    ])
    result = await ss.generate_solution(fake_client, {"question": "Tính thể tích...", "explanation": ""})
    assert result["available"] is False
    assert result["steps"] is None


@pytest.mark.asyncio
async def test_generate_solution_degrades_gracefully_when_narration_fails():
    fake_client = _FakeRouterClient([
        {"available": True, "lhs": "x**2 - 5*x + 6", "rhs": "0", "variable": "x"},
        {"not": "a list"},  # malformed captions payload
    ])
    result = await ss.generate_solution(fake_client, {"question": "Giải x^2-5x+6=0", "explanation": ""})
    assert result["available"] is True
    assert all(s["caption"] is None for s in result["steps"])


@pytest.mark.asyncio
async def test_generate_solution_retries_on_unsolvable_draft_then_abstains():
    fake_client = _FakeRouterClient([
        {"available": True, "lhs": "y + 1", "rhs": "2", "variable": "x"},  # variable not present
        {"available": False, "reason": "gave up"},
    ])
    result = await ss.generate_solution(fake_client, {"question": "...", "explanation": ""})
    assert result["available"] is False


# --- route: /agent/solve/{question_id} -----------------------------------------------

@pytest.mark.asyncio
async def test_agent_solve_returns_503_when_router_unconfigured(client):
    questions = (await client.get("/questions")).json()
    qid = questions[0]["id"]
    resp = await client.get(f"/agent/solve/{qid}")
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_agent_solve_404_for_unknown_question(client):
    resp = await client.get("/agent/solve/does-not-exist")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_agent_solve_cache_hit_short_circuits_router_call(client):
    questions = (await client.get("/questions")).json()
    qid = questions[1]["id"]
    pool = app.state.pool
    steps = [{"op": "factor", "before": "x**2 - 5*x + 6 = 0", "after": "(x-2)*(x-3) = 0", "caption": None}]
    await pool.execute(
        "INSERT INTO question_steps (question_id, status, steps_json, verification_log) VALUES (?,?,?,?)",
        qid, "verified", json.dumps(steps), None,
    )

    resp = await client.get(f"/agent/solve/{qid}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is True
    assert body["steps"] == steps


@pytest.mark.asyncio
async def test_agent_solve_returns_abstention_not_500(client):
    questions = (await client.get("/questions")).json()
    qid = questions[2]["id"]
    pool = app.state.pool
    await pool.execute(
        "INSERT INTO question_steps (question_id, status, steps_json, verification_log) VALUES (?,?,?,?)",
        qid, "unavailable", None, "not an equation",
    )

    resp = await client.get(f"/agent/solve/{qid}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is False
    assert body["reason"] == "not an equation"

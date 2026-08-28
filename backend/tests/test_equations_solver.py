import os

import pytest
import sympy

from app.agent import equations_solver as es
from app.agent.equations_schema import EquationSystemSpec


@pytest.fixture(scope="module")
async def client(tmp_path_factory):
    from httpx import ASGITransport, AsyncClient
    from app.main import app

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


# --- solve_equation_system / verify_equation_system -----------------------------------

def test_quadratic_system_has_two_solutions_both_verified():
    # x^2 + y = 5, x - y = 1  ->  (x=2,y=1) or (x=-3,y=-4)
    spec = EquationSystemSpec(equations=["x**2 + y = 5", "x - y = 1"], variables=["x", "y"])
    derivation = es.solve_equation_system(spec)
    assert len(derivation["solutions"]) == 2
    assert es.verify_equation_system(derivation).ok is True


def test_simple_linear_system():
    spec = EquationSystemSpec(equations=["x + y = 3", "x - y = 1"], variables=["x", "y"])
    derivation = es.solve_equation_system(spec)
    x, y = derivation["variables"]
    assert derivation["solutions"] == [{x: 2, y: 1}]
    assert es.verify_equation_system(derivation).ok is True


def test_unsolvable_system_raises_value_error():
    spec = EquationSystemSpec(equations=["x + y = 3", "x + y = 5"], variables=["x", "y"])
    with pytest.raises(ValueError, match="no solution"):
        es.solve_equation_system(spec)


def test_malformed_equation_raises_value_error():
    spec = EquationSystemSpec(equations=["x ++ y"], variables=["x"])
    with pytest.raises(ValueError, match="not in"):
        es.solve_equation_system(spec)


def test_verify_equation_system_catches_a_deliberately_wrong_solution():
    spec = EquationSystemSpec(equations=["x + y = 3", "x - y = 1"], variables=["x", "y"])
    derivation = es.solve_equation_system(spec)
    x, y = derivation["variables"]
    derivation["solutions"] = [{x: 9, y: 9}]  # deliberately wrong
    result = es.verify_equation_system(derivation)
    assert result.ok is False


# --- draft_equation_system: abstention passthrough -------------------------------------

class _FakeRouterClient:
    def __init__(self, drafts):
        self._drafts = list(drafts)

    async def complete_json(self, system_prompt, user_prompt):
        return self._drafts.pop(0)


@pytest.mark.asyncio
async def test_draft_equation_system_passes_through_abstention():
    fake_client = _FakeRouterClient([{"available": False, "reason": "not a system of equations"}])
    result = await es.draft_equation_system(fake_client, "vẽ đồ thị hàm số")
    assert result["available"] is False


@pytest.mark.asyncio
async def test_generate_equation_system_end_to_end_with_a_fake_router():
    fake_client = _FakeRouterClient([
        {"available": True, "equations": ["x + y = 3", "x - y = 1"], "variables": ["x", "y"]},
    ])
    result = await es.generate_equation_system(fake_client, "giải hệ x+y=3, x-y=1")
    assert result["available"] is True
    assert len(result["solutions"]) == 1


# --- route: /agent/equations -----------------------------------------------------------

@pytest.mark.asyncio
async def test_agent_equations_manual_spec_needs_no_router(client):
    resp = await client.post("/agent/equations", json={"equations": ["x + y = 3", "x - y = 1"], "variables": ["x", "y"]})
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is True
    assert len(body["solutions"]) == 1


@pytest.mark.asyncio
async def test_agent_equations_prompt_text_returns_503_when_router_unconfigured(client):
    resp = await client.post("/agent/equations", json={"prompt_text": "giải hệ phương trình"})
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_agent_equations_returns_available_false_not_500_for_unsolvable_system(client):
    resp = await client.post("/agent/equations", json={"equations": ["x + y = 3", "x + y = 5"], "variables": ["x", "y"]})
    assert resp.status_code == 200
    assert resp.json()["available"] is False

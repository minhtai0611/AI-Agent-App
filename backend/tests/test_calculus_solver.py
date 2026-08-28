import os

import pytest
import sympy

from app.agent import calculus_solver as cs
from app.agent.calculus_schema import CalculusSpec


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


# --- solve_calculus / verify_calculus: per-op independent-second-method assertions ----

def test_derivative_of_a_known_polynomial():
    spec = CalculusSpec(operation="derivative", expr="x**3 + 2*x", variable="x", order=1)
    derivation = cs.solve_calculus(spec)
    assert derivation["result"] == sympy.sympify("3*x**2 + 2")
    verification = cs.verify_calculus(derivation)
    assert verification["ok"] is True


def test_second_derivative():
    spec = CalculusSpec(operation="derivative", expr="sin(x)", variable="x", order=2)
    derivation = cs.solve_calculus(spec)
    assert sympy.simplify(derivation["result"] - sympy.sympify("-sin(x)")) == 0
    assert cs.verify_calculus(derivation)["ok"] is True


def test_indefinite_integral_verified_by_differentiating_back():
    spec = CalculusSpec(operation="integral_indefinite", expr="2*x", variable="x")
    derivation = cs.solve_calculus(spec)
    assert derivation["result"] == sympy.sympify("x**2")
    result = cs.verify_calculus(derivation)
    assert result.ok is True


def test_verify_calculus_catches_a_deliberately_wrong_antiderivative():
    spec = CalculusSpec(operation="integral_indefinite", expr="2*x", variable="x")
    derivation = cs.solve_calculus(spec)
    derivation["result"] = sympy.sympify("x**3")  # deliberately wrong
    result = cs.verify_calculus(derivation)
    assert result.ok is False


def test_definite_integral_verified_by_numeric_quadrature():
    spec = CalculusSpec(operation="integral_definite", expr="x**2", variable="x", bounds=(0, 3))
    derivation = cs.solve_calculus(spec)
    assert float(derivation["result"]) == pytest.approx(9)
    result = cs.verify_calculus(derivation)
    assert result["ok"] is True


def test_limit_at_a_removable_discontinuity():
    spec = CalculusSpec(operation="limit", expr="sin(x)/x", variable="x", point=0)
    derivation = cs.solve_calculus(spec)
    assert derivation["result"] == 1
    assert cs.verify_calculus(derivation)["ok"] is True


def test_series_expansion_of_exp():
    spec = CalculusSpec(operation="series", expr="exp(x)", variable="x", point=0, order=3)
    derivation = cs.solve_calculus(spec)
    expected = sympy.sympify("1 + x + x**2/2 + x**3/6")
    assert sympy.simplify(derivation["result"] - expected) == 0
    assert cs.verify_calculus(derivation)["ok"] is True


def test_dsolve_verified_by_checkodesol():
    # y' - y = 0  ->  y = C1*exp(x)
    spec = CalculusSpec(operation="dsolve", expr="Derivative(y(x), x) - y(x)", variable="x")
    derivation = cs.solve_calculus(spec)
    result = cs.verify_calculus(derivation)
    assert result.ok is True


def test_integral_definite_requires_bounds():
    spec = CalculusSpec(operation="integral_definite", expr="x**2", variable="x")
    with pytest.raises(ValueError, match="bounds"):
        cs.solve_calculus(spec)


def test_limit_requires_a_point():
    spec = CalculusSpec(operation="limit", expr="x**2", variable="x")
    with pytest.raises(ValueError, match="point"):
        cs.solve_calculus(spec)


# --- draft_calculus_spec: abstention passthrough ---------------------------------------

class _FakeRouterClient:
    def __init__(self, drafts):
        self._drafts = list(drafts)

    async def complete_json(self, system_prompt, user_prompt):
        return self._drafts.pop(0)


@pytest.mark.asyncio
async def test_draft_calculus_spec_passes_through_abstention():
    fake_client = _FakeRouterClient([{"available": False, "reason": "not a calculus request"}])
    result = await cs.draft_calculus_spec(fake_client, "giải hệ phương trình")
    assert result["available"] is False


@pytest.mark.asyncio
async def test_generate_calculus_end_to_end_with_a_fake_router():
    fake_client = _FakeRouterClient([
        {"available": True, "operation": "derivative", "expr": "x**2", "variable": "x", "order": 1},
    ])
    result = await cs.generate_calculus(fake_client, "đạo hàm của x^2")
    assert result["available"] is True
    assert result["result"] == "2*x"


# --- route: /agent/calculus -------------------------------------------------------------

@pytest.mark.asyncio
async def test_agent_calculus_manual_spec_needs_no_router(client):
    resp = await client.post("/agent/calculus", json={"operation": "derivative", "expr": "x**2", "variable": "x"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is True
    assert body["result"] == "2*x"


@pytest.mark.asyncio
async def test_agent_calculus_prompt_text_returns_503_when_router_unconfigured(client):
    resp = await client.post("/agent/calculus", json={"prompt_text": "tính đạo hàm của x^2"})
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_agent_calculus_returns_available_false_not_500_for_missing_bounds(client):
    resp = await client.post("/agent/calculus", json={"operation": "integral_definite", "expr": "x**2", "variable": "x"})
    assert resp.status_code == 200
    assert resp.json()["available"] is False

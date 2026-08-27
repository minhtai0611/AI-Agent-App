import os

import pytest

from app.agent import plot_generator as pg
from app.agent.plot_schema import PlotSpec


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


# --- verify_plot: the actual correctness gate ------------------------------------------

def test_verify_plot_accepts_two_curves_with_no_op():
    spec = PlotSpec(curves=[{"expr": "x**2"}, {"expr": "2*x + 1"}])
    assert pg.verify_plot(spec).ok is True


def test_verify_plot_rejects_unparseable_expr():
    spec = PlotSpec(curves=[{"expr": "x +* 1"}])
    result = pg.verify_plot(spec)
    assert result.ok is False
    assert "could not parse" in result.reason


def test_verify_plot_rejects_malformed_domain():
    spec = PlotSpec(curves=[{"expr": "x"}], domain=(5, -5, -10, 10))
    result = pg.verify_plot(spec)
    assert result.ok is False
    assert "not well-ordered" in result.reason


def test_verify_plot_accepts_a_genuine_intersection():
    spec = PlotSpec(curves=[{"expr": "x**2"}, {"expr": "x + 2"}], ops=["intersect"])
    assert pg.verify_plot(spec).ok is True


def test_verify_plot_rejects_curves_that_never_intersect():
    spec = PlotSpec(curves=[{"expr": "x**2 + 10"}, {"expr": "0"}], ops=["intersect"])
    result = pg.verify_plot(spec)
    assert result.ok is False
    assert "do not intersect" in result.reason


def test_verify_plot_rejects_intersect_with_wrong_curve_count():
    spec = PlotSpec(curves=[{"expr": "x"}], ops=["intersect"])
    result = pg.verify_plot(spec)
    assert result.ok is False
    assert "exactly 2" in result.reason


def test_verify_plot_accepts_tangent_at_with_a_valid_point():
    spec = PlotSpec(curves=[{"expr": "x**2"}], ops=["tangent_at"], tangent_at_x=2)
    assert pg.verify_plot(spec).ok is True


def test_verify_plot_rejects_tangent_at_missing_the_point():
    spec = PlotSpec(curves=[{"expr": "x**2"}], ops=["tangent_at"])
    result = pg.verify_plot(spec)
    assert result.ok is False
    assert "tangent_at_x" in result.reason


# --- generate_plot: the full generate-verify-gate loop against a fake client -----------

class _FakeRouterClient:
    def __init__(self, drafts):
        self._drafts = list(drafts)

    async def complete_json(self, system_prompt, user_prompt):
        return self._drafts.pop(0)


@pytest.mark.asyncio
async def test_generate_plot_returns_a_verified_spec():
    fake_client = _FakeRouterClient([
        {"available": True, "curves": [{"expr": "x**2", "kind": "function"}, {"expr": "2*x+1", "kind": "function"}], "ops": ["intersect"]},
    ])
    result = await pg.generate_plot(fake_client, "vẽ đồ thị giao của y=x^2 và y=2x+1")
    assert result["available"] is True
    assert len(result["spec"]["curves"]) == 2


@pytest.mark.asyncio
async def test_generate_plot_abstains_after_max_attempts_of_bad_intersections():
    bad_draft = {"available": True, "curves": [{"expr": "x**2 + 10"}, {"expr": "0"}], "ops": ["intersect"]}
    fake_client = _FakeRouterClient([bad_draft, bad_draft])
    result = await pg.generate_plot(fake_client, "vẽ giao điểm")
    assert result["available"] is False
    assert result["spec"] is None


@pytest.mark.asyncio
async def test_generate_plot_handles_malformed_json_without_raising():
    fake_client = _FakeRouterClient([{"curves": "not-a-list"}, {"available": False, "reason": "unclear"}])
    result = await pg.generate_plot(fake_client, "??")
    assert result["available"] is False


# --- route: /agent/plot ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_agent_plot_returns_503_when_router_unconfigured(client):
    resp = await client.post("/agent/plot", json={"prompt_text": "vẽ đồ thị y=x^2"})
    assert resp.status_code == 503

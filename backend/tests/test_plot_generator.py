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


# --- verify_plot: new curve kinds -------------------------------------------------------

def test_verify_plot_accepts_a_parametric_curve():
    spec = PlotSpec(curves=[{"expr": "cos(t)", "expr_y": "sin(t)", "kind": "parametric"}])
    assert pg.verify_plot(spec).ok is True


def test_verify_plot_rejects_parametric_curve_missing_expr_y():
    spec = PlotSpec(curves=[{"expr": "cos(t)", "kind": "parametric"}])
    result = pg.verify_plot(spec)
    assert result.ok is False
    assert "expr_y" in result.reason


def test_verify_plot_accepts_a_polar_curve():
    spec = PlotSpec(curves=[{"expr": "1 + sin(theta)", "kind": "polar"}])
    assert pg.verify_plot(spec).ok is True


def test_verify_plot_accepts_a_piecewise_curve():
    spec = PlotSpec(curves=[{"expr": "Piecewise((x**2, x < 0), (x, x >= 0))", "kind": "piecewise"}])
    assert pg.verify_plot(spec).ok is True


def test_verify_plot_rejects_a_dataset_curve_with_too_few_points():
    spec = PlotSpec(curves=[{"kind": "dataset", "points": [[0, 0]]}])
    result = pg.verify_plot(spec)
    assert result.ok is False
    assert "at least 2 points" in result.reason


def test_verify_plot_rejects_mismatched_parameter_bounds():
    spec = PlotSpec(curves=[{"expr": "a*x"}], parameters=[{"name": "a", "min": 5, "max": 1, "value": 2}])
    result = pg.verify_plot(spec)
    assert result.ok is False
    assert "'a'" in result.reason


# --- verify_plot / compute_results: new ops ---------------------------------------------

def test_verify_plot_accepts_roots_and_compute_results_returns_them():
    spec = PlotSpec(curves=[{"expr": "x**2 - 4"}], ops=["roots"])
    assert pg.verify_plot(spec).ok is True
    results = pg.compute_results(spec)
    assert set(results["roots"]) == {"-2", "2"}


def test_verify_plot_rejects_roots_with_no_real_solutions():
    spec = PlotSpec(curves=[{"expr": "x**2 + 1"}], ops=["roots"])
    result = pg.verify_plot(spec)
    assert result.ok is False
    assert "no real roots" in result.reason


def test_verify_plot_accepts_extrema_and_compute_results_classifies_them():
    spec = PlotSpec(curves=[{"expr": "x**2"}], ops=["extrema"])
    assert pg.verify_plot(spec).ok is True
    results = pg.compute_results(spec)
    assert results["extrema"] == [{"x": "0", "y": "0", "kind": "min"}]


def test_verify_plot_rejects_extrema_with_no_critical_points():
    spec = PlotSpec(curves=[{"expr": "x"}], ops=["extrema"])
    result = pg.verify_plot(spec)
    assert result.ok is False
    assert "no critical points" in result.reason


def test_verify_plot_accepts_derivative_at_and_compute_results_returns_the_value():
    spec = PlotSpec(curves=[{"expr": "x**2"}], ops=["derivative_at"], derivative_at_x=3)
    assert pg.verify_plot(spec).ok is True
    results = pg.compute_results(spec)
    assert results["derivative_at"]["value"] == "6.00000000000000"


def test_verify_plot_accepts_integral_and_compute_results_returns_the_value():
    spec = PlotSpec(curves=[{"expr": "x"}], ops=["integral"], integral_bounds=(0, 2))
    assert pg.verify_plot(spec).ok is True
    results = pg.compute_results(spec)
    assert results["integral"]["value"] == "2.00000000000000"


def test_verify_plot_rejects_integral_with_malformed_bounds():
    spec = PlotSpec(curves=[{"expr": "x"}], ops=["integral"], integral_bounds=(2, 0))
    result = pg.verify_plot(spec)
    assert result.ok is False
    assert "not well-ordered" in result.reason


def test_verify_plot_accepts_regression_and_compute_results_returns_coefficients():
    spec = PlotSpec(
        curves=[{"kind": "dataset", "points": [[0, 0], [1, 2], [2, 4], [3, 6]]}],
        ops=["regression"], regression_kind="linear", regression_degree=1,
    )
    assert pg.verify_plot(spec).ok is True
    results = pg.compute_results(spec)
    assert results["regression"]["r_squared"] > 0.99
    assert len(results["regression"]["coefficients"]) == 2


def test_verify_plot_rejects_regression_with_too_few_points_for_the_degree():
    spec = PlotSpec(
        curves=[{"kind": "dataset", "points": [[0, 0], [1, 1]]}],
        ops=["regression"], regression_kind="polynomial", regression_degree=2,
    )
    result = pg.verify_plot(spec)
    assert result.ok is False
    assert "not enough points" in result.reason


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


@pytest.mark.asyncio
async def test_agent_plot_narrate_returns_503_when_router_unconfigured(client):
    resp = await client.post("/agent/plot/narrate", json={"spec": {"curves": [{"expr": "x**2"}]}, "results": {}})
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_agent_plot_narrate_rejects_an_invalid_spec(client):
    resp = await client.post("/agent/plot/narrate", json={"spec": {"curves": "not-a-list"}})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_agent_plot_suggest_returns_503_when_router_unconfigured(client):
    resp = await client.post("/agent/plot/suggest", json={"spec": {"curves": [{"expr": "x**2"}]}, "results": {}})
    assert resp.status_code == 503


# --- follow-up turns: previous_spec folded into the draft prompt -----------------------

@pytest.mark.asyncio
async def test_generate_plot_folds_previous_spec_into_the_draft_prompt():
    class _CapturingClient:
        def __init__(self):
            self.last_user_prompt = None

        async def complete_json(self, system_prompt, user_prompt):
            self.last_user_prompt = user_prompt
            return {"available": True, "curves": [{"expr": "x**2", "kind": "function"}], "ops": ["none"]}

    fake_client = _CapturingClient()
    previous = {"curves": [{"expr": "x", "kind": "function"}], "ops": ["none"]}
    result = await pg.generate_plot(fake_client, "thêm đường x^2", previous_spec=previous)
    assert result["available"] is True
    assert "Current graph" in fake_client.last_user_prompt
    assert "thêm đường x^2" in fake_client.last_user_prompt


# --- narrate_plot / suggest_next_step: caption-only, never raise ------------------------

@pytest.mark.asyncio
async def test_narrate_plot_returns_the_models_narrative():
    class _FixedClient:
        async def complete_json(self, system_prompt, user_prompt):
            return {"narrative": "Đây là một parabol."}

    spec = PlotSpec(curves=[{"expr": "x**2"}])
    narrative = await pg.narrate_plot(_FixedClient(), spec, {})
    assert narrative == "Đây là một parabol."


@pytest.mark.asyncio
async def test_narrate_plot_degrades_to_empty_string_on_router_failure():
    class _BrokenClient:
        async def complete_json(self, system_prompt, user_prompt):
            raise RuntimeError("router down")

    spec = PlotSpec(curves=[{"expr": "x**2"}])
    narrative = await pg.narrate_plot(_BrokenClient(), spec, {})
    assert narrative == ""


@pytest.mark.asyncio
async def test_suggest_next_step_returns_the_models_suggestion():
    class _FixedClient:
        async def complete_json(self, system_prompt, user_prompt):
            return {"suggestion": "Thử vẽ đạo hàm."}

    spec = PlotSpec(curves=[{"expr": "x**2"}])
    suggestion = await pg.suggest_next_step(_FixedClient(), spec, {})
    assert suggestion == "Thử vẽ đạo hàm."


@pytest.mark.asyncio
async def test_suggest_next_step_degrades_to_empty_string_on_malformed_json():
    class _MalformedClient:
        async def complete_json(self, system_prompt, user_prompt):
            return {"suggestion": 42}

    spec = PlotSpec(curves=[{"expr": "x**2"}])
    suggestion = await pg.suggest_next_step(_MalformedClient(), spec, {})
    assert suggestion == ""

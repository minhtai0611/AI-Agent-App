import os

import numpy as np
import pytest
import sympy

from app.agent import stats_simulator as sim
from app.agent.stats_schema import SimulationSpec


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


# --- theoretical calculation: exact for known cases ----------------------------------

def test_two_dice_sum_pmf_matches_known_theoretical_probabilities():
    pmf = sim._dice_sum_pmf(2)
    assert pmf[7] == sympy.Rational(6, 36)  # the most likely sum
    assert pmf[2] == sympy.Rational(1, 36)  # only (1,1)
    assert pmf[12] == sympy.Rational(1, 36)  # only (6,6)
    assert sum(pmf.values()) == 1


def test_two_dice_sum_theoretical_mean_and_variance():
    pmf = sim._dice_sum_pmf(2)
    mean, var = sim._pmf_moments(pmf)
    assert mean == 7
    assert var == sympy.Rational(35, 6)


def test_coin_flip_theoretical_moments_are_the_binomial_formula():
    spec = SimulationSpec(experiment="coin", n_dice=10, trials=5000, statistic="count")
    result = sim.run_simulation(spec)
    assert result["theoretical_mean"] == sympy.Rational(5, 1)
    assert result["theoretical_var"] == sympy.Rational(10, 4)


# --- run_simulation / verify_simulation -----------------------------------------------

def test_run_simulation_rejects_the_unimplemented_sampling_experiment():
    spec = SimulationSpec(experiment="sampling", trials=100, statistic="sum")
    with pytest.raises(NotImplementedError):
        sim.run_simulation(spec)


def test_verify_simulation_passes_a_genuine_dice_run():
    spec = SimulationSpec(experiment="dice", n_dice=2, trials=20000, statistic="sum")
    result = sim.run_simulation(spec)
    assert sim.verify_simulation(result)["ok"] is True


def test_verify_simulation_flags_a_fabricated_impossible_histogram():
    spec = SimulationSpec(experiment="dice", n_dice=2, trials=1000, statistic="sum")
    real_result = sim.run_simulation(spec)
    # An "always rolls 12" histogram could never come from 1000 genuine two-dice trials.
    fabricated = {**real_result, "samples": np.full(1000, 12)}
    verdict = sim.verify_simulation(fabricated)
    assert verdict["ok"] is False
    assert "outside the expected range" in verdict["reason"]


# --- draft_simulation / generate_simulation -------------------------------------------

class _FakeRouterClient:
    def __init__(self, drafts):
        self._drafts = list(drafts)

    async def complete_json(self, system_prompt, user_prompt):
        return self._drafts.pop(0)


@pytest.mark.asyncio
async def test_generate_simulation_returns_a_verified_dice_histogram():
    fake_client = _FakeRouterClient([
        {"available": True, "experiment": "dice", "n_dice": 2, "trials": 5000, "statistic": "sum"},
    ])
    result = await sim.generate_simulation(fake_client, "tung hai con xúc xắc 5000 lần")
    assert result["available"] is True
    assert len(result["histogram"]) == 5000
    assert result["pmf"]["7"] > result["pmf"]["2"]


@pytest.mark.asyncio
async def test_generate_simulation_abstains_for_sampling_requests():
    fake_client = _FakeRouterClient([
        {"available": True, "experiment": "sampling", "trials": 100, "statistic": "sum"},
    ])
    result = await sim.generate_simulation(fake_client, "chọn mẫu ngẫu nhiên")
    assert result["available"] is False
    assert "not yet supported" in result["reason"]


# --- route: /agent/simulate ------------------------------------------------------------

@pytest.mark.asyncio
async def test_agent_simulate_manual_spec_needs_no_router(client):
    resp = await client.post("/agent/simulate", json={"experiment": "coin", "n_dice": 6, "trials": 3000, "statistic": "count"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is True
    assert len(body["histogram"]) == 3000


@pytest.mark.asyncio
async def test_agent_simulate_prompt_text_returns_503_when_router_unconfigured(client):
    resp = await client.post("/agent/simulate", json={"prompt_text": "tung một đồng xu 100 lần"})
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_agent_simulate_returns_available_false_not_500_for_sampling(client):
    resp = await client.post("/agent/simulate", json={"experiment": "sampling", "trials": 100, "statistic": "sum"})
    assert resp.status_code == 200
    assert resp.json()["available"] is False

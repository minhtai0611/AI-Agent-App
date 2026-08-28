import os

import pytest
import sympy

from app.agent import linalg_solver as ls
from app.agent.linalg_schema import LinAlgSpec


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


# --- solve_linalg / verify_linalg: exact rational-arithmetic assertions -------------

def test_determinant_of_a_known_matrix():
    spec = LinAlgSpec(operation="determinant", matrices=[[[1, 2], [3, 4]]])
    derivation = ls.solve_linalg(spec)
    assert derivation["result"] == -2
    assert ls.verify_linalg(derivation).ok is True


def test_inverse_of_a_known_matrix():
    spec = LinAlgSpec(operation="inverse", matrices=[[[2, 0], [0, 2]]])
    derivation = ls.solve_linalg(spec)
    assert derivation["result"] == sympy.Matrix([[sympy.Rational(1, 2), 0], [0, sympy.Rational(1, 2)]])
    assert ls.verify_linalg(derivation).ok is True


def test_inverse_raises_for_a_singular_matrix():
    spec = LinAlgSpec(operation="inverse", matrices=[[[1, 2], [2, 4]]])
    with pytest.raises(ValueError, match="singular"):
        ls.solve_linalg(spec)


def test_rref_of_a_known_matrix():
    spec = LinAlgSpec(operation="rref", matrices=[[[1, 2, 3], [2, 4, 6]]])
    derivation = ls.solve_linalg(spec)
    assert derivation["result"] == sympy.Matrix([[1, 2, 3], [0, 0, 0]])
    assert derivation["steps"]  # a genuine step ledger, not empty
    assert ls.verify_linalg(derivation).ok is True


def test_solve_system_of_a_known_3x3_system():
    # x + y = 3, y + z = 5, x + z = 4  ->  x=1, y=2, z=3
    augmented = [[1, 1, 0, 3], [0, 1, 1, 5], [1, 0, 1, 4]]
    spec = LinAlgSpec(operation="solve_system", matrices=[augmented])
    derivation = ls.solve_linalg(spec)
    assert derivation["result"] == sympy.Matrix([1, 2, 3])
    assert ls.verify_linalg(derivation).ok is True


def test_verify_linalg_catches_a_deliberately_wrong_solution_vector():
    augmented = [[1, 1, 0, 3], [0, 1, 1, 5], [1, 0, 1, 4]]
    spec = LinAlgSpec(operation="solve_system", matrices=[augmented])
    derivation = ls.solve_linalg(spec)
    derivation["result"] = sympy.Matrix([9, 9, 9])  # deliberately wrong
    result = ls.verify_linalg(derivation)
    assert result.ok is False
    assert "residual" in result.reason


def test_add_and_multiply():
    add_spec = LinAlgSpec(operation="add", matrices=[[[1, 2]], [[3, 4]]])
    add_derivation = ls.solve_linalg(add_spec)
    assert add_derivation["result"] == sympy.Matrix([[4, 6]])
    assert ls.verify_linalg(add_derivation).ok is True

    mul_spec = LinAlgSpec(operation="multiply", matrices=[[[1, 2], [3, 4]], [[1, 0], [0, 1]]])
    mul_derivation = ls.solve_linalg(mul_spec)
    assert mul_derivation["result"] == sympy.Matrix([[1, 2], [3, 4]])
    assert ls.verify_linalg(mul_derivation).ok is True


def test_eigen_is_verified_against_the_characteristic_equation():
    spec = LinAlgSpec(operation="eigen", matrices=[[[2, 0], [0, 3]]])
    derivation = ls.solve_linalg(spec)
    assert set(str(k) for k in derivation["result"]) == {"2", "3"}
    assert ls.verify_linalg(derivation).ok is True


# --- matrix decompositions: lu/qr/cholesky/svd ---------------------------------------

def test_lu_decomposition_reconstructs_the_original_matrix():
    spec = LinAlgSpec(operation="lu", matrices=[[[4, 3], [6, 3]]])
    derivation = ls.solve_linalg(spec)
    assert set(derivation["result"].keys()) == {"L", "U", "P"}
    assert ls.verify_linalg(derivation).ok is True


def test_qr_decomposition_is_orthogonal_and_reconstructs():
    spec = LinAlgSpec(operation="qr", matrices=[[[1, 0], [0, 1], [1, 1]]])
    derivation = ls.solve_linalg(spec)
    assert set(derivation["result"].keys()) == {"Q", "R"}
    assert ls.verify_linalg(derivation).ok is True


def test_cholesky_of_a_positive_definite_matrix():
    spec = LinAlgSpec(operation="cholesky", matrices=[[[4, 2], [2, 3]]])
    derivation = ls.solve_linalg(spec)
    assert ls.verify_linalg(derivation).ok is True


def test_cholesky_raises_for_a_non_positive_definite_matrix():
    spec = LinAlgSpec(operation="cholesky", matrices=[[[1, 2], [2, 1]]])
    with pytest.raises(ValueError, match="positive-definite"):
        ls.solve_linalg(spec)


def test_svd_reconstructs_within_numeric_tolerance():
    spec = LinAlgSpec(operation="svd", matrices=[[[3, 0], [0, -2]]])
    derivation = ls.solve_linalg(spec)
    result = ls.verify_linalg(derivation)
    assert result["ok"] is True


# --- draft_linalg_spec: eigen/svd are excluded from the NL vocabulary ---------------

class _FakeRouterClient:
    def __init__(self, drafts):
        self._drafts = list(drafts)

    async def complete_json(self, system_prompt, user_prompt):
        return self._drafts.pop(0)


@pytest.mark.asyncio
async def test_draft_linalg_spec_rejects_eigen_even_if_the_model_proposes_it():
    fake_client = _FakeRouterClient([{"available": True, "operation": "eigen", "matrices": [[[1, 0], [0, 1]]]}])
    with pytest.raises(ls.LinAlgShapeError, match="not offered"):
        await ls.draft_linalg_spec(fake_client, "tìm giá trị riêng của ma trận")


@pytest.mark.asyncio
async def test_draft_linalg_spec_rejects_svd_even_if_the_model_proposes_it():
    fake_client = _FakeRouterClient([{"available": True, "operation": "svd", "matrices": [[[1, 0], [0, 1]]]}])
    with pytest.raises(ls.LinAlgShapeError, match="not offered"):
        await ls.draft_linalg_spec(fake_client, "phân tích SVD của ma trận")


@pytest.mark.asyncio
async def test_draft_linalg_spec_passes_through_abstention():
    fake_client = _FakeRouterClient([{"available": False, "reason": "not a matrix request"}])
    result = await ls.draft_linalg_spec(fake_client, "giải phương trình bậc hai")
    assert result["available"] is False


# --- route: /agent/linalg -------------------------------------------------------------

@pytest.mark.asyncio
async def test_agent_linalg_manual_spec_needs_no_router(client):
    resp = await client.post("/agent/linalg", json={"operation": "determinant", "matrices": [[[1, 2], [3, 4]]]})
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is True
    assert body["result"] == "-2"


@pytest.mark.asyncio
async def test_agent_linalg_prompt_text_returns_503_when_router_unconfigured(client):
    resp = await client.post("/agent/linalg", json={"prompt_text": "tính hạng của ma trận"})
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_agent_linalg_returns_available_false_not_500_for_singular_inverse(client):
    resp = await client.post("/agent/linalg", json={"operation": "inverse", "matrices": [[[1, 2], [2, 4]]]})
    assert resp.status_code == 200
    assert resp.json()["available"] is False


@pytest.mark.asyncio
async def test_agent_linalg_lu_decomposition_via_manual_spec(client):
    resp = await client.post("/agent/linalg", json={"operation": "lu", "matrices": [[[4, 3], [6, 3]]]})
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is True
    assert set(body["result"].keys()) == {"L", "U", "P"}


@pytest.mark.asyncio
async def test_agent_linalg_cholesky_returns_available_false_not_500_for_non_pd(client):
    resp = await client.post("/agent/linalg", json={"operation": "cholesky", "matrices": [[[1, 2], [2, 1]]]})
    assert resp.status_code == 200
    assert resp.json()["available"] is False

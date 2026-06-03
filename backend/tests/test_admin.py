"""Tests for admin endpoints — key validation and action coverage."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

_ADMIN_KEY = "test-admin-key-static"
_HEADERS = {"x-admin-key": _ADMIN_KEY}


@pytest.fixture
def client():
    import os
    os.environ["ANTHROPIC_AUTH_TOKEN"] = "test-token"
    os.environ["JWT_SECRET"] = "x" * 32
    os.environ["ADMIN_KEY"] = _ADMIN_KEY
    os.environ["ADMIN_MASTER_SECRET"] = ""
    from app.config import get_settings
    get_settings.cache_clear()
    from app.main import app
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def client_with_pool(client):
    """TestClient whose pool dependency is mocked."""
    from app.main import app as _app, get_pool as _get_pool
    pool = AsyncMock()
    pool.fetchrow.return_value = {
        "cnt": 0, "id": 1, "email": "u@test.com",
        "subscription_tier": "student", "credits_balance": 20,
        "is_suspended": 0, "created_at": "2024-01-01",
    }
    pool.fetch.return_value = []
    pool.execute.return_value = "UPDATE 1"

    async def _override():
        return pool

    _app.dependency_overrides[_get_pool] = _override
    yield client, pool
    _app.dependency_overrides.pop(_get_pool, None)


# ── Key validation ─────────────────────────────────────────────────────────────

class TestAdminKeyEndpoints:
    def test_list_users_valid_key(self, client_with_pool):
        client, _ = client_with_pool
        resp = client.get("/admin/users", headers=_HEADERS)
        assert resp.status_code != 401

    def test_list_users_invalid_key(self, client):
        resp = client.get("/admin/users", headers={"x-admin-key": "wrong"})
        assert resp.status_code == 401

    def test_list_users_no_key(self, client):
        resp = client.get("/admin/users")
        assert resp.status_code == 401


# ── Suspend / unsuspend ────────────────────────────────────────────────────────

class TestAdminSuspend:
    def test_suspend_valid_key_returns_204(self, client_with_pool):
        client, pool = client_with_pool
        resp = client.post(
            "/admin/users/42/suspend",
            json={"reason": "abuse"},
            headers=_HEADERS,
        )
        assert resp.status_code == 204, f"Expected 204, got {resp.status_code}: {resp.text}"

    def test_suspend_writes_security_event(self, client_with_pool):
        client, pool = client_with_pool
        client.post("/admin/users/42/suspend", json={"reason": "spam"}, headers=_HEADERS)
        # Second execute call is the security_event INSERT
        assert pool.execute.call_count >= 2, "suspend must write a security_events row"

    def test_suspend_invalid_key_returns_401(self, client):
        resp = client.post(
            "/admin/users/42/suspend", json={"reason": "x"}, headers={"x-admin-key": "bad"}
        )
        assert resp.status_code == 401

    def test_unsuspend_valid_key_returns_204(self, client_with_pool):
        client, _ = client_with_pool
        resp = client.post("/admin/users/42/unsuspend", headers=_HEADERS)
        assert resp.status_code == 204

    def test_unsuspend_invalid_key_returns_401(self, client):
        resp = client.post("/admin/users/42/unsuspend", headers={"x-admin-key": "bad"})
        assert resp.status_code == 401


# ── Credit grant ───────────────────────────────────────────────────────────────

class TestAdminCredits:
    def test_grant_credits_returns_204(self, client_with_pool):
        client, _ = client_with_pool
        resp = client.post(
            "/admin/users/7/credits",
            json={"amount": 50, "reason": "promo"},
            headers=_HEADERS,
        )
        assert resp.status_code == 204, f"Expected 204, got {resp.status_code}: {resp.text}"

    def test_grant_zero_credits_returns_422(self, client_with_pool):
        client, _ = client_with_pool
        resp = client.post(
            "/admin/users/7/credits",
            json={"amount": 0},
            headers=_HEADERS,
        )
        assert resp.status_code == 422, "amount=0 must be rejected"

    def test_grant_negative_credits_returns_422(self, client_with_pool):
        client, _ = client_with_pool
        resp = client.post(
            "/admin/users/7/credits",
            json={"amount": -10},
            headers=_HEADERS,
        )
        assert resp.status_code == 422, "negative amount must be rejected"

    def test_grant_credits_invalid_key(self, client):
        resp = client.post(
            "/admin/users/7/credits",
            json={"amount": 50},
            headers={"x-admin-key": "bad"},
        )
        assert resp.status_code == 401


# ── Subscription update ────────────────────────────────────────────────────────

class TestAdminSubscription:
    def test_set_subscription_valid(self, client_with_pool):
        client, _ = client_with_pool
        resp = client.post(
            "/admin/users/3/subscription",
            json={"tier": "complete", "period": "annual", "bonus_credits": 100},
            headers=_HEADERS,
        )
        assert resp.status_code == 204, f"Expected 204, got {resp.status_code}: {resp.text}"

    def test_set_subscription_invalid_tier_returns_422(self, client_with_pool):
        client, _ = client_with_pool
        resp = client.post(
            "/admin/users/3/subscription",
            json={"tier": "premium"},   # not a valid tier
            headers=_HEADERS,
        )
        assert resp.status_code == 422

    def test_set_subscription_invalid_period_returns_422(self, client_with_pool):
        client, _ = client_with_pool
        resp = client.post(
            "/admin/users/3/subscription",
            json={"tier": "student", "period": "weekly"},  # not a valid period
            headers=_HEADERS,
        )
        assert resp.status_code == 422

    def test_set_subscription_invalid_key(self, client):
        resp = client.post(
            "/admin/users/3/subscription",
            json={"tier": "student"},
            headers={"x-admin-key": "bad"},
        )
        assert resp.status_code == 401


# ── Security events ────────────────────────────────────────────────────────────

class TestAdminSecurityEvents:
    def test_security_events_valid_key(self, client_with_pool):
        client, pool = client_with_pool
        pool.fetch.return_value = []
        resp = client.get("/admin/security-events", headers=_HEADERS)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_security_events_invalid_key(self, client):
        resp = client.get("/admin/security-events", headers={"x-admin-key": "bad"})
        assert resp.status_code == 401

    def test_security_events_limit_capped(self, client_with_pool):
        """limit param is capped at 500 — verify no 422 on large values."""
        client, _ = client_with_pool
        resp = client.get("/admin/security-events?limit=9999", headers=_HEADERS)
        assert resp.status_code == 200

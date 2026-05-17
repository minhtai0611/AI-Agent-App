"""Tests for HMAC-derived admin key — derivation logic + endpoints."""
import asyncio
import datetime
import hmac as _hmac
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from app.admin_auth import (
    get_window_label,
    get_expiry_date,
    derive_key,
    validate_admin_key,
)


# ── Unit tests: key derivation ────────────────────────────────────────────────

class TestGetWindowLabel:
    def test_daily(self):
        with patch("app.admin_auth.datetime") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2026, 5, 18)
            mock_dt.timedelta = datetime.timedelta
            assert get_window_label("daily", 0) == "2026-05-18"
            assert get_window_label("daily", 1) == "2026-05-17"

    def test_weekly(self):
        with patch("app.admin_auth.datetime") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2026, 5, 18)
            mock_dt.timedelta = datetime.timedelta
            label = get_window_label("weekly", 0)
            assert label.startswith("2026-W")

    def test_monthly(self):
        with patch("app.admin_auth.datetime") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2026, 5, 18)
            mock_dt.timedelta = datetime.timedelta
            assert get_window_label("monthly", 0) == "2026-05"
            assert get_window_label("monthly", 1) == "2026-04"

    def test_monthly_year_rollover(self):
        with patch("app.admin_auth.datetime") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2026, 1, 5)
            mock_dt.timedelta = datetime.timedelta
            assert get_window_label("monthly", 1) == "2025-12"

    def test_quarterly(self):
        with patch("app.admin_auth.datetime") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2026, 5, 18)  # Q2
            mock_dt.timedelta = datetime.timedelta
            assert get_window_label("quarterly", 0) == "2026-Q2"
            assert get_window_label("quarterly", 1) == "2026-Q1"

    def test_quarterly_year_rollover(self):
        with patch("app.admin_auth.datetime") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2026, 1, 5)  # Q1
            mock_dt.timedelta = datetime.timedelta
            assert get_window_label("quarterly", 1) == "2025-Q4"

    def test_annual(self):
        with patch("app.admin_auth.datetime") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2026, 5, 18)
            mock_dt.timedelta = datetime.timedelta
            assert get_window_label("annual", 0) == "2026"
            assert get_window_label("annual", 1) == "2025"


class TestDeriveKey:
    def test_deterministic(self):
        assert derive_key("secret", "label") == derive_key("secret", "label")

    def test_different_labels_differ(self):
        assert derive_key("secret", "label-a") != derive_key("secret", "label-b")

    def test_different_masters_differ(self):
        assert derive_key("secret-a", "label") != derive_key("secret-b", "label")

    def test_output_is_64_hex_chars(self):
        key = derive_key("mysecret", "2026-W20")
        assert len(key) == 64
        assert all(c in "0123456789abcdef" for c in key)


class TestValidateAdminKey:
    MASTER = "a" * 32
    PERIOD = "weekly"

    def test_valid_current_key(self):
        with patch("app.admin_auth.datetime") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2026, 5, 18)
            mock_dt.timedelta = datetime.timedelta
            label = get_window_label(self.PERIOD, 0)
            key = derive_key(self.MASTER, label)
            assert validate_admin_key(key, self.MASTER, self.PERIOD)

    def test_valid_previous_key(self):
        with patch("app.admin_auth.datetime") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2026, 5, 18)
            mock_dt.timedelta = datetime.timedelta
            label = get_window_label(self.PERIOD, 1)
            key = derive_key(self.MASTER, label)
            assert validate_admin_key(key, self.MASTER, self.PERIOD)

    def test_invalid_random_key(self):
        assert not validate_admin_key("randomgarbage", self.MASTER, self.PERIOD)

    def test_empty_provided(self):
        assert not validate_admin_key("", self.MASTER, self.PERIOD)

    def test_empty_master(self):
        assert not validate_admin_key("somekey", "", self.PERIOD)

    def test_old_key_rejected(self):
        with patch("app.admin_auth.datetime") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2026, 5, 18)
            mock_dt.timedelta = datetime.timedelta
            # key from 2 windows ago
            label = get_window_label(self.PERIOD, 2)
            key = derive_key(self.MASTER, label)
            assert not validate_admin_key(key, self.MASTER, self.PERIOD)


# ── Integration tests: endpoints ──────────────────────────────────────────────

@pytest.fixture
def client():
    import os
    os.environ["ANTHROPIC_AUTH_TOKEN"] = "test-token"
    os.environ["JWT_SECRET"] = "x" * 32
    os.environ["ADMIN_MASTER_SECRET"] = "a" * 32
    os.environ["CRON_SECRET"] = "c" * 32
    os.environ["ADMIN_KEY_LOG_ENABLED"] = "false"
    from app.config import get_settings
    get_settings.cache_clear()
    from app.main import app
    return TestClient(app)


def _current_key():
    return derive_key("a" * 32, get_window_label("weekly", 0))


class TestAdminKeyEndpoints:
    def test_list_users_valid_key(self, client):
        from app.main import app as _app, get_pool as _get_pool
        mock_pool = AsyncMock()
        mock_pool.fetchrow.return_value = {"cnt": 0}
        mock_pool.fetch.return_value = []

        async def _override():
            return mock_pool

        _app.dependency_overrides[_get_pool] = _override
        try:
            resp = client.get("/admin/users", headers={"x-admin-key": _current_key()})
        finally:
            _app.dependency_overrides.pop(_get_pool, None)
        assert resp.status_code != 401

    def test_list_users_invalid_key(self, client):
        resp = client.get("/admin/users", headers={"x-admin-key": "wrong"})
        assert resp.status_code == 401

    def test_list_users_no_key(self, client):
        resp = client.get("/admin/users")
        assert resp.status_code == 401

    def test_generate_key_log_valid_cron_secret(self, client, tmp_path):
        log_file = tmp_path / "admin_keys.txt"
        with patch("app.main.get_settings") as mock_settings:
            s = MagicMock()
            s.cron_secret = "c" * 32
            s.admin_master_secret = "a" * 32
            s.admin_key_log_enabled = True
            s.admin_key_rotation_period = "weekly"
            s.admin_key_log_path = str(log_file)
            mock_settings.return_value = s
            resp = client.post(
                "/admin/generate-key-log",
                headers={"x-cron-secret": "c" * 32},
            )
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_generate_key_log_invalid_cron_secret(self, client):
        resp = client.post(
            "/admin/generate-key-log",
            headers={"x-cron-secret": "wrong"},
        )
        assert resp.status_code == 401

    def test_generate_key_log_no_secret(self, client):
        resp = client.post("/admin/generate-key-log")
        assert resp.status_code == 401

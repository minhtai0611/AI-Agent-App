"""Tests for static admin key validation."""
import pytest
from unittest.mock import AsyncMock
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    import os
    os.environ["ANTHROPIC_AUTH_TOKEN"] = "test-token"
    os.environ["JWT_SECRET"] = "x" * 32
    os.environ["ADMIN_KEY"] = "test-admin-key-static"
    from app.config import get_settings
    get_settings.cache_clear()
    from app.main import app
    return TestClient(app)


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
            resp = client.get("/admin/users", headers={"x-admin-key": "test-admin-key-static"})
        finally:
            _app.dependency_overrides.pop(_get_pool, None)
        assert resp.status_code != 401

    def test_list_users_invalid_key(self, client):
        resp = client.get("/admin/users", headers={"x-admin-key": "wrong"})
        assert resp.status_code == 401

    def test_list_users_no_key(self, client):
        resp = client.get("/admin/users")
        assert resp.status_code == 401

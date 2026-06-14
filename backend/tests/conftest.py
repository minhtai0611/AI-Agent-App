"""Shared pytest configuration for all backend tests."""
import asyncio
import pytest


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "live_ai: requires a real ANTHROPIC_AUTH_TOKEN — makes live API calls",
    )
    config.addinivalue_line(
        "markers",
        "regression: guards a specific past production bug — must never be deleted",
    )
    config.addinivalue_line(
        "markers",
        "fault_injection: requires Toxiproxy sidecar — skipped by default",
    )
    config.addinivalue_line(
        "markers",
        "property_based: property / invariant tests via Hypothesis",
    )
    config.addinivalue_line(
        "markers",
        "oracle: LLM oracle tests (schema, metamorphic, or LLM-as-judge)",
    )


@pytest.fixture(scope="session")
def event_loop_for_sync():
    """Provide a persistent event loop for sync tests that call async functions."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
def _global_rate_limit_bypass():
    """
    Raise all rate-limit caps to 100,000 for every test by default.

    Why: the RateLimitMiddleware stores per-IP timestamps in memory. Since
    TestClient uses the same IP ("testclient") for every request, the bucket
    fills up after ~20 requests — or after 5 bad admin-key attempts (lockout) —
    causing 429s in unrelated tests.

    Tests that specifically exercise rate-limiting behaviour (e.g.
    test_rate_limit_triggered) override the limits themselves via monkeypatch
    AFTER this fixture runs, so this does not interfere with them.
    """
    import app.middleware as mw
    saved = (
        mw._IP_LIMIT, mw._USER_LIMIT, mw._HINT_RAPID_LIMIT,
        mw._ADMIN_IP_LIMIT, mw._ADMIN_FAIL_LIMIT,
    )
    mw._IP_LIMIT = mw._USER_LIMIT = mw._HINT_RAPID_LIMIT = 100_000
    mw._ADMIN_IP_LIMIT = mw._ADMIN_FAIL_LIMIT = 100_000
    yield
    (
        mw._IP_LIMIT, mw._USER_LIMIT, mw._HINT_RAPID_LIMIT,
        mw._ADMIN_IP_LIMIT, mw._ADMIN_FAIL_LIMIT,
    ) = saved

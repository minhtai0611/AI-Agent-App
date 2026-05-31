"""Shared pytest configuration for all backend tests."""
import asyncio
import pytest


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "live_ai: requires a real ANTHROPIC_AUTH_TOKEN — makes live API calls",
    )


@pytest.fixture(scope="session")
def event_loop_for_sync():
    """Provide a persistent event loop for sync tests that call async functions."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()

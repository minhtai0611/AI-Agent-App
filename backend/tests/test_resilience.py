"""
Resilience tests for call_with_retry (app/agent/core.py).

Tests verify:
  - Retries on transient errors (RateLimitError, APIConnectionError)
  - Succeeds on the Nth attempt after N-1 failures
  - Raises after exhausting all attempts
  - Retry count matches tenacity configuration (max 3 attempts)

asyncio.sleep is patched to skip actual waits so tests run instantly.
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agent.core import call_with_retry


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_fake_response(content: str = "ok") -> MagicMock:
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    return resp


def _rate_limit_error():
    """Build an openai.RateLimitError with the required constructor args."""
    from openai import RateLimitError
    return RateLimitError(
        message="Rate limit exceeded",
        response=MagicMock(status_code=429, headers={}),
        body={"error": {"type": "rate_limit_error"}},
    )


def _connection_error():
    from openai import APIConnectionError
    return APIConnectionError(request=MagicMock())


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_call_with_retry_succeeds_first_attempt():
    """No errors → returns result on first try without retrying."""
    mock_client = MagicMock()
    mock_client.chat.completions.create = AsyncMock(
        return_value=_make_fake_response("hello")
    )

    with patch("asyncio.sleep"):
        result = await call_with_retry(mock_client, model="m", messages=[])

    assert result.choices[0].message.content == "hello"
    assert mock_client.chat.completions.create.call_count == 1


@pytest.mark.asyncio
async def test_call_with_retry_retries_on_rate_limit_and_succeeds():
    """RateLimitError on attempts 1+2, success on attempt 3."""
    call_count = 0

    async def flaky(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise _rate_limit_error()
        return _make_fake_response("recovered")

    mock_client = MagicMock()
    mock_client.chat.completions.create = flaky

    with patch("asyncio.sleep"):
        result = await call_with_retry(mock_client, model="m", messages=[])

    assert call_count == 3
    assert result.choices[0].message.content == "recovered"


@pytest.mark.asyncio
async def test_call_with_retry_retries_on_connection_error():
    """APIConnectionError on attempt 1, success on attempt 2."""
    call_count = 0

    async def flaky(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise _connection_error()
        return _make_fake_response("ok")

    mock_client = MagicMock()
    mock_client.chat.completions.create = flaky

    with patch("asyncio.sleep"):
        result = await call_with_retry(mock_client, model="m", messages=[])

    assert call_count == 2
    assert result.choices[0].message.content == "ok"


@pytest.mark.asyncio
async def test_call_with_retry_exhausts_attempts_and_raises():
    """3 consecutive RateLimitErrors → raises after max attempts (3)."""
    call_count = 0

    async def always_fails(**kwargs):
        nonlocal call_count
        call_count += 1
        raise _rate_limit_error()

    mock_client = MagicMock()
    mock_client.chat.completions.create = always_fails

    with patch("asyncio.sleep"):
        from tenacity import RetryError
        with pytest.raises((RetryError, Exception)):
            await call_with_retry(mock_client, model="m", messages=[])

    # tenacity stop_after_attempt(3) → exactly 3 calls
    assert call_count == 3, f"Expected 3 attempts, got {call_count}"


@pytest.mark.asyncio
async def test_call_with_retry_does_not_retry_on_auth_error():
    """AuthenticationError is not a transient error — should NOT be retried."""
    from openai import AuthenticationError
    call_count = 0

    async def auth_fail(**kwargs):
        nonlocal call_count
        call_count += 1
        raise AuthenticationError(
            message="Invalid API key",
            response=MagicMock(status_code=401, headers={}),
            body={},
        )

    mock_client = MagicMock()
    mock_client.chat.completions.create = auth_fail

    with patch("asyncio.sleep"):
        with pytest.raises(Exception):
            await call_with_retry(mock_client, model="m", messages=[])

    # Auth errors are not retried — stops on first attempt
    assert call_count == 1, (
        f"AuthenticationError must not be retried; got {call_count} calls"
    )


@pytest.mark.asyncio
async def test_call_with_retry_passes_kwargs_to_client():
    """All kwargs are forwarded unchanged to client.chat.completions.create."""
    mock_client = MagicMock()
    mock_client.chat.completions.create = AsyncMock(
        return_value=_make_fake_response()
    )

    with patch("asyncio.sleep"):
        await call_with_retry(
            mock_client,
            model="claude-haiku-4.5",
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=50,
            temperature=0,
        )

    mock_client.chat.completions.create.assert_called_once_with(
        model="claude-haiku-4.5",
        messages=[{"role": "user", "content": "hi"}],
        max_tokens=50,
        temperature=0,
    )


def _auth_unavailable_error():
    """503 auth_unavailable — router-side provider outage, not our credentials."""
    from openai import APIStatusError
    return APIStatusError(
        message="503 auth_unavailable: no auth available (providers=claude, model=claude-sonnet-4-6)",
        response=MagicMock(status_code=503, headers={}),
        body={},
    )


@pytest.mark.asyncio
async def test_call_with_retry_falls_back_on_provider_unavailable():
    """401/503 provider-unavailable errors retry once against settings.fallback_model."""
    from openai import AuthenticationError

    async def primary_fails_fallback_succeeds(**kwargs):
        if kwargs.get("model") == "claude-sonnet-4.6":
            raise AuthenticationError(
                message="401 OAuth access token has expired",
                response=MagicMock(status_code=401, headers={}),
                body={},
            )
        return _make_fake_response("from fallback")

    mock_client = MagicMock()
    mock_client.chat.completions.create = primary_fails_fallback_succeeds

    with patch("asyncio.sleep"), \
         patch("app.config.get_settings") as mock_settings:
        mock_settings.return_value.fallback_model = "gemini-2.5-pro"
        result = await call_with_retry(mock_client, model="claude-sonnet-4.6", messages=[])

    assert result.choices[0].message.content == "from fallback"


@pytest.mark.asyncio
async def test_call_with_retry_falls_back_on_503_auth_unavailable():
    """503 auth_unavailable (router has no working session for that provider) triggers fallback too."""
    call_models = []

    async def track_and_respond(**kwargs):
        call_models.append(kwargs.get("model"))
        if kwargs["model"] == "claude-sonnet-4.6":
            raise _auth_unavailable_error()
        return _make_fake_response("ok")

    mock_client = MagicMock()
    mock_client.chat.completions.create = track_and_respond

    with patch("asyncio.sleep"), \
         patch("app.config.get_settings") as mock_settings:
        mock_settings.return_value.fallback_model = "gemini-2.5-pro"
        result = await call_with_retry(mock_client, model="claude-sonnet-4.6", messages=[])

    assert call_models == ["claude-sonnet-4.6", "gemini-2.5-pro"]
    assert result.choices[0].message.content == "ok"


@pytest.mark.asyncio
async def test_call_with_retry_no_fallback_when_unconfigured():
    """fallback_model blank (default) — provider-unavailable errors still raise, no second call."""
    call_count = 0

    async def auth_fail(**kwargs):
        nonlocal call_count
        call_count += 1
        from openai import AuthenticationError
        raise AuthenticationError(
            message="401 OAuth access token has expired",
            response=MagicMock(status_code=401, headers={}),
            body={},
        )

    mock_client = MagicMock()
    mock_client.chat.completions.create = auth_fail

    with patch("asyncio.sleep"), \
         patch("app.config.get_settings") as mock_settings:
        mock_settings.return_value.fallback_model = ""
        with pytest.raises(Exception):
            await call_with_retry(mock_client, model="claude-sonnet-4.6", messages=[])

    assert call_count == 1


@pytest.mark.asyncio
async def test_call_with_retry_no_fallback_on_bad_request():
    """400 BadRequestError is not a provider-availability problem — no fallback attempt."""
    from openai import BadRequestError
    call_count = 0

    async def bad_request(**kwargs):
        nonlocal call_count
        call_count += 1
        raise BadRequestError(
            message="400 invalid request",
            response=MagicMock(status_code=400, headers={}),
            body={},
        )

    mock_client = MagicMock()
    mock_client.chat.completions.create = bad_request

    with patch("asyncio.sleep"), \
         patch("app.config.get_settings") as mock_settings:
        mock_settings.return_value.fallback_model = "gemini-2.5-pro"
        with pytest.raises(Exception):
            await call_with_retry(mock_client, model="claude-sonnet-4.6", messages=[])

    assert call_count == 1


@pytest.mark.asyncio
async def test_call_with_retry_attempt_count_boundary():
    """
    Boundary: exactly 2 failures → succeeds (within 3-attempt limit).
    This guards against an off-by-one in stop_after_attempt.
    """
    call_count = 0

    async def fail_twice(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count <= 2:
            raise _rate_limit_error()
        return _make_fake_response("boundary ok")

    mock_client = MagicMock()
    mock_client.chat.completions.create = fail_twice

    with patch("asyncio.sleep"):
        result = await call_with_retry(mock_client, model="m", messages=[])

    assert result.choices[0].message.content == "boundary ok"
    assert call_count == 3

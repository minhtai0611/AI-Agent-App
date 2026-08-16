import logging
import re

from openai import (
    AsyncOpenAI,
    APIStatusError,
    AuthenticationError,
    RateLimitError,
    APIConnectionError,
    APITimeoutError,
)
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

# Only retry transient errors. Auth / permission / not-found errors are permanent
# and retrying them wastes quota and adds latency without any chance of recovery.
_TRANSIENT = (RateLimitError, APIConnectionError, APITimeoutError)

# Router-side "this model's provider has no working credentials right now" errors
# (e.g. an expired upstream OAuth session for one provider) — distinct from a bad
# request or an auth problem with our own ANTHROPIC_AUTH_TOKEN, neither of which
# a model swap would fix.
_PROVIDER_UNAVAILABLE_STATUS = {401, 503}


def _provider_unavailable(exc: Exception) -> bool:
    if isinstance(exc, AuthenticationError):
        return True
    if isinstance(exc, APIStatusError):
        return exc.status_code in _PROVIDER_UNAVAILABLE_STATUS
    return False


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(min=1, max=10),
    retry=retry_if_exception_type(_TRANSIENT),
    reraise=True,
)
async def _call(client: AsyncOpenAI, **kwargs):
    return await client.chat.completions.create(**kwargs)


async def call_with_retry(client: AsyncOpenAI, **kwargs):
    """Retries transient errors, then falls back to settings.fallback_model
    (if configured) when the requested model's provider is unavailable."""
    try:
        return await _call(client, **kwargs)
    except (AuthenticationError, APIStatusError) as exc:
        if not _provider_unavailable(exc):
            raise
        from app.config import get_settings
        fallback = get_settings().fallback_model
        requested = kwargs.get("model")
        if not fallback or fallback == requested:
            raise
        logger.warning(
            "call_with_retry: provider unavailable for model=%s (%s) — falling back to %s",
            requested, exc, fallback,
        )
        return await _call(client, **{**kwargs, "model": fallback})


def extract_json(text: str) -> str:
    """Return the first balanced {...} block found anywhere in the text
    (depth-matched, so nested objects/arrays survive), falling back to
    stripping markdown code fences. Models occasionally wrap JSON in prose
    or code fences despite instructions not to."""
    start = text.find("{")
    if start != -1:
        depth = 0
        for i, ch in enumerate(text[start:], start):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start:i + 1]
    text = re.sub(r'^```(?:json)?\s*', '', text.strip())
    text = re.sub(r'\s*```$', '', text)
    return text.strip()

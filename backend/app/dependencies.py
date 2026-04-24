from functools import lru_cache
from openai import AsyncOpenAI
from app.config import get_settings


@lru_cache
def get_ai_client() -> AsyncOpenAI:
    settings = get_settings()
    router_root = settings.anthropic_base_url.rstrip("/")
    return AsyncOpenAI(
        api_key=settings.anthropic_auth_token,
        base_url=f"{router_root}/v2",
    )


# Backward-compat alias
get_anthropic_client = get_ai_client

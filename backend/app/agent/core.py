from openai import AsyncOpenAI, RateLimitError, APIConnectionError, APITimeoutError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

# Only retry transient errors. Auth / permission / not-found errors are permanent
# and retrying them wastes quota and adds latency without any chance of recovery.
_TRANSIENT = (RateLimitError, APIConnectionError, APITimeoutError)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(min=1, max=10),
    retry=retry_if_exception_type(_TRANSIENT),
    reraise=True,
)
async def call_with_retry(client: AsyncOpenAI, **kwargs):
    return await client.chat.completions.create(**kwargs)

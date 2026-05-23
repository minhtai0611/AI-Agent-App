from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def call_with_retry(client: AsyncOpenAI, **kwargs):
    return await client.chat.completions.create(**kwargs)

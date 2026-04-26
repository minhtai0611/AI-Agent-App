import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry
from app.math_wiki.prompts import MODE_PROMPTS
from app.math_wiki.utils import _strip_code_fence, VALID_LABELS


async def classify_problem(client: AsyncOpenAI, problem_text: str) -> str:
    settings = get_settings()
    response = await call_with_retry(
        client,
        model=settings.haiku_model,
        messages=[
            {"role": "system", "content": MODE_PROMPTS["CLASSIFY"]},
            {"role": "user", "content": problem_text},
        ],
        max_tokens=100,
    )
    content = _strip_code_fence(response.choices[0].message.content or "{}")
    parsed = json.loads(content)
    label = parsed.get("label", "")
    if label not in VALID_LABELS:
        raise ValueError(f"Unknown label: {label!r}")
    return label

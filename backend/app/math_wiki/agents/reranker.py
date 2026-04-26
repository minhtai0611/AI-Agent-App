import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry
from app.math_wiki.prompts import MODE_PROMPTS
from app.math_wiki.utils import _strip_code_fence
from app.math_wiki.schemas import WikiUnit


async def rerank(client: AsyncOpenAI, query: str, candidates: list[WikiUnit]) -> list[str]:
    settings = get_settings()
    candidate_input = [
        {"id": u.id, "type": u.type, "content": u.content}
        for u in candidates
    ]
    payload = json.dumps({"query": query, "candidates": candidate_input})
    response = await call_with_retry(
        client,
        model=settings.default_model,
        messages=[
            {"role": "system", "content": MODE_PROMPTS["RERANK"]},
            {"role": "user", "content": payload},
        ],
        max_tokens=200,
    )
    content = _strip_code_fence(response.choices[0].message.content or "{}")
    parsed = json.loads(content)
    top_ids: list[str] = parsed.get("top_ids", [])

    valid_ids = {u.id for u in candidates}
    for uid in top_ids:
        if uid not in valid_ids:
            raise ValueError(f"Hallucinated ID from reranker: {uid!r}")

    return top_ids[:5]

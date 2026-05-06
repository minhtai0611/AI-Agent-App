import json
import logging
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry
from app.math_wiki.prompts import MODE_PROMPTS
from app.math_wiki.utils import _extract_json
from app.math_wiki.schemas import WikiUnit

logger = logging.getLogger(__name__)


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
    content = _extract_json(response.choices[0].message.content or "{}")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        parsed = {}
    top_ids: list[str] = parsed.get("top_ids", [])

    valid_ids = {u.id for u in candidates}
    filtered = [uid for uid in top_ids if uid in valid_ids]
    if len(filtered) < len(top_ids):
        logger.warning(
            "Reranker returned %d unknown ID(s), filtered out",
            len(top_ids) - len(filtered),
        )
    return filtered[:5]

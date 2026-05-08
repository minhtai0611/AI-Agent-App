import json
import logging
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry
from app.math_wiki.prompts import MODE_PROMPTS
from app.math_wiki.utils import _extract_json
from app.math_wiki.schemas import WikiUnit, ReviewOutput

logger = logging.getLogger(__name__)

_VALID_VERDICTS = {"correct", "partial", "incorrect"}


async def review_solution(
    client: AsyncOpenAI,
    problem: str,
    solution: str,
    context: list[WikiUnit],
) -> ReviewOutput:
    settings = get_settings()
    payload = (
        json.dumps({
            "problem": problem,
            "solution": solution,
            "context": [{"id": u.id, "content": u.content} for u in context],
        })
        + "\n\nRespond with ONLY a JSON object. No prose or markdown."
    )
    response = await call_with_retry(
        client,
        model=settings.default_model,
        messages=[
            {"role": "system", "content": MODE_PROMPTS["REVIEW"]},
            {"role": "user", "content": payload},
        ],
        max_tokens=2048,
    )
    content = _extract_json(response.choices[0].message.content or "{}")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        raise ValueError("Review agent returned malformed JSON")

    verdict = parsed.get("verdict", "incorrect")
    if verdict not in _VALID_VERDICTS:
        verdict = "incorrect"

    return ReviewOutput(
        verdict=verdict,
        score=str(parsed.get("score", "0/10")),
        correct_steps=[str(s) for s in parsed.get("correct_steps", []) if str(s).strip()],
        errors=[str(e) for e in parsed.get("errors", []) if str(e).strip()],
        feedback=str(parsed.get("feedback", "")),
        correct_approach=str(parsed.get("correct_approach", "")),
    )

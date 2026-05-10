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


def _is_inconsistent(parsed: dict) -> bool:
    """Return True when verdict is non-correct but all explanatory fields are empty."""
    if parsed.get("verdict") == "correct":
        return False
    has_errors = bool([e for e in parsed.get("errors", []) if str(e).strip()])
    has_feedback = bool(str(parsed.get("feedback", "")).strip())
    return not has_errors and not has_feedback


async def _call_reviewer(client: AsyncOpenAI, messages: list, settings) -> dict:
    response = await call_with_retry(
        client,
        model=settings.default_model,
        messages=messages,
        max_tokens=2048,
    )
    content = _extract_json(response.choices[0].message.content or "{}")
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        raise ValueError("Review agent returned malformed JSON")


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
    messages = [
        {"role": "system", "content": MODE_PROMPTS["REVIEW"]},
        {"role": "user", "content": payload},
    ]

    parsed = await _call_reviewer(client, messages, settings)

    if _is_inconsistent(parsed):
        logger.warning("Reviewer returned inconsistent response (non-correct with no errors/feedback) — retrying")
        parsed = await _call_reviewer(client, messages, settings)

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

"""Drafts a structured math-question candidate via ai-router.locdo.tech.

The draft is a constrained JSON shape (see prompts/draft_question.md), never free-form
prose — that's what makes verifier.py's independent symbolic check possible. The model's
own claimed answer is kept, but it's advisory: verifier.py is the actual judge.
"""
from pathlib import Path

from app.agent.router_client import AiRouterClient

_PROMPT_PATH = Path(__file__).parent / "prompts" / "draft_question.md"

REQUIRED_FIELDS = (
    "question_tex",
    "variables",
    "given_equations",
    "target_expression",
    "choice_expressions",
    "claimed_correct_index",
    "explanation_tex",
)


class DraftShapeError(ValueError):
    """Raised when the model's JSON is missing a required field or has the wrong shape."""


def _validate_shape(draft: dict) -> None:
    missing = [f for f in REQUIRED_FIELDS if f not in draft]
    if missing:
        raise DraftShapeError(f"draft missing fields: {missing}")
    if not isinstance(draft["choice_expressions"], list) or len(draft["choice_expressions"]) != 4:
        raise DraftShapeError("choice_expressions must be a list of exactly 4 entries")
    if not isinstance(draft["variables"], list) or not draft["variables"]:
        raise DraftShapeError("variables must be a non-empty list")
    idx = draft["claimed_correct_index"]
    if not isinstance(idx, int) or not (0 <= idx < 4):
        raise DraftShapeError("claimed_correct_index must be an integer in [0, 3]")


async def draft(client: AiRouterClient, topic: str, difficulty: str, feedback: str | None = None) -> dict:
    """Ask the router for one candidate question. Raises DraftShapeError on a malformed reply."""
    system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    user_prompt = f"Topic: {topic}\nDifficulty: {difficulty}"
    if feedback:
        user_prompt += f"\n\nYour previous attempt was rejected: {feedback}\nDraft a different question."

    result = await client.complete_json(system_prompt, user_prompt)
    _validate_shape(result)
    result["topic"] = topic
    result["difficulty"] = difficulty
    return result

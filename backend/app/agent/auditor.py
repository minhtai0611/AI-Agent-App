"""Audits an EXISTING question (static or agent-origin) already in the `questions` table.

Mirrors generator.py + verifier.py's trust boundary: the model never gets to declare a
question correct or wrong on its own say-so. It only transcribes the question into the
same sympy-checkable shape generator.py drafts in, then verifier.verify() — the same
independent symbolic check used for newly-generated questions — decides. A question that
doesn't reduce to that shape (geometry proofs, prose choices, etc.) comes back
`unauditable`, not a false pass.
"""
import json
from dataclasses import dataclass
from pathlib import Path

from app.agent import verifier
from app.agent.router_client import AiRouterClient

_PROMPT_PATH = Path(__file__).parent / "prompts" / "audit_question.md"


class AuditShapeError(ValueError):
    """Raised when the model's transcription JSON is malformed."""


@dataclass
class AuditResult:
    status: str  # "verified" | "mismatch" | "unauditable" | "error"
    stored_index: int
    verified_index: int | None
    reason: str


def _validate_shape(transcript: dict) -> None:
    if "transcribable" not in transcript:
        raise AuditShapeError("missing 'transcribable' field")
    if transcript["transcribable"] is False:
        if "reason" not in transcript:
            raise AuditShapeError("non-transcribable response missing 'reason'")
        return
    required = ("variables", "given_equations", "target_expression", "choice_expressions", "claimed_correct_index")
    missing = [f for f in required if f not in transcript]
    if missing:
        raise AuditShapeError(f"transcript missing fields: {missing}")
    if not isinstance(transcript["choice_expressions"], list) or not transcript["choice_expressions"]:
        raise AuditShapeError("choice_expressions must be a non-empty list")


async def audit_question(client: AiRouterClient, question_row: dict) -> AuditResult:
    """question_row needs: question, choices (list of str), correct (0-based index)."""
    choices = question_row["choices"]
    stored_index = question_row["correct"]

    system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    choices_block = "\n".join(f"{i}: {c}" for i, c in enumerate(choices))
    user_prompt = f"Question: {question_row['question']}\n\nChoices:\n{choices_block}"

    try:
        transcript = await client.complete_json(system_prompt, user_prompt)
        _validate_shape(transcript)
    except Exception as exc:
        return AuditResult("error", stored_index, None, f"transcription failed: {exc}")

    if transcript["transcribable"] is False:
        return AuditResult("unauditable", stored_index, None, transcript["reason"])

    if len(transcript["choice_expressions"]) != len(choices):
        return AuditResult(
            "error", stored_index, None,
            f"transcript has {len(transcript['choice_expressions'])} choices, question has {len(choices)}",
        )

    # verify()'s `ok` flag reflects the model's OWN claimed_correct_index, which audit
    # doesn't care about — only the independently computed verified_index matters here.
    result = verifier.verify(transcript)
    if result.verified_index is None:
        return AuditResult("error", stored_index, None, f"could not independently determine an answer: {result.reason}")

    if result.verified_index == stored_index:
        return AuditResult("verified", stored_index, result.verified_index, "stored answer confirmed independently")

    return AuditResult(
        "mismatch", stored_index, result.verified_index,
        f"independently computed answer is index {result.verified_index}, stored answer is index {stored_index}",
    )

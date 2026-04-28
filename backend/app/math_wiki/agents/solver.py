import json
import re
import logging
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry
from app.math_wiki.prompts import MODE_PROMPTS
from app.math_wiki.utils import _extract_json, InsufficientKnowledgeError, VALID_CONFIDENCE
from app.math_wiki.schemas import WikiUnit, SolverOutput

logger = logging.getLogger(__name__)

# Bare slug/ID with no whitespace — not a human-readable step
_SLUG_RE = re.compile(r'^[\w-]+$')


def _normalize(parsed: dict, valid_ids: set[str]) -> SolverOutput:
    """Map whatever JSON structure the model returns into SolverOutput fields."""

    # --- steps ---
    def _step_to_str(s) -> str:
        if isinstance(s, str):
            # Slug-like strings (no whitespace) are leaked wiki IDs, not steps
            if _SLUG_RE.match(s):
                return ""
            return s
        if isinstance(s, dict):
            # Model returned {"step": N, "description": "...", "result": "..."}
            desc = s.get("description") or s.get("work") or s.get("explanation") or ""
            result = s.get("result") or ""
            if desc and result and result not in desc:
                return f"{desc} → {result}"
            return desc or result or str(s)
        return str(s)

    steps: list[str] = []
    if isinstance(parsed.get("steps"), list):
        steps = [_step_to_str(s) for s in parsed["steps"]]
    elif isinstance(parsed.get("solution"), dict):
        sol = parsed["solution"]
        if isinstance(sol.get("steps"), list):
            steps = [_step_to_str(s) for s in sol["steps"]]
    if not steps:
        for key in ("work", "explanation", "method"):
            if val := parsed.get(key):
                steps = [str(val)]
                break
    # Drop empty strings AND slug-like tokens regardless of how they were produced
    steps = [s for s in steps if s.strip() and not _SLUG_RE.match(s.strip())]

    # --- final_answer ---
    final_answer: str = ""
    for key in ("final_answer", "answer"):
        if val := parsed.get(key):
            final_answer = str(val)
            break
    if not final_answer:
        sol = parsed.get("solution")
        if isinstance(sol, str):
            final_answer = sol
        elif isinstance(sol, dict):
            final_answer = str(sol.get("answer") or sol.get("result") or "")
    if not final_answer:
        for key in ("roots", "solutions", "result", "x"):
            if val := parsed.get(key):
                final_answer = str(val)
                break

    # Guard: model returned a list (JSON array or Python literal) instead of a formatted string.
    # Reformat as human-readable "x = a hoặc x = b" — the validator still flags
    # ODE cases where roots ≠ general solution.
    if final_answer and final_answer.lstrip().startswith('['):
        parsed_fa = None
        try:
            parsed_fa = json.loads(final_answer)
        except json.JSONDecodeError:
            try:
                import ast
                parsed_fa = ast.literal_eval(final_answer)
            except (ValueError, SyntaxError):
                pass
        if isinstance(parsed_fa, list) and parsed_fa:
            raw_items = [str(v) for v in parsed_fa]

            def _has_equation(v: str) -> bool:
                inner = v.strip()
                if inner.startswith('$') and inner.endswith('$'):
                    inner = inner[1:-1]
                return '=' in inner

            parts = [item if _has_equation(item) else f"x = {item}" for item in raw_items]
            final_answer = parts[0] if len(parts) == 1 else " hoặc ".join(parts)
            logger.warning("Reformatted list final_answer to: %r", final_answer)

    # --- problem_type ---
    problem_type = str(parsed.get("problem_type", parsed.get("method", "algebra")))

    # --- used_knowledge_ids — keep only IDs that actually exist in context ---
    raw_ids = parsed.get("used_knowledge_ids", [])
    if not isinstance(raw_ids, list):
        raw_ids = []
    used_ids = [uid for uid in raw_ids if uid in valid_ids]

    # --- confidence ---
    confidence = str(parsed.get("confidence", "medium"))
    if confidence not in VALID_CONFIDENCE:
        confidence = "medium"

    if not final_answer:
        raise InsufficientKnowledgeError("Solver returned no answer")

    # Warn when final_answer is not mentioned in any step — likely a commit-before-compute error.
    if steps and not any(final_answer.lower()[:20] in s.lower() for s in steps):
        logger.warning(
            "final_answer %r not found in steps — possible answer/step mismatch", final_answer
        )

    return SolverOutput(
        problem_type=problem_type,
        used_knowledge_ids=used_ids,
        steps=steps or [final_answer],
        final_answer=final_answer,
        confidence=confidence,
    )


async def solve(client: AsyncOpenAI, problem_text: str, context: list[WikiUnit]) -> SolverOutput:
    settings = get_settings()
    payload = json.dumps({
        "problem": problem_text,
        "context": [{"id": u.id, "type": u.type, "content": u.content} for u in context],
    }) + "\n\nRespond with ONLY a JSON object. No prose or markdown."
    response = await call_with_retry(
        client,
        model=settings.default_model,
        messages=[
            {"role": "system", "content": MODE_PROMPTS["SOLVE"]},
            {"role": "user", "content": payload},
        ],
        max_tokens=1500,
    )
    content = _extract_json(response.choices[0].message.content or "{}")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        raise InsufficientKnowledgeError("Malformed solver response")

    valid_ids = {u.id for u in context}
    return _normalize(parsed, valid_ids)

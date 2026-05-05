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


_EXPECTED_KEYS = {"problem_type", "steps", "final_answer", "confidence", "used_knowledge_ids"}


def _normalize(parsed: dict, valid_ids: set[str], _label_hint: str = "") -> SolverOutput:
    """Map whatever JSON structure the model returns into SolverOutput fields."""

    # Model sometimes wraps the response in a single top-level key (e.g. {"proof": {...}}).
    # Unwrap when none of the expected keys are present at the top level.
    if parsed and not (_EXPECTED_KEYS & parsed.keys()):
        inner = next(iter(parsed.values()))
        if isinstance(inner, dict):
            parsed = inner

    # --- steps ---
    def _step_to_str(s) -> str:
        if isinstance(s, str):
            # Slug-like strings (no whitespace) are leaked wiki IDs, not steps
            if _SLUG_RE.match(s):
                return ""
            return s
        if isinstance(s, dict):
            # Model returned {"step": N, "description"/"action"/"detail": "...", "result": "..."}
            desc = (s.get("description") or s.get("action") or s.get("statement")
                    or s.get("detail") or s.get("work") or s.get("explanation") or "")
            result = s.get("result") or ""
            if not desc:
                # Collect string values; for nested dicts, recurse one level deep
                parts = []
                for k, v in s.items():
                    if k == "step":
                        continue
                    if isinstance(v, str) and v.strip():
                        parts.append(v)
                    elif isinstance(v, dict):
                        parts.append(_step_to_str(v))
                desc = " ".join(p for p in parts if p)
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
    _SIMPLE_VAR = re.compile(r'^[a-zA-Z_]\w{0,3}$')  # x, y, x1, y_0 — short math vars only

    def _dict_to_str(d: dict) -> str:
        """Convert a dict final_answer to a readable string.
        Simple variable keys (x, y) → $x = 3$; Vietnamese/long keys → plain "key: value"."""
        parts = []
        for k, v in d.items():
            k_str = str(k).replace("_", " ")
            v_str = str(v)
            if _SIMPLE_VAR.match(str(k)):
                parts.append(f"${k_str} = {v_str}$")
            else:
                parts.append(f"{k_str}: {v_str}")
        return " và ".join(parts) if parts else ""

    def _coerce_final(val) -> str:
        if isinstance(val, dict):
            return _dict_to_str(val)
        s = str(val)
        # Model returned a Python dict repr string like "{'x': 3, 'y': 2}"
        if s.startswith("{") and s.endswith("}"):
            try:
                import ast
                parsed_val = ast.literal_eval(s)
                if isinstance(parsed_val, dict):
                    return _dict_to_str(parsed_val)
            except (ValueError, SyntaxError):
                pass
        return s

    final_answer: str = ""
    for key in ("final_answer", "answer"):
        if val := parsed.get(key):
            final_answer = _coerce_final(val)
            break
    if not final_answer:
        sol = parsed.get("solution")
        if isinstance(sol, str):
            final_answer = sol
        elif isinstance(sol, dict):
            inner = sol.get("answer") or sol.get("result") or sol.get("conclusion") or sol.get("summary")
            if inner:
                final_answer = _coerce_final(inner)
            else:
                # Try solution.results (e.g. {"cuc_dai": {"x": -1, "y": 10}, ...})
                results = sol.get("results")
                if isinstance(results, dict):
                    parts = []
                    for k, v in results.items():
                        k_label = str(k).replace("_", " ")
                        v_str = _dict_to_str(v) if isinstance(v, dict) else str(v)
                        parts.append(f"{k_label}: {v_str}")
                    final_answer = "; ".join(parts)
                # Don't call _dict_to_str(sol) — that formats steps+results together which is ugly
    if not final_answer:
        for key in ("roots", "solutions", "result", "x"):
            if val := parsed.get(key):
                final_answer = str(val)
                break
    # Proof-mode fallbacks: model may use "statement" or "conclusion" instead of "final_answer"
    if not final_answer:
        for key in ("statement", "conclusion", "summary"):
            if val := parsed.get(key):
                final_answer = str(val)
                if not final_answer.rstrip().endswith("∎"):
                    final_answer = final_answer.rstrip() + " ∎"
                break

    # Last-resort catch-all: model used completely non-standard keys.
    if not final_answer:
        # 1. If steps were extracted, use the last step as final_answer.
        if steps:
            final_answer = steps[-1]
            logger.warning("Derived final_answer from last step (keys: %s)", list(parsed.keys()))
        else:
            # 2. Collect string values; use them as steps + answer.
            all_vals = [str(v) for v in parsed.values() if isinstance(v, str) and str(v).strip()]
            if all_vals:
                steps = all_vals
                final_answer = all_vals[-1]
                logger.warning("Used string catch-all for keys: %s", list(parsed.keys()))
            else:
                # 3. Format list-of-dict values (e.g. extrema, roots) into a readable string.
                for v in parsed.values():
                    if isinstance(v, list) and v and isinstance(v[0], dict):
                        parts = []
                        for item in v:
                            parts.append(", ".join(f"{k} = {val}" for k, val in item.items()))
                        final_answer = "; ".join(parts)
                        steps = [final_answer]
                        logger.warning("Formatted list-of-dict value for keys: %s", list(parsed.keys()))
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
    _LABEL_VI = {
        "algebra": "đại số", "geometry": "hình học", "calculus": "giải tích",
        "trigonometry": "lượng giác", "statistics": "thống kê", "probability": "xác suất",
        "combinatorics": "tổ hợp", "number_theory": "số học",
        "complex_numbers": "số phức", "sequences": "dãy số",
        "vectors": "vectơ", "functions": "hàm số",
    }
    _raw_pt = str(parsed.get("problem_type", parsed.get("method", "")))
    if _raw_pt:
        problem_type = _raw_pt
    else:
        problem_type = _LABEL_VI.get(_label_hint, _label_hint or "đại số")

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


async def solve(client: AsyncOpenAI, problem_text: str, context: list[WikiUnit], label: str = "") -> SolverOutput:
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
        max_tokens=2500,
    )
    content = _extract_json(response.choices[0].message.content or "{}")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        raise InsufficientKnowledgeError("Malformed solver response")
    valid_ids = {u.id for u in context}
    result = _normalize(parsed, valid_ids, _label_hint=label)

    # Guard: if final_answer echoes the problem (starts with an imperative verb and overlaps
    # significantly with the question), replace it with the last non-trivial step.
    _STARTERS = ("tìm ", "cho ", "tính ", "giải ", "chứng ", "hãy ", "biết ", "xét ")
    fa_lower = result.final_answer.lower().strip()
    pt_lower = problem_text.lower()
    if (any(fa_lower.startswith(s) for s in _STARTERS)
            and pt_lower[:40] in fa_lower):
        candidate = next(
            (s for s in reversed(result.steps)
             if s.strip() and not any(s.lower().strip().startswith(st) for st in _STARTERS)),
            None,
        )
        if candidate:
            logger.warning("final_answer resembled the question — substituted last useful step")
            result = result.model_copy(update={"final_answer": candidate})

    return result

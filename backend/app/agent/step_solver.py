"""Generate -> verify -> gate loop for step-by-step equation solving.

Same split as visualization_generator.py: the model only ever proposes the equation
(as a constrained lhs/rhs/variable triple) or self-abstains — it never performs or
narrates a mathematical transformation on its own. `solve_steps` builds every
intermediate step with sympy, `verify_steps` independently re-checks each one is
symbolically equivalent to the last, and `narrate_steps` is the only LLM call that
touches already-verified steps — it captions them in Vietnamese, never recomputes them.
A captioning failure degrades to a missing caption, never to wrong math.
"""
from pathlib import Path

import sympy

from app.agent.router_client import AiRouterClient
from app.agent.verifier import VerificationResult

_PROMPT_PATH = Path(__file__).parent / "prompts" / "draft_equation.md"

MAX_ATTEMPTS = 2


class EquationShapeError(ValueError):
    """Raised when the model's JSON is neither a valid abstention nor a valid equation."""


async def draft_equation(client: AiRouterClient, question_row: dict, feedback: str | None = None) -> dict:
    system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    user_prompt = (
        f"Question: {question_row.get('question', '')}\n"
        f"Explanation: {question_row.get('explanation', '')}\n"
    )
    if feedback:
        user_prompt += f"\nYour previous attempt was rejected: {feedback}\nTry again, or self-abstain.\n"

    result = await client.complete_json(system_prompt, user_prompt)

    if result.get("available") is False:
        return {"available": False, "reason": result.get("reason", "model self-abstained")}

    for field in ("lhs", "rhs", "variable"):
        if not isinstance(result.get(field), str) or not result[field].strip():
            raise EquationShapeError(f"missing or invalid field: {field}")

    return {"available": True, "lhs": result["lhs"], "rhs": result["rhs"], "variable": result["variable"]}


def solve_steps(lhs_str: str, rhs_str: str, variable: str) -> dict:
    """Deterministic sympy derivation. Returns {"zero_form", "variable_symbol", "solutions", "steps"}
    where each step is {"op", "before", "after"} — sympy Eq objects, not yet stringified.
    Raises ValueError if lhs/rhs don't parse or `variable` doesn't appear in them.
    """
    var = sympy.Symbol(variable)
    lhs = sympy.sympify(lhs_str)
    rhs = sympy.sympify(rhs_str)
    if var not in lhs.free_symbols | rhs.free_symbols:
        raise ValueError(f"variable '{variable}' does not appear in the equation")

    steps = []
    zero_form = sympy.expand(lhs - rhs)
    if lhs != zero_form or rhs != 0:
        steps.append({"op": "isolate", "before": sympy.Eq(lhs, rhs), "after": sympy.Eq(zero_form, 0)})

    factored = sympy.factor(zero_form)
    current = zero_form
    if factored != current:
        steps.append({"op": "factor", "before": sympy.Eq(current, 0), "after": sympy.Eq(factored, 0)})
        current = factored

    solutions = sympy.solve(sympy.Eq(zero_form, 0), var)
    if not solutions:
        raise ValueError("equation has no solution")
    steps.append({
        "op": "substitute",
        "before": sympy.Eq(current, 0),
        "after": sympy.Eq(var, sympy.FiniteSet(*solutions), evaluate=False),
    })

    return {"zero_form": zero_form, "variable_symbol": var, "solutions": solutions, "steps": steps}


def verify_steps(derivation: dict) -> VerificationResult:
    """Every non-final step must preserve the zero-form exactly (factor/expand/simplify
    are algebraically-equal rewrites of the same expression); the final step is checked
    by substituting each claimed solution back into the original zero-form equation.
    """
    zero_form = derivation["zero_form"]
    var = derivation["variable_symbol"]
    steps = derivation["steps"]

    for i, step in enumerate(steps[:-1]):
        before_zero = sympy.expand(step["before"].lhs - step["before"].rhs)
        after_zero = sympy.expand(step["after"].lhs - step["after"].rhs)
        if sympy.simplify(before_zero - after_zero) != 0:
            return VerificationResult(False, None, f"step {i + 1} ({step['op']}) is not equivalent to the previous step")

    final = steps[-1]
    solutions = final["after"].rhs
    for sol in solutions:
        residual = sympy.simplify(zero_form.subs(var, sol))
        if residual != 0:
            return VerificationResult(False, None, f"claimed solution {var}={sol} does not satisfy the equation")

    return VerificationResult(True, None, "verified")


def _format_eq(eq) -> str:
    """LaTeX for the frontend's KaTeX pipeline — the plain sympy str() form uses
    Python operators (`**`, `*`) a math-rendering pipeline can't typeset."""
    return f"{sympy.latex(eq.lhs)} = {sympy.latex(eq.rhs)}"


async def narrate_steps(client: AiRouterClient, steps: list[dict]) -> list[str | None]:
    """Best-effort Vietnamese caption per step. Never raises — a captioning failure
    (bad JSON, malformed shape, router error) yields None captions, not an exception,
    since the math itself is already verified and must always be returned.
    """
    try:
        system_prompt = (
            "You caption already-verified algebra steps in short Vietnamese sentences. "
            "Return ONLY a JSON array of strings, one per step, no other text."
        )
        user_prompt = "\n".join(
            f"{i + 1}. {_format_eq(s['before'])}  ->  {_format_eq(s['after'])}  ({s['op']})"
            for i, s in enumerate(steps)
        )
        result = await client.complete_json(system_prompt, user_prompt)
        captions = result if isinstance(result, list) else result.get("captions")
        if not isinstance(captions, list) or len(captions) != len(steps):
            return [None] * len(steps)
        return [c if isinstance(c, str) else None for c in captions]
    except Exception:
        return [None] * len(steps)


async def generate_solution(client: AiRouterClient, question_row: dict) -> dict:
    """generate -> verify -> gate for the equation extraction; solve_steps/verify_steps
    are always deterministic once an equation is accepted. Returns
    {"available": bool, "steps": [{"op","before","after","caption"}] | None, "reason": str | None}.
    """
    feedback = None
    last_reason = "no attempts made"

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            draft = await draft_equation(client, question_row, feedback=feedback)
        except EquationShapeError as exc:
            last_reason = f"attempt {attempt}: malformed draft — {exc}"
            feedback = str(exc)
            continue

        if not draft.get("available"):
            last_reason = draft.get("reason", "model self-abstained")
            continue

        try:
            derivation = solve_steps(draft["lhs"], draft["rhs"], draft["variable"])
        except (sympy.SympifyError, ValueError, TypeError) as exc:
            last_reason = f"attempt {attempt}: could not solve — {exc}"
            feedback = str(exc)
            continue

        result = verify_steps(derivation)
        if not result.ok:
            last_reason = result.reason
            feedback = result.reason
            continue

        captions = await narrate_steps(client, derivation["steps"])
        steps_out = [
            {"op": s["op"], "before": _format_eq(s["before"]), "after": _format_eq(s["after"]), "caption": caption}
            for s, caption in zip(derivation["steps"], captions)
        ]
        return {"available": True, "steps": steps_out, "reason": None}

    return {"available": False, "steps": None, "reason": last_reason}

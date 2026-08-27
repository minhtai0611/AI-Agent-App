"""Generate -> verify -> gate loop for the Math Playground's natural-language entry mode.

Same split as the rest of the Pure Mathematics Toolset: the model proposes a constrained
PlotSpec (which curves, which operation) or self-abstains; sympy independently parses
every curve and re-solves any requested operation (intersect, tangent_at) before the
spec is ever trusted. Manually-typed curves in the frontend never touch this file at
all — they render straight from client-side state, so this is purely the AI-populated path.
"""
from pathlib import Path

import sympy

from app.agent.plot_schema import PlotSpec, validate_spec
from app.agent.router_client import AiRouterClient
from app.agent.verifier import VerificationResult

_PROMPT_PATH = Path(__file__).parent / "prompts" / "draft_plot.md"

MAX_ATTEMPTS = 2


class PlotShapeError(ValueError):
    """Raised when the model's JSON is neither a valid abstention nor a valid spec."""


async def draft_plot(client: AiRouterClient, prompt_text: str, feedback: str | None = None) -> dict:
    system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    user_prompt = prompt_text
    if feedback:
        user_prompt += f"\n\nYour previous attempt was rejected: {feedback}\nTry again, or self-abstain."

    result = await client.complete_json(system_prompt, user_prompt)

    if result.get("available") is False:
        return {"available": False, "reason": result.get("reason", "model self-abstained")}

    spec_fields = {k: v for k, v in result.items() if k not in ("available", "reason")}
    try:
        spec = validate_spec(spec_fields)
    except Exception as exc:
        raise PlotShapeError(str(exc)) from exc

    return {"available": True, "spec": spec}


def verify_plot(spec: PlotSpec) -> VerificationResult:
    """Independently parses every curve and re-solves any requested op with sympy —
    the model's spec is never trusted just because it validated against the schema."""
    x = sympy.Symbol("x")
    parsed = []
    for curve in spec.curves:
        try:
            parsed.append(sympy.sympify(curve.expr, locals={"x": x}))
        except (sympy.SympifyError, TypeError) as exc:
            return VerificationResult(False, None, f"could not parse expr '{curve.expr}': {exc}")

    xmin, xmax, ymin, ymax = spec.domain
    if xmin >= xmax or ymin >= ymax:
        return VerificationResult(False, None, "domain bounds are not well-ordered")

    ops = spec.ops or ["none"]

    if "intersect" in ops:
        if len(spec.curves) != 2 or any(c.kind != "function" for c in spec.curves):
            return VerificationResult(False, None, "intersect requires exactly 2 function curves")
        solutions = sympy.solve(sympy.Eq(parsed[0], parsed[1]), x)
        real_solutions = [s for s in solutions if getattr(s, "is_real", True)]
        if not real_solutions:
            return VerificationResult(False, None, "curves do not intersect within the real domain")

    if "tangent_at" in ops:
        if len(spec.curves) < 1 or spec.curves[0].kind != "function":
            return VerificationResult(False, None, "tangent_at requires a function curve")
        if spec.tangent_at_x is None:
            return VerificationResult(False, None, "tangent_at requires tangent_at_x")
        try:
            sympy.diff(parsed[0], x).subs(x, spec.tangent_at_x)
        except Exception as exc:  # not differentiable / undefined at that point
            return VerificationResult(False, None, f"curve is not differentiable at x={spec.tangent_at_x}: {exc}")

    return VerificationResult(True, None, "verified")


async def generate_plot(client: AiRouterClient, prompt_text: str) -> dict:
    """generate -> verify -> gate. Returns
    {"available": bool, "spec": dict | None, "reason": str | None}, never raises."""
    feedback = None
    last_reason = "no attempts made"

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            draft = await draft_plot(client, prompt_text, feedback=feedback)
        except PlotShapeError as exc:
            last_reason = f"attempt {attempt}: malformed draft — {exc}"
            feedback = str(exc)
            continue

        if not draft.get("available"):
            last_reason = draft.get("reason", "model self-abstained")
            continue

        result = verify_plot(draft["spec"])
        if result.ok:
            return {"available": True, "spec": draft["spec"].model_dump(), "reason": None}

        last_reason = result.reason
        feedback = result.reason

    return {"available": False, "spec": None, "reason": last_reason}

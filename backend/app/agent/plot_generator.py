"""Generate -> verify -> gate loop for the Math Playground's natural-language entry mode.

Same split as the rest of the Pure Mathematics Toolset: the model proposes a constrained
PlotSpec (which curves, which operation) or self-abstains; sympy independently parses
every curve and re-solves any requested operation (intersect, tangent_at, roots, extrema,
derivative_at, integral, regression) before the spec is ever trusted. Manually-typed
curves in the frontend never touch this file at all — they render straight from
client-side state, so this is purely the AI-populated path.

`verify_plot` only answers ok/reject (it shares the project-wide `VerificationResult`
shape with every other verifier — step_solver, visualization_generator, verifier.py —
which has no slot for op-specific payloads). Once a spec is accepted, `compute_results`
independently recomputes the actual displayable numbers (roots, extrema, a derivative
value, an integral value, regression coefficients) with sympy/numpy for the frontend to
render — it is never the thing that decides accept/reject.

`narrate_plot`/`suggest_next_step` are caption-only, same contract as
step_solver.narrate_steps: they describe an already-verified spec/results pair in
Vietnamese prose, never compute anything, and degrade to an empty string (never raise)
on any router/shape failure — a missing caption is fine, wrong math is not.
"""
import json
from pathlib import Path

import numpy as np
import sympy

from app.agent.plot_schema import Curve, PlotSpec, validate_spec
from app.agent.router_client import AiRouterClient
from app.agent.verifier import VerificationResult

_PROMPT_PATH = Path(__file__).parent / "prompts" / "draft_plot.md"
_NARRATE_PROMPT_PATH = Path(__file__).parent / "prompts" / "narrate_plot.md"
_SUGGEST_PROMPT_PATH = Path(__file__).parent / "prompts" / "suggest_plot.md"

MAX_ATTEMPTS = 2

_X = sympy.Symbol("x")
_T = sympy.Symbol("t")
_THETA = sympy.Symbol("theta")


class PlotShapeError(ValueError):
    """Raised when the model's JSON is neither a valid abstention nor a valid spec."""


def _parse_curve(curve: Curve) -> dict:
    """Independently parses one curve per its kind. Raises ValueError/SympifyError/
    TypeError on anything unparseable or structurally incomplete — never trusts the
    curve's kind claim without checking the fields it requires."""
    if curve.kind == "dataset":
        if not curve.points or len(curve.points) < 2:
            raise ValueError("dataset curve requires at least 2 points")
        return {"kind": "dataset", "points": curve.points}

    if curve.kind == "parametric":
        if not curve.expr_y:
            raise ValueError("parametric curve requires expr_y")
        return {
            "kind": "parametric",
            "x_of_t": sympy.sympify(curve.expr, locals={"t": _T}),
            "y_of_t": sympy.sympify(curve.expr_y, locals={"t": _T}),
        }

    if curve.kind == "polar":
        expr = curve.expr.replace("θ", "theta")
        return {"kind": "polar", "r_of_theta": sympy.sympify(expr, locals={"theta": _THETA})}

    # function / inequality / piecewise all parse the same way — sympy natively accepts
    # Piecewise(...) syntax, so "piecewise" needs no special-cased parsing.
    return {"kind": curve.kind, "expr": sympy.sympify(curve.expr, locals={"x": _X})}


async def draft_plot(
    client: AiRouterClient,
    prompt_text: str,
    feedback: str | None = None,
    previous_spec: dict | None = None,
) -> dict:
    system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    user_prompt = prompt_text
    if previous_spec:
        user_prompt = (
            f"Current graph (JSON PlotSpec): {json.dumps(previous_spec, ensure_ascii=False)}\n"
            f"New instruction: {prompt_text}\n"
            "Return an UPDATED full spec reflecting the new instruction on top of the current "
            "graph (e.g. add a curve, add an op), or self-abstain if the instruction doesn't "
            "make sense against the current graph."
        )
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
    try:
        parsed = [_parse_curve(c) for c in spec.curves]
    except (sympy.SympifyError, TypeError, ValueError) as exc:
        return VerificationResult(False, None, f"could not parse a curve: {exc}")

    xmin, xmax, ymin, ymax = spec.domain
    if xmin >= xmax or ymin >= ymax:
        return VerificationResult(False, None, "domain bounds are not well-ordered")

    for p in spec.parameters:
        if p.min >= p.max:
            return VerificationResult(False, None, f"parameter '{p.name}' has non-well-ordered bounds")

    ops = spec.ops or ["none"]

    if "intersect" in ops:
        if len(spec.curves) != 2 or any(c.kind != "function" for c in spec.curves):
            return VerificationResult(False, None, "intersect requires exactly 2 function curves")
        solutions = sympy.solve(sympy.Eq(parsed[0]["expr"], parsed[1]["expr"]), _X)
        real_solutions = [s for s in solutions if getattr(s, "is_real", True)]
        if not real_solutions:
            return VerificationResult(False, None, "curves do not intersect within the real domain")

    if "tangent_at" in ops:
        if len(spec.curves) < 1 or spec.curves[0].kind != "function":
            return VerificationResult(False, None, "tangent_at requires a function curve")
        if spec.tangent_at_x is None:
            return VerificationResult(False, None, "tangent_at requires tangent_at_x")
        try:
            sympy.diff(parsed[0]["expr"], _X).subs(_X, spec.tangent_at_x)
        except Exception as exc:
            return VerificationResult(False, None, f"curve is not differentiable at x={spec.tangent_at_x}: {exc}")

    if "roots" in ops:
        if len(spec.curves) != 1 or spec.curves[0].kind not in ("function", "piecewise"):
            return VerificationResult(False, None, "roots requires exactly 1 function/piecewise curve")
        solutions = sympy.solve(sympy.Eq(parsed[0]["expr"], 0), _X)
        real_solutions = [s for s in solutions if getattr(s, "is_real", True)]
        if not real_solutions:
            return VerificationResult(False, None, "no real roots found")

    if "extrema" in ops:
        if len(spec.curves) != 1 or spec.curves[0].kind not in ("function", "piecewise"):
            return VerificationResult(False, None, "extrema requires exactly 1 function/piecewise curve")
        critical_points = sympy.solve(sympy.diff(parsed[0]["expr"], _X), _X)
        real_points = [p for p in critical_points if getattr(p, "is_real", True)]
        if not real_points:
            return VerificationResult(False, None, "no critical points found")

    if "derivative_at" in ops:
        if len(spec.curves) < 1 or spec.curves[0].kind != "function":
            return VerificationResult(False, None, "derivative_at requires a function curve")
        if spec.derivative_at_x is None:
            return VerificationResult(False, None, "derivative_at requires derivative_at_x")
        try:
            sympy.diff(parsed[0]["expr"], _X).subs(_X, spec.derivative_at_x)
        except Exception as exc:
            return VerificationResult(False, None, f"curve is not differentiable at x={spec.derivative_at_x}: {exc}")

    if "integral" in ops:
        if len(spec.curves) < 1 or spec.curves[0].kind != "function":
            return VerificationResult(False, None, "integral requires a function curve")
        if not spec.integral_bounds:
            return VerificationResult(False, None, "integral requires integral_bounds")
        a, b = spec.integral_bounds
        if a >= b:
            return VerificationResult(False, None, "integral_bounds are not well-ordered")
        try:
            result = sympy.integrate(parsed[0]["expr"], (_X, a, b))
            if result.has(sympy.Integral):
                result = sympy.N(sympy.Integral(parsed[0]["expr"], (_X, a, b)))
            complex(result)
        except Exception as exc:
            return VerificationResult(False, None, f"could not evaluate the definite integral: {exc}")

    if "regression" in ops:
        dataset_curves = [c for c in spec.curves if c.kind == "dataset"]
        if len(dataset_curves) != 1:
            return VerificationResult(False, None, "regression requires exactly 1 dataset curve")
        if spec.regression_degree is None or spec.regression_degree < 1:
            return VerificationResult(False, None, "regression requires a regression_degree >= 1")
        points = dataset_curves[0].points
        if len(points) <= spec.regression_degree:
            return VerificationResult(False, None, "not enough points to fit that regression degree")
        xs, ys = zip(*points)
        try:
            coeffs = np.polyfit(xs, ys, spec.regression_degree)
        except Exception as exc:
            return VerificationResult(False, None, f"regression fit failed: {exc}")
        if np.any(np.isnan(coeffs)):
            return VerificationResult(False, None, "regression fit produced NaN coefficients")

    return VerificationResult(True, None, "verified")


def compute_results(spec: PlotSpec) -> dict:
    """Independently recomputes the actual numbers for every requested op, once
    verify_plot has already accepted the spec. Never called on an unverified spec —
    generate_plot only reaches this after `verify_plot(...).ok` is True."""
    parsed = [_parse_curve(c) for c in spec.curves]
    ops = spec.ops or ["none"]
    results: dict = {}

    if "roots" in ops:
        solutions = sympy.solve(sympy.Eq(parsed[0]["expr"], 0), _X)
        real_solutions = sorted(s for s in solutions if getattr(s, "is_real", True))
        results["roots"] = [str(sympy.nsimplify(s)) for s in real_solutions]

    if "extrema" in ops:
        expr = parsed[0]["expr"]
        first = sympy.diff(expr, _X)
        second = sympy.diff(expr, _X, 2)
        critical_points = sorted(p for p in sympy.solve(first, _X) if getattr(p, "is_real", True))
        extrema = []
        for p in critical_points:
            sign = second.subs(_X, p)
            if sign.is_real is False:
                continue
            kind = "min" if sign > 0 else ("max" if sign < 0 else "inflection")
            extrema.append({"x": str(p), "y": str(sympy.simplify(expr.subs(_X, p))), "kind": kind})
        results["extrema"] = extrema

    if "derivative_at" in ops:
        value = sympy.diff(parsed[0]["expr"], _X).subs(_X, spec.derivative_at_x)
        results["derivative_at"] = {"x": spec.derivative_at_x, "value": str(sympy.N(value))}

    if "integral" in ops:
        a, b = spec.integral_bounds
        value = sympy.integrate(parsed[0]["expr"], (_X, a, b))
        if value.has(sympy.Integral):
            value = sympy.N(sympy.Integral(parsed[0]["expr"], (_X, a, b)))
        results["integral"] = {"bounds": [a, b], "value": str(sympy.N(value))}

    if "regression" in ops:
        dataset_curve = next(c for c in spec.curves if c.kind == "dataset")
        xs, ys = zip(*dataset_curve.points)
        degree = spec.regression_degree
        coeffs = np.polyfit(xs, ys, degree)
        fitted = np.polyval(coeffs, xs)
        ss_res = float(np.sum((np.array(ys) - fitted) ** 2))
        ss_tot = float(np.sum((np.array(ys) - np.mean(ys)) ** 2))
        r_squared = 1.0 - ss_res / ss_tot if ss_tot > 0 else 1.0
        results["regression"] = {
            "kind": spec.regression_kind or "polynomial",
            "coefficients": [float(c) for c in coeffs],
            "r_squared": r_squared,
        }

    return results


async def generate_plot(client: AiRouterClient, prompt_text: str, previous_spec: dict | None = None) -> dict:
    """generate -> verify -> gate. Returns
    {"available": bool, "spec": dict | None, "results": dict, "reason": str | None},
    never raises. `previous_spec` (a prior accepted PlotSpec, as a dict) makes this a
    follow-up turn — e.g. "now add its derivative" — folded into the draft prompt; the
    verify/gate contract is unchanged, a follow-up is verified exactly as strictly as a
    fresh request."""
    feedback = None
    last_reason = "no attempts made"

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            draft = await draft_plot(client, prompt_text, feedback=feedback, previous_spec=previous_spec)
        except PlotShapeError as exc:
            last_reason = f"attempt {attempt}: malformed draft — {exc}"
            feedback = str(exc)
            continue

        if not draft.get("available"):
            last_reason = draft.get("reason", "model self-abstained")
            continue

        result = verify_plot(draft["spec"])
        if result.ok:
            results = compute_results(draft["spec"])
            return {"available": True, "spec": draft["spec"].model_dump(), "results": results, "reason": None}

        last_reason = result.reason
        feedback = result.reason

    return {"available": False, "spec": None, "results": {}, "reason": last_reason}


def _spec_summary(spec: PlotSpec, results: dict) -> str:
    """Plain-JSON summary handed to the model for captioning — the already-verified
    spec/results, nothing recomputed here."""
    return json.dumps(
        {"curves": [c.model_dump() for c in spec.curves], "ops": spec.ops, "results": results},
        ensure_ascii=False,
    )


async def narrate_plot(client: AiRouterClient, spec: PlotSpec, results: dict) -> str:
    """Best-effort Vietnamese caption of an already-verified graph — never computes
    anything, never raises. Returns "" on any router/shape failure."""
    try:
        system_prompt = _NARRATE_PROMPT_PATH.read_text(encoding="utf-8")
        result = await client.complete_json(system_prompt, _spec_summary(spec, results))
        narrative = result.get("narrative", "")
        return narrative if isinstance(narrative, str) else ""
    except Exception:
        return ""


async def suggest_next_step(client: AiRouterClient, spec: PlotSpec, results: dict) -> str:
    """Best-effort single-sentence Vietnamese suggestion for what to explore next — pure
    suggestion text, never trusted as math, never raises. Returns "" on failure."""
    try:
        system_prompt = _SUGGEST_PROMPT_PATH.read_text(encoding="utf-8")
        result = await client.complete_json(system_prompt, _spec_summary(spec, results))
        suggestion = result.get("suggestion", "")
        return suggestion if isinstance(suggestion, str) else ""
    except Exception:
        return ""

"""Generate -> compute -> verify loop for the calculus toolkit.

Same split as linalg_solver.py: the model (when a natural-language prompt is used at
all) only ever proposes a constrained CalculusSpec — it never differentiates,
integrates, or solves anything itself. `solve_calculus` computes everything with sympy.
`verify_calculus` independently re-checks the result by a *second, different* method:
- integral_indefinite: differentiate the antiderivative and compare to the original expr
  (exact, VerificationResult) — differentiating is a genuinely different operation than
  integrating.
- integral_definite: independent numeric quadrature (mpmath.quad) against the symbolic
  result (tolerance-based, plain {"ok","reason"} dict — same weaker-guarantee shape
  stats_simulator.verify_simulation uses for numeric checks).
- derivative: numeric finite-difference (mpmath.diff) at several sample points
  (tolerance-based, plain dict).
- limit: numeric approach from both sides of the point (tolerance-based, plain dict).
- series: residual between the original function and the series at a small offset,
  expected to be within the order of the leading dropped term (tolerance-based, plain
  dict).
- dsolve: sympy.checkodesol — a dedicated, independent sympy utility that substitutes
  the solution back into the ODE and checks the residual (exact, VerificationResult).
"""
from pathlib import Path

import mpmath
import sympy

from app.agent.calculus_schema import CalculusSpec, validate_spec
from app.agent.router_client import AiRouterClient
from app.agent.verifier import VerificationResult

_PROMPT_PATH = Path(__file__).parent / "prompts" / "draft_calculus.md"

MAX_ATTEMPTS = 2


class CalculusShapeError(ValueError):
    """Raised when the model's JSON is neither a valid abstention nor a valid spec."""


async def draft_calculus_spec(client: AiRouterClient, prompt_text: str, feedback: str | None = None) -> dict:
    system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    user_prompt = prompt_text
    if feedback:
        user_prompt += f"\n\nYour previous attempt was rejected: {feedback}\nTry again, or self-abstain.\n"

    result = await client.complete_json(system_prompt, user_prompt)

    if result.get("available") is False:
        return {"available": False, "reason": result.get("reason", "model self-abstained")}

    spec_fields = {k: v for k, v in result.items() if k not in ("available", "reason")}
    try:
        spec = validate_spec(spec_fields)
    except Exception as exc:
        raise CalculusShapeError(str(exc)) from exc

    return {"available": True, "spec": spec}


def solve_calculus(spec: CalculusSpec) -> dict:
    """Deterministic sympy computation. Raises ValueError on unparseable expressions,
    missing required parameters, or an unsolvable ODE."""
    var = sympy.Symbol(spec.variable)
    op = spec.operation
    derivation = {"operation": op, "variable": var, "order": spec.order}

    if op == "dsolve":
        y = sympy.Function("y")
        try:
            ode_expr = sympy.sympify(spec.expr, locals={spec.variable: var, "y": y, "Derivative": sympy.Derivative})
        except (sympy.SympifyError, TypeError) as exc:
            raise ValueError(f"could not parse ODE: {exc}") from exc
        ode_eq = sympy.Eq(ode_expr, 0)
        try:
            solution = sympy.dsolve(ode_eq, y(var))
        except Exception as exc:
            raise ValueError(f"could not solve ODE: {exc}") from exc
        derivation["ode_eq"] = ode_eq
        derivation["y"] = y
        derivation["result"] = solution
        return derivation

    try:
        expr = sympy.sympify(spec.expr, locals={spec.variable: var})
    except (sympy.SympifyError, TypeError) as exc:
        raise ValueError(f"could not parse expression: {exc}") from exc
    derivation["expr"] = expr

    if op == "derivative":
        derivation["result"] = sympy.diff(expr, var, spec.order)
    elif op == "integral_indefinite":
        derivation["result"] = sympy.integrate(expr, var)
    elif op == "integral_definite":
        if not spec.bounds:
            raise ValueError("integral_definite requires bounds")
        a, b = spec.bounds
        derivation["bounds"] = (a, b)
        result = sympy.integrate(expr, (var, a, b))
        if result.has(sympy.Integral):
            raise ValueError(f"could not evaluate the definite integral in closed form: {result}")
        derivation["result"] = result
    elif op == "limit":
        if spec.point is None:
            raise ValueError("limit requires a point")
        derivation["point"] = spec.point
        result = sympy.limit(expr, var, spec.point)
        derivation["result"] = result
    elif op == "series":
        point = spec.point if spec.point is not None else 0
        derivation["point"] = point
        derivation["result"] = sympy.series(expr, var, point, spec.order + 1).removeO()
    else:
        raise ValueError(f"unknown operation: {op}")

    return derivation


def verify_calculus(derivation: dict):
    """Returns a VerificationResult for exact checks, or a plain {"ok","reason"} dict
    for tolerance-based numeric checks — the same distinction stats_simulator draws
    between exact and weaker-guarantee verification."""
    op = derivation["operation"]
    var = derivation["variable"]
    result = derivation["result"]

    if op == "integral_indefinite":
        expr = derivation["expr"]
        diff_back = sympy.diff(result, var)
        ok = sympy.simplify(diff_back - expr) == 0
        return VerificationResult(ok, None, "verified" if ok else f"d/d{var}({result}) != {expr}")

    if op == "dsolve":
        solutions = result if isinstance(result, list) else [result]
        for sol in solutions:
            try:
                checked = sympy.checkodesol(derivation["ode_eq"], sol)
            except Exception as exc:
                return VerificationResult(False, None, f"could not check solution {sol}: {exc}")
            if checked[0] is not True:
                return VerificationResult(False, None, f"solution {sol} does not satisfy the ODE (checkodesol: {checked})")
        return VerificationResult(True, None, "verified")

    if op == "integral_definite":
        expr = derivation["expr"]
        a, b = derivation["bounds"]
        try:
            f = sympy.lambdify(var, expr, "mpmath")
            numeric = mpmath.quad(f, [mpmath.mpf(a), mpmath.mpf(b)])
            symbolic_val = complex(sympy.N(result))
        except Exception as exc:
            return {"ok": False, "reason": f"numeric quadrature failed: {exc}"}
        diff = abs(complex(numeric) - symbolic_val)
        tol = max(1e-4 * abs(symbolic_val), 1e-6)
        ok = diff <= tol
        return {"ok": ok, "reason": "verified" if ok else f"numeric quadrature {numeric} disagrees with symbolic result {result}"}

    if op == "derivative":
        expr = derivation["expr"]
        order = derivation["order"]
        try:
            f = sympy.lambdify(var, expr, "mpmath")
            g = sympy.lambdify(var, result, "mpmath")
        except Exception as exc:
            return {"ok": False, "reason": f"could not lambdify: {exc}"}
        sample_points = [mpmath.mpf("0.37"), mpmath.mpf("1.21"), mpmath.mpf("-0.68")]
        checked_any = False
        for x0 in sample_points:
            try:
                numeric = mpmath.diff(f, x0, order)
                symbolic = g(x0)
            except Exception:
                continue
            checked_any = True
            diff = abs(complex(numeric) - complex(symbolic))
            tol = max(1e-2 * abs(complex(symbolic)), 1e-3)
            if diff > tol:
                return {"ok": False, "reason": f"numeric derivative at x={x0} disagrees with symbolic result {result}"}
        if not checked_any:
            return {"ok": False, "reason": "could not evaluate at any sample point (domain issue)"}
        return {"ok": True, "reason": "verified"}

    if op == "limit":
        expr = derivation["expr"]
        point = derivation["point"]
        if result in (sympy.oo, -sympy.oo, sympy.zoo):
            return {"ok": True, "reason": "verified (infinite limit, skipping numeric cross-check)"}
        try:
            f = sympy.lambdify(var, expr, "mpmath")
            symbolic_val = complex(sympy.N(result))
            eps = mpmath.mpf("1e-5")
            left = f(mpmath.mpf(point) - eps)
            right = f(mpmath.mpf(point) + eps)
        except Exception as exc:
            return {"ok": False, "reason": f"numeric approach failed: {exc}"}
        ok = abs(complex(left) - symbolic_val) < 1e-2 and abs(complex(right) - symbolic_val) < 1e-2
        return {"ok": ok, "reason": "verified" if ok else f"numeric approach disagrees with symbolic limit {result}"}

    if op == "series":
        expr = derivation["expr"]
        point = derivation["point"]
        order = derivation["order"]
        try:
            f = sympy.lambdify(var, expr, "mpmath")
            g = sympy.lambdify(var, result, "mpmath")
            h = mpmath.mpf("1e-3")
            x0 = mpmath.mpf(point) + h
            actual = f(x0)
            approx = g(x0)
        except Exception as exc:
            return {"ok": False, "reason": f"numeric evaluation failed: {exc}"}
        residual = abs(complex(actual) - complex(approx))
        tol = max(10 * float(h) ** order, 1e-4)
        ok = residual <= tol
        return {"ok": ok, "reason": "verified" if ok else f"series residual {residual} exceeds tolerance {tol}"}

    return {"ok": False, "reason": f"unknown operation: {op}"}


def _result_ok_reason(verification) -> tuple[bool, str]:
    if isinstance(verification, VerificationResult):
        return verification.ok, verification.reason
    return verification["ok"], verification["reason"]


async def generate_calculus(client: AiRouterClient, prompt_text: str) -> dict:
    """generate -> verify -> gate for the calculus-spec extraction; solve_calculus/
    verify_calculus are always deterministic once a spec is accepted. Returns
    {"available": bool, "operation": str | None, "result": str | None, "reason": str | None}.
    """
    feedback = None
    last_reason = "no attempts made"

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            draft = await draft_calculus_spec(client, prompt_text, feedback=feedback)
        except CalculusShapeError as exc:
            last_reason = f"attempt {attempt}: malformed draft — {exc}"
            feedback = str(exc)
            continue

        if not draft.get("available"):
            last_reason = draft.get("reason", "model self-abstained")
            continue

        spec = draft["spec"]
        try:
            derivation = solve_calculus(spec)
        except (sympy.SympifyError, ValueError, TypeError) as exc:
            last_reason = f"attempt {attempt}: could not solve — {exc}"
            feedback = str(exc)
            continue

        verification = verify_calculus(derivation)
        ok, reason = _result_ok_reason(verification)
        if not ok:
            last_reason = reason
            feedback = reason
            continue

        return {"available": True, "operation": spec.operation, "result": str(derivation["result"]), "reason": None}

    return {"available": False, "operation": None, "result": None, "reason": last_reason}

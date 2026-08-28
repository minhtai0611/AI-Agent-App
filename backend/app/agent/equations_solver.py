"""Generate -> compute -> verify loop for nonlinear equation systems.

Same split as linalg_solver.py/step_solver.py: the model only ever proposes a
constrained EquationSystemSpec — it never solves the system itself. `solve_equation_
system` computes every solution with sympy.solve. `verify_equation_system` independently
re-checks each claimed solution by substituting it back into *every* original equation
and confirming all residuals are 0 — a direct multi-equation extension of
step_solver.verify_steps's single-equation plug-back check.
"""
from pathlib import Path

import sympy

from app.agent.equations_schema import EquationSystemSpec, validate_spec
from app.agent.router_client import AiRouterClient
from app.agent.verifier import VerificationResult

_PROMPT_PATH = Path(__file__).parent / "prompts" / "draft_equations.md"

MAX_ATTEMPTS = 2


class EquationSystemShapeError(ValueError):
    """Raised when the model's JSON is neither a valid abstention nor a valid spec."""


async def draft_equation_system(client: AiRouterClient, prompt_text: str, feedback: str | None = None) -> dict:
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
        raise EquationSystemShapeError(str(exc)) from exc

    return {"available": True, "spec": spec}


def solve_equation_system(spec: EquationSystemSpec) -> dict:
    """Deterministic sympy computation. Raises ValueError if any equation fails to
    parse or the system has no solution."""
    symbols = {name: sympy.Symbol(name) for name in spec.variables}
    equations = []
    for eq_str in spec.equations:
        if "=" not in eq_str:
            raise ValueError(f"equation '{eq_str}' is not in 'lhs = rhs' form")
        lhs_str, rhs_str = eq_str.split("=", 1)
        try:
            lhs = sympy.sympify(lhs_str.strip(), locals=symbols)
            rhs = sympy.sympify(rhs_str.strip(), locals=symbols)
        except (sympy.SympifyError, TypeError) as exc:
            raise ValueError(f"could not parse equation '{eq_str}': {exc}") from exc
        equations.append(sympy.Eq(lhs, rhs))

    variables = list(symbols.values())
    solutions = sympy.solve(equations, variables, dict=True)
    if not solutions:
        raise ValueError("system has no solution")

    return {"equations": equations, "variables": variables, "solutions": solutions}


def verify_equation_system(derivation: dict) -> VerificationResult:
    equations = derivation["equations"]
    solutions = derivation["solutions"]

    for sol_index, solution in enumerate(solutions):
        for eq_index, eq in enumerate(equations):
            residual = sympy.simplify(eq.lhs.subs(solution) - eq.rhs.subs(solution))
            if residual != 0:
                return VerificationResult(
                    False, None,
                    f"solution {sol_index + 1} ({solution}) does not satisfy equation {eq_index + 1} (residual {residual})",
                )
    return VerificationResult(True, None, "verified")


async def generate_equation_system(client: AiRouterClient, prompt_text: str) -> dict:
    """generate -> verify -> gate for the equation-system extraction. Returns
    {"available": bool, "solutions": list[dict] | None, "reason": str | None}.
    """
    feedback = None
    last_reason = "no attempts made"

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            draft = await draft_equation_system(client, prompt_text, feedback=feedback)
        except EquationSystemShapeError as exc:
            last_reason = f"attempt {attempt}: malformed draft — {exc}"
            feedback = str(exc)
            continue

        if not draft.get("available"):
            last_reason = draft.get("reason", "model self-abstained")
            continue

        spec = draft["spec"]
        try:
            derivation = solve_equation_system(spec)
        except (sympy.SympifyError, ValueError, TypeError) as exc:
            last_reason = f"attempt {attempt}: could not solve — {exc}"
            feedback = str(exc)
            continue

        verification = verify_equation_system(derivation)
        if not verification.ok:
            last_reason = verification.reason
            feedback = verification.reason
            continue

        solutions_out = [
            {str(k): str(v) for k, v in sol.items()} for sol in derivation["solutions"]
        ]
        return {"available": True, "solutions": solutions_out, "reason": None}

    return {"available": False, "solutions": None, "reason": last_reason}

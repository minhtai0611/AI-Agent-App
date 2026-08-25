"""Independently solves a drafted question with sympy and checks the model's claimed answer.

This is the actual autonomy in the generate-verify-gate loop: the model's own claimed
answer is never trusted on its own. sympy solves `given_equations` for `variables` from
scratch, evaluates `target_expression` at that solution, and checks which (if any) of
`choice_expressions` matches — independently of what the model claimed.

Mathics3 escalation (for anything sympy can't parse — e.g. non-algebraic notation) is
deliberately not implemented yet: nothing in the current question bank needs more than
sympy can solve, and standing up a second CAS before the first one has a real workload
would be exactly the kind of premature infra the roadmap argues against.
"""
from dataclasses import dataclass

import sympy


@dataclass
class VerificationResult:
    ok: bool
    verified_index: int | None  # the index sympy independently computed as correct, if unambiguous
    reason: str


def verify(draft: dict) -> VerificationResult:
    try:
        symbols = {name: sympy.Symbol(name) for name in draft["variables"]}
        equations = [sympy.sympify(eq, locals=symbols) for eq in draft["given_equations"]]
    except (sympy.SympifyError, TypeError, KeyError) as exc:
        return VerificationResult(False, None, f"could not parse given_equations: {exc}")

    solutions = sympy.solve(equations, list(symbols.values()), dict=True)
    if not solutions:
        return VerificationResult(False, None, "system of given_equations has no solution")
    if len(solutions) > 1:
        return VerificationResult(False, None, "system of given_equations is underdetermined (multiple solutions)")
    solution = solutions[0]

    try:
        target = sympy.sympify(draft["target_expression"], locals=symbols)
        target_value = sympy.simplify(target.subs(solution))
    except (sympy.SympifyError, TypeError) as exc:
        return VerificationResult(False, None, f"could not evaluate target_expression: {exc}")

    matches = []
    for i, choice_expr in enumerate(draft["choice_expressions"]):
        try:
            choice_value = sympy.sympify(choice_expr)
        except sympy.SympifyError:
            continue
        if sympy.simplify(choice_value - target_value) == 0:
            matches.append(i)

    if not matches:
        return VerificationResult(False, None, f"no choice matches the independently computed value {target_value}")
    if len(matches) > 1:
        return VerificationResult(False, None, f"choices are ambiguous — {len(matches)} choices all equal {target_value}")

    verified_index = matches[0]
    claimed_index = draft.get("claimed_correct_index")
    if verified_index != claimed_index:
        return VerificationResult(
            False,
            verified_index,
            f"model claimed index {claimed_index} but the independently verified answer is index {verified_index}",
        )
    return VerificationResult(True, verified_index, "verified")

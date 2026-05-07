"""Deterministic symbolic verification of math solutions using SymPy.

Returns (True, []) on confirmed correct, (False, [issues]) on confirmed wrong,
(None, []) when inconclusive (parse failure, proof/geometry/combinatorics, etc.).
Never raises — all exceptions produce (None, []) to avoid false negatives.
"""
from __future__ import annotations
import logging
import re

logger = logging.getLogger(__name__)

# Topics where symbolic substitution doesn't apply.
_SKIP_TYPES = frozenset({
    "chứng minh", "proof", "geometry", "hình học",
    "combinatorics", "tổ hợp", "statistics", "thống kê",
    "probability", "xác suất", "number_theory", "số học",
})


def _should_skip(problem_type: str) -> bool:
    pt = problem_type.lower()
    return any(s in pt for s in _SKIP_TYPES)


# ── answer parsing ────────────────────────────────────────────────────────────

def _parse_candidates(final_answer: str) -> list[str]:
    """Extract individual candidate value strings from a final_answer string.

    Handles forms like:
      "x = 2 hoặc x = 3"   → ["2", "3"]
      "$x = 2$ hoặc $x = 3$"  → ["2", "3"]
      "x = 2"              → ["2"]
      "x1 = 1, x2 = -1"   → ["1", "-1"]
    Returns raw value strings to be parsed by SymPy.
    """
    # Strip LaTeX delimiters
    text = re.sub(r'\$', '', final_answer)
    # Split on Vietnamese "hoặc", commas, semicolons, or "or"
    parts = re.split(r'\bhoặc\b|\bor\b|[,;]', text, flags=re.IGNORECASE)
    values: list[str] = []
    for part in parts:
        part = part.strip()
        # Look for "var = value" pattern
        m = re.search(r'=\s*(.+)$', part)
        if m:
            values.append(m.group(1).strip())
    return values


def _parse_system_assignments(final_answer: str) -> dict[str, str] | None:
    """Parse 'x = a, y = b' style system answers into {var: value} dict."""
    text = re.sub(r'\$', '', final_answer)
    parts = re.split(r'\bvà\b|\band\b|[,;]', text, flags=re.IGNORECASE)
    assignments: dict[str, str] = {}
    for part in parts:
        part = part.strip()
        m = re.match(r'^([a-zA-Z]\w*)\s*=\s*(.+)$', part)
        if m:
            assignments[m.group(1).strip()] = m.group(2).strip()
    return assignments if len(assignments) >= 2 else None


def _extract_ode_solution(final_answer: str):
    """Extract y = f(x) from an ODE general solution string.
    Returns a SymPy expression for f(x), or None on failure."""
    try:
        import sympy as sp
        text = re.sub(r'\$', '', final_answer).strip()
        # Match "y = ..." at start of answer
        m = re.match(r'y\s*=\s*(.+)', text, re.IGNORECASE)
        if not m:
            return None
        expr_str = m.group(1).strip()
        # Replace C1, C2 constants with SymPy symbols
        expr_str = re.sub(r'\bC_?(\d+)\b', r'C\1', expr_str)
        x, C1, C2, C3 = sp.symbols('x C1 C2 C3')
        local_dict = {
            'x': x, 'C1': C1, 'C2': C2, 'C3': C3,
            'e': sp.E, 'pi': sp.pi, 'sin': sp.sin, 'cos': sp.cos,
            'exp': sp.exp, 'ln': sp.ln, 'sqrt': sp.sqrt,
        }
        return sp.sympify(expr_str, locals=local_dict)
    except Exception:
        return None


def _strip_prose(s: str) -> str:
    """Strip leading prose words from a potential math expression."""
    m = re.search(r'[0-9x\(\-\+\*\/\^\.]', s)
    return s[m.start():] if m else s


# ── verification routines ─────────────────────────────────────────────────────

def _verify_equation(problem_text: str, candidate_values: list[str]) -> tuple[bool | None, list[str]]:
    """Substitute each candidate into the equation extracted from problem_text."""
    try:
        import sympy as sp
        text = re.sub(r'\$', '', problem_text)
        x = sp.Symbol('x')
        local = {'x': x, 'sqrt': sp.sqrt, 'abs': sp.Abs, 'log': sp.log, 'ln': sp.ln}

        # Try each "lhs = rhs" match; skip those whose lhs won't sympify
        expr = None
        for eq_match in re.finditer(r'([^:=\n]+)=([^:=\n]+)', text):
            lhs_raw = _strip_prose(eq_match.group(1).strip())
            rhs_raw = eq_match.group(2).strip()
            try:
                lhs = sp.sympify(lhs_raw, locals=local)
                rhs = sp.sympify(rhs_raw, locals=local)
                expr = lhs - rhs
                break
            except Exception:
                continue

        if expr is None:
            return None, []

        issues: list[str] = []
        valid_count = 0
        for val_str in candidate_values:
            try:
                val = sp.sympify(val_str, locals={'sqrt': sp.sqrt})
                residual = sp.simplify(expr.subs(x, val))
                if residual == 0:
                    valid_count += 1
                else:
                    issues.append(f"x = {val_str} does not satisfy the equation (residual = {residual})")
            except Exception:
                return None, []  # can't evaluate — inconclusive

        if issues:
            return False, issues
        if valid_count > 0:
            return True, []
        return None, []
    except Exception as exc:
        logger.debug("_verify_equation failed: %s", exc)
        return None, []


def _verify_system(problem_text: str, assignments: dict[str, str]) -> tuple[bool | None, list[str]]:
    """Substitute variable assignments into all equations in problem_text."""
    try:
        import sympy as sp
        text = re.sub(r'\$', '', problem_text)
        # Split on conjunctions first so each clause is a single equation candidate
        clauses = re.split(r'\bvà\b|\band\b|[;\n]', text, flags=re.IGNORECASE)

        syms = {v: sp.Symbol(v) for v in assignments}
        local = {**syms, 'sqrt': sp.sqrt, 'abs': sp.Abs}

        val_map = {}
        for var, val_str in assignments.items():
            try:
                val_map[syms[var]] = sp.sympify(val_str, locals=local)
            except Exception:
                return None, []

        issues: list[str] = []
        checked = 0
        for clause in clauses[:4]:  # limit to first 4 clauses
            if '=' not in clause:
                continue
            parts = clause.split('=', 1)
            if len(parts) != 2:
                continue
            try:
                lhs = sp.sympify(_strip_prose(parts[0].strip()), locals=local)
                rhs = sp.sympify(parts[1].strip(), locals=local)
                residual = sp.simplify((lhs - rhs).subs(val_map))
                checked += 1
                if residual != 0:
                    issues.append(f"Assignment {assignments} does not satisfy equation '{clause.strip()}'")
            except Exception:
                continue

        if not checked:
            return None, []
        return (False, issues) if issues else (True, [])
    except Exception as exc:
        logger.debug("_verify_system failed: %s", exc)
        return None, []


def _verify_ode(problem_text: str, solution_expr) -> tuple[bool | None, list[str]]:
    """Differentiate the proposed solution and substitute into the ODE."""
    try:
        import sympy as sp
        text = re.sub(r'\$', '', problem_text)
        # Extract ODE — look for y'' / y' notation and convert
        ode_match = re.search(r"y[''′]+[^=\n]*=[^\n]+", text)
        if not ode_match:
            return None, []

        x = sp.Symbol('x')
        y_fn = sp.Function('y')
        y = solution_expr  # already a SymPy expression in x

        ode_str = ode_match.group(0)
        # Replace y'', y' with computed derivatives
        d2y = sp.diff(y, x, 2)
        dy = sp.diff(y, x)

        # Build ODE expression by substituting into string-parsed version
        ode_expr_str = (
            ode_str
            .replace("y''", f"({d2y})")
            .replace("y'",  f"({dy})")
            .replace("y",   f"({y})")
        )
        parts = ode_expr_str.split('=', 1)
        if len(parts) != 2:
            return None, []

        local = {'x': x, 'exp': sp.exp, 'sin': sp.sin, 'cos': sp.cos,
                 'sqrt': sp.sqrt, 'ln': sp.ln, 'C1': sp.Symbol('C1'),
                 'C2': sp.Symbol('C2'), 'C3': sp.Symbol('C3')}
        lhs = sp.sympify(parts[0].strip(), locals=local)
        rhs = sp.sympify(parts[1].strip(), locals=local)
        residual = sp.simplify(lhs - rhs)
        if residual == 0:
            return True, []
        return False, [f"Proposed ODE solution does not satisfy the equation (residual = {residual})"]
    except Exception as exc:
        logger.debug("_verify_ode failed: %s", exc)
        return None, []


# ── public API ────────────────────────────────────────────────────────────────

def sympy_verify(
    problem_text: str,
    final_answer: str,
    problem_type: str = "",
) -> tuple[bool | None, list[str]]:
    """Verify final_answer against problem_text symbolically.

    Returns:
        (True,  [])       — confirmed correct
        (False, [issues]) — confirmed wrong
        (None,  [])       — inconclusive (proof, geometry, parse failure, etc.)
    """
    try:
        if _should_skip(problem_type):
            return None, []

        # Multi-part answer ("a) X; b) Y") — can't verify symbolically without splitting the problem
        if re.match(r'^[a-dA-D]\)', final_answer.strip()):
            return None, []

        # ODE path: problem_type contains "vi phân" or "ode" and answer has y =
        is_ode = any(k in problem_type.lower() for k in ("vi phân", "ode", "differential"))
        if is_ode or "y = " in final_answer.lower():
            sol = _extract_ode_solution(final_answer)
            if sol is not None:
                return _verify_ode(problem_text, sol)

        # System of equations: answer has multiple var=val pairs
        assignments = _parse_system_assignments(final_answer)
        if assignments:
            return _verify_system(problem_text, assignments)

        # Single/multiple roots
        candidates = _parse_candidates(final_answer)
        if candidates:
            return _verify_equation(problem_text, candidates)

        return None, []
    except Exception as exc:
        logger.debug("sympy_verify top-level exception: %s", exc)
        return None, []

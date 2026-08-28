"""Generate -> compute -> verify loop for the linear-algebra workspace.

Same split as visualization_generator.py/step_solver.py: the model (when a natural-
language prompt is used at all) only ever proposes a constrained LinAlgSpec — it never
performs the matrix computation. `solve_linalg` computes everything with sympy.Matrix,
recording an elementary-row-operation step ledger for rref/solve_system. `verify_linalg`
independently re-checks the result by a second method wherever one exists (residual
substitution for solved systems, A@inv==I for inverses, a manual Laplace expansion for
determinants) rather than just trusting the first sympy call — abstain over fabricate,
same principle as everywhere else in this feature set.
"""
from pathlib import Path

import sympy

from app.agent.linalg_schema import LinAlgSpec, validate_spec
from app.agent.router_client import AiRouterClient
from app.agent.verifier import VerificationResult

_PROMPT_PATH = Path(__file__).parent / "prompts" / "draft_linalg.md"


class LinAlgShapeError(ValueError):
    """Raised when the model's JSON is neither a valid abstention nor a valid spec."""


async def draft_linalg_spec(client: AiRouterClient, prompt_text: str) -> dict:
    system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    result = await client.complete_json(system_prompt, prompt_text)

    if result.get("available") is False:
        return {"available": False, "reason": result.get("reason", "model self-abstained")}

    spec_fields = {k: v for k, v in result.items() if k not in ("available", "reason")}
    try:
        spec = validate_spec(spec_fields)
    except Exception as exc:
        raise LinAlgShapeError(str(exc)) from exc
    if spec.operation in ("eigen", "svd"):
        raise LinAlgShapeError(f"{spec.operation} is not offered through natural-language drafting")

    return {"available": True, "spec": spec}


def _manual_rref(matrix: sympy.Matrix) -> tuple[sympy.Matrix, list[str]]:
    """Gauss-Jordan elimination with a human-readable log of each elementary row op."""
    m = matrix.copy()
    rows, cols = m.shape
    steps: list[str] = []
    pivot_row = 0
    for col in range(cols):
        if pivot_row >= rows:
            break
        pivot = next((r for r in range(pivot_row, rows) if m[r, col] != 0), None)
        if pivot is None:
            continue
        if pivot != pivot_row:
            m.row_swap(pivot, pivot_row)
            steps.append(f"R{pivot + 1} <-> R{pivot_row + 1}")
        pivot_val = m[pivot_row, col]
        if pivot_val != 1:
            m[pivot_row, :] = m[pivot_row, :] / pivot_val
            steps.append(f"R{pivot_row + 1} -> R{pivot_row + 1} / ({pivot_val})")
        for r in range(rows):
            if r != pivot_row and m[r, col] != 0:
                factor = m[r, col]
                m[r, :] = m[r, :] - factor * m[pivot_row, :]
                steps.append(f"R{r + 1} -> R{r + 1} - ({factor}) * R{pivot_row + 1}")
        pivot_row += 1
    return m, steps


def _laplace_det(m: sympy.Matrix) -> sympy.Expr:
    """Manual cofactor expansion along the first row — independent of Matrix.det()."""
    n = m.shape[0]
    if n == 1:
        return m[0, 0]
    if n == 2:
        return m[0, 0] * m[1, 1] - m[0, 1] * m[1, 0]
    total = sympy.Integer(0)
    for col in range(n):
        minor = m.minor_submatrix(0, col)
        sign = (-1) ** col
        total += sign * m[0, col] * _laplace_det(minor)
    return sympy.expand(total)


def solve_linalg(spec: LinAlgSpec) -> dict:
    """Deterministic sympy computation. Raises ValueError on dimension mismatches or a
    singular matrix where an operation requires invertibility."""
    # LinAlgSpec types entries as float (JSON has no integer/rational distinction), so
    # rebuild each as an exact sympy Rational rather than carrying float contamination
    # through every downstream computation — "exact rational arithmetic" per the plan.
    mats = [sympy.Matrix([[sympy.nsimplify(v, rational=True) for v in row] for row in m]) for m in spec.matrices]
    op = spec.operation
    derivation = {"operation": op, "matrices": mats, "steps": []}

    if op == "add":
        if mats[0].shape != mats[1].shape:
            raise ValueError("matrices must have the same shape to add")
        derivation["result"] = mats[0] + mats[1]
    elif op == "multiply":
        if mats[0].shape[1] != mats[1].shape[0]:
            raise ValueError("inner dimensions must match to multiply")
        derivation["result"] = mats[0] * mats[1]
    elif op == "determinant":
        if mats[0].shape[0] != mats[0].shape[1]:
            raise ValueError("determinant requires a square matrix")
        derivation["result"] = mats[0].det()
    elif op == "inverse":
        if mats[0].shape[0] != mats[0].shape[1]:
            raise ValueError("inverse requires a square matrix")
        if mats[0].det() == 0:
            raise ValueError("matrix is singular — no inverse exists")
        derivation["result"] = mats[0].inv()
    elif op == "rank":
        derivation["result"] = mats[0].rank()
    elif op == "rref":
        rref, steps = _manual_rref(mats[0])
        derivation["result"] = rref
        derivation["steps"] = steps
    elif op == "solve_system":
        rref, steps = _manual_rref(mats[0])
        n_unknowns = mats[0].shape[1] - 1
        pivot_rows = [r for r in range(rref.shape[0]) if any(rref[r, c] != 0 for c in range(n_unknowns))]
        inconsistent = any(
            all(rref[r, c] == 0 for c in range(n_unknowns)) and rref[r, n_unknowns] != 0
            for r in range(rref.shape[0])
        )
        if inconsistent or len(pivot_rows) < n_unknowns:
            raise ValueError("system has no unique solution")
        solution = [rref[r, n_unknowns] for r in range(n_unknowns)]
        derivation["result"] = sympy.Matrix(solution)
        derivation["steps"] = steps
    elif op == "eigen":
        derivation["result"] = mats[0].eigenvals()
    elif op == "lu":
        if mats[0].shape[0] != mats[0].shape[1]:
            raise ValueError("LU decomposition requires a square matrix")
        L, U, perm = mats[0].LUdecomposition()
        P = sympy.eye(mats[0].shape[0])
        for i, j in perm:
            P.row_swap(i, j)
        derivation["result"] = {"L": L, "U": U, "P": P}
        derivation["lu_perm"] = perm
    elif op == "qr":
        Q, R = mats[0].QRdecomposition()
        derivation["result"] = {"Q": Q, "R": R}
    elif op == "cholesky":
        if mats[0].shape[0] != mats[0].shape[1]:
            raise ValueError("Cholesky decomposition requires a square matrix")
        if mats[0] != mats[0].T:
            raise ValueError("Cholesky decomposition requires a symmetric matrix")
        try:
            L = mats[0].cholesky()
        except Exception as exc:
            raise ValueError(f"matrix is not positive-definite — no Cholesky decomposition exists ({exc})") from exc
        derivation["result"] = {"L": L}
    elif op == "svd":
        m = mats[0]
        ata = m.T * m
        eigenvals = ata.eigenvals()
        # order singular values descending, expanding multiplicities
        singular_vals = sorted((sympy.sqrt(ev) for ev, mult in eigenvals.items() for _ in range(mult)), reverse=True, key=lambda v: v.evalf())
        eigenvects = ata.eigenvects()
        v_cols = []
        for ev, mult, vects in sorted(eigenvects, key=lambda e: e[0].evalf(), reverse=True):
            for v in vects:
                v_cols.append(v.normalized())
        if len(v_cols) < ata.shape[0]:
            raise ValueError("could not compute a full eigenbasis for SVD (repeated/defective eigenvalues)")
        V = sympy.Matrix.hstack(*v_cols)
        S_vals = singular_vals
        u_cols = []
        for i, s in enumerate(S_vals):
            if s == 0:
                u_cols.append(sympy.zeros(m.shape[0], 1))
            else:
                u_cols.append((m * V[:, i]) / s)
        U = sympy.Matrix.hstack(*u_cols)
        derivation["result"] = {"U": U, "S": S_vals, "V": V}
    else:
        raise ValueError(f"unknown operation: {op}")

    return derivation


def verify_linalg(derivation: dict) -> VerificationResult:
    op = derivation["operation"]
    mats = derivation["matrices"]
    result = derivation["result"]

    if op == "add":
        rows, cols = mats[0].shape
        manual = sympy.Matrix(rows, cols, lambda r, c: mats[0][r, c] + mats[1][r, c])
        ok = manual == result
        return VerificationResult(ok, None, "verified" if ok else "elementwise recomputation does not match")

    if op == "multiply":
        r0, c0 = mats[0].shape
        _, c1 = mats[1].shape
        manual = sympy.Matrix(r0, c1, lambda r, c: sum(mats[0][r, k] * mats[1][k, c] for k in range(c0)))
        ok = sympy.simplify(manual - result) == sympy.zeros(r0, c1)
        return VerificationResult(ok, None, "verified" if ok else "elementwise recomputation does not match")

    if op == "determinant":
        manual = _laplace_det(mats[0])
        ok = sympy.simplify(manual - result) == 0
        return VerificationResult(ok, None, "verified" if ok else f"Laplace expansion gives {manual}, not {result}")

    if op == "inverse":
        identity = sympy.eye(mats[0].shape[0])
        ok = sympy.simplify(mats[0] * result - identity) == sympy.zeros(*identity.shape)
        return VerificationResult(ok, None, "verified" if ok else "A * A_inv is not the identity matrix")

    if op == "rank":
        rref, _ = _manual_rref(mats[0])
        nonzero_rows = sum(1 for r in range(rref.shape[0]) if any(v != 0 for v in rref.row(r)))
        ok = nonzero_rows == result
        return VerificationResult(ok, None, "verified" if ok else f"rref has {nonzero_rows} nonzero rows, not {result}")

    if op == "rref":
        rows, cols = result.shape
        for r in range(rows):
            row_vals = [result[r, c] for c in range(cols)]
            nonzero = [c for c, v in enumerate(row_vals) if v != 0]
            if not nonzero:
                continue
            lead = nonzero[0]
            if result[r, lead] != 1:
                return VerificationResult(False, None, f"row {r + 1} leading entry is not 1")
            for r2 in range(rows):
                if r2 != r and result[r2, lead] != 0:
                    return VerificationResult(False, None, f"column {lead + 1} is not cleared above/below the pivot")
        return VerificationResult(True, None, "verified")

    if op == "solve_system":
        n_unknowns = mats[0].shape[1] - 1
        augmented = mats[0]
        for r in range(augmented.shape[0]):
            lhs = sum(augmented[r, c] * result[c, 0] for c in range(n_unknowns))
            residual = sympy.simplify(lhs - augmented[r, n_unknowns])
            if residual != 0:
                return VerificationResult(False, None, f"equation {r + 1} residual is {residual}, not 0")
        return VerificationResult(True, None, "verified")

    if op == "eigen":
        for eigenvalue in result:
            char_val = sympy.simplify((mats[0] - eigenvalue * sympy.eye(mats[0].shape[0])).det())
            if char_val != 0:
                return VerificationResult(False, None, f"{eigenvalue} does not satisfy det(A - λI) = 0")
        return VerificationResult(True, None, "verified")

    if op == "lu":
        L, U = result["L"], result["U"]
        target = mats[0].copy()
        for i, j in derivation.get("lu_perm", []):
            target.row_swap(i, j)
        ok = sympy.simplify(L * U - target) == sympy.zeros(*target.shape)
        return VerificationResult(ok, None, "verified" if ok else "L * U does not reconstruct the (row-permuted) original matrix")

    if op == "qr":
        Q, R = result["Q"], result["R"]
        ok_reconstruct = sympy.simplify(Q * R - mats[0]) == sympy.zeros(*mats[0].shape)
        identity = sympy.eye(Q.shape[1])
        ok_orthogonal = sympy.simplify(Q.T * Q - identity) == sympy.zeros(*identity.shape)
        ok = ok_reconstruct and ok_orthogonal
        reason = "verified" if ok else ("Q * R does not reconstruct A" if not ok_reconstruct else "Q is not orthogonal (Q^T * Q != I)")
        return VerificationResult(ok, None, reason)

    if op == "cholesky":
        L = result["L"]
        ok = sympy.simplify(L * L.T - mats[0]) == sympy.zeros(*mats[0].shape)
        return VerificationResult(ok, None, "verified" if ok else "L * L^T does not reconstruct A")

    if op == "svd":
        U, S, V = result["U"], result["S"], result["V"]
        sigma = sympy.diag(*S)
        reconstruction = sympy.Matrix(U) * sigma * sympy.Matrix(V).T
        diff = reconstruction - mats[0]
        max_err = max((abs(complex(sympy.N(v))) for v in diff), default=0)
        tol = 1e-6
        ok = max_err <= tol
        return {"ok": ok, "reason": "verified" if ok else f"U*S*V^T reconstruction error {max_err} exceeds tolerance {tol}"}

    return VerificationResult(False, None, f"unknown operation: {op}")


def result_ok_reason(verification) -> tuple[bool, str]:
    if isinstance(verification, VerificationResult):
        return verification.ok, verification.reason
    return verification["ok"], verification["reason"]

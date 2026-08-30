// Client-side CAS for the mathlive calculator (Pure Mathematics Toolset Phase 4) — zero
// AI-router involvement. Wraps mathjs for instant, no-submit-button evaluation as the
// user types, mirroring the Desmos/GeoGebra live-update convention used everywhere else
// in this feature set. Pure functions — no React, no DOM — for direct table-driven tests.
import { evaluate, simplify as mjsSimplify, compile, complex as mjsComplex } from 'mathjs'

/** Evaluates a mathjs-syntax expression string. Never throws — returns
 * {value: string, error: null} or {value: null, error: string}. */
export function evaluateExpression(exprString) {
  if (!exprString || !exprString.trim()) return { value: null, error: null }
  try {
    const result = evaluate(exprString)
    if (result === undefined) return { value: null, error: 'Biểu thức không hợp lệ' }
    return { value: result.toString(), error: null }
  } catch (err) {
    return { value: null, error: err.message }
  }
}

/** Symbolic simplification (e.g. "x + x" -> "2 x"). Same never-throws contract. */
export function simplifyExpression(exprString) {
  if (!exprString || !exprString.trim()) return { value: null, error: null }
  try {
    const result = mjsSimplify(exprString)
    return { value: result.toString(), error: null }
  } catch (err) {
    return { value: null, error: err.message }
  }
}

/** mathjs uses `^` for power; sympy (the backend's plot-spec syntax) uses `**`. AI-
 * populated curves from POST /agent/plot need this conversion before reaching mathjs —
 * manually-typed rows (mathlive's ascii-math output) already use `^` and skip it. */
export function toMathjsSyntax(sympyStyleExpr) {
  return sympyStyleExpr.replaceAll('**', '^')
}

/** Evaluates a complex-number expression (mathjs uses `i` for the imaginary unit) and
 * returns its rectangular form. Never throws — {re: null, im: null, error} on failure. */
export function toComplex(exprString) {
  if (!exprString || !exprString.trim()) return { re: null, im: null, error: null }
  try {
    const result = evaluate(exprString)
    const c = result && typeof result === 'object' && 're' in result ? result : mjsComplex(result)
    return { re: c.re, im: c.im, error: null }
  } catch (err) {
    return { re: null, im: null, error: err.message }
  }
}

/** Evaluates a complex-number expression and returns its polar form {r, phi} (phi in
 * radians). Same never-throws contract. */
export function toPolar(exprString) {
  if (!exprString || !exprString.trim()) return { r: null, phi: null, error: null }
  try {
    const result = evaluate(exprString)
    const c = result && typeof result === 'object' && 're' in result ? result : mjsComplex(result)
    const polar = c.toPolar()
    return { r: polar.r, phi: polar.phi, error: null }
  } catch (err) {
    return { r: null, phi: null, error: err.message }
  }
}

/** Converts polar form (r, phi in radians) to rectangular {re, im}. Same never-throws
 * contract. */
export function fromPolar(r, phi) {
  try {
    const c = mjsComplex({ r: Number(r), phi: Number(phi) })
    if (Number.isNaN(c.re) || Number.isNaN(c.im)) return { re: null, im: null, error: 'Giá trị không hợp lệ' }
    return { re: c.re, im: c.im, error: null }
  } catch (err) {
    return { re: null, im: null, error: err.message }
  }
}

/** Compiles a single-variable (x) expression into a reusable (x) => number function for
 * per-point plotting. `scope` supplies extra bound names (e.g. slider parameters like
 * `{ a: 2 }` for "a*x^2") merged under `x` on every call. Never throws — returns
 * {fn: null, error} on failure so the caller can skip rendering that curve instead of
 * crashing the whole canvas. */
export function compileFunctionOfX(exprString, scope = {}) {
  if (!exprString || !exprString.trim()) return { fn: null, error: null }
  try {
    const node = compile(exprString)
    return { fn: (x) => node.evaluate({ ...scope, x }), error: null }
  } catch (err) {
    return { fn: null, error: err.message }
  }
}

/** Compiles a single-variable (y) expression into a reusable (y) => number function, for
 * "x = f(y)" curves (Mafs' `Plot.OfY`). Same scope/never-throws contract as
 * compileFunctionOfX. */
export function compileFunctionOfY(exprString, scope = {}) {
  if (!exprString || !exprString.trim()) return { fn: null, error: null }
  try {
    const node = compile(exprString)
    return { fn: (y) => node.evaluate({ ...scope, y }), error: null }
  } catch (err) {
    return { fn: null, error: err.message }
  }
}

/** Compiles a pair of single-variable (t) expressions into a reusable
 * (t) => [x, y] function for parametric curves (Mafs' `Plot.Parametric`). Either
 * expression failing to compile fails the whole pair — a parametric curve needs both. */
export function compileParametric(exprX, exprY, scope = {}) {
  if (!exprX || !exprX.trim() || !exprY || !exprY.trim()) return { fn: null, error: null }
  try {
    const nodeX = compile(exprX)
    const nodeY = compile(exprY)
    return {
      fn: (t) => [nodeX.evaluate({ ...scope, t }), nodeY.evaluate({ ...scope, t })],
      error: null,
    }
  } catch (err) {
    return { fn: null, error: err.message }
  }
}

/** Converts a polar expression "r(theta)" into a parametric (t) => [x, y] function via
 * x = r(theta)*cos(theta), y = r(theta)*sin(theta) — polar curves are rendered as
 * parametric curves client-side, there is no separate polar plot primitive in Mafs. */
export function compilePolar(exprR, scope = {}) {
  if (!exprR || !exprR.trim()) return { fn: null, error: null }
  try {
    const nodeR = compile(exprR)
    return {
      fn: (theta) => {
        const r = nodeR.evaluate({ ...scope, theta })
        return [r * Math.cos(theta), r * Math.sin(theta)]
      },
      error: null,
    }
  } catch (err) {
    return { fn: null, error: err.message }
  }
}

/** Builds a (x) => number function from regression coefficients in numpy.polyfit order
 * (highest degree first) — backs the Math Playground's AI-drafted `regression` op, whose
 * fit is computed backend-side and only handed to the frontend as coefficients to plot,
 * never re-fit client-side. Horner's method; never throws. */
export function compilePolynomialFromCoefficients(coefficients) {
  if (!Array.isArray(coefficients) || coefficients.length === 0) return (x) => NaN
  return (x) => coefficients.reduce((acc, c) => acc * x + c, 0)
}

const _RELOP_PATTERN = /(<=|>=|<|>|=)/

/** Splits an implicit-curve string like "x^2 + y^2 = 4" or "x^2 + y^2 < 4" into a
 * relop and a single g(x, y) = lhs - rhs function whose zero set is the curve (and whose
 * sign selects the shaded half-plane for an inequality). Defaults to "=" when no
 * relational operator is present (e.g. a bare "x^2 + y^2 - 4"). Never throws — returns
 * {fn: null, relop: null, error} on failure. */
export function compileImplicit(exprString, scope = {}) {
  if (!exprString || !exprString.trim()) return { fn: null, relop: null, error: null }
  try {
    const match = exprString.match(_RELOP_PATTERN)
    const relop = match ? match[0] : '='
    const [lhsStr, rhsStr] = match
      ? [exprString.slice(0, match.index), exprString.slice(match.index + relop.length)]
      : [exprString, '0']
    const lhsNode = compile(lhsStr || '0')
    const rhsNode = compile(rhsStr || '0')
    return {
      fn: (x, y) => lhsNode.evaluate({ ...scope, x, y }) - rhsNode.evaluate({ ...scope, x, y }),
      relop,
      error: null,
    }
  } catch (err) {
    return { fn: null, relop: null, error: err.message }
  }
}

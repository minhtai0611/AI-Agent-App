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
 * per-point plotting. Never throws — returns {fn: null, error} on failure so the caller
 * can skip rendering that curve instead of crashing the whole canvas. */
export function compileFunctionOfX(exprString) {
  if (!exprString || !exprString.trim()) return { fn: null, error: null }
  try {
    const node = compile(exprString)
    return { fn: (x) => node.evaluate({ x }), error: null }
  } catch (err) {
    return { fn: null, error: err.message }
  }
}

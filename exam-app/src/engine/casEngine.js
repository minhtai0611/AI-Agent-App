// Client-side CAS for the mathlive calculator (Pure Mathematics Toolset Phase 4) — zero
// AI-router involvement. Wraps mathjs for instant, no-submit-button evaluation as the
// user types, mirroring the Desmos/GeoGebra live-update convention used everywhere else
// in this feature set. Pure functions — no React, no DOM — for direct table-driven tests.
import { evaluate, simplify as mjsSimplify, compile } from 'mathjs'

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

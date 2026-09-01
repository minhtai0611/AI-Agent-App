import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { parse } from 'mathjs'
import 'mathlive'
import { pageVariants } from '../utils/animations.js'
import { MathText } from '../components/MathText.jsx'
import { evaluateExpression, toComplex, toPolar, fromPolar } from '../engine/casEngine.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { describeAgentFetchError } from '../lib/agentError.js'

// /calculator — "Đồng hồ đo cao · dụng cụ của người leo núi", per
// vantage/uploads/04-may-tinh-cas.md. North-star: one instrument, one glass
// face, a mono rail selects which minimal field(s) it shows — not a form
// warehouse of six tabs.
//
// Architecture decision (approved by the user before build): the page used
// to be 4 separate sub-tools (quick-eval, calculus, equation system, complex
// converter) glued together. There is no parser that can infer which
// operation a free-typed expression means, so per the spec's own documented
// fallback ("Nếu parser không nhận diện được... rail đóng vai chọn chế độ"),
// the rail is an explicit 9-mode selector, and every mode's minimal field(s)
// render inside one shared bordered panel.

const _API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function runCalculus(body) {
  try {
    const res = await fetch(`${_API_BASE}/agent/calculus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { available: false, reason: await describeAgentFetchError(res) }
    return await res.json()
  } catch (err) {
    return { available: false, reason: err.message }
  }
}

async function runEquationSystem(body) {
  try {
    const res = await fetch(`${_API_BASE}/agent/equations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { available: false, reason: await describeAgentFetchError(res) }
    return await res.json()
  } catch (err) {
    return { available: false, reason: err.message }
  }
}

// Calculus-mode expressions use sympy-style syntax ("x**2", not mathlive's
// ascii-math). There's no client-side sympy parser to preview them exactly as
// the backend will read them, but mathjs's own parser + toTex() gives a
// reasonable best-effort live KaTeX preview for the common case (basic
// algebra) — falls back to plain monospace text when mathjs can't parse it
// (e.g. dsolve's `Derivative(y(x), x)` syntax, which is sympy-only).
function bestEffortLatex(sympyStyleExpr) {
  if (!sympyStyleExpr || !sympyStyleExpr.trim()) return null
  try {
    return parse(sympyStyleExpr.replaceAll('**', '^')).toTex()
  } catch {
    return null
  }
}

const CALC_MODES = [
  { key: 'derivative', rail: '∂ ĐẠO HÀM', example: 'vd: x**3 + 2*x', hasOrder: true, hasPoint: false, hasBounds: false },
  { key: 'integral_indefinite', rail: '∫ NGUYÊN HÀM', example: 'vd: sin(x)*cos(x)', hasOrder: false, hasPoint: false, hasBounds: false },
  { key: 'integral_definite', rail: '∫ TÍCH PHÂN', example: 'vd: x**2', hasOrder: false, hasPoint: false, hasBounds: true },
  { key: 'limit', rail: 'lim GIỚI HẠN', example: "vd: sin(x)/x", hasOrder: false, hasPoint: true, hasBounds: false },
  { key: 'series', rail: 'Σ TAYLOR', example: 'vd: exp(x)', hasOrder: true, hasPoint: true, hasBounds: false },
  { key: 'dsolve', rail: 'ODE', example: "vd: Derivative(y(x), x) - y(x)", hasOrder: false, hasPoint: false, hasBounds: false },
]

const RAIL = [
  { key: 'quick', label: 'ĐO NHANH' },
  ...CALC_MODES.map((m) => ({ key: m.key, label: m.rail })),
  { key: 'equations', label: 'HỆ PT' },
  { key: 'complex', label: 'SỐ PHỨC' },
]

const LOG_KEY = 'cas_tool_log'
function loadLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]') } catch { return [] }
}
function pushLog(entry) {
  const next = [entry, ...loadLog().filter((e) => e.expr !== entry.expr || e.mode !== entry.mode)].slice(0, 5)
  localStorage.setItem(LOG_KEY, JSON.stringify(next))
  return next
}

export default function CasCalculator() {
  usePageMeta('Đồng hồ đo cao', { description: 'Máy tính CAS — một mặt kính, một dụng cụ. Gõ biểu thức, đọc kết quả typeset đẹp.' })

  const [mode, setMode] = useState('quick')
  const [log, setLog] = useState(loadLog)

  // Quick-eval (mathlive, live, client-only)
  const fieldRef = useRef(null)
  const [asciiMath, setAsciiMath] = useState('')
  const [live, setLive] = useState({ value: null, error: null })

  // Calculus modes
  const [calcExpr, setCalcExpr] = useState('')
  const [calcVariable, setCalcVariable] = useState('x')
  const [calcOrder, setCalcOrder] = useState(1)
  const [calcPoint, setCalcPoint] = useState('')
  const [calcBoundsA, setCalcBoundsA] = useState('')
  const [calcBoundsB, setCalcBoundsB] = useState('')
  const [calcResult, setCalcResult] = useState(null)
  const [calcLoading, setCalcLoading] = useState(false)

  // Equation system
  const [eqRows, setEqRows] = useState([''])
  const [eqVariables, setEqVariables] = useState('x, y')
  const [eqResult, setEqResult] = useState(null)
  const [eqLoading, setEqLoading] = useState(false)

  // Complex <-> polar
  const [complexExpr, setComplexExpr] = useState('')
  const [polarR, setPolarR] = useState('')
  const [polarPhi, setPolarPhi] = useState('')

  const calcMode = CALC_MODES.find((m) => m.key === mode)

  useEffect(() => {
    const el = fieldRef.current
    if (!el) return
    const onInput = () => {
      const ascii = el.getValue('ascii-math')
      setAsciiMath(ascii)
      setLive(evaluateExpression(ascii))
    }
    el.addEventListener('input', onInput)
    return () => el.removeEventListener('input', onInput)
  }, [])

  function recordLog(exprLabel, resultLabel) {
    setLog(pushLog({ mode, expr: exprLabel, result: resultLabel }))
  }

  async function handleCalculate() {
    if (!calcExpr.trim() || !calcMode) return
    setCalcLoading(true)
    setCalcResult(null)
    const body = { operation: calcMode.key, expr: calcExpr, variable: calcVariable }
    if (calcMode.hasOrder) body.order = Number(calcOrder) || 1
    if (calcMode.hasPoint) body.point = calcPoint === '' ? 0 : Number(calcPoint)
    if (calcMode.hasBounds) body.bounds = [Number(calcBoundsA) || 0, Number(calcBoundsB) || 0]
    const result = await runCalculus(body)
    setCalcResult(result)
    setCalcLoading(false)
    if (result.available) recordLog(calcExpr, result.result)
  }

  async function handleSolveSystem() {
    const equations = eqRows.map((r) => r.trim()).filter(Boolean)
    const variables = eqVariables.split(',').map((v) => v.trim()).filter(Boolean)
    if (!equations.length || !variables.length) return
    setEqLoading(true)
    setEqResult(null)
    const result = await runEquationSystem({ equations, variables })
    setEqResult(result)
    setEqLoading(false)
    if (result.available) recordLog(equations.join('; '), result.solutions.map((s) => Object.entries(s).map(([k, v]) => `${k}=${v}`).join(',')).join(' | '))
  }

  const complexRect = toComplex(complexExpr)
  const complexPolar = toPolar(complexExpr)
  const polarRect = polarR.trim() && polarPhi.trim() ? fromPolar(polarR, polarPhi) : { re: null, im: null, error: null }

  useEffect(() => {
    if (mode !== 'complex' || !complexExpr.trim() || complexRect.error || complexRect.re == null) return
    const timer = setTimeout(() => {
      recordLog(complexExpr, `r=${complexPolar.r?.toFixed(3)}, φ=${complexPolar.phi?.toFixed(3)}`)
    }, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complexExpr])

  function loadLogEntry(entry) {
    setMode(entry.mode)
    if (entry.mode === 'quick') {
      if (fieldRef.current) fieldRef.current.setValue(entry.expr)
      setAsciiMath(entry.expr)
      setLive(evaluateExpression(entry.expr))
    } else if (entry.mode === 'complex') {
      setComplexExpr(entry.expr)
    } else if (entry.mode === 'equations') {
      setEqRows(entry.expr.split('; '))
    } else {
      setCalcExpr(entry.expr)
    }
  }

  function handleKeyDown(e) {
    if (e.key !== 'Enter') return
    if (mode === 'equations') handleSolveSystem()
    else if (calcMode) handleCalculate()
  }

  const calcPreviewTex = calcMode ? bestEffortLatex(calcExpr) : null

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit" className="relative z-[1] min-h-screen">
      <div className="max-w-3xl mx-auto w-full px-6 sm:px-10 pt-8 pb-20 flex flex-col gap-6">
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 8 }}>
            TRẠM · DỤNG CỤ · D·02
          </div>
          <h1 className="font-display font-bold" style={{ fontSize: 39, color: 'var(--ink)' }}>Đồng hồ đo cao.</h1>
          <p style={{ color: 'var(--ink-2)', maxWidth: '60ch', marginTop: 8 }}>
            Gõ biểu thức, đọc kết quả và từng bước biến đổi — như cách máy "nghĩ", không chỉ đáp số.
          </p>
        </div>

        {/* Rail — explicit mode selector, mono underline, no rounded tabs */}
        <div role="tablist" aria-label="Chọn phép đo" className="flex items-center gap-4 overflow-x-auto" style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: 0 }}>
          {RAIL.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={mode === r.key}
              onClick={() => setMode(r.key)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 12.5, letterSpacing: '0.04em', whiteSpace: 'nowrap',
                color: mode === r.key ? 'var(--ink)' : 'var(--ink-3)',
                borderBottom: mode === r.key ? '2px solid var(--accent)' : '2px solid transparent',
                paddingBottom: 8, transition: 'border-color 200ms var(--ease-out), color 200ms var(--ease-out)',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Glass face — one panel, contents swap per mode */}
        <div onKeyDown={handleKeyDown} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', background: 'var(--paper)', padding: 'var(--s5)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'quick' && (
            <div className="flex flex-col gap-3">
              <label htmlFor="cas-quick-field" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>BIỂU THỨC</label>
              {/* eslint-disable-next-line react/no-unknown-property */}
              <math-field
                id="cas-quick-field"
                ref={fieldRef}
                data-testid="cas-math-field"
                style={{ width: '100%', fontSize: 19, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--paper-2)', color: 'var(--ink)' }}
              />
              {live.error && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--accent-deep)' }}>
                  Mực chưa đọc được dòng này — kiểm tra dấu và ngoặc
                </p>
              )}
              {!live.error && live.value != null && (
                <p data-testid="cas-live-result" style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>= {live.value}</p>
              )}
              {!live.error && live.value == null && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-3)' }}>ĐƯA BIỂU THỨC LÊN MẶT KÍNH…</p>
              )}
            </div>
          )}

          {calcMode && (
            <div className="flex flex-col gap-3">
              <label htmlFor="calc-expr-input" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>BIỂU THỨC</label>
              <input
                id="calc-expr-input"
                data-testid="calc-expr-input"
                value={calcExpr}
                onChange={(e) => setCalcExpr(e.target.value)}
                placeholder={calcMode.example}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 18, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--paper-2)', color: 'var(--ink)' }}
              />
              {calcExpr.trim() && (
                calcPreviewTex
                  ? <MathText style={{ fontSize: 20, color: 'var(--ink)' }}>{`$${calcPreviewTex}$`}</MathText>
                  : <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-3)' }}>{calcExpr}</p>
              )}
              {calcMode.key === 'dsolve' && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                  Dùng cú pháp Derivative(y(x), x) cho y'
                </p>
              )}
              <div className="flex flex-wrap gap-4 items-center">
                <label className="flex items-center gap-1.5" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>
                  BIẾN
                  <input value={calcVariable} onChange={(e) => setCalcVariable(e.target.value)} style={{ width: 44, fontFamily: 'var(--font-mono)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--paper)', color: 'var(--ink)', padding: '4px 6px' }} />
                </label>
                {calcMode.hasOrder && (
                  <label className="flex items-center gap-1.5" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>
                    BẬC
                    <input type="number" min="1" value={calcOrder} onChange={(e) => setCalcOrder(e.target.value)} style={{ width: 52, fontFamily: 'var(--font-mono)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--paper)', color: 'var(--ink)', padding: '4px 6px' }} />
                  </label>
                )}
                {calcMode.hasPoint && (
                  <label className="flex items-center gap-1.5" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>
                    TẠI ĐIỂM
                    <input type="number" value={calcPoint} onChange={(e) => setCalcPoint(e.target.value)} style={{ width: 60, fontFamily: 'var(--font-mono)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--paper)', color: 'var(--ink)', padding: '4px 6px' }} />
                  </label>
                )}
                {calcMode.hasBounds && (
                  <>
                    <label className="flex items-center gap-1.5" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>
                      TỪ
                      <input type="number" value={calcBoundsA} onChange={(e) => setCalcBoundsA(e.target.value)} style={{ width: 60, fontFamily: 'var(--font-mono)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--paper)', color: 'var(--ink)', padding: '4px 6px' }} />
                    </label>
                    <label className="flex items-center gap-1.5" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>
                      ĐẾN
                      <input type="number" value={calcBoundsB} onChange={(e) => setCalcBoundsB(e.target.value)} style={{ width: 60, fontFamily: 'var(--font-mono)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--paper)', color: 'var(--ink)', padding: '4px 6px' }} />
                    </label>
                  </>
                )}
              </div>
              <button
                onClick={handleCalculate}
                disabled={!calcExpr.trim() || calcLoading}
                className="self-start"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.03em', background: 'var(--accent)', color: 'var(--paper)', border: '1px solid var(--accent)', borderRadius: 'var(--r-sm)', padding: '10px 20px', opacity: (!calcExpr.trim() || calcLoading) ? 0.5 : 1 }}
              >
                {calcLoading ? 'ĐANG ĐO…' : 'ĐO ▲'}
              </button>
            </div>
          )}

          {mode === 'equations' && (
            <div className="flex flex-col gap-3">
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>HỆ PHƯƠNG TRÌNH</label>
              {eqRows.map((row, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={row}
                    onChange={(e) => setEqRows((rows) => rows.map((r, j) => (j === i ? e.target.value : r)))}
                    placeholder="vd: x**2 + y = 5"
                    style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 15, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--paper-2)', color: 'var(--ink)' }}
                  />
                  {eqRows.length > 1 && (
                    <button onClick={() => setEqRows((rows) => rows.filter((_, j) => j !== i))} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '6px 10px' }}>XOÁ</button>
                  )}
                </div>
              ))}
              <button onClick={() => setEqRows((rows) => [...rows, ''])} className="self-start" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)', border: '1px dashed var(--line)', borderRadius: 'var(--r-sm)', padding: '6px 12px' }}>+ PHƯƠNG TRÌNH</button>
              <label className="flex items-center gap-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>
                ẨN SỐ
                <input value={eqVariables} onChange={(e) => setEqVariables(e.target.value)} style={{ width: 120, fontFamily: 'var(--font-mono)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--paper)', color: 'var(--ink)', padding: '4px 8px' }} />
              </label>
              <button
                onClick={handleSolveSystem}
                disabled={eqLoading}
                className="self-start"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.03em', background: 'var(--accent)', color: 'var(--paper)', border: '1px solid var(--accent)', borderRadius: 'var(--r-sm)', padding: '10px 20px', opacity: eqLoading ? 0.5 : 1 }}
              >
                {eqLoading ? 'ĐANG ĐO…' : 'ĐO ▲'}
              </button>
            </div>
          )}

          {mode === 'complex' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>CHỮ NHẬT → CỰC (dùng "i")</label>
                <input
                  value={complexExpr}
                  onChange={(e) => setComplexExpr(e.target.value)}
                  placeholder="vd: 3 + 4i"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 16, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--paper-2)', color: 'var(--ink)' }}
                />
                {complexRect.error && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-deep)' }}>Mực chưa đọc được dòng này — kiểm tra dấu và ngoặc</p>}
                {!complexRect.error && complexRect.re != null && (
                  <p data-testid="complex-polar-result" style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--ink)' }}>r = {complexPolar.r?.toFixed(4)}, φ = {complexPolar.phi?.toFixed(4)} rad</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>CỰC → CHỮ NHẬT</label>
                <div className="flex gap-2">
                  <input value={polarR} onChange={(e) => setPolarR(e.target.value)} placeholder="r" style={{ width: 80, fontFamily: 'var(--font-mono)', fontSize: 16, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--paper-2)', color: 'var(--ink)' }} />
                  <input value={polarPhi} onChange={(e) => setPolarPhi(e.target.value)} placeholder="φ (rad)" style={{ width: 96, fontFamily: 'var(--font-mono)', fontSize: 16, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--paper-2)', color: 'var(--ink)' }} />
                </div>
                {polarRect.error && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-deep)' }}>{polarRect.error}</p>}
                {!polarRect.error && polarRect.re != null && (
                  <p data-testid="polar-rect-result" style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--ink)' }}>{polarRect.re.toFixed(4)} {polarRect.im >= 0 ? '+' : '-'} {Math.abs(polarRect.im).toFixed(4)}i</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Results — typeset like a book page, not a console */}
        {calcMode && calcResult && (
          <div style={{ borderTop: '2px solid var(--ink)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {calcResult.available ? (
              <>
                <MathText data-testid="calc-result" style={{ fontSize: 30, color: 'var(--ink)' }}>{`$${calcResult.result_latex}$`}</MathText>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                  NHỊP LEO CHI TIẾT ĐANG ĐƯỢC HOÀN THIỆN CHO PHÉP NÀY
                </p>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--pine)' }}>ĐỐI CHIẾU: ENGINE NỘI BỘ ✓</span>
              </>
            ) : (
              <p data-testid="calc-result-error" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent-deep)' }}>
                PHÉP ĐO NÀY NGOÀI TẦM DỤNG CỤ — THỬ VIẾT DẠNG KHÁC
              </p>
            )}
          </div>
        )}

        {mode === 'equations' && eqResult && (
          <div style={{ borderTop: '2px solid var(--ink)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {eqResult.available ? (
              <>
                {eqResult.solutions.map((sol, i) => (
                  <p key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--ink)' }}>
                    {Object.entries(sol).map(([k, v]) => `${k} = ${v}`).join(',  ')}
                  </p>
                ))}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--pine)' }}>ĐỐI CHIẾU: ENGINE NỘI BỘ ✓</span>
              </>
            ) : (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent-deep)' }}>
                PHÉP ĐO NÀY NGOÀI TẦM DỤNG CỤ — THỬ VIẾT DẠNG KHÁC
              </p>
            )}
          </div>
        )}

        {/* Tool log — last 5 across all modes, hidden entirely when empty */}
        {log.length > 0 && (
          <div className="flex flex-col gap-1.5" style={{ marginTop: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', color: 'var(--ink-3)' }}>NHẬT KÝ DỤNG CỤ</span>
            {log.map((entry, i) => (
              <button
                key={i}
                onClick={() => loadLogEntry(entry)}
                className="text-left"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-2)', padding: '4px 0' }}
              >
                {entry.expr.length > 40 ? entry.expr.slice(0, 40) + '…' : entry.expr}
                <span style={{ color: 'var(--ink-3)' }}> → {entry.result}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

import { useEffect, useRef, useState } from 'react'
import 'mathlive'
import PageShell, { PageCard } from '../components/PageShell.jsx'
import { MathText } from '../components/MathText.jsx'
import { evaluateExpression, toComplex, toPolar, fromPolar } from '../engine/casEngine.js'
import { usePageMeta } from '../hooks/usePageMeta.js'

const _API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function checkWithBackend(exprString) {
  try {
    const res = await fetch(`${_API_BASE}/cas/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expr: exprString }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

const CALC_OPERATIONS = [
  { op: 'derivative', label: 'Đạo hàm' },
  { op: 'integral_indefinite', label: 'Nguyên hàm' },
  { op: 'integral_definite', label: 'Tích phân xác định' },
  { op: 'limit', label: 'Giới hạn' },
  { op: 'series', label: 'Khai triển Taylor' },
  { op: 'dsolve', label: 'Phương trình vi phân' },
]

async function runCalculus(body) {
  try {
    const res = await fetch(`${_API_BASE}/agent/calculus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { available: false, reason: 'Máy chủ không phản hồi.' }
    return await res.json()
  } catch {
    return { available: false, reason: 'Không thể kết nối máy chủ.' }
  }
}

async function runEquationSystem(body) {
  try {
    const res = await fetch(`${_API_BASE}/agent/equations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { available: false, reason: 'Máy chủ không phản hồi.' }
    return await res.json()
  } catch {
    return { available: false, reason: 'Không thể kết nối máy chủ.' }
  }
}

export default function CasCalculator() {
  usePageMeta('Máy tính CAS', { noindex: true })
  const fieldRef = useRef(null)
  const [asciiMath, setAsciiMath] = useState('')
  const [live, setLive] = useState({ value: null, error: null })
  const [checked, setChecked] = useState(null) // backend "kiểm tra" result, or null if not yet requested

  const [calcOp, setCalcOp] = useState('derivative')
  const [calcExpr, setCalcExpr] = useState('')
  const [calcVariable, setCalcVariable] = useState('x')
  const [calcOrder, setCalcOrder] = useState(1)
  const [calcPoint, setCalcPoint] = useState('')
  const [calcBoundsA, setCalcBoundsA] = useState('')
  const [calcBoundsB, setCalcBoundsB] = useState('')
  const [calcResult, setCalcResult] = useState(null)
  const [calcLoading, setCalcLoading] = useState(false)

  const [eqRows, setEqRows] = useState([''])
  const [eqVariables, setEqVariables] = useState('x, y')
  const [eqResult, setEqResult] = useState(null)
  const [eqLoading, setEqLoading] = useState(false)

  const [complexExpr, setComplexExpr] = useState('')
  const [polarR, setPolarR] = useState('')
  const [polarPhi, setPolarPhi] = useState('')

  useEffect(() => {
    const el = fieldRef.current
    if (!el) return
    const onInput = () => {
      const ascii = el.getValue('ascii-math')
      setAsciiMath(ascii)
      setChecked(null)
      setLive(evaluateExpression(ascii))
    }
    el.addEventListener('input', onInput)
    return () => el.removeEventListener('input', onInput)
  }, [])

  const handleCheck = async () => {
    if (!asciiMath.trim()) return
    const result = await checkWithBackend(asciiMath)
    setChecked(result)
  }

  const handleCalculate = async () => {
    if (!calcExpr.trim()) return
    setCalcLoading(true)
    setCalcResult(null)
    const body = { operation: calcOp, expr: calcExpr, variable: calcVariable }
    if (calcOp === 'derivative' || calcOp === 'series') body.order = Number(calcOrder) || 1
    if (calcOp === 'limit' || calcOp === 'series') body.point = calcPoint === '' ? 0 : Number(calcPoint)
    if (calcOp === 'integral_definite') body.bounds = [Number(calcBoundsA) || 0, Number(calcBoundsB) || 0]
    const result = await runCalculus(body)
    setCalcResult(result)
    setCalcLoading(false)
  }

  const handleSolveSystem = async () => {
    const equations = eqRows.map(r => r.trim()).filter(Boolean)
    const variables = eqVariables.split(',').map(v => v.trim()).filter(Boolean)
    if (!equations.length || !variables.length) return
    setEqLoading(true)
    setEqResult(null)
    const result = await runEquationSystem({ equations, variables })
    setEqResult(result)
    setEqLoading(false)
  }

  const complexRect = toComplex(complexExpr)
  const complexPolar = toPolar(complexExpr)
  const polarRect = polarR.trim() && polarPhi.trim() ? fromPolar(polarR, polarPhi) : { re: null, im: null, error: null }

  return (
    <PageShell title="Máy tính CAS">
      <PageCard>
        <math-field
          ref={fieldRef}
          data-testid="cas-math-field"
          className="w-full text-2xl px-4 py-3 rounded-xl border border-border bg-surface"
        />
      </PageCard>

      <PageCard label="Kết quả" className="min-h-[80px]">
        {live.error && <p className="font-sans text-sm text-destructive">{live.error}</p>}
        {!live.error && live.value != null && (
          <p data-testid="cas-live-result" className="font-mono text-lg font-semibold text-primary">{live.value}</p>
        )}
        {!live.error && live.value == null && (
          <p className="font-sans text-sm text-faint">Nhập một biểu thức để xem kết quả ngay.</p>
        )}
      </PageCard>

      <button
        onClick={handleCheck}
        disabled={!asciiMath.trim()}
        className="self-start px-5 py-2.5 rounded-lg font-sans text-sm font-bold bg-primary text-primary-fg disabled:opacity-40"
      >
        Kiểm tra với máy chủ
      </button>
      {checked && (
        <p data-testid="cas-checked-result" className="font-sans text-sm text-info">
          {checked.available ? `Máy chủ xác nhận: ${checked.simplified}` : 'Không thể kiểm tra biểu thức này.'}
        </p>
      )}

      <PageCard label="Giải tích">
        <div className="flex flex-wrap gap-2">
          {CALC_OPERATIONS.map(o => (
            <button
              key={o.op}
              onClick={() => { setCalcOp(o.op); setCalcResult(null) }}
              className={`px-3 py-1.5 rounded-lg font-sans text-xs font-medium border transition ${
                calcOp === o.op
                  ? 'bg-primary-subtle border-primary-border text-primary'
                  : 'bg-surface-elevated border-border text-foreground'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <input
          data-testid="calc-expr-input"
          value={calcExpr}
          onChange={e => setCalcExpr(e.target.value)}
          placeholder="Biểu thức, vd: x**2 + 3*x"
          className="px-3 py-2 rounded-lg border border-border bg-background font-mono text-sm text-foreground"
        />

        <div className="flex flex-wrap gap-2 items-center">
          <label className="font-sans text-xs text-dim flex items-center gap-1.5">
            Biến
            <input
              value={calcVariable}
              onChange={e => setCalcVariable(e.target.value)}
              className="w-12 px-2 py-1 rounded-lg border border-border bg-background font-mono text-sm text-foreground"
            />
          </label>
          {(calcOp === 'derivative' || calcOp === 'series') && (
            <label className="font-sans text-xs text-dim flex items-center gap-1.5">
              Bậc
              <input
                type="number" min="1"
                value={calcOrder}
                onChange={e => setCalcOrder(e.target.value)}
                className="w-14 px-2 py-1 rounded-lg border border-border bg-background font-mono text-sm text-foreground"
              />
            </label>
          )}
          {(calcOp === 'limit' || calcOp === 'series') && (
            <label className="font-sans text-xs text-dim flex items-center gap-1.5">
              Tại điểm
              <input
                type="number"
                value={calcPoint}
                onChange={e => setCalcPoint(e.target.value)}
                className="w-16 px-2 py-1 rounded-lg border border-border bg-background font-mono text-sm text-foreground"
              />
            </label>
          )}
          {calcOp === 'integral_definite' && (
            <>
              <label className="font-sans text-xs text-dim flex items-center gap-1.5">
                Từ
                <input
                  type="number"
                  value={calcBoundsA}
                  onChange={e => setCalcBoundsA(e.target.value)}
                  className="w-16 px-2 py-1 rounded-lg border border-border bg-background font-mono text-sm text-foreground"
                />
              </label>
              <label className="font-sans text-xs text-dim flex items-center gap-1.5">
                Đến
                <input
                  type="number"
                  value={calcBoundsB}
                  onChange={e => setCalcBoundsB(e.target.value)}
                  className="w-16 px-2 py-1 rounded-lg border border-border bg-background font-mono text-sm text-foreground"
                />
              </label>
            </>
          )}
        </div>

        {calcOp === 'dsolve' && (
          <p className="font-sans text-[11px] text-faint">
            Dùng cú pháp <code>Derivative(y(x), x)</code> cho y', vd: <code>Derivative(y(x), x) - y(x)</code>
          </p>
        )}

        <button
          onClick={handleCalculate}
          disabled={!calcExpr.trim() || calcLoading}
          className="self-start px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg disabled:opacity-40"
        >
          {calcLoading ? 'Đang tính…' : 'Tính'}
        </button>

        {calcResult && !calcResult.available && (
          <p data-testid="calc-result-error" className="font-sans text-[13px] text-destructive">{calcResult.reason}</p>
        )}
        {calcResult?.available && (
          <span data-testid="calc-result">
            <MathText className="font-sans text-[14px] text-foreground">
              {`$${calcResult.result_latex}$`}
            </MathText>
          </span>
        )}
      </PageCard>

      <PageCard label="Hệ phương trình">
        <div className="flex flex-col gap-1.5">
          {eqRows.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={row}
                onChange={e => setEqRows(rows => rows.map((r, j) => (j === i ? e.target.value : r)))}
                placeholder="vd: x**2 + y = 5"
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background font-mono text-sm text-foreground"
              />
              {eqRows.length > 1 && (
                <button
                  onClick={() => setEqRows(rows => rows.filter((_, j) => j !== i))}
                  className="px-2 py-1 rounded-lg border border-border font-sans text-xs text-muted"
                >
                  Xoá
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => setEqRows(rows => [...rows, ''])}
          className="self-start px-3 py-1.5 rounded-lg border border-border font-sans text-xs text-muted"
        >
          + Phương trình
        </button>

        <label className="font-sans text-xs text-dim flex items-center gap-1.5">
          Ẩn số (cách nhau bởi dấu phẩy)
          <input
            value={eqVariables}
            onChange={e => setEqVariables(e.target.value)}
            className="w-32 px-2 py-1 rounded-lg border border-border bg-background font-mono text-sm text-foreground"
          />
        </label>

        <button
          onClick={handleSolveSystem}
          disabled={eqLoading}
          className="self-start px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg disabled:opacity-40"
        >
          {eqLoading ? 'Đang giải…' : 'Giải hệ'}
        </button>

        {eqResult && !eqResult.available && (
          <p className="font-sans text-[13px] text-destructive">{eqResult.reason}</p>
        )}
        {eqResult?.available && (
          <div className="flex flex-col gap-2">
            {eqResult.solutions.map((sol, i) => (
              <div key={i} className="p-3 rounded-xl border border-border bg-surface-elevated font-mono text-sm text-foreground">
                {Object.entries(sol).map(([k, v]) => `${k} = ${v}`).join(', ')}
              </div>
            ))}
          </div>
        )}
      </PageCard>

      <PageCard label="Số phức & dạng cực">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="font-sans text-[0.6875rem] text-faint">Dạng chữ nhật → cực (dùng "i" cho đơn vị ảo)</span>
            <input
              value={complexExpr}
              onChange={e => setComplexExpr(e.target.value)}
              placeholder="vd: 3 + 4i"
              className="px-3 py-2 rounded-lg border border-border bg-background font-mono text-sm text-foreground"
            />
            {complexRect.error && <p className="font-sans text-xs text-destructive">{complexRect.error}</p>}
            {!complexRect.error && complexRect.re != null && (
              <p data-testid="complex-polar-result" className="font-mono text-sm text-primary">
                r = {complexPolar.r?.toFixed(4)}, φ = {complexPolar.phi?.toFixed(4)} rad
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-sans text-[0.6875rem] text-faint">Dạng cực → chữ nhật</span>
            <div className="flex gap-2">
              <input
                value={polarR}
                onChange={e => setPolarR(e.target.value)}
                placeholder="r"
                className="w-20 px-2 py-2 rounded-lg border border-border bg-background font-mono text-sm text-foreground"
              />
              <input
                value={polarPhi}
                onChange={e => setPolarPhi(e.target.value)}
                placeholder="φ (rad)"
                className="w-24 px-2 py-2 rounded-lg border border-border bg-background font-mono text-sm text-foreground"
              />
            </div>
            {polarRect.error && <p className="font-sans text-xs text-destructive">{polarRect.error}</p>}
            {!polarRect.error && polarRect.re != null && (
              <p data-testid="polar-rect-result" className="font-mono text-sm text-primary">
                {polarRect.re.toFixed(4)} {polarRect.im >= 0 ? '+' : '-'} {Math.abs(polarRect.im).toFixed(4)}i
              </p>
            )}
          </div>
        </div>
      </PageCard>
    </PageShell>
  )
}

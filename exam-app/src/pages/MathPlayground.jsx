import { useEffect, useMemo, useRef, useState } from 'react'
import { Mafs, Coordinates, Plot, Line, Polygon, Point, Text } from 'mafs'
import 'mafs/core.css'
import 'mathlive'
import PageShell, { PageCard } from '../components/PageShell.jsx'
import {
  compileFunctionOfX, compileFunctionOfY, compileParametric, compilePolar,
  compileImplicit, compilePolynomialFromCoefficients, toMathjsSyntax,
} from '../engine/casEngine.js'
import { traceImplicitCurve, sampleInequalityCells } from '../engine/marchingSquares.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { describeAgentFetchError } from '../lib/agentError.js'

const _API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const COLORS = ['#8B5CF6', '#FAFAFA', '#22C55E', '#F87171', '#38BDF8']
const VIEW_BOUNDS = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 }

const KINDS = [
  { value: 'function', label: 'y = f(x)' },
  { value: 'function-y', label: 'x = f(y)' },
  { value: 'parametric', label: 'Tham số' },
  { value: 'polar', label: 'Cực' },
  { value: 'implicit', label: 'Ẩn (f(x,y))' },
]

async function draftPlotFromPrompt(promptText, previousSpec) {
  try {
    const res = await fetch(`${_API_BASE}/agent/plot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt_text: promptText, previous_spec: previousSpec ?? null }),
    })
    if (!res.ok) return { available: false, reason: await describeAgentFetchError(res) }
    return await res.json()
  } catch (err) {
    return { available: false, reason: err.message }
  }
}

async function fetchPlotNarration(kind, spec, results) {
  try {
    const res = await fetch(`${_API_BASE}/agent/plot/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec, results }),
    })
    if (!res.ok) return { text: null, reason: await describeAgentFetchError(res) }
    const data = await res.json()
    return { text: data.narrative ?? data.suggestion ?? '', reason: null }
  } catch (err) {
    return { text: null, reason: err.message }
  }
}

let nextRowId = 1
let nextParamId = 1

function newRow(expr = '', kind = 'function') {
  return {
    id: nextRowId++,
    kind,
    expr,
    expr2: '',
    domainMin: '',
    domainMax: '',
    tMin: '0',
    tMax: kind === 'polar' ? String(2 * Math.PI) : '10',
    color: COLORS[(nextRowId - 1) % COLORS.length],
    visible: true,
  }
}

function newParameter(name = 'a') {
  return { id: nextParamId++, name, min: -5, max: 5, step: 0.1, value: 1 }
}

/** Builds the mathjs evaluation scope from the current slider parameters. */
function scopeFromParameters(parameters) {
  const scope = {}
  for (const p of parameters) scope[p.name] = p.value
  return scope
}

/** Per-curve domain restriction, shared by function/function-y rows. Falls back to the
 * full view bounds when the row's fields are blank or non-numeric. */
function parseDomain(row, viewMin, viewMax) {
  const min = row.domainMin.trim() === '' ? viewMin : Number(row.domainMin)
  const max = row.domainMax.trim() === '' ? viewMax : Number(row.domainMax)
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return [viewMin, viewMax]
  return [min, max]
}

function ExpressionRow({ row, onChange, onRemove }) {
  const fieldRef = useRef(null)
  const field2Ref = useRef(null)

  useEffect(() => {
    const el = fieldRef.current
    if (!el) return
    if (el.getValue('ascii-math') !== row.expr) el.setValue(row.expr)
    const onInput = () => onChange({ ...row, expr: el.getValue('ascii-math') })
    el.addEventListener('input', onInput)
    return () => el.removeEventListener('input', onInput)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id, row.kind])

  useEffect(() => {
    const el = field2Ref.current
    if (!el || row.kind !== 'parametric') return
    if (el.getValue('ascii-math') !== row.expr2) el.setValue(row.expr2)
    const onInput = () => onChange({ ...row, expr2: el.getValue('ascii-math') })
    el.addEventListener('input', onInput)
    return () => el.removeEventListener('input', onInput)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id, row.kind])

  const isRange = row.kind === 'parametric' || row.kind === 'polar'
  const isDomain = row.kind === 'function' || row.kind === 'function-y'

  return (
    <div className="flex flex-col gap-1.5 py-1.5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: row.color }} />
        <button
          onClick={() => onChange({ ...row, visible: !row.visible })}
          className="text-xs flex-shrink-0"
          style={{ opacity: row.visible ? 1 : 0.35 }}
          aria-label={row.visible ? 'Ẩn đường' : 'Hiện đường'}
        >
          👁
        </button>
        <select
          value={row.kind}
          onChange={(e) => onChange({ ...row, kind: e.target.value })}
          className="text-[0.6875rem] rounded-md border border-border bg-background px-1 py-1 flex-shrink-0"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
        <math-field ref={fieldRef} className="flex-1 text-base px-2 py-1.5 rounded-lg border border-border bg-background" />
        <button onClick={onRemove} className="text-faint hover:text-destructive text-sm flex-shrink-0">✕</button>
      </div>

      {row.kind === 'parametric' && (
        <div className="flex items-center gap-2 pl-8">
          <span className="text-[0.6875rem] text-faint flex-shrink-0">y(t) =</span>
          <math-field ref={field2Ref} className="flex-1 text-sm px-2 py-1 rounded-lg border border-border bg-background" />
        </div>
      )}

      {isRange && (
        <div className="flex items-center gap-2 pl-8 text-[0.6875rem] text-faint">
          <span>{row.kind === 'polar' ? 'θ ∈' : 't ∈'}</span>
          <input
            type="number" value={row.tMin}
            onChange={(e) => onChange({ ...row, tMin: e.target.value })}
            className="w-16 px-1.5 py-1 rounded-md border border-border bg-background"
          />
          <span>–</span>
          <input
            type="number" value={row.tMax}
            onChange={(e) => onChange({ ...row, tMax: e.target.value })}
            className="w-16 px-1.5 py-1 rounded-md border border-border bg-background"
          />
        </div>
      )}

      {isDomain && (
        <div className="flex items-center gap-2 pl-8 text-[0.6875rem] text-faint">
          <span>miền {row.kind === 'function' ? 'x' : 'y'} ∈</span>
          <input
            type="number" value={row.domainMin} placeholder="−∞"
            onChange={(e) => onChange({ ...row, domainMin: e.target.value })}
            className="w-16 px-1.5 py-1 rounded-md border border-border bg-background"
          />
          <span>–</span>
          <input
            type="number" value={row.domainMax} placeholder="+∞"
            onChange={(e) => onChange({ ...row, domainMax: e.target.value })}
            className="w-16 px-1.5 py-1 rounded-md border border-border bg-background"
          />
        </div>
      )}
    </div>
  )
}

function ParameterSlider({ param, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <input
        value={param.name}
        onChange={(e) => onChange({ ...param, name: e.target.value.trim() || param.name })}
        className="w-10 px-1 py-1 rounded-md border border-border bg-background font-mono text-center"
      />
      <span>=</span>
      <input
        type="range"
        min={param.min} max={param.max} step={param.step}
        value={param.value}
        onChange={(e) => onChange({ ...param, value: Number(e.target.value) })}
        className="flex-1"
      />
      <span className="w-10 text-right font-mono tabular-nums">{param.value.toFixed(2)}</span>
      <button onClick={onRemove} className="text-faint hover:text-destructive">✕</button>
    </div>
  )
}

/** Renders one row against the current scope/view. Returns null (skips) for anything
 * that fails to compile — never throws, so one bad expression can't blank the canvas. */
function RenderedCurve({ row, scope }) {
  if (row.kind === 'function') {
    const [dMin, dMax] = parseDomain(row, VIEW_BOUNDS.xMin, VIEW_BOUNDS.xMax)
    const { fn } = compileFunctionOfX(row.expr, scope)
    if (!fn) return null
    return <Plot.OfX y={fn} color={row.color} domain={[dMin, dMax]} />
  }
  if (row.kind === 'function-y') {
    const [dMin, dMax] = parseDomain(row, VIEW_BOUNDS.yMin, VIEW_BOUNDS.yMax)
    const { fn } = compileFunctionOfY(row.expr, scope)
    if (!fn) return null
    return <Plot.OfY x={fn} color={row.color} domain={[dMin, dMax]} />
  }
  if (row.kind === 'parametric') {
    const { fn } = compileParametric(row.expr, row.expr2, scope)
    const tMin = Number(row.tMin)
    const tMax = Number(row.tMax)
    if (!fn || !Number.isFinite(tMin) || !Number.isFinite(tMax) || tMin >= tMax) return null
    return <Plot.Parametric xy={fn} domain={[tMin, tMax]} color={row.color} />
  }
  if (row.kind === 'polar') {
    const { fn } = compilePolar(row.expr, scope)
    const tMin = Number(row.tMin)
    const tMax = Number(row.tMax)
    if (!fn || !Number.isFinite(tMin) || !Number.isFinite(tMax) || tMin >= tMax) return null
    return <Plot.Parametric xy={fn} domain={[tMin, tMax]} color={row.color} />
  }
  if (row.kind === 'implicit') {
    const { fn, relop } = compileImplicit(row.expr, scope)
    if (!fn) return null
    const segments = traceImplicitCurve(fn, VIEW_BOUNDS)
    const cells = relop === '=' ? [] : sampleInequalityCells(fn, relop, VIEW_BOUNDS)
    return (
      <>
        {cells.map((c, i) => (
          <Polygon
            key={`cell-${i}`}
            points={[[c.x, c.y], [c.x + c.w, c.y], [c.x + c.w, c.y + c.h], [c.x, c.y + c.h]]}
            color={row.color}
            fillOpacity={0.15}
            strokeOpacity={0}
          />
        ))}
        {segments.map((s, i) => (
          <Line.Segment key={`seg-${i}`} point1={[s.x1, s.y1]} point2={[s.x2, s.y2]} color={row.color} />
        ))}
      </>
    )
  }
  return null
}

/** Samples a curve at N evenly spaced points across the current view, for the table of
 * values toggle. Only function/function-y rows have a natural 1-D sampling axis. */
function sampleRowForTable(row, scope, n = 9) {
  if (row.kind === 'function') {
    const [dMin, dMax] = parseDomain(row, VIEW_BOUNDS.xMin, VIEW_BOUNDS.xMax)
    const { fn } = compileFunctionOfX(row.expr, scope)
    if (!fn) return null
    const step = (dMax - dMin) / (n - 1)
    return Array.from({ length: n }, (_, i) => {
      const x = dMin + i * step
      let y
      try { y = fn(x) } catch { y = NaN }
      return { x, y }
    })
  }
  if (row.kind === 'function-y') {
    const [dMin, dMax] = parseDomain(row, VIEW_BOUNDS.yMin, VIEW_BOUNDS.yMax)
    const { fn } = compileFunctionOfY(row.expr, scope)
    if (!fn) return null
    const step = (dMax - dMin) / (n - 1)
    return Array.from({ length: n }, (_, i) => {
      const y = dMin + i * step
      let x
      try { x = fn(y) } catch { x = NaN }
      return { x, y }
    })
  }
  return null
}

/** Maps one backend AI-drafted curve (plot_schema.py's richer `kind`/`expr_y`/`domain`)
 * onto the frontend's manual row shape, so AI-populated curves render through the exact
 * same primitives manual typing uses. Returns null for curves with no matching manual
 * row kind: "piecewise" (mathjs can't parse a sympy `Piecewise(...)` string) and
 * "dataset" (no single expr — its regression fit is rendered directly from
 * `results.regression` in ResultsOverlay instead of as a row). */
function rowFromAiCurve(c) {
  if (c.kind === 'parametric') {
    const [tMin, tMax] = c.domain ?? [0, 10]
    const row = newRow(toMathjsSyntax(c.expr), 'parametric')
    row.expr2 = toMathjsSyntax(c.expr_y ?? '')
    row.tMin = String(tMin)
    row.tMax = String(tMax)
    return row
  }
  if (c.kind === 'polar') {
    const [tMin, tMax] = c.domain ?? [0, 2 * Math.PI]
    const row = newRow(toMathjsSyntax(c.expr), 'polar')
    row.tMin = String(tMin)
    row.tMax = String(tMax)
    return row
  }
  if (c.kind === 'inequality') {
    return newRow(toMathjsSyntax(c.expr), 'implicit')
  }
  if (c.kind === 'function') {
    const row = newRow(toMathjsSyntax(c.expr), 'function')
    if (c.domain) {
      row.domainMin = String(c.domain[0])
      row.domainMax = String(c.domain[1])
    }
    return row
  }
  return null
}

/** Adds any backend-proposed sliders not already present locally (matched by name) —
 * merges rather than duplicates, since a follow-up turn re-sends the full parameter list. */
function mergeAiParameters(existing, aiParameters) {
  if (!aiParameters || aiParameters.length === 0) return existing
  const existingNames = new Set(existing.map((p) => p.name))
  const additions = aiParameters
    .filter((p) => !existingNames.has(p.name))
    .map((p) => ({ id: nextParamId++, name: p.name, min: p.min, max: p.max, step: p.step ?? 0.1, value: p.value }))
  return additions.length ? [...existing, ...additions] : existing
}

/** Renders the backend's independently-verified `results` (roots, extrema, a
 * derivative-at tangent line, an integral's shaded region, a regression fit) on the
 * canvas. Purely presentational — every number here was already computed and verified
 * server-side (plot_generator.py's compute_results); this component never computes
 * anything itself. The primary curve's y-value at a point (for anchoring the tangent
 * line / shading the integral) is a plain re-evaluation of the already-accepted
 * expression, not a new correctness claim. */
function ResultsOverlay({ spec, results, scope }) {
  if (!results || !spec) return null
  const primaryCurve = spec.curves?.[0]
  const primaryExpr = primaryCurve && primaryCurve.kind === 'function' ? toMathjsSyntax(primaryCurve.expr) : null
  const { fn: primaryFn } = primaryExpr ? compileFunctionOfX(primaryExpr, scope) : { fn: null }
  const nodes = []

  for (const r of results.roots ?? []) {
    const x = Number(r)
    if (!Number.isFinite(x)) continue
    nodes.push(<Point key={`root-${r}`} x={x} y={0} color="#F87171" />)
    nodes.push(<Text key={`root-label-${r}`} x={x} y={0} attach="n">{`x=${r}`}</Text>)
  }

  for (const e of results.extrema ?? []) {
    const x = Number(e.x)
    const y = Number(e.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    nodes.push(<Point key={`ext-${e.x}`} x={x} y={y} color="#38BDF8" />)
    nodes.push(<Text key={`ext-label-${e.x}`} x={x} y={y} attach="n">{e.kind}</Text>)
  }

  if (results.derivative_at && primaryFn) {
    const x0 = Number(results.derivative_at.x)
    const slope = Number(results.derivative_at.value)
    let y0 = NaN
    try { y0 = primaryFn(x0) } catch { /* leave NaN, skip below */ }
    if (Number.isFinite(x0) && Number.isFinite(slope) && Number.isFinite(y0)) {
      nodes.push(<Point key="deriv-pt" x={x0} y={y0} color="#FAFAFA" />)
      nodes.push(<Line.PointSlope key="deriv-line" point={[x0, y0]} slope={slope} color="#FAFAFA" opacity={0.6} />)
    }
  }

  if (results.integral && primaryFn) {
    const [a, b] = results.integral.bounds
    const n = 40
    const step = (b - a) / n
    const curvePoints = []
    for (let i = 0; i <= n; i++) {
      const x = a + i * step
      let y = 0
      try { y = primaryFn(x) } catch { y = 0 }
      curvePoints.push([x, Number.isFinite(y) ? y : 0])
    }
    nodes.push(
      <Polygon key="integral-fill" points={[[a, 0], ...curvePoints, [b, 0]]} color="#8B5CF6" fillOpacity={0.25} strokeOpacity={0} />
    )
  }

  if (results.regression) {
    const datasetCurve = spec.curves?.find((c) => c.kind === 'dataset')
    const regFn = compilePolynomialFromCoefficients(results.regression.coefficients)
    nodes.push(<Plot.OfX key="regression-fit" y={regFn} color="#22C55E" />)
    for (const [x, y] of datasetCurve?.points ?? []) {
      nodes.push(<Point key={`dataset-${x}-${y}`} x={x} y={y} color="#22C55E" opacity={0.8} />)
    }
  }

  return <>{nodes}</>
}

export default function MathPlayground() {
  usePageMeta('Math Playground', { noindex: true })
  const [rows, setRows] = useState(() => [newRow('x^2')])
  const [parameters, setParameters] = useState([])
  const [prompt, setPrompt] = useState('')
  const [promptStatus, setPromptStatus] = useState({ loading: false, reason: null })
  const [showTable, setShowTable] = useState(false)
  // Last AI-accepted spec/results — kept so a follow-up NL instruction ("giờ thêm đạo
  // hàm của nó") can be sent as conversational context, and so narrate/suggest and the
  // ResultsOverlay have something to render.
  const [aiSpec, setAiSpec] = useState(null)
  const [aiResults, setAiResults] = useState(null)
  const [narrative, setNarrative] = useState({ loading: false, text: null })
  const [hint, setHint] = useState({ loading: false, text: null })

  const updateRow = (updated) => setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id))
  const addRow = () => setRows((prev) => [...prev, newRow('')])

  const updateParam = (updated) => setParameters((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  const removeParam = (id) => setParameters((prev) => prev.filter((p) => p.id !== id))
  const addParam = () => {
    const used = new Set(parameters.map((p) => p.name))
    const name = 'abcdefghijklmnopqrstuvwxyz'.split('').find((c) => !used.has(c)) || 'a'
    setParameters((prev) => [...prev, newParameter(name)])
  }

  const scope = useMemo(() => scopeFromParameters(parameters), [parameters])

  const visibleRows = rows.filter((r) => r.visible && r.expr.trim())

  const handleDescribe = async () => {
    if (!prompt.trim()) return
    setPromptStatus({ loading: true, reason: null })
    // Sending the last accepted spec as context makes this a follow-up turn (e.g. "giờ
    // thêm đạo hàm của nó") rather than a fresh request — same generate→verify→gate
    // contract backend-side either way.
    const result = await draftPlotFromPrompt(prompt, aiSpec)
    if (!result.available) {
      setPromptStatus({ loading: false, reason: result.reason ?? 'Không thể tạo đồ thị từ mô tả này.' })
      return
    }
    const aiRows = result.spec.curves.map(rowFromAiCurve).filter(Boolean)
    setRows((prev) => [...prev, ...aiRows])
    setParameters((prev) => mergeAiParameters(prev, result.spec.parameters))
    setAiSpec(result.spec)
    setAiResults(result.results ?? null)
    setNarrative({ loading: false, text: null })
    setHint({ loading: false, text: null })
    setPromptStatus({ loading: false, reason: null })
    setPrompt('')
  }

  const handleNarrate = async () => {
    if (!aiSpec) return
    setNarrative({ loading: true, text: null })
    const { text, reason } = await fetchPlotNarration('narrate', aiSpec, aiResults ?? {})
    setNarrative({ loading: false, text: text || reason || 'Không có nhận xét.' })
  }

  const handleHint = async () => {
    if (!aiSpec) return
    setHint({ loading: true, text: null })
    const { text, reason } = await fetchPlotNarration('suggest', aiSpec, aiResults ?? {})
    setHint({ loading: false, text: text || reason || 'Không có gợi ý.' })
  }

  return (
    <PageShell title="Math Playground" maxWidth="max-w-5xl">
      <div className="flex-1 flex flex-col lg:flex-row gap-6 w-full">
        <PageCard label="Danh sách biểu thức" className="lg:w-80 flex-shrink-0">
          {rows.map((row) => (
            <ExpressionRow key={row.id} row={row} onChange={updateRow} onRemove={() => removeRow(row.id)} />
          ))}
          <button onClick={addRow} className="self-start px-3 py-1.5 rounded-lg border border-border font-sans text-xs text-muted">
            + Thêm biểu thức
          </button>

          <div className="mt-2 flex flex-col gap-2 pt-4 border-t border-border">
            <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-wide text-faint">Tham số (trượt)</span>
            {parameters.map((p) => (
              <ParameterSlider key={p.id} param={p} onChange={updateParam} onRemove={() => removeParam(p.id)} />
            ))}
            <button onClick={addParam} className="self-start px-3 py-1.5 rounded-lg border border-border font-sans text-xs text-muted">
              + Thêm tham số
            </button>
          </div>

          <label className="mt-2 flex items-center gap-2 pt-4 border-t border-border font-sans text-[0.6875rem] text-faint">
            <input type="checkbox" checked={showTable} onChange={(e) => setShowTable(e.target.checked)} />
            Hiện bảng giá trị
          </label>

          <div className="mt-2 flex flex-col gap-2 pt-4 border-t border-border">
            <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-wide text-faint">Mô tả bằng lời (AI)</span>
            <p className="font-sans text-[0.6875rem] text-faint -mt-1">Ví dụ: "vẽ đồ thị giao của y=x^2 và y=2x+1"</p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Nhập mô tả bằng lời…"
              rows={2}
              className="px-3 py-2 rounded-lg border border-border bg-background font-sans text-xs resize-none"
            />
            <button
              onClick={handleDescribe}
              disabled={promptStatus.loading || !prompt.trim()}
              className="self-start px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg disabled:opacity-40"
            >
              {promptStatus.loading ? 'Đang tạo…' : 'Vẽ từ mô tả'}
            </button>
            {promptStatus.reason && (
              <p className="font-sans text-[0.6875rem] text-destructive">{promptStatus.reason}</p>
            )}
          </div>
        </PageCard>

        <div className="flex-1 flex flex-col gap-4">
          <div className="glass-elevated rounded-2xl overflow-hidden" style={{ minHeight: 420 }}>
            <Mafs viewBox={{ x: [VIEW_BOUNDS.xMin, VIEW_BOUNDS.xMax], y: [VIEW_BOUNDS.yMin, VIEW_BOUNDS.yMax] }} pan zoom>
              <Coordinates.Cartesian />
              {visibleRows.map((row) => (
                <RenderedCurve key={row.id} row={row} scope={scope} />
              ))}
              <ResultsOverlay spec={aiSpec} results={aiResults} scope={scope} />
            </Mafs>
          </div>

          {aiSpec && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleNarrate}
                disabled={narrative.loading}
                className="px-3 py-1.5 rounded-lg border border-border font-sans text-xs text-muted disabled:opacity-40"
              >
                {narrative.loading ? 'Đang giải thích…' : 'Giải thích đồ thị'}
              </button>
              <button
                onClick={handleHint}
                disabled={hint.loading}
                className="px-3 py-1.5 rounded-lg border border-border font-sans text-xs text-muted disabled:opacity-40"
              >
                {hint.loading ? 'Đang gợi ý…' : 'Gợi ý'}
              </button>
            </div>
          )}
          {narrative.text && (
            <p className="font-sans text-xs text-muted px-1">{narrative.text}</p>
          )}
          {hint.text && (
            <p className="font-sans text-xs text-faint px-1">Gợi ý: {hint.text}</p>
          )}

          {showTable && (
            <PageCard label="Bảng giá trị">
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-faint">
                      <th className="text-left pr-4 py-1">Biểu thức</th>
                      <th className="text-left pr-4 py-1">x</th>
                      <th className="text-left py-1">y</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const samples = sampleRowForTable(row, scope)
                      if (!samples) return null
                      return samples.map((s, i) => (
                        <tr key={`${row.id}-${i}`} className="border-t border-border/40">
                          {i === 0 && (
                            <td rowSpan={samples.length} className="pr-4 py-1 align-top" style={{ color: row.color }}>
                              {row.expr}
                            </td>
                          )}
                          <td className="pr-4 py-1 tabular-nums">{Number.isFinite(s.x) ? s.x.toFixed(3) : '—'}</td>
                          <td className="py-1 tabular-nums">{Number.isFinite(s.y) ? s.y.toFixed(3) : '—'}</td>
                        </tr>
                      ))
                    })}
                  </tbody>
                </table>
              </div>
            </PageCard>
          )}
        </div>
      </div>
    </PageShell>
  )
}

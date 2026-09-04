import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Mafs, Coordinates, Plot, Line, Polygon, Point, Text, Circle } from 'mafs'
import 'mafs/core.css'
import 'mathlive'
import { pageVariants } from '../utils/animations.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { describeAgentFetchError } from '../lib/agentError.js'
import {
  compileFunctionOfX, compileFunctionOfY, compileParametric, compilePolar,
  compileImplicit, compilePolynomialFromCoefficients, toMathjsSyntax,
} from '../engine/casEngine.js'
import { traceImplicitCurve, sampleInequalityCells } from '../engine/marchingSquares.js'

// /playground — "Sổ phác trắc địa" (The surveyor's sketchbook), per
// vantage/uploads/07-playground.md. Signature moment: each function draws on
// left→right over 900ms via a normalized (pathLength=1) stroke-dashoffset
// sweep on Mafs' own <path> (svgPathProps), rather than a hand-rolled canvas
// plotter — the spec explicitly forbids rewriting the graphing engine and
// Mafs (SVG) turns out to be what /playground already used, contradicting
// the spec's own "cấm chart library" framing (read as: don't add a NEW one).
//
// Deviation: the spec's "chốt trắc lượng" (survey pin) is written for a true
// two-curve *intersection*. plot_schema.py's Op literal lists "intersect"
// and "tangent_at", but plot_generator.py's compute_results() never actually
// computes either — only roots/extrema/derivative_at/integral/regression are
// populated. So the pin+chip treatment below is applied to what the backend
// really returns: roots (x-axis crossings) and extrema, which are the same
// "pinned coordinate" concept. derivative_at already covers the spec's
// separate "TIẾP TUYẾN" toggle (a dashed tangent line), so no scope was cut,
// just remapped onto real backend data.

const _API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const VIEW_BOUNDS_DEFAULT = { xMin: -12, xMax: 12, yMin: -8, yMax: 8 }
const COLOR_KEYS = ['accent', 'altitude', 'ink', 'amber']

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

/** Plain `var(--token)` strings, not resolved hex — Mafs' `color` props render straight
 * to SVG `stroke`/`fill` presentation attributes, which the browser resolves through the
 * normal CSS cascade including var(), so these repaint on a theme toggle for free with no
 * JS/getComputedStyle sync layer (and no risk of it drifting, unlike a value baked once
 * into row state). The Mafs canvas's own bg/grid/axis tokens are themed the same way, via
 * the `.playground-paper .MafsView { --mafs-bg: var(--paper); ... }` rule in index.css —
 * an ancestor's inline style can't do this because core.css sets `--mafs-bg` etc. directly
 * on `.MafsView` itself, and a value set directly on an element always wins over one
 * inherited from an ancestor, regardless of specificity. */
const COLORS = { accent: 'var(--accent)', altitude: 'var(--altitude)', ink: 'var(--ink)', ink2: 'var(--ink-2)', amber: 'var(--amber)' }

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
    visible: true,
  }
}

function newParameter(name = 'a') {
  return { id: nextParamId++, name, min: -5, max: 5, step: 0.1, value: 1 }
}

function scopeFromParameters(parameters) {
  const scope = {}
  for (const p of parameters) scope[p.name] = p.value
  return scope
}

function parseDomain(row, viewMin, viewMax) {
  const min = row.domainMin.trim() === '' ? viewMin : Number(row.domainMin)
  const max = row.domainMax.trim() === '' ? viewMax : Number(row.domainMax)
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return [viewMin, viewMax]
  return [min, max]
}

/** Never throws — mirrors casEngine's own never-throws contract, just narrowed to "does
 * this row currently compile" for the margin's error state. */
function getRowCompileError(row, scope) {
  if (!row.expr.trim()) return null
  if (row.kind === 'function') return compileFunctionOfX(row.expr, scope).error
  if (row.kind === 'function-y') return compileFunctionOfY(row.expr, scope).error
  if (row.kind === 'parametric') return row.expr2.trim() ? compileParametric(row.expr, row.expr2, scope).error : null
  if (row.kind === 'polar') return compilePolar(row.expr, scope).error
  if (row.kind === 'implicit') return compileImplicit(row.expr, scope).error
  return null
}

function IconEye({ hidden }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1 8s2.7-5 7-5 7 5 7 5-2.7 5-7 5-7-5-7-5Z" stroke="currentColor" strokeWidth="1.5" opacity={hidden ? 0.45 : 1} />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" opacity={hidden ? 0.45 : 1} />
      {hidden && <line x1="2" y1="2.5" x2="14" y2="13.5" stroke="currentColor" strokeWidth="1.5" />}
    </svg>
  )
}

function IconStrike() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <line x1="4.2" y1="11.8" x2="11.8" y2="4.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/** One "dòng lề" — a margin line, not a card: color dot, live-typeset math-field, domain
 * (or t/θ range), and the eye/strike icon pair. Hovering the row is echoed onto the
 * matching stroke on the paper via onHover/hoveredId, per spec section 3. */
function MarginRow({ row, index, colorIndex, colors, isHovered, onHover, onChange, onRemove, error }) {
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
  const color = colors[COLOR_KEYS[colorIndex % COLOR_KEYS.length]]

  const smallInput = {
    width: 44, background: 'transparent', border: 'none',
    borderBottom: '1px solid var(--line-soft)', fontFamily: 'var(--font-mono)',
    fontSize: 11, color: 'var(--ink-2)', padding: '1px 2px',
  }

  return (
    <div
      className="playground-row flex flex-col gap-1.5 py-2.5"
      style={error ? { borderLeft: '3px solid var(--accent-deep)', paddingLeft: 8, marginLeft: -8 } : undefined}
      onMouseEnter={() => onHover(row.id)}
      onMouseLeave={() => onHover(null)}
      data-hovered={isHovered || undefined}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex-shrink-0"
          style={{ width: 8, height: 8, borderRadius: '50%', background: row.visible ? color : 'var(--ink-3)', opacity: row.visible ? 1 : 0.4 }}
        />
        <select
          value={row.kind}
          onChange={(e) => onChange({ ...row, kind: e.target.value })}
          style={{ background: 'transparent', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', flexShrink: 0 }}
        >
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <div className="playground-expr-field flex-1">
          <math-field ref={fieldRef} class="playground-input" style={{ fontSize: 16, display: 'block' }} />
        </div>
        <button
          onClick={() => onChange({ ...row, visible: !row.visible })}
          className="playground-row-icon flex-shrink-0"
          aria-label={row.visible ? `Ẩn hàm số ${index + 1}` : `Hiện hàm số ${index + 1}`}
        >
          <IconEye hidden={!row.visible} />
        </button>
        <button onClick={onRemove} className="playground-row-icon flex-shrink-0" aria-label={`Xóa hàm số ${index + 1}`}>
          <IconStrike />
        </button>
      </div>

      {row.kind === 'parametric' && (
        <div className="flex items-center gap-2 pl-4" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
          <span className="flex-shrink-0">y(t) =</span>
          <div className="playground-expr-field flex-1">
            <math-field ref={field2Ref} class="playground-input" style={{ fontSize: 13, display: 'block' }} />
          </div>
        </div>
      )}

      {isRange && (
        <div className="flex items-center gap-2 pl-4" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
          <span>{row.kind === 'polar' ? 'θ ∈' : 't ∈'}</span>
          <input type="number" value={row.tMin} onChange={(e) => onChange({ ...row, tMin: e.target.value })} style={smallInput} />
          <span>–</span>
          <input type="number" value={row.tMax} onChange={(e) => onChange({ ...row, tMax: e.target.value })} style={smallInput} />
        </div>
      )}

      {isDomain && (
        <div className="flex items-center gap-2 pl-4" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
          <span>{row.kind === 'function' ? 'x' : 'y'} ∈</span>
          <input type="number" value={row.domainMin} placeholder="−∞" onChange={(e) => onChange({ ...row, domainMin: e.target.value })} style={smallInput} />
          <span>–</span>
          <input type="number" value={row.domainMax} placeholder="+∞" onChange={(e) => onChange({ ...row, domainMax: e.target.value })} style={smallInput} />
        </div>
      )}

      {error && (
        <p className="pl-4" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-deep)' }}>
          MỰC CHƯA ĐỌC ĐƯỢC — kiểm tra dấu/ngoặc
        </p>
      )}
    </div>
  )
}

function ParameterSlider({ param, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
      <input
        value={param.name}
        onChange={(e) => onChange({ ...param, name: e.target.value.trim() || param.name })}
        style={{ width: 28, background: 'transparent', border: 'none', borderBottom: '1px solid var(--line-soft)', fontFamily: 'var(--font-mono)', textAlign: 'center', color: 'var(--ink)' }}
      />
      <span style={{ color: 'var(--ink-3)' }}>=</span>
      <input
        type="range" min={param.min} max={param.max} step={param.step}
        value={param.value}
        onChange={(e) => onChange({ ...param, value: Number(e.target.value) })}
        className="flex-1"
        style={{ accentColor: 'var(--accent)' }}
      />
      <span className="tabular-nums" style={{ width: 40, textAlign: 'right', color: 'var(--ink-2)' }}>{param.value.toFixed(2)}</span>
      <button onClick={onRemove} className="playground-row-icon flex-shrink-0" aria-label={`Xóa tham số ${param.name}`}>
        <IconStrike />
      </button>
    </div>
  )
}

/** Wraps the sweep animation key so a re-typed/re-colored/re-toggled curve replays its
 * draw-on rather than freezing mid-sweep on every keystroke. */
function drawOnKey(row, color) {
  return `${row.id}-${row.expr}-${row.expr2}-${color}`
}

function RenderedCurve({ row, scope, color, weight = 2.4 }) {
  const svgPathProps = { pathLength: 1, className: 'vtg-drawon-path', strokeLinecap: 'round' }
  if (row.kind === 'function') {
    const [dMin, dMax] = parseDomain(row, VIEW_BOUNDS_DEFAULT.xMin, VIEW_BOUNDS_DEFAULT.xMax)
    const { fn } = compileFunctionOfX(row.expr, scope)
    if (!fn) return null
    return <Plot.OfX key={drawOnKey(row, color)} y={fn} color={color} weight={weight} domain={[dMin, dMax]} svgPathProps={svgPathProps} />
  }
  if (row.kind === 'function-y') {
    const [dMin, dMax] = parseDomain(row, VIEW_BOUNDS_DEFAULT.yMin, VIEW_BOUNDS_DEFAULT.yMax)
    const { fn } = compileFunctionOfY(row.expr, scope)
    if (!fn) return null
    return <Plot.OfY key={drawOnKey(row, color)} x={fn} color={color} weight={weight} domain={[dMin, dMax]} svgPathProps={svgPathProps} />
  }
  if (row.kind === 'parametric') {
    const { fn } = compileParametric(row.expr, row.expr2, scope)
    const tMin = Number(row.tMin)
    const tMax = Number(row.tMax)
    if (!fn || !Number.isFinite(tMin) || !Number.isFinite(tMax) || tMin >= tMax) return null
    return <Plot.Parametric key={drawOnKey(row, color)} xy={fn} domain={[tMin, tMax]} color={color} weight={weight} svgPathProps={svgPathProps} />
  }
  if (row.kind === 'polar') {
    const { fn } = compilePolar(row.expr, scope)
    const tMin = Number(row.tMin)
    const tMax = Number(row.tMax)
    if (!fn || !Number.isFinite(tMin) || !Number.isFinite(tMax) || tMin >= tMax) return null
    return <Plot.Parametric key={drawOnKey(row, color)} xy={fn} domain={[tMin, tMax]} color={color} weight={weight} svgPathProps={svgPathProps} />
  }
  if (row.kind === 'implicit') {
    const { fn, relop } = compileImplicit(row.expr, scope)
    if (!fn) return null
    const segments = traceImplicitCurve(fn, VIEW_BOUNDS_DEFAULT)
    const cells = relop === '=' ? [] : sampleInequalityCells(fn, relop, VIEW_BOUNDS_DEFAULT)
    return (
      <>
        {cells.map((c, i) => (
          <Polygon key={`cell-${i}`} points={[[c.x, c.y], [c.x + c.w, c.y], [c.x + c.w, c.y + c.h], [c.x, c.y + c.h]]} color={color} fillOpacity={0.15} strokeOpacity={0} />
        ))}
        {segments.map((s, i) => (
          <Line.Segment key={`seg-${i}`} point1={[s.x1, s.y1]} point2={[s.x2, s.y2]} color={color} weight={weight} />
        ))}
      </>
    )
  }
  return null
}

function sampleRowForTable(row, scope, n = 9) {
  if (row.kind === 'function') {
    const [dMin, dMax] = parseDomain(row, VIEW_BOUNDS_DEFAULT.xMin, VIEW_BOUNDS_DEFAULT.xMax)
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
    const [dMin, dMax] = parseDomain(row, VIEW_BOUNDS_DEFAULT.yMin, VIEW_BOUNDS_DEFAULT.yMax)
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

function mergeAiParameters(existing, aiParameters) {
  if (!aiParameters || aiParameters.length === 0) return existing
  const existingNames = new Set(existing.map((p) => p.name))
  const additions = aiParameters
    .filter((p) => !existingNames.has(p.name))
    .map((p) => ({ id: nextParamId++, name: p.name, min: p.min, max: p.max, step: p.step ?? 0.1, value: p.value }))
  return additions.length ? [...existing, ...additions] : existing
}

/** Restyled as pin+chip: a stroked ring, an accent dot, and a mono coordinate label with
 * the library's own paper-colored halo (`.mafs-shadow`) for legibility over ink strokes —
 * the closest real substitute for a literal background chip, since Mafs' <Text> has no
 * background-box primitive of its own. */
function ResultsOverlay({ spec, results, scope, colors }) {
  if (!results || !spec) return null
  const primaryCurve = spec.curves?.[0]
  const primaryExpr = primaryCurve && primaryCurve.kind === 'function' ? toMathjsSyntax(primaryCurve.expr) : null
  const { fn: primaryFn } = primaryExpr ? compileFunctionOfX(primaryExpr, scope) : { fn: null }
  const nodes = []
  const chipProps = { fontFamily: 'var(--font-mono)', fontWeight: 600, className: 'mafs-shadow' }

  function pushPin(key, x, y, label) {
    nodes.push(<Circle key={`${key}-ring`} center={[x, y]} radius={0.18} color={colors.ink} weight={1.5} fillOpacity={0} />)
    nodes.push(<Point key={`${key}-dot`} x={x} y={y} color={colors.accent} />)
    nodes.push(<Text key={`${key}-chip`} x={x} y={y} attach="ne" attachDistance={10} color={colors.ink} size={11} svgTextProps={chipProps}>{label}</Text>)
  }

  for (const r of results.roots ?? []) {
    const x = Number(r)
    if (!Number.isFinite(x)) continue
    pushPin(`root-${r}`, x, 0, `(${x.toFixed(2)}; 0,00)`)
  }

  for (const e of results.extrema ?? []) {
    const x = Number(e.x)
    const y = Number(e.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    pushPin(`ext-${e.x}`, x, y, `(${x.toFixed(2)}; ${y.toFixed(2)})`)
  }

  if (results.derivative_at && primaryFn) {
    const x0 = Number(results.derivative_at.x)
    const slope = Number(results.derivative_at.value)
    let y0 = NaN
    try { y0 = primaryFn(x0) } catch { /* leave NaN, skip below */ }
    if (Number.isFinite(x0) && Number.isFinite(slope) && Number.isFinite(y0)) {
      nodes.push(<Point key="deriv-pt" x={x0} y={y0} color={colors.accent} />)
      nodes.push(<Line.PointSlope key="deriv-line" point={[x0, y0]} slope={slope} color={colors.ink2} strokeStyle="dashed" weight={2} />)
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
    nodes.push(<Polygon key="integral-fill" points={[[a, 0], ...curvePoints, [b, 0]]} color={colors.altitude} fillOpacity={0.22} strokeOpacity={0} />)
  }

  if (results.regression) {
    const datasetCurve = spec.curves?.find((c) => c.kind === 'dataset')
    const regFn = compilePolynomialFromCoefficients(results.regression.coefficients)
    nodes.push(<Plot.OfX key="regression-fit" y={regFn} color={colors.altitude} weight={2} />)
    for (const [x, y] of datasetCurve?.points ?? []) {
      nodes.push(<Point key={`dataset-${x}-${y}`} x={x} y={y} color={colors.altitude} opacity={0.8} />)
    }
  }

  return <>{nodes}</>
}

export default function MathPlayground() {
  usePageMeta('Sổ phác trắc địa', { description: 'Math Playground — gõ hàm, xem nét mực tự vẽ, chốt giao điểm và tiếp tuyến.' })
  const [rows, setRows] = useState(() => [newRow('x^2/8 - 2'), newRow('sin(x)*1.5')])
  const [parameters, setParameters] = useState([])
  const [prompt, setPrompt] = useState('')
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptStatus, setPromptStatus] = useState({ loading: false, reason: null })
  const [showTable, setShowTable] = useState(false)
  const [hoveredId, setHoveredId] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [viewKey, setViewKey] = useState(0)
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
  const allEmpty = rows.every((r) => !r.expr.trim())
  // Color cycles by current position in the list (not a module-level creation counter,
  // which drifts under StrictMode's deliberate double-invocation of lazy state
  // initializers) — accent/altitude/ink/amber repeating every 4 rows.
  const colorIndexById = useMemo(() => {
    const map = new Map()
    rows.forEach((r, i) => map.set(r.id, i % COLOR_KEYS.length))
    return map
  }, [rows])
  const rowErrors = useMemo(() => {
    const map = new Map()
    for (const r of rows) map.set(r.id, getRowCompileError(r, scope))
    return map
  }, [rows, scope])

  const handleDescribe = async () => {
    if (!prompt.trim()) return
    setPromptStatus({ loading: true, reason: null })
    const result = await draftPlotFromPrompt(prompt, aiSpec)
    if (!result.available) {
      setPromptStatus({ loading: false, reason: result.reason ?? 'Không thể phác từ mô tả này.' })
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

  const ariaDescription = visibleRows.length
    ? `Đang vẽ ${visibleRows.length} hàm số${aiResults?.roots?.length ? `; ${aiResults.roots.length} nghiệm được ghim` : ''}.`
    : 'Giấy trống — chưa có hàm nào được vẽ.'

  const sidebarBody = (
    <>
      <div>
        {rows.map((row, i) => (
          <MarginRow
            key={row.id}
            row={row}
            index={i}
            colorIndex={colorIndexById.get(row.id)}
            colors={COLORS}
            isHovered={hoveredId === row.id}
            onHover={setHoveredId}
            onChange={updateRow}
            onRemove={() => removeRow(row.id)}
            error={rowErrors.get(row.id)}
          />
        ))}
      </div>
      <button
        onClick={addRow}
        className="self-start"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.06em', color: 'var(--ink-2)', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--line-soft)', width: '100%', textAlign: 'left' }}
      >
        + VẼ NÉT NÀY
      </button>
      {rows.length > 4 && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', marginTop: 6 }}>
          HẾT MỰC MÀU — DÙNG LẠI CHU TRÌNH MỰC
        </p>
      )}

      <div className="flex flex-col gap-2" style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.08em', color: 'var(--ink-3)' }}>THAM SỐ (TRƯỢT)</span>
        {parameters.map((p) => (
          <ParameterSlider key={p.id} param={p} onChange={updateParam} onRemove={() => removeParam(p.id)} />
        ))}
        <button onClick={addParam} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', alignSelf: 'flex-start' }}>+ Thêm tham số</button>
      </div>

      <label className="flex items-center gap-2" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line-soft)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
        <input type="checkbox" checked={showTable} onChange={(e) => setShowTable(e.target.checked)} />
        Hiện bảng giá trị
      </label>

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
        <button
          onClick={() => setPromptOpen((v) => !v)}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.08em', color: 'var(--ink-3)', width: '100%', textAlign: 'left' }}
        >
          PHÁC THEO LỜI {promptOpen ? '▾' : '▸'}
        </button>
        {promptOpen && (
          <div className="flex flex-col gap-2" style={{ marginTop: 8 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>vd: "vẽ giao của y=x^2 và y=2x+1"</p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Nhập mô tả bằng lời…"
              rows={2}
              style={{ background: 'transparent', border: '1px solid var(--line-soft)', borderRadius: 'var(--r-sm)', padding: 8, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)', resize: 'none' }}
            />
            <button
              onClick={handleDescribe}
              disabled={promptStatus.loading || !prompt.trim()}
              style={{ alignSelf: 'flex-start', fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.05em', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '6px 12px', opacity: promptStatus.loading || !prompt.trim() ? 0.4 : 1 }}
            >
              {promptStatus.loading ? 'ĐANG PHÁC…' : 'PHÁC ▲'}
            </button>
            {promptStatus.reason && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-deep)' }}>{promptStatus.reason}</p>}
          </div>
        )}
      </div>
    </>
  )

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit" className="relative z-[1] min-h-screen">
      <div className="max-w-6xl mx-auto w-full px-6 sm:px-10 pt-8 pb-20 flex flex-col gap-6">
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 8 }}>
            TRẠM · DỤNG CỤ · D·04
          </div>
          <h1 className="font-display font-bold" style={{ fontSize: 39, color: 'var(--ink)' }}>Sổ phác trắc địa.</h1>
          <p style={{ color: 'var(--ink-2)', maxWidth: '60ch', marginTop: 8 }}>
            Gõ hàm, xem nét mực tự vẽ. Giao điểm được ghim chốt, tọa độ ghi như sổ đo.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-[2] flex flex-col gap-3 min-w-0">
            <div className="playground-paper relative" style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden', minHeight: 420, background: 'var(--paper)' }}>
              <button
                onClick={() => setViewKey((k) => k + 1)}
                style={{
                  position: 'absolute', top: 10, right: 10, zIndex: 2,
                  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.06em', color: 'var(--ink-2)',
                  background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '4px 8px',
                }}
              >
                KHUNG GỐC
              </button>
              <Mafs key={viewKey} viewBox={{ x: [VIEW_BOUNDS_DEFAULT.xMin, VIEW_BOUNDS_DEFAULT.xMax], y: [VIEW_BOUNDS_DEFAULT.yMin, VIEW_BOUNDS_DEFAULT.yMax] }} pan zoom>
                <Coordinates.Cartesian xAxis={{ lines: 2 }} yAxis={{ lines: 2 }} subdivisions={4} />
                {allEmpty && (
                  <>
                    <Plot.OfX y={(x) => x * x / 8 - 2} color={COLORS.ink} weight={2} strokeOpacity={0.25} />
                    <Text x={0} y={7.3} attach="s" color={COLORS.ink} size={10.5}>NÉT MẪU — GÕ HÀM ĐỂ THAY</Text>
                  </>
                )}
                {visibleRows.map((row) => (
                  <RenderedCurve
                    key={row.id}
                    row={row}
                    scope={scope}
                    color={COLORS[COLOR_KEYS[colorIndexById.get(row.id) % COLOR_KEYS.length]]}
                    weight={hoveredId === row.id ? 3.2 : 2.4}
                  />
                ))}
                <ResultsOverlay spec={aiSpec} results={aiResults} scope={scope} colors={COLORS} />
              </Mafs>
            </div>
            <p aria-live="polite" className="sr-only">{ariaDescription}</p>

            {aiSpec && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleNarrate}
                  disabled={narrative.loading}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '5px 10px', opacity: narrative.loading ? 0.4 : 1 }}
                >
                  {narrative.loading ? 'ĐANG GIẢI THÍCH…' : 'GIẢI THÍCH ĐỒ THỊ'}
                </button>
                <button
                  onClick={handleHint}
                  disabled={hint.loading}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '5px 10px', opacity: hint.loading ? 0.4 : 1 }}
                >
                  {hint.loading ? 'ĐANG GỢI Ý…' : 'GỢI Ý'}
                </button>
              </div>
            )}
            {narrative.text && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--ink-2)' }}>{narrative.text}</p>}
            {hint.text && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--ink-3)' }}>Gợi ý: {hint.text}</p>}

            {showTable && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 16, background: 'var(--paper)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.08em', color: 'var(--ink-3)' }}>BẢNG GIÁ TRỊ</span>
                <div className="overflow-x-auto" style={{ marginTop: 8 }}>
                  <table className="w-full tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: 'var(--ink-3)' }}>
                        <th className="text-left pr-4 py-1">Biểu thức</th>
                        <th className="text-left pr-4 py-1">x</th>
                        <th className="text-left py-1">y</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => {
                        const samples = sampleRowForTable(row, scope)
                        if (!samples) return null
                        const color = COLORS[COLOR_KEYS[colorIndexById.get(row.id) % COLOR_KEYS.length]]
                        return samples.map((s, i) => (
                          <tr key={`${row.id}-${i}`} style={{ borderTop: '1px solid var(--line-soft)' }}>
                            {i === 0 && (
                              <td rowSpan={samples.length} className="pr-4 py-1 align-top" style={{ color }}>{row.expr}</td>
                            )}
                            <td className="pr-4 py-1">{Number.isFinite(s.x) ? s.x.toFixed(3) : '—'}</td>
                            <td className="py-1">{Number.isFinite(s.y) ? s.y.toFixed(3) : '—'}</td>
                          </tr>
                        ))
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Lề sổ tay — bottom sheet on mobile, fixed column on desktop */}
          <aside className="hidden lg:flex lg:w-80 flex-shrink-0 flex-col" style={{ borderLeft: '1px solid var(--line-soft)', paddingLeft: 20 }}>
            {sidebarBody}
          </aside>

          <div className="lg:hidden">
            <button
              onClick={() => setSheetOpen(true)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.06em', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '8px 14px', width: '100%' }}
            >
              LỀ SỔ TAY ({rows.length} HÀM) ▴
            </button>
            {sheetOpen && (
              <div
                role="dialog" aria-label="Lề sổ tay"
                style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,.35)' }}
                onClick={(e) => { if (e.target === e.currentTarget) setSheetOpen(false) }}
              >
                <div
                  style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '75dvh', overflowY: 'auto',
                    background: 'var(--paper)', borderTop: '1px solid var(--line)', borderRadius: '16px 16px 0 0',
                    padding: '16px 20px 24px',
                  }}
                >
                  <button
                    onClick={() => setSheetOpen(false)}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginBottom: 8 }}
                  >
                    ĐÓNG ▾
                  </button>
                  {sidebarBody}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

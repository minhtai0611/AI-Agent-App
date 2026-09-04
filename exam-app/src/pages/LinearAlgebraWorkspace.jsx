import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { pageVariants } from '../utils/animations.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { describeAgentFetchError } from '../lib/agentError.js'
import LinalgTerrain from '../components/motion/LinalgTerrain.jsx'

// /linalg — "Ma trận là địa hình", per vantage/uploads/05-dai-so-tuyen-tinh.md.
// North-star: a matrix isn't a table of numbers to read, it's a terrain to see —
// cell values become grid-node elevation via the same camera/mesh engine as the
// landing hero (src/lib/terrain3d.js, cloned per spec, not rewritten/re-libraried).
//
// Deviation from the spec (flagged, not silently applied): its placeholder rail
// list ("CỘNG · TRỪ · NHÂN · LŨY THỪA · CHUYỂN VỊ · NGHỊCH ĐẢO · ĐỊNH THỨC · HẠNG ·
// RREF · EIGEN/SVD") is wrong — TRỪ/subtract, LŨY THỪA/power and CHUYỂN VỊ/transpose
// don't exist in the backend. The real operation set (backend/app/agent/
// linalg_schema.py's Operation Literal, 12 ops) is used instead.
//
// Integrity note on the eigen-axes visualization: the spec asks for "two principal
// axes" on EIGEN/SVD results. The `eigen` endpoint used to return only eigenVALUES
// (sympy's `.eigenvals()`), never eigenvectors, so there was no real direction data
// to draw. The backend now also computes real (sympy-verified, Av = λv) eigenvectors
// for the 2x2 case — see linalg_solver.py's `eigen_vectors` — so `eigen` draws
// principal axes from those, same as `svd` draws them from its V matrix's columns.
// For matrices larger than 2x2 the backend still omits `vectors` (no 2D axis to draw),
// and the frontend falls back to values-only in the PHIẾU SỐ LIỆU ticket.

const _API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const MESH_MAX = 6
const CLAMP = 3

async function runLinAlg(body) {
  try {
    const res = await fetch(`${_API_BASE}/agent/linalg`, {
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

function emptyGrid(rows, cols) {
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (r === c ? 1 : 0)))
}
function clampVal(v) { return Math.max(-CLAMP, Math.min(CLAMP, v)) }
function clampGrid(g) { return g.map(row => row.map(clampVal)) }

// Backend numbers arrive as strings (sympy exact rationals, e.g. "1/2", "-14/3").
function parseFrac(s) {
  if (typeof s === 'number') return s
  if (typeof s !== 'string') return NaN
  if (s.includes('/')) {
    const [n, d] = s.split('/').map(Number)
    return n / d
  }
  return Number(s)
}
function isMatrixResult(v) {
  return Array.isArray(v) && Array.isArray(v[0])
}
function matrixToGrid(m) {
  return m.map(row => row.map(v => clampVal(parseFrac(v))))
}

const OPERATIONS = [
  { op: 'add', rail: 'CỘNG', n: 2, advanced: false },
  { op: 'multiply', rail: 'NHÂN', n: 2, advanced: false },
  { op: 'determinant', rail: 'ĐỊNH THỨC', n: 1, advanced: false },
  { op: 'inverse', rail: 'NGHỊCH ĐẢO', n: 1, advanced: false },
  { op: 'rank', rail: 'HẠNG', n: 1, advanced: false },
  { op: 'rref', rail: 'RREF', n: 1, advanced: false },
  { op: 'solve_system', rail: 'GIẢI HỆ', n: 1, advanced: false },
  { op: 'lu', rail: 'PHÂN TÍCH LU', n: 1, advanced: false },
  { op: 'qr', rail: 'PHÂN TÍCH QR', n: 1, advanced: false },
  { op: 'cholesky', rail: 'PHÂN TÍCH CHOLESKY', n: 1, advanced: false },
  // Eigen (2x2) is a first-class rail item per the mockup's left-rail list — not
  // gated behind "advanced" like SVD (which the mockup doesn't list at all).
  { op: 'eigen', rail: 'EIGEN (2×2)', n: 1, advanced: false },
  { op: 'svd', rail: 'SVD', n: 1, advanced: true },
]

function MatrixGrid({ matrix, onChange, invalidCell, label }) {
  const rows = matrix.length, cols = matrix[0].length
  return (
    <div className="flex flex-col gap-1">
      {label && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>{label}</span>}
      <div className="flex items-stretch gap-1.5">
        <svg width="10" viewBox="0 0 10 100" preserveAspectRatio="none" style={{ height: rows * 40, flexShrink: 0 }} aria-hidden="true">
          <path d="M9,2 L2,2 L2,98 L9,98" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
        </svg>
        <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 44px)` }}>
          {matrix.map((row, r) => row.map((val, c) => {
            const bad = invalidCell && invalidCell.r === r && invalidCell.c === c
            return (
              <input
                key={`${r}-${c}`}
                type="text"
                inputMode="decimal"
                value={val}
                aria-label={`hàng ${r + 1} cột ${c + 1}`}
                onChange={e => {
                  const next = matrix.map(rr => [...rr])
                  next[r][c] = e.target.value
                  onChange(next, r, c)
                }}
                className="text-center outline-none"
                style={{
                  width: 44, height: 36, fontFamily: 'var(--font-mono)', fontSize: 15,
                  color: 'var(--ink)', background: 'var(--paper)',
                  border: bad ? '1px solid var(--accent-deep)' : '1px solid var(--line-soft)',
                  borderRadius: 'var(--r-sm)',
                }}
                onFocus={e => { e.target.style.border = '2px solid var(--accent)' }}
                onBlur={e => { e.target.style.border = bad ? '1px solid var(--accent-deep)' : '1px solid var(--line-soft)' }}
              />
            )
          }))}
        </div>
        <svg width="10" viewBox="0 0 10 100" preserveAspectRatio="none" style={{ height: rows * 40, flexShrink: 0 }} aria-hidden="true">
          <path d="M1,2 L8,2 L8,98 L1,98" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  )
}

function GridSizeButtons({ onRow, onCol, disabled }) {
  const btn = { fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '3px 7px', background: 'var(--paper)' }
  return (
    <div className="flex gap-1.5 flex-wrap">
      <button type="button" disabled={disabled} onClick={() => onRow(1)} style={btn}>+ HÀNG</button>
      <button type="button" disabled={disabled} onClick={() => onRow(-1)} style={btn}>− HÀNG</button>
      <button type="button" disabled={disabled} onClick={() => onCol(1)} style={btn}>+ CỘT</button>
      <button type="button" disabled={disabled} onClick={() => onCol(-1)} style={btn}>− CỘT</button>
    </div>
  )
}

function ticketRow(label, value) {
  return (
    <div key={label} className="flex items-baseline justify-between gap-4">
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

export default function LinearAlgebraWorkspace() {
  usePageMeta('Đại số tuyến tính', { noindex: true })
  const [advanced, setAdvanced] = useState(false)
  const [op, setOp] = useState('determinant')
  const [matrixA, setMatrixA] = useState(emptyGrid(3, 3))
  const [matrixB, setMatrixB] = useState(emptyGrid(3, 3))
  const [invalidCell, setInvalidCell] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [terrainGrid, setTerrainGrid] = useState(clampGrid(numericGrid(matrixA)))
  const [flatCollapse, setFlatCollapse] = useState(false)
  const [axes, setAxes] = useState(null)
  const debounceRef = useRef(null)

  const spec = OPERATIONS.find(o => o.op === op) ?? OPERATIONS[2]
  const rows = matrixA.length, cols = matrixA[0].length
  const overMesh = rows > MESH_MAX || cols > MESH_MAX

  function numericGridSafe(m) {
    return m.map(row => row.map(v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }))
  }

  // Live typing morph: input matrix A drives the terrain until an operation result
  // takes over below (debounce 150ms per spec; the lerp-toward-target itself lives
  // in LinalgTerrain.jsx's own rAF loop).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setTerrainGrid(clampGrid(numericGridSafe(matrixA)))
      setFlatCollapse(false)
      setAxes(null)
    }, 150)
    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrixA])

  function onCellChange(setter) {
    return (next, r, c) => {
      setter(next)
      setResult(null)
      const raw = next[r][c]
      if (raw.trim() !== '' && raw.trim() !== '-' && Number.isNaN(parseFloat(raw))) {
        setInvalidCell({ r, c })
      } else if (invalidCell?.r === r && invalidCell?.c === c) {
        setInvalidCell(null)
      }
    }
  }

  function resizeRows(delta) {
    setMatrixA(m => {
      if (delta > 0) return [...m, Array.from({ length: m[0].length }, () => 0)]
      return m.length > 1 ? m.slice(0, -1) : m
    })
    setMatrixB(m => {
      if (delta > 0) return [...m, Array.from({ length: m[0].length }, () => 0)]
      return m.length > 1 ? m.slice(0, -1) : m
    })
  }
  function resizeCols(delta) {
    setMatrixA(m => {
      if (delta > 0) return m.map(row => [...row, 0])
      return m[0].length > 1 ? m.map(row => row.slice(0, -1)) : m
    })
    setMatrixB(m => {
      if (delta > 0) return m.map(row => [...row, 0])
      return m[0].length > 1 ? m.map(row => row.slice(0, -1)) : m
    })
  }

  async function handleRun() {
    if (invalidCell) return
    setLoading(true)
    setResult(null)
    const matrices = spec.n === 2 ? [numericGridSafe(matrixA), numericGridSafe(matrixB)] : [numericGridSafe(matrixA)]
    const res = await runLinAlg({ operation: spec.op, matrices })
    setResult(res)
    setLoading(false)
    applyResultToTerrain(res)
  }

  function applyResultToTerrain(res) {
    if (!res?.available) return
    if (isMatrixResult(res.result)) {
      setTerrainGrid(matrixToGrid(res.result))
      setFlatCollapse(false)
      setAxes(null)
      return
    }
    if (spec.op === 'determinant') {
      const v = parseFrac(res.result)
      const near0 = Number.isFinite(v) && Math.abs(v) < 1e-9
      setFlatCollapse(near0)
      setTerrainGrid(near0 ? emptyGrid(rows, cols).map(r => r.map(() => 0)) : clampGrid(numericGridSafe(matrixA)))
      setAxes(null)
      return
    }
    if (spec.op === 'eigen' && res.vectors && Object.keys(res.vectors).length) {
      // Real eigenvectors for the 2x2 case (backend's eigen_vectors, verified via
      // Av = λv) — draw them as principal axes, same overlay contract as SVD below.
      const entries = Object.entries(res.vectors)
      const vec1 = entries[0]?.[1]?.map(parseFrac)
      const vec2 = entries[1]?.[1]?.map(parseFrac)
      setAxes({
        v1: vec1 ? { x: vec1[0] ?? 1, z: vec1[1] ?? 0 } : null,
        v2: vec2 ? { x: vec2[0] ?? 0, z: vec2[1] ?? 1 } : null,
        label1: `λ₁=${fmt(entries[0]?.[0])}`,
        label2: entries[1] ? `λ₂=${fmt(entries[1][0])}` : undefined,
      })
      setFlatCollapse(false)
      setTerrainGrid(clampGrid(numericGridSafe(matrixA)))
      return
    }
    if (spec.op === 'svd' && res.result?.V) {
      const V = res.result.V.map(row => row.map(parseFrac))
      const S = (res.result.S ?? []).map(parseFrac)
      const col = (m, i) => m.map(r => r[i] ?? 0)
      const v1 = col(V, 0), v2 = col(V, 1)
      setAxes({
        v1: { x: v1[0] ?? 1, z: v1[1] ?? 0 },
        v2: v2.length ? { x: v2[0] ?? 0, z: v2[1] ?? 1 } : null,
        label1: `σ₁=${(S[0] ?? 0).toFixed(2)}`,
        label2: S[1] !== undefined ? `σ₂=${S[1].toFixed(2)}` : undefined,
      })
      setFlatCollapse(false)
      // no single "result matrix" for a decomposition — terrain keeps showing A
      setTerrainGrid(clampGrid(numericGridSafe(matrixA)))
      return
    }
    // rank, eigen (values only, no vectors to draw — see integrity note above),
    // lu/qr/cholesky (dict of factor matrices, no single canonical "result terrain"):
    // terrain keeps representing the input matrix A.
    setFlatCollapse(false)
    setAxes(null)
    setTerrainGrid(clampGrid(numericGridSafe(matrixA)))
  }

  const ticket = useMemo(() => buildTicket(op, result), [op, result])

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit" className="relative z-[1] min-h-screen">
      <div className="max-w-6xl mx-auto w-full px-6 sm:px-10 pt-8 pb-20 flex flex-col gap-6">
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--accent)' }}>
            TRẠM · DỤNG CỤ · D·03
          </div>
          <h1 className="font-display font-bold" style={{ fontSize: 39, color: 'var(--ink)' }}>Ma trận là địa hình.</h1>
          <p style={{ fontFamily: 'var(--font-sans, inherit)', fontSize: 14.5, color: 'var(--ink-2)', maxWidth: '62ch', marginTop: 6 }}>
            Nhập một ma trận, nhìn nó dựng thành sườn núi. Mỗi phép toán là một cách xới địa hình.
          </p>
        </div>

        <div className="grid gap-8" style={{ gridTemplateColumns: 'minmax(0,380px) 1fr' }}>
          {/* Left: input */}
          <div className="flex flex-col gap-4" style={{ minWidth: 0 }}>
            <MatrixGrid matrix={matrixA} onChange={onCellChange(setMatrixA)} invalidCell={invalidCell} label={spec.n === 2 ? 'MA TRẬN A' : null} />
            <GridSizeButtons onRow={resizeRows} onCol={resizeCols} disabled={loading} />

            {invalidCell && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-deep)' }}>
                Ô [{invalidCell.r + 1},{invalidCell.c + 1}] CHƯA LÀ SỐ
              </p>
            )}

            <motion.div
              initial={false}
              animate={{ height: spec.n === 2 ? 'auto' : 0, opacity: spec.n === 2 ? 1 : 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: 'hidden' }}
            >
              {spec.n === 2 && <MatrixGrid matrix={matrixB} onChange={onCellChange(setMatrixB)} label="MA TRẬN B" />}
            </motion.div>

            <div className="flex flex-col gap-1 pt-2" style={{ borderTop: '1px solid var(--line-soft)' }} role="tablist" aria-label="Phép toán">
              {OPERATIONS.filter(o => advanced || !o.advanced).map(o => (
                <button
                  key={o.op}
                  role="tab"
                  aria-selected={op === o.op}
                  onClick={() => { setOp(o.op); setResult(null) }}
                  className="text-left"
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13, padding: '5px 2px',
                    color: op === o.op ? 'var(--ink)' : 'var(--ink-2)',
                    fontWeight: op === o.op ? 600 : 400,
                    borderBottom: op === o.op ? '2px solid var(--accent)' : '2px solid transparent',
                    width: 'fit-content', background: 'transparent',
                  }}
                >
                  {o.rail}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
              <input type="checkbox" checked={advanced} onChange={e => setAdvanced(e.target.checked)} />
              HIỂN THỊ NÂNG CAO (SVD)
            </label>

            <button
              onClick={handleRun}
              disabled={loading || !!invalidCell}
              className="self-start font-bold transition-colors"
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 12.5, letterSpacing: '0.03em',
                padding: '10px 18px', background: 'var(--accent)', color: 'var(--paper)',
                border: '1px solid var(--accent)', borderRadius: 'var(--r-sm)',
                opacity: (loading || invalidCell) ? 0.5 : 1,
              }}
            >
              {loading ? 'ĐANG XỚI…' : 'XỚI ĐỊA HÌNH ▲'}
            </button>

            {result && !result.available && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-deep)' }}>
                {looksSingular(result.reason)
                  ? 'PHÉP XỚI NÀY KHÔNG XÁC ĐỊNH — det = 0'
                  : (result.reason ?? 'Không thể tính.')}
              </p>
            )}
          </div>

          {/* Right: terrain + numeric ticket */}
          <div className="flex flex-col gap-3" style={{ minWidth: 0 }}>
            <div className="relative">
              <span
                className="absolute top-2.5 left-3 z-10"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}
              >
                CAO ĐỘ = GIÁ TRỊ Ô · GRID {rows}×{cols}
              </span>
              {overMesh ? (
                <div
                  className="flex items-center justify-center text-center"
                  style={{
                    aspectRatio: '4 / 3', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)',
                    background: 'var(--paper-2)', padding: 24,
                  }}
                >
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)', maxWidth: 320 }}>
                    ĐỊA HÌNH CHỈ VẼ TỚI 6×6 — PHÉP ĐO LỚN HƠN ĐỌC Ở PHIẾU SỐ
                  </p>
                </div>
              ) : (
                <>
                  <LinalgTerrain grid={terrainGrid} flatCollapse={flatCollapse} axes={axes} />
                  {flatCollapse && (
                    <span
                      className="absolute z-10"
                      style={{
                        left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
                        fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)',
                        background: 'var(--paper)', border: '1px solid var(--accent)', borderRadius: 'var(--r-sm)',
                        padding: '6px 12px', whiteSpace: 'nowrap',
                      }}
                    >
                      ĐỊA HÌNH SỤP PHẲNG — det ≈ 0
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col gap-1.5 p-4" style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--paper)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>PHIẾU SỐ LIỆU</span>
              {ticket.length === 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>Nhấn XỚI ĐỊA HÌNH để xem số liệu.</span>
              )}
              {ticket.map(([k, v]) => ticketRow(k, v))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function numericGrid(m) {
  return m.map(row => row.map(v => (typeof v === 'number' ? v : parseFloat(v) || 0)))
}

function looksSingular(reason) {
  return typeof reason === 'string' && /singular|no unique solution|det.*0/i.test(reason)
}

function fmt(v) {
  const n = parseFrac(v)
  return Number.isFinite(n) ? n.toFixed(3) : String(v)
}

function buildTicket(op, result) {
  if (!result?.available) return []
  const r = result.result
  if (op === 'determinant') return [['det', fmt(r)]]
  if (op === 'rank') return [['hạng', String(r)]]
  if (op === 'eigen') return Object.entries(r).map(([val, mult]) => [`λ (bội ${mult})`, fmt(val)])
  if (isMatrixResult(r)) {
    return r.map((row, i) => [`hàng ${i + 1}`, row.map(fmt).join('  ')])
  }
  if (r && typeof r === 'object') {
    return Object.entries(r).flatMap(([key, val]) => {
      if (isMatrixResult(val)) return val.map((row, i) => [`${key}[${i + 1}]`, row.map(fmt).join('  ')])
      if (Array.isArray(val)) return [[key, val.map(fmt).join('  ')]]
      return [[key, fmt(val)]]
    })
  }
  return [['kết quả', String(r)]]
}

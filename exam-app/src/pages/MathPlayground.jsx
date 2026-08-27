import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mafs, Coordinates, Plot } from 'mafs'
import 'mafs/core.css'
import 'mathlive'
import { pageVariants } from '../utils/animations.js'
import { compileFunctionOfX, toMathjsSyntax } from '../engine/casEngine.js'
import { usePageMeta } from '../hooks/usePageMeta.js'

const _API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const COLORS = ['#F0A93E', '#6366F1', '#059669', '#DC2626', '#0EA5E9']

async function draftPlotFromPrompt(promptText) {
  try {
    const res = await fetch(`${_API_BASE}/agent/plot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt_text: promptText }),
    })
    if (!res.ok) return { available: false, reason: `HTTP ${res.status}` }
    return await res.json()
  } catch (err) {
    return { available: false, reason: err.message }
  }
}

let nextRowId = 1

function newRow(expr = '') {
  return { id: nextRowId++, expr, color: COLORS[(nextRowId - 1) % COLORS.length], visible: true }
}

function ExpressionRow({ row, onChange, onRemove }) {
  const fieldRef = useRef(null)

  useEffect(() => {
    const el = fieldRef.current
    if (!el) return
    if (el.getValue('ascii-math') !== row.expr) el.setValue(row.expr)
    const onInput = () => onChange({ ...row, expr: el.getValue('ascii-math') })
    el.addEventListener('input', onInput)
    return () => el.removeEventListener('input', onInput)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id])

  return (
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
      <math-field ref={fieldRef} className="flex-1 text-base px-2 py-1.5 rounded-lg border border-border bg-surface" />
      <button onClick={onRemove} className="text-faint hover:text-destructive text-sm flex-shrink-0">✕</button>
    </div>
  )
}

export default function MathPlayground() {
  usePageMeta('Math Playground', { noindex: true })
  const navigate = useNavigate()
  const [rows, setRows] = useState(() => [newRow('x^2')])
  const [prompt, setPrompt] = useState('')
  const [promptStatus, setPromptStatus] = useState({ loading: false, reason: null })

  const updateRow = (updated) => setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id))
  const addRow = () => setRows((prev) => [...prev, newRow('')])

  const handleDescribe = async () => {
    if (!prompt.trim()) return
    setPromptStatus({ loading: true, reason: null })
    const result = await draftPlotFromPrompt(prompt)
    if (!result.available) {
      setPromptStatus({ loading: false, reason: result.reason ?? 'Không thể tạo đồ thị từ mô tả này.' })
      return
    }
    // AI-populated curves converge on the exact same row state manual typing uses —
    // no special-cased "AI curve" rendering path.
    const aiRows = result.spec.curves.map((c) => newRow(toMathjsSyntax(c.expr)))
    setRows((prev) => [...prev, ...aiRows])
    setPromptStatus({ loading: false, reason: null })
    setPrompt('')
  }

  return (
    <motion.div
      className="min-h-screen bg-background flex flex-col"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >
      <header className="flex items-center justify-between px-10 py-4 border-b border-border">
        <button onClick={() => navigate(-1)} className="font-sans text-sm text-dim hover:text-muted transition">
          ← Quay lại
        </button>
        <h1 className="font-sans text-[20px] font-bold text-foreground">Math Playground</h1>
        <div className="w-16" />
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 sm:p-10 max-w-5xl mx-auto w-full">
        <div className="flex flex-col gap-3 lg:w-72 flex-shrink-0">
          <span className="font-sans text-[0.6875rem] text-faint">Danh sách biểu thức</span>
          {rows.map((row) => (
            <ExpressionRow key={row.id} row={row} onChange={updateRow} onRemove={() => removeRow(row.id)} />
          ))}
          <button onClick={addRow} className="self-start px-3 py-1.5 rounded-lg border border-border font-sans text-xs text-muted">
            + Thêm biểu thức
          </button>

          <div className="mt-4 flex flex-col gap-2 pt-4 border-t border-border">
            <span className="font-sans text-[0.6875rem] text-faint">Mô tả bằng lời (AI)</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="vẽ đồ thị giao của y=x^2 và y=2x+1"
              rows={2}
              className="px-3 py-2 rounded-lg border border-border bg-surface font-sans text-xs resize-none"
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
        </div>

        <div className="flex-1 bg-surface border border-border rounded-2xl overflow-hidden" style={{ minHeight: 420 }}>
          <Mafs viewBox={{ x: [-10, 10], y: [-10, 10] }}>
            <Coordinates.Cartesian />
            {rows
              .filter((r) => r.visible && r.expr.trim())
              .map((r) => {
                const { fn } = compileFunctionOfX(r.expr)
                if (!fn) return null
                return <Plot.OfX key={r.id} y={fn} color={r.color} />
              })}
          </Mafs>
        </div>
      </div>
    </motion.div>
  )
}

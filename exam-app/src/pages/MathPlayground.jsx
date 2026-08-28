import { useEffect, useRef, useState } from 'react'
import { Mafs, Coordinates, Plot } from 'mafs'
import 'mafs/core.css'
import 'mathlive'
import PageShell, { PageCard } from '../components/PageShell.jsx'
import { compileFunctionOfX, toMathjsSyntax } from '../engine/casEngine.js'
import { usePageMeta } from '../hooks/usePageMeta.js'

const _API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const COLORS = ['#8B5CF6', '#FAFAFA', '#22C55E', '#F87171', '#38BDF8']

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
      <math-field ref={fieldRef} className="flex-1 text-base px-2 py-1.5 rounded-lg border border-border bg-background" />
      <button onClick={onRemove} className="text-faint hover:text-destructive text-sm flex-shrink-0">✕</button>
    </div>
  )
}

export default function MathPlayground() {
  usePageMeta('Math Playground', { noindex: true })
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
    <PageShell title="Math Playground" maxWidth="max-w-5xl">
      <div className="flex-1 flex flex-col lg:flex-row gap-6 w-full">
        <PageCard label="Danh sách biểu thức" className="lg:w-72 flex-shrink-0">
          {rows.map((row) => (
            <ExpressionRow key={row.id} row={row} onChange={updateRow} onRemove={() => removeRow(row.id)} />
          ))}
          <button onClick={addRow} className="self-start px-3 py-1.5 rounded-lg border border-border font-sans text-xs text-muted">
            + Thêm biểu thức
          </button>

          <div className="mt-2 flex flex-col gap-2 pt-4 border-t border-border">
            <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-wide text-faint">Mô tả bằng lời (AI)</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="vẽ đồ thị giao của y=x^2 và y=2x+1"
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

        <div className="flex-1 glass-elevated rounded-2xl overflow-hidden" style={{ minHeight: 420 }}>
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
    </PageShell>
  )
}

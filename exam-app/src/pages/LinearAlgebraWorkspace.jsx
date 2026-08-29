import { useState } from 'react'
import PageShell, { PageCard } from '../components/PageShell.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { describeAgentFetchError } from '../lib/agentError.js'

const _API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

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
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0))
}

function MatrixGrid({ matrix, onChange, label }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-sans text-[0.6875rem] text-faint">{label}</span>
      <div className="inline-flex flex-col gap-1 p-2 rounded-lg border border-border bg-background">
        {matrix.map((row, r) => (
          <div key={r} className="flex gap-1">
            {row.map((val, c) => (
              <input
                key={c}
                type="number"
                value={val}
                onChange={(e) => {
                  const next = matrix.map((rr) => [...rr])
                  next[r][c] = parseFloat(e.target.value) || 0
                  onChange(next)
                }}
                className="w-14 h-9 text-center rounded-md border border-border bg-surface font-mono text-sm focus:border-primary outline-none"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

const OPERATIONS = [
  { op: 'determinant', label: 'Định thức', n: 1 },
  { op: 'inverse', label: 'Ma trận nghịch đảo', n: 1 },
  { op: 'rank', label: 'Hạng', n: 1 },
  { op: 'rref', label: 'Rút gọn hàng (RREF)', n: 1 },
  { op: 'solve_system', label: 'Giải hệ (ma trận mở rộng)', n: 1 },
  { op: 'add', label: 'Cộng hai ma trận', n: 2 },
  { op: 'multiply', label: 'Nhân hai ma trận', n: 2 },
  { op: 'lu', label: 'Phân tích LU', n: 1 },
  { op: 'qr', label: 'Phân tích QR', n: 1 },
  { op: 'cholesky', label: 'Phân tích Cholesky', n: 1 },
]

const ADVANCED_OPERATIONS = [
  { op: 'eigen', label: 'Giá trị riêng', n: 1 },
  { op: 'svd', label: 'Phân tích SVD', n: 1 },
]

export default function LinearAlgebraWorkspace() {
  usePageMeta('Đại số tuyến tính', { noindex: true })
  const [advanced, setAdvanced] = useState(false)
  const [op, setOp] = useState('determinant')
  const [matrixA, setMatrixA] = useState(emptyGrid(2, 2))
  const [matrixB, setMatrixB] = useState(emptyGrid(2, 2))
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const spec = OPERATIONS.find((o) => o.op === op) ?? ADVANCED_OPERATIONS.find((o) => o.op === op) ?? ADVANCED_OPERATIONS[0]

  const handleRun = async () => {
    setLoading(true)
    const matrices = spec.n === 2 ? [matrixA, matrixB] : [matrixA]
    const res = await runLinAlg({ operation: spec.op, matrices })
    setResult(res)
    setLoading(false)
  }

  return (
    <PageShell title="Đại số tuyến tính" maxWidth="max-w-4xl">
      <PageCard label="Phép toán">
        <div className="flex flex-wrap gap-2">
          {OPERATIONS.map((o) => (
            <button
              key={o.op}
              onClick={() => { setOp(o.op); setResult(null) }}
              className={`px-3.5 py-2 rounded-lg font-sans text-xs border transition ${op === o.op ? 'bg-primary text-primary-fg border-primary' : 'bg-background text-muted border-border'}`}
            >
              {o.label}
            </button>
          ))}
          {advanced && ADVANCED_OPERATIONS.map((o) => (
            <button
              key={o.op}
              onClick={() => { setOp(o.op); setResult(null) }}
              className={`px-3.5 py-2 rounded-lg font-sans text-xs border transition ${op === o.op ? 'bg-primary text-primary-fg border-primary' : 'bg-background text-muted border-border'}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 font-sans text-xs text-dim">
          <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
          Hiển thị chức năng nâng cao (giá trị riêng, SVD)
        </label>
      </PageCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PageCard label="Ma trận đầu vào">
          <div className="flex flex-wrap gap-6">
            <MatrixGrid matrix={matrixA} onChange={setMatrixA} label="Ma trận A" />
            {spec.n === 2 && <MatrixGrid matrix={matrixB} onChange={setMatrixB} label="Ma trận B" />}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setMatrixA((m) => m.map((row) => [...row, 0]))}
              className="px-3 py-1.5 rounded-lg border border-border font-sans text-xs text-muted"
            >
              + Cột
            </button>
            <button
              onClick={() => setMatrixA((m) => [...m, Array.from({ length: m[0]?.length ?? 1 }, () => 0)])}
              className="px-3 py-1.5 rounded-lg border border-border font-sans text-xs text-muted"
            >
              + Hàng
            </button>
          </div>

          <button
            onClick={handleRun}
            disabled={loading}
            className="self-start px-5 py-2.5 rounded-lg font-sans text-sm font-bold bg-primary text-primary-fg disabled:opacity-40"
          >
            {loading ? 'Đang tính…' : 'Tính'}
          </button>
        </PageCard>

        <PageCard label="Kết quả">
          {!result && (
            <p className="font-sans text-sm text-faint">Nhập ma trận và nhấn "Tính" để xem kết quả.</p>
          )}
          {result && !result.available && (
            <p className="font-sans text-sm text-destructive">{result.reason ?? 'Không thể tính.'}</p>
          )}
          {result?.available && (
            <>
              {result.result && typeof result.result === 'object' && !Array.isArray(result.result) ? (
                <div className="flex flex-col gap-2">
                  {Object.entries(result.result).map(([key, value]) => (
                    <div key={key}>
                      <span className="font-sans text-[0.6875rem] text-faint">{key}</span>
                      <pre className="font-mono text-sm text-primary whitespace-pre-wrap">
                        {Array.isArray(value) ? JSON.stringify(value, null, 2) : String(value)}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="font-mono text-lg text-primary whitespace-pre-wrap">
                  {typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2)}
                </pre>
              )}
              {result.steps?.length > 0 && (
                <div className="flex flex-col gap-1 pt-2 border-t border-border">
                  <span className="font-sans text-[0.6875rem] text-faint">Các bước biến đổi hàng</span>
                  {result.steps.map((s, i) => (
                    <p key={i} className="font-mono text-xs text-muted">{s}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </PageCard>
      </div>
    </PageShell>
  )
}

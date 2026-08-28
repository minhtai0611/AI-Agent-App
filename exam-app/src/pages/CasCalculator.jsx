import { useEffect, useRef, useState } from 'react'
import 'mathlive'
import PageShell, { PageCard } from '../components/PageShell.jsx'
import { evaluateExpression } from '../engine/casEngine.js'
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

export default function CasCalculator() {
  usePageMeta('Máy tính CAS', { noindex: true })
  const fieldRef = useRef(null)
  const [asciiMath, setAsciiMath] = useState('')
  const [live, setLive] = useState({ value: null, error: null })
  const [checked, setChecked] = useState(null) // backend "kiểm tra" result, or null if not yet requested

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
    </PageShell>
  )
}

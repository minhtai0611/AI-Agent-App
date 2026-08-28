import { useState, useEffect } from 'react'
import PageShell, { PageCard } from '../../components/PageShell.jsx'
import { usePageMeta } from '../../hooks/usePageMeta.js'
import { fetchContentLedger } from '../../api/org.js'

function formatDate(iso) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_LABELS = { verified: 'Đã xác minh', rejected: 'Bị từ chối' }

export default function ContentLedger() {
  usePageMeta('Nhật ký nội dung AI', { noindex: true })
  const [ledger, setLedger] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchContentLedger().then(setLedger).catch(() => setError('Không tải được nhật ký nội dung AI.'))
  }, [])

  return (
    <PageShell title="Nhật ký nội dung AI" maxWidth="max-w-3xl">
      <p className="font-sans text-[13px] text-dim -mt-2">
        Toàn bộ nội dung do AI sinh ra đã qua vòng generate→verify→gate (backend/app/agent/orchestrator.py),
        trên mọi tổ chức — bảng này không lọc theo org.
      </p>

      {error && <p className="font-sans text-[13px] text-destructive">{error}</p>}
      {!error && ledger === null && <p className="font-sans text-[13px] text-dim">Đang tải…</p>}

      {ledger && (
        <div className="flex items-center gap-3">
          <PageCard className="flex-1">
            <span className="font-sans text-[11px] text-dim">Đã xác minh</span>
            <span className="font-display text-[22px] font-bold text-foreground">{ledger.verified_count}</span>
          </PageCard>
          <PageCard className="flex-1">
            <span className="font-sans text-[11px] text-dim">Bị từ chối</span>
            <span className="font-display text-[22px] font-bold text-foreground">{ledger.rejected_count}</span>
          </PageCard>
        </div>
      )}

      <PageCard label="Mục gần đây">
        {ledger?.entries.length === 0 && (
          <p className="font-sans text-[13px] text-dim">Chưa có mục nào.</p>
        )}
        {(ledger?.entries ?? []).map(e => (
          <div key={e.content_hash} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-border bg-background">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-md font-sans text-[10px] font-bold uppercase tracking-wide border ${
                  e.status === 'verified'
                    ? 'bg-primary-subtle text-primary border-primary-border'
                    : 'bg-surface-elevated text-dim border-border'
                }`}
              >
                {STATUS_LABELS[e.status] ?? e.status}
              </span>
              <span className="font-sans text-[13px] text-foreground">{e.topic ?? '—'}</span>
              <span className="font-sans text-[11px] text-dim">{e.difficulty ?? ''}</span>
            </div>
            <span className="font-sans text-[11px] text-dim">{formatDate(e.verified_at)}</span>
          </div>
        ))}
      </PageCard>
    </PageShell>
  )
}

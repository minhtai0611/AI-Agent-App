import { useState, useEffect } from 'react'
import PageShell, { PageCard } from '../../components/PageShell.jsx'
import { usePageMeta } from '../../hooks/usePageMeta.js'
import { fetchAuditLog } from '../../api/org.js'

function formatDate(iso) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function OrgAuditLog() {
  usePageMeta('Nhật ký hoạt động', { noindex: true })
  const [log, setLog] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAuditLog().then(setLog).catch(() => setError('Không tải được nhật ký hoạt động.'))
  }, [])

  return (
    <PageShell title="Nhật ký hoạt động" maxWidth="max-w-3xl">
      <p className="font-sans text-[13px] text-dim -mt-2">Hành động quản trị trong ứng dụng — sự kiện SSO/SCIM nằm ở WorkOS.</p>

      {error && <p className="font-sans text-[13px] text-destructive">{error}</p>}
      {!error && log === null && <p className="font-sans text-[13px] text-dim">Đang tải…</p>}

      <PageCard label="Hành động trong ứng dụng">
        {(log?.local ?? []).length === 0 && log !== null && (
          <p className="font-sans text-[13px] text-dim">Chưa có hoạt động nào.</p>
        )}
        {(log?.local ?? []).map(entry => (
          <div key={entry.id} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-border bg-background">
            <span className="font-sans text-[13px] text-foreground">{entry.action}</span>
            <span className="font-sans text-[11px] text-dim">{formatDate(entry.created_at)}</span>
          </div>
        ))}
      </PageCard>
    </PageShell>
  )
}

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { pageVariants } from '../../utils/animations.js'
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
    <motion.div
      className="min-h-screen bg-surface flex flex-col relative overflow-hidden"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >
      <div className="max-w-3xl mx-auto w-full px-4 py-10 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans text-[20px] font-semibold text-foreground">Nhật ký hoạt động</h1>
          <p className="font-sans text-[13px] text-dim">Hành động quản trị trong ứng dụng — sự kiện SSO/SCIM nằm ở WorkOS.</p>
        </div>

        {error && <p className="font-sans text-[13px] text-[var(--destructive)]">{error}</p>}
        {!error && log === null && <p className="font-sans text-[13px] text-dim">Đang tải…</p>}

        <div className="flex flex-col gap-1">
          <h2 className="font-sans text-[13px] font-semibold text-foreground uppercase tracking-wide">Hành động trong ứng dụng</h2>
          {(log?.local ?? []).length === 0 && log !== null && (
            <p className="font-sans text-[13px] text-dim">Chưa có hoạt động nào.</p>
          )}
          <div className="flex flex-col gap-2 mt-1">
            {(log?.local ?? []).map(entry => (
              <div key={entry.id} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]">
                <span className="font-sans text-[13px] text-foreground">{entry.action}</span>
                <span className="font-sans text-[11px] text-dim">{formatDate(entry.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

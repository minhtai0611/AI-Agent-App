import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { pageVariants } from '../../utils/animations.js'
import { usePageMeta } from '../../hooks/usePageMeta.js'
import { fetchOrgSettings, updateOrgSettings, updateBranding } from '../../api/org.js'
import { useOrgAuth } from '../../context/OrgAuthContext.jsx'

export default function OrgSettings() {
  usePageMeta('Cài đặt tổ chức', { noindex: true })
  const { branding } = useOrgAuth() ?? {}
  const [name, setName] = useState('')
  const [primaryColor, setPrimaryColor] = useState(branding?.branding_primary_color ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchOrgSettings().then(s => setName(s.name)).catch(() => setError('Không tải được cài đặt.'))
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaved(false)
    await updateOrgSettings({ name })
    if (primaryColor) await updateBranding({ primaryColor })
    setSaved(true)
  }

  return (
    <motion.div
      className="min-h-screen bg-surface flex flex-col relative overflow-hidden"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >
      <div className="max-w-3xl mx-auto w-full px-4 py-10 flex flex-col gap-6">
        <h1 className="font-sans text-[20px] font-semibold text-foreground">Cài đặt tổ chức</h1>

        {error && <p className="font-sans text-[13px] text-[var(--destructive)]">{error}</p>}

        <form onSubmit={handleSave} className="flex flex-col gap-3 max-w-sm">
          <label className="flex flex-col gap-1.5">
            <span className="font-sans text-[12px] font-medium text-dim">Tên tổ chức</span>
            <input
              value={name} onChange={e => setName(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-sans text-[13px] text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-sans text-[12px] font-medium text-dim">Màu thương hiệu chính</span>
            <input
              type="color" value={primaryColor || '#000000'} onChange={e => setPrimaryColor(e.target.value)}
              className="h-9 w-16 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
            />
          </label>
          {branding?.support_tier && (
            <span className="self-start px-2 py-1 rounded-md font-sans text-[11px] font-semibold uppercase tracking-wide bg-[var(--primary-subtle)] text-[var(--primary)]">
              Gói hỗ trợ: {branding.support_tier}
            </span>
          )}
          <button type="submit" className="self-start px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg">Lưu</button>
          {saved && <span className="font-sans text-[12px] text-[var(--primary)]">Đã lưu.</span>}
        </form>
      </div>
    </motion.div>
  )
}

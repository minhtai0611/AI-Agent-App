import { useState, useEffect } from 'react'
import PageShell, { PageCard } from '../../components/PageShell.jsx'
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
    <PageShell title="Cài đặt tổ chức" maxWidth="max-w-3xl">
      {error && <p className="font-sans text-[13px] text-destructive">{error}</p>}

      <PageCard className="max-w-sm">
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-sans text-[12px] font-medium text-dim">Tên tổ chức</span>
            <input
              value={name} onChange={e => setName(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-background font-sans text-[13px] text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-sans text-[12px] font-medium text-dim">Màu thương hiệu chính</span>
            <input
              type="color" value={primaryColor || '#000000'} onChange={e => setPrimaryColor(e.target.value)}
              className="h-9 w-16 rounded-lg border border-border bg-background"
            />
          </label>
          {branding?.support_tier && (
            <span className="self-start px-2 py-1 rounded-md font-sans text-[11px] font-semibold uppercase tracking-wide bg-primary-subtle text-primary">
              Gói hỗ trợ: {branding.support_tier}
            </span>
          )}
          <button type="submit" className="self-start px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg">Lưu</button>
          {saved && <span className="font-sans text-[12px] text-primary">Đã lưu.</span>}
        </form>
      </PageCard>
    </PageShell>
  )
}

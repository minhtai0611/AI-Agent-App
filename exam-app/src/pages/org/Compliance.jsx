import { useState, useEffect } from 'react'
import PageShell, { PageCard } from '../../components/PageShell.jsx'
import { usePageMeta } from '../../hooks/usePageMeta.js'
import { getComplianceExport } from '../../api/org.js'

export default function Compliance() {
  usePageMeta('Tuân thủ & bảo mật dữ liệu', { noindex: true })
  const [data, setData] = useState(null)

  useEffect(() => {
    getComplianceExport().then(setData).catch(() => setData(null))
  }, [])

  function handleDownload() {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'compliance-export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PageShell title="Tuân thủ & bảo mật dữ liệu" maxWidth="max-w-3xl">
      <PageCard>
        <p className="font-sans text-[13px] text-dim">Xuất bằng chứng tuân thủ — nhật ký hoạt động và cấu hình lưu trữ hiện tại.</p>
        <button
          onClick={handleDownload} disabled={!data}
          className="self-start px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg disabled:opacity-50"
        >
          Tải xuống bằng chứng
        </button>
      </PageCard>
    </PageShell>
  )
}

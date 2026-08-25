import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { pageVariants } from '../../utils/animations.js'
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
    <motion.div
      className="min-h-screen bg-surface flex flex-col relative overflow-hidden"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >
      <div className="max-w-3xl mx-auto w-full px-4 py-10 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans text-[20px] font-semibold text-foreground">Tuân thủ & bảo mật dữ liệu</h1>
          <p className="font-sans text-[13px] text-dim">Xuất bằng chứng tuân thủ — nhật ký hoạt động và cấu hình lưu trữ hiện tại.</p>
        </div>
        <button
          onClick={handleDownload} disabled={!data}
          className="self-start px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg disabled:opacity-50"
        >
          Tải xuống bằng chứng
        </button>
      </div>
    </motion.div>
  )
}

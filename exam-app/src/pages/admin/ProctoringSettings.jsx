import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { pageVariants } from '../../utils/animations.js'
import { usePageMeta } from '../../hooks/usePageMeta.js'
import { getProctoringSettings, updateProctoringSettings } from '../../api/org.js'

const TIERS = [
  { value: 'none', label: 'Không giám sát' },
  { value: 'ai_review', label: 'AI tự động rà soát' },
  { value: 'identity_plus_ai', label: 'Xác minh danh tính + AI' },
  { value: 'human_escalation', label: 'Giám sát viên trực tiếp' },
]

export default function ProctoringSettings() {
  usePageMeta('Cài đặt giám sát thi', { noindex: true })
  const [tier, setTier] = useState('none')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getProctoringSettings().then(s => setTier(s.tier_enabled)).catch(() => {})
  }, [])

  async function handleChange(value) {
    setTier(value)
    setSaved(false)
    await updateProctoringSettings(value)
    setSaved(true)
  }

  return (
    <motion.div
      className="min-h-screen bg-surface flex flex-col relative overflow-hidden"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >
      <div className="max-w-2xl mx-auto w-full px-4 py-10 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans text-[20px] font-semibold text-foreground">Giám sát thi (AI proctoring)</h1>
          <p className="font-sans text-[13px] text-dim">
            Mức giám sát cao nhất tổ chức cho phép — mức thực tế áp dụng cho mỗi bài thi còn phụ thuộc vào độ khó/tính chất kỳ thi.
            Đây là bản khung: chưa kết nối nhà cung cấp giám sát thực tế.
          </p>
        </div>

        <div className="flex flex-col gap-2 max-w-sm">
          {TIERS.map(t => (
            <button
              key={t.value}
              onClick={() => handleChange(t.value)}
              className="text-left px-4 py-3 rounded-xl border font-sans text-[13px] font-medium transition"
              style={{
                background: tier === t.value ? 'var(--primary-subtle)' : 'var(--surface-elevated)',
                borderColor: tier === t.value ? 'var(--primary-border)' : 'var(--border)',
                color: tier === t.value ? 'var(--primary)' : 'var(--foreground)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {saved && <span className="font-sans text-[12px] text-[var(--primary)]">Đã lưu.</span>}
      </div>
    </motion.div>
  )
}

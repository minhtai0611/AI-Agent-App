import { useState, useEffect } from 'react'
import PageShell, { PageCard } from '../../components/PageShell.jsx'
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
    <PageShell title="Giám sát thi (AI proctoring)">
      <p className="font-sans text-[13px] text-dim -mt-2">
        Mức giám sát cao nhất tổ chức cho phép — mức thực tế áp dụng cho mỗi bài thi còn phụ thuộc vào độ khó/tính chất kỳ thi.
        Đây là bản khung: chưa kết nối nhà cung cấp giám sát thực tế.
      </p>

      <PageCard className="max-w-sm">
        <div className="flex flex-col gap-2">
          {TIERS.map(t => (
            <button
              key={t.value}
              onClick={() => handleChange(t.value)}
              className={`text-left px-4 py-3 rounded-xl border font-sans text-[13px] font-medium transition ${
                tier === t.value
                  ? 'bg-primary-subtle border-primary-border text-primary'
                  : 'bg-surface-elevated border-border text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {saved && <span className="font-sans text-[12px] text-primary">Đã lưu.</span>}
      </PageCard>
    </PageShell>
  )
}

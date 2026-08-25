import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { pageVariants } from '../../utils/animations.js'
import { usePageMeta } from '../../hooks/usePageMeta.js'
import { getPsychometricFlags, dismissPsychometricFlag } from '../../api/org.js'

const FLAG_LABELS = {
  low_discrimination: 'Độ phân biệt thấp',
  difficulty_drift: 'Độ khó thay đổi bất thường',
  leak_suspected: 'Nghi ngờ rò rỉ đề',
  distractor_dead: 'Phương án nhiễu không hiệu quả',
}

export default function PsychometricFlags() {
  usePageMeta('Cảnh báo chất lượng câu hỏi', { noindex: true })
  const [flags, setFlags] = useState(null)

  const reload = () => getPsychometricFlags('open').then(setFlags).catch(() => setFlags([]))
  useEffect(() => { reload() }, [])

  return (
    <motion.div
      className="min-h-screen bg-surface flex flex-col relative overflow-hidden"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >
      <div className="max-w-2xl mx-auto w-full px-4 py-10 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans text-[20px] font-semibold text-foreground">Cảnh báo chất lượng câu hỏi</h1>
          <p className="font-sans text-[13px] text-dim">Phát hiện tự động từ số liệu trả lời — không thay thế việc kiểm duyệt đáp án.</p>
        </div>

        {flags === null && <p className="font-sans text-[13px] text-dim">Đang tải…</p>}
        {flags !== null && flags.length === 0 && <p className="font-sans text-[13px] text-dim">Không có cảnh báo nào.</p>}

        <div className="flex flex-col gap-2">
          {(flags ?? []).map(f => (
            <div key={f.id} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] flex-wrap">
              <div className="flex flex-col">
                <span className="font-sans text-[13px] font-medium text-foreground">{FLAG_LABELS[f.flag_type] ?? f.flag_type}</span>
                <span className="font-sans text-[11px] text-dim">{f.detail}</span>
              </div>
              <button
                onClick={() => dismissPsychometricFlag(f.id).then(reload)}
                className="px-3 py-1.5 rounded-lg font-sans text-[11px] font-medium border border-[var(--border)] text-dim"
              >
                Bỏ qua
              </button>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

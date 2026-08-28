import { useState, useEffect } from 'react'
import PageShell, { PageCard } from '../../components/PageShell.jsx'
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
    <PageShell title="Cảnh báo chất lượng câu hỏi" maxWidth="max-w-3xl">
      <p className="font-sans text-[13px] text-dim -mt-2">Phát hiện tự động từ số liệu trả lời — không thay thế việc kiểm duyệt đáp án.</p>

      {flags === null && <p className="font-sans text-[13px] text-dim">Đang tải…</p>}
      {flags !== null && flags.length === 0 && <p className="font-sans text-[13px] text-dim">Không có cảnh báo nào.</p>}

      <div className="flex flex-col gap-2">
        {(flags ?? []).map(f => (
          <PageCard key={f.id}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex flex-col">
                <span className="font-sans text-[13px] font-medium text-foreground">{FLAG_LABELS[f.flag_type] ?? f.flag_type}</span>
                <span className="font-sans text-[11px] text-dim">{f.detail}</span>
              </div>
              <button
                onClick={() => dismissPsychometricFlag(f.id).then(reload)}
                className="px-3 py-1.5 rounded-lg font-sans text-[11px] font-medium border border-border text-dim"
              >
                Bỏ qua
              </button>
            </div>
          </PageCard>
        ))}
      </div>
    </PageShell>
  )
}

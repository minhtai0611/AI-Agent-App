import { useState, useEffect } from 'react'
import PageShell, { PageCard } from '../../components/PageShell.jsx'
import { usePageMeta } from '../../hooks/usePageMeta.js'
import { getFlaggedProctoringSessions, reviewProctoringSession } from '../../api/org.js'

const EVENT_LABELS = {
  tab_switch: 'Chuyển tab',
  devtools_open: 'Mở DevTools',
}

export default function ProctoringReview() {
  usePageMeta('Phiên thi bị gắn cờ', { noindex: true })
  const [sessions, setSessions] = useState(null)

  const reload = () => getFlaggedProctoringSessions('flagged').then(setSessions).catch(() => setSessions([]))
  useEffect(() => { reload() }, [])

  return (
    <PageShell title="Phiên thi bị gắn cờ" maxWidth="max-w-3xl">
      <p className="font-sans text-[13px] text-dim -mt-2">
        Tín hiệu giám sát mức cao (chuyển tab nhiều lần, mở DevTools) trong lúc thi — chưa có xác minh danh tính/camera thực tế, chỉ là tín hiệu tham khảo.
      </p>

      {sessions === null && <p className="font-sans text-[13px] text-dim">Đang tải…</p>}
      {sessions !== null && sessions.length === 0 && <p className="font-sans text-[13px] text-dim">Không có phiên nào bị gắn cờ.</p>}

      <div className="flex flex-col gap-3">
        {(sessions ?? []).map(s => (
          <PageCard key={s.id}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-sans text-[13px] font-medium text-foreground">Bài thi: {s.exam_attempt_id ?? '—'}</span>
              <span className="font-sans text-[11px] text-dim">Mức: {s.tier} · {s.created_at}</span>
            </div>
            <div className="flex flex-col gap-1">
              {(s.flags_json ?? []).map((f, i) => (
                <span key={i} className="font-sans text-[12px] text-dim">
                  • {EVENT_LABELS[f.type] ?? f.type} {f.severity ? `(${f.severity})` : ''}
                </span>
              ))}
            </div>
            <button
              onClick={() => reviewProctoringSession(s.id).then(reload)}
              className="self-start mt-1 px-3 py-1.5 rounded-lg font-sans text-[11px] font-medium border border-border text-dim"
            >
              Đã xem xét
            </button>
          </PageCard>
        ))}
      </div>
    </PageShell>
  )
}

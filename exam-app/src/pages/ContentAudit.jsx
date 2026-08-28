import { useState, useEffect } from 'react'
import PageShell, { PageCard } from '../components/PageShell.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { MathText } from '../components/MathText.jsx'
import { loadContentReports } from '../api/index.js'

const LABELS = ['A', 'B', 'C', 'D']
const KIND_LABELS = {
  render: 'Hiển thị lỗi',
  answer_key: 'Đáp án có vẻ sai',
  ambiguous: 'Câu hỏi không rõ nghĩa',
  other: 'Khác',
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// A row an AI audit auto-filed carries this prefix (see backend/app/main.py's
// agent_audit route) — everything else came from a student via ReportIssueButton.
function isAiFlagged(note) {
  return typeof note === 'string' && note.startsWith('AI audit:')
}

export default function ContentAudit() {
  usePageMeta('Kiểm duyệt nội dung', { noindex: true })
  const [reports, setReports] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // all | ai | student

  useEffect(() => {
    loadContentReports('answer_key')
      .then(setReports)
      .catch(() => setError('Không tải được danh sách báo cáo — kiểm tra backend.'))
  }, [])

  const visible = (reports ?? []).filter(r => {
    if (filter === 'ai') return isAiFlagged(r.note)
    if (filter === 'student') return !isAiFlagged(r.note)
    return true
  })

  return (
    <PageShell title="Kiểm duyệt đáp án" maxWidth="max-w-3xl">
      <p className="font-sans text-[13px] text-dim -mt-2">
        Báo cáo "đáp án có vẻ sai" — từ học sinh hoặc từ audit AI (backend/app/agent/auditor.py)
        đối chiếu độc lập bằng sympy. Không tự sửa đáp án — chỉ để rà soát.
      </p>

      <div className="flex items-center gap-2">
        {[['all', 'Tất cả'], ['ai', 'AI phát hiện'], ['student', 'Học sinh báo']].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 rounded-lg font-sans text-[12px] font-medium border transition ${
              filter === value
                ? 'bg-primary text-primary-fg border-primary'
                : 'bg-surface-elevated border-border text-dim'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="font-sans text-[13px] text-destructive">{error}</p>
      )}

      {!error && reports === null && (
        <p className="font-sans text-[13px] text-dim">Đang tải…</p>
      )}

      {!error && reports !== null && visible.length === 0 && (
        <p className="font-sans text-[13px] text-dim">Không có báo cáo nào.</p>
      )}

      <div className="flex flex-col gap-3">
        {visible.map(r => {
          const flaggedByAi = isAiFlagged(r.note)
          return (
            <PageCard key={r.id}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md font-sans text-[10px] font-bold uppercase tracking-wide border ${
                      flaggedByAi
                        ? 'bg-primary-subtle text-primary border-primary-border'
                        : 'bg-surface-elevated text-dim border-border'
                    }`}
                  >
                    {flaggedByAi ? 'AI phát hiện' : 'Học sinh báo'}
                  </span>
                  <span className="font-sans text-[11px] text-dim">{KIND_LABELS[r.kind] ?? r.kind}</span>
                </div>
                <span className="font-sans text-[11px] text-dim">{formatDate(r.reportedAt)}</span>
              </div>

              <MathText className="font-sans text-[14px] font-medium text-foreground">
                {r.question}
              </MathText>

              <div className="flex flex-col gap-1.5">
                {r.choices.map((choice, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${
                      i === r.correct ? 'bg-primary-subtle border-primary-border' : 'bg-background border-border'
                    }`}
                  >
                    <span className="font-sans text-[11px] font-bold text-dim w-4">{LABELS[i]}</span>
                    <MathText className="font-sans text-[13px] text-foreground">{choice}</MathText>
                    {i === r.correct && (
                      <span className="ml-auto font-sans text-[10px] font-semibold text-primary">Đáp án lưu trữ</span>
                    )}
                  </div>
                ))}
              </div>

              {r.note && (
                <p className="font-sans text-[12px] text-dim leading-relaxed">
                  {r.note}
                </p>
              )}

              <span className="font-sans text-[11px] text-dim">Mã câu hỏi: {r.questionId}</span>
            </PageCard>
          )
        })}
      </div>
    </PageShell>
  )
}

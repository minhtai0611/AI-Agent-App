import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { pageVariants } from '../utils/animations.js'
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
    <motion.div
      className="min-h-screen bg-surface flex flex-col relative overflow-hidden"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >
      <div className="max-w-3xl mx-auto w-full px-4 py-10 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans text-[20px] font-semibold text-foreground">Kiểm duyệt đáp án</h1>
          <p className="font-sans text-[13px] text-dim">
            Báo cáo "đáp án có vẻ sai" — từ học sinh hoặc từ audit AI (backend/app/agent/auditor.py)
            đối chiếu độc lập bằng sympy. Không tự sửa đáp án — chỉ để rà soát.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {[['all', 'Tất cả'], ['ai', 'AI phát hiện'], ['student', 'Học sinh báo']].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className="px-3 py-1.5 rounded-lg font-sans text-[12px] font-medium border transition"
              style={{
                background: filter === value ? 'var(--accent)' : 'var(--surface)',
                color: filter === value ? 'var(--accent-fg)' : 'var(--fg-secondary)',
                borderColor: filter === value ? 'var(--accent)' : 'var(--border)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <p className="font-sans text-[13px] text-[var(--destructive)]">{error}</p>
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
              <div key={r.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded-md font-sans text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        background: flaggedByAi ? 'var(--primary-subtle)' : 'var(--surface)',
                        color: flaggedByAi ? 'var(--primary)' : 'var(--fg-secondary)',
                        border: `1px solid ${flaggedByAi ? 'var(--primary-border)' : 'var(--border)'}`,
                      }}
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
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                      style={{
                        background: i === r.correct ? 'var(--primary-subtle)' : 'var(--surface)',
                        border: `1px solid ${i === r.correct ? 'var(--primary-border)' : 'var(--border)'}`,
                      }}
                    >
                      <span className="font-sans text-[11px] font-bold text-dim w-4">{LABELS[i]}</span>
                      <MathText className="font-sans text-[13px] text-foreground">{choice}</MathText>
                      {i === r.correct && (
                        <span className="ml-auto font-sans text-[10px] font-semibold text-[var(--primary)]">Đáp án lưu trữ</span>
                      )}
                    </div>
                  ))}
                </div>

                {r.note && (
                  <p className="font-sans text-[12px] text-[var(--fg-secondary)] leading-relaxed">
                    {r.note}
                  </p>
                )}

                <span className="font-sans text-[11px] text-dim">Mã câu hỏi: {r.questionId}</span>
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}

import { useState } from 'react'
import { reportQuestion } from '../api/index.js'

const KIND_LABELS = {
  render: 'Hiển thị lỗi (LaTeX/hình ảnh)',
  answer_key: 'Đáp án có vẻ sai',
  ambiguous: 'Câu hỏi không rõ nghĩa',
  other: 'Khác',
}

// Content-issue reporting (Phase 2 of the Ascent Roadmap) — flags a problem with the
// content itself, not a survey about how the student is learning.
export function ReportIssueButton({ questionId }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('render')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error

  async function submit() {
    setStatus('sending')
    try {
      await reportQuestion(questionId, kind, note || undefined)
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start flex items-center gap-2 px-3 py-1.5 rounded-lg font-sans text-[11px] text-[var(--fg-tertiary)] hover:text-[var(--foreground)] transition"
      >
        <span>⚑</span> Báo lỗi câu hỏi
      </button>
    )
  }

  if (status === 'sent') {
    return (
      <p className="font-sans text-[12px] text-[var(--success)] px-1">
        Đã gửi báo cáo — cảm ơn bạn.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]">
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value)}
        className="font-sans text-[12px] px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
      >
        {Object.entries(KIND_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Mô tả ngắn (không bắt buộc)"
        rows={2}
        className="font-sans text-[12px] px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] resize-none"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={status === 'sending'}
          className="px-3 py-1.5 rounded-lg font-sans text-[12px] font-semibold text-[var(--accent-fg)] bg-[var(--accent)] disabled:opacity-50"
        >
          {status === 'sending' ? 'Đang gửi…' : 'Gửi báo cáo'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 rounded-lg font-sans text-[12px] text-[var(--fg-tertiary)]"
        >
          Hủy
        </button>
        {status === 'error' && (
          <span className="font-sans text-[11px] text-[var(--destructive)]">Gửi thất bại, thử lại sau.</span>
        )}
      </div>
    </div>
  )
}

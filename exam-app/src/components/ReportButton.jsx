import { useState, useRef, useEffect } from 'react'
import { reportQuestion } from '../api/aiClient.js'

const PRESET_REASONS = ['Sai đáp án', 'Câu hỏi không rõ', 'Lỗi hiển thị', 'Khác']

export default function ReportButton({ questionId, topic }) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [otherText, setOtherText] = useState('')
  const [showOther, setShowOther] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function onContainerBlur(e) {
    // Close when focus moves outside the container entirely
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget)) {
      setOpen(false)
    }
  }

  async function submit(reason) {
    const finalReason = reason === 'Khác' ? `Khác: ${otherText.trim()}` : reason
    if (!finalReason.trim()) return
    setSending(true)
    await reportQuestion(questionId, finalReason)
    setSending(false)
    setSent(true)
    setTimeout(() => { setSent(false); setOpen(false); setShowOther(false); setOtherText('') }, 2500)
  }

  if (sent) {
    return (
      <p className="font-jakarta text-[0.6875rem] text-success mt-2">
        Đã gửi báo cáo{topic ? <> về <strong>{topic}</strong></> : ''} — cảm ơn!
      </p>
    )
  }

  return (
    <div className="relative mt-2" ref={containerRef} onBlur={onContainerBlur}>
      <button
        onClick={() => setOpen(v => !v)}
        className="font-jakarta text-[0.6875rem] text-faint hover:text-dim transition"
      >
        Báo lỗi
      </button>
      {open && (
        <div className="absolute left-0 top-5 z-20 bg-surface border border-border rounded-xl p-3 flex flex-col gap-1.5 shadow-xl min-w-max">
          {PRESET_REASONS.map(r => (
            <button
              key={r}
              disabled={sending}
              onClick={() => {
                if (r === 'Khác') { setShowOther(true) }
                else { submit(r) }
              }}
              className="font-jakarta text-xs text-muted hover:text-foreground text-left px-2 py-1 rounded hover:bg-border transition disabled:opacity-50"
            >
              {r}
            </button>
          ))}
          {showOther && (
            <div className="flex flex-col gap-1.5 mt-1">
              <textarea
                value={otherText}
                onChange={e => setOtherText(e.target.value.slice(0, 200))}
                placeholder="Mô tả lỗi..."
                rows={3}
                className="font-jakarta text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground placeholder:text-faint resize-none focus:outline-none focus:border-primary"
              />
              <button
                disabled={sending || !otherText.trim()}
                onClick={() => submit('Khác')}
                className="font-jakarta text-xs bg-primary text-primary-fg rounded-lg px-3 py-1 disabled:opacity-40 transition"
              >
                {sending ? 'Đang gửi...' : 'Gửi'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { reportQuestion } from '../api/index.js'
import { useEscapeToClose } from '../hooks/useEscapeToClose.js'

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

  function close() { setOpen(false); setStatus('idle') }
  useEscapeToClose(open, close)

  async function submit() {
    setStatus('sending')
    try {
      await reportQuestion(questionId, kind, note || undefined)
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="self-start flex items-center gap-2 px-3 py-1.5 transition"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}
      >
        ⚑ Báo lỗi câu hỏi
      </button>

      {open && (
        <div className="vtg-overlay" onClick={close}>
          <div className="vtg-modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="vtg-modal-head">
              <div>
                <span className="vtg-modal-kicker">PHIẾU BÁO SAI LỆCH TRẮC LƯỢNG</span>
                <span className="vtg-modal-title">Đính chính câu hỏi</span>
              </div>
              <button onClick={close} className="vtg-modal-close" aria-label="Đóng">✕</button>
            </div>

            <div className="vtg-modal-body">
              {status === 'sent' ? (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--pine)' }}>
                  Đã gửi phiếu báo — cảm ơn bạn.
                </p>
              ) : (
                <>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    className="w-full"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, padding: '8px 10px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', borderRadius: 'var(--r-sm)' }}
                  >
                    {Object.entries(KIND_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Mô tả ngắn (không bắt buộc)"
                    rows={3}
                    className="w-full resize-none"
                    style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 10px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', borderRadius: 'var(--r-sm)' }}
                  />
                  {status === 'error' && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-deep)' }}>Gửi thất bại, thử lại sau.</span>
                  )}
                </>
              )}
            </div>

            <div className="vtg-modal-foot">
              {status === 'sent' ? (
                <button onClick={close} className="vtg-btn-primary">ĐÓNG ▲</button>
              ) : (
                <>
                  <button onClick={close} className="vtg-btn-ghost">HUỶ</button>
                  <button onClick={submit} disabled={status === 'sending'} className="vtg-btn-primary">
                    {status === 'sending' ? 'ĐANG GỬI…' : 'GỬI PHIẾU BÁO ▲'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

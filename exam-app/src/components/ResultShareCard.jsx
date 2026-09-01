import { useState } from 'react'
import { useToast } from '../context/ToastContext.jsx'
import { useEscapeToClose } from '../hooks/useEscapeToClose.js'

const BASE_URL = import.meta.env.VITE_APP_URL || 'https://exam-app-ey0.pages.dev'

function buildShareUrl(result, examTitle) {
  const tb = result?.topicBreakdown ?? {}
  const total = Object.values(tb).reduce((s, t) => s + t.total, 0)
  const correct = Object.values(tb).reduce((s, t) => s + t.correct, 0)
  const payload = {
    s: result?.score ?? 0,
    c: correct,
    t: total,
    e: (examTitle || 'Đề thi toán').slice(0, 100),
    dt: result?.finishedAt ? new Date(result.finishedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  }
  return `${BASE_URL}/share?d=${encodeURIComponent(JSON.stringify(payload))}`
}

export default function ResultShareCard({ result, examTitle, personalBest, onClose }) {
  const [copied, setCopied] = useState(false)
  const toast = useToast()

  const score = result?.score ?? 0
  const tb = result?.topicBreakdown ?? {}
  const total = Object.values(tb).reduce((s, t) => s + t.total, 0)
  const correct = Object.values(tb).reduce((s, t) => s + t.correct, 0)
  const date = result?.finishedAt ? new Date(result.finishedAt).toLocaleDateString('vi-VN') : ''
  const shareUrl = buildShareUrl(result, examTitle)

  useEscapeToClose(true, onClose)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Đã sao chép link chia sẻ')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // fallback: select a temp input
      const el = document.createElement('input')
      el.value = shareUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      toast.success('Đã sao chép link chia sẻ')
      setTimeout(() => setCopied(false), 2500)
    }
  }

  async function handleNativeShare() {
    try {
      await navigator.share({ title: 'Kết quả thi của tôi', url: shareUrl })
    } catch { /* user cancelled */ }
  }

  return (
    <div className="vtg-overlay" onClick={onClose}>
      <div className="vtg-modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div className="vtg-modal-head">
          <div>
            <span className="vtg-modal-kicker">CHỨNG CHỈ CẮM ĐỈNH</span>
            <span className="vtg-modal-title">Biên bản trắc lượng</span>
          </div>
          <button onClick={onClose} className="vtg-modal-close" aria-label="Đóng">✕</button>
        </div>

        <div className="vtg-modal-body">
          {/* Preview card */}
          <div style={{
            border: '1px solid var(--line)',
            borderTop: '3px solid var(--ink)',
            borderRadius: 'var(--r-sm)',
            padding: 24,
            background: 'var(--paper-2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>KẾT QUẢ THI THỬ</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{date}</span>
            </div>

            <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4, margin: 0 }}>
              {examTitle || 'Đề thi toán'}
            </p>

            <div className="flex flex-col items-center gap-1" style={{ padding: '16px 0' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 56, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {score.toFixed(1)}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)' }}>/ 10</span>
              {personalBest && (
                <span className="mt-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600, color: 'var(--pine)' }}>
                  KỶ LỤC CÁ NHÂN ▲
                </span>
              )}
            </div>

            <div className="vtg-ledger-table">
              <div className="vtg-ledger-row">
                <span className="vtg-ledger-label">Câu đúng</span>
                <span className="vtg-ledger-value">{correct}/{total}</span>
              </div>
            </div>

            <div className="text-center" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>exam-app-ey0.pages.dev · Không xác minh</span>
            </div>
          </div>
        </div>

        <div className="vtg-modal-foot">
          <button onClick={onClose} className="vtg-btn-ghost">ĐÓNG</button>
          {typeof navigator.share === 'function' && (
            <button onClick={handleNativeShare} className="vtg-btn-ghost">CHIA SẺ</button>
          )}
          <button onClick={handleCopy} className="vtg-btn-primary">
            {copied ? 'ĐÃ SAO CHÉP ✓' : 'SAO CHÉP LINK ▲'}
          </button>
        </div>
      </div>
    </div>
  )
}

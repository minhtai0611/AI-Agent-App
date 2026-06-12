import { useState } from 'react'
import { useToast } from '../context/ToastContext.jsx'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div className="flex flex-col gap-4 items-center w-full max-w-sm" onClick={e => e.stopPropagation()}>

        {/* Preview card */}
        <div style={{
          width: '100%',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: 32,
          fontFamily: 'Inter, system-ui, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>Kết quả thi thử</span>
            <span style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>{date}</span>
          </div>

          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-secondary)', lineHeight: 1.4, margin: 0 }}>
            {examTitle || 'Đề thi toán'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', padding: '20px 0' }}>
            <span style={{ fontSize: 64, fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>
              {score.toFixed(1)}
            </span>
            <span style={{ fontSize: 16, color: 'var(--fg-secondary)' }}>/ 10</span>
            {personalBest && (
              <span style={{ marginTop: 8, fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                🏆 Kỷ lục cá nhân!
              </span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>{correct}/{total}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 2 }}>Câu đúng</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
            <span style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>✦ exam-app-ey0.pages.dev · Không xác minh</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 w-full">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 rounded-xl font-sans text-[0.8125rem] font-bold transition flex items-center justify-center gap-2"
            style={{ background: copied ? 'var(--success)' : 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            {copied ? '✓ Đã sao chép' : '🔗 Sao chép link'}
          </button>
          {typeof navigator.share === 'function' && (
            <button
              onClick={handleNativeShare}
              className="px-4 py-2.5 rounded-xl font-sans text-[0.8125rem] text-muted border border-border hover:text-foreground transition"
            >
              📤
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl font-sans text-[0.8125rem] text-dim hover:text-muted border border-border transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

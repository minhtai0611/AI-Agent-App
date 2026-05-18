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
          background: 'linear-gradient(135deg, #0A0E1A 0%, #0D1526 100%)',
          border: '1px solid #1E2A44',
          borderRadius: 20,
          padding: 32,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#64748B' }}>Kết quả thi thử</span>
            <span style={{ fontSize: 13, color: '#64748B' }}>{date}</span>
          </div>

          <p style={{ fontSize: 14, fontWeight: 600, color: '#94A3B8', lineHeight: 1.4, margin: 0 }}>
            {examTitle || 'Đề thi toán'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', padding: '20px 0' }}>
            <span style={{ fontSize: 64, fontWeight: 700, color: '#F2A20C', lineHeight: 1, fontFamily: 'Georgia, serif' }}>
              {score.toFixed(1)}
            </span>
            <span style={{ fontSize: 16, color: '#475569' }}>/ 10</span>
            {personalBest && (
              <span style={{ marginTop: 8, fontSize: 13, color: '#10B981', fontWeight: 600 }}>
                🏆 Kỷ lục cá nhân!
              </span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid #1E2A44', paddingTop: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC' }}>{correct}/{total}</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Câu đúng</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', borderTop: '1px solid #111827', paddingTop: 14 }}>
            <span style={{ fontSize: 11, color: '#2A3A50' }}>✦ exam-app-ey0.pages.dev · Không xác minh</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 w-full">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 rounded-xl font-jakarta text-[13px] font-bold transition flex items-center justify-center gap-2"
            style={{ background: copied ? '#10B981' : '#F2A20C', color: '#0A0E1A' }}
          >
            {copied ? '✓ Đã sao chép' : '🔗 Sao chép link'}
          </button>
          {typeof navigator.share === 'function' && (
            <button
              onClick={handleNativeShare}
              className="px-4 py-2.5 rounded-xl font-jakarta text-[13px] text-[#94A3B8] border border-[#1E2A44] hover:text-[#F8FAFC] transition"
            >
              📤
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl font-jakarta text-[13px] text-[#64748B] hover:text-[#94A3B8] border border-[#1E2A44] transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

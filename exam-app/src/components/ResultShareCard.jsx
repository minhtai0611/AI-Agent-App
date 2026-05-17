import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'

// Renders a shareable card as a DOM node and lets the user download/share it.
// Props: result, examTitle, personalBest (bool), percentile (0-100 or undefined)
export default function ResultShareCard({ result, examTitle, personalBest, percentile, onClose }) {
  const cardRef = useRef(null)
  const [sharing, setSharing] = useState(false)

  const score = result?.score ?? 0
  const correct = result?.correctCount ?? 0
  const total = result?.totalQuestions ?? 0
  const date = result?.finishedAt ? new Date(result.finishedAt).toLocaleDateString('vi-VN') : ''

  async function handleShare() {
    if (!cardRef.current || sharing) return
    setSharing(true)
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })
      if (navigator.share && navigator.canShare?.({ files: [] })) {
        const blob = await (await fetch(dataUrl)).blob()
        const file = new File([blob], 'ket-qua.png', { type: 'image/png' })
        await navigator.share({ files: [file], title: 'Kết quả thi của tôi' })
      } else {
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = 'ket-qua.png'
        a.click()
      }
    } catch {
      // silently ignore user cancel
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div className="flex flex-col gap-4 items-center" onClick={e => e.stopPropagation()}>

        {/* Card that gets exported */}
        <div
          ref={cardRef}
          style={{
            width: 360,
            background: 'linear-gradient(135deg, #0A0E1A 0%, #0D1526 100%)',
            border: '1px solid #1E2A44',
            borderRadius: 20,
            padding: 32,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#64748B' }}>Kết quả thi thử</span>
            <span style={{ fontSize: 13, color: '#64748B' }}>{date}</span>
          </div>

          {/* Exam title */}
          <p style={{ fontSize: 14, fontWeight: 600, color: '#94A3B8', lineHeight: 1.4, margin: 0 }}>
            {examTitle || 'Đề thi toán'}
          </p>

          {/* Score */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', padding: '20px 0' }}>
            <span style={{ fontSize: 64, fontWeight: 700, color: '#F2A20C', lineHeight: 1, fontFamily: 'Georgia, serif' }}>
              {score.toFixed(1)}
            </span>
            <span style={{ fontSize: 16, color: '#475569' }}>/&nbsp;10</span>
            {personalBest && (
              <span style={{ marginTop: 8, fontSize: 13, color: '#10B981', fontWeight: 600 }}>
                🏆 Kỷ lục cá nhân!
              </span>
            )}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid #1E2A44', paddingTop: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC' }}>{correct}/{total}</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Câu đúng</div>
            </div>
            {percentile !== undefined && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC' }}>Top {100 - percentile}%</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Trong lịch sử</div>
              </div>
            )}
          </div>

          {/* Branding */}
          <div style={{ textAlign: 'center', borderTop: '1px solid #111827', paddingTop: 14 }}>
            <span style={{ fontSize: 12, color: '#2A3A50' }}>✦ exam-app.pages.dev</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleShare}
            disabled={sharing}
            className="px-6 py-2.5 rounded-xl font-jakarta text-[13px] font-bold transition"
            style={{ background: '#F2A20C', color: '#0A0E1A', opacity: sharing ? 0.7 : 1 }}
          >
            {sharing ? 'Đang xuất...' : '📤 Chia sẻ'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-jakarta text-[13px] text-[#64748B] hover:text-[#94A3B8] border border-[#1E2A44] transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

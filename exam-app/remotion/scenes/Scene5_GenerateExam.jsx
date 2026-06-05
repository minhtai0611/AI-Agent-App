import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT, card } from '../theme.js'

const QUESTIONS_ARRIVE = [
  { q: 'Tính đạo hàm của hàm số f(x) = ln(x² + 1) tại x = 1', topic: 'Giải tích', diff: 'Vừa' },
  { q: 'Cho hình chóp S.ABCD có đáy là hình vuông cạnh a. Tính thể tích.', topic: 'Hình học', diff: 'Khó' },
  { q: 'Giải hệ phương trình: 2x + 3y = 7 và x − y = 1', topic: 'Đại số', diff: 'Dễ' },
  { q: 'Tìm số hạng chứa x³ trong khai triển (x + 2)⁵', topic: 'Tổ hợp', diff: 'Vừa' },
  { q: 'Tính tích phân ∫₀¹ (2x + 1) dx', topic: 'Giải tích', diff: 'Dễ' },
]

const DIFF_COLOR = { 'Dễ': C.green, 'Vừa': C.amber, 'Khó': C.red }

export function Scene5_GenerateExam() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const headerIn = spring({ frame, fps, config: { damping: 20 } })
  const progress  = Math.min(1, frame / 60)
  const arrived   = Math.min(QUESTIONS_ARRIVE.length, Math.floor(frame / 12))

  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, fontFamily: FONT, padding: '48px 60px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ opacity: headerIn, transform: `translateY(${interpolate(headerIn,[0,1],[10,0])}px)` }}>
        <span style={{ color: C.amber, fontWeight: 800, fontSize: 18 }}>✦ ZENITH</span>
        <h2 style={{ color: C.text, fontWeight: 700, fontSize: 28, margin: '4px 0 0', letterSpacing: '-0.5px' }}>Tạo đề riêng</h2>
        <p style={{ color: C.textMuted, fontSize: 13, margin: '4px 0 0' }}>Hình học + Giải tích · Độ khó: Vừa · 5 câu</p>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: C.amber, borderRadius: 3, width: `${progress * 100}%` }} />
        </div>
        <span style={{ color: C.amber, fontSize: 13, fontWeight: 700, width: 60, textAlign: 'right' }}>
          {arrived}/{QUESTIONS_ARRIVE.length} câu
        </span>
        <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${C.amber}`, borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite',
          ...(arrived >= QUESTIONS_ARRIVE.length ? { display: 'none' } : {}),
        }} />
      </div>

      {/* Question cards arriving one by one */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {QUESTIONS_ARRIVE.slice(0, arrived).map((q, i) => {
          const cardIn = spring({ frame: frame - i * 12, fps, config: { damping: 20 }, durationInFrames: 12 })
          return (
            <div key={i} style={{
              ...card({ padding: '14px 18px' }),
              opacity: cardIn,
              transform: `translateY(${interpolate(cardIn,[0,1],[8,0])}px)`,
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <span style={{ color: C.green, fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontSize: 13, lineHeight: 1.5 }}>{q.q}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, background: C.border, borderRadius: 6, padding: '2px 7px' }}>{q.topic}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: DIFF_COLOR[q.diff], background: DIFF_COLOR[q.diff] + '22', borderRadius: 6, padding: '2px 7px' }}>{q.diff}</span>
                </div>
              </div>
            </div>
          )
        })}

        {/* Placeholder for arriving cards */}
        {arrived < QUESTIONS_ARRIVE.length && (
          <div style={{
            ...card({ padding: '14px 18px', borderStyle: 'dashed' }),
            display: 'flex', alignItems: 'center', gap: 8,
            opacity: 0.5,
          }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${C.amber}`, borderTopColor: 'transparent' }} />
            <span style={{ color: C.textMuted, fontSize: 12 }}>AI đang tạo câu {arrived + 1}...</span>
          </div>
        )}
      </div>

      {/* CTA when all done */}
      {arrived >= QUESTIONS_ARRIVE.length && (
        <div style={{
          marginTop: 8,
          opacity: spring({ frame: frame - 65, fps, config: { damping: 18 } }),
          background: C.amber, borderRadius: 14,
          padding: '14px 24px', textAlign: 'center',
          color: '#0A0E1A', fontWeight: 700, fontSize: 16,
        }}>
          Bắt đầu thi →
        </div>
      )}
    </div>
  )
}

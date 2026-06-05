import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT, card } from '../theme.js'

const EXAMS = [
  { title: 'Đề Toán THPT QG 2024', province: 'Hà Nội', score: '8.0', color: C.green, tag: 'Thi thử' },
  { title: 'Đề Toán Tuyển sinh Lớp 10', province: 'TP. Hồ Chí Minh', score: '6.5', color: C.amber, tag: 'Thi thử' },
  { title: 'AMC 10A 2023', province: 'Quốc tế', score: '7.2', color: C.indigo, tag: 'Luyện tập' },
  { title: 'Đề Toán THPT QG 2023', province: 'Đà Nẵng', score: '7.8', color: C.green, tag: 'Thi thử' },
]

export function Scene1_ExamSelect() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const headerIn = spring({ frame, fps, config: { damping: 20 } })
  const tabIn = spring({ frame: frame - 8, fps, config: { damping: 22 }, durationInFrames: 20 })

  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column', padding: '48px 60px', gap: 28 }}>
      {/* Header */}
      <div style={{ opacity: headerIn, transform: `translateY(${interpolate(headerIn, [0, 1], [12, 0])}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{ color: C.amber, fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px' }}>✦ ZENITH</span>
        </div>
        <h2 style={{ color: C.text, fontWeight: 700, fontSize: 32, margin: 0, letterSpacing: '-0.5px' }}>Chọn đề thi</h2>
        <p style={{ color: C.textMuted, fontSize: 14, marginTop: 4 }}>40+ đề thật từ 63 tỉnh thành · 1,104 câu hỏi</p>
      </div>

      {/* Mode tabs */}
      <div style={{ opacity: tabIn, display: 'flex', gap: 8 }}>
        {['Có thời gian', 'Luyện tập', '⚗ Lab'].map((t, i) => (
          <div key={t} style={{
            padding: '8px 18px', borderRadius: 24, fontWeight: i === 0 ? 700 : 400, fontSize: 13,
            background: i === 0 ? C.amber + '22' : 'transparent',
            border: `1.5px solid ${i === 0 ? C.amber + '88' : C.border}`,
            color: i === 0 ? C.amber : C.textMuted,
          }}>{t}</div>
        ))}
      </div>

      {/* Exam cards — stagger in */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {EXAMS.map((e, i) => {
          const cardIn = spring({ frame: frame - 14 - i * 6, fps, config: { damping: 22 }, durationInFrames: 18 })
          return (
            <div key={e.title} style={{
              ...card({ padding: '14px 20px' }),
              opacity: cardIn,
              transform: `translateX(${interpolate(cardIn, [0, 1], [20, 0])}px)`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{e.title}</div>
                <div style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{e.province} · {e.tag}</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 18, color: e.color }}>{e.score}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

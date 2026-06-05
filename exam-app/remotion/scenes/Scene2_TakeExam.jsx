import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT, card } from '../theme.js'

const QUESTION = 'Cho hàm số f(x) = x³ − 3x² + 2. Tìm giá trị cực tiểu của hàm số.'
const CHOICES = ['f(0) = 2', 'f(2) = −2', 'f(1) = 0', 'f(−1) = 4']
const CORRECT = 1

// Frame timing: 0-30 = question appears, 30-50 = user hovers choice B, 50-70 = chooses, 70+ = hint pops
const HINT_TEXT = '💡 Gợi ý Socratic: Tìm f\'(x) và giải f\'(x) = 0 trước. Đây là điểm dừng của hàm — bạn còn cần kiểm tra gì?'

export function Scene2_TakeExam() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const questionIn = spring({ frame, fps, config: { damping: 20 } })
  const choicesIn  = spring({ frame: frame - 12, fps, config: { damping: 22 } })
  const timerPct   = Math.max(0, 1 - frame / 90)
  const hintIn     = spring({ frame: frame - 70, fps, config: { damping: 18 }, durationInFrames: 20 })

  // Which choice is hovered/selected
  const hoveredIdx  = frame >= 30 && frame < 50 ? 1 : -1
  const selectedIdx = frame >= 50 ? 1 : -1

  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column', padding: '48px 60px', gap: 24 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: C.amber, fontWeight: 800, fontSize: 18 }}>✦ ZENITH</span>
          <span style={{ color: C.textMuted, fontSize: 13 }}>Đề Toán THPT QG 2024 — Câu 23/30</span>
        </div>
        {/* Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 120, height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${timerPct * 100}%`, height: '100%', background: C.amber, borderRadius: 3, transition: 'width 0.1s' }} />
          </div>
          <span style={{ color: C.amber, fontSize: 13, fontWeight: 600 }}>
            {String(Math.floor(timerPct * 45)).padStart(2, '0')}:{String(Math.round((timerPct * 45 % 1) * 60)).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Question */}
      <div style={{ ...card(), opacity: questionIn, transform: `translateY(${interpolate(questionIn, [0,1],[10,0])}px)` }}>
        <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 10, letterSpacing: 1, fontWeight: 600 }}>CÂU 23</div>
        <div style={{ color: C.text, fontSize: 16, lineHeight: 1.6, fontWeight: 500 }}>{QUESTION}</div>
      </div>

      {/* Choices */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: choicesIn }}>
        {CHOICES.map((ch, i) => {
          const isHovered  = hoveredIdx === i
          const isSelected = selectedIdx === i
          const letterColor = isSelected ? '#0A0E1A' : isHovered ? C.amber : C.textSub
          const bg  = isSelected ? C.amber : isHovered ? C.amber + '18' : 'transparent'
          const bdr = isSelected ? C.amber : isHovered ? C.amber + '66' : C.border
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', borderRadius: 12, border: `1.5px solid ${bdr}`,
              background: bg, cursor: 'pointer',
              transform: isHovered ? 'translateX(4px)' : 'none',
              transition: 'all 0.15s',
            }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: letterColor, width: 20 }}>
                {['A','B','C','D'][i]}
              </span>
              <span style={{ color: isSelected ? '#0A0E1A' : C.text, fontSize: 14 }}>{ch}</span>
            </div>
          )
        })}
      </div>

      {/* Hint balloon */}
      {hintIn > 0.02 && (
        <div style={{
          opacity: hintIn,
          transform: `translateY(${interpolate(hintIn, [0,1],[8,0])}px)`,
          background: '#1A1200', border: `1.5px solid ${C.amber}44`,
          borderRadius: 12, padding: '12px 16px',
          color: C.amber, fontSize: 13, lineHeight: 1.6,
        }}>
          {HINT_TEXT}
        </div>
      )}
    </div>
  )
}

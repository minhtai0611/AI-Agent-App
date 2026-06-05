import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT, card } from '../theme.js'

const TOPICS = [
  { label: 'Hàm số', pct: 42, color: '#EF4444' },
  { label: 'Hình học không gian', pct: 61, color: '#F59E0B' },
  { label: 'Tích phân', pct: 83, color: '#34D399' },
  { label: 'Xác suất', pct: 77, color: '#34D399' },
  { label: 'Số phức', pct: 35, color: '#EF4444' },
]

const INSIGHTS = [
  { icon: '⚠', text: 'Bạn hay sai ở câu tìm cực trị — kiểm tra lại quy tắc dấu f\'\'', color: '#F59E0B' },
  { icon: '✓', text: 'Tích phân cải thiện tốt so với lần trước (+18%)', color: '#34D399' },
  { icon: '→', text: 'Ưu tiên ôn: Hàm số + Số phức tuần này', color: '#818CF8' },
]

export function Scene3_AIAnalysis() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const headerIn   = spring({ frame, fps, config: { damping: 20 } })
  const scoreIn    = spring({ frame: frame - 8, fps, config: { damping: 16 } })
  const streamPct  = Math.min(1, frame / 40)  // typewriter feel for score

  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, fontFamily: FONT, padding: '48px 60px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Header */}
      <div style={{ opacity: headerIn, transform: `translateY(${interpolate(headerIn,[0,1],[10,0])}px)` }}>
        <span style={{ color: C.amber, fontWeight: 800, fontSize: 18 }}>✦ ZENITH</span>
        <h2 style={{ color: C.text, fontWeight: 700, fontSize: 28, margin: '4px 0 0', letterSpacing: '-0.5px' }}>Phân tích AI</h2>
        <p style={{ color: C.textMuted, fontSize: 13, margin: '4px 0 0' }}>Đề Toán THPT QG 2024 · Hà Nội</p>
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Score card */}
        <div style={{ ...card({ minWidth: 180, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center', alignItems: 'center' }), opacity: scoreIn }}>
          <div style={{ color: C.textMuted, fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>ĐIỂM SỐ</div>
          <div style={{ color: C.amber, fontWeight: 800, fontSize: 52, letterSpacing: '-2px', lineHeight: 1 }}>
            {(interpolate(streamPct, [0, 1], [0, 6.5])).toFixed(1)}
          </div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>/ 10</div>
          <div style={{ color: C.indigo, fontSize: 11, fontWeight: 600, background: C.indigo + '18', padding: '3px 10px', borderRadius: 12 }}>
            Phân tích Miễn phí ✦
          </div>
        </div>

        {/* Topic bars */}
        <div style={{ flex: 1, ...card({ display: 'flex', flexDirection: 'column', gap: 12 }) }}>
          <div style={{ color: C.textSub, fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>CHỦ ĐỀ</div>
          {TOPICS.map((t, i) => {
            const barIn = spring({ frame: frame - 10 - i * 5, fps, config: { damping: 22 } })
            return (
              <div key={t.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: C.text, fontSize: 13 }}>{t.label}</span>
                  <span style={{ color: t.color, fontSize: 13, fontWeight: 600 }}>{t.pct}%</span>
                </div>
                <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', background: t.color, borderRadius: 3,
                    width: `${barIn * t.pct}%`,
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* AI insights */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {INSIGHTS.map((ins, i) => {
          const insIn = spring({ frame: frame - 40 - i * 8, fps, config: { damping: 20 } })
          return (
            <div key={i} style={{
              opacity: insIn,
              transform: `translateX(${interpolate(insIn,[0,1],[12,0])}px)`,
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: ins.color + '14', border: `1px solid ${ins.color}33`,
              borderRadius: 10, padding: '10px 14px',
            }}>
              <span style={{ color: ins.color, fontSize: 14, flexShrink: 0 }}>{ins.icon}</span>
              <span style={{ color: C.textSub, fontSize: 13, lineHeight: 1.5 }}>{ins.text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

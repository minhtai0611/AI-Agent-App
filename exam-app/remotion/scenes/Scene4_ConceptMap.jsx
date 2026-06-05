import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT } from '../theme.js'

// Simplified concept map nodes positioned manually for a clean visual
const NODES = [
  // Grade 9 — top row
  { id: 'linear_eq',    label: 'Phương trình bậc nhất', grade: 9, x: 80,  y: 60,  mastery: 0.95, prereqs: [] },
  { id: 'quad_eq',      label: 'Phương trình bậc hai',   grade: 9, x: 260, y: 60,  mastery: 0.88, prereqs: ['linear_eq'] },
  { id: 'radicals',     label: 'Căn thức',               grade: 9, x: 80,  y: 148, mastery: 0.72, prereqs: ['linear_eq'] },
  { id: 'inequalities', label: 'Bất phương trình',        grade: 9, x: 440, y: 60,  mastery: 0.61, prereqs: ['quad_eq'] },
  // Grade 10 — middle
  { id: 'functions',    label: 'Hàm số & đồ thị',        grade: 10, x: 260, y: 200, mastery: 0.42, prereqs: ['quad_eq', 'radicals'] },
  { id: 'trig',         label: 'Lượng giác',              grade: 10, x: 80,  y: 280, mastery: 0.58, prereqs: ['radicals'] },
  { id: 'combinatorics',label: 'Tổ hợp & xác suất',      grade: 10, x: 440, y: 200, mastery: 0.77, prereqs: ['inequalities'] },
  // Grade 11 — lower middle
  { id: 'exp_log',      label: 'Mũ & Logarit',            grade: 11, x: 260, y: 340, mastery: 0.31, prereqs: ['functions'] },
  { id: 'vectors',      label: 'Vectơ & không gian',      grade: 11, x: 80,  y: 370, mastery: 0.53, prereqs: ['trig'] },
  // Grade 12 — bottom
  { id: 'calculus',     label: 'Giải tích (tích phân)',   grade: 12, x: 200, y: 450, mastery: 0.68, prereqs: ['exp_log'] },
  { id: 'spatial_geo',  label: 'Hình học không gian',     grade: 12, x: 440, y: 400, mastery: 0.24, prereqs: ['vectors'] },
]

const GRADE_COLORS = { 9: '#818CF8', 10: '#60A5FA', 11: '#F2A20C', 12: '#34D399' }

function masteryFill(m) {
  if (m < 0.4) return '#7F1D1D'
  if (m < 0.7) return '#78350F'
  return '#14532D'
}
function masteryStroke(m) {
  if (m < 0.4) return '#EF4444'
  if (m < 0.7) return '#F59E0B'
  return '#22C55E'
}

export function Scene4_ConceptMap() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Nodes stagger in
  const nodeMap = {}
  NODES.forEach(n => { nodeMap[n.id] = n })

  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '28px 48px 12px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ color: C.amber, fontWeight: 800, fontSize: 18 }}>✦ ZENITH</span>
        <h2 style={{ color: C.text, fontWeight: 700, fontSize: 22, margin: 0 }}>Bản đồ khái niệm</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {Object.entries(GRADE_COLORS).map(([g, col]) => (
            <span key={g} style={{ fontSize: 11, color: col, background: col + '22', border: `1px solid ${col}44`, borderRadius: 12, padding: '2px 8px', fontWeight: 600 }}>
              Lớp {g}
            </span>
          ))}
        </div>
      </div>

      {/* SVG canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', padding: '0 48px 28px' }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          {/* Edges */}
          {NODES.map(n => n.prereqs.map(pid => {
            const p = nodeMap[pid]
            if (!p) return null
            const edgeIn = spring({ frame: frame - 20, fps, config: { damping: 20 } })
            // Gap chain highlight: highlight edges on path to 'calculus' (weakest leaf)
            const isChain = (n.id === 'calculus' && pid === 'exp_log') ||
                            (n.id === 'exp_log' && pid === 'functions') ||
                            (n.id === 'functions' && pid === 'quad_eq')
            return (
              <line key={`${pid}-${n.id}`}
                x1={p.x + 70} y1={p.y + 16}
                x2={n.x + 70} y2={n.y + 16}
                stroke={isChain ? '#F2A20C' : '#334155'}
                strokeWidth={isChain ? 2.5 : 1.5}
                strokeDasharray={isChain ? '0' : '4 4'}
                opacity={edgeIn}
              />
            )
          }))}
        </svg>

        {/* Nodes */}
        {NODES.map((n, i) => {
          const nodeIn = spring({ frame: frame - 8 - i * 3, fps, config: { damping: 22 }, durationInFrames: 16 })
          const gradeBadgeColor = GRADE_COLORS[n.grade]
          return (
            <div key={n.id} style={{
              position: 'absolute',
              left: n.x,
              top: n.y,
              width: 140,
              opacity: nodeIn,
              transform: `scale(${interpolate(nodeIn,[0,1],[0.85,1])})`,
            }}>
              <div style={{
                background: masteryFill(n.mastery),
                border: `1.5px solid ${masteryStroke(n.mastery)}`,
                borderRadius: 10,
                padding: '7px 10px',
              }}>
                <div style={{ color: '#F0F4FF', fontSize: 11, fontWeight: 600, lineHeight: 1.3, marginBottom: 3 }}>{n.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: gradeBadgeColor, fontSize: 9, fontWeight: 700 }}>Lớp {n.grade}</span>
                  <span style={{ color: masteryStroke(n.mastery), fontSize: 10, fontWeight: 700 }}>{Math.round(n.mastery * 100)}%</span>
                </div>
              </div>
            </div>
          )
        })}

        {/* Gap trace tooltip */}
        {frame > 55 && (
          <div style={{
            position: 'absolute', left: 200, bottom: 30,
            background: '#1C1400', border: `1.5px solid ${C.amber}44`,
            borderRadius: 10, padding: '10px 14px',
            opacity: spring({ frame: frame - 55, fps, config: { damping: 18 } }),
            maxWidth: 260,
          }}>
            <span style={{ color: C.amber, fontSize: 11, fontWeight: 700 }}>Gốc điểm yếu</span>
            <p style={{ color: C.textSub, fontSize: 12, margin: '4px 0 0', lineHeight: 1.5 }}>
              Học <strong style={{ color: '#FCD34D' }}>Hàm số & đồ thị</strong> trước khi ôn Giải tích
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useHistory } from '../context/HistoryContext.jsx'
import { loadExamById } from '../api/index.js'
import { pageVariants } from '../utils/animations.js'
import { usePageMeta } from '../hooks/usePageMeta.js'

const MONTHS_VI = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']
const REVEAL_STEP = 15

function monthKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}`
}

function monthLabel(iso) {
  const d = new Date(iso)
  return `THÁNG ${d.getMonth() + 1} · ${d.getFullYear()}`
}

function fmtDelta(delta) {
  const abs = Math.abs(delta).toFixed(2).replace(/0$/, '').replace(/\.$/, '.0')
  if (delta > 0.001) return { text: `▲ +${abs} SO LẦN TRƯỚC`, color: 'var(--accent)' }
  if (delta < -0.001) return { text: `▼ −${abs} SO LẦN TRƯỚC`, color: 'var(--ink-3)' }
  return { text: '· LẦN ĐẦU LÀM ĐỀ NÀY', color: 'var(--ink-3)' }
}

// Hand-drawn summit flag — reuses the design system's "Đỉnh / Mục tiêu" glyph at empty-state scale.
function SummitFlag({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7 18H5l7-18z" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 3l2.6 7" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9.5 14h5" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function buildAttempts(results) {
  // Chronological (oldest -> newest), each attempt annotated with its delta vs the
  // previous attempt of the SAME exam (for both the journal row indicator and the
  // switchback connector labels on the elevation chart).
  const chron = [...results].sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt))
  const lastByExam = {}
  return chron.map(r => {
    const prev = lastByExam[r.examId]
    lastByExam[r.examId] = r
    return { ...r, prevScore: prev ? prev.score : null, prev }
  })
}

// Elevation profile — inline SVG, no chart library. Main journey line through every
// attempt in time order (accent); dashed altitude connectors link repeat attempts of
// the same exam ("switchback" — climbing the same slope again).
function ElevationChart({ attempts, onSelect, reducedMotion }) {
  const W = 880, H = 240
  const padL = 28, padR = 16, padT = 16, padB = 34
  const plotW = W - padL - padR, plotH = H - padT - padB
  const [hover, setHover] = useState(null)

  const times = attempts.map(a => new Date(a.finishedAt).getTime())
  const minT = Math.min(...times), maxT = Math.max(...times)
  const span = Math.max(maxT - minT, 1)

  const x = t => padL + ((t - minT) / span) * plotW
  const y = score => padT + (1 - score / 10) * plotH

  const points = attempts.map(a => ({ ...a, cx: x(new Date(a.finishedAt).getTime()), cy: y(a.score) }))
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`).join(' ')

  // Month ticks across the span
  const monthTicks = []
  const seen = new Set()
  for (const t of times) {
    const d = new Date(t)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!seen.has(key)) { seen.add(key); monthTicks.push({ key, t, label: MONTHS_VI[d.getMonth()] }) }
  }

  // Switchback connectors — same-exam repeat attempts
  const switchbacks = []
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    if (p.prev) {
      const prevPoint = points.find(q => q.id === p.prev.id)
      if (prevPoint) {
        const delta = p.score - p.prev.score
        switchbacks.push({
          key: `sb-${p.id}`,
          x1: prevPoint.cx, y1: prevPoint.cy, x2: p.cx, y2: p.cy,
          midX: (prevPoint.cx + p.cx) / 2, midY: (prevPoint.cy + p.cy) / 2 - 8,
          delta,
        })
      }
    }
  }

  const summaryLabel = `${attempts.length} lần thi từ ${monthTicks[0]?.label ?? ''} đến ${monthTicks[monthTicks.length - 1]?.label ?? ''}, điểm từ ${attempts[0].score.toFixed(2)} lên ${attempts[attempts.length - 1].score.toFixed(2)}.`

  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 16, padding: '20px 16px 12px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summaryLabel} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        {[0, 5, 10].map(v => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--line-soft)" strokeWidth="1" />
            <text x={4} y={y(v) + 3} fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--ink-3)">{v}</text>
          </g>
        ))}
        {monthTicks.map(m => (
          <text key={m.key} x={x(m.t)} y={H - 10} fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--ink-3)" textAnchor="middle">{m.label}</text>
        ))}

        {switchbacks.map(sb => (
          <g key={sb.key}>
            <line x1={sb.x1} y1={sb.y1} x2={sb.x2} y2={sb.y2} stroke="var(--altitude)" strokeWidth="1.5" strokeDasharray="4 3" fill="none" />
            <text x={sb.midX} y={sb.midY} fontFamily="var(--font-mono)" fontSize="9" textAnchor="middle"
              fill={sb.delta >= 0 ? 'var(--accent)' : 'var(--ink-3)'}>
              LEO LẠI {sb.delta >= 0 ? '+' : '−'}{Math.abs(sb.delta).toFixed(2)}
            </text>
          </g>
        ))}

        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.5"
          strokeDasharray={reducedMotion ? undefined : '1400'}
          strokeDashoffset={reducedMotion ? undefined : '1400'}
          style={reducedMotion ? undefined : { animation: 'vtg-draw-on 1200ms var(--ease-out) forwards' }} />

        {points.map((p, i) => {
          const exam = loadExamById(p.examId)
          return (
            <g key={p.id}
              style={{
                cursor: 'pointer',
                ...(reducedMotion ? null : { opacity: 0, animation: 'vtg-marker-in 280ms var(--ease-out) forwards', animationDelay: `${i * 40}ms` }),
              }}
              onMouseEnter={() => setHover(p.id)}
              onMouseLeave={() => setHover(h => (h === p.id ? null : h))}
              onClick={() => onSelect(p)}
              tabIndex={0}
              role="button"
              aria-label={`Mốc ${exam?.title ?? p.examId}, ${p.score.toFixed(2)} điểm`}
              onKeyDown={e => { if (e.key === 'Enter') onSelect(p) }}
            >
              <circle cx={p.cx} cy={p.cy} r="6" fill="transparent" />
              <circle cx={p.cx} cy={p.cy} r="4" fill="var(--paper)" stroke="var(--accent)" strokeWidth="1.5" />
              <circle cx={p.cx} cy={p.cy} r="2" fill="var(--accent)" />
            </g>
          )
        })}
      </svg>

      {hover && (() => {
        const p = points.find(pt => pt.id === hover)
        const exam = loadExamById(p.examId)
        const mins = Math.round(p.timeSpent / 60)
        return (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-2)', paddingTop: 6 }}>
            {exam?.title ?? p.examId} · {p.score.toFixed(2)}Đ · {mins}/{exam?.duration ?? '—'}′
          </div>
        )
      })()}

      <style>{`
        @keyframes vtg-draw-on { to { stroke-dashoffset: 0; } }
        @keyframes vtg-marker-in { to { opacity: 1; } }
      `}</style>
    </div>
  )
}

function JournalRow({ result, delta }) {
  const navigate = useNavigate()
  const exam = loadExamById(result.examId)
  const mins = Math.round(result.timeSpent / 60)
  const deltaNode = delta === null ? { text: '· LẦN ĐẦU LÀM ĐỀ NÀY', color: 'var(--ink-3)' } : fmtDelta(delta)

  if (!exam) {
    return (
      <div
        className="flex items-center justify-between gap-3 py-3 px-1 opacity-50"
        style={{ borderTop: '1px solid var(--line)' }}
      >
        <span className="font-display truncate" style={{ fontSize: 15, color: 'var(--ink-2)' }}>{result.examId}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>MỐC ĐÃ XÓA</span>
      </div>
    )
  }

  return (
    <Link
      to={`/results/${result.id}`}
      state={{ result }}
      className="flex items-center justify-between gap-3 py-3 px-1 transition-colors focus-visible:outline focus-visible:outline-2"
      style={{ borderTop: '1px solid var(--line)', outlineColor: 'var(--accent)', outlineOffset: '-2px' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--paper-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span className="font-display truncate" style={{ fontSize: 15, color: 'var(--ink)', flex: '1 1 auto', minWidth: 0 }}>{exam.title}</span>
      <span className="flex-shrink-0 text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
        {result.score.toFixed(2)}Đ · {mins}/{exam.duration} PHÚT
      </span>
      <span className="flex-shrink-0 text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: deltaNode.color, letterSpacing: '0.02em', minWidth: 148 }}>
        {deltaNode.text}
      </span>
    </Link>
  )
}

export default function History() {
  usePageMeta('Sổ leo núi', { noindex: true })
  const navigate = useNavigate()
  const { results } = useHistory()
  const [revealCount, setRevealCount] = useState(REVEAL_STEP * 2)
  const reducedMotionRef = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  const attempts = useMemo(() => buildAttempts(results), [results])
  const sortedDesc = useMemo(() => [...attempts].sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt)), [attempts])

  const bestScore = results.length ? Math.max(...results.map(r => r.score)) : 0

  const groups = useMemo(() => {
    const visible = sortedDesc.slice(0, revealCount)
    const out = []
    let current = null
    for (const r of visible) {
      const key = monthKey(r.finishedAt)
      if (!current || current.key !== key) {
        current = { key, label: monthLabel(r.finishedAt), rows: [] }
        out.push(current)
      }
      current.rows.push(r)
    }
    return out
  }, [sortedDesc, revealCount])

  function goToResult(attempt) {
    navigate(`/results/${attempt.id}`, { state: { result: attempt } })
  }

  return (
    <motion.div
      className="min-h-screen relative"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >
      <div className="relative z-[1] flex flex-col gap-8 px-6 sm:px-10 pt-24 pb-24 max-w-[880px] mx-auto w-full">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', color: 'var(--accent)' }}>
              — TRẠM · NHẬT KÝ
            </span>
            <h1 className="font-display font-bold" style={{ fontSize: 39, color: 'var(--ink)', lineHeight: 1.05 }}>
              Sổ leo núi của bạn.
            </h1>
            {results.length > 0 && (
              <p style={{ color: 'var(--ink-2)', maxWidth: '60ch' }}>
                Mỗi lần thi là một số đo. Sườn nào càng leo lại, đường zíc-zắc càng rõ.
              </p>
            )}
          </div>
          {results.length > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
              TỔNG {results.length} MỐC · CAO NHẤT {bestScore.toFixed(2)}Đ
            </span>
          )}
        </div>

        {results.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <SummitFlag size={56} />
            <p className="font-display font-semibold" style={{ fontSize: 20, color: 'var(--ink)' }}>
              Sổ còn trắng — cột mốc đầu tiên chưa được cắm.
            </p>
            <p style={{ color: 'var(--ink-2)', maxWidth: '48ch' }}>
              Chọn một đề ở trạm, làm hết mình. Trang này sẽ tự ghi lại.
            </p>
            <button
              onClick={() => navigate('/exams')}
              className="mt-2 px-5 py-2.5 font-bold"
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 12.5, letterSpacing: '0.04em',
                background: 'var(--accent)', color: 'var(--paper)', border: '1px solid var(--accent)', borderRadius: 'var(--r-sm)',
              }}
            >
              VỀ TRẠM CHỌN ĐỀ →
            </button>
          </div>
        )}

        {results.length === 1 && (() => {
          const only = attempts[0]
          const exam = loadExamById(only.examId)
          const mins = Math.round(only.timeSpent / 60)
          return (
            <div className="flex flex-col items-center gap-3 py-14 text-center" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
              <span className="font-display font-bold" style={{ fontSize: 61, color: 'var(--ink)', lineHeight: 1 }}>{only.score.toFixed(2)}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-2)' }}>
                {exam?.title ?? only.examId} · {mins}/{exam?.duration ?? '—'} PHÚT · {new Date(only.finishedAt).toLocaleDateString('vi-VN')}
              </span>
              <SummitFlag size={28} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--ink-3)' }}>
                MỐC ĐẦU TIÊN — SƯỜN MỚI BẮT ĐẦU HIỆN HÌNH
              </span>
              <button
                onClick={() => navigate('/exams')}
                className="mt-2 px-4 py-2 font-bold"
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.04em',
                  background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
                }}
              >
                LEO TIẾP ĐỂ VẼ SƯỜN →
              </button>
            </div>
          )
        })()}

        {results.length >= 2 && (
          <ElevationChart attempts={attempts} onSelect={goToResult} reducedMotion={reducedMotionRef.current} />
        )}

        {results.length > 0 && (
          <div className="flex flex-col">
            {groups.map((g, gi) => (
              <div key={g.key} style={{ borderBottom: gi === groups.length - 1 ? 'none' : undefined }}>
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--ink-3)', borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: gi === 0 ? 0 : 4 }}>
                  {g.label}
                </h3>
                {g.rows.map(r => (
                  <JournalRow key={r.id} result={r} delta={r.prevScore === null ? null : r.score - r.prevScore} />
                ))}
              </div>
            ))}
            {revealCount < results.length && (
              <button
                onClick={() => setRevealCount(c => c + REVEAL_STEP)}
                className="text-left py-3"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', letterSpacing: '0.04em' }}
              >
                + NÉT TIẾP ({Math.min(REVEAL_STEP, results.length - revealCount)})
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

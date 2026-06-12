import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { pageVariants } from '../utils/animations.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { useAuth } from '../context/AuthContext.jsx'

import { useHistory } from '../context/HistoryContext.jsx'
import { computeStreak } from '../utils/streak.js'
import { getDaysUntilExam, getExamYear } from '../utils/examCountdown.js'
import { useReadiness } from '../hooks/useReadiness.js'
import { loadQuestions } from '../api/index.js'
import { getSessionToday } from '../api/aiClient.js'
import { checkAndShowWeeklyReport } from '../utils/studyReminder.js'
import ZenithLogo from '../components/ZenithLogo.jsx'

const PLANS_MONTHLY = [
  {
    tier: 'basic', label: 'Cơ bản', price: 'Miễn phí', credits: 50,
    features: ['5 lượt Zenith AI/ngày', 'Tất cả chế độ thi', 'Thử thách hằng ngày'],
  },
  {
    tier: 'student', label: 'Học sinh', price: '29,000đ / tháng', credits: 500, badge: 'PHỔ BIẾN',
    features: ['Zenith AI không giới hạn', 'AI Phân tích miễn phí', 'Thưởng chuỗi học', 'Xu hướng 30 ngày', 'Kế hoạch học'],
  },
  {
    tier: 'complete', label: 'Toàn diện', price: '59,000đ / tháng', credits: 2000,
    features: ['Tất cả gói Học sinh', 'Tạo đề AI riêng', 'Dự đoán điểm số', 'Kế hoạch thích nghi AI', 'Chiến lược thi', 'So sánh tỉnh thành'],
  },
]

const TOPUP_PACKAGES = [
  { price: '15,000đ', credits: 150 },
  { price: '29,000đ', credits: 350 },
  { price: '59,000đ', credits: 800 },
]

// ── Landing Video — Remotion-rendered MP4 with Framer Motion fallback ─────────
// The video is pre-rendered via `npm run video:render` and committed to public/.
// Until it exists, the Framer Motion showcase is shown instead.
function LandingVideo({ fallback }) {
  const [videoExists, setVideoExists] = useState(true)

  function handleError() { setVideoExists(false) }

  if (!videoExists) return fallback

  return (
    <div className="w-full max-w-3xl rounded-2xl overflow-hidden border border-surface shadow-2xl" style={{ aspectRatio: '16/9' }}>
      <video
        src="/landing-demo.mp4"
        autoPlay
        loop
        muted
        playsInline
        onError={handleError}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  )
}

// ── Feature Showcase — auto-cycling demo of key features ─────────────────────
const SCENES = [
  {
    id: 'exam',
    label: 'Thi thử',
    icon: '📋',
    accent: '#6366F1',
    headline: '40+ đề thi thật từ 63 tỉnh thành',
    sub: 'Thi có thời gian, luyện tập, hoặc tạo đề AI riêng',
    preview: [
      { text: 'Đề Toán THPT Quốc gia 2024 — Hà Nội', score: '8.0', color: '#34D399' },
      { text: 'Đề Toán Tuyển sinh Lớp 10 — TP.HCM', score: '6.5', color: '#F59E0B' },
      { text: 'AMC 10A 2023 — Luyện tập nâng cao', score: '7.2', color: '#818CF8' },
    ],
  },
  {
    id: 'oracle',
    label: 'Zenith AI',
    icon: '✦',
    accent: '#818CF8',
    headline: 'Giải từng bước — không phải chỉ đáp án',
    sub: 'Nhập bài toán bất kỳ, nhận lời giải rõ ràng và gợi ý Socratic',
    preview: [
      { step: '①', text: 'Phân tích điều kiện: x > 0, hàm f liên tục trên (0,∞)' },
      { step: '②', text: 'Áp dụng quy tắc L\'Hôpital cho dạng 0/0' },
      { step: '③', text: 'Kết luận: giới hạn = 2/3' },
    ],
  },
  {
    id: 'analysis',
    label: 'Phân tích AI',
    icon: '🎯',
    accent: '#FB7185',
    headline: 'AI chỉ đúng điểm yếu của bạn',
    sub: 'Không đoán mò — phát hiện chính xác lỗi sai và đề xuất cách sửa',
    preview: [
      { topic: 'Hàm số', pct: 42, color: '#EF4444', note: '⚠ Yếu' },
      { topic: 'Hình học không gian', pct: 65, color: '#F59E0B', note: '→ Cần cải thiện' },
      { topic: 'Tích phân', pct: 83, color: '#34D399', note: '✓ Tốt' },
    ],
  },
  {
    id: 'map',
    label: 'Bản đồ',
    icon: '🗺',
    accent: '#34D399',
    headline: 'Bản đồ kiến thức cá nhân hoá',
    sub: 'Nhìn thấy toàn bộ lộ trình học — từ lớp 9 đến 12, nút nào yếu, nút nào vững',
    preview: [
      { concept: 'Phương trình bậc nhất', mastery: 95, color: '#22C55E' },
      { concept: 'Hàm số mũ & log', mastery: 51, color: '#F59E0B' },
      { concept: 'Giải tích tổ hợp', mastery: 18, color: '#EF4444' },
    ],
  },
]

// ── Demo 1: Mastery Map Preview ───────────────────────────────────────────────
const MAP_CONCEPTS = [
  { id: 'eq1', name: 'Phương trình bậc nhất', afterStage: 5 },
  { id: 'eq2', name: 'Phương trình bậc hai', afterStage: 4 },
  { id: 'ineq', name: 'Bất phương trình', afterStage: 4 },
  { id: 'fn1', name: 'Hàm số bậc nhất', afterStage: 5 },
  { id: 'fn2', name: 'Hàm số bậc hai', afterStage: 3 },
  { id: 'log', name: 'Hàm logarithm', afterStage: 2 },
  { id: 'exp', name: 'Hàm số mũ', afterStage: 2 },
  { id: 'trig', name: 'Lượng giác', afterStage: 1 },
  { id: 'geo2d', name: 'Hình học phẳng', afterStage: 4 },
  { id: 'geo3d', name: 'Hình học không gian', afterStage: 3 },
  { id: 'calc', name: 'Giải tích', afterStage: 1 },
  { id: 'prob', name: 'Xác suất thống kê', afterStage: 3 },
]

const STAGE_NODE_COLOR = ['var(--fg-tertiary)', 'var(--mastery-1)', 'var(--mastery-2)', 'var(--mastery-3)', 'var(--mastery-4)', 'var(--mastery-5)']
const STAGE_NODE_BG    = ['var(--surface)', 'var(--mastery-1-bg)', 'var(--mastery-2-bg)', 'var(--mastery-3-bg)', 'var(--mastery-4-bg)', 'var(--mastery-5-bg)']
const STAGE_NAME_VI    = ['Chưa học', 'Bắt đầu', 'Đang học', 'Khá tốt', 'Thành thạo', 'Xuất sắc']

function Demo1MasteryMap() {
  const [showAfter, setShowAfter] = useState(false)
  const [hovered, setHovered] = useState(null)
  return (
    <div className="flex flex-col gap-4 text-left w-full max-w-3xl">
      <div className="text-center">
        <span className="font-sans text-[11px] font-semibold tracking-[3px] uppercase text-dim">Bản đồ kiến thức</span>
        <h2 className="font-sans text-[28px] font-bold text-foreground mt-2">
          Nhìn thấy chính xác bạn đang ở đâu
        </h2>
        <p className="font-sans text-[13px] text-dim mt-1">Mỗi khái niệm bạn luyện tập đều được theo dõi tự động.</p>
      </div>

      {/* Before/after toggle */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setShowAfter(false)}
          className="px-4 py-1.5 rounded-full font-sans text-[12px] font-semibold transition"
          style={!showAfter
            ? { background: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)' }
            : { background: 'transparent', color: 'var(--dim)', border: '1px solid var(--surface)' }
          }
        >
          Trước khi dùng Zenith
        </button>
        <button
          onClick={() => setShowAfter(true)}
          className="px-4 py-1.5 rounded-full font-sans text-[12px] font-semibold transition"
          style={showAfter
            ? { background: 'var(--primary)', color: 'var(--primary-fg)', border: '1px solid var(--primary-border)' }
            : { background: 'transparent', color: 'var(--dim)', border: '1px solid var(--surface)' }
          }
        >
          Sau 3 tuần ôn tập →
        </button>
      </div>

      {/* Concept grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 relative">
        {MAP_CONCEPTS.map(c => {
          const stage = showAfter ? c.afterStage : 0
          const isHov = hovered === c.id
          return (
            <motion.div
              key={c.id}
              layout
              animate={{
                background: STAGE_NODE_BG[stage],
                borderColor: STAGE_NODE_COLOR[stage] + (isHov ? 'FF' : '99'),
                scale: isHov ? 1.04 : 1,
              }}
              transition={{ duration: 0.4 }}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              className="rounded-xl border p-3 cursor-default select-none flex flex-col gap-1 relative"
            >
              <p className="font-sans text-[11px] font-semibold leading-tight" style={{ color: STAGE_NODE_COLOR[stage] }}>
                {c.name}
              </p>
              <p className="font-sans text-[9px]" style={{ color: STAGE_NODE_COLOR[stage] + '99' }}>
                {STAGE_NAME_VI[stage]}
              </p>
              {/* Tooltip on hover */}
              {isHov && showAfter && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -top-10 left-0 z-20 px-2.5 py-1.5 rounded-lg text-[10px] font-sans font-semibold whitespace-nowrap pointer-events-none"
                  style={{ background: STAGE_NODE_BG[c.afterStage], border: `1px solid ${STAGE_NODE_COLOR[c.afterStage]}55`, color: STAGE_NODE_COLOR[c.afterStage] }}
                >
                  {STAGE_NAME_VI[c.afterStage]} · {c.afterStage * 20}% thành thạo
                </motion.div>
              )}
            </motion.div>
          )
        })}
      </div>
      <p className="font-sans text-[12px] text-dim text-center">
        Zenith tự động cập nhật bản đồ sau mỗi bài làm — không cần cài đặt.
      </p>
    </div>
  )
}

// ── Demo 3: Adaptive Recommendations ─────────────────────────────────────────
const DEMO_RECS = [
  { rank: '①', title: 'Ôn lại: Logarithm', sub: 'Bạn sai 3/4 câu trong bài vừa làm', color: '#EF4444' },
  { rank: '②', title: 'Luyện tập: Hàm số', sub: 'Chiếm 18% đề thi — cần nắm chắc', color: '#F59E0B' },
  { rank: '③', title: 'Ưu tiên: Giải tích', sub: '3 câu phổ biến trong đề gần đây', color: '#818CF8' },
]

function Demo3Recommendations({ onOpenAuth }) {
  const [clicked, setClicked] = useState(false)
  return (
    <div className="flex flex-col gap-4 text-left w-full max-w-3xl">
      <div className="text-center">
        <span className="font-sans text-[11px] font-semibold tracking-[3px] uppercase text-dim">Đề xuất thích nghi</span>
        <h2 className="font-sans text-[28px] font-bold text-foreground mt-2">
          Zenith biết bạn nên học gì tiếp theo
        </h2>
        <p className="font-sans text-[13px] text-dim mt-1">Dựa trên học sinh lớp 12 tại Hà Nội, điểm 6.2</p>
      </div>
      <div className="relative flex flex-col gap-2">
        {DEMO_RECS.map((rec, i) => (
          <motion.div
            key={rec.rank}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => setClicked(true)}
            className="flex items-center gap-4 px-5 py-4 rounded-xl bg-surface border border-surface cursor-pointer hover:border-border transition-colors"
          >
            <span className="font-sans text-[22px] font-bold flex-shrink-0" style={{ color: rec.color }}>{rec.rank}</span>
            <div className="flex-1 min-w-0">
              <p className="font-sans text-[13px] font-semibold text-foreground">{rec.title}</p>
              <p className="font-sans text-[11px] text-dim">{rec.sub}</p>
            </div>
            <span className="font-sans text-[12px] text-dim flex-shrink-0">→</span>
          </motion.div>
        ))}

        {/* Blur + CTA overlay on click */}
        {clicked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 rounded-xl flex items-center justify-center"
            style={{ backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.55)' }}
          >
            <div className="flex flex-col items-center gap-3 text-center px-4">
              <p className="font-sans text-[14px] font-semibold text-foreground">Đăng nhập để xem lộ trình của bạn</p>
              <button
                onClick={onOpenAuth}
                className="px-5 py-2.5 rounded-xl font-sans text-[13px] font-bold text-primary-fg bg-primary hover:opacity-90 transition"
              >
                Bắt đầu miễn phí →
              </button>
              <button onClick={() => setClicked(false)} className="font-sans text-[11px] text-dim hover:text-muted transition">
                Xem ví dụ
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ── Demo 4: Score Prediction Slider ──────────────────────────────────────────
function Demo4ScoreSlider({ onOpenAuth }) {
  const [current, setCurrent] = useState(6.0)
  const weeks = Math.round((current - 4) * 2)
  const gain = Math.min(2.5, Math.max(0.3, (current - 4) * 0.35 + 0.4))
  const predicted = Math.min(10, current + gain)
  const lo = Math.max(current, predicted - 0.7).toFixed(1)
  const hi = Math.min(10, predicted + 0.5).toFixed(1)
  const onTrack = predicted >= 7.0
  return (
    <div className="flex flex-col gap-4 text-left w-full max-w-3xl">
      <div className="text-center">
        <span className="font-sans text-[11px] font-semibold tracking-[3px] uppercase text-dim">Dự đoán điểm</span>
        <h2 className="font-sans text-[28px] font-bold text-foreground mt-2">
          Bạn có thể đạt bao nhiêu điểm?
        </h2>
        <p className="font-sans text-[13px] text-dim mt-1">Điều chỉnh điểm hiện tại để xem dự đoán Zenith</p>
      </div>
      <div className="bg-surface border border-surface rounded-2xl p-6 flex flex-col gap-5">
        {/* Slider */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between font-sans text-[12px]">
            <span className="text-dim">Điểm thi thử hiện tại</span>
            <span className="font-bold text-foreground text-[16px]">{current.toFixed(1)}</span>
          </div>
          <input
            type="range" min="4" max="9.5" step="0.5"
            value={current}
            onChange={e => setCurrent(parseFloat(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: 'var(--primary)' }}
          />
          <div className="flex justify-between font-sans text-[10px] text-dim">
            <span>4.0</span><span>6.0</span><span>8.0</span><span>9.5</span>
          </div>
        </div>

        {/* Prediction */}
        <div className={`rounded-xl px-5 py-4 flex items-center justify-between gap-4 border ${onTrack ? 'border-success/30 bg-success/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
          <div className="flex flex-col gap-0.5">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-dim">Dự đoán sau {Math.max(2, weeks)} tuần</p>
            <div className="flex items-baseline gap-2">
              <span className="font-sans text-[28px] font-bold" style={{ color: onTrack ? 'var(--success)' : 'var(--warning)' }}>{predicted.toFixed(1)}</span>
              <span className="font-sans text-[12px] text-dim">({lo} – {hi})</span>
            </div>
            <p className="font-sans text-[11px] text-dim">
              {onTrack ? '↗ Đang tiến đúng hướng để đạt mục tiêu' : '⚠ Cần tăng tốc luyện tập để bứt phá'}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenAuth}
          className="w-full py-3 rounded-xl font-sans text-[13px] font-bold text-primary-fg bg-primary hover:opacity-90 transition"
        >
          Nhận dự đoán chính xác của bạn →
        </button>
        <p className="font-sans text-[11px] text-dim text-center">Dự đoán thực dùng thuật toán Kalman dựa trên lịch sử làm bài của bạn</p>
      </div>
    </div>
  )
}

function FeatureShowcase() {
  const [active, setActive] = useState(0)
  const timerRef = useRef(null)

  function startTimer() {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setActive(i => (i + 1) % SCENES.length), 4000)
  }

  useEffect(() => { startTimer(); return () => clearInterval(timerRef.current) }, [])

  function pick(i) { setActive(i); startTimer() }

  const scene = SCENES[active]

  return (
    <div className="w-full max-w-3xl flex flex-col gap-5">
      {/* Tab row */}
      <div className="flex items-center gap-2 justify-center flex-wrap">
        {SCENES.map((s, i) => (
          <button key={s.id} onClick={() => pick(i)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full font-sans text-[12px] font-semibold transition"
            style={active === i
              ? { background: s.accent + '22', border: `1px solid ${s.accent}55`, color: s.accent }
              : { background: 'transparent', border: '1px solid var(--surface)', color: 'var(--dim)' }
            }>
            <span>{s.icon}</span> {s.label}
          </button>
        ))}
      </div>

      {/* Scene card */}
      <motion.div
        key={scene.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="bg-surface border border-surface rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-stretch min-h-[180px]"
      >
        {/* Left: text */}
        <div className="flex-1 flex flex-col justify-center gap-3">
          <div>
            <p className="font-sans text-[18px] font-bold text-foreground leading-snug">{scene.headline}</p>
            <p className="font-sans text-[13px] text-dim mt-1.5">{scene.sub}</p>
          </div>
          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {SCENES.map((s, i) => (
              <motion.div key={s.id}
                animate={{ width: active === i ? 24 : 6, background: active === i ? scene.accent : 'var(--border)' }}
                className="h-1.5 rounded-full cursor-pointer"
                onClick={() => pick(i)}
              />
            ))}
          </div>
        </div>

        {/* Right: mockup preview */}
        <div className="flex-1 flex flex-col gap-2 justify-center">
          {scene.id === 'exam' && scene.preview.map((r, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface border border-surface">
              <span className="font-sans text-[12px] text-muted truncate flex-1 mr-2">{r.text}</span>
              <span className="font-sans text-[12px] font-bold flex-shrink-0" style={{ color: r.color }}>{r.score}</span>
            </motion.div>
          ))}
          {scene.id === 'oracle' && scene.preview.map((r, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-2.5">
              <span className="font-sans text-[13px] font-bold flex-shrink-0" style={{ color: scene.accent }}>{r.step}</span>
              <span className="font-sans text-[12px] text-muted leading-relaxed">{r.text}</span>
            </motion.div>
          ))}
          {scene.id === 'analysis' && scene.preview.map((r, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex flex-col gap-0.5">
              <div className="flex justify-between font-sans text-[11px]">
                <span className="text-muted">{r.topic}</span>
                <span style={{ color: r.color }}>{r.pct}% {r.note}</span>
              </div>
              <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full"
                  initial={{ width: 0 }} animate={{ width: `${r.pct}%` }}
                  transition={{ delay: i * 0.08 + 0.2, duration: 0.6 }}
                  style={{ background: r.color }} />
              </div>
            </motion.div>
          ))}
          {scene.id === 'map' && scene.preview.map((r, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface border border-surface">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color }} />
              <span className="font-sans text-[12px] text-muted flex-1 truncate">{r.concept}</span>
              <span className="font-sans text-[11px] font-bold flex-shrink-0" style={{ color: r.color }}>{r.mastery}%</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export default function Landing({ onOpenAuth }) {
  usePageMeta('', { description: 'Ôn tập Toán với 40+ đề thi thật từ 63 tỉnh thành — AI phát hiện lỗi sai, tạo kế hoạch học tập cá nhân hóa cho học sinh THPT & lớp 10.' })
  const navigate = useNavigate()
  const { user } = useAuth()
  const { results } = useHistory()
  const [searchParams] = useSearchParams()
  const [session, setSession] = useState(null) // server session data for logged-in users
  const [questionMap, setQuestionMap] = useState({})
  const [showStickyCta, setShowStickyCta] = useState(false)
  const streak = useMemo(() => computeStreak(results), [results])
  const daysUntil = user ? getDaysUntilExam(user.province) : null
  const province  = user?.province ?? 'Hà Nội'
  const readiness = useReadiness(results, questionMap)
  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 400], [0, -30])

  useEffect(() => {
    return scrollY.on('change', v => setShowStickyCta(v > 480))
  }, [scrollY])

  useEffect(() => {
    if (!user?.id) { setSession(null); return }
    getSessionToday().then(({ data }) => { if (data) setSession(data) }).catch(() => {})
  }, [user?.id])

  // Weekly report — fires once per week on Sun/Mon using available local data
  useEffect(() => {
    if (!user || !session) return
    const recentScores = results.slice(0, 7).map(r => r.score ?? 0)
    const avgAccuracy = recentScores.length
      ? Math.round((recentScores.reduce((a, b) => a + b, 0) / recentScores.length) * 10)
      : null
    checkAndShowWeeklyReport({
      streak: session.learning_streak ?? streak,
      masteredThisWeek: 0,
      accuracyTrend: avgAccuracy,
    })
  }, [user?.id, session?.session_date]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !results.length) return
    loadQuestions().then(qs => setQuestionMap(Object.fromEntries(qs.map(q => [q.id, q])))).catch(() => {})
  }, [user, results.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Store referral code before user logs in
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref && /^[A-Za-z0-9_-]{8,20}$/.test(ref)) {
      try { sessionStorage.setItem('pending_ref', ref) } catch { /* ignore */ }
    }
  }, [searchParams])

  return (
    <motion.div
      className="min-h-screen relative overflow-hidden flex flex-col items-center"
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
    >

      {/* Sticky header CTA — appears after scrolling past hero */}
      <motion.div
        initial={false}
        animate={{ y: showStickyCta ? 0 : -64, opacity: showStickyCta ? 1 : 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 border-b border-surface"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      >
        <span className="font-sans text-[15px] font-bold text-foreground">Zenith</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/exams')}
            className="px-4 py-2 rounded-lg font-sans text-[12px] font-semibold text-primary-fg bg-primary hover:opacity-90 transition"
          >
            Bắt đầu miễn phí →
          </button>
          {!user && (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2 rounded-lg font-sans text-[12px] font-semibold text-muted border border-surface hover:text-foreground transition"
            >
              Đăng nhập
            </button>
          )}
        </div>
      </motion.div>

      {/* Hero section */}
      <div
        className="relative z-10 flex flex-col items-center gap-10 text-center px-6 sm:px-8 pt-20 pb-16 w-full"
      >
        <motion.div style={{ y: heroY }} className="flex flex-col items-center gap-5">
          <ZenithLogo variant="hero" />
          <span className="font-sans text-[11px] font-semibold text-primary tracking-[3px] uppercase">
            Kỳ thi tuyển sinh {getExamYear()} · Toán Lớp 10
          </span>
          <h1 className="font-sans text-[56px] sm:text-[72px] font-bold text-foreground leading-[1.05] text-center">
            <motion.span
              className="block"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            >
              {['Học', 'để', 'hiểu,'].map((word, i) => (
                <motion.span
                  key={i}
                  className="inline-block mr-[0.25em]"
                  variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } } }}
                >{word}</motion.span>
              ))}
            </motion.span>
            <motion.span
              className="block text-primary"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.22 } } }}
            >
              {['không', 'học', 'để', 'quên.'].map((word, i) => (
                <motion.span
                  key={i}
                  className="inline-block mr-[0.25em]"
                  variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } } }}
                >{word}</motion.span>
              ))}
            </motion.span>
          </h1>
          <p className="font-sans text-[17px] text-muted leading-relaxed max-w-[600px] text-center">
            Zenith phân tích từng bài thi, tìm đúng điểm yếu của bạn, và tạo lộ trình ôn tập cá nhân.<br />
            <span className="text-dim text-[15px]">
              Dữ liệu thực từ đề thi {province} · AI phát hiện lỗi sai và chỉ cách sửa.
            </span>
          </p>
        </motion.div>

        {/* Oracle input + secondary links */}
        <div className="w-full max-w-xl flex flex-col items-center gap-4">
          <form
            className="w-full flex items-center gap-2 bg-surface border border-info/30 rounded-xl px-4 py-3 focus-within:border-info/50 transition"
            onSubmit={e => {
              e.preventDefault()
              const q = e.target.query.value.trim()
              navigate(q ? `/oracle?q=${encodeURIComponent(q)}` : '/oracle')
            }}
          >
            <span className="text-info text-base select-none flex-shrink-0">✦</span>
            <input
              name="query"
              placeholder="Nhập bài toán cần giải..."
              className="flex-1 bg-transparent font-sans text-[15px] text-foreground placeholder-dim outline-none min-w-0"
            />
            <button type="submit"
              className="flex-shrink-0 px-4 py-1.5 rounded-lg bg-info text-white font-sans text-[13px] font-semibold hover:bg-info/80 transition">
              Hỏi →
            </button>
          </form>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-3">
              <motion.button onClick={() => navigate('/exams')}
                className="px-5 py-2.5 rounded-xl font-sans text-[13px] font-bold text-background bg-primary hover:opacity-90 transition"
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                Thi thử ngay →
              </motion.button>
              <motion.button onClick={() => navigate('/diagnostic')}
                className="px-5 py-2.5 rounded-xl font-sans text-[13px] font-semibold text-muted border border-surface hover:border-primary/30 hover:text-foreground transition"
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                Kiểm tra năng lực
              </motion.button>
            </div>
            {!user && (
              <p className="font-sans text-[11px] text-dim">
                Không cần tạo tài khoản · Xem ngay kết quả
              </p>
            )}
          </div>
        </div>

        {/* Today card — logged-in users */}
        {user && (
          <div
            className="w-full max-w-xl bg-surface border border-surface rounded-2xl px-5 py-4 flex items-center gap-5 flex-wrap"
          >
            {session?.placement_needed && (
              <button onClick={() => navigate('/placement')}
                className="flex items-center gap-1.5 font-sans text-[13px] font-semibold text-info hover:opacity-80 transition">
                <span className="w-1.5 h-1.5 rounded-full bg-info " />
                Bắt đầu kiểm tra năng lực →
              </button>
            )}
            {session?.pending_count > 0 && (
              <button onClick={() => navigate('/daily')}
                className="flex items-center gap-1.5 font-sans text-[13px] font-semibold text-primary hover:opacity-80 transition">
                <span className="w-1.5 h-1.5 rounded-full bg-primary " />
                {session.pending_count} câu sai đang chờ — thử lại không?
              </button>
            )}
            {(session?.learning_streak > 0 || streak > 0) && (
              <motion.span
                className="font-sans text-[13px] font-semibold text-primary"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span className="streak-fire">🔥</span> {session?.learning_streak ?? streak} ngày
              </motion.span>
            )}
            {daysUntil != null && (
              <span className="font-sans text-[13px] font-semibold text-info">📅 Còn {daysUntil} ngày</span>
            )}
            {(session?.due_count > 0) && (
              <button onClick={() => navigate('/review')}
                className="flex items-center gap-1.5 font-sans text-[13px] font-semibold text-success hover:opacity-80 transition">
                <span className="w-1.5 h-1.5 rounded-full bg-success " />
                {session.due_count} câu cần ôn
              </button>
            )}
            {session?.remediation_concept && (session.remediation_concept.error_count ?? 0) >= 3 && (
              <button onClick={() => navigate('/review')}
                className="flex items-center gap-1.5 font-sans text-[13px] font-semibold text-destructive hover:opacity-80 transition">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive " />
                Sửa lỗi {session.remediation_concept.name_vi} →
              </button>
            )}
            {session?.advance_concept && !session?.is_complete && (
              <button onClick={() => navigate('/practice/adaptive')}
                className="flex items-center gap-1.5 font-sans text-[13px] font-semibold text-info hover:opacity-80 transition">
                ✦ Học {session.advance_concept.name_vi}
              </button>
            )}
            {readiness != null && (
              <span className="font-sans text-[13px] font-semibold text-info">
                📊 {readiness.readiness}% sẵn sàng
              </span>
            )}
            {session?.predicted_score != null && (
              <button
                onClick={() => navigate('/study-plan/adaptive')}
                className="flex items-center gap-1.5 font-sans text-[13px] font-semibold hover:opacity-80 transition"
                style={{ color: session.on_track ? 'var(--success)' : 'var(--accent)' }}
              >
                {session.on_track ? '↗' : '⚠'} Dự kiến {session.predicted_score?.toFixed(1)}
              </button>
            )}
            <button onClick={() => navigate('/progress')}
              className="font-sans text-[12px] text-dim hover:text-muted transition">
              Bản đồ
            </button>
            <button onClick={() => navigate('/history')}
              className="ml-auto font-sans text-[12px] text-dim hover:text-muted transition">
              Lịch sử →
            </button>
          </div>
        )}

        {/* Ghost Today card — guests only: teases personalization to drive signup */}
        {!user && (
          <div className="w-full max-w-xl relative rounded-2xl border border-surface overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-5 flex-wrap blur-[3px] pointer-events-none select-none opacity-60">
              <span className="font-sans text-[13px] font-semibold text-primary">🔥 12 ngày</span>
              <span className="font-sans text-[13px] font-semibold text-info">📅 Còn 47 ngày</span>
              <span className="font-sans text-[13px] font-semibold text-success">📊 72% sẵn sàng</span>
              <span className="font-sans text-[13px] font-semibold text-info">↗ Dự kiến 7.5</span>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-surface/60 backdrop-blur-[1px]">
              <button
                onClick={onOpenAuth}
                className="px-5 py-2.5 rounded-xl font-sans text-[13px] font-bold text-background bg-primary hover:opacity-90 transition shadow-lg">
                Đăng nhập để xem lộ trình của bạn →
              </button>
            </div>
          </div>
        )}

        {/* Proof strip */}
        <div className="flex items-center gap-2 flex-wrap justify-center font-sans text-[13px] text-dim">
          {[
            { value: '1,104', label: 'câu từ đề thi thật', color: '#6366F1' },
            { value: '63', label: 'tỉnh thành', color: '#6366F1' },
            { value: '6', label: 'dạng toán có Zenith AI', color: '#818CF8' },
            { value: 'FSRS', label: 'ghi nhớ thông minh', color: '#34D399' },
          ].map(({ value, label, color }, i, arr) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="font-sans font-bold text-[15px]" style={{ color }}>{value}</span>
              <span>{label}</span>
              {i < arr.length - 1 && <span className="text-border mx-2">·</span>}
            </span>
          ))}
        </div>

        {/* Benefits strip */}
        <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-3 px-0">
          {[
            {
              icon: '✦', iconColor: '#818CF8',
              title: 'Zenith AI',
              desc: 'Hỏi bất kỳ bài toán — nhận lời giải từng bước rõ ràng trong vài giây',
            },
            {
              icon: '🎯', iconColor: '#F2A20C',
              title: 'Biết bạn yếu ở đâu',
              desc: 'AI phân tích từng bài làm, chỉ đúng lỗi sai — không đoán mò khi ôn thi',
            },
            {
              icon: '📋', iconColor: '#34D399',
              title: 'Đề thật, không đề luyện',
              desc: 'Tất cả từ đề thi tuyển sinh chính thức — mô phỏng đúng cấu trúc kỳ thi',
            },
          ].map(({ icon, iconColor, title, desc }) => (
            <div key={title}
              className="flex flex-col gap-2 bg-surface border border-surface rounded-2xl px-5 py-4 text-left">
              <span className="text-xl" style={{ color: iconColor }}>{icon}</span>
              <span className="font-sans text-[14px] font-semibold text-foreground">{title}</span>
              <span className="font-sans text-[12px] text-dim leading-relaxed">{desc}</span>
            </div>
          ))}
        </div>
        {/* ── Problem section ── */}
        <div className="w-full max-w-3xl flex flex-col gap-5 text-center">
          <span className="font-sans text-[11px] font-semibold tracking-[3px] uppercase text-dim">Vấn đề</span>
          <h2 className="font-sans text-[28px] font-bold text-foreground leading-tight">
            Ôn thi không thiếu đề — thiếu hướng dẫn đúng chỗ
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {[
              { icon: '📚', problem: 'Làm rất nhiều đề', reality: 'Nhưng lặp lại lỗi cũ mà không biết tại sao' },
              { icon: '⏱', problem: 'Học theo lịch cố định', reality: 'Nhưng không biết khái niệm nào thật sự yếu' },
              { icon: '😓', problem: 'Tự học là chính', reality: 'Nhưng không có phản hồi cụ thể sau mỗi bài làm' },
            ].map(({ icon, problem, reality }) => (
              <div key={problem} className="bg-surface border border-surface rounded-xl p-4 flex flex-col gap-2">
                <span className="text-2xl">{icon}</span>
                <p className="font-sans text-[13px] font-semibold text-foreground">{problem}</p>
                <p className="font-sans text-[12px] text-dim leading-relaxed">{reality}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── How Zenith Works ── */}
        <div className="w-full max-w-3xl flex flex-col gap-5">
          <div className="text-center">
            <span className="font-sans text-[11px] font-semibold tracking-[3px] uppercase text-dim">Cách hoạt động</span>
            <h2 className="font-sans text-[28px] font-bold text-foreground mt-2">3 bước từ đề thi đến làm chủ kiến thức</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { step: '01', title: 'Làm đề thật', desc: `Chọn đề từ ${province} — Zenith theo dõi từng câu đúng sai và tính trọng số theo cấu trúc đề thật` },
              { step: '02', title: 'AI phân tích điểm yếu', desc: 'Tìm ra lỗi sai cụ thể và khái niệm cần củng cố — không đoán chung chung theo chủ đề' },
              { step: '03', title: 'Luyện đúng chỗ', desc: 'Thuật toán FSRS lên lịch ôn tập cá nhân — học ít hơn, nhớ lâu hơn' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col gap-3 bg-surface border border-surface rounded-xl p-5">
                <span className="font-sans text-[32px] font-bold text-primary/30 leading-none">{step}</span>
                <p className="font-sans text-[14px] font-semibold text-foreground">{title}</p>
                <p className="font-sans text-[12px] text-dim leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Demo 1: Mastery Map Preview ── */}
        <Demo1MasteryMap />

        {/* Feature showcase — Remotion video if rendered, Framer Motion demo as fallback */}
        <LandingVideo fallback={<FeatureShowcase />} />

        {/* ── Error Analysis Demo (Demo 2) ── */}
        <div className="w-full max-w-3xl flex flex-col gap-5">
          <div className="text-center">
            <span className="font-sans text-[11px] font-semibold tracking-[3px] uppercase text-dim">Phân tích lỗi sai</span>
            <h2 className="font-sans text-[28px] font-bold text-foreground mt-2">
              Zenith không chỉ chấm điểm — mà giải thích tại sao sai
            </h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-5 items-stretch text-left">
            {/* Left: error analysis card */}
            <div className="flex-1 bg-surface border border-surface rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5 pb-3 border-b border-surface">
                <p className="font-sans text-[10px] font-bold tracking-[2px] uppercase text-dim">Câu hỏi</p>
                <p className="font-sans text-[13px] text-foreground">Tìm tập xác định của f(x) = log₂(x² − 4x + 3)</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-destructive/15 text-destructive font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">✗</span>
                <div>
                  <p className="font-sans text-[10px] text-dim uppercase tracking-wide mb-0.5">Bạn chọn</p>
                  <p className="font-sans text-[13px] text-muted">A. (1; 3)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-success/15 text-success font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">✓</span>
                <div>
                  <p className="font-sans text-[10px] text-dim uppercase tracking-wide mb-0.5">Đáp án đúng</p>
                  <p className="font-sans text-[13px] text-foreground font-semibold">B. (−∞; 1) ∪ (3; +∞)</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-3 border-t border-surface">
                <p className="font-sans text-[10px] font-bold tracking-[2px] uppercase text-dim">Phân tích lỗi</p>
                <div className="bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2.5">
                  <p className="font-sans text-[12px] text-muted leading-relaxed">
                    Quên đảo chiều bất phương trình khi tìm điều kiện đối số logarithm — x² − 4x + 3 {'>'} 0 cho phần bù của (1; 3), không phải chính (1; 3).
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['Hàm logarithm', 'Miền xác định', 'Bất phương trình bậc hai'].map(tag => (
                    <span key={tag} className="font-sans text-[10px] px-2 py-0.5 rounded-full bg-info/10 text-info border border-info/20">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            {/* Right: explanation */}
            <div className="flex-1 flex flex-col justify-center gap-4">
              <p className="font-sans text-[20px] font-bold text-foreground leading-tight">
                AI không chỉ chấm điểm — AI <span className="text-primary">tìm ra lỗi sai</span> của bạn
              </p>
              {[
                { step: '①', text: 'Đọc từng câu trả lời và so sánh với lời giải chuẩn' },
                { step: '②', text: 'Phát hiện pattern lỗi: sai công thức, sai dấu, lỗ hổng khái niệm' },
                { step: '③', text: 'Đề xuất bài luyện đúng điểm yếu — không luyện lan man' },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-3">
                  <span className="font-sans text-[15px] font-bold text-primary flex-shrink-0">{step}</span>
                  <span className="font-sans text-[13px] text-muted leading-relaxed">{text}</span>
                </div>
              ))}
              <button
                onClick={() => user ? navigate('/exams') : onOpenAuth()}
                className="self-start mt-2 font-sans text-[13px] font-semibold text-primary hover:opacity-80 transition">
                {user ? 'Làm bài thử để xem phân tích →' : 'Đăng ký để xem lỗi của bạn →'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Demo 3: Adaptive Recommendations ── */}
        <Demo3Recommendations onOpenAuth={onOpenAuth} />

        {/* ── Demo 4: Score Prediction Slider ── */}
        <Demo4ScoreSlider onOpenAuth={onOpenAuth} />

        {/* ── Methodology — Phase 4 §8 ── */}
        <div className="w-full max-w-3xl flex flex-col gap-5">
          <div className="text-center">
            <span className="font-sans text-[11px] font-semibold tracking-[3px] uppercase text-dim">Tại sao nó hoạt động</span>
            <h2 className="font-sans text-[28px] font-bold text-foreground mt-2">
              Khoa học đằng sau Zenith
            </h2>
            <p className="font-sans text-[13px] text-dim mt-1 max-w-[540px] mx-auto">
              Không phải trực giác. Không phải tông học. Là thuật toán được nghiên cứu và kiểm chứng.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: '🔁',
                name: 'FSRS v5',
                tag: 'Ghi nhớ lâu dài',
                desc: 'Thuật toán lặp lại ngắt quãng thế hệ mới — dùng bởi hàng triệu người trên Anki. Zenith tính toán thời điểm tối ưu để ôn lại từng khái niệm, trước khi bạn quên.',
                color: '#10B981',
              },
              {
                icon: '📐',
                name: 'Bayesian KT',
                tag: 'Đánh giá năng lực',
                desc: 'Bayesian Knowledge Tracing cập nhật xác suất "biết" của bạn sau mỗi câu trả lời — không phải chỉ đếm đúng/sai. Zenith tự điều chỉnh độ khó theo thực trạng học của bạn.',
                color: '#818CF8',
              },
              {
                icon: '🗺',
                name: 'Chuẩn hoá tỉnh',
                tag: 'Dữ liệu thực tế',
                desc: 'Trọng số từng chủ đề được hiệu chỉnh theo đề thi lịch sử từ 27 tỉnh thành. Zenith biết Hà Nội tập trung vào Hàm số nhiều hơn Đắk Lắk — và phản ánh điều đó trong lộ trình.',
                color: '#F59E0B',
              },
            ].map(({ icon, name, tag, desc, color }) => (
              <div key={name} className="flex flex-col gap-3 bg-surface border border-surface rounded-xl p-5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{icon}</span>
                  <div>
                    <p className="font-sans text-[13px] font-bold text-foreground">{name}</p>
                    <p className="font-sans text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block mt-0.5"
                      style={{ background: color + '18', color }}>
                      {tag}
                    </p>
                  </div>
                </div>
                <p className="font-sans text-[12px] text-dim leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <p className="font-sans text-[12px] text-dim text-center">
            Dữ liệu đề thi từ Bộ GD&ĐT · 27 tỉnh thành · Cập nhật sau mỗi kỳ thi
          </p>
        </div>

      </div>

      {/* Exam phase / countdown strip */}
      {(() => {
        const d = getDaysUntilExam(user?.province ?? null)
        if (d == null) return null
        const phase = d > 60 ? { bg: '#0D1A1F', border: '#134E4A', color: '#34D399', msg: `Giai đoạn nền tảng · Còn ${d} ngày — xây vững kiến thức cơ bản` }
          : d > 14  ? { bg: '#1A130A', border: '#78350F', color: '#F2A20C', msg: `Giai đoạn luyện đề · Còn ${d} ngày — tập trung làm thật nhiều đề` }
          : { bg: '#1A0808', border: '#7F1D1D', color: '#EF4444', msg: `Giai đoạn nước rút · Còn ${d} ngày — tập trung tối đa, không học dàn trải` }
        return (
          <div className="relative z-10 w-full px-4 sm:px-8 py-3 flex items-center justify-center gap-3"
            style={{ background: phase.bg, borderTop: `1px solid ${phase.border}`, borderBottom: `1px solid ${phase.border}` }}>
            <span className="font-sans text-[13px] font-semibold" style={{ color: phase.color }}>{phase.msg}</span>
            <button onClick={() => navigate('/study-plan/adaptive')}
              className="flex-shrink-0 font-sans text-[12px] font-semibold underline underline-offset-2 hover:opacity-80 transition"
              style={{ color: phase.color }}>
              Xem kế hoạch →
            </button>
          </div>
        )
      })()}

      {/* Pricing section */}
      <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 pb-24 flex flex-col gap-10">
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, var(--border), transparent)' }} />

        <div className="flex flex-col items-center gap-2 text-center">
          <span className="font-sans text-[28px] font-bold text-foreground">Bắt đầu miễn phí</span>
          <p className="font-sans text-[14px] text-dim">Không cần thẻ ngân hàng · Nâng cấp khi bạn sẵn sàng</p>
        </div>

        <div className="flex flex-col gap-3">
          {PLANS_MONTHLY.map(plan => (
            <div
              key={plan.tier}
              className="flex items-start justify-between gap-4 px-6 py-5 rounded-2xl border cursor-default"
              style={{
                background: plan.tier === 'student' ? 'var(--primary-subtle)' : 'var(--surface)',
                border: `1px solid ${plan.tier === 'student' ? '#6366F144' : 'var(--border)'}`,
              }}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-sans text-[15px] font-bold text-foreground">{plan.label}</span>
                  {plan.badge && (
                    <span className="font-sans text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                      {plan.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-sans text-[12px] text-dim">⚡ {plan.credits.toLocaleString()} credits / tháng</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  {plan.features.map(f => (
                    <span key={f} className="font-sans text-[12px] text-dim">✓ {f}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="font-sans text-[16px] font-bold text-foreground">{plan.price}</span>
                {plan.tier !== 'basic' && (
                  <>
                    <motion.button
                      onClick={user ? () => navigate('/account') : onOpenAuth}
                      className="ripple-btn px-4 py-1.5 rounded-lg font-sans text-[12px] font-bold text-primary-fg bg-primary hover:opacity-90 transition"
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      {user ? (plan.tier === 'student' ? 'Bắt đầu học ngay' : 'Mở khóa toàn bộ') : 'Đăng nhập'}
                    </motion.button>
                    <span className="font-sans text-[10px] text-dim">✓ Hoàn tiền trong 7 ngày</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Top-up packages */}
        <div className="flex flex-col gap-4">
          <span className="font-sans text-[13px] font-semibold text-muted text-center">Hoặc nạp thêm credits</span>
          <div className="flex gap-3 flex-wrap justify-center">
            {TOPUP_PACKAGES.map(pkg => (
              <div key={pkg.price}
                className="flex flex-col items-center gap-1 px-6 py-4 rounded-xl border border-surface glass-base">
                <span className="font-sans text-[18px] font-bold text-primary">⚡ {pkg.credits}</span>
                <span className="font-sans text-[12px] text-dim">{pkg.price}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <div className="flex flex-col gap-5">
          <h2 className="font-sans text-[22px] font-bold text-foreground text-center">Học sinh nói gì về Zenith</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                name: 'Nguyễn Minh Anh',
                grade: 'Lớp 12 · Hà Nội',
                result: 'Đạt 8.0 Toán THPT 2024',
                quote: 'Zenith AI giải thích từng bước rõ ràng hơn sách giáo khoa. Mình hiểu bản chất, không chỉ nhớ công thức.',
              },
              {
                name: 'Trần Thảo Linh',
                grade: 'Lớp 9 · TP. Hồ Chí Minh',
                result: 'Đỗ THPT Chuyên Lê Hồng Phong',
                quote: 'AI chỉ đúng điểm yếu của mình là Hình học. Luyện đúng chỗ, tiết kiệm thời gian hơn nhiều.',
              },
              {
                name: 'Phạm Đức Huy',
                grade: 'Lớp 11 · Đà Nẵng',
                result: 'Tăng từ 5.5 lên 7.5 trong 2 tháng',
                quote: 'Thích nhất là thấy được mình đang ở đâu so với học sinh cùng tỉnh. Tạo động lực học hẳn.',
              },
            ].map(({ name, grade, result, quote }) => (
              <div key={name} className="flex flex-col gap-3 bg-surface border border-surface rounded-2xl px-5 py-4">
                <p className="font-sans text-[13px] text-muted leading-relaxed italic">"{quote}"</p>
                <div className="mt-auto pt-2 border-t border-surface">
                  <p className="font-sans text-[13px] font-semibold text-foreground">{name}</p>
                  <p className="font-sans text-[11px] text-dim">{grade}</p>
                  <p className="font-sans text-[11px] text-success mt-0.5">✓ {result}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* School Targets */}
        {(() => {
          const TARGETS = {
            'Hà Nội':  [{ name: 'Chuyên ĐH Sư Phạm / Ams', typical: 9.0, top: 9.5 }, { name: 'Chu Văn An / Kim Liên', typical: 8.0, top: 8.5 }, { name: 'THPT công lập', typical: 6.5, top: 7.5 }],
            'TP.HCM':  [{ name: 'Chuyên Lê Hồng Phong / Năng Khiếu', typical: 8.8, top: 9.3 }, { name: 'Nguyễn Thị Minh Khai / Gia Định', typical: 7.5, top: 8.2 }, { name: 'THPT công lập', typical: 6.2, top: 7.0 }],
            'Đà Nẵng': [{ name: 'Chuyên Lê Quý Đôn', typical: 8.0, top: 8.8 }, { name: 'Phan Châu Trinh', typical: 6.8, top: 7.5 }, { name: 'THPT công lập', typical: 5.5, top: 6.5 }],
          }
          const targets = TARGETS[user?.province] ?? TARGETS['Hà Nội']
          const displayProvince = user?.province ?? 'Hà Nội'
          return (
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <span className="font-sans text-[11px] font-semibold tracking-[3px] uppercase text-dim">Mục tiêu trường</span>
                <h2 className="font-sans text-[22px] font-bold text-foreground mt-2">Biết chính xác bạn cần bao nhiêu điểm</h2>
                <p className="font-sans text-[13px] text-dim mt-1">Ngưỡng điểm tham khảo tại {displayProvince}</p>
              </div>
              <div className="flex flex-col gap-2">
                {targets.map(({ name, typical, top }) => (
                  <div key={name} className="bg-surface border border-surface rounded-xl px-5 py-3.5 flex items-center justify-between gap-4">
                    <p className="font-sans text-[13px] font-semibold text-foreground flex-1 min-w-0 truncate">{name}</p>
                    <div className="flex items-center gap-5 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-sans text-[9px] uppercase tracking-wider text-dim">Đỗ thường</p>
                        <p className="font-sans text-[15px] font-bold text-muted">{typical.toFixed(1)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-sans text-[9px] uppercase tracking-wider text-dim">Top trường</p>
                        <p className="font-sans text-[15px] font-bold text-primary">{top.toFixed(1)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="font-sans text-[11px] text-border text-center">
                Số liệu tham khảo · Cập nhật theo kỳ thi tuyển sinh gần nhất
              </p>
            </div>
          )
        })()}

        {/* FAQ */}
        <div className="flex flex-col gap-4">
          <h2 className="font-sans text-[22px] font-bold text-foreground text-center">Câu hỏi thường gặp</h2>
          <div className="flex flex-col gap-2">
            {[
              {
                q: 'Zenith có khác gì so với ôn thi thông thường?',
                a: 'AI tìm ra lỗi sai cụ thể trong bài làm và đề xuất bài luyện phù hợp — không chỉ chấm điểm như các nền tảng thông thường.',
              },
              {
                q: 'Tôi có phải trả tiền không?',
                a: 'Miễn phí hoàn toàn để bắt đầu với 50 credits và 1 đề thi thử. Nâng cấp khi bạn muốn dùng thêm tính năng AI.',
              },
              {
                q: 'Đề thi trên Zenith có thật không?',
                a: '1,104 câu hỏi từ đề thi chính thức của Bộ GD&ĐT và 63 tỉnh thành. Tất cả câu hỏi từ nguồn thật — không có câu do AI tạo ra.',
              },
              {
                q: 'Zenith dùng được cho học sinh lớp 9 thi vào lớp 10 không?',
                a: 'Có — Zenith bao gồm đề tuyển sinh lớp 10 từ các tỉnh thành trên toàn quốc.',
              },
            ].map(({ q, a }) => (
              <details key={q} className="group bg-surface border border-surface rounded-xl px-5 py-4 cursor-pointer">
                <summary className="font-sans text-[14px] font-semibold text-foreground list-none flex items-center justify-between gap-3">
                  {q}
                  <span className="text-dim group-open:rotate-180 transition-transform flex-shrink-0">▾</span>
                </summary>
                <p className="font-sans text-[13px] text-muted leading-relaxed mt-3">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-surface mt-8 px-6 sm:px-10 py-8">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-6 justify-between">
          <div className="flex flex-col gap-2">
            <span className="font-sans text-[15px] font-bold text-foreground">Zenith</span>
            <span className="font-sans text-[12px] text-dim">Ôn thi Toán THPT & Lớp 10 cùng AI</span>
          </div>
          <div className="flex gap-8 flex-wrap">
            <div className="flex flex-col gap-2">
              <span className="font-sans text-[11px] font-bold uppercase tracking-[2px] text-dim">Sản phẩm</span>
              {[['Thi thử', '/exams'], ['Luyện tập', '/exams?mode=practice'], ['Zenith AI', '/oracle'], ['⚗ Lab', '/exams?mode=lab']].map(([label, path]) => (
                <button key={label} onClick={() => navigate(path)}
                  className="font-sans text-[12px] text-dim hover:text-muted transition text-left">{label}</button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-sans text-[11px] font-bold uppercase tracking-[2px] text-dim">Tài khoản</span>
              {[
                ['Đăng nhập', null, onOpenAuth],
                ['Nâng cấp', '/account', null],
              ].map(([label, path, fn]) => (
                <button key={label} onClick={fn ?? (() => navigate(path))}
                  className="font-sans text-[12px] text-dim hover:text-muted transition text-left">{label}</button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-center font-sans text-[11px] text-border mt-6">© {new Date().getFullYear()} Zenith. Tất cả đề thi từ nguồn chính thức.</p>
      </footer>
    </motion.div>
  )
}

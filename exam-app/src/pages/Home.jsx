import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { listVariants, itemVariants, cardHover } from '../utils/animations.js'
import confetti from 'canvas-confetti'
import { useAuth } from '../context/AuthContext.jsx'
import { Button } from '../components/ui/button.jsx'
import { Badge } from '../components/ui/badge.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { getSessionToday, getConceptMastery, predictScore } from '../api/aiClient.js'
import { CONCEPTS } from '../data/concepts.js'
import { loadExamById } from '../api/index.js'
import { getTopicLabel } from '../utils/topicLabels.js'
import { PROVINCE_THRESHOLDS } from './Progress.jsx'
import WelcomePanel from '../components/WelcomePanel'
import { getTwoExamEstimate } from '../utils/scoreProjection'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STAGE_LABELS = ['Chưa học', 'Mới bắt đầu', 'Đang học', 'Khá tốt', 'Thành thạo', 'Xuất sắc']

function scoreToStage(score) {
  if (!score || score === 0) return 0
  if (score < 0.35) return 1
  if (score < 0.55) return 2
  if (score < 0.70) return 3
  if (score < 0.85) return 4
  return 5
}

function masteryColorClass(score) {
  if (!score || score === 0) return 'text-[var(--mastery-0)]'
  if (score < 0.4) return 'text-[var(--mastery-1)]'
  if (score < 0.7) return 'text-[var(--mastery-3)]'
  return 'text-[var(--mastery-4)]'
}

function fmtScore(score) {
  return Math.round((score ?? 0) * 10) / 10
}

function timeGreeting() {
  const h = new Date().getHours()
  if (h >= 5 && h < 11) return 'Chào buổi sáng'
  if (h >= 11 && h < 17) return 'Chào buổi chiều'
  if (h >= 17 && h < 22) return 'Chào buổi tối'
  return 'Xin chào'
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skel({ className = '' }) {
  return <div className={`animate-pulse bg-border rounded ${className}`} />
}

// ── Score Prediction Card (shown after ≥4 exams) ──────────────────────────────

function ScorePredictionCard({ data, prevData, navigate }) {
  if (!data) return null
  const { predicted, confidence_interval, on_track } = data
  const [lo, hi] = confidence_interval ?? [null, null]
  const delta = prevData?.predicted != null ? predicted - prevData.predicted : null
  const trendLabel = delta != null
    ? (delta > 0.05 ? `↑ +${delta.toFixed(1)} so hôm qua` : delta < -0.05 ? `↓ ${delta.toFixed(1)} so hôm qua` : '→ Không đổi so hôm qua')
    : null
  const actionHint = on_track
    ? 'Giữ nhịp luyện tập để duy trì đà tiến bộ'
    : `Luyện thêm 1 chủ đề yếu để cải thiện điểm số`
  return (
    <motion.div
      initial="hidden"
      animate="rest"
      variants={cardHover}
      whileHover="hover"
      className={`border rounded-xl p-4 flex flex-col gap-2 ${on_track ? 'border-success/30 bg-success/5' : 'border-[var(--warning)]/30 bg-[var(--warning)]/5'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-dim">Dự đoán điểm</p>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[26px] font-bold text-foreground">{predicted?.toFixed(1)}</span>
            {lo != null && hi != null && (
              <span className="font-sans text-[11px] text-dim">({lo.toFixed(1)} – {hi.toFixed(1)})</span>
            )}
            {trendLabel && (
              <span className={`font-sans text-[11px] font-semibold ${delta > 0.05 ? 'text-success' : delta < -0.05 ? 'text-destructive' : 'text-dim'}`}>
                {trendLabel}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate('/progress')}
          className="font-sans text-[12px] text-info hover:text-foreground transition-colors shrink-0 mt-0.5"
        >
          Xem tiến độ →
        </button>
      </div>
      <p className="font-sans text-[11px] text-dim">{on_track ? '↗ Đang tiến đúng hướng · ' : '⚠ Cần tăng tốc · '}{actionHint}</p>
    </motion.div>
  )
}

// ── Daily Focus Card ──────────────────────────────────────────────────────────

const FOCUS_CONFIGS = {
  first_exam: {
    eyebrow: 'Bắt đầu hành trình',
    title: 'Làm bài thi đầu tiên của bạn',
    context: 'Zenith cần ít nhất 1 kết quả để xây dựng lộ trình riêng cho bạn.',
    description: 'Zenith sẽ phân tích kết quả và xác định đúng điểm yếu của bạn.',
    cta: 'Chọn bài thi',
    path: '/exams',
    accent: 'border-primary/40 bg-primary/5',
  },
  done: {
    eyebrow: null, // set dynamically
    title: 'Hoàn thành mục tiêu hôm nay!',
    context: 'Hoàn thành hôm nay! Quay lại ngày mai để tiếp tục chuỗi học.',
    description: 'Bạn đã ôn tập xong. Muốn luyện thêm không?',
    cta: 'Luyện tập thêm',
    path: '/practice',
    accent: 'border-success/40 bg-success/5',
  },
  review: {
    eyebrow: 'Ôn tập hằng ngày',
    title: null, // set dynamically
    context: 'Những câu này xuất hiện nhiều trong đề thi gần đây — đúng lúc ôn lại.',
    description: 'Lặp lại đúng lúc giúp bạn ghi nhớ lâu hơn gấp 3 lần.',
    cta: 'Bắt đầu ôn tập',
    path: '/review',
    accent: 'border-info/30 bg-info/5',
  },
  analysis: {
    eyebrow: 'Kết quả vừa thi',
    title: null, // set dynamically
    context: null,
    description: null, // set dynamically
    cta: 'Xem phân tích AI',
    path: null, // set dynamically
    accent: 'border-[var(--warning)]/30 bg-[var(--warning)]/5',
  },
  practice: {
    eyebrow: 'Khái niệm cần luyện',
    title: null, // set dynamically
    context: 'Đây là dạng bài bạn sai nhiều nhất — 15 phút mỗi ngày tạo ra sự khác biệt rõ rệt.',
    description: 'Luyện tập có mục tiêu cải thiện nhanh hơn ôn tập ngẫu nhiên.',
    cta: 'Luyện tập ngay',
    path: '/practice',
    accent: 'border-purple/30 bg-purple/5',
  },
  exam: {
    eyebrow: 'Tạo tín hiệu học tập',
    title: 'Làm bài thi tiếp theo',
    context: null,
    description: 'Mỗi bài thi giúp Zenith hiểu hơn về điểm yếu của bạn.',
    cta: 'Chọn bài thi',
    path: '/exams',
    accent: 'border-border',
  },
}

function DailyFocusCard({ action, loading, navigate, onDismiss, userName }) {
  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
        <Skel className="h-3 w-28" />
        <Skel className="h-6 w-2/3" />
        <Skel className="h-4 w-1/2" />
        <Skel className="h-9 w-36 mt-1" />
      </div>
    )
  }
  if (!action) return null

  const cfg = { ...FOCUS_CONFIGS[action.type] }

  const firstName = userName?.split(' ')[0] ?? ''
  const EYEBROW_VARIANTS = [`${firstName} —`, `${firstName}, hôm nay:`, `Nhiệm vụ của ${firstName}:`]
  const personalEyebrow = firstName && action.type !== 'done'
    ? EYEBROW_VARIANTS[new Date().getDay() % EYEBROW_VARIANTS.length]
    : null

  // Patch dynamic fields
  if (action.type === 'done') {
    cfg.eyebrow = action.streak >= 2 ? `🔥 ${action.streak} ngày liên tiếp` : 'Hoàn thành hôm nay'
  }
  if (action.type === 'review') {
    cfg.title = `${action.count} câu cần ôn tập hôm nay`
  }
  if (action.type === 'analysis') {
    cfg.title = action.exam?.title ?? 'Bài thi gần nhất'
    cfg.description = `Điểm: ${fmtScore(action.result?.score)}/10 — Xem phân tích để hiểu điểm yếu.`
    cfg.path = `/results/${action.result?.id}`
  }
  if (action.type === 'practice') {
    cfg.title = action.concept?.name_vi ?? 'Luyện tập khái niệm yếu'
    if (action.concept?.topic) cfg.path = `/practice/adaptive?topic=${action.concept.topic}`
  }

  return (
    <motion.div
      initial="hidden"
      animate="rest"
      variants={cardHover}
      whileHover="hover"
      className="bg-surface border border-border border-t-[var(--primary-border)] rounded-xl p-5"
      style={{ borderTopWidth: '2px', borderTopColor: 'var(--primary-border)' }}
    >
      {(personalEyebrow || cfg.eyebrow) && (
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
          {personalEyebrow ?? cfg.eyebrow}
        </p>
      )}
      <h2 className="font-sans text-[20px] font-bold text-foreground leading-tight mb-1">
        {cfg.title}
      </h2>
      {cfg.context && (
        <p className="font-sans text-[12px] text-dim mb-1">{cfg.context}</p>
      )}
      <p className="font-sans text-[13px] text-muted mb-4">
        {cfg.description}
      </p>
      <div className="flex items-center gap-3">
        <Button
          onClick={() => cfg.path && navigate(cfg.path)}
          size="lg"
          className="text-[13px] font-semibold"
        >
          {cfg.cta} →
        </Button>
        {onDismiss && action.type !== 'done' && (
          <Button
            onClick={onDismiss}
            variant="ghost"
            size="sm"
            className="text-[12px] text-dim"
          >
            Không phải bây giờ
          </Button>
        )}
      </div>
    </motion.div>
  )
}

// ── Stat Box ──────────────────────────────────────────────────────────────────

function StatBox({ label, value, sub, loading }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-1 flex-1 min-w-0">
      {loading ? (
        <>
          <Skel className="h-7 w-14 mb-1" />
          <Skel className="h-3 w-20" />
        </>
      ) : (
        <>
          <span className="font-mono text-[22px] font-bold text-foreground leading-none">{value}</span>
          <span className="font-sans text-[11px] text-muted leading-tight">{label}</span>
          {sub && <span className="font-sans text-[10px] text-dim mt-0.5">{sub}</span>}
        </>
      )}
    </div>
  )
}

// ── Weak Concept Card ─────────────────────────────────────────────────────────

function WeakConceptCard({ concept, score, onClick }) {
  const pct = Math.round((score || 0) * 100)
  const stage = scoreToStage(score)
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-surface border border-border rounded-lg px-3 py-2.5 hover:border-border-subtle transition-colors flex items-center justify-between gap-3 group"
    >
      <div className="min-w-0 flex-1">
        <p className="font-sans text-[12px] font-semibold text-foreground truncate group-hover:text-[var(--primary)] transition-colors">
          {concept.name_vi}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="font-sans text-[10px] text-dim">Lớp {concept.grade}</span>
          <Badge variant={`mastery${stage}`} className="text-[9px] px-1.5 py-0 h-4">
            {STAGE_LABELS[stage]}
          </Badge>
        </div>
      </div>
      <span className={`font-mono text-[12px] font-bold shrink-0 tabular-nums ${masteryColorClass(score)}`}>
        {pct}%
      </span>
    </button>
  )
}

// ── Recent Exam Card ──────────────────────────────────────────────────────────

function RecentExamCard({ result, navigate }) {
  if (!result) return null
  const exam = result.examId ? loadExamById(result.examId) : null
  const score = result.score ?? 0
  const scoreColor = score >= 7 ? 'text-[var(--mastery-4)]' : score >= 5 ? 'text-[var(--mastery-3)]' : 'text-[var(--mastery-1)]'
  const date = result.createdAt
    ? new Date(result.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''

  return (
    <motion.div variants={cardHover} initial="rest" whileHover="hover" className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3 h-full">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-sans text-[10px] uppercase tracking-wider text-dim mb-0.5">
            Bài thi gần nhất
          </p>
          <p className="font-sans text-[12px] font-semibold text-foreground leading-tight line-clamp-2">
            {exam?.title ?? (result.examId ? `Bài thi ${result.examId}` : 'Bài thi không xác định')}
          </p>
        </div>
        <span className={`font-sans text-[24px] font-bold shrink-0 tabular-nums ${scoreColor}`}>
          {fmtScore(score)}
        </span>
      </div>
      <p className="font-sans text-[11px] text-dim">{date}</p>
      <button
        onClick={() => navigate(`/results/${result.id}`)}
        className="mt-auto text-left font-sans text-[12px] font-semibold text-info hover:text-foreground transition-colors"
      >
        Xem phân tích AI →
      </button>
    </motion.div>
  )
}

// ── Exam Sparkline ────────────────────────────────────────────────────────────

function ExamSparkline({ results }) {
  const pts = results.slice(0, 5).reverse()
  if (pts.length < 2) return null
  const max = 10
  const w = 64, h = 28
  const step = w / (pts.length - 1)
  const points = pts.map((r, i) => {
    const x = i * step
    const y = h - (r.score / max) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const last = pts[pts.length - 1]?.score ?? 0
  const prev = pts[pts.length - 2]?.score ?? last
  const trend = last > prev ? 'var(--success)' : last < prev ? 'var(--destructive)' : 'var(--accent)'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={points} fill="none" stroke={trend} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((r, i) => (
        <circle key={i} cx={(i * step).toFixed(1)} cy={(h - (r.score / max) * h).toFixed(1)} r="2" fill={i === pts.length - 1 ? trend : '#334155'} />
      ))}
    </svg>
  )
}

// ── Recent Mistakes Section ───────────────────────────────────────────────────

function RecentMistakesSection({ results, navigate }) {
  const latest = results?.[0]
  if (!latest?.topicBreakdown) return null
  const weakTopics = Object.entries(latest.topicBreakdown)
    .filter(([, tb]) => tb.accuracy < 0.6 && tb.total > 0)
    .sort(([, a], [, b]) => a.accuracy - b.accuracy)
    .slice(0, 2)
  if (weakTopics.length === 0) return null
  const wrongTotal = Object.values(latest.topicBreakdown)
    .reduce((sum, tb) => sum + (tb.total - tb.correct), 0)
  if (wrongTotal === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-dim">
          Lỗi sai gần nhất
        </p>
        <button
          onClick={() => navigate('/mistakes')}
          className="font-sans text-[11px] text-info hover:text-foreground transition-colors"
        >
          Xem tất cả →
        </button>
      </div>
      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
        <p className="font-sans text-[12px] text-muted">
          Bài thi gần nhất: <span className="text-destructive font-semibold">{wrongTotal} câu sai</span>
        </p>
        {weakTopics.map(([topic, tb]) => (
          <div key={topic} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-sans text-[12px] text-foreground">{getTopicLabel(topic)}</span>
              <span className="font-sans text-[11px] text-destructive">{Math.round(tb.accuracy * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-border overflow-hidden">
              <div className="h-full rounded-full bg-destructive/60" style={{ width: `${tb.accuracy * 100}%` }} />
            </div>
          </div>
        ))}
        <button
          onClick={() => navigate('/practice')}
          className="self-start font-sans text-[12px] text-primary hover:text-foreground transition-colors"
        >
          Luyện lại ngay →
        </button>
      </div>
    </div>
  )
}

// ── Province Benchmark Card ────────────────────────────────────────────────────

function ProvinceBenchmarkCard({ user, results, navigate }) {
  if (!user?.province || results.length < 2) return null
  const threshold = PROVINCE_THRESHOLDS[user.province] ?? { typical: 6.5, top: 8.0 }
  const avgScore = results.slice(0, 5).reduce((sum, r) => sum + (r.score ?? 0), 0) / Math.min(results.length, 5)
  const statusColor = avgScore >= threshold.typical ? 'var(--success)' : avgScore >= threshold.typical * 0.85 ? 'var(--warning)' : 'var(--destructive)'
  const pctOfTop = Math.min(100, Math.round((avgScore / threshold.top) * 100))
  return (
    <motion.div
      initial="hidden"
      animate="rest"
      variants={cardHover}
      whileHover="hover"
      className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-dim">
          So với chuẩn {user.province}
        </p>
        <button onClick={() => navigate('/progress')} className="font-sans text-[11px] text-info hover:text-foreground transition-colors">
          Chi tiết →
        </button>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-0.5 shrink-0">
          <span className="font-sans text-[22px] font-bold leading-none" style={{ color: statusColor }}>
            {avgScore.toFixed(1)}
          </span>
          <span className="font-sans text-[10px] text-dim">Điểm TB (5 bài)</span>
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <div className="relative h-2 rounded-full bg-border overflow-hidden">
            <div className="absolute h-full rounded-full transition-all" style={{ width: `${Math.min(100, (avgScore / 10) * 100)}%`, background: statusColor }} />
            <div className="absolute top-0 bottom-0 w-px" style={{ left: `${(threshold.typical / 10) * 100}%`, background: '#F59E0B99' }} />
            <div className="absolute top-0 bottom-0 w-px" style={{ left: `${(threshold.top / 10) * 100}%`, background: '#818CF899' }} />
          </div>
          <div className="flex items-center justify-between font-sans text-[10px]">
            <span style={{ color: statusColor }}>
              {avgScore >= threshold.typical
                ? `✓ Trên ngưỡng đỗ (${threshold.typical.toFixed(1)})`
                : `Cần +${(threshold.typical - avgScore).toFixed(1)} để đạt ngưỡng`}
            </span>
            <span className="text-dim">Top: {threshold.top.toFixed(1)}</span>
          </div>
          <div className="font-sans text-[10px] text-dim">{pctOfTop}% tiến đến top trường</div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Quick Links ───────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  { label: 'Lỗi sai', path: '/mistakes' },
  { label: 'Lịch sử', path: '/history' },
  { label: 'Bản đồ khái niệm', path: '/mastery' },
  { label: 'Tiến độ', path: '/progress' },
  { label: 'Thách thức ngày', path: '/practice/daily' },
]

function QuickLinks({ navigate }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {QUICK_LINKS.map(l => (
        <Button
          key={l.path}
          onClick={() => navigate(l.path)}
          variant="outline"
          size="sm"
          className="text-[12px]"
        >
          {l.label}
        </Button>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const { user } = useAuth()
  const { results } = useHistory()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [masteryData, setMasteryData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scorePrediction, setScorePrediction] = useState(null)
  const [prevScorePrediction, setPrevScorePrediction] = useState(null)
  const [focusDismissed, setFocusDismissed] = useState(() => {
    const t = localStorage.getItem('home_focus_dismissed_until')
    return !!t && Date.now() < Number(t)
  })

  function dismissFocus() {
    localStorage.setItem('home_focus_dismissed_until', String(Date.now() + 24 * 60 * 60 * 1000))
    setFocusDismissed(true)
  }

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    Promise.all([
      getSessionToday(),
      getConceptMastery(),
    ]).then(([s, m]) => {
      if (s.data) setSession(s.data)
      if (m.data) setMasteryData(m.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || results.length < 4) return
    const todayKey = 'zenith_pred_' + new Date().toISOString().slice(0, 10)
    const yesterdayKey = 'zenith_pred_' + new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    try {
      const prev = localStorage.getItem(yesterdayKey)
      if (prev) setPrevScorePrediction(JSON.parse(prev))
    } catch (_) {}
    predictScore().then(({ data }) => {
      if (data?.predicted != null) {
        setScorePrediction(data)
        try { localStorage.setItem(todayKey, JSON.stringify({ predicted: data.predicted, on_track: data.on_track })) } catch (_) {}
      }
    }).catch(() => {})
  }, [user?.id, results.length])

  // Streak milestone confetti (3, 7, 14, 30 days)
  useEffect(() => {
    const streak = session?.streak ?? 0
    if (!streak) return
    const milestones = [3, 7, 14, 30]
    if (!milestones.includes(streak)) return
    const key = `streak-confetti-${streak}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    const timer = setTimeout(() => {
      confetti({
        particleCount: streak >= 14 ? 200 : 100,
        spread: 60,
        origin: { x: 0.5, y: 0.3 },
        colors: ['#3B6FE8', '#7C5CE8', '#059669', '#5B8FF0'],
        ticks: 300,
      })
    }, 800)
    return () => clearTimeout(timer)
  }, [session?.streak])

  const masteryMap = useMemo(() => {
    if (!masteryData?.concepts) return {}
    const map = {}
    masteryData.concepts.forEach(c => { map[c.id] = c.mastery_score ?? 0 })
    return map
  }, [masteryData])

  const masteredCount = useMemo(
    () => Object.values(masteryMap).filter(s => s >= 0.7).length,
    [masteryMap]
  )

  const weakConcepts = useMemo(() => {
    return CONCEPTS
      .filter(c => {
        const s = masteryMap[c.id]
        return s !== undefined && s > 0 && s < 0.4
      })
      .sort((a, b) => (masteryMap[a.id] ?? 1) - (masteryMap[b.id] ?? 1))
      .slice(0, 3)
  }, [masteryMap])

  const primaryAction = useMemo(() => {
    if (loading) return null
    if (!results?.length) return { type: 'first_exam' }
    if (session?.is_complete) return { type: 'done', streak: session.streak }
    if ((session?.due_count ?? 0) > 0) return { type: 'review', count: session.due_count }

    const recent = results[0]
    if (recent?.createdAt) {
      const ageMs = Date.now() - new Date(recent.createdAt).getTime()
      if (ageMs < 48 * 3600 * 1000) {
        const exam = recent.examId ? loadExamById(recent.examId) : null
        return { type: 'analysis', result: recent, exam }
      }
    }
    if (weakConcepts.length > 0) return { type: 'practice', concept: weakConcepts[0] }
    return { type: 'exam' }
  }, [loading, results, session, weakConcepts])

  const recentResult = results?.[0] ?? null
  const displayName = user?.custom_display_name || user?.display_name || ''
  const firstName = displayName.split(' ')[0] || ''
  const greeting = timeGreeting()
  const hasLearningData = results?.length > 0 || masteredCount > 0
  const [showMore, setShowMore] = useState(false)
  const todayKey = `daily_task_done_${user?.id}_${new Date().toISOString().slice(0, 10)}`
  const [taskDoneToday, setTaskDoneToday] = useState(() => !!localStorage.getItem(todayKey))
  function markTaskDone() {
    localStorage.setItem(todayKey, '1')
    setTaskDoneToday(true)
  }

  // Overload detection — computed from local results history, no backend needed
  const overloadStatus = (() => {
    if (!results || results.length < 4) return null
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recent = results.filter(r => {
      const ts = r.finishedAt || r.created_at
      return ts && new Date(ts).getTime() > sevenDaysAgo
    })
    if (recent.length < 4) return null
    // Check score trend: last 3 scores declining
    const last3 = recent.slice(0, 3).map(r => r.score ?? 0)
    const declining = last3.length === 3 && last3[0] < last3[1] && last3[1] < last3[2]
    // Check late-night sessions (after 11pm)
    const lateNights = recent.filter(r => {
      const ts = r.finishedAt || r.created_at
      if (!ts) return false
      const h = new Date(ts).getHours()
      return h >= 23 || h < 4
    }).length
    if (recent.length >= 4 && declining) {
      return lateNights >= 2 ? 'severe' : 'moderate'
    }
    return null
  })()

  // Month-2 Plateau nudge — account 45+ days old, no exam in last 21 days
  const plateauNudge = (() => {
    if (!user?.created_at || !results) return false
    const accountAgeDays = (Date.now() - new Date(user.created_at).getTime()) / 86400000
    if (accountAgeDays < 45) return false
    if (!results.length) return true
    const lastTs = results[0]?.finishedAt || results[0]?.created_at
    if (!lastTs) return true
    const daysSinceLast = (Date.now() - new Date(lastTs).getTime()) / 86400000
    return daysSinceLast >= 21
  })()

  const [overrideQuietMode, setOverrideQuietMode] = useState(false)

  // Exam-Eve Quiet Mode — check if exam is today or tomorrow
  const examDate = user?.exam_date ?? null
  const isExamEve = !overrideQuietMode && examDate && (() => {
    try {
      const d = new Date(examDate)
      const now = new Date()
      d.setHours(0, 0, 0, 0); now.setHours(0, 0, 0, 0)
      const diff = Math.round((d - now) / 86400000)
      return diff === 0 || diff === 1
    } catch { return false }
  })()

  // Best topic for the quiet-mode stat line
  const strongestTopic = hasLearningData && results?.length > 0 ? (() => {
    const topicStats = {}
    for (const r of results.slice(0, 10)) {
      for (const [t, tb] of Object.entries(r.topicBreakdown ?? {})) {
        if (!topicStats[t]) topicStats[t] = { correct: 0, total: 0 }
        topicStats[t].correct += tb.correct ?? 0
        topicStats[t].total += tb.total ?? 0
      }
    }
    const best = Object.entries(topicStats)
      .filter(([, s]) => s.total >= 5)
      .sort((a, b) => (b[1].correct / b[1].total) - (a[1].correct / a[1].total))[0]
    return best ? { label: best[0], accuracy: Math.round((best[1].correct / best[1].total) * 100) } : null
  })() : null

  if (isExamEve) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-4xl">🌙</p>
        <div className="flex flex-col gap-2">
          <h1 className="font-sans text-[22px] font-bold text-foreground">
            {firstName ? `${firstName}, bạn đã sẵn sàng.` : 'Bạn đã sẵn sàng.'}
          </h1>
          <p className="font-sans text-[0.9375rem] text-muted">Nghỉ ngơi tốt tối nay.</p>
        </div>
        {strongestTopic && (
          <p className="font-sans text-[0.8125rem] text-foreground/60">
            Độ chính xác {strongestTopic.label} của bạn: {strongestTopic.accuracy}%
          </p>
        )}
        <button
          onClick={() => setOverrideQuietMode(true)}
          className="font-sans text-xs text-dim hover:text-muted underline transition mt-2"
        >
          Tiếp tục ôn tập
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-background"
    >
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-20 flex flex-col gap-8">

        {/* ── Header ── */}
        <div>
          <p className="font-sans text-[12px] text-dim">{greeting}{displayName ? `, ${displayName}` : ''}</p>
          <h1 className="font-sans text-[24px] font-bold text-foreground leading-tight mt-0.5">
            {!hasLearningData && !loading ? 'Bắt đầu hành trình học toán' : 'Lộ trình của bạn hôm nay'}
          </h1>
        </div>

        {/* ── Welcome Panel (new users) ── */}
        <WelcomePanel
          userId={user?.id}
          diagnosticDone={!!localStorage.getItem(`diagnostic_weights_${user?.id}`)}
          hasExams={results && results.length > 0}
          aiInsightViewed={!!localStorage.getItem(`ai_tooltip_seen_${user?.id}`)}
        />

        {/* ── Daily Focus ── */}
        {!focusDismissed && (
          <DailyFocusCard action={primaryAction} loading={loading} navigate={navigate} onDismiss={dismissFocus} userName={displayName} />
        )}

        {/* ── Daily Task Queue ── */}
        {primaryAction?.type === 'practice' && primaryAction?.concept && (
          taskDoneToday ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-success/30 bg-success/5">
              <span className="text-base flex-shrink-0">✅</span>
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <p className="font-sans text-[12px] font-semibold text-success">Nhiệm vụ hôm nay hoàn thành!</p>
                {weakConcepts[1] && (
                  <p className="font-sans text-[11px] text-muted">
                    Ngày mai: <span className="font-medium text-foreground">{weakConcepts[1].name_vi ?? weakConcepts[1].name}</span>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-surface-elevated">
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="font-sans text-[11px] text-muted">Nhiệm vụ hôm nay · ~15 phút</p>
                <p className="font-sans text-[13px] font-semibold text-foreground truncate">
                  {primaryAction.concept.name_vi ?? primaryAction.concept.name}
                </p>
              </div>
              <button
                onClick={markTaskDone}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg font-sans text-[11px] font-semibold border border-success/40 text-success hover:bg-success/10 transition"
              >
                Đánh dấu xong
              </button>
            </div>
          )
        )}

        {/* ── Overload Detection ── */}
        {overloadStatus && (
          <div className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border ${
            overloadStatus === 'severe'
              ? 'border-destructive/30 bg-destructive/5'
              : 'border-warning/30 bg-warning/5'
          }`}>
            <span className="text-base flex-shrink-0">{overloadStatus === 'severe' ? '🔴' : '🟡'}</span>
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <p className="font-sans text-[13px] text-foreground font-medium">
                {overloadStatus === 'severe'
                  ? 'Nghỉ ngơi là một phần của quá trình luyện tập.'
                  : 'Bạn đang học rất chăm. Hôm nay thử một buổi nhẹ nhàng?'}
              </p>
              <p className="font-sans text-[11px] text-muted">
                {overloadStatus === 'severe'
                  ? 'Điểm số đang giảm và bạn đã học muộn nhiều đêm. Nghỉ hôm nay để lấy lại phong độ.'
                  : 'Điểm số đang có xu hướng giảm. Thử ôn nhẹ 15 phút thay vì làm đề đầy đủ.'}
              </p>
            </div>
          </div>
        )}

        {/* ── Month-2 Plateau nudge ── */}
        {plateauNudge && !overloadStatus && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-info/25 bg-info/5">
            <span className="text-base flex-shrink-0">💡</span>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <p className="font-sans text-[13px] text-foreground font-medium">Bạn đã nghỉ một thời gian.</p>
              <p className="font-sans text-[11px] text-muted">Những học sinh quay lại sau kỳ nghỉ cải thiện điểm bài thi tiếp theo 78% trường hợp. Thử một bài ngắn 20 phút hôm nay.</p>
              <button
                onClick={() => navigate('/practice')}
                className="self-start mt-1 font-sans text-[11px] font-semibold text-info hover:underline"
              >
                Bắt đầu lại →
              </button>
            </div>
          </div>
        )}

        {/* ── Show More toggle ── */}
        {hasLearningData && (
          <button
            onClick={() => setShowMore(s => !s)}
            className="w-full font-sans text-[12px] text-dim hover:text-muted transition-colors text-center py-2"
          >
            {showMore ? '↑ Thu gọn' : '↓ Xem thêm'}
          </button>
        )}

        {showMore && <>

        {/* ── Mastery Stats ── */}
        <div className="flex gap-3">
          <StatBox
            label="Khái niệm thành thạo"
            value={`${masteredCount}/${CONCEPTS.length}`}
            loading={loading}
          />
          <StatBox
            label="Chuỗi ngày học"
            value={loading ? '—' : session?.streak ? `${session.streak} ngày` : '—'}
            sub={session?.streak >= 3 ? '🔥 Tiếp tục duy trì!' : undefined}
            loading={loading}
          />
          <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-1 flex-1 min-w-0">
            {loading ? (
              <>
                <Skel className="h-7 w-14 mb-1" />
                <Skel className="h-3 w-20" />
              </>
            ) : (
              <>
                <div className="flex items-end justify-between gap-2">
                  <span className="font-mono text-[22px] font-bold text-foreground leading-none">{results?.length ?? 0}</span>
                  {results?.length >= 2 && <ExamSparkline results={results} />}
                </div>
                <span className="font-sans text-[11px] text-muted leading-tight">Bài thi đã làm</span>
                {results?.length > 0 && (
                  <span className="font-sans text-[10px] text-dim mt-0.5">Gần nhất: {fmtScore(results[0]?.score)}/10</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Score Prediction (≥4 exams, complete tier via backend Kalman) ── */}
        {scorePrediction && <ScorePredictionCard data={scorePrediction} prevData={prevScorePrediction} navigate={navigate} />}

        {/* ── 2-exam estimate (basic/student tier, ≥2 exams) ── */}
        {results?.length >= 2 && user?.subscription_tier !== 'complete' && (() => {
          const scores = results.map(r => r.score ?? r.total_score ?? 0)
          const est = getTwoExamEstimate(scores)
          return est ? (
            <div data-testid="two-exam-estimate" className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-1">
              <span className="font-sans text-[11px] text-dim font-semibold uppercase tracking-wide">Dự đoán điểm</span>
              <span className="font-sans text-[22px] font-bold text-foreground">{est.predicted}</span>
              <span className="font-sans text-[11px] text-dim">Khoảng {est.low}–{est.high} · {est.label}</span>
            </div>
          ) : null
        })()}

        {/* ── Study plan quick link ── */}
        {user?.id && localStorage.getItem(`latest_study_plan_result_${user.id}`) && (
          <button
            data-testid="study-plan-link"
            onClick={() => navigate('/study-plan')}
            className="font-sans text-[12px] font-semibold text-primary text-left"
          >
            Xem lộ trình học của mình →
          </button>
        )}

        {/* ── Province Benchmark (≥2 exams + province set) ── */}
        {!loading && <ProvinceBenchmarkCard user={user} results={results} navigate={navigate} />}

        {/* ── Weak Concepts + Recent Exam ── */}
        {hasLearningData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Weak concepts */}
            {weakConcepts.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-dim">
                    Cần luyện tập
                  </p>
                  <button
                    onClick={() => navigate('/mastery')}
                    className="font-sans text-[11px] text-primary hover:text-foreground transition-colors"
                  >
                    Xem bản đồ →
                  </button>
                </div>
                <motion.div
                  className="flex flex-col gap-1.5"
                  variants={listVariants}
                  initial="hidden"
                  animate="show"
                >
                  {weakConcepts.map(c => (
                    <motion.div key={c.id} variants={itemVariants}>
                      <WeakConceptCard
                        concept={c}
                        score={masteryMap[c.id]}
                        onClick={() => navigate(`/practice/adaptive?topic=${c.topic}`)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
                {!loading && weakConcepts.length === 0 && (
                  <p className="font-sans text-[12px] text-dim italic">Không có khái niệm yếu — tiếp tục luyện tập!</p>
                )}
              </div>
            )}

            {/* Recent exam */}
            {recentResult && (
              <div className="flex flex-col gap-2">
                {weakConcepts.length === 0 && (
                  <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-dim">
                    Kết quả gần nhất
                  </p>
                )}
                <RecentExamCard result={recentResult} navigate={navigate} />
                {results.length > 1 && (
                  <button
                    onClick={() => navigate('/history')}
                    className="font-sans text-[12px] text-muted hover:text-foreground transition-colors text-left"
                  >
                    Xem {results.length - 1} bài thi trước →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        </>}

        {/* ── Empty state (new user, no data yet) ── */}
        {!loading && !hasLearningData && (
          <div className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-3">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-dim">
              Cách hoạt động
            </p>
            <div className="flex flex-col gap-2">
              {[
                { n: '1', text: 'Làm bài thi thử — Zenith ghi nhận từng câu đúng/sai.' },
                { n: '2', text: 'AI phân tích điểm yếu và phân loại lỗi sai.' },
                { n: '3', text: 'Zenith tạo lịch ôn tập cá nhân theo thuật toán FSRS.' },
              ].map(s => (
                <div key={s.n} className="flex items-start gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary font-sans text-[11px] font-bold flex items-center justify-center mt-0.5">
                    {s.n}
                  </span>
                  <p className="font-sans text-[13px] text-muted">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {showMore && hasLearningData && <>

        {/* ── Recent Mistakes ── */}
        <RecentMistakesSection results={results} navigate={navigate} />

        {/* ── Quick links ── */}
        <div className="flex flex-col gap-2">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-dim">
            Truy cập nhanh
          </p>
          <QuickLinks navigate={navigate} />
        </div>

        {/* ── 7-day progress report card ── */}
        {(() => {
          const createdAt = user?.created_at ? new Date(user.created_at) : null
          const daysSince = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / 86400000) : 0
          if (daysSince < 7 || !results || results.length < 2) return null
          const totalReviews = results.reduce((acc, r) => acc + (r.questions_reviewed ?? 0), 0)
          return (
            <div data-testid="week-report-card" className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-2">
              <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-dim">Tuần đầu tiên với Zenith</span>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div>
                  <p className="font-sans text-[20px] font-bold text-foreground">{results.length}</p>
                  <p className="font-sans text-[11px] text-dim">bài thi đã làm</p>
                </div>
                <div>
                  <p className="font-sans text-[20px] font-bold text-foreground">{totalReviews}</p>
                  <p className="font-sans text-[11px] text-dim">câu đã ôn tập</p>
                </div>
              </div>
            </div>
          )
        })()}

        </>}
      </div>

    </motion.div>
  )
}

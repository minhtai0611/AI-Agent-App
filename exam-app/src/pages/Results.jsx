import { useEffect, useState, useRef, useMemo } from 'react'
import confetti from 'canvas-confetti'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.jsx'
import { NumberTicker } from '../components/ui/number-ticker.jsx'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { pageVariants, viewNavigate, cardHover } from '../utils/animations.js'
import { Reveal3D } from '../components/motion/Reveal3D.jsx'
import { Scene3DLazy } from '../components/motion/Scene3DLazy.jsx'
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { useExam, useExamDispatch } from '../context/ExamContext.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { scoreExam } from '../engine/scoringEngine.js'
import { analyzeResult } from '../engine/aiEngine.js'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  LineChart, Line, XAxis, Tooltip,
} from 'recharts'
import { loadExamById, loadQuestionsByIds } from '../api/index.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { MathText } from '../components/MathText.jsx'
import { getTopicLabel } from '../utils/topicLabels.js'
import { requestStudyReminder, checkAndShowStudyReminder } from '../utils/studyReminder.js'
import ResultShareCard from '../components/ResultShareCard.jsx'
import schoolsData from '../data/schools.json'

const DIFF_RANK = { hard: 3, medium: 2, easy: 1 }

const _listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}
const _itemVariants = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  hover:   cardHover.hover,
}

// Sigmoid probability: 50% at cutoff, ~88% at +0.5, ~12% at -0.5
function schoolFitProbability(score, cutoff) {
  return Math.round(100 / (1 + Math.exp(-(score - cutoff) * 4)))
}

function latestCutoff(school) {
  const years = Object.keys(school.cutoffs ?? {}).sort().reverse()
  return years.length ? school.cutoffs[years[0]]?.math ?? null : null
}
const CIRC = 2 * Math.PI * 54

function HelixDecor({ color }) {
  const pts = 40
  const w = 60, h = 40
  const path1 = Array.from({ length: pts }, (_, i) => {
    const x = (i / (pts - 1)) * w
    const y = h / 2 + Math.sin((i / pts) * Math.PI * 2) * (h / 2 - 2)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const path2 = Array.from({ length: pts }, (_, i) => {
    const x = (i / (pts - 1)) * w
    const y = h / 2 - Math.sin((i / pts) * Math.PI * 2) * (h / 2 - 2)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-30">
      <style>{`
        @keyframes helix-scroll { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -60; } }
      `}</style>
      <path d={path1} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"
        style={{ strokeDasharray: 6, animation: 'helix-scroll 2s linear infinite' }} />
      <path d={path2} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6"
        style={{ strokeDasharray: 6, animationDelay: '-1s', animation: 'helix-scroll 2s linear infinite' }} />
    </svg>
  )
}

function arcColor(score) {
  if (score >= 9) return 'var(--mastery-5)'
  if (score >= 7.5) return 'var(--mastery-4)'
  if (score >= 5) return 'var(--mastery-3)'
  return 'var(--mastery-1)'
}

function scoreLabel(score) {
  if (score >= 9) return 'Xuất sắc'
  if (score >= 8) return 'Rất giỏi'
  if (score >= 6.5) return 'Khá giỏi'
  if (score >= 5) return 'Trung bình'
  return 'Cần cố gắng'
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m} phút ${s} giây`
}

function topicVerdict(acc) {
  if (acc >= 0.7) return { text: '✓ Tốt', color: 'var(--success)', cls: 'bg-success/5 border border-success/20' }
  if (acc >= 0.5) return { text: '⚠ Cần ôn', color: 'var(--warning)', cls: 'bg-primary/5 border border-primary/20' }
  return { text: '✗ Yếu', color: 'var(--destructive)', cls: 'bg-destructive/5 border border-destructive/20' }
}

function parseExplanationSteps(text) {
  if (!text) return []
  // Split on newlines first
  const byLine = text.split(/\n+/).map(s => s.trim()).filter(Boolean)
  if (byLine.length > 1) return byLine
  // Split on sentence boundaries outside LaTeX ($...$)
  const steps = []
  let buf = ''
  let inMath = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '$') inMath = !inMath
    buf += ch
    if (!inMath && (ch === '.' || ch === ';') && i + 1 < text.length && text[i + 1] === ' ') {
      steps.push(buf.trim())
      buf = ''
      i++ // skip the space
    }
  }
  if (buf.trim()) steps.push(buf.trim())
  return steps.length > 1 ? steps : [text]
}

export default function Results() {
  usePageMeta('Kết quả thi', { noindex: true })
  const navigate = useNavigate()
  const location = useLocation()
  const { resultId } = useParams()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview')
  const session = useExam()
  const dispatch = useExamDispatch()
  const { results, addResult } = useHistory()
  const [result, setResult] = useState(() => location.state?.result ?? null)
  const [allQuestions, setAllQuestions] = useState([])
  const [wrongAccordion, setWrongAccordion] = useState({})
  const [revealedSteps, setRevealedSteps] = useState({})
  const [showShareCard, setShowShareCard] = useState(false)
  const confettiFiredRef = useRef(false)
  const [showCelebrationScene, setShowCelebrationScene] = useState(false)
  const scoreRef = useRef(null)
  const scoreInView = useInView(scoreRef, { once: true, margin: '0px 0px -40px 0px' })

  const isCurrent = !resultId || resultId === 'current'
  const savedRef = useRef(false)

  useEffect(() => {
    if (isCurrent) {
      if (session.status !== 'submitted' || !session.exam) {
        navigate('/exams', { replace: true })
        return
      }
      if (savedRef.current) return
      savedRef.current = true
      const scored = {
        ...scoreExam(session),
        tab_switches: location.state?.tab_switches ?? 0,
        devtools_detected: location.state?.devtools_detected ?? 0,
      }
      setResult(scored)
      addResult(scored).then(id => {
        navigate(`/results/${id}`, { replace: true, state: { result: scored } })
      })
    } else {
      if (result) return  // already seeded from location.state — skip stale lookup
      const found = results.find(r => r.id === resultId)
      if (found) setResult(found)
    }
  }, [resultId, results]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!result || isCurrent) return
    // Request notification permission on first result load (high engagement moment)
    if (results.length === 1) requestStudyReminder()
    checkAndShowStudyReminder()
  }, [result?.id, isCurrent]) // eslint-disable-line react-hooks/exhaustive-deps

  // Overall score delta vs immediate previous exam (any exam, not just same)
  const prevResult = result ? results.find(r => r.id !== result.id) : null
  const overallDelta = prevResult != null ? result.score - prevResult.score : null

  // Personal best check — computed before early returns so hook order stays stable
  const pastSameExam = result ? results.filter(r => r.examId === result.examId && r.id !== result.id) : []
  const isPersonalBest = result != null && pastSameExam.length > 0 && result.score > Math.max(...pastSameExam.map(r => r.score))
  const personalBestScore = pastSameExam.length > 0 ? Math.max(...pastSameExam.map(r => r.score)) : null
  const isScoreDrop = result != null && pastSameExam.length > 0 && !isPersonalBest && result.score < personalBestScore

  useEffect(() => {
    if (!result) return
    const examObj = loadExamById(result.examId)
    if (!examObj) return
    loadQuestionsByIds(examObj.questionIds).then(qs => {
      const qd = result?.questionData ?? {}
      setAllQuestions(qs.map(q => ({ ...q, ...(qd[q.id] ?? {}) })))
    })
  }, [result?.examId, result?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const schoolFitList = useMemo(() => {
    if (!result) return []
    const score = result.score
    const scored = schoolsData
      .map(s => {
        const cutoff = latestCutoff(s)
        if (cutoff === null) return null
        const prob = schoolFitProbability(score, cutoff)
        return { ...s, prob, cutoff }
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(a.prob - 50) - Math.abs(b.prob - 50))
    return scored.slice(0, 6)
  }, [result?.score])

  // Local heuristic insights (no backend/AI call) — predicted score range, percentile
  // estimate from local history, weak topics, and an improvement checklist.
  const localInsights = useMemo(() => {
    if (!result) return null
    const allPast = results.filter(r => r.id !== result.id)
    return analyzeResult(result, allPast, schoolsData)
  }, [result, results])

  if (!result) {
    if (!isCurrent && results.length > 0 && !results.find(r => r.id === resultId)) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
          <p className="font-sans text-lg text-muted">Không tìm thấy kết quả</p>
          <button onClick={() => navigate('/history')} className="font-sans text-sm text-primary underline">
            Xem lịch sử
          </button>
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <nav className="flex items-center justify-between px-8 bg-surface border-b border-border" style={{ height: 64 }}>
          <div className="skeleton h-4 w-20 rounded" />
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton h-8 w-24 rounded-lg" />
        </nav>
        <div className="max-w-3xl mx-auto w-full px-4 py-8 flex flex-col gap-5">
          <div className="bg-surface border border-border rounded-2xl p-8 flex gap-6">
            <div className="skeleton w-28 h-28 rounded-full flex-shrink-0" />
            <div className="flex flex-col gap-3 flex-1">
              <div className="skeleton h-6 w-32 rounded" />
              <div className="skeleton h-4 w-48 rounded" />
              <div className="flex gap-6">
                {[0, 1, 2].map(i => <div key={i} className="skeleton h-8 w-16 rounded" />)}
              </div>
            </div>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-4">
            <div className="skeleton h-5 w-32 rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-5/6 rounded" />
          </div>
        </div>
      </div>
    )
  }

  const { score, accuracy, timeSpent, topicBreakdown, examId, answers = {} } = result
  const topics = Object.entries(topicBreakdown ?? {})
  const examObj = loadExamById(examId)

  const wrongQuestions = allQuestions
    .filter(q => { const c = answers[q.id] ?? null; return c !== null && c !== q.correct })
    .sort((a, b) => (DIFF_RANK[b.difficulty] || 0) - (DIFF_RANK[a.difficulty] || 0))

  const wrongCount = wrongQuestions.length

  // RadarChart data
  const radarData = topics.map(([t, tb]) => ({
    topic: getTopicLabel(t),
    score: Math.round(tb.accuracy * 100),
    fullMark: 100,
  }))

  const color = arcColor(score)

  const TABS = [
    { id: 'overview', label: 'Kết quả' },
    { id: 'insights', label: 'Nhận xét' },
    { id: 'wrong', label: wrongCount > 0 ? `Câu sai (${wrongCount})` : 'Câu sai' },
    { id: 'schools', label: 'Trường phù hợp' },
  ]

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit"
      className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {showShareCard && (
        <ResultShareCard
          result={result}
          examTitle={examObj?.title}
          personalBest={isPersonalBest}
          onClose={() => setShowShareCard(false)}
        />
      )}

      {/* NavBar */}
      <nav className="relative z-10 flex items-center justify-between px-8 bg-surface border-b border-border" style={{ height: 64 }}>
        <button onClick={() => navigate('/exams')}
          className="flex items-center gap-1.5 font-sans text-[0.8125rem] text-muted hover:text-foreground transition">
          ← Trang chủ
        </button>
        <span className="font-sans text-sm font-semibold text-foreground">Kết quả thi</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowShareCard(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-elevated border border-border rounded-lg font-sans text-xs text-muted hover:text-foreground transition"
            title="Chia sẻ kết quả">
            📤
          </button>
          <button onClick={() => navigate('/history')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-elevated border border-border rounded-lg font-sans text-xs text-muted hover:text-foreground transition">
            Lịch sử
          </button>
        </div>
      </nav>

      <div className="relative z-10 flex flex-col gap-5 max-w-3xl mx-auto w-full px-4 py-8">

        {/* ── Score hero — Tier-2 GSAP tilt-in entrance wraps the existing framer-motion fade/rise ── */}
        <Reveal3D variant="tilt" amount={0.3}>
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative flex items-center gap-8 glass-base rounded-2xl px-8 py-8"
        >
          {/* Tier 3 — one-shot WebGL particle burst layered alongside (not replacing) canvas-confetti above */}
          {showCelebrationScene && (
            <div className="absolute inset-0" style={{ pointerEvents: 'none', zIndex: 5 }}>
              <Scene3DLazy
                scene={() => import('../components/motion/scenes/ResultsCelebrationScene.jsx')}
                sceneProps={{ onComplete: () => setShowCelebrationScene(false) }}
                fallback={null}
              />
            </div>
          )}
          <div ref={scoreRef} className="flex-shrink-0 score-circle">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" stroke="var(--border)" strokeWidth="6" fill="none" />
              <motion.circle
                cx="60" cy="60" r="54" stroke={color} strokeWidth="6" fill="none"
                strokeLinecap="round" strokeDasharray={CIRC}
                initial={{ strokeDashoffset: CIRC }}
                animate={{ strokeDashoffset: scoreInView ? CIRC * (1 - score / 10) : CIRC }}
                transition={{ duration: 1.6, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                transform="rotate(-90 60 60)"
                onAnimationComplete={() => {
                  if (score >= 7 && !confettiFiredRef.current) {
                    confettiFiredRef.current = true
                    confetti({
                      particleCount: score >= 9 ? 300 : 150,
                      spread: 70,
                      origin: { x: 0.5, y: 0.25 },
                      colors: ['#A6620C', '#4C3B8C', '#059669', '#F0A93E'],
                      ticks: 300, scalar: 1.2,
                    })
                    setShowCelebrationScene(true)
                  }
                }}
              />
              <foreignObject x="20" y="38" width="80" height="40">
                <div xmlns="http://www.w3.org/1999/xhtml"
                  style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 26, fontWeight: 700, color, textAlign: 'center', lineHeight: '40px' }}>
                  <NumberTicker value={score} startValue={0} decimalPlaces={1} duration={scoreInView ? 1500 : 0} />
                </div>
              </foreignObject>
            </svg>
          </div>
          <motion.div
            className="flex flex-col gap-3 flex-1"
            initial="hidden"
            animate={scoreInView ? 'show' : 'hidden'}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.6 } } }}
          >
            <motion.div variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }} className="flex items-center gap-3">
              <span className={`font-sans text-[26px] font-bold leading-tight ${score >= 7 ? 'text-gradient-brand' : 'text-foreground'}`}>{scoreLabel(score)}</span>
              <HelixDecor color={color} />
            </motion.div>
            <motion.span variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }} className="font-sans text-[0.8125rem] text-faint">{examObj?.title ?? examId}</motion.span>
            <motion.div variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }} className="flex items-center gap-6 flex-wrap">
              <div className="flex flex-col gap-0.5">
                <span className="font-sans text-[0.6875rem] text-faint">Độ chính xác</span>
                <span className="font-sans text-[15px] font-semibold text-foreground">{Math.round(accuracy * 100)}%</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-sans text-[0.6875rem] text-faint">Thời gian</span>
                <span className="font-sans text-[15px] font-semibold text-foreground">{formatTime(timeSpent)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-sans text-[0.6875rem] text-faint">Đã trả lời</span>
                <span className="font-sans text-[15px] font-semibold text-foreground">{result.answeredCount}/{allQuestions.length || result.answeredCount}</span>
              </div>
              {overallDelta != null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.0, duration: 0.3 }}
                  className="flex flex-col gap-0.5"
                >
                  <span className="font-sans text-[0.6875rem] text-faint">So bài trước</span>
                  <span className="font-sans text-[15px] font-semibold" style={{ color: overallDelta > 0 ? 'var(--success)' : overallDelta < 0 ? 'var(--destructive)' : 'var(--muted-fg)' }}>
                    {overallDelta > 0 ? '+' : ''}{overallDelta.toFixed(1)}
                  </span>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
        </Reveal3D>

        {/* Personal best */}
        <AnimatePresence>
          {isPersonalBest && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 px-5 py-3.5 rounded-xl glass-brand">
              <span className="text-xl">🏆</span>
              <span className="font-sans text-sm font-semibold text-primary">Điểm cao nhất của bạn trên đề thi này!</span>
            </motion.div>
          )}
          {isScoreDrop && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 px-5 py-3.5 rounded-xl glass-base">
              <span className="text-xl">💪</span>
              <span className="font-sans text-[0.8125rem] text-muted">
                Hôm nay chưa phải ngày tốt nhất của bạn — không sao cả. Kỷ lục của bạn vẫn là{' '}
                <strong className="text-[var(--accent)]">{personalBestScore}</strong> điểm. Hãy ôn lại và thử lại!
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Attempt trend sparkline — only when ≥2 attempts on this exam */}
        {pastSameExam.length >= 1 && result && (() => {
          const sorted = [...pastSameExam, result]
            .sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt))
          const chartData = sorted.map((r, i) => ({ n: i + 1, s: r.score }))
          const prev = sorted[sorted.length - 2]
          const diff = result.score - prev.score
          return (
            <div className="flex items-center gap-4 px-5 py-4 rounded-xl glass-base">
              <div className="flex flex-col gap-0.5 min-w-[110px]">
                <span className="font-sans text-[0.6875rem] text-faint">Xu hướng ({sorted.length} lần thi)</span>
                <span className="font-sans text-[0.8125rem] font-semibold" style={{ color: diff >= 0 ? 'var(--success)' : 'var(--destructive)' }}>
                  {diff >= 0 ? '+' : ''}{diff.toFixed(1)} so với lần trước
                </span>
              </div>
              <div style={{ width: 140, height: 40 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="n" hide />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      formatter={v => [v.toFixed(1), 'Điểm']}
                      labelFormatter={n => `Lần ${n}`}
                    />
                    <Line type="monotone" dataKey="s" stroke="var(--info)" strokeWidth={2} dot={{ r: 3, fill: 'var(--info)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        })()}

        {/* ── Tab bar ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start h-auto rounded-none bg-transparent border-b border-border p-0">
            {TABS.map(tab => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="relative px-4 py-2.5 font-sans text-[0.8125rem] font-medium rounded-none bg-transparent h-auto flex items-center gap-1 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=inactive]:text-muted-fg hover:text-foreground"
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="results-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* ── Tab: Tổng quan ── */}
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
            {/* Hồ sơ năng lực */}
            <div className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-6">
              <span className="font-sans text-[16px] font-semibold text-foreground">Hồ sơ năng lực</span>
              {topics.length >= 3 ? (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={radarData} outerRadius={85} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                      <PolarGrid stroke="var(--border)" strokeOpacity={0.8} />
                      <PolarAngleAxis
                        dataKey="topic"
                        tick={{ fontSize: topics.length > 8 ? 9 : 10, fill: 'var(--muted-fg)', fontFamily: "'Inter Variable', Inter, sans-serif" }}
                      />
                      <Radar
                        dataKey="score"
                        stroke="rgba(166,98,12,0.6)"
                        fill="rgba(166,98,12,0.15)"
                        strokeWidth={1.5}
                        dot={{ fill: 'var(--primary)', r: 3 }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {topics.map(([topic, tb]) => {
                      const pct = Math.round(tb.accuracy * 100)
                      const color = pct >= 70 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--destructive)'
                      return (
                        <div key={topic} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                          <span className="font-sans text-[0.75rem] text-dim truncate flex-1">{getTopicLabel(topic)}</span>
                          <span className="font-sans text-[0.75rem] font-semibold tabular-nums" style={{ color }}>{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : topics.length > 0 ? (
                <motion.div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                  variants={_listVariants} initial="hidden" animate="visible"
                >
                  {topics.map(([topic, tb]) => {
                    const verdict = topicVerdict(tb.accuracy)
                    return (
                      <motion.div key={topic} variants={_itemVariants}
                        className={`flex flex-col gap-2 px-4 py-3 rounded-xl ${verdict.cls}`}>
                        <span className="font-sans text-[0.8125rem] font-semibold text-foreground">{getTopicLabel(topic)}</span>
                        <span className="font-sans text-xs text-dim">{tb.correct}/{tb.total} · {Math.round(tb.accuracy * 100)}%</span>
                        <span className="font-sans text-[0.6875rem] font-bold" style={{ color: verdict.color }}>{verdict.text}</span>
                      </motion.div>
                    )
                  })}
                </motion.div>
              ) : null}
            </div>

            {/* Navigation shortcuts — compact chip row */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => setActiveTab('insights')}
                className="px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 font-sans text-xs text-primary hover:border-primary hover:bg-primary/10 transition flex items-center gap-1.5">
                <span>✦</span> Nhận xét →
              </button>
              {wrongCount > 0 && (
                <button onClick={() => setActiveTab('wrong')}
                  className="px-3 py-1.5 rounded-lg border border-border font-sans text-xs text-muted hover:border-faint hover:text-foreground transition flex items-center gap-1.5">
                  <span className="text-destructive">✗</span> {wrongCount} câu sai
                </button>
              )}
              {schoolFitList.length > 0 && (
                <button onClick={() => setActiveTab('schools')}
                  className="px-3 py-1.5 rounded-lg border border-border font-sans text-xs text-muted hover:border-faint hover:text-foreground transition flex items-center gap-1.5">
                  <span>⌂</span> Trường phù hợp
                </button>
              )}
              <button onClick={() => { dispatch({ type: 'RESET' }); viewNavigate(navigate, '/exams') }}
                className="px-3 py-1.5 rounded-lg border border-border font-sans text-xs text-muted hover:border-faint hover:text-foreground transition">
                Thi lại
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Tab: Nhận xét (local heuristic — no backend/AI call) ── */}
        {activeTab === 'insights' && localInsights && (
          <motion.div key="insights" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
            {/* What you defended */}
            {(() => {
              const defended = Object.entries(topicBreakdown ?? {}).filter(([, tb]) => tb.accuracy >= 0.6)
              if (!defended.length) return null
              return (
                <div className="bg-surface border border-border rounded-xl p-4">
                  <p className="font-sans text-[13px] font-semibold text-foreground mb-2">✓ Bạn đã giữ vững</p>
                  <div className="flex flex-wrap gap-2">
                    {defended.map(([topic, tb]) => (
                      <span key={topic} className="px-2 py-1 rounded-lg bg-success/10 text-success text-xs font-medium">
                        {getTopicLabel(topic)} · {Math.round(tb.accuracy * 100)}%
                      </span>
                    ))}
                  </div>
                </div>
              )
            })()}

            <div className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-5">
              <span className="font-sans text-[16px] font-semibold text-gradient-aurora">Nhận xét</span>

              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex flex-col gap-0.5">
                  <span className="font-sans text-[0.6875rem] text-faint">Ước tính top</span>
                  <span className="font-sans text-[15px] font-semibold text-info">top {100 - localInsights.percentile}%</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-sans text-[0.6875rem] text-faint">Dự đoán lần tới</span>
                  <span className="font-sans text-[15px] font-semibold text-foreground">
                    {localInsights.predictedScoreRange[0]}–{localInsights.predictedScoreRange[1]}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-sans text-[0.8125rem] font-semibold text-muted">Gợi ý cải thiện</span>
                <ul className="flex flex-col gap-1.5">
                  {localInsights.improvementStrategy.map((tip, i) => (
                    <li key={i} className="font-sans text-[0.8125rem] text-dim flex gap-2">
                      <span className="text-primary flex-shrink-0">·</span> {tip}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="font-sans text-[0.6875rem] text-faint">
                Ước tính dựa trên lịch sử làm bài của bạn trên thiết bị này — không phải kết quả chính thức.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Tab: Câu sai ── */}
        {activeTab === 'wrong' && (
          <motion.div key="wrong" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
            {wrongQuestions.length === 0 ? (
              <div className="py-16 text-center font-sans text-faint">Không có câu sai — xuất sắc!</div>
            ) : (
              <>
                {/* Film Review header */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface-elevated">
                  <span className="text-base flex-shrink-0">🎬</span>
                  <div>
                    <p className="font-sans text-[12px] font-semibold text-foreground">Xem lại phim — {wrongCount} câu</p>
                    <p className="font-sans text-[11px] text-muted">Mỗi câu sai đều có manh mối. Tìm quy luật trong phim của bạn.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {wrongQuestions.map((q, idx) => {
                    const open = wrongAccordion[q.id]
                    const timing = (result.timePerQuestion ?? result.questionTimings)?.[q.id]
                    const chosenIdx = answers[q.id] ?? null
                    const chosenLetter = chosenIdx != null ? String.fromCharCode(65 + chosenIdx) : null
                    const filmHint = (() => {
                      if (timing != null && timing < 15 && chosenLetter) return `Chọn ${chosenLetter} chỉ trong ${timing}s — có thể đọc chưa kỹ đề bài.`
                      if (timing != null && timing > 180 && chosenLetter) return `Bạn dành ${Math.round(timing / 60)}m — câu này cần xem lại lý thuyết nền.`
                      if (chosenLetter) return `Bạn chọn ${chosenLetter}. Đọc lại từng bước để tìm chỗ phân kỳ.`
                      return 'Bỏ trống — ưu tiên xem lời giải trước tiên.'
                    })()
                    return (
                      <div key={q.id} className="rounded-xl border border-border overflow-hidden">
                        <button
                          onClick={() => setWrongAccordion(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                          className="w-full flex items-center justify-between px-5 py-3.5 bg-surface-elevated hover:bg-surface transition text-left"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-destructive/10 border border-destructive flex items-center justify-center font-sans text-[0.625rem] font-bold text-destructive flex-shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-sans text-[0.8125rem] text-muted overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              <MathText>{q.question}</MathText>
                            </span>
                            {timing != null && (
                              <span className={`font-sans text-[0.6875rem] flex-shrink-0 ${timing > 120 ? 'text-[var(--accent)]' : 'text-faint'}`}>
                                ⏱ {timing >= 60 ? `${Math.floor(timing/60)}m${timing%60}s` : `${timing}s`}
                              </span>
                            )}
                          </div>
                          <span className="text-faint text-sm ml-2 flex-shrink-0">{open ? '▲' : '▼'}</span>
                        </button>
                        <AnimatePresence>
                          {open && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                              <div className="px-5 py-4 flex flex-col gap-3 border-t border-border">
                                <p className="font-sans text-[11px] text-info italic">{filmHint}</p>
                                <MathText className="font-sans text-[0.8125rem] text-foreground leading-relaxed">{q.question}</MathText>
                                <div className="flex flex-col gap-2">
                                  {q.choices.map((c, i) => {
                                    const chosen = answers[q.id] ?? null
                                    const isCorrect = i === q.correct
                                    const isChosen = i === chosen
                                    const bg = isCorrect ? 'color-mix(in srgb, var(--success) 8%, transparent)' : isChosen ? 'color-mix(in srgb, var(--destructive) 8%, transparent)' : 'var(--surface-elevated)'
                                    const borderColor = isCorrect ? 'var(--success)' : isChosen ? 'var(--destructive)' : 'var(--border)'
                                    const labelColor = isCorrect ? 'var(--success)' : isChosen ? 'var(--destructive)' : 'var(--faint)'
                                    const textColor = isCorrect ? 'var(--success)' : isChosen ? 'var(--destructive)' : 'var(--dim)'
                                    return (
                                    <div key={i} className="flex items-start gap-2.5 px-4 py-2.5 rounded-lg"
                                      style={{ background: bg, border: `1px solid ${borderColor}` }}>
                                      <span className="font-sans text-xs font-bold flex-shrink-0"
                                        style={{ color: labelColor }}>
                                        {String.fromCharCode(65 + i)}.
                                      </span>
                                      <span className="font-sans text-[0.8125rem]" style={{ color: textColor }}>
                                        <MathText>{c}</MathText>
                                        {isCorrect && <span className="ml-2 text-[0.6875rem]">✓ Đáp án đúng</span>}
                                        {isChosen && !isCorrect && <span className="ml-2 text-[0.6875rem] text-destructive">← Bạn đã chọn</span>}
                                      </span>
                                    </div>
                                    )
                                  })}
                                </div>
                                {/* Step-by-step explanation */}
                                {q.explanation && (() => {
                                  const steps = parseExplanationSteps(q.explanation)
                                  const shown = revealedSteps[q.id] ?? 0
                                  return (
                                    <div className="flex flex-col gap-2 pt-1 border-t border-border">
                                      <span className="font-sans text-[0.6875rem] font-semibold text-success">Lời giải</span>
                                      {steps.slice(0, shown).map((step, si) => (
                                        <div key={si} className="flex gap-2 px-3 py-2 rounded-lg bg-success/5 border border-success/20">
                                          {steps.length > 1 && (
                                            <span className="font-sans text-[0.625rem] font-bold text-success mt-0.5 flex-shrink-0">
                                              {si + 1}.
                                            </span>
                                          )}
                                          <MathText className="font-sans text-xs text-success/80 leading-relaxed">
                                            {step}
                                          </MathText>
                                        </div>
                                      ))}
                                      {shown === 0 && (
                                        <button
                                          onClick={() => setRevealedSteps(prev => ({ ...prev, [q.id]: 1 }))}
                                          className="self-start font-sans text-xs text-success hover:text-success/60 transition"
                                        >
                                          Xem lời giải →
                                        </button>
                                      )}
                                      {shown > 0 && shown < steps.length && (
                                        <div className="flex items-center gap-3">
                                          <button
                                            onClick={() => setRevealedSteps(prev => ({ ...prev, [q.id]: shown + 1 }))}
                                            className="font-sans text-xs text-success hover:text-success/60 transition"
                                          >
                                            Xem bước tiếp theo →
                                          </button>
                                          <button
                                            onClick={() => setRevealedSteps(prev => ({ ...prev, [q.id]: steps.length }))}
                                            className="font-sans text-xs text-faint hover:text-muted transition"
                                          >
                                            Xem tất cả
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ── Tab: Trường phù hợp ── */}
        {activeTab === 'schools' && (
          <motion.div key="schools" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col gap-4">
            <div className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <span className="font-sans text-[16px] font-semibold text-foreground">Khả năng đỗ THPT</span>
                <span className="font-sans text-[0.6875rem] text-faint">Điểm Toán: <span className="text-primary font-bold">{score.toFixed(1)}/10</span></span>
              </div>
              <p className="font-sans text-xs text-faint">Dựa trên điểm chuẩn môn Toán các năm gần nhất.</p>
              <div className="flex flex-col gap-4">
                {schoolFitList.map(school => {
                  const prob = school.prob
                  const barColor = prob >= 70 ? 'var(--success)' : prob >= 40 ? 'var(--warning)' : 'var(--destructive)'
                  return (
                    <div key={school.id} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-sans text-[0.8125rem] font-semibold text-foreground">{school.name}</span>
                          <span className="font-sans text-[0.6875rem] text-faint">{school.district} · Chuẩn Toán: {school.cutoff}</span>
                        </div>
                        <span className="font-sans text-[20px] font-bold flex-shrink-0 ml-4" style={{ color: barColor }}>
                          {prob}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: barColor }}
                          initial={{ width: 0 }}
                          animate={{ width: `${prob}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="font-sans text-[0.6875rem] text-faint">
                Xác suất ước tính theo hàm sigmoid so với điểm chuẩn năm gần nhất. Không phải kết quả chính thức.
              </p>
            </div>
          </motion.div>
        )}

      </div>
    </motion.div>
  )
}

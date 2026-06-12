import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import CountUp from 'react-countup'
import confetti from 'canvas-confetti'
import { useAuth } from '../context/AuthContext.jsx'
import { NumberTicker } from '../components/ui/number-ticker.jsx'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { pageVariants, viewNavigate } from '../utils/animations.js'
import AchievementCeremony from '../components/AchievementCeremony.jsx'
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { useExam, useExamDispatch } from '../context/ExamContext.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { scoreExam } from '../engine/scoringEngine.js'
import { analyzeResult } from '../engine/aiEngine.js'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  LineChart, Line, XAxis, Tooltip,
} from 'recharts'
import { loadExamById, loadQuestionsByIds, buildStudyPlanPayload, buildAnalyzePayload, recommendNextExam } from '../api/index.js'
import { analyzeResult as aiAnalyzeResult, analyzeResultStream, generateStudyPlan, getPercentile, predictScore, postHistory } from '../api/aiClient.js'
import { loadPreferences } from '../utils/aiPreferences.js'
import AIInsights from '../components/AIInsights.jsx'
import AIErrorBoundary from '../components/AIErrorBoundary.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { MathText } from '../components/MathText.jsx'
import { TOPIC_LABELS, getTopicLabel } from '../utils/topicLabels.js'
import { useOracle } from '../context/OracleContext.jsx'
import { classifyLearner } from '../utils/learnerArchetype.js'
import { TOPIC_ID_MAP } from '../utils/learningGraph.js'
import { safeSetItem } from '../utils/storageManager.js'
import { requestStudyReminder, checkAndShowStudyReminder } from '../utils/studyReminder.js'
import ResultShareCard from '../components/ResultShareCard.jsx'
import { useToast } from '../context/ToastContext.jsx'
import MarkdownProse from '../components/MarkdownProse.jsx'
import schoolsData from '../data/schools.json'
import provincePatterns from '../data/province_patterns.json'
import scoreCorrelation from '../data/score_correlation.json'
const DIFF_RANK = { hard: 3, medium: 2, easy: 1 }

const _listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}
const _itemVariants = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
}

function parseSchoolsFromText(text) {
  if (!text) return []
  const parts = text.split(/(?=\(\d+\))/).filter(Boolean)
  if (parts.length <= 1) return []
  return parts.map((raw, i) => {
    const clean = raw.replace(/^\(\d+\)\s*/, '').trim()
    const dashIdx = clean.indexOf('—')
    const name = dashIdx > -1 ? clean.slice(0, dashIdx).trim() : clean
    const note = dashIdx > -1 ? clean.slice(dashIdx + 1).trim() : ''
    return { name, note, score_range: '', type: '', region_note: '' }
  })
}

function parseScoreRange(rangeStr) {
  if (!rangeStr) return null
  const nums = rangeStr.match(/[\d.]+/g)
  if (!nums || nums.length < 2) return null
  return { min: parseFloat(nums[0]), max: parseFloat(nums[1]) }
}

function SchoolCard({ school, studentScore }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -20px 0px' })
  const range = parseScoreRange(school.score_range)
  // Match ratio: how far the student's score falls within [min-2, max] window (clamped 0–1)
  const matchRatio = range
    ? Math.min(1, Math.max(0, (studentScore - (range.min - 2)) / (range.max - range.min + 2)))
    : null

  return (
    <motion.div
      ref={ref}
      variants={_itemVariants}
      className="rounded-xl glass-base p-4 flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <h4
          className="font-sans font-semibold text-sm text-highlight leading-snug"
          style={{ overflowWrap: 'break-word', hyphens: 'none' }}
        >
          {school.name}
        </h4>
        {school.type && (
          <span className="shrink-0 text-[0.6875rem] px-2 py-0.5 rounded-full bg-info/10 text-info border border-info/30">
            {school.type}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-faint">
        {school.score_range && <span>🎯 {school.score_range}</span>}
        {school.region_note && <span>📍 {school.region_note}</span>}
      </div>
      {matchRatio !== null && (
        <div className="h-1 rounded-full bg-border overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-blue-500 origin-left"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: inView ? matchRatio : 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        </div>
      )}
      {school.note && (
        <p className="font-sans text-[0.8125rem] text-dim leading-relaxed" style={{ overflowWrap: 'break-word', hyphens: 'none' }}>
          {school.note}
        </p>
      )}
    </motion.div>
  )
}

function SchoolList({ schools, studentScore }) {
  if (!schools || schools.length === 0) return null
  if (schools.length > 3) {
    return (
      <div
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {schools.map((s, i) => (
          <div key={i} className="flex-shrink-0 w-72" style={{ scrollSnapAlign: 'start' }}>
            <SchoolCard school={s} studentScore={studentScore} />
          </div>
        ))}
      </div>
    )
  }
  return (
    <motion.div
      variants={_listVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {schools.map((s, i) => <SchoolCard key={i} school={s} studentScore={studentScore} />)}
    </motion.div>
  )
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

function pctColor(acc) {
  if (acc >= 0.7) return '#10B981'
  if (acc >= 0.5) return '#FBBF24'
  return '#FB7185'
}

function arcColor(score) {
  if (score >= 8) return '#10B981'
  if (score >= 5) return '#F59E0B'
  return '#FB7185'
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
  if (acc >= 0.7) return { text: '✓ Tốt', color: '#10B981', cls: 'bg-success/5 border border-success/20' }
  if (acc >= 0.5) return { text: '⚠ Cần ôn', color: '#FBBF24', cls: 'bg-primary/5 border border-primary/20' }
  return { text: '✗ Yếu', color: '#FB7185', cls: 'bg-destructive/5 border border-destructive/20' }
}

function addToReviewQueue(examId, answers, questions, uid) {
  try {
    const key = `review_queue-${uid ?? 'guest'}`
    const queue = JSON.parse(localStorage.getItem(key) ?? '{}')
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dueDate = tomorrow.toISOString().slice(0, 10)
    for (const q of questions) {
      const chosen = answers[q.id] ?? null
      const isWrong = chosen === null || chosen !== q.correct
      if (isWrong && !queue[q.id]) {
        queue[q.id] = { interval: 1, dueDate }
      }
    }
    localStorage.setItem(key, JSON.stringify(queue))
  } catch { /* non-critical */ }
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

function ProvincePatternTip({ province }) {
  if (!province) return null
  const patterns = provincePatterns[province]
  if (!patterns || patterns.length === 0) return null
  return (
    <div className="glass-base rounded-xl px-5 py-4 flex flex-col gap-2">
      <span className="font-sans text-xs font-semibold text-info">📌 Xu hướng đề thi {province}</span>
      {patterns.map((p, i) => (
        <p key={i} className="font-sans text-[0.8125rem] text-muted">{p.note}</p>
      ))}
    </div>
  )
}

function ScoreCorrelation({ examId, score, province }) {
  if (!examId || score == null || !province) return null
  const examData = scoreCorrelation[examId]
  if (!examData) return null
  const provData = examData[province]
  if (!provData) return null
  const ranges = Object.entries(provData)
  const range = ranges.find(([k]) => {
    const [lo, hi] = k.split('-').map(Number)
    return score >= lo && score <= hi
  })
  if (!range) return null
  const [, { school, predictedScore }] = range
  return (
    <div className="glass-base rounded-xl px-5 py-4 flex flex-col gap-1">
      <span className="font-sans text-xs font-semibold text-success">📊 Dự đoán thực tế</span>
      <p className="font-sans text-[0.8125rem] text-muted">
        Điểm thi thử của bạn tương ứng với khoảng{' '}
        <strong className="text-foreground">{predictedScore} điểm</strong> tuyển sinh vào{' '}
        <strong className="text-foreground">{school}</strong>.
      </p>
      <span className="font-sans text-[0.625rem] text-faint">Ước tính dựa trên dữ liệu lịch sử · Không phải kết quả chính thức</span>
    </div>
  )
}

export default function Results({ onOpenAuth }) {
  usePageMeta('Kết quả thi', { noindex: true })
  const navigate = useNavigate()
  const location = useLocation()
  const { resultId } = useParams()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview')
  const session = useExam()
  const dispatch = useExamDispatch()
  const { results, addResult } = useHistory()
  const { user, refundCredits, refreshUser } = useAuth()
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const [practiceNudgeDismissed, setPracticeNudgeDismissed] = useState(false)
  const [result, setResult] = useState(() => location.state?.result ?? null)
  const [allQuestions, setAllQuestions] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const [planReady, setPlanReady] = useState(false)
  const [wrongAccordion, setWrongAccordion] = useState({})
  const [revealedSteps, setRevealedSteps] = useState({})
  const [nextExam, setNextExam] = useState(null)
  const [showShareCard, setShowShareCard] = useState(false)
  const [percentile, setPercentile] = useState(null)
  const [predictedScoreData, setPredictedScoreData] = useState(null)
  const [streakRecovered, setStreakRecovered] = useState(false)
  const [studyPlanError, setStudyPlanError] = useState(null)
  const [studyPlanLoading, setStudyPlanLoading] = useState(false)
  const confettiFiredRef = useRef(false)
  const scoreRef = useRef(null)
  const scoreInView = useInView(scoreRef, { once: true, margin: '0px 0px -40px 0px' })
  const toast = useToast()
  const challengerData = location.state?.challengerScore != null ? {
    score: location.state.challengerScore,
    name: location.state.challengerName || 'Đối thủ',
  } : null

  const isCurrent = !resultId || resultId === 'current'
  const savedRef = useRef(false)
  const { setPageContext } = useOracle()
  useEffect(() => {
    if (!result) return
    const weakTopics = analysis?.weak_topics ?? []
    setPageContext({ inExam: false, examTitle: loadExamById(result.examId)?.title ?? '', weakTopics, score: result.score })
    return () => setPageContext({})
  }, [result?.examId, analysis?.weak_topics]) // eslint-disable-line react-hooks/exhaustive-deps

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
      // Post history directly to capture streak_recovered from server response
      if (navigator.onLine) {
        const historyEntry = {
          result_id: scored.id,
          exam_id: scored.examId ?? null,
          score: scored.score ?? null,
          payload: { ...scored, durationSeconds: scored.timeSpent ?? null },
          created_at: scored.createdAt ?? null,
        }
        postHistory([historyEntry]).then(({ data }) => {
          if (data?.streak_recovered) setStreakRecovered(true)
          sessionStorage.removeItem('zenith_weekly_summary')
        })
      }
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
    if (!result) return
    let cancelled = false
    const abortCtrl = new AbortController()
    const allPast = results.filter(r => r.id !== result.id)
    const examObj = loadExamById(result.examId)

    async function run() {
      // Don't run side effects while still at /results/current — about to navigate away
      if (isCurrent) return

      // Add wrong questions to spaced-repetition queue
      if (examObj) {
        const qs = await loadQuestionsByIds(examObj.questionIds)
        if (!cancelled) addToReviewQueue(result.examId, result.answers, qs, user?.id)
      }

      // Request notification permission on first result load (high engagement moment)
      if (results.length === 1) {
        requestStudyReminder()
      }
      checkAndShowStudyReminder()

      // Fetch leaderboard percentile
      if (result.examId && result.score != null) {
        getPercentile(result.examId, result.score).then(({ data }) => {
          if (!cancelled && data?.percentile != null) setPercentile(data.percentile)
        })
      }

      const planCacheKey = `study-plan-data-${result.id}`
      const planCached = localStorage.getItem(planCacheKey)
      const prefetchFlag = `_prefetching-${result.id}`
      if (planCached) {
        setPlanReady(true)
      } else if (!window[prefetchFlag]) {
        if ((user?.credits_balance ?? 0) < 5) {
          setStudyPlanError('Không đủ credits. Cần ít nhất 5 Tia để tạo kế hoạch.')
        } else {
          window[prefetchFlag] = true
          if (!cancelled) setStudyPlanLoading(true)
          const _archetype = classifyLearner(results)
          buildStudyPlanPayload(result, allPast).then(payload =>
            generateStudyPlan({ ...payload, learner_archetype: _archetype?.id ?? null, ai_preferences: loadPreferences() }).then(({ data }) => {
              delete window[prefetchFlag]
              if (data && !cancelled) { localStorage.setItem(planCacheKey, JSON.stringify(data)); setPlanReady(true) }
              if (!cancelled) setStudyPlanLoading(false)
            })
          )
        }
      }

      const localAnalysis = analyzeResult(result, allPast, [])

      // Skip AI call until auth is confirmed — prevents double-fire on hydration
      if (!user?.id) {
        if (!cancelled) setAnalysis(localAnalysis)
        return
      }

      const cacheKey = `ai-analysis-${user.id}-${result.id}`
      const AI_CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days
      const cachedRaw = localStorage.getItem(cacheKey)
      if (cachedRaw) {
        try {
          const entry = JSON.parse(cachedRaw)
          const userGradeNum = user?.grade ? parseInt(user.grade, 10) : null
          const needsSchoolInsight = userGradeNum !== null && userGradeNum >= 10
          const cacheHasSchoolInsight = !!entry.data?.school_insight
          if (entry.ts && Date.now() - entry.ts < AI_CACHE_TTL && entry.data?._source === 'ai' && (!needsSchoolInsight || cacheHasSchoolInsight)) {
            if (!cancelled) setAnalysis(entry.data)
            return
          }
        } catch { /* stale or corrupt — re-fetch */ }
      }

      if (!cancelled) {
        setAnalysis(localAnalysis)
        setAiLoading(true)
        setAiError(null)
      }
      const obj = examObj || {}
      const archetype = classifyLearner(results)
      const payload = await buildAnalyzePayload(
        result, allPast, [], obj.category || '',
        { location: user.province || '', province: user.province || '', grade: user.grade || '', display_name: user.display_name || '' }
      )
      payload.learner_archetype = archetype?.id ?? null
      if (cancelled) return
      const _prevTitle = document.title
      document.title = '⏳ Đang phân tích...'
      analyzeResultStream(payload, (updates) => {
        // Called via RAF with accumulated field values as they stream in
        if (cancelled) return
        setAnalysis(prev => ({ ...(prev || {}), ...updates, _streaming: true }))
      }, abortCtrl.signal).then(({ data: analysisObj, error, status: streamStatus }) => {
        if (cancelled) return
        document.title = _prevTitle
        setAiLoading(false)
        // If the stream HTTP succeeded (200), backend already charged 3 credits.
        // Never call aiAnalyzeResult as fallback — it would double-charge.
        const streamHttpOk = streamStatus === 200
        if (analysisObj && Object.keys(analysisObj).length > 0) {
          const aiAnalysis = { ...analysisObj, _source: 'ai', _streaming_done: true }
          safeSetItem(cacheKey, JSON.stringify({ data: aiAnalysis, ts: Date.now() }))
          setAnalysis(aiAnalysis)
          refreshUser()
        } else {
          const failed = !!error
          if (streamStatus === 402) {
            setAiError('Không đủ credits để phân tích. Nạp thêm credits trong trang Tài khoản.')
          } else if (streamStatus === 401) {
            setAiError('Vui lòng đăng nhập để dùng tính năng AI.')
          } else if (failed) {
            setAiError(typeof error === 'string' ? error : 'Phân tích AI tạm thời không khả dụng.')
          } else {
            setAiError(null)
          }
          // Only fall back to non-streaming if stream never connected (not HTTP 200)
          if (failed && !streamHttpOk && streamStatus !== 402 && !cancelled) {
            refundCredits(3)
            aiAnalyzeResult(payload).then(({ data, status: fbStatus }) => {
              if (cancelled || !data) {
                if (fbStatus === 402) setAiError('Không đủ credits để phân tích. Nạp thêm credits trong trang Tài khoản.')
                return
              }
              const aiAnalysis = { ...data, _source: 'ai' }
              safeSetItem(cacheKey, JSON.stringify({ data: aiAnalysis, ts: Date.now() }))
              setAnalysis(aiAnalysis)
              setAiError(null)
              refreshUser()
            })
          }
        }
      })
    }

    run()
    return () => { cancelled = true; abortCtrl.abort() }
  }, [result?.id, user?.id, isCurrent, retryKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Overall score delta vs immediate previous exam (any exam, not just same)
  const prevResult = result ? results.find(r => r.id !== result.id) : null
  const overallDelta = prevResult != null ? result.score - prevResult.score : null

  // Personal best check — computed before early returns so hook order stays stable
  const pastSameExam = result ? results.filter(r => r.examId === result.examId && r.id !== result.id) : []
  const isPersonalBest = result != null && pastSameExam.length > 0 && result.score > Math.max(...pastSameExam.map(r => r.score))
  const personalBestScore = pastSameExam.length > 0 ? Math.max(...pastSameExam.map(r => r.score)) : null
  const isScoreDrop = result != null && pastSameExam.length > 0 && !isPersonalBest && result.score < personalBestScore

  // Recovery Path identity message — shown when this is a personal best retake of an exam that had a recovery path
  const recoveryPathTopic = (() => {
    if (!isPersonalBest || !user?.id || pastSameExam.length === 0) return null
    const prevResult = [...pastSameExam].sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))[0]
    if (!prevResult) return null
    try {
      const plan = JSON.parse(localStorage.getItem(`recovery-path-data-${user.id}-${prevResult.id}`) ?? 'null')
      return plan?.focus_areas?.[0]?.topic ?? null
    } catch { return null }
  })()

  // Recommend next exam based on weak topics
  useEffect(() => {
    if (!result || !results.length) return
    const weak = Object.entries(result.topicBreakdown ?? {})
      .filter(([, tb]) => tb.accuracy < 0.6)
      .map(([t]) => t)
    const attemptedIds = results.map(r => r.examId).filter(Boolean)
    recommendNextExam(weak, attemptedIds).then(exam => {
      if (exam) setNextExam(exam)
    })
  }, [result?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // These must stay ABOVE the conditional return to keep hook order stable
  const isPaidUser = user?.subscription_tier === 'student' || user?.subscription_tier === 'complete'
  const isComplete = user?.subscription_tier === 'complete'

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
    const userProvince = user?.province ?? null
    const score = result.score
    const scored = schoolsData
      .map(s => {
        const cutoff = latestCutoff(s)
        if (cutoff === null) return null
        const prob = schoolFitProbability(score, cutoff)
        return { ...s, prob, cutoff }
      })
      .filter(Boolean)
    scored.sort((a, b) => {
      const aMatch = userProvince && a.province === userProvince
      const bMatch = userProvince && b.province === userProvince
      if (aMatch && !bMatch) return -1
      if (!aMatch && bMatch) return 1
      const da = Math.abs(a.prob - 50)
      const db = Math.abs(b.prob - 50)
      return da - db
    })
    return scored.slice(0, 6)
  }, [result?.score, user?.province]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isComplete || !result) return
    predictScore().then(({ data }) => {
      if (data?.predicted != null) setPredictedScoreData(data)
    })
  }, [result?.id, isComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  const topicTrends = useMemo(() => {
    if (!isPaidUser || !results.length) return null
    const cutoff = Date.now() - 30 * 86400000
    const recent = results.filter(r => new Date(r.timestamp).getTime() >= cutoff)
    if (!recent.length) return null
    const weekData = {}
    for (const r of recent) {
      const weekNum = Math.floor((Date.now() - new Date(r.timestamp).getTime()) / (7 * 86400000))
      const weekLabel = weekNum === 0 ? 'Tuần này' : weekNum === 1 ? 'Tuần trước' : `${weekNum * 7}n trước`
      for (const [qId, chosen] of Object.entries(r.answers ?? {})) {
        const tb = r.topicBreakdown
        if (!tb) continue
        for (const [topic, data] of Object.entries(tb)) {
          if (!weekData[topic]) weekData[topic] = {}
          if (!weekData[topic][weekLabel]) weekData[topic][weekLabel] = { correct: 0, total: 0 }
          weekData[topic][weekLabel].total += data.total ?? 0
          weekData[topic][weekLabel].correct += data.correct ?? 0
        }
      }
    }
    const topics = Object.keys(weekData)
    if (!topics.length) return null
    return topics.map(topic => {
      const weeks = Object.entries(weekData[topic]).map(([week, d]) => ({
        week, accuracy: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
      })).reverse()
      return { topic, weeks }
    }).filter(t => t.weeks.some(w => w.accuracy > 0))
  }, [isPaidUser, results])

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

  const weakTopics = Object.entries(topicBreakdown ?? {})
    .filter(([, tb]) => tb.accuracy < 0.6)
    .map(([t]) => t)

  // RadarChart data
  const radarData = topics.map(([t, tb]) => ({
    topic: getTopicLabel(t),
    score: Math.round(tb.accuracy * 100),
    fullMark: 100,
  }))

  const color = arcColor(score)

  const TABS = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'wrong', label: wrongCount > 0 ? `Câu sai (${wrongCount})` : 'Câu sai' },
    { id: 'schools', label: 'Trường phù hợp' },
    { id: 'plan', label: 'Kế hoạch', loading: studyPlanLoading && !planReady },
    ...(isPaidUser ? [{ id: 'trends', label: 'Xu hướng 30 ngày' }] : []),
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
        <button onClick={() => navigate('/')}
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
          {result && examId && (
            <button
              onClick={() => {
                const BASE_URL = import.meta.env.VITE_APP_URL || 'https://exam-app-ey0.pages.dev'
                const payload = encodeURIComponent(JSON.stringify({
                  name: user?.display_name || 'Bạn',
                  score: result.score ?? 0,
                  examId,
                  dt: new Date().toISOString().slice(0, 10),
                }))
                const url = `${BASE_URL}/challenge?c=${payload}`
                navigator.clipboard?.writeText(url).then(() => toast.success('Đã sao chép link thách đấu')).catch(() => {})
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-elevated border border-border rounded-lg font-sans text-xs text-muted hover:text-foreground transition"
              title="Thách đấu bạn bè"
            >
              ⚔️
            </button>
          )}
          <button onClick={() => navigate('/history')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-elevated border border-border rounded-lg font-sans text-xs text-muted hover:text-foreground transition">
            Lịch sử
          </button>
        </div>
      </nav>

      {streakRecovered && (
        <div className="relative z-10 max-w-3xl mx-auto w-full px-4 pt-4">
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 bg-orange-500/10 border border-orange-500/50">
            <span>🔥</span>
            <p className="text-sm font-semibold text-orange-400">
              Streak khôi phục! Bạn đã làm 2 bài hôm nay — streak của bạn tiếp tục.
            </p>
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col gap-5 max-w-3xl mx-auto w-full px-4 py-8">

        {/* ── Score hero ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex items-center gap-8 glass-base rounded-2xl px-8 py-8"
        >
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
                      colors: ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7'],
                      ticks: 300, scalar: 1.2,
                    })
                  }
                }}
              />
              <foreignObject x="20" y="38" width="80" height="40">
                <div xmlns="http://www.w3.org/1999/xhtml"
                  style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 26, fontWeight: 700, color, textAlign: 'center', lineHeight: '40px' }}>
                  {scoreInView
                    ? <NumberTicker value={score} startValue={0} decimalPlaces={1} duration={1500} />
                    : '0.0'}
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
                  <span className="font-sans text-[15px] font-semibold" style={{ color: overallDelta > 0 ? '#10B981' : overallDelta < 0 ? '#FB7185' : '#64748B' }}>
                    {overallDelta > 0 ? '+' : ''}{overallDelta.toFixed(1)}
                  </span>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Percentile banner */}
        {percentile != null && (
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl glass-base">
            <span className="text-[18px]">📊</span>
            <span className="font-sans text-[0.8125rem] text-muted">
              Bạn đạt <strong className="text-info">top {100 - percentile}%</strong> người làm đề này
            </span>
          </div>
        )}

        {/* Personal best */}
        <AnimatePresence>
          {isPersonalBest && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-2 px-5 py-3.5 rounded-xl glass-brand">
              <div className="flex items-center gap-3">
                <span className="text-xl">🏆</span>
                <span className="font-sans text-sm font-semibold text-primary">Điểm cao nhất của bạn trên đề thi này!</span>
              </div>
              {recoveryPathTopic && (
                <p className="font-sans text-[0.8125rem] text-muted pl-9">
                  Bạn đã sửa được lỗi ở <span className="text-primary font-semibold">{recoveryPathTopic}</span>. Điểm của bạn phản ánh điều đó.
                </p>
              )}
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
                <span className="font-sans text-[0.8125rem] font-semibold" style={{ color: diff >= 0 ? '#10B981' : '#FB7185' }}>
                  {diff >= 0 ? '+' : ''}{diff.toFixed(1)} so với lần trước
                </span>
              </div>
              <div style={{ width: 140, height: 40 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="n" hide />
                    <Tooltip
                      contentStyle={{ background: 'rgba(13,18,33,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                      formatter={v => [v.toFixed(1), 'Điểm']}
                      labelFormatter={n => `Lần ${n}`}
                    />
                    <Line type="monotone" dataKey="s" stroke="#818CF8" strokeWidth={2} dot={{ r: 3, fill: '#818CF8' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        })()}

        {/* Challenger comparison banner */}
        {challengerData && result && (
          <div className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-xl glass-base">
            <div className="flex flex-col gap-0.5">
              <span className="font-sans text-xs text-dim">So với {challengerData.name}</span>
              <span className="font-sans text-[0.8125rem] font-semibold" style={{
                color: (result.score ?? 0) >= challengerData.score ? '#10B981' : '#FB7185'
              }}>
                {(result.score ?? 0) >= challengerData.score ? '🏆 Bạn thắng! ' : '💪 Cố lên! '}
                Bạn: {(result.score ?? 0).toFixed(1)} · {challengerData.name}: {challengerData.score.toFixed(1)}
              </span>
            </div>
          </div>
        )}

        {/* Sign-in nudge */}
        {!user && !nudgeDismissed && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl glass-base">
            <button onClick={onOpenAuth} className="font-sans text-[0.8125rem] text-[var(--accent)] hover:text-[var(--accent)] transition-colors text-left">
              Đăng nhập để lưu kết quả vào tài khoản →
            </button>
            <button onClick={() => setNudgeDismissed(true)} className="text-[var(--muted-fg)] hover:text-[var(--fg-secondary)] text-lg leading-none flex-shrink-0">×</button>
          </div>
        )}

        {/* ── Tab bar ── */}
        <div className="flex border-b border-border">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative px-4 py-2.5 font-sans text-[0.8125rem] font-medium transition-colors flex items-center gap-1"
              style={{ color: activeTab === tab.id ? 'var(--primary)' : '#64748B' }}
            >
              {tab.label}
              {tab.loading && (
                <span className="ml-1 inline-block w-3 h-3 rounded-full border-2 animate-spin flex-shrink-0"
                  style={{ borderColor: '#818CF8', borderTopColor: 'transparent' }} />
              )}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="results-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Tổng quan ── */}
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
            {/* Hồ sơ năng lực */}
            <div className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-6">
              <span className="font-sans text-[16px] font-semibold text-foreground">Hồ sơ năng lực</span>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                variants={_listVariants} initial="hidden" animate="visible"
              >
                {topics.map(([topic, tb]) => {
                  const verdict = topicVerdict(tb.accuracy)
                  return (
                    <motion.div key={topic} variants={_itemVariants}
                      className={`flex flex-col gap-2 px-4 py-3 rounded-xl ${verdict.cls}`}>
                      <span className="font-sans text-[0.8125rem] font-semibold text-highlight">{getTopicLabel(topic)}</span>
                      <span className="font-sans text-xs text-dim">{tb.correct}/{tb.total} · {Math.round(tb.accuracy * 100)}%</span>
                      <span className="font-sans text-[0.6875rem] font-bold" style={{ color: verdict.color }}>{verdict.text}</span>
                    </motion.div>
                  )
                })}
              </motion.div>
            </div>

            {/* AI Insights */}
            <div className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <span className="font-sans text-[16px] font-semibold text-gradient-aurora">Phân tích AI</span>
                {isPaidUser
                  ? <span className="font-sans text-[0.6875rem] text-emerald-400/80">Miễn phí</span>
                  : <span className="font-sans text-[0.6875rem] text-[var(--accent)]/70">⚡3 credits</span>
                }
              </div>
              {/* Streaming progress bar */}
              {analysis?._streaming && !analysis?._streaming_done && (
                <div className="h-0.5 w-full rounded-full bg-border overflow-hidden -mb-2">
                  <motion.div
                    className="h-full rounded-full bg-blue-500/60"
                    initial={{ width: '5%' }}
                    animate={{ width: '85%' }}
                    transition={{ duration: 12, ease: 'easeOut' }}
                  />
                </div>
              )}
              <AIErrorBoundary>
                <AIInsights analysis={analysis} loading={aiLoading && !analysis?._streaming} error={aiError} score={score} />
              </AIErrorBoundary>
            </div>

            {/* Post-analysis practice nudge — appears when stream completes */}
            {analysis?._streaming_done && !practiceNudgeDismissed && user && (analysis?.weak_topics ?? []).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, delay: 0.3 }}
                className="flex items-center justify-between gap-3 px-5 py-3.5 rounded-xl border border-info/30 bg-info/5"
              >
                <p className="font-sans text-[13px] text-foreground min-w-0">
                  Bạn muốn ôn ngay <strong className="text-info">{getTopicLabel(analysis.weak_topics[0])}</strong> không?
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { setPracticeNudgeDismissed(true); navigate(`/practice/adaptive?topic=${analysis.weak_topics[0]}`) }}
                    className="px-3 py-1.5 rounded-lg font-sans text-xs font-bold bg-info text-background hover:opacity-90 transition"
                  >
                    Ôn ngay →
                  </button>
                  <button
                    onClick={() => setPracticeNudgeDismissed(true)}
                    className="font-sans text-xs text-dim hover:text-muted transition"
                  >
                    Để sau
                  </button>
                </div>
              </motion.div>
            )}

            {/* Next exam recommendation */}
            {nextExam && (
              <div className="bg-surface border border-border rounded-xl px-5 py-4 flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-sans text-[0.6875rem] text-dim">Đề tiếp theo cho bạn</span>
                  <span className="font-sans text-sm font-semibold text-foreground truncate">{nextExam.title}</span>
                </div>
                <button
                  onClick={() => navigate(`/test/${nextExam.id}`)}
                  className="flex-shrink-0 px-4 py-2 rounded-lg font-sans text-xs font-bold bg-primary text-primary-fg"
                >
                  Bắt đầu →
                </button>
              </div>
            )}

            {/* Predictive Score card (Complete tier) */}
            {predictedScoreData && (
              <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl glass-base">
                <div className="flex flex-col gap-0.5">
                  <span className="font-sans text-[0.6875rem] text-dim">Dự đoán điểm thi thật</span>
                  <span className="font-sans text-[15px] font-bold text-success">
                    {predictedScoreData.predicted}/10
                    <span className="font-normal text-faint text-xs ml-1.5">
                      ({predictedScoreData.low}–{predictedScoreData.high})
                    </span>
                  </span>
                  <span className="font-sans text-[0.6875rem] text-faint">
                    Độ tin cậy: {predictedScoreData.confidence === 'high' ? 'Cao' : predictedScoreData.confidence === 'medium' ? 'Trung bình' : 'Thấp'}
                    {' '}· Dựa trên {predictedScoreData.sample_size} bài làm gần nhất
                  </span>
                </div>
                <span className="text-2xl flex-shrink-0">📊</span>
              </div>
            )}

            {/* Province exam pattern tip */}
            <ProvincePatternTip province={user?.province} />

            {/* Score correlation */}
            <ScoreCorrelation examId={examId} score={score} province={user?.province} />

            {/* Navigation shortcuts — compact chip row */}
            <div className="flex flex-wrap gap-2 pt-1">
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
              <button onClick={() => setActiveTab('plan')}
                className="px-3 py-1.5 rounded-lg border border-border font-sans text-xs text-muted hover:border-faint hover:text-foreground transition flex items-center gap-1.5">
                {!planReady && <span className="w-2.5 h-2.5 rounded-full border border-border border-t-primary animate-spin flex-shrink-0" />}
                {planReady ? '→ Kế hoạch' : 'Đang tải kế hoạch…'}
              </button>
              {weakTopics.length > 0 && (
                <button onClick={() => navigate(`/practice/adaptive?topic=${weakTopics[0]}`)}
                  className="px-3 py-1.5 rounded-lg border border-info/30 font-sans text-xs text-info hover:border-info hover:text-info/80 transition flex items-center gap-1.5">
                  <span>⚡</span> Luyện điểm yếu
                </button>
              )}
              <button onClick={() => { dispatch({ type: 'RESET' }); viewNavigate(navigate, '/exams') }}
                className="px-3 py-1.5 rounded-lg border border-border font-sans text-xs text-muted hover:border-faint hover:text-foreground transition">
                Thi lại
              </button>
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
                <div className="flex flex-col gap-3">
                  {wrongQuestions.map((q, idx) => {
                    const open = wrongAccordion[q.id]
                    const timing = (result.timePerQuestion ?? result.questionTimings)?.[q.id]
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
                                <MathText className="font-sans text-[0.8125rem] text-highlight leading-relaxed">{q.question}</MathText>
                                <div className="flex flex-col gap-2">
                                  {q.choices.map((c, i) => {
                                    const chosen = answers[q.id] ?? null
                                    const isCorrect = i === q.correct
                                    const isChosen = i === chosen
                                    const bg = isCorrect ? 'rgba(16, 185, 129, 0.08)' : isChosen ? 'rgba(251, 113, 133, 0.08)' : 'var(--surface-elevated)'
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

                {/* Oracle CTA */}
                {weakTopics.length > 0 && (
                  <div className="flex flex-col gap-3 px-5 py-4 rounded-xl glass-base">
                    <p className="font-sans text-[0.8125rem] text-muted">
                      Bạn sai <strong className="text-foreground">{wrongCount} câu</strong>
                      {weakTopics.length > 0 && <> về <strong className="text-foreground">{weakTopics.map(t => getTopicLabel(t)).join(', ')}</strong></>}
                      {' '}— hỏi <strong className="text-info">Toán Oracle</strong> về chủ đề này?
                    </p>
                    <button
                      onClick={() => navigate('/oracle', { state: {
                        weakTopics,
                        wrongQuestions: wrongQuestions.slice(0, 3).map(q => ({ topic: q.topic, question: q.question })),
                      }})}
                      className="self-start flex items-center gap-2 px-4 py-2 rounded-lg font-sans text-xs font-bold text-info border border-info/30 hover:bg-info/10 transition"
                    >
                      <span>✦</span>Hỏi Toán Oracle
                    </button>
                  </div>
                )}

                <button onClick={() => navigate('/review')}
                  className="w-full py-3 rounded-xl font-sans text-[0.8125rem] font-semibold border border-primary/25 text-primary hover:border-primary transition">
                  Ôn tập theo lịch (Spaced Repetition)
                </button>
              </>
            )}
          </motion.div>
        )}

        {/* ── Tab: Trường phù hợp ── */}
        {activeTab === 'schools' && (() => {
          const userGrade = user?.grade ? parseInt(user.grade, 10) : null
          const isCollegeUser = userGrade !== null && userGrade >= 10
          return (
          <motion.div key="schools" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col gap-4">

            {/* Grade 10-12: show AI university recommendations as primary content */}
            {isCollegeUser ? (
              <div className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[16px] font-semibold text-foreground">Gợi ý đại học / cao đẳng</span>
                  <span className="font-sans text-[0.6875rem] text-faint">Điểm Toán: <span className="text-primary font-bold">{score.toFixed(1)}/10</span></span>
                </div>
                {aiLoading && !analysis?.school_insight && (
                  <p className="font-sans text-[0.8125rem] text-faint">Đang phân tích...</p>
                )}
                {analysis?.school_insight ? (
                  <>
                    <p className="font-sans text-[0.8125rem] text-muted leading-relaxed" style={{ overflowWrap: 'break-word', hyphens: 'none' }}>
                      {analysis.school_insight}
                    </p>
                    <SchoolList schools={analysis.schools?.length ? analysis.schools : parseSchoolsFromText(analysis.school_insight)} studentScore={score} />
                  </>
                ) : !aiLoading && (
                  <div className="flex flex-col gap-3">
                    {!user?.grade ? (
                      <>
                        <p className="font-sans text-[0.8125rem] text-dim">Hãy cập nhật lớp học trong hồ sơ để nhận gợi ý trường phù hợp.</p>
                        <button onClick={() => navigate('/account')}
                          className="self-start px-4 py-1.5 rounded-lg font-sans text-xs font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition">
                          Cập nhật hồ sơ →
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="font-sans text-[0.8125rem] text-dim">Gợi ý trường chưa được tạo trong lần phân tích này.</p>
                        <button onClick={() => { localStorage.removeItem(`ai-analysis-${user.id}-${result.id}`); setAnalysis(null); setAiError(false); setAiLoading(false); setRetryKey(k => k + 1) }}
                          className="self-start px-4 py-1.5 rounded-lg font-sans text-xs font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition">
                          Thử phân tích lại →
                        </button>
                      </>
                    )}
                  </div>
                )}
                <p className="font-sans text-[0.6875rem] text-faint">
                  Gợi ý từ AI dựa trên điểm Toán và hồ sơ của bạn. Không phải kết quả tuyển sinh chính thức.
                </p>
              </div>
            ) : (
              /* Grade ≤9 or unknown: show THPT probability bars */
              <div className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[16px] font-semibold text-foreground">Khả năng đỗ THPT</span>
                  <span className="font-sans text-[0.6875rem] text-faint">Điểm Toán: <span className="text-primary font-bold">{score.toFixed(1)}/10</span></span>
                </div>
                <p className="font-sans text-xs text-faint">Dựa trên điểm chuẩn môn Toán các năm gần nhất.</p>
                <div className="flex flex-col gap-4">
                  {schoolFitList.map(school => {
                    const prob = school.prob
                    const barColor = prob >= 70 ? '#10B981' : prob >= 40 ? '#F59E0B' : '#FB7185'
                    return (
                      <div key={school.id} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-sans text-[0.8125rem] font-semibold text-highlight">{school.name}</span>
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
            )}

            {/* AI school insight — only shown for grade ≤9 as supplementary */}
            {!isCollegeUser && analysis?.school_insight && (
              <div className="bg-surface border border-border rounded-2xl p-7 flex flex-col gap-4">
                <span className="font-sans text-xs font-bold text-[var(--accent)]/70 uppercase tracking-wider">Gợi ý từ AI</span>
                <p className="font-sans text-[0.8125rem] text-muted leading-relaxed" style={{ overflowWrap: 'break-word', hyphens: 'none' }}>
                  {analysis.school_insight}
                </p>
                <SchoolList schools={analysis.schools?.length ? analysis.schools : parseSchoolsFromText(analysis.school_insight)} studentScore={score} />
              </div>
            )}
          </motion.div>
          )
        })()}

        {/* ── Tab: Kế hoạch ── */}
        {activeTab === 'plan' && (
          <motion.div key="plan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
            <div className="glass-brand rounded-2xl p-7 flex flex-col gap-4">
              <span className="text-[16px] font-semibold text-primary">Kế hoạch học tập 4 tuần</span>
              <p className="font-sans text-[0.8125rem] text-dim leading-relaxed">
                AI sẽ tạo lịch ôn tập cá nhân hóa dựa trên điểm yếu và lịch sử làm bài của bạn.
              </p>
              {studyPlanError && (
                <p className="font-sans text-[0.8125rem] text-destructive px-1">{studyPlanError}</p>
              )}
              {planReady ? (
                <button
                  onClick={() => navigate(`/study-plan/${resultId}`, { state: { result, history: results.filter(r => r.id !== resultId) } })}
                  className="btn-primary w-full text-sm font-bold"
                >
                  Xem kế hoạch học tập ⚡5
                </button>
              ) : (
                <button
                  onClick={() => {
                    if ((user?.credits_balance ?? 0) < 5) {
                      setStudyPlanError('Không đủ credits. Cần ít nhất 5 Tia để tạo kế hoạch.')
                    }
                  }}
                  className="w-full py-3.5 rounded-xl font-sans text-sm font-bold flex items-center justify-center gap-2 text-faint border border-border transition"
                >
                  {!studyPlanError && <span className="w-3.5 h-3.5 rounded-full border border-border border-t-primary animate-spin" />}
                  {studyPlanError ? 'Không đủ credits' : 'Đang chuẩn bị…'}
                </button>
              )}
            </div>
            <button onClick={() => { dispatch({ type: 'RESET' }); viewNavigate(navigate, '/exams') }}
              className="w-full py-3 rounded-xl font-sans text-[0.8125rem] font-medium text-faint hover:text-muted transition">
              Thi lại
            </button>
          </motion.div>
        )}

        {/* ── Tab: Xu hướng 30 ngày (Student+) ── */}
        {activeTab === 'trends' && (
          <motion.div key="trends" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
            <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-5">
              <span className="font-sans text-[16px] font-semibold text-foreground">Xu hướng 30 ngày</span>
              {!topicTrends || topicTrends.length === 0 ? (
                <p className="font-sans text-[0.8125rem] text-dim">Chưa đủ dữ liệu — hãy làm thêm bài để xem xu hướng.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {topicTrends.map(({ topic, weeks }) => (
                    <div key={topic} className="flex flex-col gap-2">
                      <span className="font-sans text-[0.8125rem] font-semibold text-muted-fg">{getTopicLabel(topic)}</span>
                      <div className="flex items-end gap-2">
                        {weeks.map(({ week, accuracy }) => (
                          <div key={week} className="flex flex-col items-center gap-1 flex-1">
                            <span className="font-sans text-[0.625rem] text-faint">{accuracy}%</span>
                            <div className="w-full rounded-t"
                              style={{
                                height: `${Math.max(4, accuracy * 0.6)}px`,
                                background: accuracy >= 70 ? '#34D399' : accuracy >= 40 ? '#F59E0B' : '#FB7185',
                                minHeight: 4,
                              }} />
                            <span className="font-sans text-[9px] text-faint text-center leading-tight">{week}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

      </div>
    </motion.div>
  )
}

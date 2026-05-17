import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { motion, AnimatePresence } from 'framer-motion'
import CountUp from 'react-countup'
import ReactCanvasConfetti from 'react-canvas-confetti'
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { useExam, useExamDispatch } from '../context/ExamContext.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { scoreExam } from '../engine/scoringEngine.js'
import { analyzeResult } from '../engine/aiEngine.js'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
} from 'recharts'
import { loadExamById, loadQuestionsByIds, buildStudyPlanPayload, buildAnalyzePayload, recommendNextExam } from '../api/index.js'
import { analyzeResult as aiAnalyzeResult, analyzeResultStream, generateStudyPlan } from '../api/aiClient.js'
import AIInsights from '../components/AIInsights.jsx'
import AIErrorBoundary from '../components/AIErrorBoundary.jsx'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { MathText } from '../components/MathText.jsx'
import { TOPIC_LABELS } from '../utils/topicLabels.js'
import { safeSetItem } from '../utils/storageManager.js'
import ResultShareCard from '../components/ResultShareCard.jsx'
import schoolsData from '../data/schools.json'
const DIFF_RANK = { hard: 3, medium: 2, easy: 1 }

// Sigmoid probability: 50% at cutoff, ~88% at +0.5, ~12% at -0.5
function schoolFitProbability(score, cutoff) {
  return Math.round(100 / (1 + Math.exp(-(score - cutoff) * 4)))
}

function latestCutoff(school) {
  const years = Object.keys(school.cutoffs ?? {}).sort().reverse()
  return years.length ? school.cutoffs[years[0]]?.math ?? null : null
}
const CIRC = 2 * Math.PI * 54

function pctColor(acc) {
  if (acc >= 0.7) return '#10B981'
  if (acc >= 0.5) return '#FBBF24'
  return '#FB7185'
}

function arcColor(score) {
  if (score >= 8) return '#10B981'
  if (score >= 5) return '#F2A20C'
  return '#FB7185'
}

function scoreLabel(score) {
  if (score >= 9) return 'Xuất sắc!'
  if (score >= 8) return 'Rất giỏi!'
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
  if (acc >= 0.7) return { text: '✓ Tốt', color: '#10B981', bg: '#0D2A1A', border: '#1A4A2A' }
  if (acc >= 0.5) return { text: '⚠ Cần ôn', color: '#FBBF24', bg: '#1A1A0A', border: '#3A3A1A' }
  return { text: '✗ Yếu', color: '#FB7185', bg: '#2A0F14', border: '#4A1A24' }
}

function addToReviewQueue(examId, answers, questions) {
  try {
    const queue = JSON.parse(localStorage.getItem('review_queue') ?? '{}')
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
    localStorage.setItem('review_queue', JSON.stringify(queue))
  } catch { /* non-critical */ }
}

export default function Results({ onOpenAuth }) {
  usePageTitle('Kết quả thi')
  const navigate = useNavigate()
  const location = useLocation()
  const { resultId } = useParams()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview')
  const session = useExam()
  const dispatch = useExamDispatch()
  const { results, addResult } = useHistory()
  const { user } = useAuth()
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const [result, setResult] = useState(() => location.state?.result ?? null)
  const [allQuestions, setAllQuestions] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(false)
  const [planReady, setPlanReady] = useState(false)
  const [wrongAccordion, setWrongAccordion] = useState({})
  const [nextExam, setNextExam] = useState(null)
  const [showShareCard, setShowShareCard] = useState(false)

  const isCurrent = !resultId || resultId === 'current'
  const fireConfetti = useRef(null)
  const onConfettiInit = useCallback(({ confetti }) => { fireConfetti.current = confetti }, [])

  useEffect(() => {
    if (isCurrent) {
      if (session.status !== 'submitted' || !session.exam) {
        navigate('/exams', { replace: true })
        return
      }
      const scored = scoreExam(session)
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
    if (!result) return
    if (result.score >= 8 && fireConfetti.current) {
      setTimeout(() => {
        fireConfetti.current({
          particleCount: 140, spread: 80, origin: { y: 0.45 },
          colors: ['#F2A20C', '#6366F1', '#10B981', '#F8FAFC'],
        })
      }, 600)
    }
  }, [result?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!result) return
    let cancelled = false
    const allPast = results.filter(r => r.id !== result.id)
    const examObj = loadExamById(result.examId)

    async function run() {
      // Add wrong questions to spaced-repetition queue
      if (examObj) {
        const qs = await loadQuestionsByIds(examObj.questionIds)
        if (!cancelled) addToReviewQueue(result.examId, result.answers, qs)
      }

      const planCacheKey = `study-plan-data-${result.id}`
      const planCached = localStorage.getItem(planCacheKey)
      const prefetchFlag = `_prefetching-${result.id}`
      if (planCached) {
        setPlanReady(true)
      } else if (!window[prefetchFlag]) {
        window[prefetchFlag] = true
        buildStudyPlanPayload(result, allPast).then(payload =>
          generateStudyPlan(payload).then(({ data }) => {
            delete window[prefetchFlag]
            if (data && !cancelled) { localStorage.setItem(planCacheKey, JSON.stringify(data)); setPlanReady(true) }
          })
        )
      }

      const localAnalysis = analyzeResult(result, allPast, [])
      const cacheKey = `ai-analysis-${user?.id || 'guest'}-${result.id}`
      const AI_CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days
      const cachedRaw = localStorage.getItem(cacheKey)
      if (cachedRaw) {
        try {
          const entry = JSON.parse(cachedRaw)
          const userGradeNum = user?.grade ? parseInt(user.grade, 10) : null
          const needsSchoolInsight = userGradeNum !== null && userGradeNum >= 10
          const cacheHasSchoolInsight = !!entry.data?.school_insight
          if (entry.ts && Date.now() - entry.ts < AI_CACHE_TTL && (!needsSchoolInsight || cacheHasSchoolInsight)) {
            if (!cancelled) setAnalysis(entry.data)
            return
          }
        } catch { /* stale or corrupt — re-fetch */ }
      }

      if (!cancelled) {
        setAnalysis(localAnalysis)
        setAiLoading(true)
        setAiError(false)
      }
      const obj = examObj || {}
      const payload = await buildAnalyzePayload(
        result, allPast, [], obj.category || '',
        user ? { location: user.province || '', province: user.province || '', grade: user.grade || '', display_name: user.display_name || '' } : {}
      )
      if (cancelled) return
      analyzeResultStream(payload, (token) => {
        // Show streaming text progressively in the insights field while waiting
        if (!cancelled) setAnalysis(prev => ({
          ...(prev || {}),
          insights: ((prev?.insights && !prev?._streaming_done) ? prev.insights : '') + token,
          _streaming: true,
        }))
      }).then(({ data: rawText, error }) => {
        if (cancelled) return
        setAiLoading(false)
        if (rawText) {
          try {
            // Strip possible code fence from streamed JSON
            let clean = rawText.trim()
            if (clean.startsWith('```')) { const p = clean.split('```'); clean = p[1] || clean; if (clean.startsWith('json')) clean = clean.slice(4) }
            const parsed = JSON.parse(clean.trim())
            const aiAnalysis = { ...parsed, _source: 'ai', _streaming_done: true }
            safeSetItem(cacheKey, JSON.stringify({ data: aiAnalysis, ts: Date.now() }))
            setAnalysis(aiAnalysis)
          } catch {
            setAiError(true)
          }
        } else {
          setAiError(!!error)
          // Fall back to non-streaming endpoint if stream failed
          if (error && !cancelled) {
            aiAnalyzeResult(payload).then(({ data }) => {
              if (cancelled || !data) return
              const aiAnalysis = { ...data, _source: 'ai' }
              safeSetItem(cacheKey, JSON.stringify({ data: aiAnalysis, ts: Date.now() }))
              setAnalysis(aiAnalysis)
              setAiError(false)
            })
          }
        }
      })
    }

    run()
    return () => { cancelled = true }
  }, [result?.id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Personal best check — computed before early returns so hook order stays stable
  const pastSameExam = result ? results.filter(r => r.examId === result.examId && r.id !== result.id) : []
  const isPersonalBest = result != null && pastSameExam.length > 0 && result.score > Math.max(...pastSameExam.map(r => r.score))
  const personalBestScore = pastSameExam.length > 0 ? Math.max(...pastSameExam.map(r => r.score)) : null
  const isScoreDrop = result != null && pastSameExam.length > 0 && !isPersonalBest && result.score < personalBestScore

  // Trigger amber confetti for personal best
  useEffect(() => {
    if (!result || !isPersonalBest || !fireConfetti.current) return
    setTimeout(() => {
      fireConfetti.current({
        particleCount: 80, spread: 60, origin: { y: 0.3 },
        colors: ['#F2A20C', '#FBBF24', '#FDE68A'],
      })
    }, 1200)
  }, [result?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!result) {
    if (!isCurrent && results.length > 0 && !results.find(r => r.id === resultId)) {
      return (
        <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center gap-4">
          <p className="font-jakarta text-lg text-[#94A3B8]">Không tìm thấy kết quả</p>
          <button onClick={() => navigate('/history')} className="font-jakarta text-sm text-[#F2A20C] underline">
            Xem lịch sử
          </button>
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center font-jakarta text-[#475569]">
        Đang tải...
      </div>
    )
  }

  const { score, accuracy, timeSpent, topicBreakdown, examId, answers = {} } = result
  const topics = Object.entries(topicBreakdown ?? {})
  const examObj = loadExamById(examId)

  // Load questions async into state (first load fetches chunk, subsequent renders use cache)
  useEffect(() => {
    if (!examObj) return
    loadQuestionsByIds(examObj.questionIds).then(qs => setAllQuestions(qs))
  }, [examId]) // eslint-disable-line react-hooks/exhaustive-deps

  const wrongQuestions = allQuestions
    .filter(q => { const c = answers[q.id] ?? null; return c !== null && c !== q.correct })
    .sort((a, b) => (DIFF_RANK[b.difficulty] || 0) - (DIFF_RANK[a.difficulty] || 0))

  const wrongCount = wrongQuestions.length

  const weakTopics = Object.entries(topicBreakdown ?? {})
    .filter(([, tb]) => tb.accuracy < 0.6)
    .map(([t]) => t)

  // RadarChart data
  const radarData = topics.map(([t, tb]) => ({
    topic: TOPIC_LABELS[t] ?? t,
    score: Math.round(tb.accuracy * 100),
    fullMark: 100,
  }))

  const color = arcColor(score)

  // School fit scores — computed from cutoff data in schools.json
  const schoolFitList = useMemo(() => {
    return schoolsData
      .map(s => {
        const cutoff = latestCutoff(s)
        if (cutoff === null) return null
        const prob = schoolFitProbability(score, cutoff)
        return { ...s, prob, cutoff }
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Sort by closest to 50% probability (most interesting range near the cutoff)
        const da = Math.abs(a.prob - 50)
        const db = Math.abs(b.prob - 50)
        return da - db
      })
      .slice(0, 6)
  }, [score])

  const TABS = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'wrong', label: wrongCount > 0 ? `Câu sai (${wrongCount})` : 'Câu sai' },
    { id: 'schools', label: 'Trường phù hợp' },
    { id: 'plan', label: 'Kế hoạch' },
  ]

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col relative overflow-hidden">
      {showShareCard && (
        <ResultShareCard
          result={result}
          examTitle={examObj?.title}
          personalBest={isPersonalBest}
          onClose={() => setShowShareCard(false)}
        />
      )}
      <ReactCanvasConfetti
        onInit={onConfettiInit}
        style={{ position: 'fixed', pointerEvents: 'none', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100 }}
      />
      <div className="absolute pointer-events-none rounded-full"
        style={{ width: 700, height: 700, right: -200, top: -100,
          background: 'radial-gradient(circle, #F2A20C10 0%, #F2A20C00 100%)' }} />

      {/* NavBar */}
      <nav className="relative z-10 flex items-center justify-between px-8 bg-[#0D1221] border-b border-[#1E2A44]" style={{ height: 64 }}>
        <button onClick={() => navigate('/')}
          className="flex items-center gap-1.5 font-jakarta text-[13px] text-[#94A3B8] hover:text-[#F8FAFC] transition">
          ← Trang chủ
        </button>
        <span className="font-jakarta text-[14px] font-semibold text-[#F8FAFC]">Kết quả thi</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowShareCard(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#111827] border border-[#1E2A44] rounded-lg font-jakarta text-[12px] text-[#94A3B8] hover:text-[#F8FAFC] transition"
            title="Chia sẻ kết quả">
            📤
          </button>
          <button onClick={() => navigate('/history')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#111827] border border-[#1E2A44] rounded-lg font-jakarta text-[12px] text-[#94A3B8] hover:text-[#F8FAFC] transition">
            Lịch sử
          </button>
        </div>
      </nav>

      <div className="relative z-10 flex flex-col gap-5 max-w-3xl mx-auto w-full px-4 py-8">

        {/* ── Score hero ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="flex items-center gap-8 bg-[#0D1221] border border-[#1E2A44] rounded-2xl px-8 py-8"
        >
          <div className="flex-shrink-0">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" stroke="#1E2A44" strokeWidth="6" fill="none" />
              <motion.circle
                cx="60" cy="60" r="54" stroke={color} strokeWidth="6" fill="none"
                strokeLinecap="round" strokeDasharray={CIRC}
                initial={{ strokeDashoffset: CIRC }}
                animate={{ strokeDashoffset: CIRC * (1 - score / 10) }}
                transition={{ duration: 1.5, ease: 'easeOut', delay: 0.2 }}
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="66" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="26" fontWeight="700" fill={color}>
                {score.toFixed(1)}
              </text>
            </svg>
          </div>
          <div className="flex flex-col gap-3 flex-1">
            <span className="font-fraunces text-[26px] font-bold text-[#F8FAFC] leading-tight">{scoreLabel(score)}</span>
            <span className="font-jakarta text-[13px] text-[#475569]">{examObj?.title ?? examId}</span>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex flex-col gap-0.5">
                <span className="font-jakarta text-[11px] text-[#475569]">Độ chính xác</span>
                <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">{Math.round(accuracy * 100)}%</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-jakarta text-[11px] text-[#475569]">Thời gian</span>
                <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">{formatTime(timeSpent)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-jakarta text-[11px] text-[#475569]">Đã trả lời</span>
                <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">{result.answeredCount}/{allQuestions.length || result.answeredCount}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Personal best */}
        <AnimatePresence>
          {isPersonalBest && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 px-5 py-3.5 rounded-xl"
              style={{ background: '#1A1200', border: '1px solid #F2A20C60' }}>
              <span className="text-xl">🏆</span>
              <span className="font-jakarta text-[14px] font-semibold text-[#F2A20C]">Điểm cao nhất của bạn trên đề thi này!</span>
            </motion.div>
          )}
          {isScoreDrop && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 px-5 py-3.5 rounded-xl"
              style={{ background: '#1A0D00', border: '1px solid #F2A20C44' }}>
              <span className="text-xl">💪</span>
              <span className="font-jakarta text-[13px] text-[#94A3B8]">
                Hôm nay chưa phải ngày tốt nhất của bạn — không sao cả. Kỷ lục của bạn vẫn là{' '}
                <strong className="text-amber-400">{personalBestScore}</strong> điểm. Hãy ôn lại và thử lại!
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sign-in nudge */}
        {!user && !nudgeDismissed && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl"
            style={{ background: '#0D1221', border: '1px solid #F2A20C44' }}>
            <button onClick={onOpenAuth} className="font-jakarta text-[13px] text-amber-400 hover:text-amber-300 transition-colors text-left">
              Đăng nhập để lưu kết quả vào tài khoản →
            </button>
            <button onClick={() => setNudgeDismissed(true)} className="text-gray-500 hover:text-gray-300 text-lg leading-none flex-shrink-0">×</button>
          </div>
        )}

        {/* ── Tab bar ── */}
        <div className="flex border-b border-[#1E2A44]">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative px-4 py-2.5 font-jakarta text-[13px] font-medium transition-colors"
              style={{ color: activeTab === tab.id ? '#F2A20C' : '#64748B' }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F2A20C]" />
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Tổng quan ── */}
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
            {/* Hồ sơ năng lực */}
            <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-6">
              <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Hồ sơ năng lực</span>
              {radarData.length > 0 && (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="#1E2A44" />
                      <PolarAngleAxis dataKey="topic" tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'Plus Jakarta Sans, sans-serif' }} />
                      <Radar dataKey="score" stroke="#F2A20C" fill="#F2A20C" fillOpacity={0.15} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {topics.map(([topic, tb]) => {
                  const verdict = topicVerdict(tb.accuracy)
                  return (
                    <div key={topic} className="flex flex-col gap-2 px-4 py-3 rounded-xl"
                      style={{ background: verdict.bg, border: `1px solid ${verdict.border}` }}>
                      <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">{TOPIC_LABELS[topic] ?? topic}</span>
                      <span className="font-jakarta text-[12px] text-[#64748B]">{tb.correct}/{tb.total} · {Math.round(tb.accuracy * 100)}%</span>
                      <span className="font-jakarta text-[11px] font-bold" style={{ color: verdict.color }}>{verdict.text}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* AI Insights */}
            <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Phân tích AI</span>
                <span className="font-jakarta text-[11px] text-amber-400/70">⚡3 Tia</span>
              </div>
              <AIErrorBoundary>
                <AIInsights analysis={aiLoading ? null : analysis} loading={aiLoading} error={aiError} score={score} />
              </AIErrorBoundary>
            </div>

            {/* Next exam recommendation */}
            {nextExam && (
              <div className="bg-[#0D1521] border border-[#1E2A44] rounded-xl px-5 py-4 flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-jakarta text-[11px] text-[#64748B]">Đề tiếp theo cho bạn</span>
                  <span className="font-jakarta text-[14px] font-semibold text-[#F8FAFC] truncate">{nextExam.title}</span>
                </div>
                <button
                  onClick={() => navigate(`/test/${nextExam.id}`)}
                  className="flex-shrink-0 px-4 py-2 rounded-lg font-jakarta text-[12px] font-bold"
                  style={{ background: '#F2A20C', color: '#0A0E1A' }}
                >
                  Bắt đầu →
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {wrongCount > 0 && (
                <button onClick={() => setActiveTab('wrong')}
                  className="w-full py-3.5 rounded-xl font-jakarta text-[14px] font-bold text-[#0A0E1A] hover:opacity-90 transition"
                  style={{ background: 'linear-gradient(180deg, #F2A20C 0%, #D97706 100%)' }}>
                  Xem {wrongCount} câu sai →
                </button>
              )}
              <button onClick={() => setActiveTab('plan')}
                className={`w-full py-3 rounded-xl font-jakarta text-[13px] font-semibold border transition flex items-center justify-center gap-2 ${
                  planReady ? 'bg-[#0D1221] border-[#F2A20C44] text-[#F2A20C] hover:border-[#F2A20C]' : 'bg-[#0D1221] border-[#1E2A44] text-[#475569]'
                }`}>
                {!planReady && <span className="w-3.5 h-3.5 rounded-full border border-[#2A3A50] border-t-[#F2A20C] animate-spin flex-shrink-0" />}
                {planReady ? 'Kế hoạch học tập ⚡5 →' : 'Đang chuẩn bị kế hoạch…'}
              </button>
              <button onClick={() => { dispatch({ type: 'RESET' }); navigate('/exams') }}
                className="w-full py-3 rounded-xl font-jakarta text-[13px] font-medium text-[#475569] hover:text-[#94A3B8] transition">
                Thi lại
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Tab: Câu sai ── */}
        {activeTab === 'wrong' && (
          <motion.div key="wrong" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
            {wrongQuestions.length === 0 ? (
              <div className="py-16 text-center font-jakarta text-[#475569]">Không có câu sai — xuất sắc!</div>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  {wrongQuestions.map((q, idx) => {
                    const open = wrongAccordion[q.id]
                    const timing = (result.timePerQuestion ?? result.questionTimings)?.[q.id]
                    return (
                      <div key={q.id} className="rounded-xl border border-[#1E2A44] overflow-hidden">
                        <button
                          onClick={() => setWrongAccordion(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                          className="w-full flex items-center justify-between px-5 py-3.5 bg-[#111827] hover:bg-[#1A2440] transition text-left"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-[#FB718522] border border-[#FB7185] flex items-center justify-center font-jakarta text-[10px] font-bold text-[#FB7185] flex-shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-jakarta text-[13px] text-[#94A3B8] overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              <MathText>{q.question}</MathText>
                            </span>
                            {timing != null && (
                              <span className={`font-jakarta text-[11px] flex-shrink-0 ${timing > 120 ? 'text-amber-400' : 'text-[#475569]'}`}>
                                ⏱ {timing >= 60 ? `${Math.floor(timing/60)}m${timing%60}s` : `${timing}s`}
                              </span>
                            )}
                          </div>
                          <span className="text-[#475569] text-sm ml-2 flex-shrink-0">{open ? '▲' : '▼'}</span>
                        </button>
                        <AnimatePresence>
                          {open && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                              <div className="px-5 py-4 flex flex-col gap-3 border-t border-[#1E2A44]">
                                <MathText className="font-jakarta text-[13px] text-[#F0F4FF] leading-relaxed">{q.question}</MathText>
                                <div className="flex flex-col gap-2">
                                  {q.choices.map((c, i) => {
                                    const chosen = answers[q.id] ?? null
                                    const isCorrect = i === q.correct
                                    const isChosen = i === chosen
                                    const bg = isCorrect ? '#0D2A1A' : isChosen ? '#2A0F14' : '#0A0E1A'
                                    const borderColor = isCorrect ? '#10B981' : isChosen ? '#FB7185' : '#1E2A44'
                                    const labelColor = isCorrect ? '#10B981' : isChosen ? '#FB7185' : '#475569'
                                    const textColor = isCorrect ? '#10B981' : isChosen ? '#FB7185' : '#64748B'
                                    return (
                                    <div key={i} className="flex items-start gap-2.5 px-4 py-2.5 rounded-lg"
                                      style={{ background: bg, border: `1px solid ${borderColor}` }}>
                                      <span className="font-jakarta text-[12px] font-bold flex-shrink-0"
                                        style={{ color: labelColor }}>
                                        {String.fromCharCode(65 + i)}.
                                      </span>
                                      <span className="font-jakarta text-[13px]" style={{ color: textColor }}>
                                        <MathText>{c}</MathText>
                                        {isCorrect && <span className="ml-2 text-[11px]">✓ Đáp án đúng</span>}
                                        {isChosen && !isCorrect && <span className="ml-2 text-[11px] text-[#FB7185]">← Bạn đã chọn</span>}
                                      </span>
                                    </div>
                                    )
                                  })}
                                </div>
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
                  <div className="flex flex-col gap-3 px-5 py-4 rounded-xl border border-[#6366F144] bg-[#0D1221]">
                    <p className="font-jakarta text-[13px] text-[#94A3B8]">
                      Bạn sai <strong className="text-[#F8FAFC]">{wrongCount} câu</strong>
                      {weakTopics.length > 0 && <> về <strong className="text-[#F8FAFC]">{weakTopics.map(t => TOPIC_LABELS[t] ?? t).join(', ')}</strong></>}
                      {' '}— hỏi <strong className="text-[#6366F1]">Toán Oracle</strong> về chủ đề này?
                    </p>
                    <button
                      onClick={() => navigate('/oracle', { state: {
                        weakTopics,
                        wrongQuestions: wrongQuestions.slice(0, 3).map(q => ({ topic: q.topic, question: q.question })),
                      }})}
                      className="self-start flex items-center gap-2 px-4 py-2 rounded-lg font-jakarta text-[12px] font-bold text-[#6366F1] border border-[#6366F144] hover:bg-[#6366F1]/10 transition"
                    >
                      <span>✦</span>Hỏi Toán Oracle
                    </button>
                  </div>
                )}

                <button onClick={() => navigate('/review')}
                  className="w-full py-3 rounded-xl font-jakarta text-[13px] font-semibold border border-[#F2A20C44] text-[#F2A20C] hover:border-[#F2A20C] transition">
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
              <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Gợi ý đại học / cao đẳng</span>
                  <span className="font-jakarta text-[11px] text-[#475569]">Điểm Toán: <span className="text-[#F2A20C] font-bold">{score.toFixed(1)}/10</span></span>
                </div>
                {aiLoading && !analysis?.school_insight && (
                  <p className="font-jakarta text-[13px] text-[#475569] animate-pulse">AI đang phân tích...</p>
                )}
                {analysis?.school_insight ? (
                  <p className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed whitespace-pre-line">{analysis.school_insight}</p>
                ) : !aiLoading && (
                  <p className="font-jakarta text-[13px] text-[#475569]">
                    {user ? 'Gợi ý trường chưa được tạo. Hãy đảm bảo hồ sơ của bạn có lớp học và thử phân tích lại.' : 'Hãy đăng nhập để nhận gợi ý trường phù hợp.'}
                  </p>
                )}
                <p className="font-jakarta text-[11px] text-[#2A3A50]">
                  Gợi ý từ AI dựa trên điểm Toán và hồ sơ của bạn. Không phải kết quả tuyển sinh chính thức.
                </p>
              </div>
            ) : (
              /* Grade ≤9 or unknown: show THPT probability bars */
              <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Khả năng đỗ THPT</span>
                  <span className="font-jakarta text-[11px] text-[#475569]">Điểm Toán: <span className="text-[#F2A20C] font-bold">{score.toFixed(1)}/10</span></span>
                </div>
                <p className="font-jakarta text-[12px] text-[#475569]">Dựa trên điểm chuẩn môn Toán các năm gần nhất.</p>
                <div className="flex flex-col gap-4">
                  {schoolFitList.map(school => {
                    const prob = school.prob
                    const barColor = prob >= 70 ? '#10B981' : prob >= 40 ? '#F2A20C' : '#FB7185'
                    return (
                      <div key={school.id} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">{school.name}</span>
                            <span className="font-jakarta text-[11px] text-[#475569]">{school.district} · Chuẩn Toán: {school.cutoff}</span>
                          </div>
                          <span className="font-fraunces text-[20px] font-bold flex-shrink-0 ml-4" style={{ color: barColor }}>
                            {prob}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[#111827] overflow-hidden">
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
                <p className="font-jakarta text-[11px] text-[#2A3A50]">
                  Xác suất ước tính theo hàm sigmoid so với điểm chuẩn năm gần nhất. Không phải kết quả chính thức.
                </p>
              </div>
            )}

            {/* AI school insight — only shown for grade ≤9 as supplementary */}
            {!isCollegeUser && analysis?.school_insight && (
              <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-3">
                <span className="font-jakarta text-[12px] font-bold text-amber-400/70 uppercase tracking-wider">Gợi ý từ AI</span>
                <p className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed whitespace-pre-line">{analysis.school_insight}</p>
              </div>
            )}
          </motion.div>
          )
        })()}

        {/* ── Tab: Kế hoạch ── */}
        {activeTab === 'plan' && (
          <motion.div key="plan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
            <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
              <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Kế hoạch học tập 4 tuần</span>
              <p className="font-jakarta text-[13px] text-[#64748B] leading-relaxed">
                AI sẽ tạo lịch ôn tập cá nhân hóa dựa trên điểm yếu và lịch sử làm bài của bạn.
              </p>
              <button
                onClick={() => navigate(`/study-plan/${resultId}`, { state: { result, history: results.filter(r => r.id !== resultId) } })}
                className={`w-full py-3.5 rounded-xl font-jakarta text-[14px] font-bold transition flex items-center justify-center gap-2 ${
                  planReady ? 'text-[#0A0E1A] hover:opacity-90' : 'text-[#475569] border border-[#1E2A44]'
                }`}
                style={planReady ? { background: 'linear-gradient(180deg, #F2A20C 0%, #D97706 100%)' } : {}}
              >
                {!planReady && <span className="w-3.5 h-3.5 rounded-full border border-[#2A3A50] border-t-[#F2A20C] animate-spin" />}
                {planReady ? 'Xem kế hoạch học tập ⚡5' : 'Đang chuẩn bị…'}
              </button>
            </div>
            <button onClick={() => { dispatch({ type: 'RESET' }); navigate('/exams') }}
              className="w-full py-3 rounded-xl font-jakarta text-[13px] font-medium text-[#475569] hover:text-[#94A3B8] transition">
              Thi lại
            </button>
          </motion.div>
        )}

      </div>
    </div>
  )
}

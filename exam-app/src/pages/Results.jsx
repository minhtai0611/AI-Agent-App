import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { motion, AnimatePresence } from 'framer-motion'
import CountUp from 'react-countup'
import ReactCanvasConfetti from 'react-canvas-confetti'
import { useNavigate, useParams } from 'react-router-dom'
import { useExam, useExamDispatch } from '../context/ExamContext.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { scoreExam } from '../engine/scoringEngine.js'
import { analyzeResult } from '../engine/aiEngine.js'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
} from 'recharts'
import { loadSchools, loadExamById, loadQuestionsByIds, buildStudyPlanPayload, buildAnalyzePayload } from '../api/index.js'
import { analyzeResult as aiAnalyzeResult, generateStudyPlan } from '../api/aiClient.js'
import AIInsights from '../components/AIInsights.jsx'
import AIErrorBoundary from '../components/AIErrorBoundary.jsx'
import { usePageTitle } from '../hooks/usePageTitle.js'

const TOPIC_LABELS = { algebra: 'Đại số', geometry: 'Hình học', statistics: 'Thống kê', combinatorics: 'Tổ hợp' }
const DIFF_RANK = { hard: 3, medium: 2, easy: 1 }
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
  const { resultId } = useParams()
  const session = useExam()
  const dispatch = useExamDispatch()
  const { results, addResult } = useHistory()
  const { user } = useAuth()
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const [result, setResult] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(false)
  const [planReady, setPlanReady] = useState(false)
  const [wrongAccordion, setWrongAccordion] = useState({})

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
        navigate(`/results/${id}`, { replace: true })
      })
    } else {
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
    const allPast = results.filter(r => r.id !== result.id)

    // Add wrong questions to spaced-repetition queue
    const examObj = loadExamById(result.examId)
    if (examObj) {
      const qs = loadQuestionsByIds(examObj.questionIds)
      addToReviewQueue(result.examId, result.answers, qs)
    }

    const planCacheKey = `study-plan-data-${result.id}`
    const planCached = localStorage.getItem(planCacheKey)
    const prefetchFlag = `_prefetching-${result.id}`
    if (planCached) {
      setPlanReady(true)
    } else if (!window[prefetchFlag]) {
      window[prefetchFlag] = true
      generateStudyPlan(buildStudyPlanPayload(result, allPast)).then(({ data }) => {
        delete window[prefetchFlag]
        if (data) { localStorage.setItem(planCacheKey, JSON.stringify(data)); setPlanReady(true) }
      })
    }

    const schools = loadSchools()
    const localAnalysis = analyzeResult(result, allPast, schools)
    const cacheKey = `ai-analysis-${result.id}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) { setAnalysis(JSON.parse(cached)); return }

    setAnalysis(localAnalysis)
    setAiLoading(true)
    setAiError(false)
    const obj = examObj || {}
    const payload = buildAnalyzePayload(
      result, allPast, localAnalysis.recommendations, obj.category || '',
      user ? { location: user.province || '', province: user.province || '', grade: user.grade || '', display_name: user.display_name || '' } : {}
    )
    aiAnalyzeResult(payload).then(({ data, error }) => {
      setAiLoading(false)
      if (data) {
        const aiAnalysis = { ...data, _source: 'ai', schoolRecs: localAnalysis.recommendations }
        localStorage.setItem(cacheKey, JSON.stringify(aiAnalysis))
        setAnalysis(aiAnalysis)
      } else {
        setAiError(true)
      }
    })
  }, [result]) // eslint-disable-line react-hooks/exhaustive-deps

  // Personal best check — computed before early returns so hook order stays stable
  const pastSameExam = result ? results.filter(r => r.examId === result.examId && r.id !== result.id) : []
  const isPersonalBest = result != null && pastSameExam.length > 0 && result.score > Math.max(...pastSameExam.map(r => r.score))

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
  const allQuestions = examObj ? loadQuestionsByIds(examObj.questionIds) : []

  // Wrong questions sorted by difficulty for "Top 3 câu sai"
  const wrongQuestions = allQuestions
    .filter(q => { const c = answers[q.id] ?? null; return c === null || c !== q.correct })
    .sort((a, b) => (DIFF_RANK[b.difficulty] || 0) - (DIFF_RANK[a.difficulty] || 0))
    .slice(0, 3)

  const wrongCount = allQuestions.filter(q => { const c = answers[q.id] ?? null; return c === null || c !== q.correct }).length

  // RadarChart data
  const radarData = topics.map(([t, tb]) => ({
    topic: TOPIC_LABELS[t] ?? t,
    score: Math.round(tb.accuracy * 100),
    fullMark: 100,
  }))

  const color = arcColor(score)

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col relative overflow-hidden">
      <ReactCanvasConfetti
        onInit={onConfettiInit}
        style={{ position: 'fixed', pointerEvents: 'none', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100 }}
      />
      <div className="absolute pointer-events-none rounded-full"
        style={{ width: 700, height: 700, right: -200, top: -100,
          background: 'radial-gradient(circle, #F2A20C10 0%, #F2A20C00 100%)' }} />
      <div className="absolute pointer-events-none rounded-full"
        style={{ width: 600, height: 600, left: -200, bottom: -100,
          background: 'radial-gradient(circle, #10B98110 0%, #10B98100 100%)' }} />

      {/* NavBar */}
      <nav className="relative z-10 flex items-center justify-between px-8 bg-[#0D1221] border-b border-[#1E2A44]" style={{ height: 64 }}>
        <button onClick={() => navigate('/')}
          className="flex items-center gap-1.5 font-jakarta text-[13px] text-[#94A3B8] hover:text-[#F8FAFC] transition">
          ← Trang chủ
        </button>
        <span className="font-jakarta text-[14px] font-semibold text-[#F8FAFC]">Kết quả thi</span>
        <button onClick={() => navigate('/history')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#111827] border border-[#1E2A44] rounded-lg font-jakarta text-[12px] text-[#94A3B8] hover:text-[#F8FAFC] transition">
          Lịch sử
        </button>
      </nav>

      <div className="relative z-10 flex flex-col gap-6 max-w-3xl mx-auto w-full px-4 py-10">

        {/* ── 1. Score hero — animated SVG arc ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-8 bg-[#0D1221] border border-[#1E2A44] rounded-2xl px-8 py-8"
        >
          <div className="flex-shrink-0">
            <svg width="120" height="120" viewBox="0 0 120 120">
              {/* Background ring */}
              <circle cx="60" cy="60" r="54" stroke="#1E2A44" strokeWidth="6" fill="none" />
              {/* Foreground arc */}
              <motion.circle
                cx="60" cy="60" r="54"
                stroke={color} strokeWidth="6" fill="none"
                strokeLinecap="round"
                strokeDasharray={CIRC}
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

        {/* ── 2. Personal best banner ── */}
        <AnimatePresence>
          {isPersonalBest && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 px-5 py-3.5 rounded-xl"
              style={{ background: '#1A1200', border: '1px solid #F2A20C60' }}
            >
              <span className="text-xl">🏆</span>
              <span className="font-jakarta text-[14px] font-semibold text-[#F2A20C]">
                Điểm cao nhất của bạn trên đề thi này!
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sign-in nudge */}
        {!user && !nudgeDismissed && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl"
            style={{ background: '#0D1221', border: '1px solid #F2A20C44' }}>
            <button onClick={onOpenAuth}
              className="font-jakarta text-[13px] text-amber-400 hover:text-amber-300 transition-colors text-left">
              Đăng nhập để lưu kết quả vào tài khoản →
            </button>
            <button onClick={() => setNudgeDismissed(true)} className="text-gray-500 hover:text-gray-300 text-lg leading-none flex-shrink-0">×</button>
          </div>
        )}

        {/* ── 3. Hồ sơ năng lực — RadarChart + 2×2 chips ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-6"
        >
          <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Hồ sơ năng lực</span>

          {/* Radar chart */}
          {radarData.length > 0 && (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#1E2A44" />
                  <PolarAngleAxis dataKey="topic" tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'Plus Jakarta Sans, sans-serif' }} />
                  <Radar
                    dataKey="score"
                    stroke="#F2A20C"
                    fill="#F2A20C"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 2×2 topic chip grid */}
          <div className="grid grid-cols-2 gap-3">
            {topics.map(([topic, tb]) => {
              const verdict = topicVerdict(tb.accuracy)
              return (
                <div key={topic} className="flex flex-col gap-2 px-4 py-3 rounded-xl"
                  style={{ background: verdict.bg, border: `1px solid ${verdict.border}` }}>
                  <span className="font-jakarta text-[13px] font-semibold text-[#F0F4FF]">
                    {TOPIC_LABELS[topic] ?? topic}
                  </span>
                  <span className="font-jakarta text-[12px] text-[#64748B]">
                    {tb.correct}/{tb.total} · {Math.round(tb.accuracy * 100)}%
                  </span>
                  <span className="font-jakarta text-[11px] font-bold" style={{ color: verdict.color }}>
                    {verdict.text}
                  </span>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* ── 4. Top 3 câu sai ── */}
        {wrongQuestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4"
          >
            <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Top {wrongQuestions.length} câu sai</span>
            <div className="flex flex-col gap-3">
              {wrongQuestions.map((q, idx) => {
                const open = wrongAccordion[q.id]
                return (
                  <div key={q.id} className="rounded-xl border border-[#1E2A44] overflow-hidden">
                    <button
                      onClick={() => setWrongAccordion(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                      className="w-full flex items-center justify-between px-5 py-3.5 bg-[#111827] hover:bg-[#1A2440] transition text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#FB718522] border border-[#FB7185] flex items-center justify-center font-jakarta text-[10px] font-bold text-[#FB7185] flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-jakarta text-[13px] text-[#94A3B8] line-clamp-1">
                          {q.question.slice(0, 70)}{q.question.length > 70 ? '…' : ''}
                        </span>
                      </div>
                      <span className="text-[#475569] text-sm ml-2 flex-shrink-0">{open ? '▲' : '▼'}</span>
                    </button>
                    <AnimatePresence>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 py-4 flex flex-col gap-3 border-t border-[#1E2A44]">
                            <p className="font-jakarta text-[13px] text-[#F0F4FF] leading-relaxed">{q.question}</p>
                            <div className="flex flex-col gap-2">
                              {q.choices.map((c, i) => (
                                <div key={i} className="flex items-start gap-2.5 px-4 py-2.5 rounded-lg"
                                  style={{
                                    background: i === q.correct ? '#0D2A1A' : '#0A0E1A',
                                    border: `1px solid ${i === q.correct ? '#10B981' : '#1E2A44'}`,
                                  }}>
                                  <span className="font-jakarta text-[12px] font-bold flex-shrink-0"
                                    style={{ color: i === q.correct ? '#10B981' : '#475569' }}>
                                    {String.fromCharCode(65 + i)}.
                                  </span>
                                  <span className="font-jakarta text-[13px]"
                                    style={{ color: i === q.correct ? '#10B981' : '#64748B' }}>
                                    {c}
                                    {i === q.correct && <span className="ml-2 text-[11px]">✓ Đáp án đúng</span>}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ── 5. Nhận xét & Gợi ý ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-5"
        >
          <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Nhận xét &amp; Gợi ý</span>
          <AIErrorBoundary>
            <AIInsights analysis={aiLoading ? null : analysis} loading={aiLoading} error={aiError} score={score} />
          </AIErrorBoundary>
        </motion.div>

        {/* ── 6. Action buttons ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="flex flex-col gap-3"
        >
          {/* Primary: review wrong questions */}
          {wrongCount > 0 && (
            <button
              onClick={() => navigate('/review')}
              className="w-full py-3.5 rounded-xl font-jakarta text-[14px] font-bold text-[#0A0E1A] hover:opacity-90 transition"
              style={{ background: 'linear-gradient(180deg, #F2A20C 0%, #D97706 100%)' }}
            >
              Ôn lại {wrongCount} câu sai
            </button>
          )}
          {/* Secondary: study plan */}
          <button
            onClick={() => navigate(`/study-plan/${resultId}`, { state: { result, history: results.filter(r => r.id !== resultId) } })}
            className={`w-full py-3 rounded-xl font-jakarta text-[13px] font-semibold border transition flex items-center justify-center gap-2 ${
              planReady
                ? 'bg-[#0D1221] border-[#F2A20C44] text-[#F2A20C] hover:border-[#F2A20C]'
                : 'bg-[#0D1221] border-[#1E2A44] text-[#475569]'
            }`}
          >
            {!planReady && <span className="w-3.5 h-3.5 rounded-full border border-[#2A3A50] border-t-[#F2A20C] animate-spin flex-shrink-0" />}
            {planReady ? 'Kế hoạch học tập →' : 'Đang chuẩn bị kế hoạch…'}
          </button>
          {/* Tertiary: retake */}
          <button
            onClick={() => { dispatch({ type: 'RESET' }); navigate('/exams') }}
            className="w-full py-3 rounded-xl font-jakarta text-[13px] font-medium text-[#475569] hover:text-[#94A3B8] transition"
          >
            Thi lại
          </button>
        </motion.div>

      </div>
    </div>
  )
}

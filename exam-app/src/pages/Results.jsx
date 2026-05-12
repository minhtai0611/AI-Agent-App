import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { motion } from 'framer-motion'
import CountUp from 'react-countup'
import ReactCanvasConfetti from 'react-canvas-confetti'
import { useNavigate, useParams } from 'react-router-dom'
import { useExam, useExamDispatch } from '../context/ExamContext.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { scoreExam } from '../engine/scoringEngine.js'
import { analyzeResult } from '../engine/aiEngine.js'
import { loadSchools, buildStudyPlanPayload } from '../api/index.js'
import { analyzeResult as aiAnalyzeResult, generateStudyPlan } from '../api/aiClient.js'
import TopicBreakdownChart from '../components/TopicBreakdownChart.jsx'
import AIInsights from '../components/AIInsights.jsx'
import AIErrorBoundary from '../components/AIErrorBoundary.jsx'
import SchoolList from '../components/SchoolList.jsx'

const TOPIC_LABELS = { algebra: 'Đại số', geometry: 'Hình học', statistics: 'Thống kê', combinatorics: 'Tổ hợp' }
const TOPIC_COLORS = { algebra: '#10B981', geometry: '#FBBF24', statistics: '#FB7185', combinatorics: '#10B981' }

function pctColor(acc) {
  if (acc >= 0.7) return '#10B981'
  if (acc >= 0.5) return '#FBBF24'
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

export default function Results({ onOpenAuth }) {
  const navigate = useNavigate()
  const { resultId } = useParams()
  const session = useExam()
  const dispatch = useExamDispatch()
  const { results, addResult } = useHistory()
  const { user } = useAuth()
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const [result, setResult] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [schoolRecs, setSchoolRecs] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(false)
  const [planReady, setPlanReady] = useState(false)

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
      const id = addResult(scored)
      setResult(scored)
      navigate(`/results/${id}`, { replace: true })
    } else {
      const found = results.find(r => r.id === resultId)
      if (found) setResult(found)
    }
  }, [resultId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!result) return
    if (result.score >= 8 && fireConfetti.current) {
      setTimeout(() => {
        fireConfetti.current({
          particleCount: 140,
          spread: 80,
          origin: { y: 0.45 },
          colors: ['#F2A20C', '#6366F1', '#10B981', '#F8FAFC'],
        })
      }, 600)
    }
  }, [result?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!result) return
    const allPast = results.filter(r => r.id !== result.id)
    const planCacheKey = `study-plan-data-${result.id}`

    // Prefetch study plan in background if not already cached.
    // Guard flag prevents double-fetch in React StrictMode dev (effects fire twice).
    const planCached = localStorage.getItem(planCacheKey)
    const prefetchFlag = `_prefetching-${result.id}`
    if (planCached) {
      setPlanReady(true)
    } else if (!window[prefetchFlag]) {
      window[prefetchFlag] = true
      generateStudyPlan(buildStudyPlanPayload(result, allPast)).then(({ data }) => {
        delete window[prefetchFlag]
        if (data) {
          localStorage.setItem(planCacheKey, JSON.stringify(data))
          setPlanReady(true)
        }
      })
    }

    // School recommendations — always computed locally, independent of AI
    const schools = loadSchools()
    const localAnalysis = analyzeResult(result, allPast, schools)
    setSchoolRecs(localAnalysis.recommendations)

    // Return cached AI analysis immediately if available
    const cacheKey = `ai-analysis-${result.id}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      setAnalysis(JSON.parse(cached))
      return
    }

    // Local fallback while AI loads
    setAnalysis(localAnalysis)

    setAiLoading(true)
    setAiError(false)
    aiAnalyzeResult({ result, history: allPast }).then(({ data, error }) => {
      setAiLoading(false)
      if (data) {
        const aiAnalysis = { ...data, _source: 'ai' }
        localStorage.setItem(cacheKey, JSON.stringify(aiAnalysis))
        setAnalysis(aiAnalysis)
      } else {
        setAiError(true)
      }
    })
  }, [result]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!result) {
    if (!isCurrent && results.length > 0 && !results.find(r => r.id === resultId)) {
      return (
        <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center gap-4">
          <p className="font-jakarta text-lg text-[#94A3B8]">Không tìm thấy kết quả</p>
          <button
            onClick={() => navigate('/history')}
            className="font-jakarta text-sm text-[#F2A20C] underline"
          >
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

  const { score, accuracy, timeSpent, topicBreakdown, examId } = result
  const topics = Object.entries(topicBreakdown)
  const weakTopics = analysis?._source === 'ai' ? (analysis.weak_topics || []) : (analysis?.weakTopics || [])

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col relative overflow-hidden">
      <ReactCanvasConfetti
        onInit={onConfettiInit}
        style={{ position: 'fixed', pointerEvents: 'none', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100 }}
      />
      {/* Background glows */}
      <div className="absolute pointer-events-none rounded-full"
        style={{ width: 700, height: 700, right: -200, top: -100,
          background: 'radial-gradient(circle, #F2A20C10 0%, #F2A20C00 100%)' }} />
      <div className="absolute pointer-events-none rounded-full"
        style={{ width: 600, height: 600, left: -200, bottom: -100,
          background: 'radial-gradient(circle, #10B98110 0%, #10B98100 100%)' }} />

      {/* NavBar */}
      <nav className="relative z-10 flex items-center justify-between px-8 bg-[#0D1221] border-b border-[#1E2A44]"
        style={{ height: 64 }}>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 font-jakarta text-[13px] text-[#94A3B8] hover:text-[#F8FAFC] transition"
        >
          ← Trang chủ
        </button>
        <span className="font-jakarta text-[14px] font-semibold text-[#F8FAFC]">Kết quả thi</span>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/history')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#111827] border border-[#1E2A44] rounded-lg font-jakarta text-[12px] text-[#94A3B8] hover:text-[#F8FAFC] transition"
          >
            Lịch sử
          </button>
          <button
            onClick={() => { dispatch({ type: 'RESET' }); navigate('/exams') }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-jakarta text-[12px] font-bold text-[#0A0E1A] hover:opacity-90 transition"
            style={{ background: 'linear-gradient(180deg, #F2A20C 0%, #D97706 100%)' }}
          >
            Thi lại
          </button>
        </div>
      </nav>

      {/* Body */}
      <div className="relative z-10 flex flex-col gap-7 max-w-3xl mx-auto w-full px-4 py-10">

        {/* Score hero */}
        <div className="flex items-center gap-10 bg-[#0D1221] border border-[#1E2A44] rounded-2xl px-10 py-9">
          <div className="flex-shrink-0 w-[120px] h-[120px] rounded-full border-2 border-[#F2A20C] flex items-center justify-center"
            style={{ background: 'radial-gradient(circle, #1E2A44 0%, #0D1221 100%)' }}>
            <span className="font-fraunces text-[38px] font-bold text-[#F2A20C]">
              <CountUp end={score} duration={1.5} decimals={1} />
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <span className="font-fraunces text-[28px] font-bold text-[#F8FAFC]">{scoreLabel(score)}</span>
            <span className="font-jakarta text-[14px] text-[#94A3B8]">{examId}</span>
            <div className="flex items-center gap-5">
              <div className="flex flex-col gap-0.5">
                <span className="font-jakarta text-[11px] text-[#475569]">Độ chính xác</span>
                <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">
                  {Math.round(accuracy * 100)}%
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-jakarta text-[11px] text-[#475569]">Thời gian</span>
                <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">
                  {formatTime(timeSpent)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sign-in nudge */}
        {!user && !nudgeDismissed && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl"
            style={{ background: '#0D1221', border: '1px solid #F2A20C44' }}>
            <button
              onClick={onOpenAuth}
              className="font-jakarta text-[13px] text-amber-400 hover:text-amber-300 transition-colors text-left"
            >
              Đăng nhập để lưu kết quả vào tài khoản của bạn →
            </button>
            <button
              onClick={() => setNudgeDismissed(true)}
              className="text-gray-500 hover:text-gray-300 text-lg leading-none flex-shrink-0"
              aria-label="Đóng"
            >×</button>
          </div>
        )}

        {/* Topic breakdown */}
        <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Kết quả theo chủ đề</span>
            <span className="font-jakarta text-[12px] text-[#475569]">{topics.length} chủ đề</span>
          </div>
          {topics.map(([topic, tb], i) => {
            const color = TOPIC_COLORS[topic] ?? pctColor(tb.accuracy)
            return (
              <div key={topic}>
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="font-jakarta text-[14px] text-[#F0F4FF]">{TOPIC_LABELS[topic] ?? topic}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-jakarta text-[13px] text-[#475569]">{tb.correct}/{tb.total}</span>
                    <span className="font-fraunces text-[15px] font-bold" style={{ color: pctColor(tb.accuracy) }}>
                      {Math.round(tb.accuracy * 100)}%
                    </span>
                  </div>
                </div>
                <div className="h-1 rounded-full bg-[#1E2A44] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(tb.accuracy * 100)}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.1 }}
                  />
                </div>
                {i < topics.length - 1 && <div className="h-px bg-[#1E2A44] mt-3" />}
              </div>
            )
          })}
        </div>

        {/* Chart */}
        <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-4">
          <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Biểu đồ chủ đề</span>
          <TopicBreakdownChart topicBreakdown={topicBreakdown} />
        </div>

        {/* AI Insights */}
        <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <span className="text-[#F2A20C]">✦</span>
            <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Phân tích AI</span>
          </div>
          <AIErrorBoundary>
            <AIInsights analysis={aiLoading ? null : analysis} loading={aiLoading} error={aiError} />
          </AIErrorBoundary>
        </div>

        {/* School recommendations */}
        {schoolRecs.length > 0 && (
          <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[#10B981] text-[16px]">🏫</span>
                <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Gợi ý trường phù hợp</span>
              </div>
              <span className="font-jakarta text-[11px] text-[#475569]">Điểm Toán của bạn: <span className="text-[#F2A20C] font-bold">{score}/10</span></span>
            </div>
            <p className="font-jakarta text-[12px] text-[#475569] leading-relaxed">
              Dựa trên điểm thi thử này so với điểm chuẩn môn Toán năm 2024.
              <span className="text-[#10B981]"> An toàn</span> — trên ngưỡng,{' '}
              <span className="text-[#F59E0B]">Phù hợp</span> — trong tầm,{' '}
              <span className="text-[#FB7185]">Thách thức</span> — cần cố gắng thêm.
            </p>
            <SchoolList recommendations={schoolRecs} />
            <p className="font-jakarta text-[10px] text-[#2A3A50] leading-relaxed">
              ↑ điểm chuẩn tăng dần · ↓ điểm chuẩn giảm dần · → ổn định
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/study-plan/${resultId}`, { state: { result, history: results.filter(r => r.id !== resultId) } })}
            className={`flex-1 py-3 rounded-xl font-jakarta text-[13px] font-semibold border bg-[#0D1221] border-[#1E2A44] transition flex items-center justify-center gap-2 ${
              planReady
                ? 'text-[#F8FAFC] hover:border-[#F2A20C] hover:text-[#F2A20C]'
                : 'text-[#475569]'
            }`}
          >
            {!planReady && (
              <span className="w-3.5 h-3.5 rounded-full border border-[#2A3A50] border-t-[#F2A20C] animate-spin flex-shrink-0" />
            )}
            {planReady ? 'Tạo Kế Hoạch Học Tập' : 'Đang chuẩn bị kế hoạch…'}
          </button>
        </div>

      </div>
    </div>
  )
}

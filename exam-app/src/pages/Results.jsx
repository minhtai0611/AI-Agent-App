import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useExam, useExamDispatch } from '../context/ExamContext.jsx'
import { useHistory } from '../context/HistoryContext.jsx'
import { scoreExam } from '../engine/scoringEngine.js'
import { analyzeResult } from '../engine/aiEngine.js'
import { loadSchools } from '../api/index.js'
import { analyzeResult as aiAnalyzeResult } from '../api/aiClient.js'
import TopicBreakdownChart from '../components/TopicBreakdownChart.jsx'
import AIInsights from '../components/AIInsights.jsx'
import TutorChat from '../components/TutorChat.jsx'
import AIErrorBoundary from '../components/AIErrorBoundary.jsx'

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

export default function Results() {
  const navigate = useNavigate()
  const { resultId } = useParams()
  const session = useExam()
  const dispatch = useExamDispatch()
  const { results, addResult } = useHistory()
  const [result, setResult] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(false)
  const [tutorOpen, setTutorOpen] = useState(false)

  const isCurrent = !resultId || resultId === 'current'

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
    const allPast = results.filter(r => r.id !== result.id)

    // Return cached AI analysis immediately if available
    const cacheKey = `ai-analysis-${result.id}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      setAnalysis(JSON.parse(cached))
      return
    }

    // Local fallback while AI loads
    const schools = loadSchools()
    setAnalysis(analyzeResult(result, allPast, schools))

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
  const examContext = { examId, topicBreakdown, weakTopics }

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col relative overflow-hidden">
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
            <span className="font-fraunces text-[38px] font-bold text-[#F2A20C]">{score}</span>
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
                {i < topics.length - 1 && <div className="h-px bg-[#1E2A44]" />}
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

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/study-plan/${resultId}`, { state: { result, history: results.filter(r => r.id !== resultId) } })}
            className="flex-1 py-3 rounded-xl font-jakarta text-[13px] font-semibold text-[#F8FAFC] border border-[#1E2A44] bg-[#0D1221] hover:border-[#F2A20C] hover:text-[#F2A20C] transition"
          >
            Tạo Kế Hoạch Học Tập
          </button>
          <button
            onClick={() => setTutorOpen(true)}
            className="flex-1 py-3 rounded-xl font-jakarta text-[13px] font-semibold text-[#0A0E1A] hover:opacity-90 transition"
            style={{ background: 'linear-gradient(180deg, #F2A20C 0%, #D97706 100%)' }}
          >
            Hỏi AI Gia Sư
          </button>
        </div>

      </div>

      {/* Tutor chat drawer */}
      <TutorChat open={tutorOpen} onClose={() => setTutorOpen(false)} examContext={examContext} />
    </div>
  )
}

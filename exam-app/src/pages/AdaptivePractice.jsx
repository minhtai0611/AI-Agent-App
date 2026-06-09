import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { pageVariants } from '../utils/animations.js'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useHistory } from '../context/HistoryContext'
import { useExam, useExamDispatch } from '../context/ExamContext'
import { useAuth } from '../context/AuthContext.jsx'
import { loadQuestions } from '../api/index.js'
import { generateAdaptivePractice } from '../api/aiClient.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { TOPIC_LABELS } from '../utils/topicLabels.js'
import { loadDiagnosticWeights } from './DiagnosticTest.jsx'

const TOPICS = Object.keys(TOPIC_LABELS)
const SESSION_SIZE = 15

function computeTopicWeights(results, questionMap, uid) {
  const counts = {}
  for (const topic of TOPICS) counts[topic] = { correct: 0, total: 0 }
  for (const result of results) {
    const answers = result.answers ?? {}
    for (const [qId, chosen] of Object.entries(answers)) {
      const q = questionMap[qId]
      if (!q || !counts[q.topic]) continue
      counts[q.topic].total++
      if (chosen === q.correct) counts[q.topic].correct++
    }
  }
  const hasHistory = Object.values(counts).some(c => c.total > 0)
  // Fall back to diagnostic weights when no practice history exists
  if (!hasHistory) {
    const diag = loadDiagnosticWeights(uid)
    if (diag) {
      const w = {}
      for (const topic of TOPICS) w[topic] = diag[topic] ?? 0.5
      return w
    }
  }
  const weights = {}
  for (const topic of TOPICS) {
    const { correct, total } = counts[topic]
    weights[topic] = total === 0 ? 0.5 : Math.max(0.1, 1 - correct / total)
  }
  return weights
}

function computeWeakTopics(results, questionMap, uid) {
  const weights = computeTopicWeights(results, questionMap, uid)
  return Object.entries(weights)
    .filter(([, w]) => w > 0.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t)
}

function interleaveQuestions(questions) {
  const buckets = {}
  for (const q of questions) {
    if (!buckets[q.topic]) buckets[q.topic] = []
    buckets[q.topic].push(q)
  }
  const result = []
  const keys = Object.keys(buckets)
  let i = 0
  while (result.length < questions.length) {
    const key = keys[i % keys.length]
    if (buckets[key].length) result.push(buckets[key].shift())
    i++
  }
  return result
}

function weightedSample(pool, weights, n, excludeTopic = null) {
  const uniqueTopics = [...new Set(pool.map(q => q.topic))]
  const eligible = uniqueTopics.length > 1 && excludeTopic
    ? pool.filter(q => q.topic !== excludeTopic)
    : pool
  const scored = eligible.map(q => ({ q, w: (weights[q.topic] ?? 0.5) + Math.random() * 0.3 }))
  scored.sort((a, b) => b.w - a.w)
  return scored.slice(0, n).map(x => x.q)
}

export default function AdaptivePractice() {
  usePageMeta('Luyện tập thích nghi', { noindex: true })
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const pinnedTopic = (location.state?.topic || searchParams.get('topic') || null)
  const { results } = useHistory()
  const { user } = useAuth()
  const dispatch = useExamDispatch()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState(null) // null = selection, 'static' | 'ai'
  const [weakTopics, setWeakTopics] = useState([])
  const [interleaved, setInterleaved] = useState(true)

  // Pre-compute weak topics for display
  useEffect(() => {
    loadQuestions().then(qs => {
      const qMap = Object.fromEntries(qs.map(q => [q.id, q]))
      setWeakTopics(computeWeakTopics(results, qMap, user?.id))
    }).catch(() => {})
  }, [results])

  useEffect(() => {
    if (mode === 'static') buildStatic()
    else if (mode === 'ai') buildAI()
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  async function buildStatic() {
    setLoading(true)
    setError(null)
    try {
      const allQuestions = await loadQuestions()
      const questionMap = Object.fromEntries(allQuestions.map(q => [q.id, q]))
      const weights = computeTopicWeights(results, questionMap, user?.id)
      const pool = allQuestions.filter(q =>
        pinnedTopic ? q.topic === pinnedTopic : TOPICS.includes(q.topic)
      )
      const sampled = weightedSample(pool, weights, SESSION_SIZE)
      const selected = interleaved ? interleaveQuestions(sampled) : sampled
      const topicLabel = pinnedTopic ? (TOPIC_LABELS[pinnedTopic] ?? pinnedTopic) : null
      const adaptiveExam = {
        id: `adaptive-${Date.now()}`,
        title: topicLabel ? `Luyện tập — ${topicLabel}` : 'Luyện tập thích nghi',
        totalQuestions: selected.length,
        duration: SESSION_SIZE * 2,
        category: 'adaptive',
        mode: 'practice',
        questionIds: selected.map(q => q.id),
      }
      dispatch({ type: 'START_EXAM', exam: adaptiveExam, questions: selected, mode: 'practice' })
      navigate(`/test/${adaptiveExam.id}`)
    } catch (err) {
      setError(err.message || 'Không thể tạo bài luyện tập')
      setLoading(false)
      setMode(null)
    }
  }

  async function buildAI() {
    setLoading(true)
    setError(null)
    try {
      const topics = weakTopics.length > 0 ? weakTopics : ['algebra']
      const { data, error: err } = await generateAdaptivePractice({
        weak_topics: topics,
        grade: user?.grade || '10',
        count: 5,
      })
      if (err) throw new Error(typeof err === 'string' ? err : (err.message || 'AI tạo câu hỏi thất bại'))
      const questions = (data?.questions ?? []).map((q, i) => ({
        id: q.id || `ai_${i}`,
        question: q.question || q.content || '',
        choices: q.choices || [],
        correct: typeof q.correct === 'number' ? q.correct : 0,
        topic: q.topic || 'algebra',
        difficulty: q.difficulty || 'medium',
        explanation: q.explanation || q.solution || '',
        source: 'ai',
      }))
      if (!questions.length) throw new Error('Không nhận được câu hỏi từ AI')
      const adaptiveExam = {
        id: `adaptive-ai-${Date.now()}`,
        title: 'Luyện tập AI',
        totalQuestions: questions.length,
        duration: questions.length * 3,
        category: 'adaptive',
        mode: 'practice',
        questionIds: questions.map(q => q.id),
      }
      dispatch({ type: 'START_EXAM', exam: adaptiveExam, questions, mode: 'practice' })
      navigate(`/test/${adaptiveExam.id}`)
    } catch (err) {
      setError(err.message || 'AI tạo câu hỏi thất bại')
      setLoading(false)
      setMode(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="font-jakarta text-[14px] text-[#94A3B8]">
            {mode === 'ai' ? 'AI đang tạo câu hỏi riêng cho bạn...' : 'Đang chọn câu hỏi phù hợp...'}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <p className="font-jakarta text-[14px] text-red-400">{error}</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setMode('static')}
              className="px-5 py-2 rounded-xl font-jakarta text-[13px] font-bold bg-primary text-background">
              Thử lại (từ kho đề)
            </button>
            <button onClick={() => navigate('/exams?mode=practice')}
              className="px-5 py-2 rounded-xl font-jakarta text-[13px] text-dim border border-surface">
              Quay lại
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Mode selection screen
  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit"
      className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 gap-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="font-fraunces text-[24px] font-bold text-[#F8FAFC]">Luyện tập thích nghi</span>
        {weakTopics.length > 0 && (
          <p className="font-jakarta text-[13px] text-dim">
            Điểm yếu: {weakTopics.slice(0, 3).map(t => TOPIC_LABELS[t] ?? t).join(' · ')}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <label className="flex items-center gap-2.5 cursor-pointer px-1">
          <input type="checkbox" checked={interleaved} onChange={e => setInterleaved(e.target.checked)}
            className="rounded accent-amber-400 w-4 h-4" />
          <span className="font-jakarta text-[13px] text-[#94A3B8]">
            Xáo trộn chủ đề
            <span className="ml-1 font-jakarta text-[11px] text-dim">— tăng khả năng ghi nhớ</span>
          </span>
        </label>
        <button
          onClick={() => setMode('static')}
          className="flex flex-col gap-2 px-6 py-5 rounded-2xl border border-surface bg-[#0D1221] text-left hover:border-primary/20 transition"
        >
          <span className="font-jakarta text-[14px] font-semibold text-[#F8FAFC]">Từ kho đề có sẵn</span>
          <span className="font-jakarta text-[12px] text-dim">
            {SESSION_SIZE} câu từ ngân hàng đề — nhanh, không tốn Tia
          </span>
        </button>

        {user && (
          <button
            onClick={() => setMode('ai')}
            className="flex flex-col gap-2 px-6 py-5 rounded-2xl border border-info/30 bg-surface text-left hover:border-info transition"
          >
            <div className="flex items-center justify-between">
              <span className="font-jakarta text-[14px] font-semibold text-[#F8FAFC]">AI tạo câu hỏi riêng</span>
              <span className="font-jakarta text-[11px] text-amber-400">⚡ 5 Tia</span>
            </div>
            <span className="font-jakarta text-[12px] text-dim">
              5 câu hỏi mới hoàn toàn, nhắm đúng điểm yếu của bạn
            </span>
          </button>
        )}
      </div>

      <button onClick={() => navigate('/exams?mode=practice')}
        className="font-jakarta text-[13px] text-dim hover:text-[#94A3B8] transition">
        ← Quay lại
      </button>
    </motion.div>
  )
}

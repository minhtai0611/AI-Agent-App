import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { pageVariants } from '../utils/animations.js'
import { useNavigate, useLocation, useSearchParams, Navigate } from 'react-router-dom'
import { useHistory } from '../context/HistoryContext'
import { useExam, useExamDispatch } from '../context/ExamContext'
import { useAuth } from '../context/AuthContext.jsx'
import { loadQuestions } from '../api/index.js'
import { generateAdaptivePractice, adaptiveNextQuestion, getConceptMastery } from '../api/aiClient.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { TOPIC_LABELS } from '../utils/topicLabels.js'
import { hasImageDependency } from '../utils/questionUtils.js'
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

// KST outer fringe: unmastered concepts whose all prerequisites are mastered (≥70 score)
function computeOuterFringe(concepts) {
  const mastered = new Set(concepts.filter(c => c.mastery_score >= 70).map(c => c.id))
  return concepts.filter(c => {
    if (mastered.has(c.id)) return false
    const prereqs = c.prerequisite_ids || []
    return prereqs.every(p => mastered.has(p))
  })
}

// Count how many unmastered concepts this concept unlocks directly
function countUnlocks(conceptId, allConcepts) {
  return allConcepts.filter(c =>
    c.mastery_score < 70 && (c.prerequisite_ids || []).includes(conceptId)
  ).length
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

  const PRACTICE_TIERS = new Set(['student', 'complete'])
  if (!user) return <Navigate to="/" replace />
  if (!PRACTICE_TIERS.has(user.subscription_tier)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full flex flex-col gap-4 items-center text-center">
          <span className="font-sans text-sm text-muted">
            Luyện tập thích nghi yêu cầu gói Học sinh hoặc Toàn diện.
          </span>
          <button
            onClick={() => navigate('/account')}
            className="px-5 py-2.5 rounded-xl font-sans text-sm font-bold bg-primary text-background"
          >
            Nâng cấp gói
          </button>
        </div>
      </div>
    )
  }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState(null) // null = selection, 'static' | 'ai' | 'kst'
  const [weakTopics, setWeakTopics] = useState([])
  const [interleaved, setInterleaved] = useState(true)
  const [kstConcept, setKstConcept] = useState(null) // {name_vi, topic, unlocks}

  const hasDiagnosticWeights = user?.id
    ? !!localStorage.getItem(`diagnostic_weights_${user.id}`)
    : false

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
    else if (mode === 'kst') buildKST()
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  async function buildStatic() {
    setLoading(true)
    setError(null)
    try {
      const allQuestions = await loadQuestions()
      const questionMap = Object.fromEntries(allQuestions.map(q => [q.id, q]))
      const weights = computeTopicWeights(results, questionMap, user?.id)
      const pool = allQuestions.filter(q => {
        if (pinnedTopic ? q.topic !== pinnedTopic : !TOPICS.includes(q.topic)) return false
        if (hasImageDependency(q.question) && !q.image) return false
        return true
      })
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

  async function buildKST() {
    setLoading(true)
    setError(null)
    try {
      const { data: masteryData, error: mErr } = await getConceptMastery()
      if (mErr) throw new Error('Không thể tải dữ liệu kiến thức')
      const concepts = masteryData?.concepts ?? []
      const fringe = computeOuterFringe(concepts)
      if (!fringe.length) {
        // All concepts mastered or no mastery data — fall back to static
        return buildStatic()
      }
      // Pick highest exam_weight fringe concept; if tied, prefer the one unlocking most
      const best = fringe.sort((a, b) => {
        const wDiff = (b.exam_weight ?? 0) - (a.exam_weight ?? 0)
        if (wDiff !== 0) return wDiff
        return countUnlocks(b.id, concepts) - countUnlocks(a.id, concepts)
      })[0]
      const unlocks = countUnlocks(best.id, concepts)
      setKstConcept({ name_vi: best.name_vi, topic: best.topic, unlocks })

      const { data, error: err } = await adaptiveNextQuestion({
        topic: best.topic,
        count: SESSION_SIZE,
        seen_ids: [],
        answer_history: [],
      })
      if (err) throw new Error(typeof err === 'string' ? err : 'Không thể tải câu hỏi')
      const questions = (data?.questions ?? []).map(q => ({
        ...q,
        choices: typeof q.choices === 'string' ? JSON.parse(q.choices) : (q.choices ?? []),
        source: 'kst',
      }))
      if (!questions.length) throw new Error('Không tìm thấy câu hỏi cho khái niệm này')
      const adaptiveExam = {
        id: `kst-${Date.now()}`,
        title: `Lộ trình KST — ${best.name_vi}`,
        totalQuestions: questions.length,
        duration: questions.length * 2,
        category: 'adaptive',
        mode: 'practice',
        questionIds: questions.map(q => q.id),
      }
      dispatch({ type: 'START_EXAM', exam: adaptiveExam, questions, mode: 'practice' })
      navigate(`/test/${adaptiveExam.id}`)
    } catch (err) {
      setError(err.message || 'Không thể tải lộ trình KST')
      setLoading(false)
      setMode(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <div className="w-8 h-8 border-2 border-[var(--accent-border)] border-t-transparent rounded-full animate-spin" />
          <p className="font-sans text-[14px] text-muted">
            {mode === 'ai'
              ? 'AI đang tạo câu hỏi riêng cho bạn...'
              : mode === 'kst'
              ? 'Đang phân tích lộ trình kiến thức...'
              : 'Đang chọn câu hỏi phù hợp...'}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <p className="font-sans text-[14px] text-red-400">{error}</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setMode('static')}
              className="px-5 py-2 rounded-xl font-sans text-[13px] font-bold bg-primary text-background">
              Thử lại (từ kho đề)
            </button>
            <button onClick={() => navigate('/exams?mode=practice')}
              className="px-5 py-2 rounded-xl font-sans text-[13px] text-dim border border-surface">
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
        <span className="font-sans text-[24px] font-bold text-foreground">Luyện tập thích nghi</span>
        {weakTopics.length > 0 && (
          <div className="flex flex-col gap-0.5 items-center">
            <p className="font-sans text-[13px] text-dim">
              Điểm yếu: {weakTopics.slice(0, 3).map(t => TOPIC_LABELS[t] ?? t).join(' · ')}
            </p>
            <p className="font-sans text-[11px] text-dim/70" data-testid="topic-source-label">
              {hasDiagnosticWeights
                ? 'Dựa trên kết quả kiểm tra năng lực của bạn'
                : 'Dựa trên lịch sử bài thi của bạn'}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <label className="flex items-center gap-2.5 cursor-pointer px-1">
          <input type="checkbox" checked={interleaved} onChange={e => setInterleaved(e.target.checked)}
            className="rounded accent-amber-400 w-4 h-4" />
          <span className="font-sans text-[13px] text-muted">
            Xáo trộn chủ đề
            <span className="ml-1 font-sans text-[11px] text-dim">— tăng khả năng ghi nhớ</span>
          </span>
        </label>
        <button
          onClick={() => setMode('static')}
          className="flex flex-col gap-2 px-6 py-5 rounded-2xl border border-surface glass-base text-left hover:border-primary/20 transition"
        >
          <span className="font-sans text-[14px] font-semibold text-foreground">Từ kho đề có sẵn</span>
          <span className="font-sans text-[12px] text-dim">
            {SESSION_SIZE} câu từ ngân hàng đề — nhanh, không tốn lượt hỏi AI
          </span>
        </button>

        {user && (
          <button
            onClick={() => setMode('ai')}
            className="flex flex-col gap-2 px-6 py-5 rounded-2xl border border-info/30 bg-surface text-left hover:border-info transition"
          >
            <div className="flex items-center justify-between">
              <span className="font-sans text-[14px] font-semibold text-foreground">AI tạo câu hỏi riêng</span>
              <span className="font-sans text-[11px] text-[var(--accent)]">⚡ 5 lượt hỏi AI</span>
            </div>
            <span className="font-sans text-[12px] text-dim">
              5 câu hỏi mới hoàn toàn, nhắm đúng điểm yếu của bạn
            </span>
          </button>
        )}

        {user && (
          <button
            onClick={() => setMode('kst')}
            className="flex flex-col gap-2 px-6 py-5 rounded-2xl border border-primary/30 bg-surface text-left hover:border-primary/60 transition"
          >
            <div className="flex items-center justify-between">
              <span className="font-sans text-[14px] font-semibold text-foreground">Lộ trình kiến thức (KST)</span>
              <span className="font-sans text-[11px] text-primary/70">Tự động</span>
            </div>
            <span className="font-sans text-[12px] text-dim">
              Chọn đúng khái niệm bạn sẵn sàng học — mở khóa kiến thức tiếp theo
            </span>
          </button>
        )}
      </div>

      <button onClick={() => navigate('/exams?mode=practice')}
        className="font-sans text-[13px] text-dim hover:text-muted transition">
        ← Quay lại
      </button>
    </motion.div>
  )
}

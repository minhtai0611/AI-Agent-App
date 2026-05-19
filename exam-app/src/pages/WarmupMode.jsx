import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHistory } from '../context/HistoryContext'
import { useExamDispatch } from '../context/ExamContext'
import { loadQuestions } from '../api/index.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { TOPIC_LABELS } from '../utils/topicLabels.js'

const TOPICS = Object.keys(TOPIC_LABELS)
const WARMUP_SIZE = 5

function computeTopicWeights(results, questionMap) {
  const counts = {}
  for (const topic of TOPICS) counts[topic] = { correct: 0, total: 0 }
  for (const result of results) {
    for (const [qId, chosen] of Object.entries(result.answers ?? {})) {
      const q = questionMap[qId]
      if (!q || !counts[q.topic]) continue
      counts[q.topic].total++
      if (chosen === q.correct) counts[q.topic].correct++
    }
  }
  const weights = {}
  for (const topic of TOPICS) {
    const { correct, total } = counts[topic]
    weights[topic] = total === 0 ? 0.5 : Math.max(0.1, 1 - correct / total)
  }
  return weights
}

function pickWarmupQuestions(allQuestions, results, reviewQueue) {
  const questionMap = Object.fromEntries(allQuestions.map(q => [q.id, q]))
  const weights = computeTopicWeights(results, questionMap)
  const today = new Date().toISOString().slice(0, 10)

  // 2 from SM-2 due reviews
  const dueIds = Object.entries(reviewQueue)
    .filter(([, e]) => e.dueDate <= today)
    .sort(() => Math.random() - 0.5)
    .slice(0, 2)
    .map(([id]) => id)
  const dueQs = dueIds.map(id => questionMap[id]).filter(Boolean)

  // Remaining from weakest topics
  const sortedTopics = Object.entries(weights).sort((a, b) => b[1] - a[1]).map(([t]) => t)
  const usedIds = new Set(dueIds)
  const remaining = []
  for (const topic of sortedTopics) {
    if (remaining.length >= WARMUP_SIZE - dueQs.length) break
    const pool = allQuestions.filter(q => q.topic === topic && !usedIds.has(q.id))
    if (pool.length) {
      const pick = pool[Math.floor(Math.random() * pool.length)]
      remaining.push(pick)
      usedIds.add(pick.id)
    }
  }

  return [...dueQs, ...remaining].slice(0, WARMUP_SIZE)
}

export default function WarmupMode() {
  usePageTitle('Khởi động 5 phút')
  const navigate = useNavigate()
  const { results } = useHistory()
  const dispatch = useExamDispatch()

  useEffect(() => {
    async function build() {
      try {
        const allQuestions = await loadQuestions()
        let reviewQueue = {}
        try { reviewQueue = JSON.parse(localStorage.getItem('review_queue') ?? '{}') } catch {}
        const selected = pickWarmupQuestions(allQuestions, results, reviewQueue)
        if (!selected.length) { navigate('/exams?mode=special'); return }

        const warmupExam = {
          id: `warmup-${Date.now()}`,
          title: '⚡ Khởi động 5 phút',
          totalQuestions: selected.length,
          duration: 10,
          category: 'adaptive',
          mode: 'practice',
        }
        dispatch({ type: 'START_EXAM', exam: warmupExam, questions: selected })
        navigate('/test/warmup')
      } catch {
        navigate('/exams?mode=special')
      }
    }
    build()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="text-4xl animate-pulse">⚡</span>
        <span className="font-jakarta text-[14px] text-[#64748B]">Đang chọn câu hỏi...</span>
      </div>
    </div>
  )
}

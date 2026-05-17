import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHistory } from '../context/HistoryContext'
import { useExam, useExamDispatch } from '../context/ExamContext'
import { loadQuestions } from '../api/index.js'
import { usePageTitle } from '../hooks/usePageTitle.js'

import { TOPIC_LABELS } from '../utils/topicLabels.js'
const TOPICS = Object.keys(TOPIC_LABELS)
const SESSION_SIZE = 15

function computeTopicWeights(results, questionMap) {
  const counts = {}   // topic → { correct, total }
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

  // Weight = 1 - accuracy, floored at 0.1 so every topic has a chance
  const weights = {}
  for (const topic of TOPICS) {
    const { correct, total } = counts[topic]
    weights[topic] = total === 0 ? 0.5 : Math.max(0.1, 1 - correct / total)
  }
  return weights
}

function weightedSample(pool, weights, n) {
  // Fisher-Yates weighted shuffle
  const scored = pool.map(q => ({ q, w: (weights[q.topic] ?? 0.5) + Math.random() * 0.3 }))
  scored.sort((a, b) => b.w - a.w)
  return scored.slice(0, n).map(x => x.q)
}

export default function AdaptivePractice() {
  usePageTitle('Luyện tập thích nghi')
  const navigate = useNavigate()
  const { results } = useHistory()
  const dispatch = useExamDispatch()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function build() {
      try {
        const allQuestions = await loadQuestions()
        if (cancelled) return

        const questionMap = Object.fromEntries(allQuestions.map(q => [q.id, q]))
        const weights = computeTopicWeights(results, questionMap)
        const pool = allQuestions.filter(q => TOPICS.includes(q.topic))
        const selected = weightedSample(pool, weights, SESSION_SIZE)

        const adaptiveExam = {
          id: `adaptive-${Date.now()}`,
          title: 'Luyện tập thích nghi',
          totalQuestions: selected.length,
          duration: SESSION_SIZE * 2,
          category: 'adaptive',
          mode: 'practice',
          questionIds: selected.map(q => q.id),
        }

        dispatch({ type: 'START_EXAM', exam: adaptiveExam, questions: selected, mode: 'practice' })
        navigate(`/test/${adaptiveExam.id}`)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Không thể tạo bài luyện tập')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    build()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center px-4">
        {error ? (
          <>
            <p className="font-jakarta text-[14px] text-red-400">{error}</p>
            <button
              onClick={() => navigate('/exams')}
              className="px-5 py-2 rounded-xl font-jakarta text-[13px] font-bold"
              style={{ background: '#F2A20C', color: '#0A0E1A' }}
            >
              Quay lại chọn đề
            </button>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="font-jakarta text-[14px] text-[#94A3B8]">Đang tạo bài luyện tập theo điểm yếu của bạn...</p>
          </>
        )}
      </div>
    </div>
  )
}

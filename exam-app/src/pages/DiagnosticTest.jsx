import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { loadQuestions } from '../api/index.js'
import { seedDiagnostic } from '../api/aiClient.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { TOPIC_LABELS } from '../utils/topicLabels.js'
import { MathText } from '../components/MathText.jsx'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../utils/animations.js'

const DIAGNOSTIC_TOPICS = ['algebra', 'geometry', 'statistics', 'combinatorics', 'trigonometry', 'functions']
const QUESTIONS_PER_TOPIC = 2
const DIAGNOSTIC_KEY = uid => `diagnostic_weights-${uid ?? 'guest'}`

function sampleTopicQuestions(allQuestions, topic, n) {
  const pool = allQuestions.filter(q => q.topic === topic)
  if (!pool.length) return []
  // Prefer medium difficulty
  const medium = pool.filter(q => q.difficulty === 'medium')
  const source = medium.length >= n ? medium : pool
  const shuffled = [...source].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

function buildDiagnosticExam(allQuestions) {
  const questions = []
  for (const topic of DIAGNOSTIC_TOPICS) {
    const sampled = sampleTopicQuestions(allQuestions, topic, QUESTIONS_PER_TOPIC)
    questions.push(...sampled)
  }
  return questions.filter(Boolean)
}

function computeDiagnosticWeights(questions, answers) {
  const counts = {}
  for (const topic of DIAGNOSTIC_TOPICS) counts[topic] = { correct: 0, total: 0 }
  for (const q of questions) {
    const chosen = answers[q.id]
    if (chosen === undefined || chosen === null) continue
    const t = q.topic
    if (!counts[t]) counts[t] = { correct: 0, total: 0 }
    counts[t].total++
    if (chosen === q.correct) counts[t].correct++
  }
  const weights = {}
  for (const topic of DIAGNOSTIC_TOPICS) {
    const { correct, total } = counts[topic]
    weights[topic] = total === 0 ? 0.5 : Math.max(0.1, 1 - correct / total)
  }
  return weights
}

export function loadDiagnosticWeights(uid) {
  try {
    const raw = JSON.parse(localStorage.getItem(DIAGNOSTIC_KEY(uid)) ?? 'null')
    if (!raw || !raw.completedAt) return null
    return raw
  } catch { return null }
}

export default function DiagnosticTest() {
  usePageMeta('Kiểm tra đầu vào', { description: 'Làm bài kiểm tra 12 câu để AI Zenith đánh giá năng lực và đề xuất lộ trình ôn tập phù hợp.' })
  const navigate = useNavigate()
  const { user } = useAuth()

  const [allQuestions, setAllQuestions] = useState([])
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [phase, setPhase] = useState('intro') // intro | testing | results

  useEffect(() => {
    loadQuestions().then(qs => {
      setAllQuestions(qs)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function startTest() {
    const selected = buildDiagnosticExam(allQuestions)
    setQuestions(selected)
    setAnswers({})
    setCurrentIdx(0)
    setPhase('testing')
  }

  function handleAnswer(choiceIdx) {
    const q = questions[currentIdx]
    const newAnswers = { ...answers, [q.id]: choiceIdx }
    setAnswers(newAnswers)
    if (currentIdx + 1 < questions.length) {
      setTimeout(() => setCurrentIdx(i => i + 1), 400)
    } else {
      // Finished — compute and save weights
      const weights = computeDiagnosticWeights(questions, newAnswers)
      const payload = { ...weights, completedAt: new Date().toISOString().slice(0, 10) }
      try { localStorage.setItem(DIAGNOSTIC_KEY(user?.id), JSON.stringify(payload)) } catch {}
      // Seed the Learning Graph for logged-in users (fire-and-forget)
      if (user?.id) seedDiagnostic(weights).catch(() => {})
      setPhase('results')
    }
  }

  const resultsData = useMemo(() => {
    if (phase !== 'results') return []
    return DIAGNOSTIC_TOPICS.map(topic => {
      const qs = questions.filter(q => q.topic === topic)
      const correct = qs.filter(q => answers[q.id] === q.correct).length
      const pct = qs.length ? Math.round((correct / qs.length) * 100) : 0
      return { topic, correct, total: qs.length, pct }
    }).filter(d => d.total > 0)
  }, [phase, questions, answers])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <span className="font-sans text-dim text-[14px]">Đang tải câu hỏi...</span>
      </div>
    )
  }

  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
          className="max-w-md w-full glass-base border border-surface rounded-2xl p-8 flex flex-col gap-5 text-center">
          <span className="text-4xl">🧪</span>
          <div>
            <h1 className="font-sans text-[24px] font-bold text-foreground mb-2">Kiểm tra đầu vào</h1>
            <p className="font-sans text-[14px] text-muted leading-relaxed">
              {DIAGNOSTIC_TOPICS.length * QUESTIONS_PER_TOPIC} câu hỏi · 2 câu mỗi chủ đề
            </p>
            <p className="font-sans text-[13px] text-dim mt-2 leading-relaxed">
              Kết quả sẽ giúp AI chọn đúng dạng bài bạn cần luyện nhất.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-left">
            {DIAGNOSTIC_TOPICS.map(t => (
              <div key={t} className="flex items-center gap-2 font-sans text-[13px] text-dim">
                <span className="w-1.5 h-1.5 rounded-full bg-surface flex-shrink-0" />
                {TOPIC_LABELS[t] ?? t}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <button onClick={startTest}
              className="w-full py-3 rounded-xl font-sans text-[14px] font-bold bg-primary text-background">
              Bắt đầu kiểm tra
            </button>
            <button onClick={() => navigate(-1)}
              className="font-sans text-[13px] text-dim hover:text-muted transition py-1">
              Bỏ qua
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  if (phase === 'testing') {
    const q = questions[currentIdx]
    const chosen = answers[q?.id]
    const progress = ((currentIdx) / questions.length) * 100

    return (
      <div className="min-h-screen bg-surface flex flex-col items-center px-4 pt-16 pb-16">
        {/* Progress bar */}
        <div className="w-full max-w-xl mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-sans text-[12px] text-dim">
              Câu {currentIdx + 1} / {questions.length}
            </span>
            <span className="font-sans text-[11px] font-semibold text-dim uppercase tracking-wider">
              {TOPIC_LABELS[q.topic] ?? q.topic}
            </span>
          </div>
          <div className="h-1 bg-surface rounded-full">
            <div className="h-1 bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={currentIdx}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-xl">
            <div className="glass-base border border-surface rounded-2xl p-6 mb-4">
              <MathText className="font-sans text-[15px] text-foreground leading-relaxed">
                {q.question}
              </MathText>
            </div>
            <div className="flex flex-col gap-2">
              {q.choices?.map((choice, i) => {
                const isChosen = chosen === i
                const isCorrect = chosen !== undefined && i === q.correct
                const isWrong = isChosen && chosen !== q.correct
                return (
                  <button key={i}
                    onClick={() => chosen === undefined && handleAnswer(i)}
                    disabled={chosen !== undefined}
                    className="w-full text-left px-5 py-3.5 rounded-xl border font-sans text-[14px] transition"
                    style={{
                      borderColor: isCorrect ? 'var(--primary-border)' : isWrong ? 'rgba(220,38,38,0.3)' : 'var(--border)',
                      background: isCorrect ? '#0A2A1A' : isWrong ? '#2A0F14' : '#0D1521',
                      color: isCorrect ? '#34D399' : isWrong ? '#FB7185' : '#CBD5E1',
                    }}>
                    <span className="text-dim mr-3">{String.fromCharCode(65 + i)}.</span>
                    <MathText>{choice}</MathText>
                  </button>
                )
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  // Results phase
  const totalCorrect = resultsData.reduce((s, d) => s + d.correct, 0)
  const totalQ = resultsData.reduce((s, d) => s + d.total, 0)
  const overallPct = totalQ ? Math.round((totalCorrect / totalQ) * 100) : 0

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit"
      className="min-h-screen bg-surface flex flex-col items-center px-4 pt-16 pb-16">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
        className="w-full max-w-xl flex flex-col gap-6">
        <div className="text-center">
          <span className="text-4xl">{overallPct >= 70 ? '🎉' : overallPct >= 40 ? '📊' : '💪'}</span>
          <h1 className="font-sans text-[24px] font-bold text-foreground mt-3">Kết quả chẩn đoán</h1>
          <p className="font-sans text-[14px] text-muted mt-1">{totalCorrect}/{totalQ} câu đúng · {overallPct}% tổng thể</p>
        </div>

        {/* Topic breakdown bars */}
        <div className="glass-base border border-surface rounded-2xl p-5 flex flex-col gap-3">
          {resultsData.map(({ topic, correct, total, pct }) => (
            <div key={topic} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-sans text-[13px] font-medium text-foreground">{TOPIC_LABELS[topic] ?? topic}</span>
                <span className="font-sans text-[12px] text-dim">{correct}/{total}</span>
              </div>
              <div className="h-1.5 bg-surface rounded-full">
                <div className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 100 ? '#34D399' : pct >= 50 ? '#F2A20C' : '#FB7185',
                  }} />
              </div>
            </div>
          ))}
        </div>

        <p className="font-sans text-[13px] text-dim text-center">
          AI sẽ ưu tiên luyện những chủ đề bạn còn yếu khi bạn dùng chế độ Luyện thích nghi.
        </p>

        <div className="flex flex-col gap-2">
          <button onClick={() => navigate('/practice/adaptive')}
            className="w-full py-3 rounded-xl font-sans text-[14px] font-bold bg-primary text-background">
            Bắt đầu luyện tập thích nghi →
          </button>
          <button onClick={() => navigate('/exams?mode=timed')}
            className="font-sans text-[13px] text-dim hover:text-muted transition text-center py-1">
            Quay lại
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

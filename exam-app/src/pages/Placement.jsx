import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { loadQuestions } from '../api/index.js'
import { submitPlacement } from '../api/aiClient.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { MathText } from '../components/MathText.jsx'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../utils/animations.js'

// 10 topic pools — one question drawn from each, covering broad math curriculum
const PLACEMENT_TOPIC_POOLS = [
  ['algebra', 'đại số'],
  ['phương trình bậc hai', 'algebra'],
  ['hàm số bậc nhất', 'functions'],
  ['hệ phương trình'],
  ['geometry', 'hình học'],
  ['number_theory', 'arithmetic'],
  ['combinatorics'],
  ['probability', 'xác suất thống kê'],
  ['statistics', 'sequences'],
  ['calculus', 'parabol'],
]

function pickOne(pool, usedIds) {
  const med = pool.filter(q => q.difficulty === 'medium' && !usedIds.has(q.id))
  const src = med.length ? med : pool.filter(q => !usedIds.has(q.id))
  if (!src.length) return null
  return src[Math.floor(Math.random() * src.length)]
}

function samplePlacementQuestions(allQuestions) {
  const result = []
  const usedIds = new Set()
  for (const topics of PLACEMENT_TOPIC_POOLS) {
    const pool = allQuestions.filter(q => topics.includes(q.topic))
    const picked = pickOne(pool, usedIds)
    if (picked) { result.push(picked); usedIds.add(picked.id) }
    if (result.length >= 10) break
  }
  if (result.length < 10) {
    const extras = allQuestions.filter(q => !usedIds.has(q.id)).sort(() => Math.random() - 0.5)
    result.push(...extras.slice(0, 10 - result.length))
  }
  return result.slice(0, 10)
}

export default function Placement() {
  usePageMeta('Kiểm tra năng lực', { noindex: true })
  const navigate = useNavigate()
  const { user } = useAuth()

  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState(0)
  const [chosen, setChosen] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [answers, setAnswers] = useState([]) // [{question_id, correct}]
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    loadQuestions()
      .then(qs => { setQuestions(samplePlacementQuestions(qs)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const question = questions[current]

  function handleChoice(i) {
    if (revealed) return
    setChosen(i)
    setRevealed(true)
  }

  function handleNext() {
    if (!question) return
    const correct = chosen === question.correct
    const newAnswers = [...answers, { question_id: question.id, correct }]
    setAnswers(newAnswers)

    if (current + 1 >= questions.length) {
      finishPlacement(newAnswers)
    } else {
      setCurrent(c => c + 1)
      setChosen(null)
      setRevealed(false)
    }
  }

  async function finishPlacement(finalAnswers) {
    setSubmitting(true)
    if (user?.id) {
      await submitPlacement(finalAnswers).catch(() => {})
    }
    setSubmitting(false)
    setDone(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <span className="font-sans text-[14px] text-dim">Đang tải câu hỏi...</span>
      </div>
    )
  }

  if (done) {
    const correct = answers.filter(a => a.correct).length
    return (
      <motion.div
        className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 gap-6"
        variants={pageVariants} initial="hidden" animate="show" exit="exit"
      >
        <div className="w-full max-w-md bg-surface border border-surface rounded-2xl p-8 flex flex-col items-center gap-5 text-center">
          <span className="text-5xl">{correct >= 7 ? '🏆' : correct >= 5 ? '📈' : '📚'}</span>
          <div className="flex flex-col gap-1">
            <h1 className="font-sans text-[24px] font-bold text-foreground">Kiểm tra hoàn thành</h1>
            <p className="font-sans text-[14px] text-muted">
              Bạn trả lời đúng <span className="text-primary font-semibold">{correct}/{answers.length}</span> câu
            </p>
          </div>
          <p className="font-sans text-[13px] text-dim leading-relaxed">
            Zenith đã ghi nhận năng lực của bạn và sẽ gợi ý lộ trình học phù hợp.
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-3 rounded-xl font-sans text-[14px] font-semibold bg-info text-white hover:bg-info/80 transition"
            >
              Bắt đầu học →
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  if (!question) return null

  const isCorrect = chosen === question.correct

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit"
      className="min-h-screen bg-surface flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-xl flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="font-sans text-[11px] font-semibold text-info tracking-[2px] uppercase">Kiểm tra năng lực</span>
            <span className="font-sans text-[13px] text-dim">Câu {current + 1} / {questions.length}</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="font-sans text-[12px] text-dim hover:text-muted transition"
          >
            Bỏ qua
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-info"
            animate={{ width: `${((current) / questions.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="bg-surface border border-surface rounded-2xl p-6 flex flex-col gap-5"
          >
            <p className="font-sans text-[15px] text-foreground leading-relaxed">
              <MathText>{question.question}</MathText>
            </p>

            <div className="flex flex-col gap-2.5">
              {question.choices?.map((choice, i) => {
                let bg = '#141D2E'
                let border = 'var(--border)'
                let textColor = '#94A3B8'
                if (revealed) {
                  if (i === question.correct) { bg = '#0D2A1A'; border = '#10B981'; textColor = '#34D399' }
                  else if (i === chosen && !isCorrect) { bg = '#2A0F14'; border = '#EF4444'; textColor = '#FB7185' }
                } else if (i === chosen) {
                  bg = '#141D3E'; border = '#6366F1'; textColor = '#C7D2FE'
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleChoice(i)}
                    disabled={revealed}
                    className="w-full text-left px-4 py-3.5 rounded-xl font-sans text-[14px] font-medium transition-all"
                    style={{ background: bg, border: `1px solid ${border}`, color: textColor }}
                  >
                    <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>
                    <MathText>{choice}</MathText>
                  </button>
                )
              })}
            </div>

            {revealed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="flex flex-col gap-3">
                <div
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                  style={{ background: isCorrect ? '#0D2A1A' : '#2A0F14', border: `1px solid ${isCorrect ? '#10B981' : '#EF4444'}` }}
                >
                  <span className="text-lg">{isCorrect ? '✓' : '✗'}</span>
                  <span className="font-sans text-[13px] font-semibold" style={{ color: isCorrect ? '#10B981' : '#FB7185' }}>
                    {isCorrect ? 'Chính xác!' : `Đáp án: ${String.fromCharCode(65 + question.correct)}. ${question.choices?.[question.correct]}`}
                  </span>
                </div>

                <button
                  onClick={handleNext}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl font-sans text-[14px] font-semibold bg-info text-white hover:bg-info/80 transition disabled:opacity-60"
                >
                  {current + 1 >= questions.length
                    ? (submitting ? 'Đang lưu...' : 'Hoàn thành →')
                    : 'Câu tiếp theo →'}
                </button>
              </motion.div>
            )}

            {!revealed && (
              <p className="text-center font-sans text-[12px] text-dim">Chọn một đáp án để tiếp tục</p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

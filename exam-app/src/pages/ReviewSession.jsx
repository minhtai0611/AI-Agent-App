import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { loadQuestionsByIds } from '../api/index.js'
import { pageVariants } from '../utils/animations.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { TOPIC_LABELS } from '../utils/topicLabels.js'
import { MathText } from '../components/MathText.jsx'
import { QuestionCardSkeleton } from '../components/Skeleton.jsx'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const QUEUE_KEY = (uid) => `review_queue-${uid ?? 'guest'}`

function getQueue(uid) {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY(uid)) ?? '{}') }
  catch { return {} }
}

function saveQueue(q, uid) {
  try { localStorage.setItem(QUEUE_KEY(uid), JSON.stringify(q)) } catch {}
}

// SM-2 algorithm: grade 4 = correct, grade 1 = wrong
function updateSM2(entry, correct) {
  let { easeFactor = 2.5, interval = 1, repetitions = 0 } = entry
  const grade = correct ? 4 : 1

  if (grade >= 3) {
    if (repetitions === 0) interval = 1
    else if (repetitions === 1) interval = 6
    else interval = Math.round(interval * easeFactor)
    repetitions += 1
  } else {
    repetitions = 0
    interval = 1
  }

  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  return { ...entry, easeFactor, interval, repetitions, dueDate: addDays(new Date(), interval) }
}

export default function ReviewSession() {
  usePageTitle('Ôn tập hôm nay')
  const navigate = useNavigate()
  const { user } = useAuth()
  const uid = user?.id ?? null
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [results, setResults] = useState([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    const queue = getQueue(uid)
    const today = todayStr()
    const dueIds = Object.entries(queue)
      .filter(([, entry]) => entry.dueDate <= today)
      .map(([id]) => id)
    loadQuestionsByIds(dueIds).then(loaded => {
      setQuestions(loaded)
      if (loaded.length === 0) setDone(true)
      setLoading(false)
    })
  }, [])

  const question = questions[index]

  function handleAnswer(choiceIdx) {
    if (revealed) return
    setChosen(choiceIdx)
    setRevealed(true)
  }

  function handleNext(markCorrect) {
    const queue = getQueue(uid)
    const qId = question.id
    const entry = queue[qId] ?? {}
    queue[qId] = updateSM2(entry, markCorrect)
    saveQueue(queue, uid)

    setResults(r => [...r, markCorrect ? 'correct' : 'wrong'])

    if (index + 1 >= questions.length) {
      setDone(true)
    } else {
      setIndex(i => i + 1)
      setChosen(null)
      setRevealed(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] px-4 py-10 max-w-2xl mx-auto w-full flex flex-col gap-4">
        <QuestionCardSkeleton />
      </div>
    )
  }

  if (done) {
    const correct = results.filter(r => r === 'correct').length
    const total = questions.length
    const dailyStreak = (() => {
      try {
        const s = JSON.parse(localStorage.getItem('daily_challenge_streak') ?? '{}')
        return s.currentStreak ?? 0
      } catch { return 0 }
    })()
    return (
      <motion.div
        className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center gap-8 px-4"
        variants={pageVariants} initial="hidden" animate="show"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-5xl">{total === 0 ? '✓' : correct === total ? '🎉' : '📚'}</span>
          <h2 className="font-fraunces text-[28px] font-bold text-[#F8FAFC]">
            {total === 0 ? 'Không có câu nào cần ôn hôm nay!' : 'Hoàn thành ôn tập!'}
          </h2>
          {total > 0 && (
            <p className="font-jakarta text-[#94A3B8] text-[15px]">
              Đúng <span className="text-[#10B981] font-bold">{correct}</span> / {total} câu
            </p>
          )}
          {dailyStreak > 0 && (
            <p className="font-jakarta text-[13px] text-amber-400">
              🔥 {dailyStreak} ngày liên tiếp — tiếp tục chuỗi với Thử thách hôm nay!
            </p>
          )}
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={() => navigate('/exams?mode=special')}
            className="px-6 py-3 rounded-xl font-jakarta text-[13px] font-semibold border border-[#1E2A44] text-[#94A3B8] hover:text-[#F8FAFC] transition"
          >
            Làm đề thi
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-xl font-jakarta text-[13px] font-bold text-[#0A0E1A] hover:opacity-90 transition"
            style={{ background: '#F2A20C' }}
          >
            Về trang chủ
          </button>
        </div>
      </motion.div>
    )
  }

  if (!question) return null

  const isCorrect = chosen === question.correct

  return (
    <motion.div
      className="min-h-screen bg-[#0A0E1A] flex flex-col relative overflow-hidden"
      variants={pageVariants} initial="hidden" animate="show"
    >
      <div className="absolute pointer-events-none rounded-full"
        style={{ width: 500, height: 500, right: -100, top: -50,
          background: 'radial-gradient(circle, #6366F112 0%, transparent 100%)' }} />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-[#1E2A44]">
        <button onClick={() => navigate('/')} className="font-jakarta text-[13px] text-[#64748B] hover:text-[#F8FAFC] transition">
          ← Thoát
        </button>
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-fraunces text-[14px] font-semibold text-[#F8FAFC]">Ôn tập hôm nay</span>
          <span className="font-jakarta text-[11px] text-[#475569]">{index + 1} / {questions.length}</span>
        </div>
        <div className="w-20 h-1.5 rounded-full bg-[#1E2A44] overflow-hidden">
          <motion.div
            className="h-full bg-[#F2A20C] rounded-full"
            animate={{ width: `${((index + 1) / questions.length) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Body */}
      <div className="relative z-10 flex-1 max-w-2xl mx-auto w-full px-4 py-10 flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-[#1E2A44] text-[#F2A20C] font-jakarta text-[11px] font-semibold rounded-md">
            {TOPIC_LABELS[question.topic] ?? question.topic}
          </span>
          <span className="font-jakarta text-[11px] text-[#475569]">Spaced Repetition</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-5"
          >
            <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-6">
              <MathText className="font-jakarta text-[15px] text-[#F0F4FF] leading-relaxed">{question.question}</MathText>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {question.choices.map((choice, i) => {
                const isChosen = chosen === i
                const isCorrectChoice = i === question.correct
                let bg = '#0D1221', border = '#1E2A44', textColor = '#94A3B8'
                if (revealed) {
                  if (isCorrectChoice) { bg = '#0D2A1A'; border = '#10B981'; textColor = '#10B981' }
                  else if (isChosen) { bg = '#2A0F14'; border = '#EF4444'; textColor = '#FB7185' }
                } else if (isChosen) {
                  bg = '#1E2A44'; border = '#F2A20C'; textColor = '#F8FAFC'
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    disabled={revealed}
                    className="w-full text-left px-5 py-4 rounded-xl font-jakarta text-[14px] font-medium transition-all"
                    style={{ background: bg, border: `1px solid ${border}`, color: textColor }}
                  >
                    <span className="font-semibold mr-3">{String.fromCharCode(65 + i)}.</span>
                    <MathText>{choice}</MathText>
                  </button>
                )
              })}
            </div>

            {revealed && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl"
                  style={{ background: isCorrect ? '#0D2A1A' : '#2A0F14', border: `1px solid ${isCorrect ? '#10B981' : '#EF4444'}` }}>
                  <span className="text-xl">{isCorrect ? '✓' : '✗'}</span>
                  <span className="font-jakarta text-[14px] font-semibold" style={{ color: isCorrect ? '#10B981' : '#FB7185' }}>
                    {isCorrect
                      ? 'Chính xác!'
                      : `Đáp án đúng: ${String.fromCharCode(65 + question.correct)}. ${question.choices[question.correct]}`}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleNext(false)}
                    className="flex-1 py-3 rounded-xl font-jakarta text-[13px] font-semibold border border-[#1E2A44] text-[#94A3B8] hover:text-[#F8FAFC] transition"
                  >
                    Ôn lại sớm hơn
                  </button>
                  <button
                    onClick={() => handleNext(isCorrect)}
                    className="flex-1 py-3 rounded-xl font-jakarta text-[13px] font-bold text-[#0A0E1A] hover:opacity-90 transition"
                    style={{ background: isCorrect ? '#10B981' : '#F2A20C' }}
                  >
                    {isCorrect ? 'Tiếp theo →' : 'Đã hiểu →'}
                  </button>
                </div>
              </motion.div>
            )}

            {!revealed && (
              <p className="text-center font-jakarta text-[12px] text-[#2A3A50]">Chọn một đáp án để tiếp tục</p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

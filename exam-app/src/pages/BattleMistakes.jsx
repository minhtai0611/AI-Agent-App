import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useHistory } from '../context/HistoryContext'
import { useAuth } from '../context/AuthContext'
import { loadQuestions } from '../api/index.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { MathText } from '../components/MathText.jsx'
import { QuestionCardSkeleton } from '../components/Skeleton.jsx'

const LABELS = ['A', 'B', 'C', 'D']
const STREAK_TO_TAME = 3
const BATTLE_SIZE = 20

export default function BattleMistakes() {
  usePageTitle('Chiến đấu với lỗi sai')
  const navigate = useNavigate()
  const { results } = useHistory()
  const { user } = useAuth()

  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [streak, setStreak] = useState({})     // { [qId]: 0..STREAK_TO_TAME }
  const [tamed, setTamed] = useState({})        // { [qId]: true }
  const [current, setCurrent] = useState(0)
  const [chosen, setChosen] = useState(null)
  const [feedback, setFeedback] = useState(null) // 'correct' | 'wrong'
  const [done, setDone] = useState(false)
  const [credits, setCredits] = useState(0)

  useEffect(() => {
    loadQuestions().then(allQs => {
      const questionMap = {}
      for (const q of allQs) questionMap[q.id] = q

      // Collect wrong answers from history (deduplicated, most recent)
      const mistakeMap = {}
      for (const r of [...results].reverse()) {
        for (const [qId, ans] of Object.entries(r.answers ?? {})) {
          const q = questionMap[qId]
          if (q && ans !== q.correct) {
            mistakeMap[qId] = q
          }
        }
      }

      const battleQs = Object.values(mistakeMap).slice(0, BATTLE_SIZE)
      setQuestions(battleQs)
      setStreak(Object.fromEntries(battleQs.map(q => [q.id, 0])))
      setLoading(false)
    })
  }, [results])

  const question = questions[current]
  const tamedCount = Object.keys(tamed).length
  const total = questions.length
  const progress = total > 0 ? tamedCount / total : 0

  // Rotate to next untamed question
  function nextQuestion(after = current) {
    if (Object.keys(tamed).length >= total) { setDone(true); return }
    let idx = (after + 1) % total
    let safety = 0
    while (tamed[questions[idx]?.id] && safety < total) {
      idx = (idx + 1) % total
      safety++
    }
    setCurrent(idx)
    setChosen(null)
    setFeedback(null)
  }

  function handleAnswer(choiceIdx) {
    if (feedback) return
    setChosen(choiceIdx)
    const correct = choiceIdx === question.correct
    setFeedback(correct ? 'correct' : 'wrong')

    const qId = question.id
    if (correct) {
      const newStreak = (streak[qId] ?? 0) + 1
      if (newStreak >= STREAK_TO_TAME) {
        const newTamed = { ...tamed, [qId]: true }
        setTamed(newTamed)
        setStreak(s => ({ ...s, [qId]: STREAK_TO_TAME }))
        if (Object.keys(newTamed).length >= total) {
          setTimeout(() => setDone(true), 900)
          setCredits(2)
          return
        }
        setTimeout(() => nextQuestion(), 900)
      } else {
        setStreak(s => ({ ...s, [qId]: newStreak }))
        setTimeout(() => nextQuestion(), 900)
      }
    } else {
      setStreak(s => ({ ...s, [qId]: 0 }))
      setTimeout(() => nextQuestion(), 1100)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] px-4 py-10 max-w-2xl mx-auto w-full flex flex-col gap-4">
        <QuestionCardSkeleton />
      </div>
    )
  }

  // No mistakes
  if (total === 0) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center gap-5 text-center px-6">
        <span className="text-5xl">🎉</span>
        <h1 className="font-fraunces text-[24px] font-bold text-[#F8FAFC]">Không có câu sai nào!</h1>
        <p className="font-jakarta text-[14px] text-[#64748B]">Hãy làm thêm bài thi để bắt đầu chiến đấu.</p>
        <button onClick={() => navigate('/exams')}
          className="px-6 py-3 rounded-xl font-jakarta text-[13px] font-bold"
          style={{ background: '#F2A20C', color: '#0A0E1A' }}>
          Chọn đề thi
        </button>
      </div>
    )
  }

  // Completion screen
  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center gap-6 text-center px-6"
      >
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="text-6xl"
        >🏆</motion.div>
        <div className="flex flex-col gap-2">
          <h1 className="font-fraunces text-[28px] font-bold text-[#F8FAFC]">Xuất sắc!</h1>
          <p className="font-jakarta text-[14px] text-[#94A3B8]">
            Bạn đã thuần hóa <span className="text-[#F2A20C] font-bold">{tamedCount}/{total}</span> câu hỏi.
          </p>
          {credits > 0 && (
            <p className="font-jakarta text-[13px] text-amber-400">+{credits} Tia đã được cộng vào tài khoản! ⚡</p>
          )}
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={() => navigate('/mistakes')}
            className="w-full py-3 rounded-xl font-jakarta text-[13px] font-bold"
            style={{ background: '#F2A20C', color: '#0A0E1A' }}>
            Về sổ tay sai lầm
          </button>
          <button onClick={() => navigate('/exams')}
            className="w-full py-3 rounded-xl font-jakarta text-[13px] font-medium text-[#64748B] hover:text-[#94A3B8] transition">
            Chọn đề thi mới
          </button>
        </div>
      </motion.div>
    )
  }

  const qStreak = streak[question?.id] ?? 0

  return (
    <div className="min-h-screen bg-[#0A0E1A] pb-16">
      <div className="max-w-xl mx-auto px-4 pt-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/mistakes')}
            className="font-jakarta text-[13px] text-[#64748B] hover:text-[#94A3B8] transition">
            ← Quay lại
          </button>
        </div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-fraunces text-[22px] font-bold text-[#F8FAFC]">Chiến đấu 🔥</h1>
          <span className="font-jakarta text-[13px] text-[#64748B]">
            Đã thuần: <span className="text-[#F2A20C] font-bold">{tamedCount}/{total}</span>
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-[#111827] mb-6 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[#F2A20C]"
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {/* Streak indicator for current question */}
        {question && (
          <div className="flex items-center gap-2 mb-5">
            <span className="font-jakarta text-[12px] text-[#475569]">Chuỗi đúng:</span>
            <div className="flex gap-1.5">
              {Array.from({ length: STREAK_TO_TAME }).map((_, i) => (
                <div key={i}
                  className="w-5 h-5 rounded-full border transition"
                  style={{
                    background: i < qStreak ? '#F2A20C' : 'transparent',
                    borderColor: i < qStreak ? '#F2A20C' : '#1E2A44',
                  }}
                />
              ))}
            </div>
            {tamed[question.id] && (
              <span className="font-jakarta text-[12px] text-emerald-400 font-bold">✓ Đã thuần</span>
            )}
          </div>
        )}

        {/* Question card */}
        <AnimatePresence mode="wait">
          {question && (
            <motion.div
              key={question.id + current}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-6 flex flex-col gap-5"
            >
              <MathText className="font-jakarta text-[15px] text-[#F0F4FF] leading-relaxed">
                {question.question}
              </MathText>

              <div className="flex flex-col gap-2.5">
                {(question.choices ?? []).map((choice, i) => {
                  let bg = '#111827', border = '#1E2A44', text = '#94A3B8'
                  if (chosen !== null) {
                    if (i === question.correct) { bg = '#0A2A1A'; border = '#1A5A2A'; text = '#34D399' }
                    else if (i === chosen && chosen !== question.correct) { bg = '#2A0F14'; border = '#5A1A24'; text = '#FB7185' }
                  } else if (chosen === i) {
                    bg = '#111827'; border = '#F2A20C'; text = '#F0B429'
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => handleAnswer(i)}
                      disabled={feedback !== null}
                      className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 transition"
                      style={{ background: bg, border: `1.5px solid ${border}` }}
                    >
                      <span className="w-6 h-6 rounded-full flex items-center justify-center font-jakarta text-[11px] font-bold flex-shrink-0"
                        style={{ background: border, color: i === question.correct && chosen !== null ? '#0A2A1A' : text }}>
                        {LABELS[i]}
                      </span>
                      <MathText className="font-jakarta text-[13px] leading-snug" style={{ color: text }}>
                        {choice}
                      </MathText>
                    </button>
                  )
                })}
              </div>

              {feedback === 'wrong' && (
                <p className="font-jakarta text-[12px] text-[#FB7185]">
                  Sai rồi — chuỗi đúng về 0. Tiếp tục cố gắng!
                </p>
              )}
              {feedback === 'correct' && qStreak + 1 >= STREAK_TO_TAME && !tamed[question.id] && (
                <p className="font-jakarta text-[12px] text-emerald-400">✓ Đã thuần hóa câu này!</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Skip */}
        <button
          onClick={() => nextQuestion()}
          className="mt-4 font-jakarta text-[12px] text-[#475569] hover:text-[#64748B] transition"
        >
          Bỏ qua →
        </button>
      </div>
    </div>
  )
}

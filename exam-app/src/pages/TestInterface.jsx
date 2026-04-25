import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useExam, useExamDispatch, useHints } from '../context/ExamContext.jsx'
import QuestionCard from '../components/QuestionCard.jsx'
import Timer from '../components/Timer.jsx'

const TOPIC_LABELS = { algebra: 'Đại số', geometry: 'Hình học', statistics: 'Thống kê', combinatorics: 'Tổ hợp' }
const DIFF_LABELS = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' }

export default function TestInterface() {
  const navigate = useNavigate()
  const { examId } = useParams()
  const session = useExam()
  const dispatch = useExamDispatch()
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (session.status === 'idle' || !session.exam || session.exam.id !== examId) {
      navigate('/exams', { replace: true })
    }
  }, [session.status, session.exam, examId, navigate])

  useEffect(() => {
    if (session.mode !== 'timed' || session.status !== 'active') return
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000)
    return () => clearInterval(id)
  }, [session.mode, session.status, dispatch])

  useEffect(() => {
    if (session.status === 'timeout') {
      dispatch({ type: 'SUBMIT' })
      navigate('/results/current', { replace: true })
    }
  }, [session.status, dispatch, navigate])

  if (session.status === 'idle' || !session.exam) return null

  const { hints, setHint } = useHints()
  const { questions, answers, mode, timeLeft, exam } = session
  const question = questions[currentIndex]
  const chosen = answers[question?.id] ?? null
  const isLast = currentIndex === questions.length - 1
  const isPractice = mode === 'practice'
  const progress = ((currentIndex + 1) / questions.length) * 100

  function handleAnswer(choiceIndex) {
    dispatch({ type: 'ANSWER_QUESTION', questionId: question.id, choiceIndex })
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) setCurrentIndex(i => i + 1)
  }

  function handleSubmit() {
    dispatch({ type: 'SUBMIT' })
    navigate('/results/current', { replace: true })
  }

  const canProceed = isPractice ? chosen !== null : true

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute pointer-events-none rounded-full"
        style={{ width: 600, height: 600, right: -100, top: 100,
          background: 'radial-gradient(circle, #F2A20C18 0%, #F2A20C00 100%)' }} />
      <div className="absolute pointer-events-none rounded-full"
        style={{ width: 500, height: 500, left: -100, top: 300,
          background: 'radial-gradient(circle, #10B98112 0%, #10B98100 100%)' }} />

      {/* Accent line at top */}
      <div className="absolute top-0 left-0 right-0 h-0.5 pointer-events-none"
        style={{ background: 'linear-gradient(90deg, #F2A20C00 0%, #F2A20C 50%, #F2A20C00 100%)' }} />

      {/* NavBar */}
      <nav
        className="relative z-10 flex items-center justify-between px-8 border-b border-[#1E2A44]"
        style={{ height: 64, background: 'linear-gradient(180deg, #0F1628 0%, #0D1221 100%)' }}
      >
        <div className="flex items-center gap-2">
          <span className="font-fraunces font-semibold text-[#F8FAFC] text-[15px]">
            Câu {currentIndex + 1}
          </span>
          <span className="text-[#475569] text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
            / {questions.length}
          </span>
        </div>
        <span className="font-jakarta text-[#94A3B8] text-sm font-medium truncate max-w-xs">
          {exam?.title}
        </span>
        {mode === 'timed' && timeLeft !== null
          ? <Timer timeLeft={timeLeft} />
          : <div className="w-20" />
        }
      </nav>

      {/* Progress bar */}
      <div className="relative z-10 h-1 bg-[#1E2A44]">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #F2A20C 0%, #F59E0B 100%)' }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-4 py-10 flex flex-col gap-8">
        {/* Question badges */}
        <div className="flex items-center gap-2">
          {question?.topic && (
            <span className="px-2.5 py-1 bg-[#1E2A44] text-[#F2A20C] font-jakarta text-[11px] font-semibold rounded-md tracking-[0.5px]">
              {TOPIC_LABELS[question.topic] ?? question.topic}
            </span>
          )}
          <span className="px-2.5 py-1 bg-[#1B2540] border border-[#2A3A60] text-[#64748B] font-jakarta text-[11px] font-medium rounded-md">
            {DIFF_LABELS[question?.difficulty] ?? 'Trung bình'}
          </span>
        </div>

        {/* Question card */}
        {question && (
          <QuestionCard
            key={question.id}
            question={question}
            chosen={chosen}
            onAnswer={handleAnswer}
            practiceMode={isPractice}
            submitted={session.status === 'submitted'}
            hintState={hints[question.id]}
            onHint={setHint}
          />
        )}

        {/* Nav row */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#111827] border border-[#1E2A44] rounded-[10px] font-jakarta text-[13px] text-[#94A3B8] font-medium disabled:opacity-40 hover:bg-[#1E2A44] transition"
          >
            ← Câu trước
          </button>
          <div className="flex items-center gap-2.5">
            {!isLast && (
              <button
                onClick={handleNext}
                disabled={isPractice && !canProceed}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-[#1E2A44] rounded-[10px] font-jakarta text-[13px] text-[#F8FAFC] font-semibold disabled:opacity-40 hover:bg-[#2A3A5E] transition"
              >
                Tiếp theo →
              </button>
            )}
            {(isLast || !isPractice) && (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-[10px] font-jakarta text-[13px] text-[#0A0E1A] font-bold hover:opacity-90 transition"
                style={{ background: 'linear-gradient(180deg, #F2A20C 0%, #D97706 100%)' }}
              >
                Nộp bài
              </button>
            )}
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {questions.map((q, i) => {
            const answered = answers[q.id] !== undefined
            const isCurrent = i === currentIndex
            return (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className="rounded-[2px] h-1 transition-all"
                style={{
                  width: isCurrent ? 24 : 8,
                  background: isCurrent ? '#F2A20C' : answered ? '#10B981' : '#1E2A44',
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

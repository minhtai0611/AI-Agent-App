import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { loadQuestionsByIds } from '../api/index.js'
import { pageVariants } from '../utils/animations.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { TOPIC_LABELS } from '../utils/topicLabels.js'
import { MathText } from '../components/MathText.jsx'
import { QuestionCardSkeleton } from '../components/Skeleton.jsx'
import { migrateReviewItems, getDueReviewItems, answerReviewItem } from '../api/aiClient.js'

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

// FSRS v5 — parameters tuned on Anki open dataset
const FSRS_W = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61]

function fsrsNextInterval(stability, difficulty, elapsed, quality) {
  // quality: 1=Đoán(Again), 3=Khá(Good), 5=Chắc(Easy) → map to FSRS 1–4
  const q = quality <= 1 ? 1 : quality <= 3 ? 3 : 4
  const retrievability = Math.exp(Math.log(0.9) * elapsed / stability)
  let newStability
  if (q >= 3) {
    newStability = stability * (
      Math.exp(FSRS_W[8]) *
      (11 - difficulty) *
      Math.pow(stability, -FSRS_W[9]) *
      (Math.exp(FSRS_W[10] * (1 - retrievability)) - 1) + 1
    )
  } else {
    newStability = FSRS_W[11] *
      Math.pow(difficulty, -FSRS_W[12]) *
      (Math.pow(stability + 1, FSRS_W[13]) - 1) *
      Math.exp(FSRS_W[14] * (1 - retrievability))
  }
  newStability = Math.max(0.5, newStability)
  const interval = Math.max(1, Math.round(newStability * Math.log(0.9) / Math.log(0.9)))
  return { newStability, interval: Math.max(1, interval) }
}

// SM-2 → FSRS migration: convert old entries on first encounter
function migrateEntry(entry) {
  if (entry.stability !== undefined) return entry
  return {
    ...entry,
    stability: Math.max(1, entry.interval || 1),
    difficulty: Math.max(1, Math.min(10, 11 - (entry.easeFactor || 2.5) * 2)),
    elapsed: entry.interval || 1,
  }
}

function updateSM2(entry, quality) {
  // quality: 5=Chắc, 3=Khá, 1=Đoán (maps to FSRS scale)
  const migrated = migrateEntry(entry)
  const { stability = 1, difficulty = 5, elapsed = 1 } = migrated
  const { newStability, interval } = fsrsNextInterval(stability, difficulty, elapsed, quality)
  const q = quality <= 1 ? 1 : quality <= 3 ? 3 : 4
  const newDifficulty = Math.max(1, Math.min(10, difficulty + FSRS_W[6] * (3 - q)))
  return {
    ...migrated,
    stability: newStability,
    difficulty: newDifficulty,
    elapsed: interval,
    interval,
    dueDate: addDays(new Date(), interval),
  }
}

const STAGE_NAMES = ['', 'Mới tiếp cận', 'Đang học', 'Luyện tập', 'Vững', 'Thành thạo']

export default function ReviewSession() {
  usePageMeta('Ôn tập hôm nay', { noindex: true })
  const navigate = useNavigate()
  const { user } = useAuth()
  const uid = user?.id ?? null
  const isLoggedIn = Boolean(user?.id)
  const [questions, setQuestions] = useState([])
  const [serverItems, setServerItems] = useState([]) // [{id, question_id, ...}] for logged-in users
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [results, setResults] = useState([])
  const [done, setDone] = useState(false)
  const [stageLabel, setStageLabel] = useState(null)
  const [wrongStreak, setWrongStreak] = useState(0)
  const startTimeRef = useRef(null)

  useEffect(() => {
    async function load() {
      if (isLoggedIn) {
        // Migrate localStorage queue to server (idempotent — server uses INSERT OR IGNORE)
        const localQueue = getQueue(uid)
        const localEntries = Object.entries(localQueue)
        if (localEntries.length > 0) {
          const items = localEntries.map(([question_id, entry]) => {
            const migrated = migrateEntry(entry)
            return {
              question_id,
              stability: migrated.stability ?? 1.0,
              difficulty: migrated.difficulty ?? 5.0,
              elapsed: migrated.elapsed ?? 1,
              interval: migrated.interval ?? 1,
              next_review_date: migrated.dueDate ?? todayStr(),
            }
          })
          try {
            await migrateReviewItems(items)
            // Only clear localStorage after confirmed server 2xx
            localStorage.removeItem(QUEUE_KEY(uid))
          } catch { /* migration failed silently — localStorage preserved */ }
        }

        // Load due items from server
        try {
          const { data } = await getDueReviewItems()
          const items = data?.items ?? []
          setServerItems(items)
          const qIds = items.map(it => it.question_id)
          const loaded = await loadQuestionsByIds(qIds)
          setQuestions(loaded)
          if (loaded.length === 0) setDone(true)
        } catch {
          setDone(true)
        }
      } else {
        // Guest: localStorage only
        const queue = getQueue(uid)
        const today = todayStr()
        const dueIds = Object.entries(queue)
          .filter(([, entry]) => entry.dueDate <= today)
          .map(([id]) => id)
        const loaded = await loadQuestionsByIds(dueIds)
        setQuestions(loaded)
        if (loaded.length === 0) setDone(true)
      }
      setLoading(false)
    }
    load()
  }, [])

  const question = questions[index]

  function handleAnswer(choiceIdx) {
    if (revealed) return
    startTimeRef.current = startTimeRef.current ?? Date.now()
    setChosen(choiceIdx)
    setRevealed(true)
  }

  async function handleNext(quality) {
    const responseTimeSec = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current) / 1000)
      : null
    startTimeRef.current = null

    const markCorrect = typeof quality === 'number' ? quality >= 3 : Boolean(quality)
    setResults(r => [...r, markCorrect ? 'correct' : 'wrong'])
    setWrongStreak(s => markCorrect ? 0 : s + 1)

    if (isLoggedIn) {
      // Find the server review_item id for this question
      const serverItem = serverItems.find(it => it.question_id === question.id)
      if (serverItem) {
        try {
          const { data } = await answerReviewItem(serverItem.id, quality, responseTimeSec)
          if (data?.stage_advanced && data?.new_stage) {
            setStageLabel(STAGE_NAMES[data.new_stage] ?? 'Tiếp theo')
          }
        } catch { /* non-fatal — progress still advances */ }
      }
    } else {
      // Guest: update localStorage
      const queue = getQueue(uid)
      const entry = queue[question.id] ?? {}
      queue[question.id] = updateSM2(entry, quality)
      saveQueue(queue, uid)
    }

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
        variants={pageVariants} initial="hidden" animate="show" exit="exit"
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
            onClick={() => navigate('/exams')}
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
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
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
          <AnimatePresence mode="wait">
            {stageLabel && (
              <motion.span
                key={stageLabel}
                initial={{ opacity: 0, scale: 0.75 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.75 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                className="font-jakarta text-[11px] text-[#34D399]"
              >
                → {stageLabel}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-5"
          >
            {/* 3D flip card — front: question, back: answer on reveal */}
            <div style={{ perspective: '1000px', minHeight: 96 }}>
              <motion.div
                animate={{ rotateY: revealed ? 180 : 0 }}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{ transformStyle: 'preserve-3d', position: 'relative', minHeight: 96 }}
              >
                {/* Front */}
                <div
                  className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-6 absolute inset-0"
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                >
                  <MathText className="font-jakarta text-[15px] text-[#F0F4FF] leading-relaxed">{question.question}</MathText>
                </div>
                {/* Back */}
                <div
                  className="rounded-2xl p-6 absolute inset-0 flex flex-col gap-2"
                  style={{
                    backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    background: isCorrect ? '#0D2A1A' : '#1A0A10',
                    border: `1px solid ${isCorrect ? '#10B981' : '#EF4444'}`,
                  }}
                >
                  <span className="font-jakarta text-[13px] font-semibold" style={{ color: isCorrect ? '#10B981' : '#FB7185' }}>
                    {isCorrect ? '✓ Chính xác!' : '✗ Chưa đúng'}
                  </span>
                  <MathText className="font-jakarta text-[14px] text-[#F0F4FF] leading-relaxed">
                    {String.fromCharCode(65 + question.correct)}. {question.choices[question.correct]}
                  </MathText>
                </div>
              </motion.div>
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="flex flex-col gap-4">
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl"
                  style={{ background: isCorrect ? '#0D2A1A' : '#2A0F14', border: `1px solid ${isCorrect ? '#10B981' : '#EF4444'}` }}>
                  <span className="text-xl">{isCorrect ? '✓' : '✗'}</span>
                  <span className="font-jakarta text-[14px] font-semibold" style={{ color: isCorrect ? '#10B981' : '#FB7185' }}>
                    {isCorrect
                      ? 'Chính xác!'
                      : `Đáp án đúng: ${String.fromCharCode(65 + question.correct)}. ${question.choices[question.correct]}`}
                  </span>
                </div>

                {/* Struggle support — after 2 consecutive wrong */}
                {!isCorrect && wrongStreak >= 2 && (
                  <div className="px-4 py-3 rounded-xl border border-[#A78BFA33] bg-[#1A1429]">
                    <p className="font-jakarta text-[12px] text-[#A78BFA] leading-relaxed">
                      Bài này khó với nhiều học sinh. Hỏi Oracle để hiểu rõ hơn.
                    </p>
                  </div>
                )}

                {/* Oracle button — shown after reveal, especially useful on wrong answers */}
                <button
                  onClick={() => navigate(`/oracle?q=${encodeURIComponent(question.question)}`)}
                  className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#6366F133] bg-[#6366F108] font-jakarta text-[11px] font-semibold text-[#818CF8] hover:border-[#6366F166] hover:bg-[#6366F114] transition"
                >
                  <span className="text-[10px]">✦</span> Hỏi Oracle
                </button>

                <div className="flex flex-col gap-2">
                  <span className="font-jakarta text-[11px] text-[#475569] text-center">Mức độ tự tin:</span>
                  <div className="flex gap-2">
                    {[
                      { label: 'Đoán', quality: 1, color: '#FB7185' },
                      { label: 'Khá', quality: 3, color: '#F2A20C' },
                      { label: 'Chắc', quality: 5, color: '#34D399' },
                    ].map(({ label, quality, color }) => (
                      <button
                        key={label}
                        onClick={() => handleNext(quality)}
                        className="flex-1 py-2.5 rounded-xl font-jakarta text-[13px] font-semibold border transition"
                        style={{ borderColor: color + '55', color }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
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

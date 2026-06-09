import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { pageVariants } from '../utils/animations.js'
import AchievementCeremony from '../components/AchievementCeremony.jsx'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext.jsx'
import { loadQuestions } from '../api/index.js'
import { getDailyChallenge, submitDailyScore } from '../api/aiClient.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import Markdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

import { TOPIC_LABELS } from '../utils/topicLabels.js'

const STREAK_KEY = (uid) => `daily_challenge_streak-${uid ?? 'guest'}`
const RECOVERY_PATH_DATA_PREFIX   = (uid) => `recovery-path-data-${uid ?? 'guest'}-`
const RECOVERY_PATH_PROGRESS_KEY  = (uid, rid) => `recovery-path-progress-${uid ?? 'guest'}-${rid}`

function updateRecoveryCheckpoint(uid, questionTopic, isCorrect) {
  if (!questionTopic) return
  try {
    const prefix = RECOVERY_PATH_DATA_PREFIX(uid)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(prefix)) continue
      const resultId = key.slice(prefix.length)
      const plan = JSON.parse(localStorage.getItem(key) ?? '{}')
      if (!Array.isArray(plan.focus_areas)) continue
      const areaIndex = plan.focus_areas.findIndex(
        a => a.topic?.toLowerCase() === questionTopic?.toLowerCase()
      )
      if (areaIndex === -1) continue
      const progKey = RECOVERY_PATH_PROGRESS_KEY(uid, resultId)
      const prog = JSON.parse(localStorage.getItem(progKey) ?? '{}')
      const current = prog[areaIndex] ?? 0
      prog[areaIndex] = isCorrect ? current + 1 : 0
      localStorage.setItem(progKey, JSON.stringify(prog))
      break  // only update the first matching recovery path
    }
  } catch {}
}

function loadStreak(uid) {
  try { return JSON.parse(localStorage.getItem(STREAK_KEY(uid)) ?? '{}') }
  catch { return {} }
}

function saveStreak(s, uid) {
  try { localStorage.setItem(STREAK_KEY(uid), JSON.stringify(s)) } catch {}
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function computeStreak(streak) {
  const today = todayStr()
  const last = streak.lastCompletedDate
  if (!last) return { current: 0, longest: streak.longestStreak ?? 0, completedToday: false }
  if (last === today) return { current: streak.currentStreak ?? 0, longest: streak.longestStreak ?? 0, completedToday: true }
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (last === yesterday) return { current: streak.currentStreak ?? 0, longest: streak.longestStreak ?? 0, completedToday: false }
  return { current: 0, longest: streak.longestStreak ?? 0, completedToday: false }
}

function MdMath({ children }) {
  return (
    <Markdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}
      className="font-jakarta text-[13px] text-foreground leading-relaxed">
      {children}
    </Markdown>
  )
}

const LABELS = ['A', 'B', 'C', 'D']

function questionTitle(source, daysSinceWrong) {
  if (source === 'mistake_retry') {
    const daysText = daysSinceWrong === 1 ? 'hôm qua' : daysSinceWrong > 1 ? `${daysSinceWrong} ngày trước` : 'trước đây'
    return `Câu bạn sai ${daysText} — thử lại`
  }
  if (source === 'sr_due') return 'Câu này đến hạn ôn tập hôm nay'
  if (source === 'weak_topic') return 'Chủ đề yếu nhất của bạn'
  return 'Câu hỏi chờ bạn'
}

function completionMessage(isCorrect, source, pendingCount) {
  if (source === 'mistake_retry') {
    if (isCorrect) {
      return pendingCount > 0
        ? `Lần này bạn đúng. Còn ${pendingCount} câu khác đang chờ.`
        : 'Lần này bạn đúng. Câu này sẽ không quay lại sớm.'
    }
    return 'Vẫn chưa vào. Câu này sẽ quay lại ngày mai.'
  }
  if (isCorrect) return 'Thêm vào vốn của bạn.'
  return 'Câu này sẽ quay lại ngày mai.'
}

export default function DailyChallenge() {
  usePageMeta('Câu hỏi hôm nay', { noindex: true })
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const toast = useToast()

  const [question, setQuestion] = useState(null)
  const [source, setSource] = useState('new')
  const [daysSinceWrong, setDaysSinceWrong] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [provinceContext, setProvinceContext] = useState(null)
  const [loading, setLoading] = useState(true)

  const [chosen, setChosen] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [completionData, setCompletionData] = useState(null)

  const [streak, setStreak] = useState(() => computeStreak(loadStreak(user?.id)))

  // Load question
  useEffect(() => {
    async function load() {
      try {
        const { data } = await getDailyChallenge()
        if (data?.question_id) {
          const allQuestions = await loadQuestions()
          const q = allQuestions.find(q => q.id === data.question_id)
          if (q) {
            setQuestion(q)
            setSource(data.source ?? 'new')
            setDaysSinceWrong(data.days_since_wrong ?? null)
            setPendingCount(data.pending_count ?? 0)
            setProvinceContext(data.province_context ?? null)
            setLoading(false)
            return
          }
        }
      } catch { /* fall through to local pick */ }

      // Fallback: deterministic local pick
      const allQuestions = await loadQuestions()
      if (allQuestions.length) {
        const seed = (user?.id ?? 'guest') + todayStr()
        let h = 0
        for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
        setQuestion(allQuestions[h % allQuestions.length])
      }
      setLoading(false)
    }
    load()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAnswer(idx) {
    if (chosen !== null || !question) return
    setChosen(idx)
    const isCorrect = idx === question.correct
    const uid = user?.id
    updateRecoveryCheckpoint(uid, question.topic, isCorrect)

    // Streak always continues on showing up — correct or wrong
    const raw = loadStreak(uid)
    const today = todayStr()
    if (raw.lastCompletedDate !== today) {
      const computed = computeStreak(raw)
      const newCurrent = computed.current + 1
      const newLongest = Math.max(newCurrent, computed.longest)
      saveStreak({ currentStreak: newCurrent, longestStreak: newLongest, lastCompletedDate: today }, uid)
      setStreak({ current: newCurrent, longest: newLongest, completedToday: true })
    }

    // Submit to backend
    if (user && question) {
      try {
        const { data } = await submitDailyScore({ question_id: question.id, correct: isCorrect })
        if (data?.tia_earned > 0) refreshUser?.()
        if (data?.streak && data.streak > 0) {
          const milestones = { 7: 'Tuần đầu tiên', 14: 'Người học đều', 30: 'Thói quen học', 60: 'Cam kết học tập' }
          if (milestones[data.streak]) {
            toast.success(`${milestones[data.streak]} — ${data.streak} ngày liên tiếp!`)
          }
        }
        setPendingCount(data?.pending_count ?? pendingCount)
        setCompletionData(data)
      } catch { /* non-fatal */ }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <p className="font-jakarta text-[14px] text-dim text-center">Không tìm thấy câu hỏi hôm nay.</p>
      </div>
    )
  }

  const isCorrect = chosen !== null && chosen === question.correct
  const title = questionTitle(source, daysSinceWrong)
  const message = chosen !== null ? completionMessage(isCorrect, source, pendingCount) : null

  // After-gap message: compute days absent from streak data
  const gapMessage = (() => {
    if (streak.current !== 0) return null
    const raw = loadStreak(user?.id)
    if (!raw.lastCompletedDate) return null
    const last = new Date(raw.lastCompletedDate)
    const today = new Date(todayStr())
    const diffDays = Math.round((today - last) / 86400000)
    if (diffDays < 2) return null
    return `Bạn vắng ${diffDays} ngày. Chuỗi đã dừng lại nhưng câu hỏi của bạn vẫn đang chờ.`
  })()

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit"
      className="min-h-screen bg-surface pb-16">
      <div className="max-w-xl mx-auto px-4 pt-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate(-1)} className="font-jakarta text-[13px] text-dim hover:text-[#94A3B8] transition">
            ← Quay lại
          </button>
          <div className="flex items-center gap-3">
            {streak.current > 0 && (
              <AchievementCeremony trigger={streak.completedToday}>
                <span className="font-jakarta text-[13px] font-semibold text-amber-400">🔥 {streak.current} ngày</span>
              </AchievementCeremony>
            )}
          </div>
        </div>
        {gapMessage && (
          <p className="font-jakarta text-[13px] text-dim mb-4">{gapMessage}</p>
        )}

        <div className="flex flex-col gap-2 mb-6">
          <span className="font-jakarta text-[11px] font-bold tracking-[2px] uppercase text-amber-400">
            {TOPIC_LABELS[question.topic] ?? question.topic}
          </span>
          <h1 className="font-fraunces text-[20px] font-bold text-[#F8FAFC] leading-snug">{title}</h1>
          {provinceContext && (
            <p className="font-jakarta text-[12px] text-info">📌 {provinceContext}</p>
          )}
        </div>

        <div className="bg-[#0D1521] border border-surface rounded-2xl p-6 flex flex-col gap-5">
          <MdMath>{question.question}</MdMath>

          <div className="flex flex-col gap-2.5">
            {question.choices.map((choice, i) => {
              let style = 'border-surface bg-[#111827] text-[#94A3B8]'
              if (chosen !== null) {
                if (i === question.correct) style = 'border-success/40 glass-base text-success'
                else if (i === chosen && !isCorrect) style = 'border-destructive/40 bg-destructive/10 text-destructive'
                else style = 'border-surface bg-[#111827] text-dim'
              }
              return (
                <button key={i} disabled={chosen !== null} onClick={() => handleAnswer(i)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition text-left ${style} ${chosen === null ? 'hover:border-[#F2A20C] hover:text-[#F0F4FF]' : ''}`}>
                  <span className="w-6 h-6 rounded-full bg-[#1E2A44] flex items-center justify-center font-jakarta text-[11px] font-bold flex-shrink-0">{LABELS[i]}</span>
                  <MdMath>{choice}</MdMath>
                </button>
              )
            })}
          </div>

          {chosen !== null && (
            <div className={`rounded-xl px-4 py-3 ${isCorrect ? 'glass-base border border-success/20' : 'glass-base border border-primary/20'}`}>
              <p className={`font-jakarta text-[13px] font-semibold ${isCorrect ? 'text-success' : 'text-primary'}`}>
                {isCorrect ? 'Đúng rồi.' : 'Chưa đúng.'}
              </p>
              {message && (
                <p className="font-jakarta text-[12px] text-dim mt-1">{message}</p>
              )}
              {streak.current >= 5 && (
                <p className="font-jakarta text-[12px] text-dim mt-1">
                  Chuỗi {streak.current} ngày của bạn — đừng để đứt.
                </p>
              )}
            </div>
          )}

          {question.explanation && chosen !== null && (
            <div className="flex flex-col gap-2 pt-2 border-t border-surface">
              <span className="font-jakarta text-[11px] font-semibold text-dim uppercase tracking-wider">Giải thích</span>
              <MdMath>{question.explanation}</MdMath>
            </div>
          )}
        </div>

        {chosen !== null && (
          <div className="flex gap-3 mt-6">
            <button onClick={() => navigate('/mistakes')}
              className="flex-1 py-3 rounded-xl font-jakarta text-[13px] font-semibold border border-surface text-[#94A3B8] hover:text-[#F8FAFC] transition">
              Sổ sai lầm
            </button>
            <button onClick={() => navigate('/exams')}
              className="flex-1 py-3 rounded-xl font-jakarta text-[13px] font-bold text-[#0A0E1A] bg-primary">
              Làm đề thi →
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loadQuestions } from '../api/index.js'
import { getDailyChallenge, submitDailyScore, getDailyChallengeLeaderboard } from '../api/aiClient.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import Markdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

import { TOPIC_LABELS } from '../utils/topicLabels.js'

const STREAK_KEY = (uid) => `daily_challenge_streak-${uid ?? 'guest'}`

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

// Client-side fallback: deterministic daily pick when backend unavailable
function pickDailyQuestion(questions, userId) {
  const TOPICS = ['algebra', 'geometry', 'statistics', 'combinatorics']
  const filtered = questions.filter(q => TOPICS.includes(q.topic))
  if (!filtered.length) return null
  const seed = (userId || 'guest') + todayStr()
  let hash = 0
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return filtered[hash % filtered.length]
}

function MdMath({ children }) {
  return (
    <Markdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}
      className="font-jakarta text-[13px] text-[#CBD5E1] leading-relaxed">
      {children}
    </Markdown>
  )
}

const LABELS = ['A', 'B', 'C', 'D']

export default function DailyChallenge() {
  usePageTitle('Thử thách hôm nay')
  const navigate = useNavigate()
  const { user } = useAuth()
  const [questions, setQuestions] = useState([]) // multi-question backend mode
  const [question, setQuestion] = useState(null)  // single fallback question
  const [qIndex, setQIndex] = useState(0)
  const [chosen, setChosen] = useState(null)
  const [answering, setAnswering] = useState(false)
  const [explanation, setExplanation] = useState(null)
  const [streak, setStreak] = useState(() => computeStreak(loadStreak(user?.id)))
  const [answers, setAnswers] = useState({}) // questionId → choiceIndex for server scoring
  const [startTime] = useState(() => Date.now())
  const [submitted, setSubmitted] = useState(false)
  const [leaderboard, setLeaderboard] = useState([])
  const [serverMode, setServerMode] = useState(false) // true = using backend questions

  // Load question(s)
  useEffect(() => {
    async function load() {
      // Try backend first (authenticated users)
      if (user) {
        const { data } = await getDailyChallenge()
        if (data?.questions?.length) {
          setQuestions(data.questions)
          setServerMode(true)
          return
        }
      }
      // Fallback: client-side single question
      const qs = await loadQuestions()
      setQuestion(pickDailyQuestion(qs, user?.id))
    }
    load()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch leaderboard after submitting
  useEffect(() => {
    if (!submitted || !user) return
    getDailyChallengeLeaderboard().then(({ data }) => {
      if (data?.leaderboard) setLeaderboard(data.leaderboard)
    })
  }, [submitted, user])

  const currentQ = serverMode ? questions[qIndex] : question
  const isLastQ = serverMode ? qIndex >= questions.length - 1 : true

  async function handleAnswer(idx) {
    if (chosen !== null || answering || !currentQ) return
    setAnswering(true)
    setChosen(idx)
    const correct = idx === currentQ.correct
    const uid = user?.id

    // Record answer for server scoring
    if (serverMode) {
      setAnswers(prev => ({ ...prev, [currentQ.id]: idx }))
    }

    // Update streak locally
    const raw = loadStreak(uid)
    const today = todayStr()
    if (raw.lastCompletedDate !== today) {
      const computed = computeStreak(raw)
      const newCurrent = correct ? computed.current + 1 : 0
      const newLongest = Math.max(newCurrent, computed.longest)
      saveStreak({ currentStreak: newCurrent, longestStreak: newLongest, lastCompletedDate: today }, uid)
      setStreak({ current: newCurrent, longest: newLongest, completedToday: true })
    }

    setExplanation(currentQ.explanation || null)
    setAnswering(false)
  }

  async function handleNext() {
    if (isLastQ) {
      // Submit to server for scoring + 1 Tia grant
      if (serverMode && user && !submitted) {
        const timeSeconds = Math.round((Date.now() - startTime) / 1000)
        await submitDailyScore(answers, timeSeconds)
      }
      setSubmitted(true)
    } else {
      setQIndex(i => i + 1)
      setChosen(null)
      setExplanation(null)
    }
  }

  if (!currentQ && !submitted) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] pb-16">
        <div className="max-w-xl mx-auto px-4 pt-20 flex flex-col gap-6">
          <button onClick={() => navigate(-1)} className="font-jakarta text-[13px] text-[#64748B] hover:text-[#94A3B8] transition self-start">
            ← Quay lại
          </button>
          <div className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-6 flex flex-col gap-4 text-center">
            <span className="text-3xl">{streak.current > 0 ? '🔥' : '📅'}</span>
            <h2 className="font-fraunces text-[22px] font-bold text-[#F8FAFC]">Hoàn thành!</h2>
            {streak.current > 0 && (
              <p className="font-jakarta text-[14px] text-amber-400 font-semibold">Chuỗi {streak.current} ngày liên tiếp 🔥</p>
            )}
            {serverMode && <p className="font-jakarta text-[12px] text-[#34D399]">+1 Tia đã được cộng vào tài khoản ✓</p>}
          </div>

          {leaderboard.length > 0 && (
            <div className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-5 flex flex-col gap-3">
              <span className="font-jakarta text-[11px] font-bold text-[#F2A20C] uppercase tracking-wider">Bảng xếp hạng hôm nay</span>
              {leaderboard.map((entry, i) => (
                <div key={entry.user_id} className={`flex items-center justify-between px-3 py-2 rounded-xl ${entry.user_id === user?.id ? 'bg-[#F2A20C]/10 border border-[#F2A20C]/30' : 'bg-[#111827]'}`}>
                  <div className="flex items-center gap-3">
                    <span className="font-jakarta text-[12px] text-[#475569] w-5 text-center">{i + 1}</span>
                    <span className="font-jakarta text-[13px] text-[#94A3B8]">{entry.display_name || 'Ẩn danh'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-jakarta text-[12px] font-bold text-[#F8FAFC]">{entry.score}/{entry.total}</span>
                    <span className="font-jakarta text-[11px] text-[#475569]">{entry.time_seconds}s</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => navigate('/exams')}
              className="flex-1 py-3 rounded-xl font-jakarta text-[13px] font-semibold border border-[#1E2A44] text-[#94A3B8] hover:text-[#F8FAFC] transition">
              Làm đề thi
            </button>
            <button onClick={() => navigate('/mistakes')}
              className="flex-1 py-3 rounded-xl font-jakarta text-[13px] font-bold text-[#0A0E1A]"
              style={{ background: '#F2A20C' }}>
              Sổ tay sai lầm
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isCorrect = chosen !== null && chosen === currentQ.correct

  return (
    <div className="min-h-screen bg-[#0A0E1A] pb-16">
      <div className="max-w-xl mx-auto px-4 pt-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate(-1)} className="font-jakarta text-[13px] text-[#64748B] hover:text-[#94A3B8] transition">
            ← Quay lại
          </button>
          <div className="flex items-center gap-3">
            {streak.current > 0 ? (
              <span className="font-jakarta text-[13px] font-semibold text-amber-400">🔥 {streak.current} ngày</span>
            ) : streak.longest > 0 ? (
              <span className="font-jakarta text-[12px] text-[#FB7185]">Chuỗi bị gián đoạn. Hôm nay bắt đầu lại 🔥</span>
            ) : null}
            <span className="font-jakarta text-[12px] text-[#475569]">Kỷ lục: {streak.longest}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center gap-2">
            <span className="font-jakarta text-[11px] font-bold tracking-[2px] uppercase text-amber-400">Thử thách hôm nay</span>
            <span className="font-jakarta text-[11px] text-[#475569]">·</span>
            <span className="font-jakarta text-[11px] text-[#64748B]">{TOPIC_LABELS[currentQ.topic] ?? currentQ.topic}</span>
            {serverMode && (
              <span className="font-jakarta text-[11px] text-[#475569]">· Câu {qIndex + 1}/{questions.length}</span>
            )}
          </div>
          <h1 className="font-fraunces text-[22px] font-bold text-[#F8FAFC]">Câu hỏi ngày {todayStr()}</h1>
        </div>

        <div className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-6 flex flex-col gap-5">
          <MdMath>{currentQ.question}</MdMath>

          <div className="flex flex-col gap-2.5">
            {currentQ.choices.map((choice, i) => {
              let style = 'border-[#1E2A44] bg-[#111827] text-[#94A3B8]'
              if (chosen !== null) {
                if (i === currentQ.correct) style = 'border-[#10B981] bg-[#0A1F14] text-[#6EE7B7]'
                else if (i === chosen) style = 'border-[#FB7185] bg-[#1F0A0E] text-[#FB7185]'
                else style = 'border-[#1E2A44] bg-[#111827] text-[#475569]'
              }
              return (
                <button key={i} disabled={chosen !== null || answering} onClick={() => handleAnswer(i)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition text-left ${style} ${chosen === null ? 'hover:border-[#F2A20C] hover:text-[#F0F4FF]' : ''}`}>
                  <span className="w-6 h-6 rounded-full bg-[#1E2A44] flex items-center justify-center font-jakarta text-[11px] font-bold flex-shrink-0">{LABELS[i]}</span>
                  <MdMath>{choice}</MdMath>
                </button>
              )
            })}
          </div>

          {chosen !== null && (
            <div className={`rounded-xl px-4 py-3 ${isCorrect ? 'bg-[#0A1F14] border border-[#2D4A1A]' : 'bg-[#1F0A0E] border border-[#5A1A24]'}`}>
              <span className={`font-jakarta text-[13px] font-semibold ${isCorrect ? 'text-[#34D399]' : 'text-[#FB7185]'}`}>
                {isCorrect ? '🎉 Chính xác!' : '❌ Chưa đúng'}
              </span>
              {isCorrect && streak.current > 0 && (
                <span className="ml-2 font-jakarta text-[12px] text-amber-400">🔥 Chuỗi {streak.current} ngày!</span>
              )}
            </div>
          )}

          {explanation && (
            <div className="flex flex-col gap-2 pt-2 border-t border-[#1E2A44]">
              <span className="font-jakarta text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Giải thích</span>
              <MdMath>{explanation}</MdMath>
            </div>
          )}

          {chosen !== null && serverMode && (
            <button onClick={handleNext}
              className="py-3 rounded-xl font-jakarta text-[13px] font-bold text-[#0A0E1A] hover:opacity-90 transition"
              style={{ background: '#F2A20C' }}>
              {isLastQ ? 'Xem kết quả →' : 'Câu tiếp theo →'}
            </button>
          )}
        </div>

        {!serverMode && (
          <div className="mt-6 flex gap-3">
            <button onClick={() => navigate('/exams')}
              className="flex-1 py-3 rounded-xl font-jakarta text-[13px] font-semibold border border-[#1E2A44] text-[#94A3B8] hover:text-[#F8FAFC] transition">
              Làm đề thi
            </button>
            <button onClick={() => navigate('/mistakes')}
              className="flex-1 py-3 rounded-xl font-jakarta text-[13px] font-bold text-[#0A0E1A]"
              style={{ background: '#F2A20C' }}>
              Sổ tay sai lầm
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

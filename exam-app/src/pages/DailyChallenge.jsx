import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHistory } from '../context/HistoryContext'
import { useAuth } from '../context/AuthContext'
import { loadQuestions } from '../api/index.js'
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
  // Yesterday?
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (last === yesterday) return { current: streak.currentStreak ?? 0, longest: streak.longestStreak ?? 0, completedToday: false }
  // Streak broken
  return { current: 0, longest: streak.longestStreak ?? 0, completedToday: false }
}

function pickDailyQuestion(questions, userId) {
  const TOPICS = ['algebra', 'geometry', 'statistics', 'combinatorics']
  const filtered = questions.filter(q => TOPICS.includes(q.topic))
  if (!filtered.length) return null
  const today = todayStr()
  const seed = (userId || 'guest') + today
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
  const [question, setQuestion] = useState(null)
  const [chosen, setChosen] = useState(null)
  const [answering, setAnswering] = useState(false)
  const [explanation, setExplanation] = useState(null)
  const [streak, setStreak] = useState(() => computeStreak(loadStreak(user?.id)))

  useEffect(() => {
    loadQuestions().then(qs => {
      const q = pickDailyQuestion(qs, user?.id)
      setQuestion(q)
    })
  }, [user?.id])

  async function handleAnswer(idx) {
    if (chosen !== null || answering) return
    setAnswering(true)
    setChosen(idx)
    const correct = idx === question.correct
    const uid = user?.id
    // Update streak
    const raw = loadStreak(uid)
    const today = todayStr()
    if (raw.lastCompletedDate !== today) {
      const computed = computeStreak(raw)
      const newCurrent = correct ? computed.current + 1 : 0
      const newLongest = Math.max(newCurrent, computed.longest)
      const updated = { currentStreak: newCurrent, longestStreak: newLongest, lastCompletedDate: today }
      saveStreak(updated, uid)
      setStreak({ current: newCurrent, longest: newLongest, completedToday: true })
    }
    setAnswering(false)
    setExplanation(question.explanation || null)
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isCorrect = chosen !== null && chosen === question.correct

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
              <span className="font-jakarta text-[13px] font-semibold text-amber-400">
                🔥 {streak.current} ngày
              </span>
            ) : streak.longest > 0 ? (
              <span className="font-jakarta text-[12px] text-[#FB7185]">
                Chuỗi bị gián đoạt. Hôm nay là cơ hội để bắt đầu lại 🔥
              </span>
            ) : null}
            <span className="font-jakarta text-[12px] text-[#475569]">
              Kỷ lục: {streak.longest}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center gap-2">
            <span className="font-jakarta text-[11px] font-bold tracking-[2px] uppercase text-amber-400">Thử thách hôm nay</span>
            <span className="font-jakarta text-[11px] text-[#475569]">·</span>
            <span className="font-jakarta text-[11px] text-[#64748B]">{TOPIC_LABELS[question.topic] ?? question.topic}</span>
          </div>
          <h1 className="font-fraunces text-[22px] font-bold text-[#F8FAFC]">Câu hỏi ngày {todayStr()}</h1>
        </div>

        {/* Question */}
        <div className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-6 flex flex-col gap-5">
          <MdMath>{question.question}</MdMath>

          <div className="flex flex-col gap-2.5">
            {question.choices.map((choice, i) => {
              let style = 'border-[#1E2A44] bg-[#111827] text-[#94A3B8]'
              if (chosen !== null) {
                if (i === question.correct) style = 'border-[#10B981] bg-[#0A1F14] text-[#6EE7B7]'
                else if (i === chosen) style = 'border-[#FB7185] bg-[#1F0A0E] text-[#FB7185]'
                else style = 'border-[#1E2A44] bg-[#111827] text-[#475569]'
              }
              return (
                <button
                  key={i}
                  disabled={chosen !== null || answering}
                  onClick={() => handleAnswer(i)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition text-left ${style} ${chosen === null ? 'hover:border-[#F2A20C] hover:text-[#F0F4FF]' : ''}`}
                >
                  <span className="w-6 h-6 rounded-full bg-[#1E2A44] flex items-center justify-center font-jakarta text-[11px] font-bold flex-shrink-0">{LABELS[i]}</span>
                  <MdMath>{choice}</MdMath>
                </button>
              )
            })}
          </div>

          {/* Result */}
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

          {/* Explanation */}
          {explanation && (
            <div className="flex flex-col gap-2 pt-2 border-t border-[#1E2A44]">
              <span className="font-jakarta text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Giải thích</span>
              <MdMath>{explanation}</MdMath>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => navigate('/exams')}
            className="flex-1 py-3 rounded-xl font-jakarta text-[13px] font-semibold border border-[#1E2A44] text-[#94A3B8] hover:text-[#F8FAFC] transition"
          >
            Làm đề thi
          </button>
          <button
            onClick={() => navigate('/mistakes')}
            className="flex-1 py-3 rounded-xl font-jakarta text-[13px] font-bold text-[#0A0E1A]"
            style={{ background: '#F2A20C' }}
          >
            Sổ tay sai lầm
          </button>
        </div>
      </div>
    </div>
  )
}

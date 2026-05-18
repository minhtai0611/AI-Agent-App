import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadQuestions } from '../api/index.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { TOPIC_LABELS } from '../utils/topicLabels.js'
import Markdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

const SURVIVAL_SCORES_KEY = 'survival_scores'
const MAX_LIVES = 3
const BASE_TIME = 15
const MIN_TIME = 8
const MULTIPLIER_STREAK = 5
const LABELS = ['A', 'B', 'C', 'D']

function MdMath({ children }) {
  return (
    <Markdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      className="font-jakarta text-[13px] text-[#CBD5E1] leading-relaxed"
    >
      {children}
    </Markdown>
  )
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function loadScores() {
  try { return JSON.parse(localStorage.getItem(SURVIVAL_SCORES_KEY) ?? '[]') }
  catch { return [] }
}

function saveScore(entry) {
  try {
    const scores = loadScores()
    scores.push(entry)
    scores.sort((a, b) => b.score - a.score)
    localStorage.setItem(SURVIVAL_SCORES_KEY, JSON.stringify(scores.slice(0, 5)))
  } catch {}
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return iso }
}

function getTimeLimit(streak) {
  // Every 5-streak milestone reduces limit by 1s (min 8s)
  const reduction = Math.floor(streak / MULTIPLIER_STREAK)
  return Math.max(MIN_TIME, BASE_TIME - reduction)
}

function getMultiplier(streak) {
  return streak >= MULTIPLIER_STREAK ? 2 : 1
}

export default function StreakSurvival() {
  usePageTitle('Streak Survival')
  const navigate = useNavigate()

  const [allQuestions, setAllQuestions] = useState([])
  const [loading, setLoading] = useState(true)

  // Game state
  const [deck, setDeck] = useState([])
  const [deckIndex, setDeckIndex] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [streak, setStreak] = useState(0)
  const [peakStreak, setPeakStreak] = useState(0)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [leaderboard, setLeaderboard] = useState([])

  // Per-question state
  const [timeLeft, setTimeLeft] = useState(BASE_TIME)
  const [chosen, setChosen] = useState(null)   // null | idx | -1 (timeout)
  const [flash, setFlash] = useState(null)     // null | 'correct' | 'wrong'

  const timerRef = useRef(null)
  const advanceRef = useRef(null)

  useEffect(() => {
    loadQuestions().then(qs => {
      setAllQuestions(qs)
      setLoading(false)
    })
  }, [])

  const startGame = useCallback((qs) => {
    const d = shuffle(qs)
    setDeck(d)
    setDeckIndex(0)
    setLives(MAX_LIVES)
    setStreak(0)
    setPeakStreak(0)
    setScore(0)
    setDone(false)
    setChosen(null)
    setFlash(null)
    setTimeLeft(BASE_TIME)
    setLeaderboard([])
  }, [])

  useEffect(() => {
    if (!loading && allQuestions.length > 0) {
      startGame(allQuestions)
    }
  }, [loading, allQuestions, startGame])

  // Advance to next question after feedback delay
  const advance = useCallback((isCorrect, currentLives, currentStreak, currentPeakStreak, currentScore, currentDeckIndex, currentDeck) => {
    clearInterval(timerRef.current)
    clearTimeout(advanceRef.current)

    let newLives = currentLives
    let newStreak = currentStreak
    let newScore = currentScore
    let newPeak = currentPeakStreak

    if (isCorrect) {
      newStreak = currentStreak + 1
      newPeak = Math.max(newStreak, currentPeakStreak)
      const multiplier = getMultiplier(newStreak - 1) // multiplier active before this answer
      newScore = currentScore + multiplier
    } else {
      newLives = currentLives - 1
      newStreak = 0
    }

    setStreak(newStreak)
    setPeakStreak(newPeak)
    setScore(newScore)
    setLives(newLives)

    if (newLives <= 0) {
      // Game over
      const entry = { score: newScore, peakStreak: newPeak, date: new Date().toISOString() }
      saveScore(entry)
      setLeaderboard(loadScores())
      setDone(true)
      return
    }

    const nextDeckIndex = currentDeckIndex + 1
    const nextTimeLimit = getTimeLimit(newStreak)

    advanceRef.current = setTimeout(() => {
      if (nextDeckIndex >= currentDeck.length) {
        // Reshuffled deck — restart deck
        setDeck(d => shuffle([...d]))
        setDeckIndex(0)
      } else {
        setDeckIndex(nextDeckIndex)
      }
      setChosen(null)
      setFlash(null)
      setTimeLeft(nextTimeLimit)
    }, isCorrect ? 700 : 1500)
  }, [])

  // Timer
  useEffect(() => {
    if (done || loading || deck.length === 0 || chosen !== null) return

    const limit = getTimeLimit(streak)
    setTimeLeft(limit)

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          setFlash('wrong')
          setChosen(-1)
          advance(false, lives, streak, peakStreak, score, deckIndex, deck)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timerRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckIndex, done, loading, deck.length])

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      clearTimeout(advanceRef.current)
    }
  }, [])

  function handleAnswer(idx) {
    if (chosen !== null || done) return
    clearInterval(timerRef.current)
    const q = deck[deckIndex]
    const isCorrect = idx === q.correct
    setChosen(idx)
    setFlash(isCorrect ? 'correct' : 'wrong')
    advance(isCorrect, lives, streak, peakStreak, score, deckIndex, deck)
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F2A20C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Game over screen ──────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] pb-16">
        <div className="max-w-xl mx-auto px-4 pt-16">
          <button
            onClick={() => navigate(-1)}
            className="font-jakarta text-[13px] text-[#64748B] hover:text-[#94A3B8] transition mb-8 block"
          >
            ← Quay lại
          </button>

          <div className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-6 flex flex-col gap-6">
            <div className="text-center">
              <p className="font-jakarta text-[11px] font-bold tracking-[2px] uppercase text-[#FB7185] mb-2">Game Over</p>
              <p className="font-fraunces text-6xl font-bold text-[#F8FAFC]">{score}</p>
              <p className="font-jakarta text-[13px] text-[#64748B] mt-1">điểm</p>
            </div>

            <div className="flex items-center justify-center gap-10 py-4 border-y border-[#1E2A44]">
              <div className="text-center">
                <p className="font-fraunces text-3xl font-bold text-[#F2A20C]">{peakStreak}</p>
                <p className="font-jakarta text-[11px] text-[#64748B]">chuỗi cao nhất</p>
              </div>
              <div className="text-center">
                <p className="font-fraunces text-3xl font-bold text-[#F8FAFC]">{score}</p>
                <p className="font-jakarta text-[11px] text-[#64748B]">câu đúng</p>
              </div>
            </div>

            {/* Leaderboard */}
            {leaderboard.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-jakarta text-[11px] font-semibold text-[#475569] uppercase tracking-wider">
                  Bảng xếp hạng{' '}
                  <span className="normal-case font-normal text-[#475569]">(Điểm chỉ lưu trên thiết bị này)</span>
                </p>
                <div className="flex flex-col gap-1">
                  {leaderboard.map((entry, i) => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${i === 0 ? 'bg-[#1A1608] border border-[#F2A20C]/30' : 'bg-[#111827]'}`}>
                      <span className={`font-jakarta text-[12px] font-bold w-5 ${i === 0 ? 'text-[#F2A20C]' : 'text-[#475569]'}`}>{i + 1}</span>
                      <span className="font-jakarta text-[12px] text-[#F8FAFC] font-semibold">{entry.score} điểm</span>
                      <span className="font-jakarta text-[11px] text-[#64748B]">🔥 {entry.peakStreak} chuỗi</span>
                      <span className="font-jakarta text-[11px] text-[#475569] ml-auto">{formatDate(entry.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => startGame(allQuestions)}
                className="flex-1 py-3 rounded-xl font-jakarta text-[13px] font-bold text-[#0A0E1A]"
                style={{ background: '#F2A20C' }}
              >
                Chơi lại
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex-1 py-3 rounded-xl font-jakarta text-[13px] font-semibold border border-[#1E2A44] text-[#94A3B8] hover:text-[#F8FAFC] transition"
              >
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Game screen ───────────────────────────────────────────────────────────
  if (deck.length === 0) return null

  const q = deck[deckIndex]
  const timeLimit = getTimeLimit(streak)
  const progress = (timeLeft / timeLimit) * 100
  const multiplier = getMultiplier(streak)

  let cardBorder = 'border-[#1E2A44]'
  if (flash === 'correct') cardBorder = 'border-[#10B981]'
  if (flash === 'wrong') cardBorder = 'border-[#FB7185]'

  let cardBg = 'bg-[#0D1521]'
  if (flash === 'correct') cardBg = 'bg-[#071A10]'
  if (flash === 'wrong') cardBg = 'bg-[#1A070A]'

  return (
    <div className="min-h-screen bg-[#0A0E1A] pb-16">
      <div className="max-w-xl mx-auto px-4 pt-16">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
            className="font-jakarta text-[13px] text-[#64748B] hover:text-[#94A3B8] transition"
          >
            ← Quay lại
          </button>

          {/* Lives */}
          <div className="flex items-center gap-1">
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <span key={i} className={`text-base transition-all ${i < lives ? 'opacity-100' : 'opacity-20 grayscale'}`}>
                ❤️
              </span>
            ))}
          </div>
        </div>

        {/* Score / streak / multiplier bar */}
        <div className="flex items-center gap-4 mb-4 px-1">
          <div className="flex flex-col">
            <span className="font-fraunces text-xl font-bold text-[#F8FAFC]">{score}</span>
            <span className="font-jakarta text-[10px] text-[#475569]">điểm</span>
          </div>
          <div className="flex flex-col">
            <span className="font-fraunces text-xl font-bold text-[#F2A20C]">🔥 {streak}</span>
            <span className="font-jakarta text-[10px] text-[#475569]">chuỗi</span>
          </div>
          {multiplier > 1 && (
            <div className="ml-auto px-2.5 py-1 rounded-lg font-jakarta text-[11px] font-bold text-[#0A0E1A]"
              style={{ background: '#F2A20C' }}>
              ×{multiplier} COMBO
            </div>
          )}
        </div>

        {/* Timer bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="font-jakarta text-[11px] text-[#475569]">{TOPIC_LABELS[q?.topic] ?? q?.topic}</span>
            <span className={`font-jakarta text-[13px] font-bold tabular-nums ${timeLeft <= 3 ? 'text-[#FB7185]' : timeLeft <= 6 ? 'text-[#F2A20C]' : 'text-[#94A3B8]'}`}>
              {timeLeft}s
            </span>
          </div>
          <div className="h-1.5 bg-[#1E2A44] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{
                width: `${progress}%`,
                background: timeLeft <= 3 ? '#FB7185' : timeLeft <= 6 ? '#F2A20C' : '#10B981',
              }}
            />
          </div>
        </div>

        {/* Card */}
        <div className={`${cardBg} border ${cardBorder} rounded-2xl p-6 flex flex-col gap-5 transition-colors duration-300`}>
          <MdMath>{q.question}</MdMath>

          <div className="flex flex-col gap-2.5">
            {q.choices.map((choice, i) => {
              let style = 'border-[#1E2A44] bg-[#111827] text-[#94A3B8]'
              if (chosen !== null && chosen !== -1) {
                if (i === q.correct) style = 'border-[#10B981] bg-[#0A1F14] text-[#6EE7B7]'
                else if (i === chosen) style = 'border-[#FB7185] bg-[#1F0A0E] text-[#FB7185]'
                else style = 'border-[#1E2A44] bg-[#111827] text-[#475569]'
              } else if (chosen === -1) {
                if (i === q.correct) style = 'border-[#10B981] bg-[#0A1F14] text-[#6EE7B7]'
                else style = 'border-[#1E2A44] bg-[#111827] text-[#475569]'
              }
              return (
                <button
                  key={i}
                  disabled={chosen !== null}
                  onClick={() => handleAnswer(i)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition text-left ${style} ${chosen === null ? 'hover:border-[#F2A20C] hover:text-[#F0F4FF]' : ''}`}
                >
                  <span className="w-6 h-6 rounded-full bg-[#1E2A44] flex items-center justify-center font-jakarta text-[11px] font-bold flex-shrink-0">
                    {LABELS[i]}
                  </span>
                  <MdMath>{choice}</MdMath>
                </button>
              )
            })}
          </div>

          {/* Feedback */}
          {flash && (
            <div className={`rounded-xl px-4 py-2 ${flash === 'correct' ? 'bg-[#0A1F14] border border-[#2D4A1A]' : 'bg-[#1F0A0E] border border-[#5A1A24]'}`}>
              <span className={`font-jakarta text-[13px] font-semibold ${flash === 'correct' ? 'text-[#34D399]' : 'text-[#FB7185]'}`}>
                {flash === 'correct'
                  ? `🎉 Chính xác!${multiplier > 1 ? ` ×${multiplier}` : ''}`
                  : chosen === -1 ? '⏱ Hết giờ! Mất 1 mạng.' : '❌ Chưa đúng. Mất 1 mạng.'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

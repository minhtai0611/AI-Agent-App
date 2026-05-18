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

const FLASH_SCORES_KEY = 'flash_scores'
const TOTAL_QUESTIONS = 20
const TIME_PER_Q = 10
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

function seededShuffle(arr, seed) {
  const a = [...arr]
  let s = seed >>> 0
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function loadScores() {
  try { return JSON.parse(localStorage.getItem(FLASH_SCORES_KEY) ?? '[]') }
  catch { return [] }
}

function saveScore(entry) {
  try {
    const scores = loadScores()
    scores.push(entry)
    scores.sort((a, b) => b.score - a.score)
    localStorage.setItem(FLASH_SCORES_KEY, JSON.stringify(scores.slice(0, 5)))
  } catch {}
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return iso }
}

export default function FlashMode() {
  usePageTitle('Flash Mode')
  const navigate = useNavigate()

  const [allQuestions, setAllQuestions] = useState([])
  const [deck, setDeck] = useState([])
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState(null)          // index of chosen answer or null
  const [flash, setFlash] = useState(null)            // 'correct' | 'wrong' | null
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q)
  const [correctCount, setCorrectCount] = useState(0)
  const [topicResults, setTopicResults] = useState({}) // {topic: {correct, total}}
  const [startTime, setStartTime] = useState(null)
  const [done, setDone] = useState(false)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)

  const timerRef = useRef(null)
  const advanceRef = useRef(null)
  const startTimeRef = useRef(null)

  // Load questions once
  useEffect(() => {
    loadQuestions().then(qs => {
      setAllQuestions(qs)
      setLoading(false)
    })
  }, [])

  const buildDeck = useCallback((qs) => {
    const seed = Date.now()
    const shuffled = seededShuffle(qs, seed)
    return shuffled.slice(0, TOTAL_QUESTIONS)
  }, [])

  const startGame = useCallback((qs) => {
    const d = buildDeck(qs)
    setDeck(d)
    setIndex(0)
    setChosen(null)
    setFlash(null)
    setTimeLeft(TIME_PER_Q)
    setCorrectCount(0)
    setTopicResults({})
    setDone(false)
    setTotalSeconds(0)
    startTimeRef.current = Date.now()
    setStartTime(Date.now())
  }, [buildDeck])

  // Start when questions loaded
  useEffect(() => {
    if (!loading && allQuestions.length > 0) {
      startGame(allQuestions)
    }
  }, [loading, allQuestions, startGame])

  // Advance to next question or finish
  const advance = useCallback((isCorrect, currentIndex, currentDeck, currentTopicResults, currentCorrectCount) => {
    clearInterval(timerRef.current)
    clearTimeout(advanceRef.current)

    const q = currentDeck[currentIndex]
    const topic = q?.topic ?? 'unknown'
    const updated = { ...currentTopicResults }
    if (!updated[topic]) updated[topic] = { correct: 0, total: 0 }
    updated[topic].total += 1
    if (isCorrect) updated[topic].correct += 1
    const newCorrect = isCorrect ? currentCorrectCount + 1 : currentCorrectCount

    setTopicResults(updated)
    setCorrectCount(newCorrect)

    const nextIndex = currentIndex + 1
    if (nextIndex >= currentDeck.length) {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      setTotalSeconds(elapsed)
      setDone(true)
      const score = newCorrect
      const qpm = parseFloat((TOTAL_QUESTIONS / (elapsed / 60)).toFixed(1))
      saveScore({ score, qpm, date: new Date().toISOString() })
      setLeaderboard(loadScores())
    } else {
      advanceRef.current = setTimeout(() => {
        setIndex(nextIndex)
        setChosen(null)
        setFlash(null)
        setTimeLeft(TIME_PER_Q)
      }, isCorrect ? 800 : 1500)
    }
  }, [])

  // Timer
  useEffect(() => {
    if (done || loading || deck.length === 0 || chosen !== null) return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          // Timeout — treat as wrong
          const q = deck[index]
          setFlash('wrong')
          setChosen(-1) // sentinel: timeout
          advance(false, index, deck, topicResults, correctCount)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, done, loading, deck, chosen])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      clearTimeout(advanceRef.current)
    }
  }, [])

  function handleAnswer(idx) {
    if (chosen !== null || done) return
    clearInterval(timerRef.current)
    const q = deck[index]
    const isCorrect = idx === q.correct
    setChosen(idx)
    setFlash(isCorrect ? 'correct' : 'wrong')
    advance(isCorrect, index, deck, topicResults, correctCount)
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F2A20C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Final screen ─────────────────────────────────────────────────────────
  if (done) {
    const qpm = parseFloat((TOTAL_QUESTIONS / (totalSeconds / 60)).toFixed(1))
    const pct = Math.round((correctCount / TOTAL_QUESTIONS) * 100)
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
              <p className="font-jakarta text-[11px] font-bold tracking-[2px] uppercase text-[#F2A20C] mb-2">Kết quả</p>
              <p className="font-fraunces text-5xl font-bold text-[#F8FAFC]">{correctCount}<span className="text-[#475569] text-3xl">/{TOTAL_QUESTIONS}</span></p>
              <p className="font-jakarta text-[13px] text-[#64748B] mt-1">{pct}% chính xác</p>
            </div>

            <div className="flex items-center justify-center gap-8 py-4 border-y border-[#1E2A44]">
              <div className="text-center">
                <p className="font-fraunces text-2xl font-bold text-[#F2A20C]">{qpm}</p>
                <p className="font-jakarta text-[11px] text-[#64748B]">câu / phút</p>
              </div>
              <div className="text-center">
                <p className="font-fraunces text-2xl font-bold text-[#F8FAFC]">{Math.round(totalSeconds)}s</p>
                <p className="font-jakarta text-[11px] text-[#64748B]">tổng thời gian</p>
              </div>
            </div>

            {/* Topic breakdown */}
            {Object.keys(topicResults).length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-jakarta text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Theo chủ đề</p>
                {Object.entries(topicResults).map(([topic, { correct, total }]) => {
                  const topicPct = Math.round((correct / total) * 100)
                  return (
                    <div key={topic} className="flex items-center gap-3">
                      <span className="font-jakarta text-[12px] text-[#94A3B8] w-36 flex-shrink-0">{TOPIC_LABELS[topic] ?? topic}</span>
                      <div className="flex-1 h-1.5 bg-[#1E2A44] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${topicPct}%`,
                            background: topicPct >= 70 ? '#10B981' : topicPct >= 40 ? '#F2A20C' : '#FB7185',
                          }}
                        />
                      </div>
                      <span className="font-jakarta text-[12px] text-[#64748B] w-12 text-right">{correct}/{total}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Local leaderboard */}
            {leaderboard.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-jakarta text-[11px] font-semibold text-[#475569] uppercase tracking-wider">
                  Bảng điểm cao nhất <span className="normal-case font-normal text-[#475569]">(Điểm chỉ lưu trên thiết bị này)</span>
                </p>
                <div className="flex flex-col gap-1">
                  {leaderboard.map((entry, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#111827]">
                      <span className="font-jakarta text-[12px] font-bold text-[#F2A20C] w-5">{i + 1}</span>
                      <span className="font-jakarta text-[12px] text-[#F8FAFC] font-semibold">{entry.score}/{TOTAL_QUESTIONS}</span>
                      <span className="font-jakarta text-[11px] text-[#64748B]">{entry.qpm} câu/phút</span>
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

  // ── Question screen ───────────────────────────────────────────────────────
  const q = deck[index]
  const progress = (timeLeft / TIME_PER_Q) * 100

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
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => navigate(-1)}
            className="font-jakarta text-[13px] text-[#64748B] hover:text-[#94A3B8] transition"
          >
            ← Quay lại
          </button>
          <div className="flex items-center gap-3">
            <span className="font-jakarta text-[13px] text-[#64748B]">{index + 1}/{TOTAL_QUESTIONS}</span>
            <span className="font-jakarta text-[13px] font-semibold text-[#F2A20C]">✓ {correctCount}</span>
          </div>
        </div>

        {/* Timer bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="font-jakarta text-[11px] text-[#475569]">{TOPIC_LABELS[q?.topic] ?? q?.topic}</span>
            <span className={`font-jakarta text-[13px] font-bold tabular-nums ${timeLeft <= 3 ? 'text-[#FB7185]' : 'text-[#94A3B8]'}`}>
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
                // Timeout: highlight correct
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

          {/* Flash feedback */}
          {flash && (
            <div className={`rounded-xl px-4 py-2 ${flash === 'correct' ? 'bg-[#0A1F14] border border-[#2D4A1A]' : 'bg-[#1F0A0E] border border-[#5A1A24]'}`}>
              <span className={`font-jakarta text-[13px] font-semibold ${flash === 'correct' ? 'text-[#34D399]' : 'text-[#FB7185]'}`}>
                {flash === 'correct' ? '🎉 Chính xác!' : chosen === -1 ? '⏱ Hết giờ!' : '❌ Chưa đúng'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

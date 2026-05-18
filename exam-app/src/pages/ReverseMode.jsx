import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadQuestions } from '../api/index.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { TOPIC_LABELS } from '../utils/topicLabels.js'
import Markdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

const TOTAL_ROUNDS = 10
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

// Pick a random element from an array excluding certain values
function pickRandom(arr, exclude = []) {
  const pool = arr.filter(x => !exclude.includes(x))
  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

export default function ReverseMode() {
  usePageTitle('Reverse Mode')
  const navigate = useNavigate()

  const [allQuestions, setAllQuestions] = useState([])
  const [loading, setLoading] = useState(true)

  // Round state
  const [round, setRound] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [done, setDone] = useState(false)

  // Per-round state
  const [targetAnswer, setTargetAnswer] = useState('')   // displayed "answer" text
  const [stems, setStems] = useState([])                 // array of {question, isCorrect}
  const [shuffledStems, setShuffledStems] = useState([]) // stems in display order
  const [correctStemIndex, setCorrectStemIndex] = useState(null) // index in shuffledStems
  const [chosen, setChosen] = useState(null)             // index chosen by user
  const [feedback, setFeedback] = useState(null)         // 'correct' | 'wrong'

  useEffect(() => {
    loadQuestions().then(qs => {
      // Only questions with at least 4 choices
      const valid = qs.filter(q => Array.isArray(q.choices) && q.choices.length >= 4)
      setAllQuestions(valid)
      setLoading(false)
    })
  }, [])

  const buildRound = useCallback((qs) => {
    if (!qs.length) return

    // Pick the target question
    const q = qs[Math.floor(Math.random() * qs.length)]
    const correctAnswerText = q.choices[q.correct]
    setTargetAnswer(correctAnswerText)

    // Find distractors: same topic, correct answer text differs
    const sameTopic = qs.filter(
      d => d !== q && d.topic === q.topic && d.choices[d.correct] !== correctAnswerText
    )
    const anyTopic = qs.filter(
      d => d !== q && d.choices[d.correct] !== correctAnswerText
    )

    // Pick 3 distractor questions
    const usedIds = new Set([q.id ?? q.question])
    const distractors = []

    const tryPick = (pool) => {
      for (let i = 0; i < pool.length && distractors.length < 3; i++) {
        const candidate = pool[Math.floor(Math.random() * pool.length)]
        const cid = candidate.id ?? candidate.question
        if (!usedIds.has(cid)) {
          usedIds.add(cid)
          distractors.push(candidate)
        }
      }
    }

    // Shuffle pools first
    const poolSameTopic = shuffle(sameTopic)
    const poolAny = shuffle(anyTopic)

    for (const d of poolSameTopic) {
      if (distractors.length >= 3) break
      const cid = d.id ?? d.question
      if (!usedIds.has(cid)) {
        usedIds.add(cid)
        distractors.push(d)
      }
    }
    if (distractors.length < 3) {
      for (const d of poolAny) {
        if (distractors.length >= 3) break
        const cid = d.id ?? d.question
        if (!usedIds.has(cid)) {
          usedIds.add(cid)
          distractors.push(d)
        }
      }
    }

    // Build stems array: 1 correct + up to 3 distractors
    const rawStems = [
      { question: q.question, isCorrect: true },
      ...distractors.map(d => ({ question: d.question, isCorrect: false })),
    ]

    const shuffled = shuffle(rawStems)
    setShuffledStems(shuffled)
    setCorrectStemIndex(shuffled.findIndex(s => s.isCorrect))
    setChosen(null)
    setFeedback(null)
  }, [])

  useEffect(() => {
    if (!loading && allQuestions.length > 0 && !done) {
      buildRound(allQuestions)
    }
  }, [loading, allQuestions, round, done, buildRound])

  function handleChoose(idx) {
    if (chosen !== null) return
    setChosen(idx)
    const isCorrect = shuffledStems[idx]?.isCorrect
    setFeedback(isCorrect ? 'correct' : 'wrong')
    if (isCorrect) setCorrectCount(c => c + 1)
  }

  function handleNext() {
    const nextRound = round + 1
    if (nextRound >= TOTAL_ROUNDS) {
      setDone(true)
    } else {
      setRound(nextRound)
    }
  }

  function handleRestart() {
    setRound(0)
    setCorrectCount(0)
    setDone(false)
    setChosen(null)
    setFeedback(null)
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
    const pct = Math.round((correctCount / TOTAL_ROUNDS) * 100)
    return (
      <div className="min-h-screen bg-[#0A0E1A] pb-16">
        <div className="max-w-xl mx-auto px-4 pt-16">
          <button
            onClick={() => navigate(-1)}
            className="font-jakarta text-[13px] text-[#64748B] hover:text-[#94A3B8] transition mb-8 block"
          >
            ← Quay lại
          </button>

          <div className="bg-[#0D1521] border border-[#1E2A44] rounded-2xl p-6 flex flex-col gap-6 text-center">
            <div>
              <p className="font-jakarta text-[11px] font-bold tracking-[2px] uppercase text-[#F2A20C] mb-2">Kết quả</p>
              <p className="font-fraunces text-5xl font-bold text-[#F8FAFC]">
                {correctCount}<span className="text-[#475569] text-3xl">/{TOTAL_ROUNDS}</span>
              </p>
              <p className="font-jakarta text-[13px] text-[#64748B] mt-1">{pct}% chính xác</p>
            </div>

            <p className="font-jakarta text-[14px] text-[#94A3B8]">
              {pct >= 80
                ? 'Xuất sắc! Bạn nhận ra câu hỏi rất tốt.'
                : pct >= 50
                ? 'Khá tốt! Hãy luyện tập thêm nhé.'
                : 'Cần ôn thêm — thử lại để cải thiện nhé!'}
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleRestart}
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

  // ── Round screen ──────────────────────────────────────────────────────────
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
            <span className="font-jakarta text-[13px] text-[#64748B]">Vòng {round + 1}/{TOTAL_ROUNDS}</span>
            <span className="font-jakarta text-[13px] font-semibold text-[#F2A20C]">✓ {correctCount}</span>
          </div>
        </div>

        {/* Instruction */}
        <div className="mb-3">
          <span className="font-jakarta text-[11px] font-bold tracking-[2px] uppercase text-[#F2A20C]">Reverse Mode</span>
          <p className="font-jakarta text-[12px] text-[#64748B] mt-0.5">Chọn câu hỏi tương ứng với đáp án dưới đây</p>
        </div>

        {/* Displayed answer */}
        <div className="bg-[#0D1521] border border-[#F2A20C]/40 rounded-2xl p-5 mb-4">
          <p className="font-jakarta text-[11px] font-semibold text-[#F2A20C] uppercase tracking-wider mb-2">Đáp án</p>
          <MdMath>{targetAnswer}</MdMath>
        </div>

        {/* Stem choices */}
        <div className="flex flex-col gap-3 mb-4">
          {shuffledStems.map((stem, i) => {
            let style = 'border-[#1E2A44] bg-[#0D1521] text-[#94A3B8]'
            if (chosen !== null) {
              if (i === correctStemIndex) style = 'border-[#10B981] bg-[#0A1F14] text-[#6EE7B7]'
              else if (i === chosen) style = 'border-[#FB7185] bg-[#1F0A0E] text-[#FB7185]'
              else style = 'border-[#1E2A44] bg-[#0D1521] text-[#475569]'
            }
            return (
              <button
                key={i}
                disabled={chosen !== null}
                onClick={() => handleChoose(i)}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition text-left ${style} ${chosen === null ? 'hover:border-[#F2A20C] hover:text-[#F0F4FF]' : ''}`}
              >
                <span className="w-6 h-6 rounded-full bg-[#1E2A44] flex items-center justify-center font-jakarta text-[11px] font-bold flex-shrink-0 mt-0.5">
                  {LABELS[i]}
                </span>
                <div className="flex-1 min-w-0">
                  <MdMath>{stem.question}</MdMath>
                </div>
              </button>
            )
          })}
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`rounded-xl px-4 py-3 mb-4 ${feedback === 'correct' ? 'bg-[#0A1F14] border border-[#2D4A1A]' : 'bg-[#1F0A0E] border border-[#5A1A24]'}`}>
            <span className={`font-jakarta text-[13px] font-semibold ${feedback === 'correct' ? 'text-[#34D399]' : 'text-[#FB7185]'}`}>
              {feedback === 'correct' ? '🎉 Chính xác!' : '❌ Chưa đúng'}
            </span>
          </div>
        )}

        {/* Next button */}
        {chosen !== null && (
          <button
            onClick={handleNext}
            className="w-full py-3 rounded-xl font-jakarta text-[13px] font-bold text-[#0A0E1A]"
            style={{ background: '#F2A20C' }}
          >
            {round + 1 >= TOTAL_ROUNDS ? 'Xem kết quả' : 'Câu tiếp theo →'}
          </button>
        )}
      </div>
    </div>
  )
}

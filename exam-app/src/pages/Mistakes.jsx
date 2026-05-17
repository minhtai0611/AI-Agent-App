import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHistory } from '../context/HistoryContext'
import { useAuth } from '../context/AuthContext'
import { loadQuestions } from '../api/index.js'
import { getExplanation } from '../api/aiClient'
import { usePageTitle } from '../hooks/usePageTitle.js'
import Markdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

import { TOPIC_LABELS } from '../utils/topicLabels.js'
import { MathText } from '../components/MathText.jsx'
const TOPIC_ORDER = ['algebra', 'geometry', 'statistics', 'combinatorics']

function MdMath({ children }) {
  return (
    <Markdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}
      className="font-jakarta text-[13px] text-[#CBD5E1] leading-relaxed prose-invert">
      {children}
    </Markdown>
  )
}

function MistakeRow({ question, userAnswer, examTitle }) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [explanation, setExplanation] = useState(null)
  const [explLoading, setExplLoading] = useState(false)
  const [explError, setExplError] = useState(null)

  async function fetchExplanation() {
    if (explanation || explLoading) { setExpanded(e => !e); return }
    setExpanded(true)
    setExplLoading(true)
    setExplError(null)
    const { data, error } = await getExplanation({
      question: question.question,
      choices: question.choices,
      correct: question.correct,
      topic: question.topic,
    })
    setExplLoading(false)
    if (error) setExplError(typeof error === 'object' ? error.message || 'Lỗi' : error)
    else setExplanation(data?.explanation || question.explanation || null)
  }

  const correctLabel = question.choices?.[question.correct] ?? '—'
  const userLabel = typeof userAnswer === 'number' ? (question.choices?.[userAnswer] ?? '—') : '—'

  return (
    <div className="bg-[#0D1521] rounded-xl border border-[#1E2A44] overflow-hidden">
      <button
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4"
        onClick={fetchExplanation}
      >
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <MathText className="font-jakarta text-[13px] text-[#CBD5E1] line-clamp-2">{question.question}</MathText>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded-full bg-[#2A0F14] border border-[#5A1A24] text-[#FB7185]">
              Bạn chọn: <MathText>{userLabel?.slice(0, 40)}</MathText>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#0A2A1A] border border-[#1A5A2A] text-[#34D399]">
              Đáp án: <MathText>{correctLabel?.slice(0, 40)}</MathText>
            </span>
            {examTitle && (
              <span className="px-2 py-0.5 rounded-full bg-[#111827] border border-[#1E2A44] text-[#475569]">{examTitle}</span>
            )}
          </div>
        </div>
        <span className="text-[#475569] flex-shrink-0 mt-0.5">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-5 pb-4 flex flex-col gap-3 border-t border-[#1E2A44] pt-3">
          {explLoading && (
            <div className="flex items-center gap-2 text-[#475569] font-jakarta text-[12px]">
              <span className="animate-spin">⟳</span> Đang tải giải thích...
            </div>
          )}
          {explError && (
            <p className="font-jakarta text-[12px] text-red-400">{explError}</p>
          )}
          {explanation && !explLoading && (
            <div className="flex flex-col gap-2">
              <span className="font-jakarta text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Giải thích</span>
              <MdMath>{explanation}</MdMath>
            </div>
          )}
          {!explanation && !explLoading && !explError && question.explanation && (
            <div className="flex flex-col gap-2">
              <span className="font-jakarta text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Giải thích</span>
              <MdMath>{question.explanation}</MdMath>
            </div>
          )}
          {!user && (
            <p className="font-jakarta text-[11px] text-amber-400">Đăng nhập để dùng AI giải thích ⚡1</p>
          )}
        </div>
      )}
    </div>
  )
}

const PATTERN_THRESHOLD = 3  // repeated same wrong choice this many times = a pattern

export default function Mistakes() {
  usePageTitle('Sổ tay sai lầm')
  const navigate = useNavigate()
  const { results } = useHistory()
  const [questions, setQuestions] = useState([])
  const [filterTopic, setFilterTopic] = useState(null)
  const [expandedTopics, setExpandedTopics] = useState({})

  useEffect(() => {
    loadQuestions().then(setQuestions)
  }, [])

  const questionMap = useMemo(() => {
    const m = {}
    for (const q of questions) m[q.id] = q
    return m
  }, [questions])

  // Collect all wrong answers across all results, deduplicated by questionId (most recent wins)
  const mistakeMap = useMemo(() => {
    const map = {}
    for (const result of [...results].reverse()) {
      const examId = result.examId
      const answers = result.answers ?? {}
      // allQuestions in result — we need question IDs that were in this exam
      // answers maps questionId→choiceIndex for answered questions
      for (const [qId, chosen] of Object.entries(answers)) {
        const q = questionMap[qId]
        if (!q) continue
        if (chosen !== q.correct) {
          map[qId] = { question: q, userAnswer: chosen, examId, resultId: result.id }
        }
      }
    }
    return map
  }, [results, questionMap])

  // Group by topic
  const byTopic = useMemo(() => {
    const groups = {}
    for (const entry of Object.values(mistakeMap)) {
      const t = entry.question.topic || 'other'
      if (!groups[t]) groups[t] = []
      groups[t].push(entry)
    }
    return groups
  }, [mistakeMap])

  const totalMistakes = Object.values(mistakeMap).length
  const topics = TOPIC_ORDER.filter(t => byTopic[t]?.length > 0)
    .concat(Object.keys(byTopic).filter(t => !TOPIC_ORDER.includes(t) && byTopic[t]?.length > 0))

  const visibleTopics = filterTopic ? [filterTopic] : topics

  // Error patterns: same wrong choice chosen ≥ PATTERN_THRESHOLD times across all results
  const errorPatterns = useMemo(() => {
    // wrongCounts[questionId][choiceIndex] = number of times chosen wrongly
    const wrongCounts = {}
    for (const result of results) {
      for (const [qId, chosen] of Object.entries(result.answers ?? {})) {
        const q = questionMap[qId]
        if (!q || chosen === null || chosen === q.correct) continue
        if (!wrongCounts[qId]) wrongCounts[qId] = {}
        wrongCounts[qId][chosen] = (wrongCounts[qId][chosen] ?? 0) + 1
      }
    }
    const patterns = []
    for (const [qId, choices] of Object.entries(wrongCounts)) {
      for (const [choiceIdx, count] of Object.entries(choices)) {
        if (count >= PATTERN_THRESHOLD) {
          const q = questionMap[qId]
          if (!q) continue
          patterns.push({
            question: q,
            wrongChoiceIndex: Number(choiceIdx),
            wrongChoiceText: q.choices?.[Number(choiceIdx)] ?? '',
            correctText: q.choices?.[q.correct] ?? '',
            occurrences: count,
          })
        }
      }
    }
    return patterns.sort((a, b) => b.occurrences - a.occurrences).slice(0, 5)
  }, [results, questionMap])

  return (
    <div className="min-h-screen bg-[#0A0E1A] pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-20">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate(-1)} className="font-jakarta text-[13px] text-[#64748B] hover:text-[#94A3B8] transition">
            ← Quay lại
          </button>
        </div>
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="font-fraunces text-[28px] font-bold text-[#F8FAFC]">Sổ tay sai lầm</h1>
            <p className="font-jakarta text-[13px] text-[#64748B] mt-1">
              {questions.length === 0 ? 'Đang tải...' : totalMistakes === 0 ? 'Chưa có câu sai nào!' : `${totalMistakes} câu đã làm sai`}
            </p>
          </div>
          {totalMistakes > 0 && (
            <div className="flex flex-col gap-2 items-end">
              <button
                onClick={() => navigate('/battle')}
                className="px-4 py-2 rounded-xl font-jakarta text-[12px] font-bold"
                style={{ background: '#F2A20C', color: '#0A0E1A' }}
              >
                Chiến đấu 🔥
              </button>
              <button
                onClick={() => navigate('/exams?mode=practice')}
                className="px-4 py-1.5 rounded-lg font-jakarta text-[11px] text-[#64748B] hover:text-[#94A3B8] border border-[#1E2A44] transition"
              >
                Luyện từ lỗi sai
              </button>
            </div>
          )}
        </div>

        {/* Topic filter chips */}
        {topics.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setFilterTopic(null)}
              className={`h-8 px-3 rounded-full font-jakarta text-[12px] font-medium border transition ${
                !filterTopic ? 'border-[#F2A20C] bg-[#F2A20C22] text-[#F2A20C]' : 'border-[#1E2A44] text-[#64748B]'
              }`}
            >Tất cả</button>
            {topics.map(t => (
              <button
                key={t}
                onClick={() => setFilterTopic(filterTopic === t ? null : t)}
                className={`h-8 px-3 rounded-full font-jakarta text-[12px] font-medium border transition ${
                  filterTopic === t ? 'border-[#F2A20C] bg-[#F2A20C22] text-[#F2A20C]' : 'border-[#1E2A44] text-[#64748B]'
                }`}
              >
                {TOPIC_LABELS[t] ?? t} <span className="opacity-60 ml-1">{byTopic[t].length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {totalMistakes === 0 && questions.length > 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <span className="text-4xl">🎉</span>
            <p className="font-jakarta text-[15px] text-[#94A3B8]">Chưa có câu sai nào — hãy làm một bài thi!</p>
            <button
              onClick={() => navigate('/exams')}
              className="px-5 py-2 rounded-xl font-jakarta text-[13px] font-bold mt-2"
              style={{ background: '#F2A20C', color: '#0A0E1A' }}
            >
              Chọn đề thi
            </button>
          </div>
        )}

        {/* Error patterns — systematic wrong choices */}
        {errorPatterns.length > 0 && !filterTopic && (
          <div className="mb-8 bg-[#0D1221] border border-[#2A1A40] rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="font-jakarta text-[12px] font-bold text-[#A78BFA] uppercase tracking-wider">Lỗi hệ thống</span>
              <span className="font-jakarta text-[11px] text-[#475569]">Những lựa chọn bạn lặp lại ≥{PATTERN_THRESHOLD} lần</span>
            </div>
            <div className="flex flex-col gap-3">
              {errorPatterns.map((p, i) => (
                <div key={`${p.question.id}-${p.wrongChoiceIndex}`} className="flex flex-col gap-1.5 px-4 py-3 rounded-xl bg-[#150D2A] border border-[#2A1A40]">
                  <MathText className="font-jakarta text-[13px] text-[#CBD5E1] line-clamp-2">{p.question.question}</MathText>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-[#2A0F14] border border-[#5A1A24] text-[#FB7185]">
                      Hay chọn nhầm: <MathText>{p.wrongChoiceText.slice(0, 40)}</MathText>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#0A2A1A] border border-[#1A5A2A] text-[#34D399]">
                      Đúng: <MathText>{p.correctText.slice(0, 40)}</MathText>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#1A1240] border border-[#2A1A60] text-[#A78BFA]">
                      {p.occurrences} lần
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#111827] border border-[#1E2A44] text-[#475569]">
                      {TOPIC_LABELS[p.question.topic] ?? p.question.topic}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grouped list */}
        {visibleTopics.map(topic => {
          const SHOW_FIRST = 8
          const topicEntries = byTopic[topic]
          const isExpanded = !!expandedTopics[topic]
          const visibleEntries = isExpanded ? topicEntries : topicEntries.slice(0, SHOW_FIRST)
          const hiddenCount = topicEntries.length - SHOW_FIRST
          return (
          <div key={topic} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-jakarta text-[12px] font-bold text-[#94A3B8] uppercase tracking-wider">
                {TOPIC_LABELS[topic] ?? topic}
              </span>
              <span className="font-jakarta text-[11px] text-[#475569]">{topicEntries.length} câu</span>
            </div>
            <div className="flex flex-col gap-2">
              {visibleEntries.map(entry => (
                <MistakeRow
                  key={entry.question.id}
                  question={entry.question}
                  userAnswer={entry.userAnswer}
                  examTitle={null}
                />
              ))}
              {!isExpanded && hiddenCount > 0 && (
                <button
                  onClick={() => setExpandedTopics(prev => ({ ...prev, [topic]: true }))}
                  className="font-jakarta text-[12px] text-center py-2 rounded-xl border border-dashed border-[#1E2A44] text-[#475569] hover:text-[#94A3B8] transition">
                  + Xem thêm ({hiddenCount} câu)
                </button>
              )}
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}

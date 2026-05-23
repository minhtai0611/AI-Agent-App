import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHistory } from '../context/HistoryContext'
import { useAuth } from '../context/AuthContext'
import { loadQuestions } from '../api/index.js'
import { getExplanation, classifyError } from '../api/aiClient'
import { usePageTitle } from '../hooks/usePageTitle.js'
import Markdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

import { TOPIC_LABELS } from '../utils/topicLabels.js'
import { MathText } from '../components/MathText.jsx'
const TOPIC_ORDER = ['algebra', 'geometry', 'statistics', 'combinatorics']

const ERROR_TAGS = [
  { id: 'calc', label: 'Lỗi tính toán' },
  { id: 'reading', label: 'Lỗi hiểu đề' },
  { id: 'concept', label: 'Lỗi khái niệm' },
]
const TAGS_KEY = 'mistake_tags'
const AI_CATEGORIES_KEY = 'mistake_ai_categories'

const AI_CATEGORY_META = {
  sign_error:        { label: 'Sai dấu',          color: '#FB7185' },
  formula_confusion: { label: 'Nhầm công thức',    color: '#F2A20C' },
  procedural_slip:   { label: 'Sai quy trình',     color: '#818CF8' },
  conceptual_gap:    { label: 'Lỗ hổng khái niệm', color: '#60A5FA' },
  calculation:       { label: 'Tính toán sai',     color: '#34D399' },
}

function loadTags() {
  try { return JSON.parse(localStorage.getItem(TAGS_KEY) ?? '{}') } catch { return {} }
}
function saveTag(questionId, tagId) {
  const tags = loadTags()
  tags[questionId] = tagId
  try { localStorage.setItem(TAGS_KEY, JSON.stringify(tags)) } catch {}
}
function loadAiCategories() {
  try { return JSON.parse(localStorage.getItem(AI_CATEGORIES_KEY) ?? '{}') } catch { return {} }
}
function saveAiCategory(questionId, category) {
  const cats = loadAiCategories()
  cats[questionId] = category
  try { localStorage.setItem(AI_CATEGORIES_KEY, JSON.stringify(cats)) } catch {}
}

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
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [explanation, setExplanation] = useState(null)
  const [explLoading, setExplLoading] = useState(false)
  const [explError, setExplError] = useState(null)
  const [tag, setTag] = useState(() => loadTags()[question.id] ?? null)
  const [aiCategory, setAiCategory] = useState(() => loadAiCategories()[question.id] ?? null)

  // Fire AI classification once per mistake, lazily on first expand
  async function maybeClassify() {
    if (aiCategory || !user) return
    const wrongText = typeof userAnswer === 'number' ? (question.choices?.[userAnswer] ?? '') : ''
    const correctText = question.choices?.[question.correct] ?? ''
    if (!wrongText || !correctText) return
    const { data } = await classifyError(question.question, wrongText, correctText)
    if (data?.category) { setAiCategory(data.category); saveAiCategory(question.id, data.category) }
  }

  async function fetchExplanation() {
    if (explanation || explLoading) { setExpanded(e => !e); return }
    setExpanded(true)
    maybeClassify()
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
            {aiCategory && AI_CATEGORY_META[aiCategory] && (
              <span className="px-2 py-0.5 rounded-full font-jakarta text-[10px] font-semibold border"
                style={{ borderColor: AI_CATEGORY_META[aiCategory].color + '44', color: AI_CATEGORY_META[aiCategory].color, background: AI_CATEGORY_META[aiCategory].color + '18' }}>
                {AI_CATEGORY_META[aiCategory].label}
              </span>
            )}
          </div>
        </div>
        <span className="text-[#475569] flex-shrink-0 mt-0.5">
          {explLoading ? <span className="animate-spin inline-block">⟳</span> : expanded ? '▲' : '▼'}
        </span>
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
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="font-jakarta text-[11px] text-[#475569]">Loại lỗi:</span>
            {ERROR_TAGS.map(t => (
              <button
                key={t.id}
                onClick={() => { const next = tag === t.id ? null : t.id; setTag(next); saveTag(question.id, next) }}
                className={`px-2.5 py-1 rounded-full font-jakarta text-[11px] border transition ${
                  tag === t.id
                    ? 'border-[#F2A20C] bg-[#F2A20C22] text-[#F2A20C]'
                    : 'border-[#1E2A44] text-[#475569] hover:border-[#2A3A50] hover:text-[#94A3B8]'
                }`}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={() => navigate(`/oracle?q=${encodeURIComponent(question.question)}`)}
              className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#6366F133] bg-[#6366F108] font-jakarta text-[11px] font-semibold text-[#818CF8] hover:border-[#6366F166] hover:bg-[#6366F114] transition"
            >
              <span className="text-[9px]">✦</span> Oracle
            </button>
          </div>
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
  const [filterCategory, setFilterCategory] = useState(null)
  const [expandedTopics, setExpandedTopics] = useState({})
  const [aiCategories, setAiCategories] = useState(() => loadAiCategories())

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

  // Filter mistakes by AI category if selected
  const filteredMistakeMap = useMemo(() => {
    if (!filterCategory) return mistakeMap
    return Object.fromEntries(
      Object.entries(mistakeMap).filter(([qId]) => aiCategories[qId] === filterCategory)
    )
  }, [mistakeMap, filterCategory, aiCategories])

  // Group by topic (respects category filter)
  const byTopic = useMemo(() => {
    const groups = {}
    for (const entry of Object.values(filteredMistakeMap)) {
      const t = entry.question.topic || 'other'
      if (!groups[t]) groups[t] = []
      groups[t].push(entry)
    }
    return groups
  }, [filteredMistakeMap])

  // Weekly summary: count category occurrences from mistakes made in last 7 days
  const weeklyCategorySummary = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000
    const counts = {}
    for (const result of results) {
      if (new Date(result.timestamp).getTime() < cutoff) continue
      for (const [qId, chosen] of Object.entries(result.answers ?? {})) {
        const q = questionMap[qId]
        if (!q || chosen === q.correct) continue
        const cat = aiCategories[qId]
        if (cat) counts[cat] = (counts[cat] ?? 0) + 1
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3)
  }, [results, questionMap, aiCategories])

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
          <button onClick={() => navigate('/exams?mode=special')} className="font-jakarta text-[13px] text-[#64748B] hover:text-[#94A3B8] transition">
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

        {/* Weekly AI category summary */}
        {weeklyCategorySummary.length > 0 && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-[#0D1221] border border-[#1E2A44] flex flex-wrap items-center gap-2">
            <span className="font-jakarta text-[11px] font-semibold text-[#475569] uppercase tracking-wider mr-1">Tuần này:</span>
            {weeklyCategorySummary.map(([cat, count]) => {
              const meta = AI_CATEGORY_META[cat]
              if (!meta) return null
              return (
                <span key={cat} className="font-jakarta text-[12px] font-medium"
                  style={{ color: meta.color }}>
                  {count} lỗi {meta.label.toLowerCase()}
                </span>
              )
            }).filter(Boolean).reduce((acc, el, i) => i === 0 ? [el] : [...acc, <span key={`sep-${i}`} className="text-[#1E2A44]">·</span>, el], [])}
          </div>
        )}

        {/* AI category filter chips */}
        {Object.keys(aiCategories).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setFilterCategory(null)}
              className={`h-7 px-3 rounded-full font-jakarta text-[11px] font-medium border transition ${
                !filterCategory ? 'border-[#818CF8] bg-[#818CF822] text-[#818CF8]' : 'border-[#1E2A44] text-[#64748B]'
              }`}
            >AI: Tất cả</button>
            {Object.keys(AI_CATEGORY_META).filter(cat => Object.values(aiCategories).includes(cat)).map(cat => {
              const meta = AI_CATEGORY_META[cat]
              const count = Object.values(aiCategories).filter(c => c === cat).length
              return (
                <button key={cat}
                  onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                  className="h-7 px-3 rounded-full font-jakarta text-[11px] font-medium border transition"
                  style={filterCategory === cat
                    ? { borderColor: meta.color, background: meta.color + '22', color: meta.color }
                    : { borderColor: '#1E2A44', color: '#64748B' }}
                >
                  {meta.label} <span className="opacity-60 ml-1">{count}</span>
                </button>
              )
            })}
          </div>
        )}

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

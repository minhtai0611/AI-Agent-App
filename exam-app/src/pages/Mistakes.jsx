import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../utils/animations.js'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { useHistory } from '../context/HistoryContext'
import { useAuth } from '../context/AuthContext'
import { loadQuestions } from '../api/index.js'
import { getExplanation, classifyError, analyzeErrorPatterns } from '../api/aiClient'
import { usePageMeta } from '../hooks/usePageMeta.js'
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

// ── Error trend helpers ────────────────────────────────────────────────────
const ERROR_TYPES_TREND = [
  { id: 'sign_error',        label: 'Sai dấu',           color: '#FB7185' },
  { id: 'formula_confusion', label: 'Nhầm công thức',    color: '#F2A20C' },
  { id: 'procedural_slip',   label: 'Sai quy trình',     color: '#818CF8' },
  { id: 'conceptual_gap',    label: 'Lỗ hổng khái niệm', color: '#60A5FA' },
  { id: 'calculation',       label: 'Tính toán sai',     color: '#34D399' },
]
const TOPIC_VI_TREND = {
  algebra: 'Đại số', geometry: 'Hình học', calculus: 'Giải tích',
  trigonometry: 'Lượng giác', statistics: 'Thống kê', probability: 'Xác suất',
  combinatorics: 'Tổ hợp', number_theory: 'Số học', functions_and_graphs: 'Hàm số',
}
function aggregateLocalErrors(results) {
  const now = Date.now(); const WEEK_MS = 7 * 86400_000; const λ = 0.15; const agg = {}
  for (const r of results) {
    const w = Math.exp(-λ * Math.max(0, (now - new Date(r.timestamp || r.created_at || 0).getTime()) / WEEK_MS))
    for (const [topic, data] of Object.entries(r.topicBreakdown || {})) {
      const wrong = (data.total || 0) - (data.correct || 0); if (wrong <= 0) continue
      if (!agg[topic]) agg[topic] = {}
      agg[topic]['procedural_slip'] = (agg[topic]['procedural_slip'] || 0) + wrong * w * 0.4
      agg[topic]['conceptual_gap']  = (agg[topic]['conceptual_gap']  || 0) + wrong * w * 0.3
      agg[topic]['calculation']     = (agg[topic]['calculation']     || 0) + wrong * w * 0.3
    }
  }
  return Object.entries(agg)
    .map(([topic, byType]) => ({ topic, total: Object.values(byType).reduce((s, v) => s + v, 0), ...byType }))
    .filter(d => d.total > 0.1).sort((a, b) => b.total - a.total).slice(0, 12)
}
function buildTrendRadarData(aggregates) {
  const totals = {}
  for (const d of aggregates) for (const et of ERROR_TYPES_TREND) totals[et.id] = (totals[et.id] || 0) + (d[et.id] || 0)
  const max = Math.max(...Object.values(totals), 1)
  return ERROR_TYPES_TREND.map(et => ({ type: et.label, value: Math.round((totals[et.id] || 0) / max * 100) }))
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
      className="font-sans text-[13px] text-foreground leading-relaxed prose-invert">
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
  // Optimistic explanation: shows bundled text immediately while AI loads (React 18 compatible)
  const [displayExpl, setDisplayExpl] = useState(null)

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
    // Show bundled explanation immediately (optimistic) while AI explanation loads
    if (question.explanation) setDisplayExpl(question.explanation)
    const { data, error } = await getExplanation({
      question: question.question,
      choices: question.choices,
      correct: question.correct,
      topic: question.topic,
    })
    setExplLoading(false)
    if (error) {
      setExplError(typeof error === 'object' ? error.message || 'Lỗi' : error)
    } else {
      const aiExpl = data?.explanation || question.explanation || null
      setExplanation(aiExpl)
      setDisplayExpl(aiExpl)
    }
  }

  const correctLabel = question.choices?.[question.correct] ?? '—'
  const userLabel = typeof userAnswer === 'number' ? (question.choices?.[userAnswer] ?? '—') : '—'

  return (
    <div className="glass-base rounded-xl border border-surface overflow-hidden">
      <button
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4"
        onClick={fetchExplanation}
      >
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <MathText className="font-sans text-[13px] text-foreground line-clamp-2">{question.question}</MathText>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/30 text-destructive">
              Bạn chọn: <MathText>{userLabel?.slice(0, 40)}</MathText>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-success/5 border border-success/20 text-success">
              Đáp án: <MathText>{correctLabel?.slice(0, 40)}</MathText>
            </span>
            {examTitle && (
              <span className="px-2 py-0.5 rounded-full bg-surface border border-surface text-dim">{examTitle}</span>
            )}
            {aiCategory && AI_CATEGORY_META[aiCategory] && (
              <span className="px-2 py-0.5 rounded-full font-sans text-[10px] font-semibold border"
                style={{ borderColor: AI_CATEGORY_META[aiCategory].color + '44', color: AI_CATEGORY_META[aiCategory].color, background: AI_CATEGORY_META[aiCategory].color + '18' }}>
                {AI_CATEGORY_META[aiCategory].label}
              </span>
            )}
          </div>
        </div>
        <span className="text-dim flex-shrink-0 mt-0.5">
          {explLoading ? <span className="animate-spin inline-block">⟳</span> : expanded ? '▲' : '▼'}
        </span>
      </button>

      <AnimatePresence>
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
          style={{ overflow: 'hidden' }}
        >
        <div className="px-5 pb-4 flex flex-col gap-3 border-t border-surface pt-3">
          {explLoading && (
            <div className="flex items-center gap-2 text-dim font-sans text-[12px]">
              <span className="animate-spin">⟳</span> Đang tải giải thích...
            </div>
          )}
          {explError && (
            <p className="font-sans text-[12px] text-[var(--destructive)]">{explError}</p>
          )}
          {displayExpl && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-sans text-[11px] font-semibold text-dim uppercase tracking-wider">Giải thích</span>
                {explLoading && <span className="font-sans text-[10px] text-primary animate-pulse">AI đang cải thiện...</span>}
              </div>
              <MdMath>{displayExpl}</MdMath>
            </div>
          )}
          {!user && (
            <p className="font-sans text-[11px] text-[var(--accent)]">Đăng nhập để dùng AI giải thích ⚡1</p>
          )}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="font-sans text-[11px] text-dim">Loại lỗi:</span>
            {ERROR_TAGS.map(t => (
              <button
                key={t.id}
                onClick={() => { const next = tag === t.id ? null : t.id; setTag(next); saveTag(question.id, next) }}
                className={`px-2.5 py-1 rounded-full font-sans text-[11px] border transition ${
                  tag === t.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-surface text-dim hover:border-primary/30 hover:text-muted'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}

const PATTERN_THRESHOLD = 3  // repeated same wrong choice this many times = a pattern

export default function Mistakes() {
  usePageMeta('Sổ tay sai lầm', { noindex: true })
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { results } = useHistory()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'trends' ? 'trends' : 'recent')
  const [questions, setQuestions] = useState([])
  const [filterTopic, setFilterTopic] = useState(null)
  const [filterCategory, setFilterCategory] = useState(null)
  const [expandedTopics, setExpandedTopics] = useState({})
  const [aiCategories, setAiCategories] = useState(() => loadAiCategories())
  const [trendAiData, setTrendAiData] = useState(null)
  const [trendAiLoading, setTrendAiLoading] = useState(false)
  const [trendAiError, setTrendAiError] = useState('')

  const trendLocalAgg = useMemo(() => aggregateLocalErrors(results || []), [results])
  const trendRadarData = useMemo(() => buildTrendRadarData(trendLocalAgg), [trendLocalAgg])
  const trendBarData = trendAiData?.aggregates?.length
    ? trendAiData.aggregates.map(a => ({ topic: a.concept_id, total: a.total, ...a.by_type }))
    : trendLocalAgg

  async function fetchTrendAI() {
    if (!user?.id) return
    setTrendAiLoading(true); setTrendAiError('')
    const { data, error } = await analyzeErrorPatterns()
    setTrendAiLoading(false)
    if (error) { setTrendAiError(typeof error === 'string' ? error : 'Không thể phân tích lúc này.'); return }
    if (data) setTrendAiData(data)
  }

  useEffect(() => {
    if (activeTab === 'trends' && user?.id && results?.length >= 3 && !trendAiData) fetchTrendAI()
  }, [activeTab, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <motion.div variants={pageVariants} initial="hidden" animate="show" exit="exit"
      className="min-h-screen bg-surface pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-20">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate('/exams')} className="font-sans text-[13px] text-dim hover:text-muted transition">
            ← Quay lại
          </button>
        </div>
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="font-sans text-[28px] font-bold text-foreground">Sổ tay sai lầm</h1>
            <p className="font-sans text-[13px] text-dim mt-1">
              {questions.length === 0 ? 'Đang tải...' : totalMistakes === 0 ? 'Chưa có câu sai nào!' : `${totalMistakes} câu đã làm sai`}
            </p>
          </div>
          {totalMistakes > 0 && (
            <div className="flex flex-col gap-2 items-end">
              <button
                onClick={() => navigate('/battle')}
                className="px-4 py-2 rounded-xl font-sans text-[12px] font-bold bg-primary text-background"
              >
                Chiến đấu 🔥
              </button>
              <button
                onClick={() => navigate('/exams?mode=practice')}
                className="px-4 py-1.5 rounded-lg font-sans text-[11px] text-dim hover:text-muted border border-surface transition"
              >
                Luyện từ lỗi sai
              </button>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border mb-6">
          {[
            { id: 'recent', label: 'Câu sai gần đây' },
            { id: 'trends', label: 'Xu hướng lỗi sai' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-sans text-[0.8125rem] font-medium border-b-2 -mb-px transition ${
                activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-dim hover:text-muted'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'recent' && (<>
        {/* Weekly AI category summary */}
        {weeklyCategorySummary.length > 0 && (
          <div className="mb-4 px-4 py-3 rounded-xl glass-base border border-surface flex flex-wrap items-center gap-2">
            <span className="font-sans text-[11px] font-semibold text-dim uppercase tracking-wider mr-1">Tuần này:</span>
            {weeklyCategorySummary.map(([cat, count]) => {
              const meta = AI_CATEGORY_META[cat]
              if (!meta) return null
              return (
                <span key={cat} className="font-sans text-[12px] font-medium"
                  style={{ color: meta.color }}>
                  {count} lỗi {meta.label.toLowerCase()}
                </span>
              )
            }).filter(Boolean).reduce((acc, el, i) => i === 0 ? [el] : [...acc, <span key={`sep-${i}`} className="text-border">·</span>, el], [])}
          </div>
        )}

        {/* AI category filter chips */}
        {Object.keys(aiCategories).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setFilterCategory(null)}
              className={`h-7 px-3 rounded-full font-sans text-[11px] font-medium border transition ${
                !filterCategory ? 'border-info bg-info/10 text-info' : 'border-surface text-dim'
              }`}
            >AI: Tất cả</button>
            {Object.keys(AI_CATEGORY_META).filter(cat => Object.values(aiCategories).includes(cat)).map(cat => {
              const meta = AI_CATEGORY_META[cat]
              const count = Object.values(aiCategories).filter(c => c === cat).length
              return (
                <button key={cat}
                  onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                  className="h-7 px-3 rounded-full font-sans text-[11px] font-medium border transition"
                  style={filterCategory === cat
                    ? { borderColor: meta.color, background: meta.color + '22', color: meta.color }
                    : { borderColor: 'var(--border)', color: 'var(--fg-tertiary)' }}
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
              className={`h-8 px-3 rounded-full font-sans text-[12px] font-medium border transition ${
                !filterTopic ? 'border-primary bg-primary/10 text-primary' : 'border-surface text-dim'
              }`}
            >Tất cả</button>
            {topics.map(t => (
              <button
                key={t}
                onClick={() => setFilterTopic(filterTopic === t ? null : t)}
                className={`h-8 px-3 rounded-full font-sans text-[12px] font-medium border transition ${
                  filterTopic === t ? 'border-primary bg-primary/10 text-primary' : 'border-surface text-dim'
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
            <p className="font-sans text-[15px] text-muted">Chưa có câu sai nào — hãy làm một bài thi!</p>
            <button
              onClick={() => navigate('/exams')}
              className="px-5 py-2 rounded-xl font-sans text-[13px] font-bold mt-2 bg-primary text-background"
            >
              Chọn đề thi
            </button>
          </div>
        )}

        {/* Error patterns — systematic wrong choices */}
        {errorPatterns.length > 0 && !filterTopic && (
          <div className="mb-8 glass-base border border-info/20 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="font-sans text-[12px] font-bold text-info/80 uppercase tracking-wider">Lỗi hệ thống</span>
              <span className="font-sans text-[11px] text-dim">Những lựa chọn bạn lặp lại ≥{PATTERN_THRESHOLD} lần</span>
            </div>
            <div className="flex flex-col gap-3">
              {errorPatterns.map((p, i) => (
                <div key={`${p.question.id}-${p.wrongChoiceIndex}`} className="flex flex-col gap-1.5 px-4 py-3 rounded-xl bg-info/5 border border-info/20">
                  <MathText className="font-sans text-[13px] text-foreground line-clamp-2">{p.question.question}</MathText>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/30 text-destructive">
                      Hay chọn nhầm: <MathText>{p.wrongChoiceText.slice(0, 40)}</MathText>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-success/5 border border-success/20 text-success">
                      Đúng: <MathText>{p.correctText.slice(0, 40)}</MathText>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-info/5 border border-info/20 text-info/80">
                      {p.occurrences} lần
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-surface border border-surface text-dim">
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
              <span className="font-sans text-[12px] font-bold text-muted uppercase tracking-wider">
                {TOPIC_LABELS[topic] ?? topic}
              </span>
              <span className="font-sans text-[11px] text-dim">{topicEntries.length} câu</span>
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
                  className="font-sans text-[12px] text-center py-2 rounded-xl border border-dashed border-surface text-dim hover:text-muted transition">
                  + Xem thêm ({hiddenCount} câu)
                </button>
              )}
            </div>
          </div>
          )
        })}
        </>)}

        {/* ── Xu hướng lỗi sai ── */}
        {activeTab === 'trends' && (
          <div className="flex flex-col gap-6 pt-2">
            {results.length < 2 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <span className="text-4xl">📊</span>
                <span className="font-sans text-[18px] font-bold text-foreground">Cần thêm dữ liệu</span>
                <p className="font-sans text-[13px] text-dim max-w-xs">Hoàn thành ít nhất 2 bài thi để xem xu hướng lỗi sai.</p>
                <button onClick={() => navigate('/exams')}
                  className="px-5 py-2.5 rounded-xl font-sans text-[13px] font-bold bg-primary text-background">
                  Vào thi ngay
                </button>
              </div>
            ) : (<>
              {/* Error DNA Radar */}
              <div className="glass-base border border-surface rounded-2xl p-6">
                <h2 className="font-sans text-[16px] font-bold text-foreground mb-1">DNA lỗi sai</h2>
                <p className="font-sans text-[12px] text-dim mb-5">Hồ sơ loại lỗi từ toàn bộ lịch sử thi</p>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={trendRadarData}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="type" tick={{ fontSize: 11, fill: 'var(--muted-fg)', fontFamily: 'Sora, sans-serif' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Bạn" dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Bar chart */}
              <div className="glass-base border border-surface rounded-2xl p-6">
                <h2 className="font-sans text-[16px] font-bold text-foreground mb-1">Lỗi theo chủ đề</h2>
                <p className="font-sans text-[12px] text-dim mb-5">Trọng số theo độ gần đây</p>
                {trendBarData.length === 0 ? (
                  <p className="font-sans text-[13px] text-dim text-center py-8">Chưa có dữ liệu.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={trendBarData} margin={{ left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="topic" tickFormatter={t => TOPIC_VI_TREND[t] || t}
                        tick={{ fontSize: 10, fill: 'var(--muted-fg)', fontFamily: 'Sora, sans-serif' }}
                        interval={0} angle={-35} textAnchor="end" height={55} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--muted-fg)' }} />
                      <Tooltip contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        labelFormatter={t => TOPIC_VI_TREND[t] || t} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {ERROR_TYPES_TREND.map(et => (
                        <Bar key={et.id} dataKey={et.id} name={et.label} stackId="a" fill={et.color}
                          radius={et.id === 'calculation' ? [4, 4, 0, 0] : undefined} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* AI Misconception report */}
              <div className="glass-base border border-surface rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-sans text-[16px] font-bold text-foreground">Chẩn đoán AI</h2>
                    <p className="font-sans text-[12px] text-dim mt-0.5">Top 3 hiểu lầm cốt lõi · ⚡2 lượt hỏi AI</p>
                  </div>
                  {!trendAiData?.misconceptions?.length && !trendAiLoading && (
                    <button onClick={fetchTrendAI}
                      className="px-4 py-2 rounded-lg font-sans text-[12px] font-bold bg-primary text-background">
                      Phân tích ngay
                    </button>
                  )}
                </div>
                {trendAiLoading && (
                  <div className="flex items-center gap-2 py-6">
                    <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                    <span className="font-sans text-[13px] text-dim">AI đang phân tích lỗi sai của bạn...</span>
                  </div>
                )}
                {trendAiError && <p className="font-sans text-[12px] text-destructive py-3">{trendAiError}</p>}
                {trendAiData?.misconceptions?.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {trendAiData.misconceptions.map((m, i) => (
                      <div key={i} className="flex gap-4 p-4 rounded-xl bg-surface border border-surface">
                        <span className="text-2xl mt-0.5">{'🔍🧩🎯'[i]}</span>
                        <div className="flex flex-col gap-1">
                          <span className="font-sans text-[11px] font-bold text-[var(--accent)] uppercase tracking-wide">{m.concept || `Hiểu lầm ${i + 1}`}</span>
                          <p className="font-sans text-[13px] text-foreground">{m.misconception}</p>
                          <p className="font-sans text-[12px] text-dim">💡 {m.suggestion}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (!trendAiLoading && !trendAiError && (
                  <p className="font-sans text-[13px] text-dim py-4 text-center">
                    Nhấn "Phân tích ngay" để AI xác định hiểu lầm cốt lõi của bạn.
                  </p>
                ))}
              </div>
            </>)}
          </div>
        )}
      </div>
    </motion.div>
  )
}

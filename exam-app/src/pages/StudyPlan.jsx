import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import Markdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { useHistory } from '../context/HistoryContext.jsx'
import { generateStudyPlan, generateWeekQuiz } from '../api/aiClient.js'
import { buildStudyPlanPayload } from '../api/index.js'

const STORAGE_KEY      = (id) => `study-plan-progress-${id}`
const PLAN_CACHE_KEY   = (id) => `study-plan-data-${id}`
const QUIZ_CACHE_KEY   = (id, w) => `study-plan-quiz-${id}-${w}`

const REMARK_MATH_OPTS = [remarkMath, { singleDollarTextMath: true }]

const DIFF_COLOR = { easy: '#10B981', medium: '#F2A20C', hard: '#EF4444' }
const DIFF_LABEL = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' }

// Inline context: stem, choices, tasks — wraps paragraphs in <span> to avoid block gaps.
// GFM enabled so markdown tables inside stems render instead of showing raw pipe characters.
function MathText({ children }) {
  return (
    <Markdown
      remarkPlugins={[REMARK_MATH_OPTS, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p:     ({ children: c }) => <span>{c}</span>,
        table: ({ children: c }) => (
          <div className="overflow-x-auto my-2">
            <table className="border-collapse text-[12px] w-full">{c}</table>
          </div>
        ),
        th: ({ children: c }) => (
          <th className="border border-[#2A3A5E] px-3 py-1.5 font-semibold text-[#CBD5E1] text-left bg-[#111827]">{c}</th>
        ),
        td: ({ children: c }) => (
          <td className="border border-[#2A3A5E] px-3 py-1.5 text-[#94A3B8]">{c}</td>
        ),
      }}
    >
      {children ?? ''}
    </Markdown>
  )
}

// Block context: plan overview, explanations — preserves paragraph breaks and renders tables
function MathBlock({ children }) {
  return (
    <Markdown
      remarkPlugins={[REMARK_MATH_OPTS, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p:      ({ children: c }) => <p className="mb-2 last:mb-0">{c}</p>,
        strong: ({ children: c }) => <strong className="font-semibold text-[#CBD5E1]">{c}</strong>,
        em:     ({ children: c }) => <em className="italic">{c}</em>,
        ul:     ({ children: c }) => <ul className="list-disc pl-5 space-y-1">{c}</ul>,
        ol:     ({ children: c }) => <ol className="list-decimal pl-5 space-y-1">{c}</ol>,
        li:     ({ children: c }) => <li className="leading-relaxed">{c}</li>,
        table:  ({ children: c }) => (
          <div className="overflow-x-auto my-2">
            <table className="border-collapse text-[12px] w-full">{c}</table>
          </div>
        ),
        th: ({ children: c }) => (
          <th className="border border-[#2A3A5E] px-3 py-1.5 font-semibold text-[#CBD5E1] text-left bg-[#111827]">{c}</th>
        ),
        td: ({ children: c }) => (
          <td className="border border-[#2A3A5E] px-3 py-1.5 text-[#94A3B8]">{c}</td>
        ),
      }}
    >
      {children ?? ''}
    </Markdown>
  )
}

function ProgressDots({ tasks, checked, onToggle }) {
  return (
    <div className="flex flex-col gap-2.5 mt-3">
      {tasks.map((task, i) => (
        <label key={i} className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={!!checked[i]}
            onChange={() => onToggle(i)}
            className="mt-0.5 flex-shrink-0 accent-[#F2A20C]"
          />
          <span className={`font-jakarta text-[13px] leading-relaxed transition ${checked[i] ? 'line-through text-[#475569]' : 'text-[#94A3B8] group-hover:text-[#F8FAFC]'}`}>
            <MathText>{task}</MathText>
          </span>
        </label>
      ))}
    </div>
  )
}

// ── Quiz components ──────────────────────────────────────────────────────────

// Pre-render guard: verifies every required field before a question reaches the DOM.
// Returns { valid: boolean, issues: string[] }. Hard failures drop the question;
// soft mismatches are logged but still render (math was validated server-side).
function validateQuestion(q) {
  const issues = []
  if (!q || typeof q !== 'object') return { valid: false, issues: ['not an object'] }
  if (typeof q.correct_index !== 'number' || q.correct_index < 0 || q.correct_index > 3)
    issues.push(`correct_index out of range: ${q.correct_index}`)
  if (!Array.isArray(q.choices) || q.choices.length !== 4)
    issues.push(`expected 4 choices, got ${Array.isArray(q.choices) ? q.choices.length : typeof q.choices}`)
  else if (!q.choices.every(c => typeof c === 'string' && c.trim()))
    issues.push('one or more choices are empty')
  if (!q.stem || typeof q.stem !== 'string' || !q.stem.trim())
    issues.push('stem is empty')
  if (!q.explanation || typeof q.explanation !== 'string' || !q.explanation.trim())
    issues.push('explanation is missing')
  else if (!q.explanation.includes('Đáp án đúng'))
    issues.push('explanation missing "Đáp án đúng" section')
  return { valid: issues.length === 0, issues }
}

// Formats explanation: removes any [bracket labels], bolds "Đáp án đúng:" so the
// correct answer is clearly stated, and splits each trap into its own paragraph.
function formatExplanation(raw) {
  if (!raw) return raw
  return raw
    .replace(/\s*\[[^\]]+\]/g, '')                                  // remove any [bracket content]
    .replace(/\s+:/g, ':')                                           // fix "Bẫy B :" → "Bẫy B:"
    .replace(/Đáp án đúng\s*:\s*[A-D]\.?\s*/gi, '')                // strip "Đáp án đúng: X." — header badge already shows it
    .replace(/(\.?\s*)(Bẫy\s+[A-D]\s*:)/g, '\n\n**$2**')           // separate paragraph + bold each trap
    .trim()
}

function QuizQuestion({ q, index, chosen, submitted, onChoose }) {
  const correct = q.correct_index
  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="font-jakarta text-[11px] font-semibold text-[#475569]">Câu {index + 1}</span>
        {q.difficulty && (
          <span
            className="font-jakarta text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ color: DIFF_COLOR[q.difficulty], background: `${DIFF_COLOR[q.difficulty]}18` }}
          >
            {DIFF_LABEL[q.difficulty] ?? q.difficulty}
          </span>
        )}
      </div>

      {/* Stem */}
      <div className="font-jakarta text-[14px] text-[#CBD5E1] leading-relaxed">
        <MathText>{q.stem}</MathText>
      </div>

      {/* Choices */}
      <div className="flex flex-col gap-2">
        {q.choices.map((choice, ci) => {
          const isChosen  = chosen === ci
          const isCorrect = ci === correct
          let bg = '#111827'
          let border = '#1E2A44'
          let textColor = '#94A3B8'

          if (submitted) {
            if (isCorrect)       { bg = '#10B98118'; border = '#10B981'; textColor = '#10B981' }
            else if (isChosen)   { bg = '#EF444418'; border = '#EF4444'; textColor = '#EF4444' }
          } else if (isChosen) {
            bg = '#6366F118'; border = '#6366F1'; textColor = '#A5B4FC'
          }

          return (
            <button
              key={ci}
              type="button"
              disabled={submitted}
              onClick={() => onChoose(ci)}
              className="w-full text-left px-4 py-2.5 rounded-lg border font-jakarta text-[13px] transition-all"
              style={{ background: bg, borderColor: border, color: textColor }}
            >
              <MathText>{choice}</MathText>
            </button>
          )
        })}
      </div>

      {/* Explanation after submit */}
      {submitted && q.explanation && (
        <div className="rounded-lg border border-[#2A3A5E] bg-[#0A0F1E] px-4 py-3 font-jakarta text-[12px] leading-relaxed">
          {/* Correct answer header */}
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#1E2A44]">
            <span className="text-[10px] font-bold text-[#10B981] px-1.5 py-0.5 rounded bg-[#10B98118] border border-[#10B98140]">
              Đáp án {String.fromCharCode(65 + correct)}
            </span>
            <span className="text-[#94A3B8] text-[11px]">
              <MathText>{q.choices[correct]?.replace(/^[A-D]\.\s*/, '')}</MathText>
            </span>
          </div>
          {/* Step-by-step + trap breakdown */}
          <div className="text-[#64748B]">
            <MathBlock>{formatExplanation(q.explanation)}</MathBlock>
          </div>
        </div>
      )}
    </div>
  )
}

function WeekQuiz({ resultId, weekIndex, weekFocus, weekTasks }) {
  const cacheKey = QUIZ_CACHE_KEY(resultId, weekIndex)

  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [questions, setQuestions] = useState(() => {
    try { return JSON.parse(localStorage.getItem(cacheKey) || 'null') } catch { return null }
  })
  const [answers, setAnswers]     = useState({})   // { qIndex: choiceIndex }
  const [submitted, setSubmitted] = useState(false)

  async function fetchQuiz() {
    setLoading(true)
    setError(null)
    const { data, error: err } = await generateWeekQuiz({
      week_focus: weekFocus,
      week_tasks: weekTasks,
      n: 4,
    })
    setLoading(false)
    if (err) { setError(err); return }
    const raw = data?.questions ?? []
    const qs = raw.filter(q => {
      const { valid, issues } = validateQuestion(q)
      if (!valid) console.warn('[quiz-validate] dropped question:', issues, q)
      return valid
    })
    localStorage.setItem(cacheKey, JSON.stringify(qs))
    setQuestions(qs)
    setAnswers({})
    setSubmitted(false)
  }

  function handleOpen() {
    setOpen(true)
    if (!questions) fetchQuiz()
  }

  function handleReset() {
    localStorage.removeItem(cacheKey)
    setQuestions(null)
    setAnswers({})
    setSubmitted(false)
    fetchQuiz()
  }

  const allAnswered = questions && Object.keys(answers).length === questions.length
  const score = submitted
    ? questions.filter((q, i) => answers[i] === q.correct_index).length
    : 0

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#2A3A5E] font-jakarta text-[13px] font-semibold text-[#6366F1] hover:bg-[#6366F108] transition"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        Kiểm tra kiến thức tuần này
      </button>
    )
  }

  return (
    <div className="mt-5 flex flex-col gap-4">
      {/* Quiz header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-fraunces text-[14px] font-semibold text-[#F8FAFC]">Kiểm tra nhanh</span>
          <span className="font-jakarta text-[11px] text-[#475569] px-2 py-0.5 rounded-full bg-[#111827] border border-[#1E2A44]">
            Không dùng máy tính
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-jakarta text-[12px] text-[#475569] hover:text-[#94A3B8] transition"
        >
          Thu gọn
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-6 justify-center font-jakarta text-[13px] text-[#475569] animate-pulse">
          <span className="w-2 h-2 rounded-full bg-[#6366F1] animate-bounce" />
          Oracle đang tạo câu hỏi…
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 px-4 py-3 flex items-center justify-between gap-4">
          <span className="font-jakarta text-[13px] text-[#EF4444]">{error}</span>
          <button
            type="button"
            onClick={fetchQuiz}
            className="shrink-0 px-3 py-1.5 rounded-lg font-jakarta text-[12px] font-semibold text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/10 transition"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Questions */}
      {questions && !loading && (
        <>
          <div className="flex flex-col gap-6">
            {questions.map((q, i) => (
              <div key={i} className="rounded-xl border border-[#1E2A44] bg-[#0A0F1E] p-4">
                <QuizQuestion
                  q={q}
                  index={i}
                  chosen={answers[i] ?? null}
                  submitted={submitted}
                  onChoose={(ci) => !submitted && setAnswers(a => ({ ...a, [i]: ci }))}
                />
              </div>
            ))}
          </div>

          {/* Score banner */}
          {submitted && (
            <div
              className="rounded-xl px-5 py-4 flex items-center justify-between"
              style={{
                border: `1px solid ${score === questions.length ? '#10B98140' : score >= questions.length / 2 ? '#F2A20C40' : '#EF444440'}`,
                background: score === questions.length ? '#10B98108' : score >= questions.length / 2 ? '#F2A20C08' : '#EF444408',
              }}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-fraunces text-[15px] font-semibold text-[#F8FAFC]">
                  {score}/{questions.length} câu đúng
                </span>
                <span className="font-jakarta text-[12px] text-[#64748B]">
                  {score === questions.length
                    ? 'Xuất sắc! Bạn đã nắm vững kiến thức tuần này.'
                    : score >= questions.length / 2
                    ? 'Khá tốt! Ôn lại những câu chưa đúng.'
                    : 'Cần ôn thêm — xem giải thích từng câu bên trên.'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="font-jakarta text-[12px] font-semibold text-[#6366F1] hover:underline transition"
              >
                Làm lại
              </button>
            </div>
          )}

          {/* Submit / next */}
          {!submitted && (
            <button
              type="button"
              disabled={!allAnswered}
              onClick={() => setSubmitted(true)}
              className="w-full py-2.5 rounded-xl font-jakarta text-[13px] font-bold disabled:opacity-40 transition"
              style={{ background: allAnswered ? 'linear-gradient(180deg,#6366F1 0%,#4F46E5 100%)' : '#111827', color: allAnswered ? '#fff' : '#475569', border: allAnswered ? 'none' : '1px solid #1E2A44' }}
            >
              {allAnswered ? 'Nộp bài kiểm tra' : `Còn ${questions.length - Object.keys(answers).length} câu chưa trả lời`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── Page skeleton ────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      <div className="h-8 w-48 bg-[#111827] rounded" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-9 w-20 bg-[#111827] rounded-lg" />)}
      </div>
      <div className="h-40 bg-[#0D1221] border border-[#1E2A44] rounded-2xl" />
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function StudyPlan() {
  const navigate = useNavigate()
  const { resultId } = useParams()
  const location = useLocation()
  const { results } = useHistory()
  const [plan, setPlan]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const [activeWeek, setActiveWeek] = useState(0)
  const [progress, setProgress] = useState({})

  const result  = location.state?.result  || results.find(r => r.id === resultId)
  const history = location.state?.history || results.filter(r => r.id !== resultId)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY(resultId))
    if (saved) setProgress(JSON.parse(saved))
  }, [resultId])

  useEffect(() => {
    if (!result) return
    const cacheKey = PLAN_CACHE_KEY(resultId)
    const cached = localStorage.getItem(cacheKey)
    if (cached) { setPlan(JSON.parse(cached)); setLoading(false); return }
    setLoading(true)
    generateStudyPlan(buildStudyPlanPayload(result, history)).then(({ data, error: err }) => {
      setLoading(false)
      if (data) { localStorage.setItem(cacheKey, JSON.stringify(data)); setPlan(data) }
      else setError(true)
    })
  }, [resultId]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleTask(weekIdx, taskIdx) {
    setProgress(prev => {
      const next = { ...prev, [weekIdx]: { ...prev[weekIdx], [taskIdx]: !prev[weekIdx]?.[taskIdx] } }
      localStorage.setItem(STORAGE_KEY(resultId), JSON.stringify(next))
      return next
    })
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center gap-4">
        <p className="font-jakarta text-[#94A3B8]">Không tìm thấy kết quả</p>
        <button onClick={() => navigate('/history')} className="font-jakarta text-sm text-[#F2A20C] underline">
          Xem lịch sử
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col">
      <nav className="flex items-center justify-between px-8 bg-[#0D1221] border-b border-[#1E2A44]" style={{ height: 64 }}>
        <button onClick={() => navigate(-1)} className="font-jakarta text-[13px] text-[#94A3B8] hover:text-[#F8FAFC] transition">
          ← Quay lại
        </button>
        <span className="font-jakarta text-[14px] font-semibold text-[#F8FAFC]">Kế hoạch học tập</span>
        <div className="w-20" />
      </nav>

      <div className="flex flex-col gap-7 max-w-2xl mx-auto w-full px-4 py-10">
        {loading ? (
          <Skeleton />
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <p className="font-jakarta text-[#94A3B8]">Không thể tạo kế hoạch học tập</p>
            <button
              onClick={() => {
                setError(false); setLoading(true)
                generateStudyPlan(buildStudyPlanPayload(result, history)).then(({ data }) => {
                  setLoading(false)
                  if (data) setPlan(data); else setError(true)
                })
              }}
              className="px-5 py-2.5 rounded-xl font-jakarta text-[13px] font-semibold text-[#0A0E1A]"
              style={{ background: 'linear-gradient(180deg, #F2A20C 0%, #D97706 100%)' }}
            >
              Thử lại
            </button>
          </div>
        ) : plan ? (
          <>
            {/* Overview */}
            <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[#F2A20C]">✦</span>
                <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">Tổng quan</span>
              </div>
              <div className="font-jakarta text-[13px] text-[#94A3B8] leading-relaxed">
                <MathBlock>{plan.plan}</MathBlock>
              </div>
            </div>

            {/* Week tabs */}
            <div className="flex gap-2 flex-wrap">
              {plan.weekly_schedule.map((w, i) => (
                <button
                  key={i}
                  onClick={() => setActiveWeek(i)}
                  className={`px-4 py-2 rounded-lg font-jakarta text-[12px] font-semibold transition ${
                    activeWeek === i ? 'text-[#0A0E1A]' : 'bg-[#111827] border border-[#1E2A44] text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                  style={activeWeek === i ? { background: 'linear-gradient(180deg, #F2A20C 0%, #D97706 100%)' } : {}}
                >
                  Tuần {w.week}
                </button>
              ))}
            </div>

            {/* Active week */}
            {plan.weekly_schedule[activeWeek] && (() => {
              const w = plan.weekly_schedule[activeWeek]
              const weekProgress = progress[activeWeek] || {}
              const done = w.tasks.filter((_, i) => weekProgress[i]).length
              return (
                <div className="bg-[#0D1221] border border-[#1E2A44] rounded-2xl p-7">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-fraunces text-[16px] font-semibold text-[#F8FAFC]">
                      Tuần {w.week}: <MathText>{w.focus}</MathText>
                    </span>
                    <span className="font-jakarta text-[12px] text-[#475569]">{done}/{w.tasks.length}</span>
                  </div>
                  <div className="h-1 bg-[#1E2A44] rounded-full mb-4">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(done / w.tasks.length) * 100}%`, background: 'linear-gradient(90deg, #F2A20C, #10B981)' }}
                    />
                  </div>
                  <ProgressDots
                    tasks={w.tasks}
                    checked={weekProgress}
                    onToggle={(taskIdx) => toggleTask(activeWeek, taskIdx)}
                  />

                  {/* Divider */}
                  <div className="mt-6 border-t border-[#1E2A44]" />

                  {/* Per-week quiz — key forces remount on week change so state doesn't bleed */}
                  <WeekQuiz
                    key={activeWeek}
                    resultId={resultId}
                    weekIndex={activeWeek}
                    weekFocus={w.focus}
                    weekTasks={w.tasks}
                  />
                </div>
              )
            })()}
          </>
        ) : null}
      </div>
    </div>
  )
}

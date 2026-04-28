import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Markdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import 'mathlive'
import { solveMath, getMathStats } from '../api/aiClient'
import SymbolPalette from '../components/SymbolPalette'

// One level of nested braces — handles \frac{\sqrt{x}}{2} correctly
const BARE_LATEX_RE = /\\[a-zA-Z]+(?:\{(?:[^{}]|\{[^{}]*\})*\}|\[[^\]]*\])*/g

// Wraps bare LaTeX commands (no surrounding $) in $...$ so remark-math picks them up.
// Safe to run on mixed prose+math strings: only the LaTeX tokens get wrapped.
function normalizeMath(text) {
  if (!text) return ''
  if (text.includes('$')) return text       // already delimited — leave alone
  if (!/\\[a-zA-Z]/.test(text)) return text // no LaTeX commands — plain text, leave alone
  BARE_LATEX_RE.lastIndex = 0
  return text.replace(BARE_LATEX_RE, m => `$${m}$`)
}

// ── Paste normalisation ──────────────────────────────────────────────────────
// Converts clipboard text from external sources (PDFs, websites, Word/MathType)
// into LaTeX that MathLive can render.

const SUPERSCRIPT_MAP = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','ⁿ':'n','ⁱ':'i'}
const SUBSCRIPT_MAP   = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'}
const UNICODE_LATEX   = {
  // Greek lowercase
  'α':'\\alpha','β':'\\beta','γ':'\\gamma','δ':'\\delta','ε':'\\epsilon',
  'ζ':'\\zeta','η':'\\eta','θ':'\\theta','ι':'\\iota','κ':'\\kappa',
  'λ':'\\lambda','μ':'\\mu','ν':'\\nu','ξ':'\\xi','π':'\\pi',
  'ρ':'\\rho','σ':'\\sigma','τ':'\\tau','υ':'\\upsilon','φ':'\\phi',
  'χ':'\\chi','ψ':'\\psi','ω':'\\omega',
  // Greek uppercase
  'Γ':'\\Gamma','Δ':'\\Delta','Θ':'\\Theta','Λ':'\\Lambda','Ξ':'\\Xi',
  'Π':'\\Pi','Σ':'\\Sigma','Υ':'\\Upsilon','Φ':'\\Phi','Ψ':'\\Psi','Ω':'\\Omega',
  // Operators & relations
  '√':'\\sqrt','∞':'\\infty','±':'\\pm','×':'\\times','÷':'\\div','·':'\\cdot',
  '≤':'\\leq','≥':'\\geq','≠':'\\neq','≈':'\\approx','≡':'\\equiv',
  '∈':'\\in','∉':'\\notin','⊂':'\\subset','⊆':'\\subseteq',
  '∪':'\\cup','∩':'\\cap','∅':'\\emptyset',
  '∑':'\\sum','∏':'\\prod','∫':'\\int','∂':'\\partial','∇':'\\nabla',
  '→':'\\to','←':'\\leftarrow','↔':'\\leftrightarrow',
  '⇒':'\\Rightarrow','⇔':'\\Leftrightarrow',
  '∀':'\\forall','∃':'\\exists',
  // Unicode fractions
  '½':'\\frac{1}{2}','⅓':'\\frac{1}{3}','⅔':'\\frac{2}{3}',
  '¼':'\\frac{1}{4}','¾':'\\frac{3}{4}',
  // Misc
  '…':'\\ldots','·':'\\cdot',
}

function clipboardToLatex(raw) {
  let text = raw.trim()

  // 1. Strip common LaTeX delimiters ($$…$$, $…$, \[…\], \(…\))
  const delim = text.match(/^\$\$([^]*)\$\$$/)
    || text.match(/^\$([^]*)\$$/)
    || text.match(/^\\\[([^]*)\\\]$/)
    || text.match(/^\\\(([^]*)\\\)$/)
  if (delim) text = delim[1].trim()

  // 2. Convert consecutive unicode superscript digits → ^{…}
  text = text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱ]+/g,
    m => `^{${[...m].map(c => SUPERSCRIPT_MAP[c] ?? c).join('')}}`)

  // 3. Convert consecutive unicode subscript digits → _{…}
  text = text.replace(/[₀₁₂₃₄₅₆₇₈₉]+/g,
    m => `_{${[...m].map(c => SUBSCRIPT_MAP[c] ?? c).join('')}}`)

  // 4. Replace unicode math symbols with LaTeX equivalents
  text = text.replace(
    /[αβγδεζηθικλμνξπρστυφχψωΓΔΘΛΞΠΣΥΦΨΩ√∞±×÷·≤≥≠≈≡∈∉⊂⊆∪∩∅∑∏∫∂∇→←↔⇒⇔∀∃½⅓⅔¼¾…]/g,
    c => UNICODE_LATEX[c] ?? c,
  )

  // 5. Normalise Unicode minus (−, en-dash) → ASCII hyphen-minus for LaTeX
  text = text.replace(/[−–]/g, '-')

  return text
}

const MATHFIELD_CSS = `
  math-field {
    display: block;
    width: 100%;
    background: transparent;
    color: #E2E8F0;
    font-size: 15px;
    min-height: 56px;
    padding: 16px 20px 12px;
    box-sizing: border-box;
    outline: none;
    --caret-color: #E2E8F0;
    --selection-background-color: rgba(99,102,241,0.3);
    --placeholder-color: #334155;
    --contains-highlight-background-color: rgba(99,102,241,0.15);
  }
  math-field::part(virtual-keyboard-toggle) { display: none; }
  math-field::part(menu-toggle) { display: none; }
`

function MathText({ children, inline = false }) {
  const normalized = normalizeMath(children ?? '')
  const pTag = inline
    ? ({ children: c }) => <span>{c}</span>
    : ({ children: c }) => <p className="mb-1 last:mb-0">{c}</p>
  return (
    <Markdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{ p: pTag }}
    >
      {normalized}
    </Markdown>
  )
}

const CONFIDENCE_COLOR = { high: '#10B981', medium: '#F2A20C', low: '#EF4444' }
const CONFIDENCE_LABEL = { high: 'Chắc chắn', medium: 'Khả năng cao', low: 'Không chắc' }

function StepList({ steps }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 items-start">
          <span className="shrink-0 w-6 h-6 rounded-full bg-[#F2A20C]/15 border border-[#F2A20C]/30 text-[#F2A20C] text-[11px] font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <div className="font-jakarta text-[15px] text-[#CBD5E1] leading-relaxed">
            <MathText>{s}</MathText>
          </div>
        </li>
      ))}
    </ol>
  )
}

function StatsBadge({ stats }) {
  if (!stats) return null
  const total = stats.wiki_units || 0
  const problems = stats.problems || 0
  const topics = Object.keys(stats.topics || {}).length
  return (
    <div className="flex items-center gap-3 font-jakarta text-[12px] text-[#475569]">
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
        {total.toLocaleString()} wiki units
      </span>
      <span>·</span>
      <span>{problems.toLocaleString()} bài toán</span>
      <span>·</span>
      <span>{topics} chủ đề</span>
    </div>
  )
}

function AnswerCard({ result }) {
  const answer = result.answer || {}
  const validation = result.validation || {}
  const confidence = answer.confidence || 'low'
  const showUnverifiedWarning = confidence === 'low' && !validation.valid

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      {/* Answer header */}
      <div className="flex items-start justify-between gap-4 rounded-xl border border-[#2A3A5E] bg-[#0F1726] p-5">
        <div className="flex flex-col gap-1">
          <span className="font-jakarta text-[11px] font-semibold text-[#475569] tracking-widest uppercase">Đáp án</span>
          <div className="font-fraunces text-2xl text-[#F8FAFC] leading-snug">
            <MathText inline>{answer.final_answer}</MathText>
          </div>
          <span className="font-jakarta text-[12px] text-[#475569] mt-1 capitalize">{answer.problem_type?.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {!result.wiki_assisted && (
            <span className="font-jakarta text-[11px] font-semibold tracking-widest uppercase"
              style={{ color: '#6366F1', opacity: 0.7 }}>
              AI trực tiếp
            </span>
          )}
          <span className="font-jakarta text-[11px] font-semibold tracking-widest uppercase"
            style={{ color: CONFIDENCE_COLOR[confidence] }}>
            {CONFIDENCE_LABEL[confidence]}
          </span>
          {!validation.valid && validation.issues?.length > 0 && (
            <span className="font-jakarta text-[11px] text-[#EF4444]">⚠ {validation.issues[0]}</span>
          )}
        </div>
      </div>

      {/* Unverified warning banner */}
      {showUnverifiedWarning && (
        <div className="rounded-xl border border-[#F2A20C]/30 bg-[#F2A20C]/5 px-4 py-3 font-jakarta text-[13px] text-[#F2A20C]">
          Kết quả chưa được xác minh — kiểm tra lại cẩn thận
        </div>
      )}

      {/* Steps */}
      {answer.steps?.length > 0 && (
        <div className="rounded-xl border border-[#2A3A5E] bg-[#0F1726] p-5">
          <p className="font-jakarta text-[11px] font-semibold text-[#475569] tracking-widest uppercase mb-4">Lời giải</p>
          <StepList steps={answer.steps} />
        </div>
      )}

      {/* Enrichment badge */}
      {result.enriched > 0 && (
        <div className="flex items-center gap-2 font-jakarta text-[12px] text-[#10B981]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shrink-0" />
          Oracle đã học thêm {result.enriched} đơn vị tri thức mới
          {result.enriched_topics?.length > 0 && ` (${result.enriched_topics.join(', ')})`}
        </div>
      )}

      {/* Knowledge used */}
      {result.retrieved_ids?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.retrieved_ids.map(id => (
            <span key={id} className="font-jakarta text-[11px] bg-[#141D2E] border border-[#2A3A5E] text-[#64748B] rounded-full px-3 py-1">
              {id}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MathOracle() {
  const navigate = useNavigate()
  const MAX_RETRIES = 2

  const [question, setQuestion] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [lastQuestion, setLastQuestion] = useState('')
  const mathfieldRef = useRef(null)
  const handleSubmitRef = useRef(null)

  useEffect(() => {
    getMathStats().then(({ data }) => { if (data) setStats(data) })
  }, [])

  // Keep submit handler ref fresh so the mathfield keydown listener never goes stale.
  useEffect(() => {
    handleSubmitRef.current = () => {
      const text = (mathfieldRef.current?.getValue() || '').trim()
      if (!text || loading) return
      setResult(null)
      setLastQuestion(text)
      doSolve(text)
    }
  })

  // Wire up input, Ctrl/Cmd+Enter, and smart paste on the math-field element.
  useEffect(() => {
    const mf = mathfieldRef.current
    if (!mf) return

    const onInput = () => setQuestion(mf.getValue() || '')

    const onKeydown = (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSubmitRef.current?.()
      }
    }

    const onPaste = (e) => {
      const raw = e.clipboardData?.getData('text/plain') ?? ''
      if (!raw.trim()) return          // let MathLive handle empty / non-text pastes
      e.preventDefault()
      const latex = clipboardToLatex(raw)
      mf.insert(latex, { format: 'latex', insertionMode: 'replaceAll' })
      setQuestion(mf.getValue() || '')
    }

    mf.addEventListener('input', onInput)
    mf.addEventListener('keydown', onKeydown)
    mf.addEventListener('paste', onPaste)
    return () => {
      mf.removeEventListener('input', onInput)
      mf.removeEventListener('keydown', onKeydown)
      mf.removeEventListener('paste', onPaste)
    }
  }, [])

  async function doSolve(text, attempt = 0) {
    setLoading(true)
    setError(null)
    setRetryAttempt(attempt)
    const { data, error: err } = await solveMath(text)
    if (err) {
      const isTimeout = /timed out|504|timeout/i.test(err)
      if (isTimeout && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000))
        return doSolve(text, attempt + 1)
      }
      setLoading(false)
      setRetryAttempt(0)
      setError(err)
      return
    }
    setLoading(false)
    setRetryAttempt(0)
    setResult(data)
  }

  function handleSolve(e) {
    e?.preventDefault()
    const text = (mathfieldRef.current?.getValue() || '').trim()
    if (!text || loading) return
    setResult(null)
    setLastQuestion(text)
    doSolve(text)
  }

  function handleInsert(s) {
    const mf = mathfieldRef.current
    if (!mf) return
    mf.insert(s.replace(/\|/g, '#?'), { format: 'latex', selectionMode: 'placeholder' })
    mf.focus()
    setQuestion(mf.getValue() || '')
  }

  return (
    <div className="min-h-screen relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse 120% 80% at 50% 0%, #1B2B4B 0%, #0A0E1A 60%)' }}>

      {/* Ambient glow */}
      <div className="absolute pointer-events-none rounded-full opacity-40"
        style={{ width: 600, height: 400, left: '50%', top: 0, transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, #6366F118 0%, transparent 70%)' }} />

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-12 flex flex-col gap-8">

        {/* Back */}
        <button onClick={() => navigate('/')}
          className="self-start font-jakarta text-sm text-[#475569] hover:text-[#94A3B8] transition flex items-center gap-1.5">
          ← Trang chủ
        </button>

        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="font-jakarta text-[10px] font-semibold text-[#6366F1] tracking-[3px] uppercase">
              Experimental · AI Knowledge System
            </span>
          </div>
          <h1 className="font-fraunces text-[52px] font-bold text-[#F8FAFC] leading-none tracking-tight">
            Toán Oracle
          </h1>
          <p className="font-jakarta text-[15px] text-[#64748B] leading-relaxed max-w-[480px]">
            Đặt câu hỏi toán — Oracle truy vấn kho tri thức và giải từng bước.
          </p>
          <StatsBadge stats={stats} />
        </div>

        {/* Input */}
        <style>{MATHFIELD_CSS}</style>
        <form onSubmit={handleSolve} className="flex flex-col gap-3">
          <div className="rounded-xl border border-[#2A3A5E] bg-[#0F1726] focus-within:border-[#6366F1] transition-colors overflow-hidden">
            <math-field
              ref={mathfieldRef}
              placeholder="Giải phương trình x² – 5x + 6 = 0…"
            />
            <SymbolPalette onInsert={handleInsert} />
            <div className="flex justify-end items-center gap-2 px-3 py-2 border-t border-[#2A3A5E]">
              <span className="font-jakarta text-[11px] text-[#334155]">⌘ Enter</span>
              <button type="submit" disabled={!question.trim() || loading}
                className="px-4 py-1.5 bg-[#6366F1] text-white font-jakarta font-semibold text-sm rounded-lg disabled:opacity-40 hover:bg-[#4F46E5] transition">
                {loading ? 'Đang tính…' : 'Giải'}
              </button>
            </div>
          </div>
          {question.trim() === '' && (
            <div className="flex flex-wrap gap-2">
              {[
                { insert: 'x^{2} - 5x + 6 = 0',              label: '$x^{2} - 5x + 6 = 0$' },
                { insert: '\\frac{1}{x} + \\frac{1}{x+1} = 1', label: '$\\frac{1}{x} + \\frac{1}{x+1} = 1$' },
                { insert: '\\sqrt{x+3} = x - 1',               label: '$\\sqrt{x+3} = x - 1$' },
              ].map(eg => (
                <button key={eg.insert} type="button"
                  onClick={() => {
                    const mf = mathfieldRef.current
                    if (mf) { mf.setValue(eg.insert); mf.focus() }
                    setQuestion(eg.insert)
                  }}
                  className="font-jakarta text-[12px] text-[#475569] border border-[#1E2D45] rounded-full px-3 py-1 hover:border-[#6366F1] hover:text-[#6366F1] transition">
                  <MathText inline>{eg.label}</MathText>
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 font-jakarta text-[14px] text-[#475569] animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#6366F1] animate-bounce" />
            {retryAttempt > 0
              ? `Đang thử lại sau timeout (lần ${retryAttempt + 1}/${MAX_RETRIES + 1})…`
              : 'Oracle đang truy vấn tri thức…'
            }
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 p-4 font-jakarta text-sm text-[#EF4444] flex items-center justify-between gap-4">
            <span>{error}</span>
            {/timed out|timeout/i.test(error) && lastQuestion && (
              <button
                onClick={() => { setError(null); doSolve(lastQuestion) }}
                className="shrink-0 px-3 py-1.5 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg text-[12px] font-semibold hover:bg-[#EF4444]/20 transition"
              >
                Thử lại
              </button>
            )}
          </div>
        )}

        {/* Result */}
        {result && <AnswerCard result={result} />}

        {/* Empty-DB notice when stats show 0 */}
        {stats?.wiki_units === 0 && !loading && !result && (
          <div className="rounded-xl border border-[#2A3A5E] bg-[#0F1726] p-5 flex items-start gap-4">
            <span className="text-2xl">🌱</span>
            <div>
              <p className="font-jakarta text-[13px] font-semibold text-[#94A3B8]">Wiki còn trống</p>
              <p className="font-jakarta text-[12px] text-[#475569] mt-0.5">
                Chạy <code className="text-[#6366F1]">node scripts/ingest/crawl-bridge.js</code> để nạp tri thức vào Oracle.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

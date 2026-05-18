import { useState, useEffect, useRef, useCallback } from 'react'
import { TOPIC_LABELS } from '../utils/topicLabels.js'
import { motion } from 'framer-motion'
import DOMPurify from 'dompurify'
import { useNavigate, useLocation } from 'react-router-dom'
import Markdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { solveMath, getMathStats, getWikiStatus, ocrImage, reviewMath, sendTutorMessage } from '../api/aiClient'
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
  '…':'\\ldots',
}


// Reverse of UNICODE_LATEX — only simple symbol commands, no structural ones.
// Used to make pasted text display with real symbols instead of \ commands.
const LATEX_UNICODE = {
  // Relations
  '\\geq':'≥','\\leq':'≤','\\neq':'≠','\\approx':'≈','\\equiv':'≡','\\sim':'∼',
  '\\gg':'≫','\\ll':'≪','\\propto':'∝','\\perp':'⊥','\\parallel':'∥',
  // Arithmetic
  '\\pm':'±','\\mp':'∓','\\times':'×','\\div':'÷','\\cdot':'·',
  // Greek lowercase
  '\\alpha':'α','\\beta':'β','\\gamma':'γ','\\delta':'δ','\\epsilon':'ε','\\varepsilon':'ε',
  '\\zeta':'ζ','\\eta':'η','\\theta':'θ','\\vartheta':'ϑ','\\iota':'ι','\\kappa':'κ',
  '\\lambda':'λ','\\mu':'μ','\\nu':'ν','\\xi':'ξ','\\pi':'π','\\varpi':'ϖ',
  '\\rho':'ρ','\\varrho':'ϱ','\\sigma':'σ','\\varsigma':'ς','\\tau':'τ',
  '\\upsilon':'υ','\\phi':'φ','\\varphi':'φ','\\chi':'χ','\\psi':'ψ','\\omega':'ω',
  // Greek uppercase
  '\\Gamma':'Γ','\\Delta':'Δ','\\Theta':'Θ','\\Lambda':'Λ','\\Xi':'Ξ',
  '\\Pi':'Π','\\Sigma':'Σ','\\Upsilon':'Υ','\\Phi':'Φ','\\Psi':'Ψ','\\Omega':'Ω',
  // Sets & logic
  '\\in':'∈','\\notin':'∉','\\subset':'⊂','\\subseteq':'⊆','\\supset':'⊃','\\supseteq':'⊇',
  '\\cup':'∪','\\cap':'∩','\\emptyset':'∅','\\varnothing':'∅',
  '\\forall':'∀','\\exists':'∃','\\nexists':'∄','\\neg':'¬',
  // Arrows
  '\\to':'→','\\leftarrow':'←','\\leftrightarrow':'↔',
  '\\Rightarrow':'⇒','\\Leftarrow':'⇐','\\Leftrightarrow':'⇔',
  '\\mapsto':'↦',
  // Calculus / operators (no argument — just the symbol)
  '\\infty':'∞','\\partial':'∂','\\nabla':'∇','\\sum':'∑','\\prod':'∏','\\int':'∫',
  // Misc
  '\\ldots':'…','\\cdots':'⋯','\\vdots':'⋮','\\ddots':'⋱',
  '\\circ':'∘','\\bullet':'•','\\star':'⋆','\\dagger':'†',
}

// Build a regex that matches any of the above commands (longest first, word-boundary safe).
const _LATEX_CMD_RE = new RegExp(
  Object.keys(LATEX_UNICODE)
    .sort((a, b) => b.length - a.length)         // longest first avoids prefix clashes
    .map(k => k.replace(/\\/g, '\\\\'))           // escape the backslash for RegExp
    .join('|')
  + '(?![a-zA-Z])',                               // not followed by more letters
  'g'
)

function latexCommandsToUnicode(text) {
  return text.replace(_LATEX_CMD_RE, m => LATEX_UNICODE[m] ?? m)
}

function clipboardToLatex(raw) {
  let text = raw.trim()

  // Strip common LaTeX delimiters ($$…$$, $…$, \[…\], \(…\))
  const delim = text.match(/^\$\$([^]*)\$\$$/)
    || text.match(/^\$([^]*)\$$/)
    || text.match(/^\\\[([^]*)\\\]$/)
    || text.match(/^\\\(([^]*)\\\)$/)
  if (delim) text = delim[1].trim()

  // Unicode superscript/subscript digits → LaTeX exponents
  text = text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱ]+/g,
    m => `^{${[...m].map(c => SUPERSCRIPT_MAP[c] ?? c).join('')}}`)
  text = text.replace(/[₀₁₂₃₄₅₆₇₈₉]+/g,
    m => `_{${[...m].map(c => SUBSCRIPT_MAP[c] ?? c).join('')}}`)

  // Unicode math symbols → LaTeX commands
  text = text.replace(
    /[αβγδεζηθικλμνξπρστυφχψωΓΔΘΛΞΠΣΥΦΨΩ√∞±×÷·≤≥≠≈≡∈∉⊂⊆∪∩∅∑∏∫∂∇→←↔⇒⇔∀∃½⅓⅔¼¾…]/g,
    c => UNICODE_LATEX[c] ?? c,
  )

  // Unicode minus / en-dash → ASCII hyphen
  text = text.replace(/[−–]/g, '-')

  return text
}

// ── HTML clipboard → LaTeX reconstruction ───────────────────────────────────
// KaTeX and MathJax embed the original LaTeX in <annotation encoding="application/x-tex">.
// We parse the HTML, replace every math container with its delimited LaTeX source,
// then extract the reconstructed text.
function extractMathFromHtml(html) {
  if (!html) return null
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  let found = false

  function replaceWithLatex(el, latex, display) {
    el.replaceWith(doc.createTextNode(display ? `\n$$${latex}$$\n` : `$${latex}$`))
    found = true
  }

  function latexFromAnnotation(el) {
    return el.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim() ?? null
  }

  // KaTeX display blocks first, then inline (order matters — display contains inline)
  doc.querySelectorAll('.katex-display').forEach(el => {
    const l = latexFromAnnotation(el); if (l) replaceWithLatex(el, l, true)
  })
  doc.querySelectorAll('.katex').forEach(el => {
    const l = latexFromAnnotation(el); if (l) replaceWithLatex(el, l, false)
  })

  // MathJax v3
  doc.querySelectorAll('mjx-container[display="true"]').forEach(el => {
    const l = latexFromAnnotation(el); if (l) replaceWithLatex(el, l, true)
  })
  doc.querySelectorAll('mjx-container').forEach(el => {
    const l = latexFromAnnotation(el); if (l) replaceWithLatex(el, l, false)
  })

  // Native MathML <math> elements (not already inside KaTeX/MathJax)
  doc.querySelectorAll('math').forEach(el => {
    if (el.closest('.katex, mjx-container')) return
    const l = latexFromAnnotation(el); if (l) replaceWithLatex(el, l, el.getAttribute('display') === 'block')
  })

  // MathJax v2 script tags
  doc.querySelectorAll('script[type="math/tex; mode=display"]').forEach(el => {
    replaceWithLatex(el, el.textContent.trim(), true)
  })
  doc.querySelectorAll('script[type="math/tex"]').forEach(el => {
    replaceWithLatex(el, el.textContent.trim(), false)
  })

  if (!found) return null

  const text = (doc.body.innerText ?? doc.body.textContent ?? '')
    .replace(/\n{3,}/g, '\n\n').trim()
  return text || null
}

// ── Fragmented-math line rejoiner ────────────────────────────────────────────
// CSS-based math renderers (fraction divs, superscript spans, etc.) produce one
// DOM text node per visual token.  Copy-paste reads those in DOM order, giving
// many short lines like: "x" / "2" / "+xy" / "+" / "y" / "\geq1".
// Strategy: accumulate consecutive short non-Vietnamese lines into a single line;
// flush them when a natural-language line or paragraph break appears.
const VIET_CHAR_RE = /[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/

function rejoinFragmentedMath(text) {
  // Only run when the text already contains LaTeX commands or unicode math chars —
  // that signals the source has math content that may have fragmented on copy.
  if (!/\\[a-zA-Z]|[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉αβγδεζηθπρστφψωΣΔΩ∞±≤≥≠∈∑∏∫√]/.test(text)) {
    return text
  }

  // A line is "natural language" (keep on its own line) if it is long,
  // contains Vietnamese characters, or contains multiple English words.
  function isNaturalLanguage(t) {
    if (t.length > 30) return true
    if (VIET_CHAR_RE.test(t)) return true
    // Two or more separate alphabetic words = prose, not a math token
    if (/[a-zA-Z]{2,}\s+[a-zA-Z]{2,}/.test(t)) return true
    return false
  }

  const lines = text.split('\n')
  const out = []
  let buf = []   // accumulates math fragment tokens

  function flush() {
    if (buf.length) { out.push(buf.join(' ')); buf = [] }
  }

  for (const raw of lines) {
    const t = raw.trim()
    if (isNaturalLanguage(t)) {
      flush()
      out.push(raw)
    } else if (!t) {
      // Blank line: only output it if we're not mid-fragment-run
      if (!buf.length) out.push('')
    } else {
      buf.push(t)
    }
  }
  flush()

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// remark-math v6 defaults singleDollarTextMath to false; force it on so
// inline $…$ in mixed prose+math text renders instead of showing raw $ signs.
const REMARK_MATH_OPTS = [remarkMath, { singleDollarTextMath: true }]

function MathText({ children, inline = false }) {
  const normalized = normalizeMath(children ?? '')
  const pTag = inline
    ? ({ children: c }) => <span>{c}</span>
    : ({ children: c }) => <p className="mb-1 last:mb-0">{c}</p>
  return (
    <Markdown
      remarkPlugins={[REMARK_MATH_OPTS, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{ p: pTag }}
    >
      {normalized}
    </Markdown>
  )
}

// Returns true when the text contains LaTeX that KaTeX can render.
function hasMath(text) {
  if (!text) return false
  return text.includes('$') || /\\[a-zA-Z]/.test(text)
}

// Prepare text for display in the preview panel.
// Lines that already have $…$ delimiters are left alone.
// Lines containing bare \commands are wrapped in $$…$$ so KaTeX renders
// them as a block instead of showing raw backslash tokens.
// Plain-text lines (Vietnamese prose, numbers) pass through unchanged.
function preparePreview(text) {
  if (!text) return ''
  if (text.includes('$')) return text
  return text
    .split('\n')
    .map(line => (/\\[a-zA-Z]/.test(line) ? `$$${line.trim()}$$` : line))
    .join('\n\n')
}

function MathPreview({ text }) {
  if (!hasMath(text)) return null
  const display = preparePreview(text)
  return (
    <div className="rounded-xl border border-[#1E2D45] bg-[#080D1A] px-4 py-3">
      <p className="font-jakarta text-[10px] font-semibold text-[#334155] tracking-widest uppercase mb-2">
        Xem trước
      </p>
      <div className="font-jakarta text-[15px] text-[#94A3B8] leading-relaxed overflow-x-auto">
        <Markdown remarkPlugins={[REMARK_MATH_OPTS, remarkGfm]} rehypePlugins={[rehypeKatex]}>
          {display}
        </Markdown>
      </div>
    </div>
  )
}

const CONFIDENCE_COLOR = { high: '#10B981', medium: '#F2A20C', low: '#EF4444' }
const CONFIDENCE_LABEL = { high: 'Chắc chắn', medium: 'Khả năng cao', low: 'Không chắc' }

const PART_HEADER_RE = /^\*\*Phần\s+[a-dA-D]\w*\)\*\*$/

function StepList({ steps }) {
  let stepCounter = 0
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => {
        if (PART_HEADER_RE.test(s.trim())) {
          return (
            <li key={i} className="mt-2 mb-1">
              <span className="font-jakarta text-[11px] font-semibold text-[#F2A20C] tracking-widest uppercase">
                {s.replace(/\*\*/g, '')}
              </span>
            </li>
          )
        }
        stepCounter++
        return (
          <li key={i} className="flex gap-3 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-[#F2A20C]/15 border border-[#F2A20C]/30 text-[#F2A20C] text-[11px] font-bold flex items-center justify-center mt-0.5">
              {stepCounter}
            </span>
            <div className="font-jakarta text-[15px] text-[#CBD5E1] leading-relaxed">
              <MathText>{s}</MathText>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function StepReveal({ steps }) {
  const [revealed, setRevealed] = useState(1)
  const total = steps.length
  const showing = Math.min(revealed, total)
  return (
    <div className="flex flex-col gap-4">
      <StepList steps={steps.slice(0, showing)} />
      {showing < total && (
        <div className="flex items-center gap-3 pt-1">
          <button onClick={() => setRevealed(r => r + 1)}
            className="px-4 py-1.5 rounded-lg font-jakarta text-[12px] font-semibold border border-[#F2A20C]/40 text-[#F2A20C] hover:bg-[#F2A20C]/10 transition">
            Tiếp theo →
          </button>
          <button onClick={() => setRevealed(total)}
            className="font-jakarta text-[11px] text-[#475569] hover:text-[#94A3B8] transition">
            Xem tất cả ({total - showing} bước còn lại)
          </button>
        </div>
      )}
    </div>
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

// Loads deployggb.js once and resolves when GGBApplet is available.
let _ggbScriptPromise = null
function loadGeoGebraScript() {
  if (!_ggbScriptPromise) {
    _ggbScriptPromise = new Promise((resolve, reject) => {
      if (window.GGBApplet) { resolve(); return }
      const s = document.createElement('script')
      s.src = 'https://www.geogebra.org/apps/deployggb.js'
      s.onload = resolve
      s.onerror = reject
      document.head.appendChild(s)
    })
  }
  return _ggbScriptPromise
}

function GeoGebraEmbed({ commands }) {
  const wrapRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ready | error

  useEffect(() => {
    if (!commands || !wrapRef.current) return
    let cancelled = false

    // Stable id required by GeoGebra — set on the wrapper div directly
    const uid = `ggb-${Math.random().toString(36).slice(2, 8)}`
    wrapRef.current.id = uid

    loadGeoGebraScript()
      .then(() => {
        if (cancelled) return

        // Poll getAppletObject() until GeoGebra exposes evalCommand.
        // appletOnLoad string callbacks are unreliable for GeoGebra Classic;
        // polling is robust across all app types and browser environments.
        let appletRef = null
        const tid = setInterval(() => {
          if (cancelled) { clearInterval(tid); return }
          const api = appletRef?.getAppletObject?.()
          if (!api?.evalCommand) return
          clearInterval(tid)
          // Named-color → RGB for SetColor
          const COLORS = {
            steelblue:[70,130,180], orange:[255,165,0], red:[220,50,50],
            green:[34,139,34], blue:[30,100,200], purple:[128,0,128],
            gray:[128,128,128], black:[0,0,0],
          }
          commands.trim().split('\n').forEach(line => {
            const cmd = line.trim()
            if (!cmd) return
            // Scripting commands must use the JS API, not evalCommand
            let m
            if ((m = cmd.match(/^HideObject\((\w+)\)$/i))) {
              api.setVisible(m[1], false)
            } else if ((m = cmd.match(/^ShowObject\((\w+)\)$/i))) {
              api.setVisible(m[1], true)
            } else if ((m = cmd.match(/^SetFilling\((\w+),\s*([\d.]+)\)$/i))) {
              api.setFilling(m[1], parseFloat(m[2]))
            } else if ((m = cmd.match(/^SetColor\((\w+),\s*"([^"]+)"\)$/i))) {
              const rgb = COLORS[m[2].toLowerCase()] ?? [100,100,200]
              api.setColor(m[1], ...rgb)
            } else if (/^ZoomIn\(/i.test(cmd)) {
              // ZoomIn(1) is a no-op; auto-fit instead via JS API below
            } else {
              api.evalCommand(cmd)
            }
          })
          // Auto-fit viewport to all defined points
          try {
            const names = api.getAllObjectNames('point')
            if (names && names.length > 0) {
              let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity
              for (const n of names) {
                if (n.startsWith('_aux_')) continue
                const x = api.getXcoord(n), y = api.getYcoord(n)
                if (isFinite(x) && isFinite(y)) {
                  xMin = Math.min(xMin, x); xMax = Math.max(xMax, x)
                  yMin = Math.min(yMin, y); yMax = Math.max(yMax, y)
                }
              }
              if (isFinite(xMin)) {
                const pad = Math.max((xMax - xMin) * 0.25, (yMax - yMin) * 0.25, 1.5)
                api.setCoordSystem(xMin - pad, xMax + pad, yMin - pad, yMax + pad)
              }
            }
          } catch (_) { /* ignore if API unavailable */ }
          setStatus('ready')
        }, 300)

        const width = wrapRef.current.offsetWidth || 560
        const params = {
          appName: 'classic',
          width,
          height: 360,
          showToolBar: false,
          showAlgebraInput: false,
          showMenuBar: false,
          enableRightClick: false,
          enableShiftDragZoom: true,
          showResetIcon: true,
          language: 'en',
          errorDialogsActive: false,
        }
        appletRef = new window.GGBApplet(params, true)
        appletRef.inject(uid)
      })
      .catch(() => { if (!cancelled) setStatus('error') })

    return () => { cancelled = true }
  }, [commands])

  return (
    <div className="relative rounded overflow-hidden bg-[#0F1726]" style={{ height: 360 }}>
      {/* GeoGebra injects its iframe directly into this div */}
      <div ref={wrapRef} style={{ width: '100%', height: '100%' }} />

      {/* Loading overlay — sits on top until GeoGebra is ready */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0F1726]">
          <span className="font-jakarta text-[12px] text-[#475569] animate-pulse">Đang tải GeoGebra…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0F1726]">
          <span className="font-jakarta text-[12px] text-[#475569]">Không thể tải GeoGebra</span>
        </div>
      )}
    </div>
  )
}

function FigureBlock({ figure }) {
  if (!figure?.data) return null

  return (
    <div className="rounded-xl border border-[#2A3A5E] bg-[#0A0F1E] p-4 flex flex-col gap-3">
      <p className="font-jakarta text-[10px] font-semibold text-[#334155] tracking-widest uppercase">
        Hình minh họa
      </p>

      {figure.type === 'geogebra' ? (
        <GeoGebraEmbed commands={figure.data} />
      ) : (
        <div
          className="overflow-x-auto flex justify-center"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(figure.data, { USE_PROFILES: { svg: true } }) }}
        />
      )}
    </div>
  )
}

function AnswerCard({ result, problem }) {
  const answer = result.answer || {}
  const validation = result.validation || {}
  const confidence = answer.confidence || 'low'
  const showUnverifiedWarning = confidence === 'low' && !validation.valid

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      {/* Problem statement */}
      {problem && (
        <div className="rounded-xl border border-[#2A3A5E] bg-[#0A0F1E] px-5 py-4">
          <p className="font-jakarta text-[10px] font-semibold text-[#334155] tracking-widest uppercase mb-2">
            Bài toán
          </p>
          <div className="font-jakarta text-[15px] text-[#CBD5E1] leading-relaxed overflow-x-auto">
            <Markdown remarkPlugins={[REMARK_MATH_OPTS, remarkGfm]} rehypePlugins={[rehypeKatex]}>
              {preparePreview(problem)}
            </Markdown>
          </div>
        </div>
      )}

      {/* Figure (geometry diagram or function plot) */}
      <FigureBlock figure={answer.figure} />

      {/* Unverified warning banner */}
      {showUnverifiedWarning && (
        <div className="rounded-xl border border-[#F2A20C]/30 bg-[#F2A20C]/5 px-4 py-3 font-jakarta text-[13px] text-[#F2A20C]">
          Kết quả chưa được xác minh — kiểm tra lại cẩn thận
        </div>
      )}

      {/* Steps */}
      {answer.steps?.length > 0 && (
        <div className="rounded-xl border border-[#2A3A5E] bg-[#0F1726] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-jakarta text-[11px] font-semibold text-[#475569] tracking-widest uppercase">Lời giải</p>
            <div className="flex items-center gap-3">
              {answer.problem_type && (
                <span className="font-jakarta text-[11px] text-[#475569] capitalize">
                  {answer.problem_type.replace(/_/g, ' ')}
                </span>
              )}
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
          <StepReveal steps={answer.steps} />
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

const VERDICT_COLOR  = { correct: '#10B981', partial: '#F2A20C', incorrect: '#EF4444' }
const VERDICT_LABEL  = { correct: 'Đúng',   partial: 'Một phần', incorrect: 'Sai' }

function ReviewCard({ result, problem, solution }) {
  const verdictColor = VERDICT_COLOR[result.verdict] || '#94A3B8'
  const verdictLabel = VERDICT_LABEL[result.verdict] || result.verdict

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      {/* Problem */}
      {problem && (
        <div className="rounded-xl border border-[#2A3A5E] bg-[#0A0F1E] px-5 py-4">
          <p className="font-jakarta text-[10px] font-semibold text-[#334155] tracking-widest uppercase mb-2">Bài toán</p>
          <div className="font-jakarta text-[15px] text-[#CBD5E1] leading-relaxed overflow-x-auto">
            <Markdown remarkPlugins={[REMARK_MATH_OPTS, remarkGfm]} rehypePlugins={[rehypeKatex]}>
              {preparePreview(problem)}
            </Markdown>
          </div>
        </div>
      )}

      {/* Solution submitted */}
      {solution && (
        <div className="rounded-xl border border-[#2A3A5E] bg-[#0A0F1E] px-5 py-4">
          <p className="font-jakarta text-[10px] font-semibold text-[#334155] tracking-widest uppercase mb-2">Lời giải đã nộp</p>
          <div className="font-jakarta text-[15px] text-[#94A3B8] leading-relaxed overflow-x-auto">
            <Markdown remarkPlugins={[REMARK_MATH_OPTS, remarkGfm]} rehypePlugins={[rehypeKatex]}>
              {preparePreview(solution)}
            </Markdown>
          </div>
        </div>
      )}

      {/* Verdict banner */}
      <div className="rounded-xl border px-5 py-4 flex items-center justify-between"
        style={{ borderColor: `${verdictColor}40`, background: `${verdictColor}08` }}>
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: verdictColor }} />
          <span className="font-jakarta text-[15px] font-semibold" style={{ color: verdictColor }}>{verdictLabel}</span>
          <span className="font-jakarta text-[22px] font-bold" style={{ color: verdictColor }}>{result.score}</span>
        </div>
      </div>

      {/* Feedback */}
      {result.feedback && (
        <div className="rounded-xl border border-[#2A3A5E] bg-[#0F1726] px-5 py-4">
          <p className="font-jakarta text-[10px] font-semibold text-[#475569] tracking-widest uppercase mb-2">Nhận xét</p>
          <div className="font-jakarta text-[14px] text-[#CBD5E1] leading-relaxed">
            <MathText>{result.feedback}</MathText>
          </div>
        </div>
      )}

      {/* Correct steps */}
      {result.correct_steps?.length > 0 && (
        <div className="rounded-xl border border-[#10B981]/20 bg-[#10B981]/5 px-5 py-4">
          <p className="font-jakarta text-[10px] font-semibold text-[#10B981] tracking-widest uppercase mb-3">Các bước đúng</p>
          <ol className="flex flex-col gap-2">
            {result.correct_steps.map((s, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#10B981]/20 border border-[#10B981]/30 text-[#10B981] text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                <div className="font-jakarta text-[14px] text-[#94A3B8] leading-relaxed"><MathText>{s}</MathText></div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Errors */}
      {result.errors?.length > 0 && (
        <div className="rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/5 px-5 py-4">
          <p className="font-jakarta text-[10px] font-semibold text-[#EF4444] tracking-widest uppercase mb-3">Lỗi phát hiện</p>
          <ul className="flex flex-col gap-2">
            {result.errors.map((e, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="shrink-0 text-[#EF4444] text-[12px] mt-0.5">✕</span>
                <div className="font-jakarta text-[14px] text-[#94A3B8] leading-relaxed"><MathText>{e}</MathText></div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Correct approach */}
      {result.correct_approach && (
        <div className="rounded-xl border border-[#6366F1]/20 bg-[#6366F1]/5 px-5 py-4">
          <p className="font-jakarta text-[10px] font-semibold text-[#6366F1] tracking-widest uppercase mb-2">Phương pháp đúng</p>
          <div className="font-jakarta text-[14px] text-[#94A3B8] leading-relaxed"><MathText>{result.correct_approach}</MathText></div>
        </div>
      )}
    </div>
  )
}

// Insert text at the textarea cursor, preserving selection.
function insertAtCursor(el, text) {
  const start = el.selectionStart
  const end = el.selectionEnd
  const v = el.value
  el.value = v.slice(0, start) + text + v.slice(end)
  el.selectionStart = el.selectionEnd = start + text.length
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

// Auto-grow a textarea to fit its content.
function autoResize(el) {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

const PHASE_LABELS = {
  starting: 'Đang khởi động…',
  checking_cache: 'Đang kiểm tra bộ nhớ đệm…',
  loading_units: 'Đang đọc kho tri thức…',
  building_vectors: 'Đang xây dựng chỉ mục vector…',
  saving: 'Đang lưu chỉ mục…',
}

function useWikiStatus() {
  const [status, setStatus] = useState(null)
  const [justBecameReady, setJustBecameReady] = useState(false)
  const prevPhaseRef = useRef(null)
  const doneRef = useRef(false)

  useEffect(() => {
    async function poll() {
      if (doneRef.current) return
      const { data } = await getWikiStatus()
      if (!data) return
      const prev = prevPhaseRef.current
      prevPhaseRef.current = data.phase
      setStatus(data)
      if (data.phase === 'ready' || data.phase === 'failed') {
        doneRef.current = true
        if (data.phase === 'ready' && prev !== null && prev !== 'ready') {
          setJustBecameReady(true)
          setTimeout(() => setJustBecameReady(false), 4000)
        }
      }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [])

  return { status, justBecameReady }
}

const HISTORY_KEY = 'oracle_history'
const HISTORY_MAX = 20
const VALID_TOPICS = ['algebra', 'geometry', 'statistics', 'combinatorics', 'calculus', 'number_theory']

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}

function saveHistory(items) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)) } catch {}
}

function pushHistory(problem) {
  const prev = loadHistory()
  const next = [{ id: Date.now(), problem: problem.slice(0, 80), timestamp: new Date().toISOString() }, ...prev]
  saveHistory(next.slice(0, HISTORY_MAX))
  return next.slice(0, HISTORY_MAX)
}

export default function MathOracle() {
  const navigate = useNavigate()
  const location = useLocation()
  const MAX_RETRIES = 2

  // ── C1+C2: Chat thread state ──────────────────────────────────────────────
  // chatMode: 'solve' | 'socratic' | 'review'
  // messages: [{ role:'user'|'oracle', content, steps, type, result }]
  const [chatMode, setChatMode] = useState('solve')
  const [messages, setMessages] = useState([])
  const chatEndRef = useRef(null)

  // ── Legacy single-result state (kept for doSolve/doReview internals) ──────
  const [question, setQuestion] = useState('')
  const [solution, setSolution] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [lastSolveQuestion, setLastSolveQuestion] = useState('')
  const [ocring, setOcring] = useState(false)
  const [ocringS, setOcringS] = useState(false)
  const [cameraMenu, setCameraMenu] = useState(null) // null | 'question' | 'solution'

  // ── C3: History sidebar ───────────────────────────────────────────────────
  const [history, setHistory] = useState(() => loadHistory())
  const [historyOpen, setHistoryOpen] = useState(false) // mobile dropdown

  const textareaRef = useRef(null)
  const solutionRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const solutionFileInputRef = useRef(null)
  const solutionCameraInputRef = useRef(null)

  const { status: wikiStatus } = useWikiStatus()
  const wikiReady  = wikiStatus?.phase === 'ready'
  const wikiFailed = wikiStatus?.phase === 'failed'

  useEffect(() => {
    getMathStats().then(({ data }) => { if (data) setStats(data) })
  }, [])

  // Pre-seed from Results page navigation (weak topics + wrong questions)
  useEffect(() => {
    const state = location.state
    if (!state?.weakTopics?.length) return
    const topicNames = state.weakTopics.map(t => TOPIC_LABELS[t] ?? t).join(', ')
    const lines = [`Tôi vừa làm bài thi và còn yếu ở các chủ đề: ${topicNames}.`]
    if (state.wrongQuestions?.length) {
      lines.push(`\nMột số câu tôi làm sai:`)
      state.wrongQuestions.slice(0, 3).forEach((q, i) => {
        const text = q.question || q.text || ''
        if (text) lines.push(`${i + 1}. ${text.slice(0, 120)}`)
      })
    }
    lines.push(`\nBạn có thể giải thích và hướng dẫn tôi cách ôn tập những chủ đề này không?`)
    setQuestion(lines.join('\n'))
    window.history.replaceState({}, '', location.pathname)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const prevReadyRef = useRef(false)
  useEffect(() => {
    if (wikiReady && !prevReadyRef.current) {
      getMathStats().then(({ data }) => { if (data) setStats(data) })
    }
    prevReadyRef.current = wikiReady
  }, [wikiReady])

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleChange = useCallback((e) => {
    setQuestion(e.target.value)
    autoResize(e.target)
  }, [])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      const text = textareaRef.current?.value.trim()
      if (!text || loading) return
      handleSubmit(text)
    }
  }, [loading, chatMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePaste = useCallback((e) => {
    const html  = e.clipboardData?.getData('text/html')  ?? ''
    const plain = e.clipboardData?.getData('text/plain') ?? ''
    if (!plain && !html) return
    e.preventDefault()

    // 1. HTML path: extract LaTeX from KaTeX / MathJax / native MathML annotation tags.
    // 2. Plain-text path: normalise unicode chars, rejoin CSS-renderer fragments.
    // 3. Final pass: convert remaining \command tokens → real Unicode symbols (≥ not \geq).
    const cleaned = latexCommandsToUnicode(
      extractMathFromHtml(html) ?? rejoinFragmentedMath(clipboardToLatex(plain))
    )

    insertAtCursor(e.target, cleaned)
    setQuestion(e.target.value)
    autoResize(e.target)
  }, [])

  // ── Submit dispatcher ─────────────────────────────────────────────────────
  // Heuristic: a "new problem" is a long input (>20 chars) or no prior messages.
  // A short reply to an existing thread is treated as a follow-up.
  async function handleSubmit(text) {
    const isNewProblem = messages.length === 0 || text.length > 20

    // Push user message to thread
    setMessages(prev => [...prev, { role: 'user', content: text, steps: null, type: chatMode }])
    setQuestion('')
    if (textareaRef.current) { textareaRef.current.value = ''; autoResize(textareaRef.current) }
    setError(null)

    if (chatMode === 'solve' && isNewProblem) {
      await doSolveChat(text)
    } else if (chatMode === 'review' && isNewProblem) {
      const sol = (solutionRef.current?.value || '').trim()
      setSolution('')
      if (solutionRef.current) { solutionRef.current.value = ''; autoResize(solutionRef.current) }
      await doReviewChat(text, sol)
    } else {
      // socratic mode first message, or any follow-up
      await doTutorChat(text, chatMode === 'socratic' && isNewProblem)
    }
  }

  async function doSolveChat(text, attempt = 0) {
    setLoading(true)
    setRetryAttempt(attempt)
    setLastSolveQuestion(text)
    const { data, error: err } = await solveMath(text)
    if (err) {
      const isTimeout = /timed out|504|timeout|không kết nối|network error/i.test(err)
      if (isTimeout && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000))
        return doSolveChat(text, attempt + 1)
      }
      setLoading(false)
      setRetryAttempt(0)
      setError(err)
      // Remove optimistic user message on error
      setMessages(prev => prev.slice(0, -1))
      return
    }
    setLoading(false)
    setRetryAttempt(0)
    const answer = data?.answer || {}
    setMessages(prev => [...prev, {
      role: 'oracle',
      content: null,
      steps: answer.steps || null,
      type: 'solve',
      result: data,
    }])
    // C3: push to history after successful solve
    const updated = pushHistory(text)
    setHistory(updated)
  }

  async function doReviewChat(problem, sol) {
    setLoading(true)
    const { data, error: err } = await reviewMath(problem, sol)
    setLoading(false)
    if (err) {
      setError(err)
      setMessages(prev => prev.slice(0, -1))
      return
    }
    setMessages(prev => [...prev, {
      role: 'oracle',
      content: null,
      steps: null,
      type: 'review',
      result: { _type: 'review', ...data },
      problem,
      solution: sol,
    }])
    const updated = pushHistory(problem)
    setHistory(updated)
  }

  async function doTutorChat(text, isSocraticStart = false) {
    setLoading(true)
    // Build conversation history for tutor endpoint
    const historyMsgs = messages
      .filter(m => m.role === 'user' || (m.role === 'oracle' && m.content))
      .map(m => ({ role: m.role === 'oracle' ? 'assistant' : 'user', content: m.content || '' }))

    const systemHint = isSocraticStart
      ? 'Hướng dẫn học sinh từng bước bằng câu hỏi gợi mở, không giải thẳng.'
      : undefined

    const payload = {
      messages: [...historyMsgs, { role: 'user', content: text }],
      ...(systemHint ? { system: systemHint } : {}),
    }

    const { data, error: err } = await sendTutorMessage(payload)
    setLoading(false)
    if (err) {
      setError(err)
      setMessages(prev => prev.slice(0, -1))
      return
    }
    const reply = data?.reply || data?.message || (typeof data === 'string' ? data : 'Oracle không trả lời được.')
    setMessages(prev => [...prev, {
      role: 'oracle',
      content: reply,
      steps: null,
      type: isSocraticStart ? 'socratic' : 'followup',
    }])
    if (isSocraticStart) {
      const updated = pushHistory(text)
      setHistory(updated)
    }
  }

  function handleSolveForm(e) {
    e?.preventDefault()
    const text = (textareaRef.current?.value || '').trim()
    if (!text || loading) return
    handleSubmit(text)
  }

  function handleInsert(s) {
    const ta = textareaRef.current
    if (!ta) return
    // Strip MathLive placeholder pipes; insert plain LaTeX snippet
    insertAtCursor(ta, s.replace(/\|/g, ''))
    setQuestion(ta.value)
    autoResize(ta)
    ta.focus()
  }

  async function handleOcrFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setOcring(true)
    setError(null)
    const { data, error: err } = await ocrImage(file)
    setOcring(false)
    if (err) { setError(err); return }
    const text = data?.text || ''
    const ta = textareaRef.current
    if (ta) { ta.value = text; autoResize(ta); ta.focus() }
    setQuestion(text)
  }

  async function handleOcrSolution(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setOcringS(true)
    setError(null)
    const { data, error: err } = await ocrImage(file)
    setOcringS(false)
    if (err) { setError(err); return }
    const text = data?.text || ''
    const ta = solutionRef.current
    if (ta) { ta.value = text; autoResize(ta); ta.focus() }
    setSolution(text)
  }

  // ── C4: "Luyện bài tương tự" — read problem_type from last solve result ──
  const lastSolveResult = [...messages].reverse().find(m => m.role === 'oracle' && m.type === 'solve')
  const rawTopic = lastSolveResult?.result?.answer?.problem_type
  const safeTopic = VALID_TOPICS.includes(rawTopic) ? rawTopic : null

  // ── Mode toggle labels ────────────────────────────────────────────────────
  const MODE_OPTS = [
    ['solve', 'Giải thẳng'],
    ['socratic', 'Hướng dẫn'],
    ['review', 'Chấm bài'],
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
      className="min-h-screen relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse 120% 80% at 50% 0%, #1B2B4B 0%, #0A0E1A 60%)' }}>

      {/* Ambient glow */}
      <div className="absolute pointer-events-none rounded-full opacity-40"
        style={{ width: 600, height: 400, left: '50%', top: 0, transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, #6366F118 0%, transparent 70%)' }} />

      {/* ── C3: Desktop history sidebar (lg+) ────────────────────────────── */}
      {history.length > 0 && (
        <div className="hidden lg:flex flex-col gap-2 fixed left-4 top-24 w-48 max-h-[70vh] overflow-y-auto z-20">
          <p className="font-jakarta text-[10px] font-semibold text-[#334155] tracking-widest uppercase px-1 mb-1">
            Lịch sử
          </p>
          {history.map(item => (
            <button key={item.id}
              onClick={() => {
                const ta = textareaRef.current
                if (ta) { ta.value = item.problem; autoResize(ta); ta.focus() }
                setQuestion(item.problem)
              }}
              className="text-left font-jakarta text-[11px] text-[#475569] hover:text-[#94A3B8] hover:bg-[#0F1726] border border-transparent hover:border-[#2A3A5E] rounded-lg px-2.5 py-1.5 transition truncate"
              title={item.problem}>
              {item.problem}
            </button>
          ))}
        </div>
      )}

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-12 flex flex-col gap-8">

        {/* Back */}
        <button onClick={() => navigate('/')}
          className="self-start font-jakarta text-sm text-[#475569] hover:text-[#94A3B8] transition flex items-center gap-1.5">
          ← Trang chủ
        </button>

        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-jakarta text-[10px] font-semibold text-[#6366F1] tracking-[3px] uppercase">
              Experimental · AI Knowledge System
            </span>
            {/* Wiki status dot */}
            {wikiStatus === null
              ? <div className="w-1.5 h-1.5 rounded-full bg-[#475569] animate-pulse" title="Đang tải…" />
              : wikiReady
                ? <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" title="Tri thức đã sẵn sàng" />
                : <div className="w-1.5 h-1.5 rounded-full bg-[#334155]" title="" />
            }
          </div>
          <h1 className="font-fraunces text-[52px] font-bold text-[#F8FAFC] leading-none tracking-tight">
            Toán Oracle
          </h1>
          <p className="font-jakarta text-[15px] text-[#64748B] leading-relaxed max-w-[480px]">
            Đặt câu hỏi toán — Oracle truy vấn kho tri thức và giải từng bước.
          </p>
        </div>

        {/* ── C1+C2: Mode toggle (3 options) + mobile history ───────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-2">
            {MODE_OPTS.map(([m, label]) => (
              <button key={m} type="button"
                onClick={() => setChatMode(m)}
                className="font-jakarta text-[12px] font-semibold px-4 py-1.5 rounded-full transition"
                style={chatMode === m
                  ? { background: '#6366F1', color: '#fff' }
                  : { background: 'transparent', border: '1px solid #2A3A5E', color: '#475569' }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── C3: Mobile history toggle ─────────────────────────────── */}
          {history.length > 0 && (
            <div className="relative lg:hidden ml-auto">
              <button
                type="button"
                onClick={() => setHistoryOpen(o => !o)}
                className="font-jakarta text-[11px] text-[#475569] hover:text-[#94A3B8] border border-[#2A3A5E] rounded-full px-3 py-1 transition">
                Lịch sử
              </button>
              {historyOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setHistoryOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 rounded-xl border border-[#2A3A5E] bg-[#0F1726] shadow-xl overflow-hidden" style={{ minWidth: 220 }}>
                    {history.slice(0, 5).map(item => (
                      <button key={item.id}
                        onClick={() => {
                          setHistoryOpen(false)
                          const ta = textareaRef.current
                          if (ta) { ta.value = item.problem; autoResize(ta); ta.focus() }
                          setQuestion(item.problem)
                        }}
                        className="w-full text-left px-4 py-2.5 font-jakarta text-[12px] text-[#94A3B8] hover:bg-[#1E2D45] transition truncate border-b border-[#1E2D45] last:border-0">
                        {item.problem}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── C1: New conversation button (only when thread has messages) ── */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => { setMessages([]); setError(null) }}
              className="font-jakarta text-[11px] text-[#475569] hover:text-[#94A3B8] transition ml-auto lg:ml-0">
              Cuộc trò chuyện mới
            </button>
          )}
        </div>

        {/* Input */}
        <style>{`
          .oracle-textarea::placeholder { color: #334155; }
          .oracle-textarea { caret-color: #E2E8F0; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <form onSubmit={handleSolveForm} className="flex flex-col gap-3">
          <div className="rounded-xl border border-[#2A3A5E] bg-[#0F1726] focus-within:border-[#6366F1] transition-colors overflow-hidden">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              disabled={ocring}
              placeholder={
                chatMode === 'review'
                  ? 'Nhập bài toán cần chấm… (LaTeX, tiếng Việt)'
                  : chatMode === 'socratic'
                  ? 'Nhập bài toán để được hướng dẫn từng bước…'
                  : 'Nhập bài toán… (hỗ trợ LaTeX, nhiều dòng, tiếng Việt)\nVD: Giải phương trình x² – 5x + 6 = 0'
              }
              rows={3}
              className={`oracle-textarea${ocring ? ' opacity-60 cursor-not-allowed' : ''}`}
              style={{
                display: 'block', width: '100%', resize: 'none', overflow: 'hidden',
                background: 'transparent', color: '#E2E8F0', fontSize: 15,
                padding: '16px 20px 12px', boxSizing: 'border-box',
                outline: 'none', border: 'none', lineHeight: 1.6,
                fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
              }}
            />
            <SymbolPalette onInsert={handleInsert} />
            <div className="flex justify-end items-center gap-2 px-3 py-2 border-t border-[#2A3A5E]">
              {/* OCR image upload / camera capture */}
              <div className="relative">
                <button
                  type="button"
                  title="Nhận diện ảnh"
                  onClick={() => setCameraMenu(m => m === 'question' ? null : 'question')}
                  disabled={ocring || loading}
                  className="p-1.5 text-[#475569] hover:text-[#94A3B8] disabled:opacity-40 transition"
                >
                  {ocring
                    ? <span style={{ display:'inline-block', width:14, height:14, border:'2px solid #475569', borderTopColor:'#94A3B8', borderRadius:'50%', animation:'spin 0.6s linear infinite' }} />
                    : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  }
                </button>
                {cameraMenu === 'question' && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCameraMenu(null)} />
                    <div className="absolute bottom-full right-0 mb-1 z-20 rounded-lg border border-[#2A3A5E] bg-[#0F1726] shadow-xl overflow-hidden" style={{ minWidth: 160 }}>
                      <button type="button"
                        onClick={() => { setCameraMenu(null); fileInputRef.current?.click() }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 font-jakarta text-[13px] text-[#94A3B8] hover:bg-[#1E2D45] transition text-left">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Tải ảnh lên
                      </button>
                      <button type="button"
                        onClick={() => { setCameraMenu(null); cameraInputRef.current?.click() }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 font-jakarta text-[13px] text-[#94A3B8] hover:bg-[#1E2D45] transition text-left border-t border-[#1E2D45]">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        Chụp ảnh
                      </button>
                    </div>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleOcrFile} style={{ display: 'none' }} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleOcrFile} style={{ display: 'none' }} />
              <span className="font-jakarta text-[11px] text-[#334155]">⌘ Enter</span>
              <button type="submit" disabled={!question.trim() || loading || ocring || ocringS}
                className="px-4 py-1.5 bg-[#6366F1] text-white font-jakarta font-semibold text-sm rounded-lg disabled:opacity-40 hover:bg-[#4F46E5] transition">
                {loading
                  ? (chatMode === 'review' ? 'Đang chấm…' : chatMode === 'socratic' ? 'Đang hướng dẫn…' : 'Đang tính…')
                  : (chatMode === 'review' ? 'Chấm bài' : chatMode === 'socratic' ? 'Hướng dẫn' : 'Giải')}
              </button>
            </div>
          </div>
          <MathPreview text={question} />

          {/* Solution textarea — only in review mode */}
          {chatMode === 'review' && (
            <div className="rounded-xl border border-[#2A3A5E] bg-[#0F1726] focus-within:border-[#6366F1] transition-colors overflow-hidden">
              <textarea
                ref={solutionRef}
                value={solution}
                onChange={(e) => { setSolution(e.target.value); autoResize(e.target) }}
                disabled={loading || ocringS}
                placeholder="Nhập hoặc chụp lời giải cần chấm…"
                rows={3}
                className={`oracle-textarea${(loading || ocringS) ? ' opacity-60 cursor-not-allowed' : ''}`}
                style={{
                  display: 'block', width: '100%', resize: 'none', overflow: 'hidden',
                  background: 'transparent', color: '#E2E8F0', fontSize: 15,
                  padding: '16px 20px 12px', boxSizing: 'border-box',
                  outline: 'none', border: 'none', lineHeight: 1.6,
                  fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
                }}
              />
              <div className="flex justify-end items-center gap-2 px-3 py-2 border-t border-[#2A3A5E]">
                <div className="relative">
                  <button type="button" title="Nhận diện ảnh lời giải"
                    onClick={() => setCameraMenu(m => m === 'solution' ? null : 'solution')}
                    disabled={ocringS || loading}
                    className="p-1.5 text-[#475569] hover:text-[#94A3B8] disabled:opacity-40 transition">
                    {ocringS
                      ? <span style={{ display:'inline-block', width:14, height:14, border:'2px solid #475569', borderTopColor:'#94A3B8', borderRadius:'50%', animation:'spin 0.6s linear infinite' }} />
                      : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    }
                  </button>
                  {cameraMenu === 'solution' && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setCameraMenu(null)} />
                      <div className="absolute bottom-full right-0 mb-1 z-20 rounded-lg border border-[#2A3A5E] bg-[#0F1726] shadow-xl overflow-hidden" style={{ minWidth: 160 }}>
                        <button type="button"
                          onClick={() => { setCameraMenu(null); solutionFileInputRef.current?.click() }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 font-jakarta text-[13px] text-[#94A3B8] hover:bg-[#1E2D45] transition text-left">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          Tải ảnh lên
                        </button>
                        <button type="button"
                          onClick={() => { setCameraMenu(null); solutionCameraInputRef.current?.click() }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 font-jakarta text-[13px] text-[#94A3B8] hover:bg-[#1E2D45] transition text-left border-t border-[#1E2D45]">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                          Chụp ảnh
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <input ref={solutionFileInputRef} type="file" accept="image/*" onChange={handleOcrSolution} style={{ display: 'none' }} />
                <input ref={solutionCameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleOcrSolution} style={{ display: 'none' }} />
                <span className="font-jakarta text-[11px] text-[#334155]">Lời giải</span>
              </div>
            </div>
          )}

          {question.trim() === '' && messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {[
                { insert: 'x^{2} - 5x + 6 = 0',              label: '$x^{2} - 5x + 6 = 0$' },
                { insert: '\\frac{1}{x} + \\frac{1}{x+1} = 1', label: '$\\frac{1}{x} + \\frac{1}{x+1} = 1$' },
                { insert: '\\sqrt{x+3} = x - 1',               label: '$\\sqrt{x+3} = x - 1$' },
              ].map(eg => (
                <button key={eg.insert} type="button"
                  onClick={() => {
                    const ta = textareaRef.current
                    if (ta) { ta.value = eg.insert; autoResize(ta); ta.focus() }
                    setQuestion(eg.insert)
                  }}
                  className="font-jakarta text-[12px] text-[#475569] border border-[#1E2D45] rounded-full px-3 py-1 hover:border-[#6366F1] hover:text-[#6366F1] transition">
                  <MathText inline>{eg.label}</MathText>
                </button>
              ))}
            </div>
          )}
        </form>

        {/* OCR loading */}
        {(ocring || ocringS) && (
          <div className="flex items-center gap-3 font-jakarta text-[14px] text-[#475569] animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#6366F1] animate-bounce" />
            {ocringS ? 'Đang nhận diện ảnh lời giải…' : 'Đang nhận diện ảnh…'}
          </div>
        )}

        {/* ── C1+C2: Chat thread ────────────────────────────────────────────── */}
        {messages.length > 0 && (
          <div className="flex flex-col gap-5">
            {messages.map((msg, idx) => {
              if (msg.role === 'user') {
                return (
                  <div key={idx} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#1E2D45] border border-[#2A3A5E] px-4 py-3">
                      <div className="font-jakarta text-[14px] text-[#F2A20C] leading-relaxed">
                        <MathText>{msg.content}</MathText>
                      </div>
                    </div>
                  </div>
                )
              }

              // Oracle message
              if (msg.type === 'solve') {
                return (
                  <div key={idx} className="flex flex-col gap-3">
                    <AnswerCard result={msg.result} problem={null} />
                  </div>
                )
              }
              if (msg.type === 'review') {
                return (
                  <div key={idx} className="flex flex-col gap-3">
                    <ReviewCard result={msg.result} problem={msg.problem} solution={msg.solution} />
                  </div>
                )
              }
              // socratic / followup — plain text bubble
              return (
                <div key={idx} className="flex justify-start">
                  <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-[#0F1726] border border-[#2A3A5E] px-4 py-3">
                    <div className="font-jakarta text-[14px] text-[#CBD5E1] leading-relaxed">
                      <MathText>{msg.content}</MathText>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 font-jakarta text-[14px] text-[#475569] animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#6366F1] animate-bounce" />
            {retryAttempt > 0
              ? `Đang thử lại sau timeout (lần ${retryAttempt + 1}/${MAX_RETRIES + 1})…`
              : chatMode === 'socratic' ? 'Oracle đang soạn câu hỏi gợi mở…'
              : chatMode === 'review'   ? 'Oracle đang chấm bài…'
              : 'Oracle đang truy vấn tri thức…'
            }
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 p-4 font-jakarta text-sm text-[#EF4444] flex items-center justify-between gap-4">
            <span>{error}</span>
            {/timed out|timeout|không kết nối/i.test(error) && lastSolveQuestion && (
              <button
                onClick={() => { setError(null); doSolveChat(lastSolveQuestion) }}
                className="shrink-0 px-3 py-1.5 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg text-[12px] font-semibold hover:bg-[#EF4444]/20 transition"
              >
                Thử lại
              </button>
            )}
          </div>
        )}

        {/* ── C4: "Luyện bài tương tự" — shown after a successful solve ──── */}
        {lastSolveResult && !loading && (
          <div className="flex justify-end">
            <button
              onClick={() => navigate(safeTopic
                ? `/practice/adaptive?topic=${safeTopic}`
                : '/practice/adaptive'
              )}
              className="font-jakarta text-[13px] font-semibold text-[#6366F1] hover:text-[#818CF8] border border-[#6366F1]/30 hover:border-[#6366F1]/60 rounded-lg px-4 py-2 transition">
              Luyện bài tương tự →
            </button>
          </div>
        )}

      </div>
    </motion.div>
  )
}

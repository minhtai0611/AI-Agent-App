import { useState, useEffect, useRef, useCallback } from 'react'
import { useOracle, ORACLE_STATUS } from '../context/OracleContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { TOPIC_LABELS } from '../utils/topicLabels.js'
import { motion } from 'framer-motion'
import DOMPurify from 'dompurify'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import Markdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { solveMath, getMathStats, getWikiStatus, ocrImage, reviewMath } from '../api/aiClient'
import { usePageMeta } from '../hooks/usePageMeta.js'
import SymbolPalette from '../components/SymbolPalette'
import { useVoiceInput } from '../hooks/useVoiceInput.js'

// One level of nested braces — handles \frac{\sqrt{x}}{2} correctly
const BARE_LATEX_RE = /\\[a-zA-Z]+(?:\{(?:[^{}]|\{[^{}]*\})*\}|\[[^\]]*\])*/g

// Wraps bare LaTeX commands (no surrounding $) in $...$ so remark-math picks them up.
// Handles mixed content: existing $...$ regions are preserved; bare \commands in prose
// segments are wrapped. Avoids the old early-return bug where partial $ coverage left
// undelimited LaTeX in prose segments invisible to KaTeX.
function normalizeMath(text) {
  if (!text) return ''
  if (!/\\[a-zA-Z]/.test(text)) return text  // no LaTeX at all — fast exit
  if (!text.includes('$')) {
    BARE_LATEX_RE.lastIndex = 0
    return text.replace(BARE_LATEX_RE, m => `$${m}$`)
  }
  // Mixed: split on $...$ or $$...$$, wrap bare LaTeX only in prose segments
  return text.replace(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)|([^$]+)/g, (_, math, prose) => {
    if (math) return math
    if (!prose || !/\\[a-zA-Z]/.test(prose)) return prose ?? ''
    BARE_LATEX_RE.lastIndex = 0
    return prose.replace(BARE_LATEX_RE, m => `$${m}$`)
  })
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
      remarkPlugins={[remarkGfm, REMARK_MATH_OPTS]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: pTag,
        ol: ({ children: c }) => <span>{c}</span>,
        ul: ({ children: c }) => <span>{c}</span>,
        li: ({ children: c }) => <span>{c}</span>,
      }}
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
  return normalizeMath(text ?? '')
}

function MathPreview({ text }) {
  if (!hasMath(text)) return null
  const display = preparePreview(text)
  return (
    <div className="rounded-xl border border-surface bg-surface px-4 py-3">
      <p className="font-sans text-[10px] font-semibold text-dim tracking-widest uppercase mb-2">
        Xem trước
      </p>
      <div className="font-sans text-[15px] text-muted leading-relaxed overflow-x-auto">
        <Markdown
          remarkPlugins={[remarkGfm, REMARK_MATH_OPTS]}
          rehypePlugins={[rehypeKatex]}
          components={{
            ol: ({ children: c }) => <span>{c}</span>,
            ul: ({ children: c }) => <span>{c}</span>,
            li: ({ children: c }) => <span>{c}</span>,
          }}
        >
          {display}
        </Markdown>
      </div>
    </div>
  )
}

const CONFIDENCE_COLOR = { high: 'var(--mastery-4)', medium: 'var(--mastery-3)', low: 'var(--mastery-1)' }
const CONFIDENCE_LABEL = { high: 'Có thể đúng', medium: 'Cần kiểm tra lại', low: 'Oracle không chắc' }

const PART_HEADER_RE = /^\*\*Phần\s+[a-dA-D]\w*\)\*\*$/

function StepList({ steps, figures = {} }) {
  let stepCounter = 0
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => {
        const trimmed = s.trim()
        const partMatch = trimmed.match(/^\*\*Phần\s+([a-dA-D])\w*\)\*\*$/)
        if (partMatch) {
          const partKey = partMatch[1].toLowerCase()
          return (
            <li key={i} className="mt-2 mb-1">
              <span className="font-sans text-[11px] font-semibold text-primary tracking-widest uppercase">
                {trimmed.replace(/\*\*/g, '')}
              </span>
              {figures[partKey] && <FigureBlock figure={figures[partKey]} />}
            </li>
          )
        }
        stepCounter++
        return (
          <li key={i} className="flex gap-3 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 border border-primary/30 text-primary text-[11px] font-bold flex items-center justify-center mt-0.5">
              {stepCounter}
            </span>
            <div className="font-sans text-[15px] text-foreground leading-relaxed">
              <MathText>{s}</MathText>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function StepReveal({ steps, figures = {} }) {
  const [revealed, setRevealed] = useState(1)
  const total = steps.length
  const showing = Math.min(revealed, total)

  useEffect(() => {
    if (showing >= total) return
    const handler = (e) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault()
        setRevealed(r => Math.min(r + 1, total))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showing, total])

  return (
    <div className="flex flex-col gap-4">
      <StepList steps={steps.slice(0, showing)} figures={figures} />
      {showing < total && (
        <div className="flex items-center gap-3 pt-1">
          <button onClick={() => setRevealed(r => r + 1)}
            className="px-4 py-1.5 rounded-lg font-sans text-[12px] font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition">
            Tiếp theo →
            <span className="ml-1.5 font-sans text-[10px] text-dim font-normal">(Space)</span>
          </button>
          <button onClick={() => setRevealed(total)}
            className="font-sans text-[11px] text-dim hover:text-muted transition">
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
    <div className="flex items-center gap-3 font-sans text-[12px] text-dim">
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
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
// Tries in order: local copy → cdn.geogebra.org → www.geogebra.org
// Local copy (public/deployggb.js) is the preferred path for reliability in
// regions where geogebra.org has intermittent connectivity issues.
let _ggbScriptPromise = null
function loadGeoGebraScript() {
  if (!_ggbScriptPromise) {
    _ggbScriptPromise = new Promise((resolve, reject) => {
      if (window.GGBApplet) { resolve(); return }
      const SRCS = [
        '/deployggb.js',
        'https://cdn.geogebra.org/apps/deployggb.js',
        'https://www.geogebra.org/apps/deployggb.js',
      ]
      function tryNext(idx) {
        if (idx >= SRCS.length) { reject(new Error('GeoGebra CDN unreachable')); return }
        const s = document.createElement('script')
        s.src = SRCS[idx]
        s.onload = resolve
        s.onerror = () => tryNext(idx + 1)
        document.head.appendChild(s)
      }
      tryNext(0)
    })
  }
  return _ggbScriptPromise
}

function is3DCommands(commands) {
  // Heuristic: 3D figures use Point3D syntax or three-coordinate tuples
  return /Point3D|Vector3D|\(\s*[\d.\-]+\s*,\s*[\d.\-]+\s*,\s*[\d.\-]+\s*\)/.test(commands)
}

// Suppress internal/auxiliary GeoGebra object names from user-visible warnings.
// PerpendicularFoot rewrite produces names like "perpfoot_1"; Circumcircle rewrite
// produces names like "circum_O"; and auto-named scratch objects follow /^[A-Z]{2,}\d+$/.
function _isInternalGgbObj(n) {
  return n.startsWith('_aux_')
    || n.toLowerCase().includes('perpfoot')
    || n.toLowerCase().includes('circum')
    || /^[A-Z]{2,}\d+$/.test(n)
}

function GeoGebraEmbed({ commands, viewport, onError }) {
  const wrapRef = useRef(null)
  const apiRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [undefinedObjs, setUndefinedObjs] = useState([])
  const [retryKey, setRetryKey] = useState(0)
  const [show3DHint, setShow3DHint] = useState(() => is3DCommands(commands ?? ''))

  useEffect(() => {
    if (!commands || !wrapRef.current) return
    let cancelled = false
    if (wrapRef.current) wrapRef.current.innerHTML = ''  // clear container before (re)inject

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
        const startTime = Date.now()
        const tid = setInterval(() => {
          if (cancelled) { clearInterval(tid); return }
          // Fix 2: 10s timeout to avoid infinite spinner on load failure
          if (Date.now() - startTime > 15_000) {
            clearInterval(tid)
            if (!cancelled) { setStatus('error'); onError?.() }
            return
          }
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
          // Auto-fit viewport: use point coords when available, fallback for function-only figures
          try {
            const names = api.getAllObjectNames?.('point') ?? []
            let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity
            for (const n of names) {
              if (_isInternalGgbObj(n)) continue
              const x = api.getXcoord(n), y = api.getYcoord(n)
              if (isFinite(x) && isFinite(y)) {
                xMin = Math.min(xMin, x); xMax = Math.max(xMax, x)
                yMin = Math.min(yMin, y); yMax = Math.max(yMax, y)
              }
            }
            if (isFinite(xMin)) {
              const pad = Math.max((xMax - xMin) * 0.25, (yMax - yMin) * 0.25, 1.5)
              api.setCoordSystem(xMin - pad, xMax + pad, yMin - pad, yMax + pad)
            } else if (viewport) {
              // Backend-provided viewport hint (calculus/function graphs)
              const { xmin = -5, xmax = 5, ymin = -5, ymax = 10 } = viewport
              api.setCoordSystem(xmin, xmax, ymin, ymax ?? 10)
            } else {
              // No discrete points — function-only figure; use a default teaching range
              api.setCoordSystem(-5, 10, -3, 15)
            }
          } catch (_) { /* ignore if API unavailable */ }
          // Fix 6: post-render check for undefined objects
          try {
            const named = [...commands.matchAll(/^([A-Za-z_]\w*)\s*=/gm)].map(m => m[1])
            const failed = named.filter(n => !_isInternalGgbObj(n) && api.isDefined && !api.isDefined(n))
            if (failed.length > 0) setUndefinedObjs(failed)
          } catch (_) { /* ignore */ }
          apiRef.current = api
          setStatus('ready')
        }, 300)

        const containerH = wrapRef.current.parentElement?.offsetHeight || 340
        const width = wrapRef.current.offsetWidth || 560
        const params = {
          appName: 'classic',
          width,
          height: containerH,
          showToolBar: false,
          showAlgebraInput: false,
          showMenuBar: false,
          enableRightClick: false,
          enableShiftDragZoom: true,
          showResetIcon: true,
          language: 'vi',
          errorDialogsActive: false,
        }
        appletRef = new window.GGBApplet(params, true)
        appletRef.inject(uid)
      })
      .catch(() => {
        _ggbScriptPromise = null  // Fix 3: allow retry on next mount
        if (!cancelled) { setStatus('error'); onError?.() }
      })

    return () => {
      cancelled = true
      if (wrapRef.current) wrapRef.current.innerHTML = ''  // Fix 5: destroy injected iframe
    }
  }, [commands, retryKey])

  return (
    <div className="relative rounded overflow-hidden bg-surface"
      style={{ height: 'min(360px, 56vw)', minHeight: 220 }}>
      {/* GeoGebra injects its iframe directly into this div */}
      <div ref={wrapRef} style={{ width: '100%', height: '100%' }} />

      {/* Loading overlay — sits on top until GeoGebra is ready */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface">
          <span className="font-sans text-[12px] text-dim">Đang tải GeoGebra…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface px-4 text-center">
          <span className="font-sans text-[12px] text-dim">Không thể tải GeoGebra</span>
          <span className="font-sans text-[11px] text-faint leading-snug max-w-[220px]">
            Máy chủ GeoGebra không phản hồi. Thử dùng mạng khác hoặc VPN.
          </span>
          <button
            onClick={() => { _ggbScriptPromise = null; setRetryKey(k => k + 1); setStatus('loading') }}
            className="font-sans text-[11px] text-primary hover:underline mt-1">
            Thử lại
          </button>
        </div>
      )}
      {/* Export PNG button */}
      {status === 'ready' && (
        <button
          onClick={() => {
            const b64 = apiRef.current?.getBase64?.(false)
            if (!b64) return
            const a = document.createElement('a')
            a.href = 'data:image/png;base64,' + b64
            a.download = 'hinh-minh-hoa.png'
            a.click()
          }}
          className="absolute top-2 right-2 px-2 py-1 rounded-md font-sans text-[10px] font-semibold transition"
          style={{ background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.85)' }}>
          Lưu hình
        </button>
      )}

      {/* 3D rotation hint — shown once for 3D figures, dismissed on first drag */}
      {status === 'ready' && show3DHint && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 pointer-events-none"
          onMouseDown={() => setShow3DHint(false)}
          onTouchStart={() => setShow3DHint(false)}>
          <span className="font-sans text-[11px] text-white/90">Kéo để xoay hình 3D</span>
        </div>
      )}
      {undefinedObjs.length > 0 && (
        <p className="font-sans text-[10px] text-primary mt-1">
          ⚠ Một số đối tượng không dựng được — hình có thể không chính xác
        </p>
      )}
    </div>
  )
}

function FigureBlock({ figure }) {
  if (!figure) return null  // no figure needed for this problem type
  if (figure.error || figure.type === 'error') {
    return (
      <p className="font-sans text-[11px] text-dim italic">Hình minh họa không khả dụng cho bài toán này</p>
    )
  }
  if (!figure.data) return null

  return (
    <div className="rounded-xl border border-surface bg-surface p-4 flex flex-col gap-3">
      <p className="font-sans text-[10px] font-semibold text-dim tracking-widest uppercase">
        {figure.caption || 'Hình minh họa'}
      </p>

      {figure.type === 'geogebra' ? (
        <GeoGebraEmbed commands={figure.data} viewport={figure.viewport} />
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
    <div className="flex flex-col gap-5">
      {/* Problem statement */}
      {problem && (
        <div className="rounded-xl border border-surface bg-surface px-5 py-4">
          <p className="font-sans text-[10px] font-semibold text-dim tracking-widest uppercase mb-2">
            Bài toán
          </p>
          <div className="font-sans text-[15px] text-foreground leading-relaxed overflow-x-auto">
            <Markdown
              remarkPlugins={[remarkGfm, REMARK_MATH_OPTS]}
              rehypePlugins={[rehypeKatex]}
              components={{
                ol: ({ children: c }) => <span>{c}</span>,
                ul: ({ children: c }) => <span>{c}</span>,
                li: ({ children: c }) => <span>{c}</span>,
              }}
            >
              {preparePreview(problem)}
            </Markdown>
          </div>
        </div>
      )}

      {/* Figure: top-level only when no per-part figures exist */}
      {!answer.figures || Object.keys(answer.figures).length === 0
        ? <FigureBlock figure={answer.figure} />
        : null
      }

      {/* Unverified warning banner */}
      {showUnverifiedWarning && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 font-sans text-[13px] text-primary">
          Kết quả chưa được xác minh — kiểm tra lại cẩn thận
        </div>
      )}

      {/* Steps */}
      {answer.steps?.length > 0 && (
        <div className="rounded-xl border border-surface bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-sans text-[11px] font-semibold text-dim tracking-widest uppercase">Lời giải</p>
            <div className="flex items-center gap-3">
              {answer.problem_type && (
                <span className="font-sans text-[11px] text-dim capitalize">
                  {answer.problem_type.replace(/_/g, ' ')}
                </span>
              )}
              {!result.wiki_assisted && (
                <span className="font-sans text-[11px] font-semibold tracking-widest uppercase"
                  style={{ color: 'var(--accent)', opacity: 0.8 }}>
                  AI trực tiếp
                </span>
              )}
              <span className="font-sans text-[11px] font-semibold tracking-widest uppercase"
                style={{ color: CONFIDENCE_COLOR[confidence] }}>
                {CONFIDENCE_LABEL[confidence]}
              </span>
              {!validation.valid && validation.issues?.length > 0 && (
                <span className="font-sans text-[11px] text-destructive">⚠ {validation.issues[0]}</span>
              )}
            </div>
          </div>
          <StepReveal steps={answer.steps} figures={answer.figures ?? {}} />
        </div>
      )}

      {/* Enrichment badge */}
      {result.enriched > 0 && (
        <div className="flex items-center gap-2 font-sans text-[12px] text-success">
          <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
          Oracle đã học thêm {result.enriched} đơn vị tri thức mới
          {result.enriched_topics?.length > 0 && ` (${result.enriched_topics.join(', ')})`}
        </div>
      )}

      {/* Knowledge used — show count only; raw IDs are internal and meaningless to users */}
      {result.retrieved_ids?.length > 0 && (
        <div className="flex items-center gap-1.5 font-sans text-[11px] text-dim">
          <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
          Dựa trên {result.retrieved_ids.length} đơn vị kiến thức
        </div>
      )}
    </div>
  )
}

const VERDICT_COLOR  = { correct: 'var(--mastery-4)', partial: 'var(--mastery-3)', incorrect: 'var(--mastery-1)' }
const VERDICT_LABEL  = { correct: 'Đúng',   partial: 'Một phần', incorrect: 'Sai' }

function ReviewCard({ result, problem, solution }) {
  const verdictColor = VERDICT_COLOR[result.verdict] || '#94A3B8'
  const verdictLabel = VERDICT_LABEL[result.verdict] || result.verdict

  return (
    <div className="flex flex-col gap-5">
      {/* Problem */}
      {problem && (
        <div className="rounded-xl border border-surface bg-surface px-5 py-4">
          <p className="font-sans text-[10px] font-semibold text-dim tracking-widest uppercase mb-2">Bài toán</p>
          <div className="font-sans text-[15px] text-foreground leading-relaxed overflow-x-auto">
            <Markdown
              remarkPlugins={[remarkGfm, REMARK_MATH_OPTS]}
              rehypePlugins={[rehypeKatex]}
              components={{
                ol: ({ children: c }) => <span>{c}</span>,
                ul: ({ children: c }) => <span>{c}</span>,
                li: ({ children: c }) => <span>{c}</span>,
              }}
            >
              {preparePreview(problem)}
            </Markdown>
          </div>
        </div>
      )}

      {/* Solution submitted */}
      {solution && (
        <div className="rounded-xl border border-surface bg-surface px-5 py-4">
          <p className="font-sans text-[10px] font-semibold text-dim tracking-widest uppercase mb-2">Lời giải đã nộp</p>
          <div className="font-sans text-[15px] text-muted leading-relaxed overflow-x-auto">
            <Markdown
              remarkPlugins={[remarkGfm, REMARK_MATH_OPTS]}
              rehypePlugins={[rehypeKatex]}
              components={{
                ol: ({ children: c }) => <span>{c}</span>,
                ul: ({ children: c }) => <span>{c}</span>,
                li: ({ children: c }) => <span>{c}</span>,
              }}
            >
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
          <span className="font-sans text-[15px] font-semibold" style={{ color: verdictColor }}>{verdictLabel}</span>
          <span className="font-sans text-[22px] font-bold" style={{ color: verdictColor }}>{result.score}</span>
        </div>
        <span className="font-sans text-[10px] text-dim text-right leading-tight max-w-[120px]">
          Ước tính của Oracle · không phải điểm THPT chính thức
        </span>
      </div>

      {/* Feedback */}
      {result.feedback && (
        <div className="rounded-xl border border-surface bg-surface px-5 py-4">
          <p className="font-sans text-[10px] font-semibold text-dim tracking-widest uppercase mb-2">Nhận xét</p>
          <div className="font-sans text-[14px] text-foreground leading-relaxed">
            <MathText>{result.feedback}</MathText>
          </div>
        </div>
      )}

      {/* Correct steps */}
      {result.correct_steps?.length > 0 && (
        <div className="rounded-xl border border-success/20 bg-success/5 px-5 py-4">
          <p className="font-sans text-[10px] font-semibold text-success tracking-widest uppercase mb-3">Các bước đúng</p>
          <ol className="flex flex-col gap-2">
            {result.correct_steps.map((s, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="shrink-0 w-5 h-5 rounded-full bg-success/20 border border-success/30 text-success text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                <div className="font-sans text-[14px] text-muted leading-relaxed"><MathText>{s}</MathText></div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Errors */}
      {result.errors?.length > 0 && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4">
          <p className="font-sans text-[10px] font-semibold text-destructive tracking-widest uppercase mb-3">Lỗi phát hiện</p>
          <ul className="flex flex-col gap-2">
            {result.errors.map((e, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="shrink-0 text-destructive text-[12px] mt-0.5">✕</span>
                <div className="font-sans text-[14px] text-muted leading-relaxed"><MathText>{e}</MathText></div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Correct approach */}
      {result.correct_approach && (
        <div className="rounded-xl border border-info/20 bg-info/5 px-5 py-4">
          <p className="font-sans text-[10px] font-semibold text-info tracking-widest uppercase mb-2">Phương pháp đúng</p>
          <div className="font-sans text-[14px] text-muted leading-relaxed"><MathText>{result.correct_approach}</MathText></div>
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

const DAILY_FREE_SOLVES = 8  // must match backend /math-solve cap
const DAILY_SOLVES_KEY = () => `oracle_solves_${new Date().toISOString().slice(0, 10)}`
function getDailySolves() {
  try { return parseInt(localStorage.getItem(DAILY_SOLVES_KEY()) || '0', 10) } catch { return 0 }
}
function incrementDailySolves() {
  try { localStorage.setItem(DAILY_SOLVES_KEY(), String(getDailySolves() + 1)) } catch {}
}

const SOLVE_PHASES = [
  { key: 'classifying', label: 'Phân loại bài toán…' },
  { key: 'retrieving',  label: 'Tra cứu kiến thức…' },
  { key: 'solving',     label: 'Đang giải…' },
  { key: 'validating',  label: 'Xác minh kết quả…' },
]

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
  const [searchParams] = useSearchParams()
  usePageMeta('Luminary AI · Giải toán từng bước', { description: 'Nhập bài toán và Luminary AI giải từng bước chi tiết. Hỗ trợ LaTeX, tiếng Việt, nhiều dạng toán THPT.' })
  const { user } = useAuth()
  const isPaidTier = user?.subscription_tier === 'student' || user?.subscription_tier === 'complete'
  const MAX_RETRIES = 2

  // ── C1+C2: Chat thread state ──────────────────────────────────────────────
  // chatMode: 'solve' | 'socratic' | 'review'
  // messages: [{ role:'user'|'oracle', content, steps, type, result }]
  const [chatMode, setChatMode] = useState('solve')
  const [messages, setMessages] = useState([])
  const chatEndRef = useRef(null)

  const { setOracleStatus } = useOracle()

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
  const [ocrSolutionWarning, setOcrSolutionWarning] = useState(false)
  const [cameraMenu, setCameraMenu] = useState(null) // null | 'question' | 'solution'
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState(null)
  const [solvePhase, setSolvePhase] = useState(null)
  const [dailySolves, setDailySolves] = useState(() => getDailySolves())
  const solvePhaseTimersRef = useRef([])

  // ── C3: History sidebar ───────────────────────────────────────────────────
  const [history, setHistory] = useState(() => loadHistory())
  const [historyOpen, setHistoryOpen] = useState(false) // mobile dropdown

  // ── First-use intro card ──────────────────────────────────────────────────
  const [showIntro, setShowIntro] = useState(
    () => !localStorage.getItem(`oracle_intro_seen_${user?.id}`)
  )

  function dismissIntro() {
    if (user?.id) localStorage.setItem(`oracle_intro_seen_${user.id}`, 'true')
    setShowIntro(false)
  }

  const deleteHistory = id => {
    const updated = history.filter(h => h.id !== id)
    saveHistory(updated)
    setHistory(updated)
  }
  const clearHistory = () => { saveHistory([]); setHistory([]) }

  // Pre-fill from ?q= URL param (e.g. navigating from Landing page Oracle input)
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setQuestion(q)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const textareaRef = useRef(null)
  const solutionRef = useRef(null)
  const { listening, startListening, isSupported: voiceSupported } = useVoiceInput(text => {
    setQuestion(prev => prev ? prev + ' ' + text : text)
    if (textareaRef.current) { textareaRef.current.value = question ? question + ' ' + text : text; autoResize(textareaRef.current) }
  })
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const solutionFileInputRef = useRef(null)
  const solutionCameraInputRef = useRef(null)
  const ocrFileRef = useRef(null) // last OCR'd file — passed to solveMath for multimodal figure generation

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

  // Revoke OCR preview URL on unmount to avoid memory leaks
  useEffect(() => () => { if (ocrPreviewUrl) URL.revokeObjectURL(ocrPreviewUrl) }, [ocrPreviewUrl])

  function startSolvePhaseTimer() {
    solvePhaseTimersRef.current.forEach(clearTimeout)
    setSolvePhase('classifying')
    const delays = [[4000, 'retrieving'], [13000, 'solving'], [36000, 'validating']]
    solvePhaseTimersRef.current = delays.map(([ms, phase]) => setTimeout(() => setSolvePhase(phase), ms))
  }
  function clearSolvePhaseTimer() {
    solvePhaseTimersRef.current.forEach(clearTimeout)
    solvePhaseTimersRef.current = []
    setSolvePhase(null)
  }

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
    }
  }

  async function doSolveChat(text, attempt = 0) {
    setLoading(true)
    setOracleStatus(ORACLE_STATUS.THINKING)
    setRetryAttempt(attempt)
    setLastSolveQuestion(text)
    if (attempt === 0) startSolvePhaseTimer()
    const imgFile = ocrFileRef.current
    ocrFileRef.current = null  // consume once
    if (ocrPreviewUrl) { URL.revokeObjectURL(ocrPreviewUrl); setOcrPreviewUrl(null) }
    const { data, error: err } = await solveMath(text, imgFile)
    clearSolvePhaseTimer()
    if (err) {
      const isTimeout = /timed out|504|timeout|không kết nối|network error/i.test(err)
      if (isTimeout && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000))
        return doSolveChat(text, attempt + 1)
      }
      setLoading(false)
      setOracleStatus(ORACLE_STATUS.ERROR)
      setTimeout(() => setOracleStatus(ORACLE_STATUS.IDLE), 1500)
      setRetryAttempt(0)
      setError(err)
      // Remove optimistic user message on error
      setMessages(prev => prev.slice(0, -1))
      return
    }
    setLoading(false)
    setRetryAttempt(0)
    incrementDailySolves()
    setDailySolves(getDailySolves())
    const answer = data?.answer || {}
    const isHighConf = answer.confidence === 'high' && data?.validation?.valid
    setOracleStatus(isHighConf ? ORACLE_STATUS.CELEBRATING : ORACLE_STATUS.IDLE)
    if (isHighConf) setTimeout(() => setOracleStatus(ORACLE_STATUS.IDLE), 1500)
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
    ocrFileRef.current = file  // store for multimodal figure generation
    // Show the source image beside the textarea while user edits extracted text
    if (ocrPreviewUrl) URL.revokeObjectURL(ocrPreviewUrl)
    setOcrPreviewUrl(URL.createObjectURL(file))
    const ta = textareaRef.current
    if (ta) { ta.value = text; autoResize(ta); ta.focus() }
    setQuestion(text)
  }

  async function handleOcrSolution(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setOcringS(true)
    setOcrSolutionWarning(false)
    setError(null)
    const { data, error: err } = await ocrImage(file)
    setOcringS(false)
    if (err) { setError(err); return }
    const text = data?.text || ''
    // Heuristic: flag OCR results that look noisy (likely handwriting artifacts).
    // Count chars outside the expected math+Vietnamese set; warn if >18% are noise.
    if (text.length > 3) {
      const noiseCount = (text.match(/[^\w\s$\\{}^_=+\-*/.,()\[\]%'"|:!?àáảãạăắặẳẵâấậẩẫèéẹẻẽêếềệểễìíịỉĩòóọỏõôốồộổỗơớờợởỡùúụủũưứừựửữỳýỵỷỹđÀÁẢÃẠĂẮẶẲẴÂẤẬẨẪÈÉẸẺẼÊẾỀỆỂỄÌÍỊỈĨÒÓỌỎÕÔỐỒỘỔỖƠỚỜỢỞỠÙÚỤỦŨƯỨỪỰỬỮỲÝỴỶỸĐ]/g) || []).length
      if (noiseCount / text.length > 0.18) setOcrSolutionWarning(true)
    }
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
    ['review', 'Chấm bài'],
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
      className="min-h-screen relative overflow-hidden"
      style={{ background: 'var(--bg)' }}>

      {/* Ambient glow */}
      <div className="absolute pointer-events-none rounded-full opacity-40"
        style={{ width: 600, height: 400, left: '50%', top: 0, transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, rgba(91,143,240,0.09) 0%, transparent 70%)' }} />

      {/* ── C3: Desktop history sidebar (lg+) ────────────────────────────── */}
      {history.length > 0 && (
        <div className="hidden lg:flex flex-col gap-1 fixed left-4 top-24 w-48 max-h-[70vh] overflow-y-auto z-20">
          <div className="flex items-center justify-between px-1 mb-1">
            <p className="font-sans text-[10px] font-semibold text-dim tracking-widest uppercase">
              Lịch sử
            </p>
            <button onClick={clearHistory}
              title="Xoá tất cả"
              className="text-dim hover:text-destructive transition text-[14px] leading-none">
              ✕
            </button>
          </div>
          {history.map(item => (
            <div key={item.id} className="group flex items-center gap-1">
              <button
                onClick={() => {
                  const ta = textareaRef.current
                  if (ta) { ta.value = item.problem; autoResize(ta); ta.focus() }
                  setQuestion(item.problem)
                }}
                className="flex-1 text-left font-sans text-[11px] text-dim hover:text-muted hover:bg-surface border border-transparent hover:border-surface rounded-lg px-2.5 py-1.5 transition truncate"
                title={item.problem}>
                {item.problem}
              </button>
              <button onClick={() => deleteHistory(item.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-dim hover:text-destructive transition text-[11px] px-1">
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-12 flex flex-col gap-8">

        {/* Back */}
        <button onClick={() => navigate('/')}
          className="self-start font-sans text-sm text-dim hover:text-muted transition flex items-center gap-1.5">
          ← Trang chủ
        </button>

        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[10px] font-semibold text-info tracking-[3px] uppercase">
              Experimental · AI Knowledge System
            </span>
            {/* Wiki status dot */}
            {wikiStatus === null
              ? <div className="w-1.5 h-1.5 rounded-full bg-dim" title="Đang tải…" />
              : wikiReady
                ? <div className="w-1.5 h-1.5 rounded-full bg-success" title="Tri thức đã sẵn sàng" />
                : <div className="w-1.5 h-1.5 rounded-full bg-faint" title="" />
            }
          </div>
          <h1 className="font-sans text-[52px] font-bold text-foreground leading-none tracking-tight flex items-center gap-3">
            <span style={{ color: 'var(--accent)' }} className={loading ? 'animate-pulse' : ''}>✦</span>
            Toán Oracle
          </h1>
          <p className="font-sans text-[15px] text-dim leading-relaxed max-w-[480px]">
            Đặt câu hỏi toán — Oracle truy vấn kho tri thức và giải từng bước.
          </p>
        </div>

        {/* ── C1+C2: Mode toggle (3 options) + mobile history ───────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-2">
            {MODE_OPTS.map(([m, label]) => {
              const requiresPaid = m === 'review'
              const locked = requiresPaid && !isPaidTier
              return (
                <button key={m} type="button"
                  onClick={() => locked ? navigate('/account') : (setChatMode(m), setMessages([]), setError(null))}
                  title={locked ? 'Yêu cầu gói Học sinh trở lên' : undefined}
                  className="font-sans text-[12px] font-semibold px-4 py-1.5 rounded-full transition flex items-center gap-1"
                  style={locked
                    ? { background: 'transparent', border: '1px solid var(--surface)', color: 'var(--dim)', opacity: 0.6 }
                    : chatMode === m
                      ? { background: 'var(--info)', color: '#fff' }
                      : { background: 'transparent', border: '1px solid var(--surface)', color: 'var(--dim)' }}>
                  {locked && <span className="text-[10px]">🔒</span>}
                  {label}
                </button>
              )
            })}
          </div>

          {/* ── C3: Mobile history toggle ─────────────────────────────── */}
          {history.length > 0 && (
            <div className="relative lg:hidden ml-auto">
              <button
                type="button"
                onClick={() => setHistoryOpen(o => !o)}
                className="font-sans text-[11px] text-dim hover:text-muted border border-surface rounded-full px-3 py-1 transition">
                Lịch sử
              </button>
              {historyOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setHistoryOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 rounded-xl border border-surface bg-surface shadow-xl overflow-hidden" style={{ minWidth: 220 }}>
                    {history.slice(0, 5).map(item => (
                      <div key={item.id} className="flex items-center border-b border-surface last:border-0">
                        <button
                          onClick={() => {
                            setHistoryOpen(false)
                            const ta = textareaRef.current
                            if (ta) { ta.value = item.problem; autoResize(ta); ta.focus() }
                            setQuestion(item.problem)
                          }}
                          className="flex-1 text-left px-4 py-2.5 font-sans text-[12px] text-muted hover:bg-surface transition truncate">
                          {item.problem}
                        </button>
                        <button onClick={() => deleteHistory(item.id)}
                          className="shrink-0 px-3 py-2.5 text-dim hover:text-destructive transition text-[13px]">
                          ×
                        </button>
                      </div>
                    ))}
                    {history.length > 0 && (
                      <button onClick={() => { clearHistory(); setHistoryOpen(false) }}
                        className="w-full px-4 py-2 font-sans text-[11px] text-dim hover:text-destructive transition text-center border-t border-surface">
                        Xoá tất cả
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Daily solve counter — shows remaining for basic tier, count-only for paid */}
          {!isPaidTier && user ? (
            <span className="font-sans text-[11px] ml-auto lg:ml-0"
              style={{ color: dailySolves >= DAILY_FREE_SOLVES - 2 ? 'var(--warning)' : 'var(--dim)' }}>
              {Math.max(0, DAILY_FREE_SOLVES - dailySolves)}/{DAILY_FREE_SOLVES} lượt còn lại
            </span>
          ) : dailySolves > 0 ? (
            <span className="font-sans text-[11px] text-dim ml-auto lg:ml-0">
              {dailySolves} lần hôm nay
            </span>
          ) : null}

          {/* ── C1: New conversation button (only when thread has messages) ── */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => { setMessages([]); setError(null) }}
              className="font-sans text-[11px] text-dim hover:text-muted transition ml-auto lg:ml-0">
              Cuộc trò chuyện mới
            </button>
          )}
        </div>

        {/* First-use intro card */}
        {showIntro && (
          <div data-testid="oracle-intro-card" className="mb-4 p-4 bg-surface border border-border rounded-xl flex flex-col gap-3">
            <p className="font-sans text-[14px] font-semibold text-foreground">Hỏi AI — Gia sư Toán 24/7</p>
            <ul className="flex flex-col gap-1">
              {[
                '✓ Giải từng bước — không chỉ đáp án',
                '✓ Giải thích tại sao từng bước đúng',
                '✓ Chỉ Toán THPT và Lớp 10 — không giải môn khác',
              ].map(item => (
                <li key={item} className="font-sans text-[12px] text-dim">{item}</li>
              ))}
            </ul>
            <button
              onClick={dismissIntro}
              className="font-sans text-[12px] font-semibold text-primary text-left"
            >
              Đã hiểu, bắt đầu hỏi →
            </button>
          </div>
        )}

        {/* Input */}
        <style>{`
          .oracle-textarea::placeholder { color: var(--color-dim); }
          .oracle-textarea { caret-color: var(--color-foreground); }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <form onSubmit={handleSolveForm} className="flex flex-col gap-3">
          <div className="rounded-xl border border-surface bg-surface focus-within:border-[var(--primary-border)] focus-within:shadow-glow transition-all overflow-hidden">
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
                  : 'Nhập bài toán… (hỗ trợ LaTeX, nhiều dòng, tiếng Việt)\nVD: Giải phương trình x² – 5x + 6 = 0'
              }
              rows={3}
              className={`oracle-textarea${ocring ? ' opacity-60 cursor-not-allowed' : ''}`}
              style={{
                display: 'block', width: '100%', resize: 'none', overflow: 'hidden',
                background: 'transparent', fontSize: 15, minHeight: 52,
                padding: '16px 20px 12px', boxSizing: 'border-box',
                outline: 'none', border: 'none', lineHeight: 1.6,
                fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif",
              }}
            />
            <SymbolPalette onInsert={handleInsert} />
            <div className="flex justify-end items-center gap-2 px-3 py-2 border-t border-surface">
              {/* Voice input */}
              {voiceSupported && (
                <button
                  type="button"
                  title={listening ? 'Đang nghe...' : 'Nhập bằng giọng nói'}
                  onClick={startListening}
                  disabled={listening || ocring || loading}
                  className={`p-1.5 transition disabled:opacity-40 ${listening ? 'text-[var(--destructive)]' : 'text-dim hover:text-muted'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                </button>
              )}
              {/* OCR image upload / camera capture */}
              <div className="relative">
                <button
                  type="button"
                  title="Nhận diện ảnh"
                  onClick={() => setCameraMenu(m => m === 'question' ? null : 'question')}
                  disabled={ocring || loading}
                  className="p-1.5 text-dim hover:text-muted disabled:opacity-40 transition"
                >
                  {ocring
                    ? <span style={{ display:'inline-block', width:14, height:14, border:'2px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.6s linear infinite' }} />
                    : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  }
                </button>
                {cameraMenu === 'question' && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCameraMenu(null)} />
                    <div className="absolute bottom-full right-0 mb-1 z-20 rounded-lg border border-surface bg-surface shadow-xl overflow-hidden" style={{ minWidth: 160 }}>
                      <button type="button"
                        onClick={() => { setCameraMenu(null); fileInputRef.current?.click() }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 font-sans text-[13px] text-muted hover:bg-surface transition text-left">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Tải ảnh lên
                      </button>
                      <button type="button"
                        onClick={() => { setCameraMenu(null); cameraInputRef.current?.click() }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 font-sans text-[13px] text-muted hover:bg-surface transition text-left border-t border-surface">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        Chụp ảnh
                      </button>
                    </div>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleOcrFile} style={{ display: 'none' }} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleOcrFile} style={{ display: 'none' }} />
              <span className="font-sans text-[11px] text-dim">⌘ Enter</span>
              <button type="submit" disabled={!question.trim() || loading || ocring || ocringS}
                className="px-4 py-1.5 bg-info text-white font-sans font-semibold text-sm rounded-lg disabled:opacity-40 hover:bg-info/80 transition">
                {loading
                  ? (chatMode === 'review' ? 'Đang chấm…' : 'Đang tính…')
                  : (chatMode === 'review' ? 'Chấm bài' : 'Giải')}
              </button>
            </div>
          </div>
          {/* OCR source image preview — shown beside textarea while user corrects extracted text */}
          {ocrPreviewUrl && (
            <div className="flex items-start gap-3 px-1">
              <div className="relative shrink-0">
                <img
                  src={ocrPreviewUrl}
                  alt="Ảnh gốc"
                  className="w-20 h-20 object-cover rounded-lg border border-surface"
                />
                <button
                  type="button"
                  title="Xoá ảnh"
                  onClick={() => { URL.revokeObjectURL(ocrPreviewUrl); setOcrPreviewUrl(null); ocrFileRef.current = null }}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-surface border border-surface flex items-center justify-center font-sans text-[10px] text-dim hover:text-destructive transition">
                  ✕
                </button>
              </div>
              <p className="font-sans text-[11px] text-dim pt-1 leading-relaxed">
                Ảnh gốc · Kiểm tra văn bản ở trên và sửa nếu nhận diện sai
              </p>
            </div>
          )}
          <MathPreview text={question} />

          {/* Solution textarea — only in review mode */}
          {chatMode === 'review' && (
            <div className="rounded-xl border border-surface bg-surface focus-within:border-[var(--primary-border)] focus-within:shadow-glow transition-all overflow-hidden">
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
                  background: 'transparent', fontSize: 15,
                  padding: '16px 20px 12px', boxSizing: 'border-box',
                  outline: 'none', border: 'none', lineHeight: 1.6,
                  fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif",
                }}
              />
              <div className="flex justify-end items-center gap-2 px-3 py-2 border-t border-surface">
                <div className="relative">
                  <button type="button" title="Nhận diện ảnh lời giải"
                    onClick={() => setCameraMenu(m => m === 'solution' ? null : 'solution')}
                    disabled={ocringS || loading}
                    className="p-1.5 text-dim hover:text-muted disabled:opacity-40 transition">
                    {ocringS
                      ? <span style={{ display:'inline-block', width:14, height:14, border:'2px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.6s linear infinite' }} />
                      : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    }
                  </button>
                  {cameraMenu === 'solution' && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setCameraMenu(null)} />
                      <div className="absolute bottom-full right-0 mb-1 z-20 rounded-lg border border-surface bg-surface shadow-xl overflow-hidden" style={{ minWidth: 160 }}>
                        <button type="button"
                          onClick={() => { setCameraMenu(null); solutionFileInputRef.current?.click() }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 font-sans text-[13px] text-muted hover:bg-surface transition text-left">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          Tải ảnh lên
                        </button>
                        <button type="button"
                          onClick={() => { setCameraMenu(null); solutionCameraInputRef.current?.click() }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 font-sans text-[13px] text-muted hover:bg-surface transition text-left border-t border-surface">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                          Chụp ảnh
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <input ref={solutionFileInputRef} type="file" accept="image/*" onChange={handleOcrSolution} style={{ display: 'none' }} />
                <input ref={solutionCameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleOcrSolution} style={{ display: 'none' }} />
                <span className="font-sans text-[11px] text-dim">Lời giải</span>
              </div>
            </div>
          )}

          {/* OCR solution low-confidence warning */}
          {ocrSolutionWarning && chatMode === 'review' && (
            <p className="font-sans text-[11px] text-[var(--warning)] flex items-center gap-1.5">
              ⚠ Nhận diện ảnh có thể không chính xác — kiểm tra lại lời giải trước khi chấm
            </p>
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
                  className="font-sans text-[12px] text-dim border border-surface rounded-full px-3 py-1 hover:border-info hover:text-info transition">
                  <MathText inline>{eg.label}</MathText>
                </button>
              ))}
            </div>
          )}
        </form>

        {/* OCR loading */}
        {(ocring || ocringS) && (
          <div className="font-sans text-[14px] text-dim">
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
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-surface border border-surface px-4 py-3">
                      <div className="font-sans text-[14px] text-primary leading-relaxed">
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
                  <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-surface border border-surface px-4 py-3">
                    <div className="font-sans text-[14px] text-foreground leading-relaxed">
                      <MathText>{msg.content}</MathText>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Loading / solve progress indicator */}
        {loading && (
          <div className="flex flex-col gap-2">
            {retryAttempt > 0 ? (
              <span className="font-sans text-[14px] text-dim">
                Đang thử lại sau timeout (lần {retryAttempt + 1}/{MAX_RETRIES + 1})…
              </span>
            ) : chatMode === 'review' ? (
              <span className="font-sans text-[14px] text-dim">Oracle đang chấm bài…</span>
            ) : solvePhase ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <span style={{ display:'inline-block', width:12, height:12, border:'2px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.6s linear infinite', flexShrink:0 }} />
                  <span className="font-sans text-[14px] text-dim">
                    {SOLVE_PHASES.find(p => p.key === solvePhase)?.label ?? 'Đang xử lý…'}
                  </span>
                </div>
                <div className="flex gap-1">
                  {SOLVE_PHASES.map(p => (
                    <div key={p.key}
                      className="h-0.5 rounded-full flex-1 transition-colors duration-500"
                      style={{ background: SOLVE_PHASES.findIndex(x => x.key === solvePhase) >= SOLVE_PHASES.findIndex(x => x.key === p.key) ? 'var(--info)' : 'var(--surface)' }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <span className="font-sans text-[14px] text-dim">Oracle đang truy vấn tri thức…</span>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 font-sans text-sm text-destructive flex items-center justify-between gap-4">
            <span>{error}</span>
            {/timed out|timeout|không kết nối/i.test(error) && lastSolveQuestion && (
              <button
                onClick={() => { setError(null); doSolveChat(lastSolveQuestion) }}
                className="shrink-0 px-3 py-1.5 bg-destructive/10 border border-destructive/30 rounded-lg text-[12px] font-semibold hover:bg-destructive/20 transition"
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
              className="font-sans text-[13px] font-semibold text-info hover:text-info border border-info/30 hover:border-info/60 rounded-lg px-4 py-2 transition">
              Luyện bài tương tự →
            </button>
          </div>
        )}

      </div>
    </motion.div>
  )
}

// App-wide ambient background — mounted once in App.jsx's AppInner so every
// route (including org/admin dashboards) gets it without per-page edits. Two
// slow-drifting violet/purple glows (see .ambient-bg in index.css, reusing
// the nebula-breathe keyframes already proven on the Navbar mobile overlay)
// plus a faint math-notation texture: this app's authentic equivalent of
// KAGAKU's kanji strip / Sifria's circuit grid — real domain texture, not
// decoration, matching the principle already applied to the ExamSelect hero.
// Pure CSS/SVG, no WebGL — this is Tier-1 chrome present on every route, so
// it must stay cheap; reduced-motion/high-contrast handling lives in the CSS.
const SYMBOLS = ['∫', 'Σ', '√', 'π', '∞', 'Δ']

function MathTexture() {
  return (
    <svg className="ambient-texture" width="100%" height="100%" aria-hidden="true">
      <defs>
        <pattern id="ambient-grid" width="120" height="120" patternUnits="userSpaceOnUse">
          <path d="M 120 0 L 0 0 0 120" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
        <pattern id="ambient-symbols" width="240" height="240" patternUnits="userSpaceOnUse">
          {SYMBOLS.map((s, i) => (
            <text
              key={s}
              x={30 + (i % 3) * 80}
              y={60 + Math.floor(i / 3) * 120}
              fontSize="28"
              fontFamily="'JetBrains Mono', monospace"
              fill="currentColor"
            >
              {s}
            </text>
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#ambient-grid)" />
      <rect width="100%" height="100%" fill="url(#ambient-symbols)" />
    </svg>
  )
}

export default function AmbientBackground() {
  return (
    <div className="ambient-bg" aria-hidden="true">
      <div className="ambient-wisp" style={{ width: 620, height: 620, top: '-12%', right: '-8%' }} />
      <div className="ambient-wisp" style={{ width: 520, height: 520, bottom: '-15%', left: '-10%' }} />
      <MathTexture />
    </div>
  )
}

// Vantage v1.4.1 "cờ đỉnh" (summit flag) mark — a flat vermillion wedge, no
// gradient, no glow. The same geometry survives from the earlier "Voltage"
// mark since it already reads as a mountain/flag triangle; only the type
// pairing changes (Space Grotesk, per design-system.html) and the wordmark
// gains the ▲ glyph the shell spec calls for ("Wordmark VANTAGE ▲").
function SummitWedge({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M20 4 L34 30 L6 30 Z" fill="currentColor" />
      <rect x="17" y="18" width="6" height="12" fill="var(--background)" />
    </svg>
  )
}

export default function VantageLogo({ variant = 'nav', onClick }) {
  const isHero = variant === 'hero'
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: isHero ? 'column' : 'row',
        alignItems: 'center',
        gap: isHero ? 10 : 6,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ color: 'var(--accent)' }}>
        <SummitWedge size={isHero ? 52 : 20} />
      </div>
      <span
        className="font-bold uppercase"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: isHero ? 38 : 14,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: 'var(--ink)',
        }}
      >
        VANTAGE <span style={{ color: 'var(--accent)' }}>▲</span>
      </span>
    </div>
  )
}

// Voltage mark — a bold flat wedge, no gradient, no soft glow.
// Replaces the "Summit Beacon" mark as part of the Ascent → Voltage redesign
// (Direction C: high-contrast, single-accent, flat geometry).
// viewBox 0 0 40 40
function VoltageWedge({ size = 24 }) {
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
      <div className="text-primary">
        <VoltageWedge size={isHero ? 52 : 20} />
      </div>
      <span
        className="font-bold text-foreground uppercase"
        style={{
          fontFamily: "'Sora Variable', Sora, system-ui, sans-serif",
          fontSize: isHero ? 38 : 14,
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}
      >
        VANTAGE
      </span>
      {isHero && (
        <span
          className="text-muted-fg font-semibold"
          style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}
        >
          Học thật, đỗ thật
        </span>
      )}
    </div>
  )
}

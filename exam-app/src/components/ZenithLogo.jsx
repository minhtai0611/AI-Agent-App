// Mountain peak icon — simple SVG, no external dependency
function MountainIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 20 L9 8 L12 13 L15 9 L21 20 Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}

export default function ZenithLogo({ variant = 'nav', onClick }) {
  const isHero = variant === 'hero'
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isHero ? 8 : 4,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div
        className="text-primary flex items-center gap-2"
        style={{ flexDirection: isHero ? 'column' : 'row' }}
      >
        <div className="text-primary">
          <MountainIcon size={isHero ? 40 : 20} />
        </div>
        <span
          className="font-bold text-primary"
          style={{ fontSize: isHero ? 36 : 15, letterSpacing: isHero ? '-0.02em' : 0, lineHeight: 1 }}
        >
          Zenith
        </span>
      </div>
      {isHero && (
        <span className="text-[11px] tracking-[0.12em] uppercase text-muted-fg font-medium">
          Học thật, đỗ thật
        </span>
      )}
    </div>
  )
}

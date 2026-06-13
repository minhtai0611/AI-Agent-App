// Star mark — golden-ratio pentagram, apex pointing up
// 100×100 viewBox: outer R=42, inner r=17, center (50,50)
// Points: 5 outer (R=42) + 5 inner (r=17), alternating, -90° start
function StarMark({ size = 24, ring = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      {ring && (
        <circle
          cx="50" cy="56" r="38"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 4"
          opacity="0.55"
        />
      )}
      <polygon
        points="50,8 60,36 90,37 66,55 75,84 50,67 25,84 34,55 10,37 40,36"
        fill="currentColor"
        opacity="0.92"
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
          <StarMark size={isHero ? 44 : 20} ring={isHero} />
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

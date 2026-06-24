import { motion } from 'framer-motion'

// Celestial compass mark — astrolabe-inspired instrument of navigation
// viewBox 0 0 100 100
// Outer orbit ring (r=44, dashed) + inner ring (r=28) + cardinal ticks + diagonal ticks + radial lines + center point
function AstrolabeMark({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      {/* Outer dashed orbit ring — rotates slowly (one full rotation per 120s) */}
      <motion.circle
        cx="50" cy="50" r="44"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="3 4"
        opacity={0.45}
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      />

      {/* Inner group: solid ring + cardinal ticks + radial lines — counter-rotates */}
      <motion.g
        animate={{ rotate: -360 }}
        transition={{ duration: 240, repeat: Infinity, ease: 'linear' }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      >
        {/* Inner solid ring */}
        <circle cx="50" cy="50" r="28" stroke="currentColor" strokeWidth="1" opacity={0.6} />
        {/* Cardinal ticks: inner ring → outer ring */}
        <line x1="50" y1="22" x2="50" y2="6"  stroke="currentColor" strokeWidth="2" />
        <line x1="78" y1="50" x2="94" y2="50" stroke="currentColor" strokeWidth="2" />
        <line x1="50" y1="78" x2="50" y2="94" stroke="currentColor" strokeWidth="2" />
        <line x1="22" y1="50" x2="6"  y2="50" stroke="currentColor" strokeWidth="2" />
        {/* Inner radial lines: center → inner ring */}
        <line x1="50" y1="50" x2="50" y2="22" stroke="currentColor" strokeWidth="1.5" opacity={0.7} />
        <line x1="50" y1="50" x2="78" y2="50" stroke="currentColor" strokeWidth="1.5" opacity={0.7} />
        <line x1="50" y1="50" x2="50" y2="78" stroke="currentColor" strokeWidth="1.5" opacity={0.7} />
        <line x1="50" y1="50" x2="22" y2="50" stroke="currentColor" strokeWidth="1.5" opacity={0.7} />
      </motion.g>

      {/* Diagonal short ticks at outer ring — static */}
      {/* NE: (75.5, 24.5) → (81.1, 18.9) */}
      <line x1="75.5" y1="24.5" x2="81.1" y2="18.9" stroke="currentColor" strokeWidth="1" opacity={0.6} />
      {/* SE: (75.5, 75.5) → (81.1, 81.1) */}
      <line x1="75.5" y1="75.5" x2="81.1" y2="81.1" stroke="currentColor" strokeWidth="1" opacity={0.6} />
      {/* SW: (24.5, 75.5) → (18.9, 81.1) */}
      <line x1="24.5" y1="75.5" x2="18.9" y2="81.1" stroke="currentColor" strokeWidth="1" opacity={0.6} />
      {/* NW: (24.5, 24.5) → (18.9, 18.9) */}
      <line x1="24.5" y1="24.5" x2="18.9" y2="18.9" stroke="currentColor" strokeWidth="1" opacity={0.6} />

      {/* Central luminous point */}
      <circle cx="50" cy="50" r="5" fill="currentColor" opacity={0.9} />
    </svg>
  )
}

export default function LuminaryLogo({ variant = 'nav', onClick }) {
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
        <AstrolabeMark size={isHero ? 52 : 20} />
      </div>
      <span
        className="font-bold text-primary uppercase"
        style={{
          fontSize: isHero ? 38 : 14,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        LUMINARY
      </span>
      {isHero && (
        <span
          className="text-muted-fg font-medium"
          style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}
        >
          Học thật, đỗ thật
        </span>
      )}
    </div>
  )
}

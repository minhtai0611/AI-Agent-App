import { motion } from 'framer-motion'

// Summit-beacon mark — a peak reached, crowned by radiant light.
// Replaces the old astrolabe/celestial-instrument mark as part of the
// Luminary → Vantage rebrand (see groovy-baking-beaver.md).
// viewBox 0 0 100 100
function SummitBeacon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      {/* Horizon / base line */}
      <line x1="10" y1="84" x2="90" y2="84" stroke="currentColor" strokeWidth="1" opacity={0.3} />

      {/* Secondary ridge — depth */}
      <path d="M35 84 L58 46 L78 84" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" opacity={0.5} />

      {/* Primary peak — the vantage point */}
      <path d="M18 84 L50 20 L82 84" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" opacity={0.95} />

      {/* Radiant beacon rays — gentle breathing pulse at the summit */}
      <motion.g
        animate={{ opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <line x1="50" y1="18" x2="50" y2="4" stroke="currentColor" strokeWidth="2" />
        <line x1="58" y1="20" x2="64" y2="8" stroke="currentColor" strokeWidth="1.5" />
        <line x1="42" y1="20" x2="36" y2="8" stroke="currentColor" strokeWidth="1.5" />
        <line x1="65" y1="26" x2="76" y2="16" stroke="currentColor" strokeWidth="1.3" />
        <line x1="35" y1="26" x2="24" y2="16" stroke="currentColor" strokeWidth="1.3" />
        <line x1="70" y1="34" x2="84" y2="28" stroke="currentColor" strokeWidth="1" opacity={0.8} />
        <line x1="30" y1="34" x2="16" y2="28" stroke="currentColor" strokeWidth="1" opacity={0.8} />
      </motion.g>

      {/* Beacon point at the summit */}
      <circle cx="50" cy="20" r="4" fill="currentColor" opacity={0.95} />
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
        <SummitBeacon size={isHero ? 52 : 20} />
      </div>
      <span
        className="font-bold text-primary uppercase"
        style={{
          fontFamily: "'Fraunces Variable', Fraunces, serif",
          fontSize: isHero ? 38 : 14,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        VANTAGE
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

import { motion } from 'framer-motion'

// Precomputed star field — no runtime Math.random()
const STAR_SHADOWS_BASE =
  '45px 67px 0 0 rgba(255,255,255,0.61),' +
  '189px 123px 0 0 rgba(255,255,255,0.48),' +
  '312px 45px 0 0 rgba(255,255,255,0.74),' +
  '456px 234px 0 0 rgba(255,255,255,0.53),' +
  '578px 89px 0 0 rgba(255,255,255,0.81),' +
  '701px 178px 0 0 rgba(255,255,255,0.44),' +
  '823px 312px 0 0 rgba(255,255,255,0.67),' +
  '956px 56px 0 0 rgba(255,255,255,0.58),' +
  '1089px 267px 0 0 rgba(255,255,255,0.72),' +
  '1212px 134px 0 0 rgba(255,255,255,0.49),' +
  '1345px 389px 0 0 rgba(255,255,255,0.63),' +
  '1478px 201px 0 0 rgba(255,255,255,0.77),' +
  '89px 412px 0 0 rgba(255,255,255,0.55),' +
  '234px 356px 0 0 rgba(255,255,255,0.68),' +
  '367px 512px 0 0 rgba(255,255,255,0.41),' +
  '512px 467px 0 0 rgba(255,255,255,0.79),' +
  '645px 578px 0 0 rgba(255,255,255,0.52),' +
  '778px 423px 0 0 rgba(255,255,255,0.66),' +
  '912px 634px 0 0 rgba(255,255,255,0.43),' +
  '1045px 501px 0 0 rgba(255,255,255,0.75),' +
  '1178px 712px 0 0 rgba(255,255,255,0.57),' +
  '1312px 567px 0 0 rgba(255,255,255,0.69),' +
  '156px 678px 0 0 rgba(255,255,255,0.46),' +
  '289px 756px 0 0 rgba(255,255,255,0.82),' +
  '423px 823px 0 0 rgba(255,255,255,0.54),' +
  '556px 712px 0 0 rgba(255,255,255,0.71),' +
  '689px 867px 0 0 rgba(255,255,255,0.48),' +
  '823px 756px 0 0 rgba(255,255,255,0.83),' +
  '956px 823px 0 0 rgba(255,255,255,0.60),' +
  '1090px 689px 0 0 rgba(255,255,255,0.44)'

const STAR_SHADOWS_TWINKLE =
  '234px 89px 0 0 rgba(255,255,255,0.92),' +
  '578px 312px 0 0 rgba(255,255,255,0.88),' +
  '923px 178px 0 0 rgba(255,255,255,0.95),' +
  '1267px 445px 0 0 rgba(255,255,255,0.85),' +
  '345px 623px 0 0 rgba(255,255,255,0.91),' +
  '789px 534px 0 0 rgba(255,255,255,0.87),' +
  '1134px 756px 0 0 rgba(255,255,255,0.93),' +
  '67px 823px 0 0 rgba(255,255,255,0.89)'

// Summit-beacon mark — copied inline from VantageLogo.jsx (local fn, not exported)
function SummitBeacon({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <line x1="10" y1="84" x2="90" y2="84" stroke="currentColor" strokeWidth="1" opacity={0.3} />
      <path d="M35 84 L58 46 L78 84" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" opacity={0.5} />
      <path d="M18 84 L50 20 L82 84" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" opacity={0.95} />
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
      <circle cx="50" cy="20" r="4" fill="currentColor" opacity={0.95} />
    </svg>
  )
}

// N / E / S / W compass points on the outer ring (r=130, center=140)
const CARDINAL_DOTS = [
  { cx: 140, cy: 10  },
  { cx: 270, cy: 140 },
  { cx: 140, cy: 270 },
  { cx: 10,  cy: 140 },
]

const MATH_GLYPHS = [
  { glyph: 'Σ', style: { top: '8%',  left: '6%',  fontSize: 32 } },
  { glyph: '∫', style: { top: '10%', right: '7%', fontSize: 36 } },
  { glyph: 'π', style: { bottom: '12%', left: '8%',  fontSize: 28 } },
  { glyph: '∂', style: { bottom: '10%', right: '6%', fontSize: 30 } },
]

const WORD = 'VANTAGE'.split('')

export default function LandingLoader() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: '#080B14',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Nebula wisps — nth-child colors assigned by .nebula-wisp CSS */}
      <div className="nebula-wisp" style={{ width: '65vw', height: '65vh', top: '-20%', left: '-15%', opacity: 0.18 }} />
      <div className="nebula-wisp" style={{ width: '55vw', height: '55vh', bottom: '-18%', right: '-12%', opacity: 0.14 }} />
      <div className="nebula-wisp" style={{ width: '45vw', height: '45vh', top: '25%', right: '15%', opacity: 0.10 }} />

      {/* Star field — forced opacity:1 so stars show regardless of theme */}
      <div className="star-field-wrapper" style={{ opacity: 1 }}>
        <div className="star-layer" style={{ boxShadow: STAR_SHADOWS_BASE }} />
        <div className="star-twinkle-layer" style={{ boxShadow: STAR_SHADOWS_TWINKLE }} />
      </div>

      {/* Floating math glyphs at corners */}
      {MATH_GLYPHS.map(({ glyph, style }) => (
        <span
          key={glyph}
          className="float-math-symbol"
          style={{ position: 'absolute', opacity: 0.04, ...style }}
          aria-hidden="true"
        >
          {glyph}
        </span>
      ))}

      {/* Radial vignette — focuses attention on center */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 25%, #080B14 80%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Central portal — Framer Motion entrance */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Sacred sigil */}
        <div style={{ position: 'relative', width: 280, height: 280, flexShrink: 0 }}>
          <svg
            width="280"
            height="280"
            viewBox="0 0 280 280"
            fill="none"
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0 }}
          >
            {/* Outer ring — draws itself */}
            <motion.circle
              cx="140" cy="140" r="130"
              stroke="rgba(91,143,240,0.55)"
              strokeWidth="0.8"
              strokeDasharray="817"
              initial={{ strokeDashoffset: 817, opacity: 0 }}
              animate={{ strokeDashoffset: 0, opacity: 1 }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
            />
            {/* Middle ring — slow CW rotation */}
            <circle
              cx="140" cy="140" r="100"
              stroke="rgba(124,92,232,0.28)"
              strokeWidth="0.7"
              strokeDasharray="5 8"
              fill="none"
              className="vantage-loader-spin-cw"
            />
            {/* Inner ring — slow CCW rotation */}
            <circle
              cx="140" cy="140" r="68"
              stroke="rgba(91,143,240,0.18)"
              strokeWidth="0.6"
              fill="none"
              className="vantage-loader-spin-ccw"
            />
            {/* Cardinal compass dots — appear after outer ring completes */}
            {CARDINAL_DOTS.map((dot, i) => (
              <motion.circle
                key={i}
                cx={dot.cx} cy={dot.cy} r="2.5"
                fill="rgba(91,143,240,0.72)"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1.2 + i * 0.1, duration: 0.3, ease: 'easeOut' }}
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              />
            ))}
          </svg>

          {/* Pulsing center orb — centered via negative margins to avoid transform conflict */}
          <div
            className="vantage-loader-orb-pulse"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginTop: -44,
              marginLeft: -44,
              width: 88,
              height: 88,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(91,143,240,0.32) 0%, rgba(91,143,240,0) 70%)',
            }}
          />

          {/* Summit-beacon mark */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#ffffff',
              filter: 'drop-shadow(0 0 18px rgba(91,143,240,0.52))',
            }}
          >
            <SummitBeacon size={64} />
          </div>
        </div>

        {/* VANTAGE — character stagger */}
        <div
          style={{
            display: 'flex',
            letterSpacing: '0.24em',
            fontFamily: "'Fraunces Variable', Fraunces, serif",
            fontWeight: 700,
            fontSize: 20,
            color: '#E8EDFF',
            textTransform: 'uppercase',
            marginTop: 4,
          }}
        >
          {WORD.map((char, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.0 + i * 0.055, duration: 0.28, ease: 'easeOut' }}
            >
              {char}
            </motion.span>
          ))}
        </div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.45, duration: 0.5, ease: 'easeOut' }}
          style={{
            fontFamily: "'Inter Variable', Inter, sans-serif",
            fontSize: 10,
            fontWeight: 400,
            letterSpacing: '0.18em',
            color: 'rgba(168,181,217,0.5)',
            textTransform: 'uppercase',
            marginTop: 10,
          }}
        >
          Ánh sáng đang hé lộ...
        </motion.p>
      </motion.div>
    </div>
  )
}

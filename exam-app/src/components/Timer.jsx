import { motion } from 'framer-motion'

const TICKS = 12

export default function Timer({ timeLeft, totalTime }) {
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const fraction = totalTime > 0 ? Math.max(0, Math.min(1, timeLeft / totalTime)) : 1
  const under10 = timeLeft <= 600
  const under3 = timeLeft <= 180
  const color = under3 ? 'var(--accent-deep)' : under10 ? 'var(--accent)' : 'var(--ink)'
  const activeTicks = Math.round(fraction * TICKS)

  return (
    <motion.div
      className="flex items-center gap-2.5 px-3"
      style={{ height: 32, border: '1px solid var(--line)', background: 'var(--paper-2)', borderRadius: 'var(--r-sm)' }}
      animate={under3 ? { opacity: [1, 0.7, 1] } : { opacity: 1 }}
      transition={under3 ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : {}}
      role="timer"
      aria-label={`Thời gian còn lại ${minutes} phút ${seconds} giây`}
    >
      <svg width="52" height="16" viewBox="0 0 52 16" aria-hidden="true">
        <line x1="0" y1="15.5" x2="52" y2="15.5" stroke="var(--line)" strokeWidth="1" />
        {Array.from({ length: TICKS }).map((_, i) => {
          const on = i < activeTicks
          return (
            <rect
              key={i}
              x={i * 4.4}
              y={on ? 2 : 6}
              width="1.4"
              height={on ? 13 : 9}
              fill={on ? color : 'var(--line)'}
              style={{ transition: 'height 0.4s ease, y 0.4s ease, fill 0.4s ease' }}
            />
          )
        })}
      </svg>
      <span
        className="tabular-nums font-semibold"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color, letterSpacing: '0.02em', transition: 'color 0.4s ease' }}
      >
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </motion.div>
  )
}

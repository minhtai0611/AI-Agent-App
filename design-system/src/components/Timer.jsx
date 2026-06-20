import { motion } from 'framer-motion'

const RADIUS = 20
const CIRC = 2 * Math.PI * RADIUS

/**
 * Circular countdown timer with color feedback.
 * Green > 30s, amber 10–30s, red ≤ 10s (pulses urgently).
 *
 * @example
 * <Timer timeLeft={timeLeft} totalTime={examDurationSeconds} />
 */
export default function Timer({ timeLeft, totalTime }) {
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const fraction = totalTime > 0 ? timeLeft / totalTime : 1
  const pct = Math.max(0, Math.min(1, fraction))
  const offset = CIRC * (1 - pct)
  const color = timeLeft > 30 ? 'var(--success)' : timeLeft > 10 ? 'var(--accent)' : 'var(--destructive)'
  const urgent = timeLeft <= 10 && timeLeft > 0

  return (
    <motion.div
      className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg"
      animate={urgent ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={urgent ? { duration: 1, repeat: Infinity, ease: 'easeInOut' } : {}}
    >
      <svg width="44" height="44" viewBox="0 0 44 44" className="flex-shrink-0 -rotate-90">
        <circle cx="22" cy="22" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle
          cx="22" cy="22" r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.4s ease' }}
        />
      </svg>
      <span
        className="font-bold text-[15px] tabular-nums"
        style={{ fontFamily: "'JetBrains Mono', monospace", color, transition: 'color 0.4s ease' }}
      >
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </motion.div>
  )
}

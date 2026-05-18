const RADIUS = 20
const CIRC = 2 * Math.PI * RADIUS

export default function Timer({ timeLeft, totalTime }) {
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const fraction = totalTime > 0 ? timeLeft / totalTime : 1
  const pct = Math.max(0, Math.min(1, fraction))
  const offset = CIRC * (1 - pct)
  const color = pct > 0.3 ? '#10B981' : pct > 0.1 ? '#F2A20C' : '#FB7185'

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1E2A44] rounded-lg">
      <svg width="44" height="44" viewBox="0 0 44 44" className="flex-shrink-0 -rotate-90">
        <circle cx="22" cy="22" r={RADIUS} fill="none" stroke="#1E2A44" strokeWidth="3" />
        <circle
          cx="22" cy="22" r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.5s ease' }}
        />
      </svg>
      <span
        className="font-bold text-[15px] tabular-nums"
        style={{ fontFamily: "'JetBrains Mono', monospace", color }}
      >
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  )
}

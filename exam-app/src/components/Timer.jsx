export default function Timer({ timeLeft }) {
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const isLow = timeLeft <= 300
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E2A44] rounded-lg">
      <span className="text-[#F2A20C] text-sm leading-none">⏱</span>
      <span
        className={`font-bold text-[15px] tabular-nums ${isLow ? 'text-red-400' : 'text-[#F2A20C]'}`}
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  )
}

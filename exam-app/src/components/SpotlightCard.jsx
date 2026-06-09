import { useRef, useState } from 'react'
import { cn } from '../lib/utils.js'

// Mouse-tracking radial glow inside cards — highest ROI interactive effect.
// GR-5: does NOT add overflow-hidden; callers own their own clipping.
export function SpotlightCard({ children, className = '', glowColor = 'rgba(242,162,12,0.12)' }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [visible, setVisible] = useState(false)

  function handleMouseMove(e) {
    const rect = ref.current.getBoundingClientRect()
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      className={cn('relative', className)}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300 z-10"
        style={{
          opacity: visible ? 1 : 0,
          background: `radial-gradient(600px circle at ${pos.x}px ${pos.y}px, ${glowColor}, transparent 40%)`,
        }}
        aria-hidden="true"
      />
      {children}
    </div>
  )
}

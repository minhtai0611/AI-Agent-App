import { useEffect, useRef } from 'react'
import { cn } from '../lib/utils.js'

/**
 * Animated number count-up (or count-down) with eased animation.
 * Zero dependencies beyond React — uses rAF directly.
 *
 * @example
 * <NumberTicker value={score} decimalPlaces={1} className="text-2xl font-bold" />
 */
export function NumberTicker({
  value,
  startValue = 0,
  direction = 'up',
  delay = 0,
  decimalPlaces = 0,
  className,
}) {
  const ref = useRef(null)
  const startRef = useRef(startValue)
  const frameRef = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const from = direction === 'down' ? value : startRef.current
    const to   = direction === 'down' ? startRef.current : value
    const diff = to - from
    if (diff === 0) { el.textContent = to.toFixed(decimalPlaces); return }

    const duration = 1200 + Math.abs(diff) * 4
    let startTime = null

    function easeOut(t) { return 1 - Math.pow(1 - t, 3) }

    function tick(timestamp) {
      if (!startTime) startTime = timestamp + delay
      const elapsed = Math.max(0, timestamp - startTime)
      const progress = Math.min(elapsed / duration, 1)
      const current = from + diff * easeOut(progress)
      el.textContent = current.toFixed(decimalPlaces)
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [value, direction, delay, decimalPlaces])

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {startValue.toFixed(decimalPlaces)}
    </span>
  )
}

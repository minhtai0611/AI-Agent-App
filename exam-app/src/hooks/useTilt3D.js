import { useRef, useCallback } from 'react'
import { gsap, prefersReducedMotion } from '../lib/gsap'

/**
 * Tier 1 pointer-driven 3D tilt — cheap, GPU-composited rotateX/rotateY only.
 * Respects --tilt-max (zeroed under prefers-reduced-motion in index.css) and
 * the JS-side prefersReducedMotion() check so behavior never disagrees with CSS.
 *
 * Usage: <div ref={ref} {...handlers} style={{ perspective: 'var(--perspective-md)' }}>
 */
export function useTilt3D() {
  const ref = useRef(null)

  const getTiltMax = () => {
    if (typeof window === 'undefined') return 4
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--tilt-max')
    return parseFloat(raw) || 0
  }

  const onPointerMove = useCallback((e) => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const max = getTiltMax()
    if (!max) return

    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5

    gsap.to(el, {
      rotateY: px * max * 2,
      rotateX: -py * max * 2,
      duration: 0.3,
      ease: 'power2.out',
      overwrite: 'auto',
    })
  }, [])

  const onPointerLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    gsap.to(el, { rotateX: 0, rotateY: 0, duration: 0.4, ease: 'power2.out', overwrite: 'auto' })
  }, [])

  return {
    ref,
    handlers: { onPointerMove, onPointerLeave },
  }
}

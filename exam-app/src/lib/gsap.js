import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/**
 * Heuristic gate for Tier 3 (WebGL) content — skips low-memory/low-bandwidth
 * devices rather than shipping a three.js bundle they can't render smoothly.
 */
export function isLowPowerDevice() {
  if (typeof navigator === 'undefined') return false
  if (navigator.deviceMemory && navigator.deviceMemory <= 4) return true
  const conn = navigator.connection
  if (conn && (conn.saveData || /^(slow-2g|2g|3g)$/.test(conn.effectiveType || ''))) return true
  return false
}

export function canUseTier3() {
  return !prefersReducedMotion() && !isLowPowerDevice()
}

export { gsap, ScrollTrigger }

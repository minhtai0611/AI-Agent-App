import { useRef } from 'react'
import { useInView } from 'framer-motion'

/**
 * Tier 2 scroll reveal — fires once when the element enters the viewport.
 * Opacity only (no y-translate) per the cognitive motion doctrine.
 *
 * @param {object} options - forwarded to useInView (e.g. { amount: 0.2 })
 * @returns {{ ref: React.Ref, inView: boolean }}
 */
export function useRevealOnScroll(options = {}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.15, ...options })
  return { ref, inView }
}

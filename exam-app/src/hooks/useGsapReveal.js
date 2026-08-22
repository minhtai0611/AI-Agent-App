import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap, ScrollTrigger, prefersReducedMotion } from '../lib/gsap'

/**
 * ScrollTrigger-based replacement for useRevealOnScroll (which wraps
 * framer-motion's useInView). Same ref-based shape so call sites can swap
 * 1:1 — see the Vantage rebrand blueprint, Phase 2/3 migration list.
 *
 * @param {object} [options]
 * @param {number} [options.amount] - viewport fraction that must be visible (0-1)
 * @param {'rise'|'tilt'|'none'} [options.variant] - entrance treatment
 * @returns {{ ref: React.RefObject }}
 */
export function useGsapReveal({ amount = 0.15, variant = 'rise' } = {}) {
  const ref = useRef(null)

  useGSAP(() => {
    const el = ref.current
    if (!el) return

    if (prefersReducedMotion() || variant === 'none') {
      gsap.set(el, { opacity: 1, y: 0, rotateX: 0 })
      return
    }

    const from =
      variant === 'tilt'
        ? { opacity: 0, rotateX: -8, transformPerspective: 800 }
        : { opacity: 0, y: 24 }

    gsap.set(el, from)
    gsap.to(el, {
      opacity: 1,
      y: 0,
      rotateX: 0,
      duration: 0.6,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: el,
        start: `top ${100 - amount * 100}%`,
        once: true,
      },
    })

    return () => ScrollTrigger.getAll().forEach((st) => st.trigger === el && st.kill())
  }, [])

  return { ref }
}

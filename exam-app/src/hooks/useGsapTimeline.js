import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from '../lib/gsap'

/**
 * Standardized GSAP timeline creation with automatic cleanup on unmount —
 * the direct fix for the common GSAP-in-React duplicate-ScrollTrigger /
 * memory-leak bug on route change (useGSAP reverts everything it creates
 * when the component unmounts).
 *
 * @param {(tl: gsap.core.Timeline, contextSafe: Function) => void} build
 * @param {{scope?: React.RefObject, dependencies?: any[]}} [options]
 * @returns {{ scope: React.RefObject, timeline: React.RefObject }}
 */
export function useGsapTimeline(build, { scope, dependencies = [] } = {}) {
  const internalScope = useRef(null)
  const timelineRef = useRef(null)
  const resolvedScope = scope || internalScope

  useGSAP(
    (context, contextSafe) => {
      const tl = gsap.timeline()
      timelineRef.current = tl
      build(tl, contextSafe)
    },
    { scope: resolvedScope, dependencies }
  )

  return { scope: resolvedScope, timeline: timelineRef }
}

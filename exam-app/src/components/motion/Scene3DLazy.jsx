import { Component, Suspense, lazy, useEffect, useState } from 'react'
import { canUseTier3 } from '../../lib/gsap'

// Error boundaries must be class components — Tier 3 (WebGL) must never take
// the page down; any runtime failure (context loss, unsupported GPU, etc.)
// falls back to the Tier 1 CSS treatment instead.
class Tier3ErrorBoundary extends Component {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch() {
    this.props.onError?.()
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

/**
 * Tier 3 — the sole WebGL entry point (see the Vantage rebrand blueprint).
 * Lazy-loads three.js/@react-three/fiber ONLY when canUseTier3() passes
 * (not prefers-reduced-motion, not a low-memory/low-bandwidth device), and
 * renders `fallback` on skip or on load/runtime failure. No other file in
 * the app should import three.js or @react-three/fiber directly — always
 * go through this component so the bundle stays out of every route except
 * the ones that explicitly mount a scene (Landing hero, Results celebration).
 *
 * @param {{ scene: () => Promise<{default: React.ComponentType}>, fallback: React.ReactNode, sceneProps?: object }} props
 */
export function Scene3DLazy({ scene, fallback = null, sceneProps = {} }) {
  const [allowed, setAllowed] = useState(false)
  const [failed, setFailed] = useState(false)
  const [LazyScene] = useState(() => lazy(scene))

  useEffect(() => {
    setAllowed(canUseTier3())
  }, [])

  if (!allowed || failed) return fallback

  return (
    <Tier3ErrorBoundary fallback={fallback} onError={() => setFailed(true)}>
      <Suspense fallback={fallback}>
        <LazyScene {...sceneProps} />
      </Suspense>
    </Tier3ErrorBoundary>
  )
}

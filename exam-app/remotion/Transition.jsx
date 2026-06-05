import { interpolate, useCurrentFrame } from 'remotion'
import { C } from './theme.js'

// Cross-dissolve transition wrapper: fades in/out over `duration` frames
export function FadeTransition({ children, fadeInDuration = 12, fadeOutDuration = 10, totalFrames }) {
  const frame = useCurrentFrame()
  const opacity = frame < fadeInDuration
    ? interpolate(frame, [0, fadeInDuration], [0, 1])
    : frame > totalFrames - fadeOutDuration
    ? interpolate(frame, [totalFrames - fadeOutDuration, totalFrames], [1, 0])
    : 1

  return (
    <div style={{ width: '100%', height: '100%', opacity }}>
      {children}
    </div>
  )
}

// Scene label overlay: shown for first ~1.5s at scene start, then fades out
// Uses useCurrentFrame() so it works correctly inside Remotion Sequences
export function SceneLabel({ label, icon }) {
  const frame = useCurrentFrame()

  const labelOpacity = frame < 20
    ? interpolate(frame, [0, 12], [0, 1])
    : interpolate(frame, [30, 45], [1, 0])

  if (frame > 45) return null

  return (
    <div style={{
      position: 'absolute', top: 20, right: 28,
      display: 'flex', alignItems: 'center', gap: 6,
      background: C.card + 'ee', border: `1px solid ${C.border}`,
      borderRadius: 20, padding: '6px 14px',
      opacity: labelOpacity,
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 600 }}>{label}</span>
    </div>
  )
}

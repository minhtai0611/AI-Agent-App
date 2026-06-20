import { SkeletonBlock } from '@zenith/ui'

export const Line = () => (
  <div style={{ padding: 24, background: 'var(--background)' }}>
    <SkeletonBlock />
  </div>
)

export const Card = () => (
  <div style={{ padding: 24, background: 'var(--background)' }}>
    <SkeletonBlock style={{ height: 100, borderRadius: 8 }} />
  </div>
)

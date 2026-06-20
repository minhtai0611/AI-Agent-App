import { AIErrorBoundary } from '@zenith/ui'

export const Idle = () => (
  <div style={{ padding: 24, background: 'var(--background)' }}>
    <AIErrorBoundary>
      <div style={{ fontFamily: 'var(--font-sans)', color: 'var(--foreground)', fontSize: 14 }}>
        AI analysis content renders here when there is no error.
      </div>
    </AIErrorBoundary>
  </div>
)

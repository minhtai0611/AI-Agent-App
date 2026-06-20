import { CreditsTooltip } from '@zenith/ui'

/**
 * CreditsTooltip is shown once per userId (persisted to localStorage).
 * To force-show in previews we use a unique userId that hasn't been seen.
 * The tooltip is position:absolute, so we need a relative container.
 *
 * SufficientCredits — user has a healthy credit balance (25 lượt).
 * Note: the component manages its own visibility via localStorage.
 * A fresh userId guarantees it renders on first mount.
 */
export const SufficientCredits = () => (
  <div style={{ padding: 24, background: 'var(--background)', minHeight: 220 }}>
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        style={{
          padding: '6px 12px',
          border: '1px solid var(--border)',
          borderRadius: 8,
          fontSize: 13,
          color: 'var(--foreground)',
          background: 'var(--surface)',
          cursor: 'default',
        }}
      >
        ⚡ 25 lượt
      </div>
      <CreditsTooltip
        userId="preview-user-sufficient-001"
        creditsBalance={25}
        onDismiss={() => {}}
      />
    </div>
  </div>
)

/**
 * LowCredits — user is running low (3 lượt remaining).
 * Same component, different creditsBalance value shown in the heading.
 */
export const LowCredits = () => (
  <div style={{ padding: 24, background: 'var(--background)', minHeight: 220 }}>
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        style={{
          padding: '6px 12px',
          border: '1px solid var(--border)',
          borderRadius: 8,
          fontSize: 13,
          color: 'var(--foreground)',
          background: 'var(--surface)',
          cursor: 'default',
        }}
      >
        ⚡ 3 lượt
      </div>
      <CreditsTooltip
        userId="preview-user-low-001"
        creditsBalance={3}
        onDismiss={() => {}}
      />
    </div>
  </div>
)

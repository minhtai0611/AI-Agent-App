import { ZenithLogo } from '@zenith/ui'

export const Default = () => (
  <div style={{ padding: 24, background: 'var(--background)' }}>
    <ZenithLogo variant="nav" />
  </div>
)

export const Large = () => (
  <div style={{ padding: 24, background: 'var(--background)' }}>
    <ZenithLogo variant="hero" />
  </div>
)

export const WithText = () => (
  <div style={{ padding: 24, background: 'var(--background)' }}>
    {/* variant="hero" renders the star mark + "Zenith" wordmark + tagline "Học thật, đỗ thật" */}
    <ZenithLogo variant="hero" onClick={() => {}} />
  </div>
)

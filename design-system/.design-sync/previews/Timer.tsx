import { Timer } from '@zenith/ui'

export const Running = () => (
  <div style={{ padding: 24, background: 'var(--background)' }}>
    <Timer timeLeft={480} totalTime={600} />
  </div>
)

export const Warning = () => (
  <div style={{ padding: 24, background: 'var(--background)' }}>
    <Timer timeLeft={25} totalTime={600} />
  </div>
)

export const Urgent = () => (
  <div style={{ padding: 24, background: 'var(--background)' }}>
    <Timer timeLeft={8} totalTime={600} />
  </div>
)

export const Expired = () => (
  <div style={{ padding: 24, background: 'var(--background)' }}>
    <Timer timeLeft={0} totalTime={600} />
  </div>
)

import { NumberTicker } from '@zenith/ui'

export const Score = () => (
  <div style={{ padding: 24, background: 'var(--background)' }}>
    <NumberTicker
      value={85}
      startValue={0}
      direction="up"
      decimalPlaces={0}
      className="text-4xl font-bold"
      style={{ color: 'var(--primary)', fontFamily: 'var(--font-sans)' }}
    />
  </div>
)

export const Percentage = () => (
  <div style={{ padding: 24, background: 'var(--background)', display: 'flex', alignItems: 'baseline', gap: 2 }}>
    <NumberTicker
      value={67}
      startValue={0}
      direction="up"
      decimalPlaces={0}
      className="text-3xl font-semibold"
      style={{ color: 'var(--foreground)', fontFamily: 'var(--font-sans)' }}
    />
    <span style={{ fontSize: 18, color: 'var(--foreground)', fontFamily: 'var(--font-sans)', opacity: 0.7 }}>%</span>
  </div>
)

export const Large = () => (
  <div style={{ padding: 24, background: 'var(--background)', display: 'flex', alignItems: 'baseline', gap: 4 }}>
    <NumberTicker
      value={1240}
      startValue={0}
      direction="up"
      decimalPlaces={0}
      className="text-5xl font-bold"
      style={{ color: 'var(--accent)', fontFamily: 'var(--font-sans)' }}
    />
    <span style={{ fontSize: 20, color: 'var(--foreground)', fontFamily: 'var(--font-sans)', opacity: 0.6 }}>pts</span>
  </div>
)

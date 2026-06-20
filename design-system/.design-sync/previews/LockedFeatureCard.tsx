import { LockedFeatureCard } from '@zenith/ui'

export const StudentTier = () => (
  <div style={{ padding: 24, background: 'var(--background)', maxWidth: 360 }}>
    <LockedFeatureCard
      label="Kế hoạch học tập AI"
      tier="student"
    />
  </div>
)

export const CompleteTierWithUpgrade = () => (
  <div style={{ padding: 24, background: 'var(--background)', maxWidth: 360 }}>
    <LockedFeatureCard
      label="Phân tích chuyên sâu"
      tier="complete"
      onUpgrade={() => {}}
    />
  </div>
)

import { TopicBreakdownChart } from '@zenith/ui'

export const MathSubjects = () => (
  <div style={{ padding: 24, background: 'var(--background)', maxWidth: 320 }}>
    <TopicBreakdownChart topicBreakdown={{
      algebra:      { accuracy: 0.85 },
      geometry:     { accuracy: 0.60 },
      statistics:   { accuracy: 0.40 },
      calculus:     { accuracy: 0.75 },
      combinatorics:{ accuracy: 0.55 },
    }} />
  </div>
)

export const StrongPerformance = () => (
  <div style={{ padding: 24, background: 'var(--background)', maxWidth: 280 }}>
    <TopicBreakdownChart topicBreakdown={{
      algebra:     { accuracy: 0.90 },
      geometry:    { accuracy: 0.88 },
      trigonometry:{ accuracy: 0.82 },
    }} />
  </div>
)

export const WeakPerformance = () => (
  <div style={{ padding: 24, background: 'var(--background)', maxWidth: 280 }}>
    <TopicBreakdownChart topicBreakdown={{
      calculus:    { accuracy: 0.30 },
      statistics:  { accuracy: 0.45 },
      probability: { accuracy: 0.35 },
    }} />
  </div>
)

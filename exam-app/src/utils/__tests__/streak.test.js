import { describe, it, expect } from 'vitest'
import { computeStreak, computeStreakPersonalBest } from '../streak.js'

// ─── computeStreak (existing — smoke tests) ──────────────────────────────────

describe('computeStreak', () => {
  it('returns 0 for empty results', () => {
    expect(computeStreak([])).toBe(0)
    expect(computeStreak(null)).toBe(0)
  })
})

// ─── computeStreakPersonalBest ────────────────────────────────────────────────

describe('computeStreakPersonalBest', () => {
  it('returns 0 for empty results', () => {
    expect(computeStreakPersonalBest([])).toBe(0)
    expect(computeStreakPersonalBest(null)).toBe(0)
  })

  it('returns 1 for a single result', () => {
    const results = [{ finishedAt: '2025-01-06T10:00:00Z' }]
    expect(computeStreakPersonalBest(results)).toBe(1)
  })

  it('returns the longest consecutive-day run', () => {
    const results = [
      // 3-day run
      { finishedAt: '2025-01-01T10:00:00Z' },
      { finishedAt: '2025-01-02T10:00:00Z' },
      { finishedAt: '2025-01-03T10:00:00Z' },
      // gap
      // 5-day run
      { finishedAt: '2025-01-10T10:00:00Z' },
      { finishedAt: '2025-01-11T10:00:00Z' },
      { finishedAt: '2025-01-12T10:00:00Z' },
      { finishedAt: '2025-01-13T10:00:00Z' },
      { finishedAt: '2025-01-14T10:00:00Z' },
    ]
    expect(computeStreakPersonalBest(results)).toBe(5)
  })

  it('counts multiple results on the same day as one streak day', () => {
    const results = [
      { finishedAt: '2025-01-01T08:00:00Z' },
      { finishedAt: '2025-01-01T20:00:00Z' }, // same day, second exam
      { finishedAt: '2025-01-02T10:00:00Z' },
    ]
    expect(computeStreakPersonalBest(results)).toBe(2)
  })

  it('handles unsorted results', () => {
    const results = [
      { finishedAt: '2025-01-03T10:00:00Z' },
      { finishedAt: '2025-01-01T10:00:00Z' },
      { finishedAt: '2025-01-02T10:00:00Z' },
    ]
    expect(computeStreakPersonalBest(results)).toBe(3)
  })

  it('handles a single long unbroken run', () => {
    const results = Array.from({ length: 7 }, (_, i) => {
      const d = new Date('2025-03-01T10:00:00Z')
      d.setDate(d.getDate() + i)
      return { finishedAt: d.toISOString() }
    })
    expect(computeStreakPersonalBest(results)).toBe(7)
  })
})

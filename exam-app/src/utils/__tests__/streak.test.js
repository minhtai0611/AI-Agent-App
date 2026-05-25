import { describe, it, expect } from 'vitest'
import { computeStreak, computeStreakPersonalBest, getStreakRecoveryStatus } from '../streak.js'

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

// ─── getStreakRecoveryStatus ──────────────────────────────────────────────────

describe('getStreakRecoveryStatus', () => {
  // Helper: return a date string N days ago relative to today (YYYY-MM-DD)
  function daysAgo(n) {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10)
  }

  it('returns null when lastExamDate is null', () => {
    expect(getStreakRecoveryStatus(null, 5, 0)).toBeNull()
  })

  it('returns null when currentStreak is 0', () => {
    expect(getStreakRecoveryStatus(daysAgo(2), 0, 0)).toBeNull()
  })

  it('canRecover is true when gap is exactly 2 days and todayExamCount < 2', () => {
    const status = getStreakRecoveryStatus(daysAgo(2), 3, 0)
    expect(status).not.toBeNull()
    expect(status.canRecover).toBe(true)
  })

  it('canRecover is false when gap is 1 day (no missed day)', () => {
    const status = getStreakRecoveryStatus(daysAgo(1), 3, 0)
    expect(status.canRecover).toBe(false)
  })

  it('canRecover is false when gap is 3 days (too long to recover)', () => {
    const status = getStreakRecoveryStatus(daysAgo(3), 3, 0)
    expect(status.canRecover).toBe(false)
  })

  it('sessionsNeeded is 2 when todayExamCount is 0', () => {
    const status = getStreakRecoveryStatus(daysAgo(2), 5, 0)
    expect(status.sessionsNeeded).toBe(2)
  })

  it('sessionsNeeded is 1 when todayExamCount is 1', () => {
    const status = getStreakRecoveryStatus(daysAgo(2), 5, 1)
    expect(status.sessionsNeeded).toBe(1)
  })

  it('sessionsNeeded is 0 when todayExamCount >= 2', () => {
    const status = getStreakRecoveryStatus(daysAgo(2), 5, 2)
    expect(status.sessionsNeeded).toBe(0)
  })

  it('reason string is non-empty', () => {
    const status = getStreakRecoveryStatus(daysAgo(2), 5, 0)
    expect(typeof status.reason).toBe('string')
    expect(status.reason.length).toBeGreaterThan(0)
  })

  it('reason indicates recovery when todayExamCount >= 2 and gap was 2 days', () => {
    const status = getStreakRecoveryStatus(daysAgo(2), 5, 2)
    expect(status.canRecover).toBe(false)
    expect(status.reason).toContain('khôi phục')
  })
})

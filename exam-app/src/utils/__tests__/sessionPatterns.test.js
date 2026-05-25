import { describe, it, expect } from 'vitest'
import { getSessionPatterns } from '../sessionPatterns.js'

// Helper: create a result with a specific day-of-week (0=Sun … 6=Sat) and score
function resultOnDay(dayOfWeek, score = 7) {
  // Find a recent date that falls on the target day
  const d = new Date('2025-05-19') // Monday
  d.setDate(d.getDate() + ((dayOfWeek - d.getDay() + 7) % 7))
  return { score, finishedAt: d.toISOString() }
}

function resultOnDayOffset(dayOfWeek, weeksAgo, score = 7) {
  const d = new Date('2025-05-19')
  d.setDate(d.getDate() + ((dayOfWeek - d.getDay() + 7) % 7) - weeksAgo * 7)
  return { score, finishedAt: d.toISOString() }
}

// ─── null / insufficient cases ────────────────────────────────────────────────

describe('getSessionPatterns — null cases', () => {
  it('returns null when results is null', () => {
    expect(getSessionPatterns(null)).toBeNull()
  })

  it('returns null when results is empty', () => {
    expect(getSessionPatterns([])).toBeNull()
  })

  it('returns null when fewer than 3 results', () => {
    expect(getSessionPatterns([resultOnDay(1), resultOnDay(2)])).toBeNull()
  })
})

// ─── dayPattern ───────────────────────────────────────────────────────────────

describe('getSessionPatterns — dayPattern', () => {
  it('returns exactly 7 day entries', () => {
    const results = [1, 2, 3, 4, 5].map(d => resultOnDay(d))
    const p = getSessionPatterns(results)
    expect(p.dayPattern).toHaveLength(7)
  })

  it('each day entry has dayName, count, avgScore', () => {
    const results = [1, 2, 3].map(d => resultOnDay(d))
    const p = getSessionPatterns(results)
    for (const entry of p.dayPattern) {
      expect(entry).toHaveProperty('dayName')
      expect(entry).toHaveProperty('count')
      expect(entry).toHaveProperty('avgScore')
    }
  })

  it('counts are correct for known days', () => {
    // 2 results on Monday (1), 1 on Tuesday (2)
    const results = [
      resultOnDay(1, 7),
      resultOnDay(1, 8),
      resultOnDay(2, 6),
    ]
    const p = getSessionPatterns(results)
    const mon = p.dayPattern.find(d => d.dayIndex === 1)
    expect(mon.count).toBe(2)
  })

  it('avgScore is average of scores for that day', () => {
    const results = [
      resultOnDay(1, 6),
      resultOnDay(1, 8),
      resultOnDay(2, 7),
    ]
    const p = getSessionPatterns(results)
    const mon = p.dayPattern.find(d => d.dayIndex === 1)
    expect(mon.avgScore).toBe(7.0) // (6+8)/2
  })

  it('avgScore is null for days with no sessions', () => {
    const results = [resultOnDay(1), resultOnDay(1), resultOnDay(1)]
    const p = getSessionPatterns(results)
    const sun = p.dayPattern.find(d => d.dayIndex === 0)
    expect(sun.avgScore).toBeNull()
    expect(sun.count).toBe(0)
  })
})

// ─── mostActiveDay ────────────────────────────────────────────────────────────

describe('getSessionPatterns — mostActiveDay', () => {
  it('is the day with the highest count', () => {
    const results = [
      resultOnDay(3, 7), resultOnDay(3, 8), resultOnDay(3, 9), // Wednesday: 3
      resultOnDay(1, 6), // Monday: 1
    ]
    const p = getSessionPatterns(results)
    expect(p.mostActiveDay.dayIndex).toBe(3)
  })
})

// ─── bestScoreDay ─────────────────────────────────────────────────────────────

describe('getSessionPatterns — bestScoreDay', () => {
  it('is the day with the highest avgScore (min 2 sessions)', () => {
    const results = [
      resultOnDay(1, 9), resultOnDay(1, 9), // Monday avg 9 — qualifies
      resultOnDay(3, 6), resultOnDay(3, 6), // Wednesday avg 6
    ]
    const p = getSessionPatterns(results)
    expect(p.bestScoreDay.dayIndex).toBe(1)
  })

  it('is null when no day has >= 2 sessions', () => {
    // Each day appears only once — not enough data for reliable "best score day"
    const results = [
      resultOnDay(1, 9),
      resultOnDay(2, 8),
      resultOnDay(3, 7),
    ]
    const p = getSessionPatterns(results)
    expect(p.bestScoreDay).toBeNull()
  })
})

// ─── insight ──────────────────────────────────────────────────────────────────

describe('getSessionPatterns — insight', () => {
  it('returns a non-empty string', () => {
    const results = [1, 2, 3, 1, 2].map(d => resultOnDay(d))
    const p = getSessionPatterns(results)
    expect(typeof p.insight).toBe('string')
    expect(p.insight.length).toBeGreaterThan(0)
  })
})

// ─── result shape ─────────────────────────────────────────────────────────────

describe('getSessionPatterns — result shape', () => {
  it('includes all required top-level keys', () => {
    const results = [1, 2, 3, 1, 2].map(d => resultOnDay(d))
    const p = getSessionPatterns(results)
    expect(p).toHaveProperty('dayPattern')
    expect(p).toHaveProperty('mostActiveDay')
    expect(p).toHaveProperty('bestScoreDay')
    expect(p).toHaveProperty('insight')
    expect(p).toHaveProperty('totalSessions')
  })

  it('totalSessions matches results length', () => {
    const results = [1, 2, 3, 4].map(d => resultOnDay(d))
    const p = getSessionPatterns(results)
    expect(p.totalSessions).toBe(4)
  })
})

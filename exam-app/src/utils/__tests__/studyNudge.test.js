import { describe, it, expect } from 'vitest'
import { getStudyNudge } from '../studyNudge.js'

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString()
}

describe('getStudyNudge', () => {
  it('returns null for empty or null results', () => {
    expect(getStudyNudge([])).toBeNull()
    expect(getStudyNudge(null)).toBeNull()
  })

  it('returns null when last study was within 24 hours', () => {
    const results = [{ finishedAt: hoursAgo(12), score: 7 }]
    expect(getStudyNudge(results)).toBeNull()
  })

  it('returns null when last study was exactly 24 hours ago', () => {
    const results = [{ finishedAt: hoursAgo(24), score: 7 }]
    // 24h exactly is boundary — still null (nudge only after >24h)
    expect(getStudyNudge(results)).toBeNull()
  })

  it('returns a nudge string when last study was over 24 hours ago', () => {
    const results = [{ finishedAt: hoursAgo(25), score: 7 }]
    const nudge = getStudyNudge(results)
    expect(typeof nudge).toBe('string')
    expect(nudge.length).toBeGreaterThan(0)
  })

  it('returns a nudge after 3 days gap', () => {
    const results = [{ finishedAt: hoursAgo(72), score: 6 }]
    const nudge = getStudyNudge(results)
    expect(nudge).not.toBeNull()
  })

  it('nudge text references the gap in days when >= 2 days', () => {
    const results = [{ finishedAt: hoursAgo(50), score: 8 }]
    const nudge = getStudyNudge(results)
    // Should mention the number of days
    expect(nudge).toMatch(/\d+/)
  })

  it('uses the most recent result, not the first', () => {
    const results = [
      { finishedAt: hoursAgo(72), score: 5 }, // old
      { finishedAt: hoursAgo(6),  score: 8 }, // recent — within 24h
    ]
    // Most recent is 6h ago, so no nudge
    expect(getStudyNudge(results)).toBeNull()
  })

  it('handles unsorted results correctly', () => {
    const results = [
      { finishedAt: hoursAgo(48), score: 5 },
      { finishedAt: hoursAgo(10), score: 8 }, // most recent
    ]
    expect(getStudyNudge(results)).toBeNull()
  })
})

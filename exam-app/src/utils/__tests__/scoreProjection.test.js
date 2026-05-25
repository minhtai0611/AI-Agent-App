import { describe, it, expect } from 'vitest'
import { getScoreProjection } from '../scoreProjection.js'

describe('getScoreProjection', () => {
  it('returns null for empty or null sparkData', () => {
    expect(getScoreProjection([], 30)).toBeNull()
    expect(getScoreProjection(null, 30)).toBeNull()
  })

  it('returns null for fewer than 3 data points', () => {
    expect(getScoreProjection([{ i: 0, score: 7 }, { i: 1, score: 8 }], 30)).toBeNull()
  })

  it('returns null when daysUntil is null or 0', () => {
    const data = [{ i: 0, score: 6 }, { i: 1, score: 7 }, { i: 2, score: 8 }]
    expect(getScoreProjection(data, null)).toBeNull()
    expect(getScoreProjection(data, 0)).toBeNull()
  })

  it('returns null when trend is flat or declining', () => {
    const flat = [{ i: 0, score: 7 }, { i: 1, score: 7 }, { i: 2, score: 7 }]
    expect(getScoreProjection(flat, 30)).toBeNull()

    const declining = [{ i: 0, score: 8 }, { i: 1, score: 7 }, { i: 2, score: 6 }]
    expect(getScoreProjection(declining, 30)).toBeNull()
  })

  it('returns a projection object for improving trend with daysUntil > 0', () => {
    const data = [
      { i: 0, score: 5 }, { i: 1, score: 5.5 }, { i: 2, score: 6 },
      { i: 3, score: 6.5 }, { i: 4, score: 7 },
    ]
    const proj = getScoreProjection(data, 30)
    expect(proj).not.toBeNull()
    expect(proj).toHaveProperty('projectedScore')
    expect(proj).toHaveProperty('currentScore')
    expect(proj).toHaveProperty('gainNeeded')
    expect(proj).toHaveProperty('summary')
  })

  it('projectedScore is higher than current score for improving trend', () => {
    const data = [
      { i: 0, score: 5 }, { i: 1, score: 6 }, { i: 2, score: 7 },
      { i: 3, score: 7.5 }, { i: 4, score: 8 },
    ]
    const proj = getScoreProjection(data, 20)
    expect(proj.projectedScore).toBeGreaterThan(proj.currentScore)
  })

  it('caps projectedScore at 10', () => {
    // Very steep improvement heading past 10
    const data = [
      { i: 0, score: 7 }, { i: 1, score: 8 }, { i: 2, score: 9 },
      { i: 3, score: 9.5 }, { i: 4, score: 10 },
    ]
    const proj = getScoreProjection(data, 60)
    expect(proj.projectedScore).toBeLessThanOrEqual(10)
  })

  it('summary is a non-empty string', () => {
    const data = [
      { i: 0, score: 6 }, { i: 1, score: 6.5 }, { i: 2, score: 7 },
      { i: 3, score: 7.5 }, { i: 4, score: 8 },
    ]
    const proj = getScoreProjection(data, 30)
    expect(typeof proj.summary).toBe('string')
    expect(proj.summary.length).toBeGreaterThan(0)
  })
})

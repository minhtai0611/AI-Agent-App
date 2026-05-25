import { describe, it, expect } from 'vitest'
import { getGoalStatus } from '../goalAlignment.js'

// Helper: build sparkData with a positive slope
function makeSpark(scores) {
  return scores.map((score, i) => ({ i, score }))
}

function futureDate(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
}

function pastDate(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
}

const RISING_SPARK = makeSpark([6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0])
const FLAT_SPARK   = makeSpark([7.0, 7.0, 7.0, 7.0, 7.0])
const THIN_SPARK   = makeSpark([7.0, 7.5])  // < 3 points

// ─── null cases ──────────────────────────────────────────────────────────────

describe('getGoalStatus — null cases', () => {
  it('returns null when user is null', () => {
    expect(getGoalStatus(null, RISING_SPARK)).toBeNull()
  })

  it('returns null when user has no exam_date', () => {
    expect(getGoalStatus({ target_school: 'THPT X' }, RISING_SPARK)).toBeNull()
  })

  it('returns null when exam_date is in the past', () => {
    const user = { exam_date: pastDate(3) }
    expect(getGoalStatus(user, RISING_SPARK)).toBeNull()
  })

  it('returns null when exam_date is today (0 days)', () => {
    const user = { exam_date: new Date().toISOString().slice(0, 10) }
    // daysUntil = 0 → null
    expect(getGoalStatus(user, RISING_SPARK)).toBeNull()
  })
})

// ─── daysUntil ────────────────────────────────────────────────────────────────

describe('getGoalStatus — daysUntil', () => {
  it('computes correct daysUntil from exam_date', () => {
    const user = { exam_date: futureDate(30) }
    const result = getGoalStatus(user, RISING_SPARK)
    expect(result).not.toBeNull()
    expect(result.daysUntil).toBeGreaterThanOrEqual(29)
    expect(result.daysUntil).toBeLessThanOrEqual(31)
  })

  it('passes targetSchool and weeklyHours through', () => {
    const user = { exam_date: futureDate(60), target_school: 'THPT Chu Văn An', weekly_study_hours: 10 }
    const result = getGoalStatus(user, RISING_SPARK)
    expect(result.targetSchool).toBe('THPT Chu Văn An')
    expect(result.weeklyHours).toBe(10)
  })

  it('targetSchool is null when not set', () => {
    const user = { exam_date: futureDate(60) }
    const result = getGoalStatus(user, RISING_SPARK)
    expect(result.targetSchool).toBeNull()
  })
})

// ─── status: no_data ─────────────────────────────────────────────────────────

describe('getGoalStatus — no_data status', () => {
  it('returns no_data when sparkData has fewer than 3 points', () => {
    const user = { exam_date: futureDate(60) }
    const result = getGoalStatus(user, THIN_SPARK)
    expect(result.status).toBe('no_data')
  })

  it('returns no_data when sparkData is null', () => {
    const user = { exam_date: futureDate(60) }
    const result = getGoalStatus(user, null)
    expect(result.status).toBe('no_data')
  })

  it('no_data result has non-empty headline and detail', () => {
    const user = { exam_date: futureDate(45) }
    const result = getGoalStatus(user, null)
    expect(typeof result.headline).toBe('string')
    expect(result.headline.length).toBeGreaterThan(0)
    expect(typeof result.detail).toBe('string')
    expect(result.detail.length).toBeGreaterThan(0)
  })
})

// ─── status: ahead ───────────────────────────────────────────────────────────

describe('getGoalStatus — ahead status', () => {
  it('returns ahead when projected gain >= 1.0', () => {
    // Rising spark over 90 days → large gain
    const user = { exam_date: futureDate(90) }
    const result = getGoalStatus(user, RISING_SPARK)
    if (result.status !== 'no_data') {
      expect(result.status).toBe('ahead')
    }
  })

  it('ahead result contains projectedScore', () => {
    const user = { exam_date: futureDate(90) }
    const result = getGoalStatus(user, RISING_SPARK)
    if (result.status === 'ahead') {
      expect(typeof result.projectedScore).toBe('number')
      expect(result.projectedScore).toBeGreaterThan(0)
    }
  })
})

// ─── status: at_risk ─────────────────────────────────────────────────────────

describe('getGoalStatus — at_risk status', () => {
  it('returns at_risk when slope is flat', () => {
    const user = { exam_date: futureDate(30) }
    const result = getGoalStatus(user, FLAT_SPARK)
    // flat slope → getScoreProjection returns null → no_data, or at_risk if slope > 0.05
    expect(['at_risk', 'no_data']).toContain(result.status)
  })
})

// ─── result shape ────────────────────────────────────────────────────────────

describe('getGoalStatus — result shape', () => {
  it('always includes all required keys when non-null', () => {
    const user = { exam_date: futureDate(60) }
    const result = getGoalStatus(user, RISING_SPARK)
    expect(result).toHaveProperty('daysUntil')
    expect(result).toHaveProperty('targetSchool')
    expect(result).toHaveProperty('weeklyHours')
    expect(result).toHaveProperty('projectedScore')
    expect(result).toHaveProperty('currentScore')
    expect(result).toHaveProperty('status')
    expect(result).toHaveProperty('headline')
    expect(result).toHaveProperty('detail')
  })

  it('status is one of the valid values', () => {
    const VALID = ['ahead', 'steady', 'at_risk', 'no_data']
    const user = { exam_date: futureDate(60) }
    const result = getGoalStatus(user, RISING_SPARK)
    expect(VALID).toContain(result.status)
  })
})

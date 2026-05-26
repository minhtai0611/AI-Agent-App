import { describe, it, expect } from 'vitest'
import {
  PROVINCIAL_DIFFICULTY,
  NATIONAL_AVERAGES,
  DIFFICULTY_LABELS,
  getProvincialContext,
  getDifficultyInsight,
} from '../provincialData.js'

// ─── getProvincialContext ─────────────────────────────────────────────────────

describe('getProvincialContext', () => {
  it('returns non-null with all fields for a known province', () => {
    const ctx = getProvincialContext('Hà Nội')
    expect(ctx).not.toBeNull()
    expect(ctx).toHaveProperty('difficulty')
    expect(ctx).toHaveProperty('difficultyLabel')
    expect(ctx).toHaveProperty('typical_cutoff')
    expect(ctx).toHaveProperty('top_schools_cutoff')
    expect(ctx).toHaveProperty('nationalAvg')
    expect(ctx).toHaveProperty('vsNational')
  })

  it('returns null for an unknown province', () => {
    expect(getProvincialContext('UnknownProvince')).toBeNull()
    expect(getProvincialContext(null)).toBeNull()
    expect(getProvincialContext(undefined)).toBeNull()
    expect(getProvincialContext('')).toBeNull()
  })

  it('returns correct difficultyLabel from DIFFICULTY_LABELS', () => {
    const ctx = getProvincialContext('Hà Nội')
    expect(ctx.difficultyLabel).toBe(DIFFICULTY_LABELS[ctx.difficulty])
  })

  it('nationalAvg equals NATIONAL_AVERAGES[2024]', () => {
    const ctx = getProvincialContext('Đà Nẵng')
    expect(ctx.nationalAvg).toBe(NATIONAL_AVERAGES[2024])
  })

  it('vsNational is typical_cutoff minus nationalAvg', () => {
    const ctx = getProvincialContext('Hà Nội')
    expect(ctx.vsNational).toBeCloseTo(ctx.typical_cutoff - ctx.nationalAvg, 5)
  })

  it('difficulty label for Hà Nội is "Khó" (difficulty 4)', () => {
    const ctx = getProvincialContext('Hà Nội')
    expect(ctx.difficulty).toBe(4)
    expect(ctx.difficultyLabel).toBe('Khó')
  })

  it('returns non-null for Hà Giang (newly added remote province)', () => {
    expect(getProvincialContext('Hà Giang')).not.toBeNull()
  })

  it('returns non-null for Cà Mau (newly added remote province)', () => {
    expect(getProvincialContext('Cà Mau')).not.toBeNull()
  })
})

// ─── getDifficultyInsight ─────────────────────────────────────────────────────

describe('getDifficultyInsight', () => {
  it('returns null when province is null', () => {
    expect(getDifficultyInsight(null, 7.5)).toBeNull()
  })

  it('returns null when province is undefined', () => {
    expect(getDifficultyInsight(undefined, 7.5)).toBeNull()
  })

  it('returns null when userAvgScore is null', () => {
    expect(getDifficultyInsight('Hà Nội', null)).toBeNull()
  })

  it('returns null when userAvgScore is undefined', () => {
    expect(getDifficultyInsight('Hà Nội', undefined)).toBeNull()
  })

  it('returns null for unknown province', () => {
    expect(getDifficultyInsight('UnknownProvince', 7.5)).toBeNull()
  })

  it('returns string mentioning "trường top" when score >= top_schools_cutoff', () => {
    // Hà Nội top_schools_cutoff = 9.2
    const insight = getDifficultyInsight('Hà Nội', 9.5)
    expect(typeof insight).toBe('string')
    expect(insight.length).toBeGreaterThan(0)
    expect(insight).toMatch(/trường top/i)
  })

  it('returns string mentioning "ngưỡng điểm chuẩn" when typical_cutoff <= score < top_schools_cutoff', () => {
    // Hà Nội typical_cutoff = 8.0, top_schools_cutoff = 9.2
    const insight = getDifficultyInsight('Hà Nội', 8.5)
    expect(typeof insight).toBe('string')
    expect(insight.length).toBeGreaterThan(0)
    expect(insight).toMatch(/ngưỡng điểm chuẩn/i)
  })

  it('returns string mentioning "Cần cải thiện" when score < typical_cutoff', () => {
    // Hà Nội typical_cutoff = 8.0
    const insight = getDifficultyInsight('Hà Nội', 6.0)
    expect(typeof insight).toBe('string')
    expect(insight.length).toBeGreaterThan(0)
    expect(insight).toMatch(/Cần cải thiện/i)
  })

  it('all return types are strings (non-empty) or null', () => {
    const cases = [
      [null, 7.5],
      ['Hà Nội', null],
      ['UnknownProvince', 7.5],
      ['Hà Nội', 9.5],
      ['Hà Nội', 8.5],
      ['Hà Nội', 6.0],
    ]
    for (const [province, score] of cases) {
      const result = getDifficultyInsight(province, score)
      if (result !== null) {
        expect(typeof result).toBe('string')
        expect(result.length).toBeGreaterThan(0)
      }
    }
  })
})

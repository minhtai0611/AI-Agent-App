import { describe, it, expect } from 'vitest'
import { getTierGap } from '../tierGap.js'

describe('getTierGap', () => {
  it('returns null for complete tier', () => {
    expect(getTierGap('complete')).toBeNull()
  })

  it('returns object with required keys for basic tier', () => {
    const result = getTierGap('basic')
    expect(result).toHaveProperty('missingFeatures')
    expect(result).toHaveProperty('ctaLabel')
    expect(result).toHaveProperty('ctaTier')
  })

  it('returns object with required keys for student tier', () => {
    const result = getTierGap('student')
    expect(result).toHaveProperty('missingFeatures')
    expect(result).toHaveProperty('ctaLabel')
    expect(result).toHaveProperty('ctaTier')
  })

  it('basic tier has 4 missing features', () => {
    const result = getTierGap('basic')
    expect(Array.isArray(result.missingFeatures)).toBe(true)
    expect(result.missingFeatures).toHaveLength(4)
  })

  it('student tier has 3 missing features', () => {
    const result = getTierGap('student')
    expect(Array.isArray(result.missingFeatures)).toBe(true)
    expect(result.missingFeatures).toHaveLength(3)
  })

  it('basic ctaTier is student', () => {
    expect(getTierGap('basic').ctaTier).toBe('student')
  })

  it('student ctaTier is complete', () => {
    expect(getTierGap('student').ctaTier).toBe('complete')
  })

  it('basic ctaLabel mentions Học sinh', () => {
    expect(getTierGap('basic').ctaLabel).toContain('Học sinh')
  })

  it('student ctaLabel mentions Toàn diện', () => {
    expect(getTierGap('student').ctaLabel).toContain('Toàn diện')
  })

  it('all missingFeatures are non-empty strings for basic tier', () => {
    const result = getTierGap('basic')
    result.missingFeatures.forEach(f => {
      expect(typeof f).toBe('string')
      expect(f.length).toBeGreaterThan(0)
    })
  })

  it('all missingFeatures are non-empty strings for student tier', () => {
    const result = getTierGap('student')
    result.missingFeatures.forEach(f => {
      expect(typeof f).toBe('string')
      expect(f.length).toBeGreaterThan(0)
    })
  })
})

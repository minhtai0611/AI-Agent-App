import { describe, it, expect } from 'vitest'
import { getUpgradeContext } from '../upgradeContext.js'

// Feature access rules:
// 'study-plan': requires student or complete
// 'strategy': requires complete
// 'province': requires complete
// 'ai-tutor': requires complete

describe('getUpgradeContext — null when tier has access', () => {
  it('returns null for student on study-plan', () => {
    expect(getUpgradeContext('student', 'study-plan')).toBeNull()
  })

  it('returns null for complete on study-plan', () => {
    expect(getUpgradeContext('complete', 'study-plan')).toBeNull()
  })

  it('returns null for complete on strategy', () => {
    expect(getUpgradeContext('complete', 'strategy')).toBeNull()
  })

  it('returns null for complete on province', () => {
    expect(getUpgradeContext('complete', 'province')).toBeNull()
  })

  it('returns null for complete on ai-tutor', () => {
    expect(getUpgradeContext('complete', 'ai-tutor')).toBeNull()
  })
})

describe('getUpgradeContext — returns context when tier lacks access', () => {
  it('returns object for basic on study-plan', () => {
    const result = getUpgradeContext('basic', 'study-plan')
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('featureLabel')
    expect(result).toHaveProperty('requiredTier')
    expect(result).toHaveProperty('requiredTierLabel')
    expect(result).toHaveProperty('pitch')
  })

  it('returns object for basic on strategy', () => {
    const result = getUpgradeContext('basic', 'strategy')
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('pitch')
  })

  it('returns object for student on strategy', () => {
    const result = getUpgradeContext('student', 'strategy')
    expect(result).not.toBeNull()
    expect(result.requiredTier).toBe('complete')
  })

  it('returns object for basic on province', () => {
    const result = getUpgradeContext('basic', 'province')
    expect(result).not.toBeNull()
    expect(result.requiredTier).toBe('complete')
  })

  it('returns object for student on province', () => {
    const result = getUpgradeContext('student', 'province')
    expect(result).not.toBeNull()
    expect(result.requiredTier).toBe('complete')
  })

  it('returns object for basic on ai-tutor', () => {
    const result = getUpgradeContext('basic', 'ai-tutor')
    expect(result).not.toBeNull()
    expect(result.requiredTier).toBe('complete')
  })

  it('requiredTier is student for study-plan on basic', () => {
    expect(getUpgradeContext('basic', 'study-plan').requiredTier).toBe('student')
  })

  it('pitch is a non-empty string', () => {
    const result = getUpgradeContext('basic', 'strategy')
    expect(typeof result.pitch).toBe('string')
    expect(result.pitch.length).toBeGreaterThan(0)
  })

  it('requiredTierLabel is a non-empty string', () => {
    const result = getUpgradeContext('basic', 'strategy')
    expect(typeof result.requiredTierLabel).toBe('string')
    expect(result.requiredTierLabel.length).toBeGreaterThan(0)
  })

  it('featureLabel is a non-empty string', () => {
    const result = getUpgradeContext('basic', 'study-plan')
    expect(typeof result.featureLabel).toBe('string')
    expect(result.featureLabel.length).toBeGreaterThan(0)
  })
})

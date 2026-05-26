import { describe, it, expect } from 'vitest'
import {
  getTopupRecommendation,
  getTrialUrgency,
  getAnnualSavingsDays,
} from '../monetization.js'

const PACKAGES = [
  { price: '15,000đ', credits: 150, label: 'Starter' },
  { price: '29,000đ', credits: 350, label: 'Phổ biến' },
  { price: '59,000đ', credits: 800, label: 'Tiết kiệm' },
]

// ─── getTopupRecommendation ───────────────────────────────────────────────────

describe('getTopupRecommendation', () => {
  it('returns null when creditLog is empty and balance is high', () => {
    expect(getTopupRecommendation([], 500, PACKAGES)).toBeNull()
  })

  it('returns null when no spend detected in last 7 days', () => {
    const oldLog = [{ delta: -5, created_at: '2020-01-01T00:00:00Z' }]
    expect(getTopupRecommendation(oldLog, 200, PACKAGES)).toBeNull()
  })

  it('recommends a package when spend rate is known and balance is low', () => {
    const now = new Date()
    const log = Array.from({ length: 5 }, (_, i) => ({
      delta: -10,
      created_at: new Date(now.getTime() - i * 86400000).toISOString(),
    }))
    const rec = getTopupRecommendation(log, 20, PACKAGES)
    expect(rec).not.toBeNull()
    expect(rec).toHaveProperty('pack')
    expect(rec).toHaveProperty('coversDays')
    expect(rec).toHaveProperty('reasoning')
  })

  it('recommended pack is one of the provided packages', () => {
    const now = new Date()
    const log = [
      { delta: -20, created_at: new Date(now.getTime() - 86400000).toISOString() },
      { delta: -15, created_at: new Date(now.getTime() - 2 * 86400000).toISOString() },
    ]
    const rec = getTopupRecommendation(log, 10, PACKAGES)
    expect(PACKAGES.map(p => p.label)).toContain(rec.pack.label)
  })

  it('coversDays is positive', () => {
    const now = new Date()
    const log = [{ delta: -8, created_at: new Date(now.getTime() - 86400000).toISOString() }]
    const rec = getTopupRecommendation(log, 5, PACKAGES)
    if (rec) expect(rec.coversDays).toBeGreaterThan(0)
  })

  it('reasoning is a non-empty string', () => {
    const now = new Date()
    const log = [{ delta: -10, created_at: new Date(now.getTime() - 86400000).toISOString() }]
    const rec = getTopupRecommendation(log, 15, PACKAGES)
    if (rec) expect(rec.reasoning.length).toBeGreaterThan(0)
  })
})

// ─── getTrialUrgency ──────────────────────────────────────────────────────────

describe('getTrialUrgency', () => {
  it('returns null when user has no trial_expires_at', () => {
    expect(getTrialUrgency({ subscription_tier: 'basic' })).toBeNull()
    expect(getTrialUrgency(null)).toBeNull()
  })

  it('returns null when trial has already expired', () => {
    const past = new Date(Date.now() - 86400000).toISOString()
    expect(getTrialUrgency({ trial_expires_at: past })).toBeNull()
  })

  it('returns urgency object when trial expires in the future', () => {
    const future = new Date(Date.now() + 3 * 86400000).toISOString()
    const urgency = getTrialUrgency({ trial_expires_at: future })
    expect(urgency).not.toBeNull()
    expect(urgency).toHaveProperty('daysLeft')
    expect(urgency).toHaveProperty('pct')
    expect(urgency).toHaveProperty('message')
    expect(urgency).toHaveProperty('lossItems')
  })

  it('daysLeft is correct for 3 days remaining', () => {
    const future = new Date(Date.now() + 3 * 86400000 + 3600000).toISOString()
    const urgency = getTrialUrgency({ trial_expires_at: future })
    expect(urgency.daysLeft).toBe(3)
  })

  it('pct is between 0 and 1', () => {
    const future = new Date(Date.now() + 2 * 86400000).toISOString()
    const urgency = getTrialUrgency({ trial_expires_at: future })
    expect(urgency.pct).toBeGreaterThanOrEqual(0)
    expect(urgency.pct).toBeLessThanOrEqual(1)
  })

  it('lossItems is a non-empty array of strings', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const urgency = getTrialUrgency({ trial_expires_at: future })
    expect(Array.isArray(urgency.lossItems)).toBe(true)
    expect(urgency.lossItems.length).toBeGreaterThan(0)
    urgency.lossItems.forEach(item => expect(typeof item).toBe('string'))
  })
})

// ─── getAnnualSavingsDays ─────────────────────────────────────────────────────

describe('getAnnualSavingsDays', () => {
  it('returns savings in days for student plan', () => {
    // student: monthly 29000, annual 261000 → savings 87000 / 29000 * 30 = 90 days
    const days = getAnnualSavingsDays(29000, 261000)
    expect(days).toBe(90)
  })

  it('returns savings in days for complete plan', () => {
    // complete: monthly 59000, annual 531000 → savings 177000 / 59000 * 30 = 90 days
    const days = getAnnualSavingsDays(59000, 531000)
    expect(days).toBe(90)
  })

  it('returns 0 when annual costs the same as 12 months', () => {
    expect(getAnnualSavingsDays(10000, 120000)).toBe(0)
  })

  it('returns 0 when annual would be more expensive (no negative)', () => {
    expect(getAnnualSavingsDays(10000, 130000)).toBe(0)
  })
})

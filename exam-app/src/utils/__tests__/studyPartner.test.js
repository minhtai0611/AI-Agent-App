import { describe, it, expect } from 'vitest'
import { canUseStudyPartners, getPartnerMatchLabel } from '../studyPartner.js'

// ─── canUseStudyPartners ──────────────────────────────────────────────────────

describe('canUseStudyPartners', () => {
  it('returns false for basic tier', () => {
    expect(canUseStudyPartners('basic')).toBe(false)
  })

  it('returns false for student tier', () => {
    expect(canUseStudyPartners('student')).toBe(false)
  })

  it('returns true for complete tier', () => {
    expect(canUseStudyPartners('complete')).toBe(true)
  })

  it('returns false for unknown/undefined tier', () => {
    expect(canUseStudyPartners(undefined)).toBe(false)
    expect(canUseStudyPartners(null)).toBe(false)
    expect(canUseStudyPartners('')).toBe(false)
  })
})

// ─── getPartnerMatchLabel ─────────────────────────────────────────────────────

describe('getPartnerMatchLabel', () => {
  it('returns a string containing grade', () => {
    const label = getPartnerMatchLabel({ grade: '12', avg_score: 7.8, score_diff: 0.3, province: 'Hà Nội' })
    expect(typeof label).toBe('string')
    expect(label).toContain('12')
  })

  it('returns a string containing avg_score', () => {
    const label = getPartnerMatchLabel({ grade: '11', avg_score: 8.5, score_diff: 0.2, province: 'TP.HCM' })
    expect(label).toContain('8.5')
  })

  it('returns a string containing score_diff', () => {
    const label = getPartnerMatchLabel({ grade: '10', avg_score: 6.0, score_diff: 1.2, province: 'Đà Nẵng' })
    expect(label).toContain('1.2')
  })

  it('handles null avg_score gracefully (no crash)', () => {
    expect(() => getPartnerMatchLabel({ grade: '12', avg_score: null, score_diff: null, province: 'Hà Nội' })).not.toThrow()
    const label = getPartnerMatchLabel({ grade: '12', avg_score: null, score_diff: null, province: 'Hà Nội' })
    expect(typeof label).toBe('string')
    expect(label.length).toBeGreaterThan(0)
  })

  it('handles undefined fields gracefully (no crash)', () => {
    expect(() => getPartnerMatchLabel({})).not.toThrow()
  })

  it('returns label with expected format segments', () => {
    const label = getPartnerMatchLabel({ grade: '12', avg_score: 7.8, score_diff: 0.3, province: 'Hà Nội' })
    // Expected: "Cùng lớp 12 · Điểm TB 7.8 · Chênh lệch 0.3"
    expect(label).toContain('·')
  })
})

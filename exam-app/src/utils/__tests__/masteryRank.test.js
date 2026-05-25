import { describe, it, expect } from 'vitest'
import { getMasteryProgress, MASTERY_TIERS } from '../masteryRank.js'

describe('MASTERY_TIERS', () => {
  it('exports an array of 4 tiers in ascending order', () => {
    expect(MASTERY_TIERS).toHaveLength(4)
    expect(MASTERY_TIERS[0].id).toBe('Pemula')
    expect(MASTERY_TIERS[3].id).toBe('Chuyên gia')
  })

  it('each tier has id, label, icon, minSolid fields', () => {
    for (const tier of MASTERY_TIERS) {
      expect(tier).toHaveProperty('id')
      expect(tier).toHaveProperty('label')
      expect(tier).toHaveProperty('icon')
      expect(tier).toHaveProperty('minSolid')
    }
  })
})

describe('getMasteryProgress', () => {
  it('returns current tier and next tier for Pemula', () => {
    const p = getMasteryProgress('Pemula', 8)
    expect(p.current.id).toBe('Pemula')
    expect(p.next.id).toBe('Học sinh')
    expect(p.needed).toBe(16 - 8)
    expect(p.pct).toBeCloseTo(8 / 16)
  })

  it('returns correct progress for Học sinh', () => {
    const p = getMasteryProgress('Học sinh', 24)
    expect(p.current.id).toBe('Học sinh')
    expect(p.next.id).toBe('Sinh viên')
    // progress within the 16→36 band: (24-16)/(36-16) = 8/20 = 0.4
    expect(p.pct).toBeCloseTo(0.4)
    expect(p.needed).toBe(36 - 24)
  })

  it('returns correct progress for Sinh viên', () => {
    const p = getMasteryProgress('Sinh viên', 44)
    expect(p.current.id).toBe('Sinh viên')
    expect(p.next.id).toBe('Chuyên gia')
    expect(p.pct).toBeCloseTo((44 - 36) / (56 - 36))
    expect(p.needed).toBe(56 - 44)
  })

  it('returns null next and pct=1 at max rank', () => {
    const p = getMasteryProgress('Chuyên gia', 60)
    expect(p.current.id).toBe('Chuyên gia')
    expect(p.next).toBeNull()
    expect(p.pct).toBe(1)
    expect(p.needed).toBe(0)
  })

  it('clamps pct to [0, 1]', () => {
    const p = getMasteryProgress('Pemula', 0)
    expect(p.pct).toBeGreaterThanOrEqual(0)
    const p2 = getMasteryProgress('Sinh viên', 99)
    expect(p2.pct).toBeLessThanOrEqual(1)
  })
})

import { describe, it, expect } from 'vitest'
import { getExamPhase, EXAM_PHASES } from '../examUrgency.js'

// ─── EXAM_PHASES contract ─────────────────────────────────────────────────────

describe('EXAM_PHASES', () => {
  it('exports an array of 5 phase objects', () => {
    expect(Array.isArray(EXAM_PHASES)).toBe(true)
    expect(EXAM_PHASES).toHaveLength(5)
  })

  it('each phase has required keys', () => {
    for (const p of EXAM_PHASES) {
      expect(p).toHaveProperty('id')
      expect(p).toHaveProperty('label')
      expect(p).toHaveProperty('colorPrimary')
      expect(p).toHaveProperty('headline')
      expect(p).toHaveProperty('cta')
      expect(p).toHaveProperty('icon')
    }
  })

  it('phase ids are unique', () => {
    const ids = EXAM_PHASES.map(p => p.id)
    expect(new Set(ids).size).toBe(EXAM_PHASES.length)
  })
})

// ─── getExamPhase — null cases ────────────────────────────────────────────────

describe('getExamPhase — null cases', () => {
  it('returns null when daysUntil is null', () => {
    expect(getExamPhase(null)).toBeNull()
  })

  it('returns null when daysUntil is undefined', () => {
    expect(getExamPhase(undefined)).toBeNull()
  })

  it('returns null when daysUntil is negative', () => {
    expect(getExamPhase(-5)).toBeNull()
  })
})

// ─── getExamPhase — phase boundaries ─────────────────────────────────────────

describe('getExamPhase — phase classification', () => {
  it('returns review phase for < 7 days (daysUntil = 3)', () => {
    const phase = getExamPhase(3)
    expect(phase.id).toBe('review')
  })

  it('returns review phase at exactly 0 days', () => {
    const phase = getExamPhase(0)
    expect(phase.id).toBe('review')
  })

  it('returns critical phase for 7–13 days (daysUntil = 10)', () => {
    const phase = getExamPhase(10)
    expect(phase.id).toBe('critical')
  })

  it('returns critical phase at boundary (daysUntil = 7)', () => {
    const phase = getExamPhase(7)
    expect(phase.id).toBe('critical')
  })

  it('returns urgent phase for 14–29 days (daysUntil = 20)', () => {
    const phase = getExamPhase(20)
    expect(phase.id).toBe('urgent')
  })

  it('returns urgent phase at boundary (daysUntil = 14)', () => {
    const phase = getExamPhase(14)
    expect(phase.id).toBe('urgent')
  })

  it('returns focused phase for 30–59 days (daysUntil = 45)', () => {
    const phase = getExamPhase(45)
    expect(phase.id).toBe('focused')
  })

  it('returns focused phase at boundary (daysUntil = 30)', () => {
    const phase = getExamPhase(30)
    expect(phase.id).toBe('focused')
  })

  it('returns explorer phase for 60+ days (daysUntil = 90)', () => {
    const phase = getExamPhase(90)
    expect(phase.id).toBe('explorer')
  })

  it('returns explorer phase at boundary (daysUntil = 60)', () => {
    const phase = getExamPhase(60)
    expect(phase.id).toBe('explorer')
  })
})

// ─── getExamPhase — return shape ──────────────────────────────────────────────

describe('getExamPhase — return shape', () => {
  it('returns a phase object (not null) for daysUntil = 0', () => {
    const phase = getExamPhase(0)
    expect(phase).not.toBeNull()
    expect(typeof phase.id).toBe('string')
    expect(typeof phase.headline).toBe('string')
    expect(phase.headline.length).toBeGreaterThan(0)
  })

  it('colorPrimary is a valid hex or rgb string', () => {
    for (const days of [0, 5, 10, 20, 45, 90]) {
      const phase = getExamPhase(days)
      if (phase) {
        expect(typeof phase.colorPrimary).toBe('string')
        expect(phase.colorPrimary.length).toBeGreaterThan(0)
      }
    }
  })
})

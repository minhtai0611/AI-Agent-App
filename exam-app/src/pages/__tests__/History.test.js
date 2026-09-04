import { describe, it, expect } from 'vitest'
import { buildAttempts, fmtNum, fmtDelta } from '../History.jsx'

// Synthetic results mirroring scoringEngine.js's shape, covering the 3 mockup
// states (empty / first-milestone / journal) plus a same-exam repeat attempt
// ("switchback") so the elevation chart's dashed-vs-solid line logic and the
// journal's per-entry delta indicator can be sanity-checked without rendering.
const R1 = { id: 'r1', examId: 'examA', finishedAt: '2026-07-06T10:00:00Z', score: 6.0, timeSpent: 5280 }
const R2 = { id: 'r2', examId: 'examB', finishedAt: '2026-07-13T10:00:00Z', score: 7.0, timeSpent: 2400 }
const R3 = { id: 'r3', examId: 'examA', finishedAt: '2026-07-20T10:00:00Z', score: 6.5, timeSpent: 5400 }
const R4 = { id: 'r4', examId: 'examA', finishedAt: '2026-08-09T10:00:00Z', score: 7.75, timeSpent: 5100 }

describe('History — empty / first / journal state derivation', () => {
  it('empty results -> no attempts', () => {
    expect(buildAttempts([]).length).toBe(0)
  })

  it('single result -> one attempt with no prior', () => {
    const attempts = buildAttempts([R1])
    expect(attempts).toHaveLength(1)
    expect(attempts[0].prevScore).toBeNull()
  })

  it('multiple results are sorted chronologically', () => {
    const attempts = buildAttempts([R4, R1, R3, R2])
    expect(attempts.map(a => a.id)).toEqual(['r1', 'r2', 'r3', 'r4'])
  })
})

describe('History — switchback (repeat-attempt) detection for the elevation chart', () => {
  it('flags repeat attempts of the same exam with prevScore, leaves first-timers null', () => {
    const attempts = buildAttempts([R1, R2, R3, R4])
    const byId = Object.fromEntries(attempts.map(a => [a.id, a]))

    // First-ever attempts of each exam have no prior score (solid-line-only, no dashed connector)
    expect(byId.r1.prevScore).toBeNull()
    expect(byId.r2.prevScore).toBeNull()

    // Repeats of examA chain to the previous examA attempt (dashed switchback connector)
    expect(byId.r3.prevScore).toBe(R1.score)
    expect(byId.r4.prevScore).toBe(R3.score)
  })

  it('does not connect repeats across different exams', () => {
    const attempts = buildAttempts([R1, R2, R3, R4])
    const r3 = attempts.find(a => a.id === 'r3')
    expect(r3.prev.examId).toBe('examA')
    expect(r3.prev.id).not.toBe('r2')
  })
})

describe('History — Vietnamese comma-decimal formatting', () => {
  it('fmtNum renders with a comma separator like the mockup ("7,75")', () => {
    expect(fmtNum(7.75)).toBe('7,75')
    expect(fmtNum(6)).toBe('6,00')
  })

  it('fmtDelta marks improvement, decline, and first-attempt cases', () => {
    expect(fmtDelta(0.75).text).toBe('▲ +0,75')
    expect(fmtDelta(-0.5).text).toContain('▼')
    expect(fmtDelta(0).text).toBe('· LẦN ĐẦU')
  })
})

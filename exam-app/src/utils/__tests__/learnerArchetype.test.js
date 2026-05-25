import { describe, it, expect } from 'vitest'
import { classifyLearner, ARCHETYPES } from '../learnerArchetype.js'

// helpers
const makeResults = (n, score, finishedDates) =>
  finishedDates.map((d, i) => ({ finishedAt: d, score: score ?? 7, examId: `exam_${i}` }))

describe('ARCHETYPES', () => {
  it('exports 4 archetypes each with id, label, icon, desc', () => {
    expect(ARCHETYPES).toHaveLength(4)
    for (const a of ARCHETYPES) {
      expect(a).toHaveProperty('id')
      expect(a).toHaveProperty('label')
      expect(a).toHaveProperty('icon')
      expect(a).toHaveProperty('desc')
    }
  })
})

describe('classifyLearner', () => {
  it('returns null for empty or null results', () => {
    expect(classifyLearner([])).toBeNull()
    expect(classifyLearner(null)).toBeNull()
  })

  it('returns null for fewer than 3 results', () => {
    expect(classifyLearner([{ finishedAt: '2025-01-01T00:00:00Z', score: 7 }])).toBeNull()
    expect(classifyLearner([
      { finishedAt: '2025-01-01T00:00:00Z', score: 7 },
      { finishedAt: '2025-01-02T00:00:00Z', score: 8 },
    ])).toBeNull()
  })

  it('returns an archetype object with id, label, icon, desc', () => {
    const results = Array.from({ length: 5 }, (_, i) => ({
      finishedAt: new Date(2025, 0, i + 1).toISOString(),
      score: 7,
    }))
    const archetype = classifyLearner(results)
    expect(archetype).not.toBeNull()
    expect(archetype).toHaveProperty('id')
    expect(archetype).toHaveProperty('label')
    expect(archetype).toHaveProperty('icon')
    expect(archetype).toHaveProperty('desc')
  })

  it('classifies expert (chuyên gia) for few exams with high scores', () => {
    // 4 exams, avg score >= 8.5 → chuyên gia chuyên sâu
    const results = Array.from({ length: 4 }, (_, i) => ({
      finishedAt: new Date(2025, 0, i * 3 + 1).toISOString(),
      score: 9,
    }))
    const archetype = classifyLearner(results)
    expect(archetype.id).toBe('expert')
  })

  it('classifies consistent learner for many evenly-spread sessions with stable scores', () => {
    // 12 exams on consecutive days, score variance very low
    const results = Array.from({ length: 12 }, (_, i) => ({
      finishedAt: new Date(2025, 0, i + 1).toISOString(),
      score: 7 + (i % 2 === 0 ? 0.1 : -0.1),
    }))
    const archetype = classifyLearner(results)
    expect(archetype.id).toBe('consistent')
  })

  it('classifies explorer for many exams across many different exam IDs', () => {
    // 20 exams, each unique examId
    const results = Array.from({ length: 20 }, (_, i) => ({
      finishedAt: new Date(2025, 0, i + 1).toISOString(),
      score: 7,
      examId: `exam_unique_${i}`,
    }))
    const archetype = classifyLearner(results)
    expect(archetype.id).toBe('explorer')
  })

  it('classifies sprinter for high score variance', () => {
    // Alternating high and low scores → high variance
    const results = Array.from({ length: 8 }, (_, i) => ({
      finishedAt: new Date(2025, 0, i * 3 + 1).toISOString(),
      score: i % 2 === 0 ? 9.5 : 4.5,
    }))
    const archetype = classifyLearner(results)
    expect(archetype.id).toBe('sprinter')
  })
})

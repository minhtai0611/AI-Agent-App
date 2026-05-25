import { describe, it, expect } from 'vitest'
import { getLearnerTimeline } from '../learnerTimeline.js'

describe('getLearnerTimeline', () => {
  it('returns empty array for empty or null results', () => {
    expect(getLearnerTimeline([])).toEqual([])
    expect(getLearnerTimeline(null)).toEqual([])
  })

  it('includes first exam event', () => {
    const results = [
      { finishedAt: '2025-01-06T10:00:00Z', score: 6 },
      { finishedAt: '2025-01-07T10:00:00Z', score: 7 },
    ]
    const timeline = getLearnerTimeline(results)
    expect(timeline.some(e => e.type === 'first_exam')).toBe(true)
  })

  it('includes first high score event when score >= 8', () => {
    const results = [
      { finishedAt: '2025-01-06T10:00:00Z', score: 6 },
      { finishedAt: '2025-01-07T10:00:00Z', score: 8.5 },
    ]
    const timeline = getLearnerTimeline(results)
    expect(timeline.some(e => e.type === 'first_high_score')).toBe(true)
  })

  it('does not include first_high_score if no score >= 8', () => {
    const results = [
      { finishedAt: '2025-01-06T10:00:00Z', score: 6 },
      { finishedAt: '2025-01-07T10:00:00Z', score: 7.5 },
    ]
    const timeline = getLearnerTimeline(results)
    expect(timeline.some(e => e.type === 'first_high_score')).toBe(false)
  })

  it('includes milestone_10 when 10 or more exams', () => {
    const results = Array.from({ length: 10 }, (_, i) => ({
      finishedAt: new Date(2025, 0, i + 1).toISOString(),
      score: 7,
    }))
    const timeline = getLearnerTimeline(results)
    expect(timeline.some(e => e.type === 'milestone_10')).toBe(true)
  })

  it('does not include milestone_10 for fewer than 10 exams', () => {
    const results = Array.from({ length: 5 }, (_, i) => ({
      finishedAt: new Date(2025, 0, i + 1).toISOString(),
      score: 7,
    }))
    const timeline = getLearnerTimeline(results)
    expect(timeline.some(e => e.type === 'milestone_10')).toBe(false)
  })

  it('includes perfect_score event when score === 10', () => {
    const results = [
      { finishedAt: '2025-01-06T10:00:00Z', score: 7 },
      { finishedAt: '2025-01-07T10:00:00Z', score: 10 },
    ]
    const timeline = getLearnerTimeline(results)
    expect(timeline.some(e => e.type === 'perfect_score')).toBe(true)
  })

  it('each event has type, label, date, icon fields', () => {
    const results = [{ finishedAt: '2025-01-06T10:00:00Z', score: 8 }]
    const timeline = getLearnerTimeline(results)
    for (const event of timeline) {
      expect(event).toHaveProperty('type')
      expect(event).toHaveProperty('label')
      expect(event).toHaveProperty('date')
      expect(event).toHaveProperty('icon')
    }
  })

  it('events are sorted from oldest to newest', () => {
    const results = Array.from({ length: 10 }, (_, i) => ({
      finishedAt: new Date(2025, 0, 10 - i).toISOString(), // reverse order
      score: i === 9 ? 10 : 7,
    }))
    const timeline = getLearnerTimeline(results)
    for (let i = 1; i < timeline.length; i++) {
      expect(new Date(timeline[i].date) >= new Date(timeline[i - 1].date)).toBe(true)
    }
  })
})

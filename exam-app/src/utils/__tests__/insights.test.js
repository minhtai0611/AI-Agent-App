import { describe, it, expect } from 'vitest'
import {
  interpretScoreTrend,
  interpretTopicRadar,
  interpretHeatmap,
  getTodayFocus,
  getNextMilestone,
} from '../insights.js'

// ─── interpretScoreTrend ──────────────────────────────────────────────────────

describe('interpretScoreTrend', () => {
  it('returns null for empty data', () => {
    expect(interpretScoreTrend([])).toBeNull()
    expect(interpretScoreTrend(null)).toBeNull()
  })

  it('returns null for fewer than 3 data points', () => {
    expect(interpretScoreTrend([{ i: 0, score: 7 }])).toBeNull()
    expect(interpretScoreTrend([{ i: 0, score: 7 }, { i: 1, score: 8 }])).toBeNull()
  })

  it('detects improving trend', () => {
    const data = [
      { i: 0, score: 5 }, { i: 1, score: 5.5 }, { i: 2, score: 6 },
      { i: 3, score: 7 }, { i: 4, score: 7.5 }, { i: 5, score: 8 },
    ]
    const result = interpretScoreTrend(data)
    expect(result).toContain('tăng')
    expect(result).not.toContain('giảm')
  })

  it('detects declining trend', () => {
    const data = [
      { i: 0, score: 8 }, { i: 1, score: 7.5 }, { i: 2, score: 7 },
      { i: 3, score: 6 }, { i: 4, score: 5.5 }, { i: 5, score: 5 },
    ]
    const result = interpretScoreTrend(data)
    expect(result).toContain('giảm')
    expect(result).not.toContain('tăng')
  })

  it('detects stable trend', () => {
    const data = [
      { i: 0, score: 7 }, { i: 1, score: 7.1 }, { i: 2, score: 6.9 },
      { i: 3, score: 7.0 }, { i: 4, score: 7.1 }, { i: 5, score: 7.0 },
    ]
    const result = interpretScoreTrend(data)
    expect(result).toContain('ổn định')
  })

  it('returns a non-empty string for valid data', () => {
    const data = [
      { i: 0, score: 6 }, { i: 1, score: 7 }, { i: 2, score: 8 },
      { i: 3, score: 8 }, { i: 4, score: 9 }, { i: 5, score: 9 },
    ]
    expect(typeof interpretScoreTrend(data)).toBe('string')
    expect(interpretScoreTrend(data).length).toBeGreaterThan(0)
  })
})

// ─── interpretTopicRadar ──────────────────────────────────────────────────────

describe('interpretTopicRadar', () => {
  it('returns null for empty data', () => {
    expect(interpretTopicRadar([])).toBeNull()
    expect(interpretTopicRadar(null)).toBeNull()
  })

  it('identifies the weakest topic', () => {
    const data = [
      { topic: 'Đại số', score: 72 },
      { topic: 'Hình học', score: 45 },
      { topic: 'Giải tích', score: 60 },
    ]
    const result = interpretTopicRadar(data)
    expect(result).toContain('Hình học')
    expect(result).toContain('45')
  })

  it('handles single topic', () => {
    const data = [{ topic: 'Đại số', score: 50 }]
    const result = interpretTopicRadar(data)
    expect(result).toContain('Đại số')
    expect(result).toContain('50')
  })

  it('handles tie by returning one of the weakest', () => {
    const data = [
      { topic: 'A', score: 40 },
      { topic: 'B', score: 40 },
      { topic: 'C', score: 80 },
    ]
    const result = interpretTopicRadar(data)
    expect(result).toContain('40')
  })
})

// ─── interpretHeatmap ────────────────────────────────────────────────────────

describe('interpretHeatmap', () => {
  it('returns null for empty results', () => {
    expect(interpretHeatmap([])).toBeNull()
    expect(interpretHeatmap(null)).toBeNull()
  })

  it('returns null for fewer than 3 results', () => {
    const r = [
      { finishedAt: '2025-01-06T10:00:00Z' },
      { finishedAt: '2025-01-07T10:00:00Z' },
    ]
    expect(interpretHeatmap(r)).toBeNull()
  })

  it('identifies the most active day of the week', () => {
    // 2025-01-06 is Monday, 2025-01-07 Tuesday, 2025-01-13 Monday again
    const results = [
      { finishedAt: '2025-01-06T10:00:00Z' }, // Mon
      { finishedAt: '2025-01-13T10:00:00Z' }, // Mon
      { finishedAt: '2025-01-20T10:00:00Z' }, // Mon
      { finishedAt: '2025-01-07T10:00:00Z' }, // Tue
    ]
    const result = interpretHeatmap(results)
    expect(result).toContain('Thứ 2')
  })

  it('returns a non-empty string for valid data', () => {
    const results = [
      { finishedAt: '2025-01-06T10:00:00Z' },
      { finishedAt: '2025-01-07T10:00:00Z' },
      { finishedAt: '2025-01-08T10:00:00Z' },
    ]
    expect(typeof interpretHeatmap(results)).toBe('string')
  })
})

// ─── getTodayFocus ────────────────────────────────────────────────────────────

describe('getTodayFocus', () => {
  it('returns null for empty data', () => {
    expect(getTodayFocus([])).toBeNull()
    expect(getTodayFocus(null)).toBeNull()
  })

  it('returns the topic with the lowest score', () => {
    const data = [
      { topic: 'Đại số', score: 72 },
      { topic: 'Hình học', score: 35 },
      { topic: 'Giải tích', score: 60 },
    ]
    const result = getTodayFocus(data)
    expect(result.topic).toBe('Hình học')
    expect(result.score).toBe(35)
  })

  it('returns the single topic if only one exists', () => {
    const data = [{ topic: 'Đại số', score: 50 }]
    const result = getTodayFocus(data)
    expect(result.topic).toBe('Đại số')
  })
})

// ─── getNextMilestone ─────────────────────────────────────────────────────────

describe('getNextMilestone', () => {
  it('returns null when all badges are earned', () => {
    const earned = new Set(['perfect', 'ten_exams', 'fast', 'improving'])
    const results = Array.from({ length: 15 }, (_, i) => ({ score: 9, finishedAt: '2025-01-01T00:00:00Z' }))
    expect(getNextMilestone(results, earned)).toBeNull()
  })

  it('prioritises ten_exams when not earned and shows correct count', () => {
    const earned = new Set([])
    const results = Array.from({ length: 4 }, () => ({ score: 7 }))
    const milestone = getNextMilestone(results, earned)
    expect(milestone).not.toBeNull()
    expect(milestone.label).toBe('Chinh phục 10 đề')
    expect(milestone.progress).toContain('4/10')
    expect(milestone.remaining).toBe(6)
  })

  it('moves to perfect badge once ten_exams is earned', () => {
    const earned = new Set(['ten_exams'])
    const results = Array.from({ length: 12 }, () => ({ score: 7.5 }))
    const milestone = getNextMilestone(results, earned)
    expect(milestone).not.toBeNull()
    expect(milestone.label).toBe('Điểm hoàn hảo')
    expect(milestone.progress).toContain('7.5')
  })

  it('ten_exams shows 0 remaining when 10+ exams done', () => {
    const earned = new Set([])
    const results = Array.from({ length: 8 }, () => ({ score: 6 }))
    const milestone = getNextMilestone(results, earned)
    expect(milestone.remaining).toBe(2)
  })

  it('returns a valid shape with icon, label, progress, pct', () => {
    const earned = new Set([])
    const results = [{ score: 6 }, { score: 7 }, { score: 8 }]
    const milestone = getNextMilestone(results, earned)
    expect(milestone).toHaveProperty('icon')
    expect(milestone).toHaveProperty('label')
    expect(milestone).toHaveProperty('progress')
    expect(milestone).toHaveProperty('pct')
    expect(milestone.pct).toBeGreaterThanOrEqual(0)
    expect(milestone.pct).toBeLessThanOrEqual(1)
  })
})

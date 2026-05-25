import { describe, it, expect } from 'vitest'
import { generateWeeklyReport } from '../weeklyReport.js'

describe('generateWeeklyReport', () => {
  it('returns null for empty results', () => {
    expect(generateWeeklyReport([])).toBeNull()
    expect(generateWeeklyReport(null)).toBeNull()
  })

  it('returns null when no results in the last 7 days', () => {
    const old = [{ finishedAt: '2020-01-01T10:00:00Z', score: 7 }]
    expect(generateWeeklyReport(old)).toBeNull()
  })

  it('counts only results within the last 7 days', () => {
    const now = new Date()
    const recent = d => {
      const t = new Date(now)
      t.setDate(t.getDate() - d)
      return t.toISOString()
    }
    const results = [
      { finishedAt: recent(1), score: 8 },
      { finishedAt: recent(3), score: 6 },
      { finishedAt: '2020-01-01T00:00:00Z', score: 5 }, // old, excluded
    ]
    const report = generateWeeklyReport(results)
    expect(report.examCount).toBe(2)
  })

  it('computes avgScore correctly', () => {
    const now = new Date()
    const recent = d => { const t = new Date(now); t.setDate(t.getDate() - d); return t.toISOString() }
    const results = [
      { finishedAt: recent(1), score: 8 },
      { finishedAt: recent(2), score: 6 },
    ]
    const report = generateWeeklyReport(results)
    expect(report.avgScore).toBe('7.0')
  })

  it('identifies topWeakTopic from radarData when provided', () => {
    const now = new Date()
    const recent = d => { const t = new Date(now); t.setDate(t.getDate() - d); return t.toISOString() }
    const results = [{ finishedAt: recent(1), score: 7 }]
    const radarData = [
      { topic: 'Đại số', score: 70 },
      { topic: 'Hình học', score: 35 },
      { topic: 'Giải tích', score: 55 },
    ]
    const report = generateWeeklyReport(results, radarData)
    expect(report.topWeakTopic).toBe('Hình học')
  })

  it('returns a summary string', () => {
    const now = new Date()
    const recent = d => { const t = new Date(now); t.setDate(t.getDate() - d); return t.toISOString() }
    const results = [{ finishedAt: recent(1), score: 8 }, { finishedAt: recent(2), score: 7 }]
    const report = generateWeeklyReport(results)
    expect(typeof report.summary).toBe('string')
    expect(report.summary.length).toBeGreaterThan(0)
  })

  it('report shape has examCount, avgScore, summary fields', () => {
    const now = new Date()
    const recent = d => { const t = new Date(now); t.setDate(t.getDate() - d); return t.toISOString() }
    const results = [{ finishedAt: recent(1), score: 7 }]
    const report = generateWeeklyReport(results)
    expect(report).toHaveProperty('examCount')
    expect(report).toHaveProperty('avgScore')
    expect(report).toHaveProperty('summary')
  })
})

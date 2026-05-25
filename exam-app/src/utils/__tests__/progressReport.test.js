import { describe, it, expect } from 'vitest'
import { generateProgressReport, reportToText } from '../progressReport.js'

const USER = {
  display_name: 'Minh Tài',
  grade: '12',
  province: 'Hồ Chí Minh',
  mastery_rank: 'Học sinh',
  solid_concept_count: 14,
}

function makeResults(scores) {
  return scores.map((score, i) => ({
    score,
    finishedAt: new Date(Date.now() - i * 86400000).toISOString(),
    examId: `exam-${i}`,
  }))
}

const RADAR = [
  { topic: 'Đại số', score: 85 },
  { topic: 'Hình học', score: 72 },
  { topic: 'Giải tích', score: 61 },
  { topic: 'Tổ hợp', score: 45 },
  { topic: 'Logarit', score: 38 },
]

// ─── null / empty cases ───────────────────────────────────────────────────────

describe('generateProgressReport — null cases', () => {
  it('returns null when user is null', () => {
    expect(generateProgressReport(null, makeResults([7, 8]), 5, 10, RADAR)).toBeNull()
  })

  it('returns null when results is null', () => {
    expect(generateProgressReport(USER, null, 5, 10, RADAR)).toBeNull()
  })

  it('returns null when results is empty', () => {
    expect(generateProgressReport(USER, [], 5, 10, RADAR)).toBeNull()
  })
})

// ─── basic fields ─────────────────────────────────────────────────────────────

describe('generateProgressReport — basic fields', () => {
  it('totalExams matches results length', () => {
    const report = generateProgressReport(USER, makeResults([6, 7, 8]), 3, 5, RADAR)
    expect(report.totalExams).toBe(3)
  })

  it('avgScore is rounded to 1 decimal', () => {
    // scores [6, 7, 8] → avg 7.0
    const report = generateProgressReport(USER, makeResults([6, 7, 8]), 3, 5, RADAR)
    expect(report.avgScore).toBe(7.0)
  })

  it('avgScore rounds correctly for non-round averages', () => {
    // scores [5, 6, 7, 8] → avg 6.5
    const report = generateProgressReport(USER, makeResults([5, 6, 7, 8]), 0, 0, RADAR)
    expect(report.avgScore).toBe(6.5)
  })

  it('studentName comes from display_name', () => {
    const report = generateProgressReport(USER, makeResults([7]), 0, 0, RADAR)
    expect(report.studentName).toBe('Minh Tài')
  })

  it('studentName falls back to email prefix when display_name absent', () => {
    const u = { email: 'alice@example.com' }
    const report = generateProgressReport(u, makeResults([7]), 0, 0, RADAR)
    expect(report.studentName).toBe('alice')
  })

  it('grade is formatted as Lớp N', () => {
    const report = generateProgressReport(USER, makeResults([7]), 0, 0, RADAR)
    expect(report.grade).toBe('Lớp 12')
  })

  it('grade is null when not set', () => {
    const u = { display_name: 'X' }
    const report = generateProgressReport(u, makeResults([7]), 0, 0, RADAR)
    expect(report.grade).toBeNull()
  })

  it('streakDays and personalBest are passed through', () => {
    const report = generateProgressReport(USER, makeResults([7, 8]), 12, 30, RADAR)
    expect(report.streakDays).toBe(12)
    expect(report.personalBest).toBe(30)
  })

  it('masteryRank and solidConcepts come from user', () => {
    const report = generateProgressReport(USER, makeResults([7]), 0, 0, RADAR)
    expect(report.masteryRank).toBe('Học sinh')
    expect(report.solidConcepts).toBe(14)
  })
})

// ─── scoreImprovement ─────────────────────────────────────────────────────────

describe('generateProgressReport — scoreImprovement', () => {
  it('is positive when recent scores are higher than early scores', () => {
    // First 5: [5,5,5,5,5] → avg 5; last 5: [8,8,8,8,8] → avg 8
    const scores = [5, 5, 5, 5, 5, 8, 8, 8, 8, 8]
    const report = generateProgressReport(USER, makeResults(scores), 0, 0, RADAR)
    expect(report.scoreImprovement).toBeGreaterThan(0)
  })

  it('is negative when recent scores are lower than early scores', () => {
    const scores = [8, 8, 8, 8, 8, 5, 5, 5, 5, 5]
    const report = generateProgressReport(USER, makeResults(scores), 0, 0, RADAR)
    expect(report.scoreImprovement).toBeLessThan(0)
  })

  it('is 0 when all scores are equal', () => {
    const report = generateProgressReport(USER, makeResults([7, 7, 7, 7, 7]), 0, 0, RADAR)
    expect(report.scoreImprovement).toBe(0)
  })

  it('works with only 1 result (no improvement possible)', () => {
    const report = generateProgressReport(USER, makeResults([7]), 0, 0, RADAR)
    expect(report.scoreImprovement).toBe(0)
  })
})

// ─── topic rankings ───────────────────────────────────────────────────────────

describe('generateProgressReport — topic rankings', () => {
  it('topTopics has at most 3 entries from highest radar scores', () => {
    const report = generateProgressReport(USER, makeResults([7]), 0, 0, RADAR)
    expect(report.topTopics).toHaveLength(3)
    expect(report.topTopics[0]).toBe('Đại số')  // score 85
    expect(report.topTopics[1]).toBe('Hình học') // score 72
  })

  it('weakTopics has at most 3 entries from lowest radar scores', () => {
    const report = generateProgressReport(USER, makeResults([7]), 0, 0, RADAR)
    expect(report.weakTopics).toHaveLength(3)
    expect(report.weakTopics[0]).toBe('Logarit')  // score 38 (weakest first)
    expect(report.weakTopics[1]).toBe('Tổ hợp')   // score 45
  })

  it('topTopics and weakTopics are empty arrays when radarData is empty', () => {
    const report = generateProgressReport(USER, makeResults([7]), 0, 0, [])
    expect(report.topTopics).toEqual([])
    expect(report.weakTopics).toEqual([])
  })

  it('topTopics and weakTopics are empty when radarData is null', () => {
    const report = generateProgressReport(USER, makeResults([7]), 0, 0, null)
    expect(report.topTopics).toEqual([])
    expect(report.weakTopics).toEqual([])
  })
})

// ─── reportToText ─────────────────────────────────────────────────────────────

describe('reportToText', () => {
  it('returns a non-empty string', () => {
    const report = generateProgressReport(USER, makeResults([7, 8]), 5, 10, RADAR)
    const text = reportToText(report)
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(0)
  })

  it('includes student name', () => {
    const report = generateProgressReport(USER, makeResults([7, 8]), 5, 10, RADAR)
    const text = reportToText(report)
    expect(text).toContain('Minh Tài')
  })

  it('includes total exams count', () => {
    const report = generateProgressReport(USER, makeResults([7, 8, 9]), 5, 10, RADAR)
    const text = reportToText(report)
    expect(text).toContain('3')
  })

  it('includes positive improvement when present', () => {
    const scores = [5, 5, 5, 5, 5, 8, 8, 8, 8, 8]
    const report = generateProgressReport(USER, makeResults(scores), 0, 0, RADAR)
    const text = reportToText(report)
    expect(text).toContain('+')
  })
})

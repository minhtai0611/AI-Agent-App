import { describe, it, expect } from 'vitest'
import { getAdvisorMessage } from '../advisorMessage.js'

// Minimal valid context — enough for a non-null result
const BASE = {
  results: Array.from({ length: 5 }, (_, i) => ({ score: 7 + i * 0.2, finishedAt: new Date(Date.now() - i * 86400000).toISOString() })),
  streak: 4,
  streakPB: 7,
  sessionPatterns: {
    mostActiveDay: { dayName: 'Thứ 2', dayIndex: 1 },
    bestScoreDay:  { dayName: 'Thứ 5', dayIndex: 4, avgScore: 8.5 },
    insight: 'stub',
    totalSessions: 5,
  },
  scoreProjection: { projectedScore: 8.2, currentScore: 7.5, gainNeeded: 0.7, summary: 'stub' },
  goalStatus: { status: 'ahead', daysUntil: 45, headline: 'stub', detail: 'stub', targetSchool: null, weeklyHours: null, projectedScore: 8.2, currentScore: 7.5 },
  weeklyReport: { examCount: 3, avgScore: 7.8, topWeakTopic: 'Logarit', summary: 'stub' },
  examPhase: { id: 'focused', label: 'Tập trung', colorPrimary: '#818CF8' },
  progressReport: { scoreImprovement: 1.5, totalExams: 12, avgScore: 7.8 },
}

// ─── null / minimal cases ─────────────────────────────────────────────────────

describe('getAdvisorMessage — null cases', () => {
  it('returns null when results is null', () => {
    expect(getAdvisorMessage({ ...BASE, results: null })).toBeNull()
  })

  it('returns null when results is empty', () => {
    expect(getAdvisorMessage({ ...BASE, results: [] })).toBeNull()
  })

  it('returns null when fewer than 3 results', () => {
    expect(getAdvisorMessage({ ...BASE, results: BASE.results.slice(0, 2) })).toBeNull()
  })
})

// ─── return shape ─────────────────────────────────────────────────────────────

describe('getAdvisorMessage — return shape', () => {
  it('returns an object with message and category', () => {
    const result = getAdvisorMessage(BASE)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('message')
    expect(result).toHaveProperty('category')
  })

  it('message is a non-empty string', () => {
    const result = getAdvisorMessage(BASE)
    expect(typeof result.message).toBe('string')
    expect(result.message.length).toBeGreaterThan(0)
  })

  it('category is one of the valid values', () => {
    const VALID = ['urgent', 'progress', 'optimization', 'encouragement', 'goal', 'consistency']
    const result = getAdvisorMessage(BASE)
    expect(VALID).toContain(result.category)
  })
})

// ─── priority: urgent ─────────────────────────────────────────────────────────

describe('getAdvisorMessage — urgent priority', () => {
  it('returns urgent category when examPhase is review AND goalStatus is at_risk', () => {
    const ctx = {
      ...BASE,
      examPhase: { id: 'review', label: 'Ôn tập nước rút', colorPrimary: '#EF4444' },
      goalStatus: { ...BASE.goalStatus, status: 'at_risk' },
    }
    const result = getAdvisorMessage(ctx)
    expect(result.category).toBe('urgent')
  })

  it('returns urgent category when examPhase is critical AND goalStatus is at_risk', () => {
    const ctx = {
      ...BASE,
      examPhase: { id: 'critical', label: 'Giai đoạn then chốt', colorPrimary: '#F97316' },
      goalStatus: { ...BASE.goalStatus, status: 'at_risk' },
    }
    const result = getAdvisorMessage(ctx)
    expect(result.category).toBe('urgent')
  })
})

// ─── priority: progress ───────────────────────────────────────────────────────

describe('getAdvisorMessage — progress priority', () => {
  it('returns progress when scoreImprovement >= 1.0 and no urgent condition', () => {
    const ctx = {
      ...BASE,
      examPhase: { id: 'explorer', label: 'Khám phá', colorPrimary: '#10B981' },
      goalStatus: { ...BASE.goalStatus, status: 'ahead' },
      progressReport: { ...BASE.progressReport, scoreImprovement: 1.5 },
    }
    const result = getAdvisorMessage(ctx)
    expect(['progress', 'goal']).toContain(result.category)
  })
})

// ─── priority: optimization ───────────────────────────────────────────────────

describe('getAdvisorMessage — optimization priority', () => {
  it('returns optimization when bestScoreDay differs from mostActiveDay', () => {
    const ctx = {
      ...BASE,
      examPhase: { id: 'explorer', label: 'Khám phá', colorPrimary: '#10B981' },
      goalStatus: null,
      progressReport: { ...BASE.progressReport, scoreImprovement: 0 },
      scoreProjection: null,
    }
    const result = getAdvisorMessage(ctx)
    // bestScoreDay (Thu 4) != mostActiveDay (Mon 1), so optimization should fire
    expect(result.category).toBe('optimization')
  })

  it('does not return optimization when bestScoreDay is null', () => {
    const ctx = {
      ...BASE,
      examPhase: { id: 'explorer', label: 'Khám phá', colorPrimary: '#10B981' },
      goalStatus: null,
      progressReport: { ...BASE.progressReport, scoreImprovement: 0 },
      scoreProjection: null,
      sessionPatterns: { ...BASE.sessionPatterns, bestScoreDay: null },
    }
    const result = getAdvisorMessage(ctx)
    expect(result.category).not.toBe('optimization')
  })
})

// ─── fallback ─────────────────────────────────────────────────────────────────

describe('getAdvisorMessage — fallback', () => {
  it('always returns a non-null result when results >= 3 even with all nulls', () => {
    const ctx = {
      results: BASE.results,
      streak: 0,
      streakPB: 0,
      sessionPatterns: null,
      scoreProjection: null,
      goalStatus: null,
      weeklyReport: null,
      examPhase: null,
      progressReport: null,
    }
    const result = getAdvisorMessage(ctx)
    expect(result).not.toBeNull()
    expect(result.message.length).toBeGreaterThan(0)
  })
})

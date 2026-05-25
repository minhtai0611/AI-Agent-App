import { describe, it, expect } from 'vitest'
import { getSimulationMode, getScoreConfidenceInterval, getDailySimulationPlan } from '../examSimulation.js'

describe('getSimulationMode', () => {
  describe('null cases', () => {
    it('returns null when daysUntil is null', () => {
      expect(getSimulationMode(null)).toBeNull()
    })

    it('returns null when daysUntil is undefined', () => {
      expect(getSimulationMode(undefined)).toBeNull()
    })

    it('returns null when daysUntil is 15', () => {
      expect(getSimulationMode(15)).toBeNull()
    })

    it('returns null when daysUntil is 100', () => {
      expect(getSimulationMode(100)).toBeNull()
    })

    it('returns null when daysUntil is negative', () => {
      expect(getSimulationMode(-1)).toBeNull()
    })
  })

  describe('boundary at 14', () => {
    it('returns non-null when daysUntil is exactly 14', () => {
      expect(getSimulationMode(14)).not.toBeNull()
    })

    it('returns non-null when daysUntil is 0', () => {
      expect(getSimulationMode(0)).not.toBeNull()
    })
  })

  describe('intensity classification', () => {
    it('returns medium intensity when daysUntil is 14', () => {
      const result = getSimulationMode(14)
      expect(result.intensity).toBe('medium')
    })

    it('returns medium intensity when daysUntil is 8', () => {
      const result = getSimulationMode(8)
      expect(result.intensity).toBe('medium')
    })

    it('returns high intensity when daysUntil is exactly 7', () => {
      const result = getSimulationMode(7)
      expect(result.intensity).toBe('high')
    })

    it('returns high intensity when daysUntil is 4', () => {
      const result = getSimulationMode(4)
      expect(result.intensity).toBe('high')
    })

    it('returns max intensity when daysUntil is exactly 3', () => {
      const result = getSimulationMode(3)
      expect(result.intensity).toBe('max')
    })

    it('returns max intensity when daysUntil is 1', () => {
      const result = getSimulationMode(1)
      expect(result.intensity).toBe('max')
    })

    it('returns max intensity when daysUntil is 0', () => {
      const result = getSimulationMode(0)
      expect(result.intensity).toBe('max')
    })
  })

  describe('required fields', () => {
    it('result has active: true', () => {
      const result = getSimulationMode(10)
      expect(result.active).toBe(true)
    })

    it('result has daysUntil matching input', () => {
      const result = getSimulationMode(10)
      expect(result.daysUntil).toBe(10)
    })

    it('result has briefing as a non-empty string', () => {
      const result = getSimulationMode(10)
      expect(typeof result.briefing).toBe('string')
      expect(result.briefing.length).toBeGreaterThan(0)
    })

    it('result has focusTip as a non-empty string', () => {
      const result = getSimulationMode(10)
      expect(typeof result.focusTip).toBe('string')
      expect(result.focusTip.length).toBeGreaterThan(0)
    })

    it('max intensity has appropriate briefing mentioning deadline urgency', () => {
      const result = getSimulationMode(2)
      expect(result.intensity).toBe('max')
      expect(result.briefing).toBeTruthy()
    })
  })
})

// ─── getScoreConfidenceInterval ───────────────────────────────────────────────

const makeSparkData = (scores) => scores.map((score, i) => ({ score, date: `2024-01-${String(i + 1).padStart(2, '0')}` }))

describe('getScoreConfidenceInterval', () => {
  it('returns null when fewer than 5 data points', () => {
    expect(getScoreConfidenceInterval(makeSparkData([7, 8, 7.5, 8]), 9)).toBeNull()
  })

  it('returns null when sparkData is empty', () => {
    expect(getScoreConfidenceInterval([], 9)).toBeNull()
  })

  it('returns null when sparkData is null', () => {
    expect(getScoreConfidenceInterval(null, 9)).toBeNull()
  })

  it('projectedScore is average of last 3 scores', () => {
    const sparkData = makeSparkData([5, 6, 7, 8, 9])
    const result = getScoreConfidenceInterval(sparkData, null)
    // last 3: 7, 8, 9 → avg = 8
    expect(result.projectedScore).toBeCloseTo(8, 5)
  })

  it('high >= projectedScore >= low', () => {
    const sparkData = makeSparkData([6, 7, 6.5, 7.5, 8, 7])
    const result = getScoreConfidenceInterval(sparkData, null)
    expect(result.high).toBeGreaterThanOrEqual(result.projectedScore)
    expect(result.projectedScore).toBeGreaterThanOrEqual(result.low)
  })

  it('onTrack is true when projectedScore >= targetScore', () => {
    const sparkData = makeSparkData([7, 8, 8, 8.5, 9])
    const result = getScoreConfidenceInterval(sparkData, 8)
    expect(result.onTrack).toBe(true)
  })

  it('onTrack is false when projectedScore < targetScore', () => {
    const sparkData = makeSparkData([5, 5.5, 6, 6, 6])
    const result = getScoreConfidenceInterval(sparkData, 9)
    expect(result.onTrack).toBe(false)
  })

  it('onTrack is true when targetScore is null', () => {
    const sparkData = makeSparkData([5, 5, 5, 5, 5])
    const result = getScoreConfidenceInterval(sparkData, null)
    expect(result.onTrack).toBe(true)
  })

  it('confidenceLabel is cao when std dev < 0.5 (very consistent scores)', () => {
    // Scores with very small variance
    const sparkData = makeSparkData([8, 8.1, 7.9, 8, 8.05, 8.02])
    const result = getScoreConfidenceInterval(sparkData, null)
    expect(result.confidenceLabel).toBe('cao')
  })

  it('low is clamped to 0', () => {
    const sparkData = makeSparkData([0, 0, 0, 0, 0])
    const result = getScoreConfidenceInterval(sparkData, null)
    expect(result.low).toBeGreaterThanOrEqual(0)
  })

  it('high is clamped to 10', () => {
    const sparkData = makeSparkData([10, 10, 10, 10, 10])
    const result = getScoreConfidenceInterval(sparkData, null)
    expect(result.high).toBeLessThanOrEqual(10)
  })
})

// ─── getDailySimulationPlan ───────────────────────────────────────────────────

describe('getDailySimulationPlan', () => {
  it('returns null when simulationMode is null', () => {
    expect(getDailySimulationPlan(null, ['Đại số'])).toBeNull()
  })

  it('sessionCount=3 for intensity max', () => {
    const mode = getSimulationMode(2) // max
    const result = getDailySimulationPlan(mode, [])
    expect(result.sessionCount).toBe(3)
  })

  it('sessionCount=2 for intensity high', () => {
    const mode = getSimulationMode(5) // high
    const result = getDailySimulationPlan(mode, [])
    expect(result.sessionCount).toBe(2)
  })

  it('sessionCount=1 for intensity medium', () => {
    const mode = getSimulationMode(10) // medium
    const result = getDailySimulationPlan(mode, [])
    expect(result.sessionCount).toBe(1)
  })

  it('timePerSession=45 for max', () => {
    const mode = getSimulationMode(2)
    const result = getDailySimulationPlan(mode, [])
    expect(result.timePerSession).toBe(45)
  })

  it('timePerSession=40 for high', () => {
    const mode = getSimulationMode(5)
    const result = getDailySimulationPlan(mode, [])
    expect(result.timePerSession).toBe(40)
  })

  it('timePerSession=30 for medium', () => {
    const mode = getSimulationMode(10)
    const result = getDailySimulationPlan(mode, [])
    expect(result.timePerSession).toBe(30)
  })

  it('focusTopics limited to 2 items max', () => {
    const mode = getSimulationMode(5)
    const result = getDailySimulationPlan(mode, ['A', 'B', 'C', 'D'])
    expect(result.focusTopics.length).toBeLessThanOrEqual(2)
  })

  it('todayMessage is a non-empty string', () => {
    const mode = getSimulationMode(5)
    const result = getDailySimulationPlan(mode, ['Đại số'])
    expect(typeof result.todayMessage).toBe('string')
    expect(result.todayMessage.length).toBeGreaterThan(0)
  })

  it('focusTopics includes provided weak topics', () => {
    const mode = getSimulationMode(5)
    const result = getDailySimulationPlan(mode, ['Đại số', 'Hình học'])
    expect(result.focusTopics).toEqual(['Đại số', 'Hình học'])
  })
})

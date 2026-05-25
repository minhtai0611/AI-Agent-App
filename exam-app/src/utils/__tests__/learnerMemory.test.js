import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getMemoryInsights, getTopicTrend } from '../learnerMemory.js'

// ─── getTopicTrend ────────────────────────────────────────────────────────────

describe('getTopicTrend', () => {
  it('returns null for null input', () => {
    expect(getTopicTrend(null)).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(getTopicTrend([])).toBeNull()
  })

  it('returns null for single snapshot', () => {
    expect(getTopicTrend([{ date: '2025-11-01', mastery: 0.5, exam_count: 5 }])).toBeNull()
  })

  it('identifies improving trend (gain >= 0.1)', () => {
    const snapshots = [
      { date: '2025-11-01', mastery: 0.4, exam_count: 5 },
      { date: '2025-12-01', mastery: 0.5, exam_count: 10 },
    ]
    expect(getTopicTrend(snapshots)).toBe('improving')
  })

  it('identifies stable trend (gain exactly 0.1 is improving, < 0.1 is stable)', () => {
    const snapshots = [
      { date: '2025-11-01', mastery: 0.5, exam_count: 5 },
      { date: '2025-12-01', mastery: 0.59, exam_count: 10 },
    ]
    expect(getTopicTrend(snapshots)).toBe('stable')
  })

  it('boundary: last - first = exactly 0.1 => improving', () => {
    const snapshots = [
      { date: '2025-11-01', mastery: 0.4, exam_count: 5 },
      { date: '2025-12-01', mastery: 0.5, exam_count: 10 },
    ]
    expect(getTopicTrend(snapshots)).toBe('improving')
  })

  it('identifies declining trend (loss >= 0.1)', () => {
    const snapshots = [
      { date: '2025-11-01', mastery: 0.7, exam_count: 5 },
      { date: '2025-12-01', mastery: 0.6, exam_count: 10 },
    ]
    expect(getTopicTrend(snapshots)).toBe('declining')
  })

  it('boundary: last - first = exactly -0.1 => declining', () => {
    const snapshots = [
      { date: '2025-11-01', mastery: 0.7, exam_count: 5 },
      { date: '2025-12-01', mastery: 0.6, exam_count: 10 },
    ]
    expect(getTopicTrend(snapshots)).toBe('declining')
  })

  it('stable when change is within ±0.1 (exclusive)', () => {
    const snapshots = [
      { date: '2025-11-01', mastery: 0.5, exam_count: 5 },
      { date: '2025-12-01', mastery: 0.55, exam_count: 10 },
    ]
    expect(getTopicTrend(snapshots)).toBe('stable')
  })

  it('works with more than 2 snapshots (uses first and last)', () => {
    const snapshots = [
      { date: '2025-10-01', mastery: 0.3, exam_count: 3 },
      { date: '2025-11-01', mastery: 0.5, exam_count: 8 },
      { date: '2025-12-01', mastery: 0.6, exam_count: 14 },
    ]
    // 0.6 - 0.3 = 0.3 >= 0.1 => improving
    expect(getTopicTrend(snapshots)).toBe('improving')
  })
})

// ─── getMemoryInsights ────────────────────────────────────────────────────────

describe('getMemoryInsights', () => {
  // Fix "now" so weeksSinceStart is deterministic
  const NOW_ISO = '2026-01-15T12:00:00.000Z'
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_ISO))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null for null input', () => {
    expect(getMemoryInsights(null)).toBeNull()
  })

  it('returns null when snapshot_count < 3', () => {
    expect(getMemoryInsights({
      topics: { derivatives: [{ date: '2025-12-01', mastery: 0.5, exam_count: 5 }] },
      first_snapshot_date: '2025-12-01',
      snapshot_count: 2,
    })).toBeNull()
  })

  it('returns null when snapshot_count is 0', () => {
    expect(getMemoryInsights({ topics: {}, first_snapshot_date: null, snapshot_count: 0 })).toBeNull()
  })

  it('returns correct mostImproved: topic with largest last-first mastery delta', () => {
    const memoryData = {
      topics: {
        derivatives: [
          { date: '2025-11-01', mastery: 0.3, exam_count: 5 },
          { date: '2025-12-01', mastery: 0.72, exam_count: 15 },
        ],
        logarithms: [
          { date: '2025-11-01', mastery: 0.5, exam_count: 5 },
          { date: '2025-12-01', mastery: 0.6, exam_count: 10 },
        ],
      },
      first_snapshot_date: '2025-11-01',
      snapshot_count: 4,
    }
    const result = getMemoryInsights(memoryData)
    expect(result).not.toBeNull()
    // derivatives: 0.72 - 0.3 = 0.42 > logarithms: 0.1
    expect(result.mostImproved.topicId).toBe('derivatives')
    // gainPct: 0.42 * 100 = 42
    expect(result.mostImproved.gainPct).toBeCloseTo(42, 0)
  })

  it('mostImproved label comes from THPT_TOPIC_GRAPH', () => {
    const memoryData = {
      topics: {
        derivatives: [
          { date: '2025-11-01', mastery: 0.3, exam_count: 5 },
          { date: '2025-12-01', mastery: 0.72, exam_count: 15 },
        ],
      },
      first_snapshot_date: '2025-11-01',
      snapshot_count: 3,
    }
    const result = getMemoryInsights(memoryData)
    expect(result.mostImproved.label).toBe('Đạo hàm')
  })

  it('returns correct mostConsistent: topic with highest average mastery', () => {
    const memoryData = {
      topics: {
        derivatives: [
          { date: '2025-11-01', mastery: 0.3, exam_count: 5 },
          { date: '2025-12-01', mastery: 0.5, exam_count: 10 },
        ],
        logarithms: [
          { date: '2025-11-01', mastery: 0.8, exam_count: 5 },
          { date: '2025-12-01', mastery: 0.9, exam_count: 10 },
        ],
      },
      first_snapshot_date: '2025-11-01',
      snapshot_count: 4,
    }
    const result = getMemoryInsights(memoryData)
    // logarithms avg = (0.8 + 0.9) / 2 = 0.85 > derivatives avg = 0.4
    expect(result.mostConsistent.topicId).toBe('logarithms')
    expect(result.mostConsistent.avgMastery).toBeCloseTo(85, 0)
  })

  it('mostConsistent label comes from THPT_TOPIC_GRAPH', () => {
    const memoryData = {
      topics: {
        logarithms: [
          { date: '2025-11-01', mastery: 0.8, exam_count: 5 },
          { date: '2025-12-01', mastery: 0.9, exam_count: 10 },
        ],
      },
      first_snapshot_date: '2025-11-01',
      snapshot_count: 3,
    }
    const result = getMemoryInsights(memoryData)
    expect(result.mostConsistent.label).toBe('Logarit')
  })

  it('computes weeksSinceStart correctly from ISO date to now', () => {
    // first_snapshot_date: 2025-11-15, now: 2026-01-15 => ~61 days => 8 weeks
    const memoryData = {
      topics: {
        derivatives: [
          { date: '2025-11-15', mastery: 0.3, exam_count: 5 },
          { date: '2025-12-15', mastery: 0.6, exam_count: 10 },
        ],
      },
      first_snapshot_date: '2025-11-15',
      snapshot_count: 3,
    }
    const result = getMemoryInsights(memoryData)
    // 2025-11-15 to 2026-01-15 = 61 days => Math.floor(61/7) = 8
    expect(result.weeksSinceStart).toBe(8)
  })

  it('hasLongHistory is true when weeksSinceStart >= 4', () => {
    const memoryData = {
      topics: {
        derivatives: [
          { date: '2025-09-01', mastery: 0.3, exam_count: 5 },
          { date: '2025-10-01', mastery: 0.6, exam_count: 10 },
        ],
      },
      first_snapshot_date: '2025-09-01',
      snapshot_count: 5,
    }
    const result = getMemoryInsights(memoryData)
    expect(result.hasLongHistory).toBe(true)
    expect(result.weeksSinceStart).toBeGreaterThanOrEqual(4)
  })

  it('hasLongHistory is false when weeksSinceStart < 4', () => {
    // first_snapshot_date: 2026-01-05, now: 2026-01-15 => 10 days => 1 week
    const memoryData = {
      topics: {
        derivatives: [
          { date: '2026-01-05', mastery: 0.3, exam_count: 5 },
          { date: '2026-01-10', mastery: 0.4, exam_count: 8 },
        ],
      },
      first_snapshot_date: '2026-01-05',
      snapshot_count: 3,
    }
    const result = getMemoryInsights(memoryData)
    expect(result.hasLongHistory).toBe(false)
  })

  it('returns totalSnapshots equal to snapshot_count', () => {
    const memoryData = {
      topics: {
        derivatives: [
          { date: '2025-11-01', mastery: 0.3, exam_count: 5 },
          { date: '2025-12-01', mastery: 0.6, exam_count: 10 },
        ],
      },
      first_snapshot_date: '2025-11-01',
      snapshot_count: 7,
    }
    const result = getMemoryInsights(memoryData)
    expect(result.totalSnapshots).toBe(7)
  })

  it('mostImproved is null when all topics have only one snapshot', () => {
    const memoryData = {
      topics: {
        derivatives: [{ date: '2025-12-01', mastery: 0.5, exam_count: 5 }],
        logarithms:  [{ date: '2025-12-01', mastery: 0.7, exam_count: 5 }],
      },
      first_snapshot_date: '2025-12-01',
      snapshot_count: 3,
    }
    const result = getMemoryInsights(memoryData)
    expect(result.mostImproved).toBeNull()
  })
})

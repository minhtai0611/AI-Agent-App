import { describe, it, expect } from 'vitest'
import { getClassRankDisplay } from '../classRank.js'

describe('getClassRankDisplay', () => {
  it('returns null for null input', () => {
    expect(getClassRankDisplay(null)).toBeNull()
  })

  it('returns null when class_id is null', () => {
    expect(getClassRankDisplay({ class_id: null })).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(getClassRankDisplay(undefined)).toBeNull()
  })

  const sampleData = {
    class_id: 1,
    class_code: 'ZENITH',
    teacher_name: 'Nguyễn Văn A',
    subject: 'Toán',
    member_count: 10,
    your_rank: 1,
    your_avg_score: 9.0,
    class_avg_score: 7.5,
  }

  it('computes percentile correctly: rank 1 of 10 → 100%', () => {
    const result = getClassRankDisplay({ ...sampleData, your_rank: 1, member_count: 10 })
    expect(result.percentile).toBe(100)
  })

  it('computes percentile correctly: rank 10 of 10 → 10%', () => {
    const result = getClassRankDisplay({ ...sampleData, your_rank: 10, member_count: 10 })
    expect(result.percentile).toBe(10)
  })

  it('computes percentile correctly: rank 5 of 10 → 60%', () => {
    const result = getClassRankDisplay({ ...sampleData, your_rank: 5, member_count: 10 })
    expect(result.percentile).toBe(60)
  })

  it('isTopHalf true when rank <= ceil(memberCount / 2)', () => {
    // ceil(10/2) = 5, rank 5 → isTopHalf true
    const result = getClassRankDisplay({ ...sampleData, your_rank: 5, member_count: 10 })
    expect(result.isTopHalf).toBe(true)
  })

  it('isTopHalf false when rank > ceil(memberCount / 2)', () => {
    // ceil(10/2) = 5, rank 6 → isTopHalf false
    const result = getClassRankDisplay({ ...sampleData, your_rank: 6, member_count: 10 })
    expect(result.isTopHalf).toBe(false)
  })

  it('isTopHalf true for odd memberCount at boundary', () => {
    // ceil(9/2) = 5, rank 5 → isTopHalf true
    const result = getClassRankDisplay({ ...sampleData, your_rank: 5, member_count: 9 })
    expect(result.isTopHalf).toBe(true)
  })

  it('badge format is Top X%', () => {
    const result = getClassRankDisplay({ ...sampleData, your_rank: 1, member_count: 10 })
    expect(result.badge).toBe('Top 100%')
  })

  it('badge reflects computed percentile', () => {
    const result = getClassRankDisplay({ ...sampleData, your_rank: 10, member_count: 10 })
    expect(result.badge).toBe('Top 10%')
  })

  it('contains all required fields', () => {
    const result = getClassRankDisplay(sampleData)
    expect(result).toHaveProperty('teacherName')
    expect(result).toHaveProperty('subject')
    expect(result).toHaveProperty('memberCount')
    expect(result).toHaveProperty('rank')
    expect(result).toHaveProperty('total')
    expect(result).toHaveProperty('percentile')
    expect(result).toHaveProperty('avgScore')
    expect(result).toHaveProperty('classAvg')
    expect(result).toHaveProperty('isTopHalf')
    expect(result).toHaveProperty('badge')
  })

  it('maps fields correctly from API response', () => {
    const result = getClassRankDisplay(sampleData)
    expect(result.teacherName).toBe('Nguyễn Văn A')
    expect(result.subject).toBe('Toán')
    expect(result.memberCount).toBe(10)
    expect(result.total).toBe(10)
    expect(result.rank).toBe(1)
    expect(result.avgScore).toBe(9.0)
    expect(result.classAvg).toBe(7.5)
  })
})

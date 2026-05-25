import { describe, it, expect } from 'vitest'
import { getSocialProofMessage } from '../socialProof.js'

describe('getSocialProofMessage', () => {
  it('returns null for null input', () => {
    expect(getSocialProofMessage(null, 7.0)).toBeNull()
  })

  it('returns null when sample_size < 5', () => {
    const peerStats = {
      sample_size: 4,
      avg_improvement: 1.3,
      avg_weekly_exams: 3.2,
      top_percentile_threshold: 8.1,
      message: 'Some message',
    }
    expect(getSocialProofMessage(peerStats, 7.0)).toBeNull()
  })

  it('returns null when sample_size is 0', () => {
    const peerStats = { sample_size: 0, message: null }
    expect(getSocialProofMessage(peerStats, 7.0)).toBeNull()
  })

  it('returns null when message is null', () => {
    const peerStats = {
      sample_size: 47,
      avg_improvement: 1.3,
      avg_weekly_exams: 3.2,
      top_percentile_threshold: 8.1,
      message: null,
    }
    expect(getSocialProofMessage(peerStats, 7.0)).toBeNull()
  })

  it('returns correct headline from peerStats.message', () => {
    const peerStats = {
      sample_size: 47,
      avg_improvement: 1.3,
      avg_weekly_exams: 3.2,
      top_percentile_threshold: 8.1,
      message: 'Học sinh lớp 12 cải thiện trung bình 1.3 điểm sau 4-6 tuần luyện tập đều đặn.',
    }
    const result = getSocialProofMessage(peerStats, 7.0)
    expect(result).not.toBeNull()
    expect(result.headline).toBe(peerStats.message)
  })

  it('isAboveBenchmark is true when userAvgScore >= top_percentile_threshold', () => {
    const peerStats = {
      sample_size: 47,
      avg_improvement: 1.3,
      avg_weekly_exams: 3.2,
      top_percentile_threshold: 8.1,
      message: 'Some message',
    }
    const result = getSocialProofMessage(peerStats, 8.1)
    expect(result.isAboveBenchmark).toBe(true)
  })

  it('isAboveBenchmark is true when userAvgScore > top_percentile_threshold', () => {
    const peerStats = {
      sample_size: 10,
      avg_improvement: 1.0,
      avg_weekly_exams: 2.0,
      top_percentile_threshold: 7.5,
      message: 'Some message',
    }
    const result = getSocialProofMessage(peerStats, 9.0)
    expect(result.isAboveBenchmark).toBe(true)
  })

  it('isAboveBenchmark is false when userAvgScore < top_percentile_threshold', () => {
    const peerStats = {
      sample_size: 47,
      avg_improvement: 1.3,
      avg_weekly_exams: 3.2,
      top_percentile_threshold: 8.1,
      message: 'Some message',
    }
    const result = getSocialProofMessage(peerStats, 6.5)
    expect(result.isAboveBenchmark).toBe(false)
  })

  it('detail message differs based on benchmark position — above benchmark', () => {
    const peerStats = {
      sample_size: 47,
      avg_improvement: 1.3,
      avg_weekly_exams: 3.2,
      top_percentile_threshold: 8.1,
      message: 'Some message',
    }
    const result = getSocialProofMessage(peerStats, 8.5)
    expect(result.detail).toBe('Bạn đang ở top nhóm cao điểm trong lớp của bạn!')
  })

  it('detail message differs based on benchmark position — below benchmark', () => {
    const peerStats = {
      sample_size: 47,
      avg_improvement: 1.3,
      avg_weekly_exams: 3.2,
      top_percentile_threshold: 8.1,
      message: 'Some message',
    }
    const result = getSocialProofMessage(peerStats, 6.5)
    expect(result.detail).toBe('Cải thiện thêm 1.6 điểm để vào nhóm cao điểm')
  })

  it('returns benchmarkLabel with formatted top_percentile_threshold', () => {
    const peerStats = {
      sample_size: 47,
      avg_improvement: 1.3,
      avg_weekly_exams: 3.2,
      top_percentile_threshold: 8.1,
      message: 'Some message',
    }
    const result = getSocialProofMessage(peerStats, 7.0)
    expect(result.benchmarkLabel).toBe('Top điểm: 8.1')
  })
})

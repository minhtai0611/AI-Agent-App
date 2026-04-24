function getLatestYear(cutoffs) {
  return String(Math.max(...Object.keys(cutoffs).map(Number)))
}

function stddev(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

export function analyzeResult(result, allResults, schools) {
  const { score, topicBreakdown } = result

  // Weak topics: accuracy < 0.6
  const weakTopics = Object.entries(topicBreakdown)
    .filter(([, tb]) => tb.accuracy < 0.6)
    .map(([topic]) => topic)

  // Score prediction
  let predictedScoreRange
  if (allResults.length >= 2) {
    const scores = allResults.map(r => r.score)
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    const sd = stddev(scores)
    predictedScoreRange = [
      Math.max(0, Math.round((mean - sd) * 10) / 10),
      Math.min(10, Math.round((mean + sd) * 10) / 10),
    ]
  } else {
    predictedScoreRange = [
      Math.max(0, Math.round((score - 0.5) * 10) / 10),
      Math.min(10, Math.round((score + 0.5) * 10) / 10),
    ]
  }

  // Percentile estimate from history
  const percentile = allResults.length > 0
    ? Math.round((allResults.filter(r => r.score <= score).length / allResults.length) * 100)
    : 50

  // School matching: use cutoffs[latestYear].math
  const scored = schools
    .map(school => {
      const latestYear = getLatestYear(school.cutoffs)
      const cutoff = school.cutoffs[latestYear]?.math
      if (cutoff == null) return null
      const gap = cutoff - score
      let matchStrength
      if (score >= cutoff - 0.3) matchStrength = 'safety'
      else if (score >= cutoff - 0.6) matchStrength = 'match'
      else matchStrength = 'reach'
      return { school, matchStrength, gap, cutoff }
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))
    .slice(0, 3)

  const recommendations = scored.map(({ school, matchStrength, gap, cutoff }) => ({
    school,
    matchStrength,
    gap: Math.round(gap * 100) / 100,
    cutoff,
  }))

  // Improvement strategy
  const improvementStrategy = []
  if (weakTopics.length > 0) {
    improvementStrategy.push(`Tập trung ôn tập: ${weakTopics.join(', ')}`)
  }
  if (result.accuracy < 0.7) {
    improvementStrategy.push('Luyện tập thêm các bài tập cơ bản để củng cố nền tảng')
  }
  if (result.timeSpent > 0 && result.answeredCount < result.answers ? Object.keys(result.answers).length : 0) {
    improvementStrategy.push('Quản lý thời gian tốt hơn — hãy ưu tiên câu dễ trước')
  }
  improvementStrategy.push('Làm thêm đề thi thử để quen với định dạng câu hỏi')

  return {
    predictedScoreRange,
    percentile,
    weakTopics,
    recommendations,
    improvementStrategy,
  }
}

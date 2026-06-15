// Reuse the same least-squares slope from insights.js
function linearSlope(data) {
  const n = data.length
  const meanX = (n - 1) / 2
  const meanY = data.reduce((s, d) => s + d.score, 0) / n
  let num = 0, den = 0
  for (const d of data) {
    num += (d.i - meanX) * (d.score - meanY)
    den += (d.i - meanX) ** 2
  }
  return den === 0 ? 0 : num / den
}

export function getScoreProjection(sparkData, daysUntil) {
  if (!sparkData || sparkData.length < 3) return null
  if (!daysUntil || daysUntil <= 0) return null

  const slope = linearSlope(sparkData)
  if (slope <= 0.05) return null  // flat or declining — no positive projection

  const currentScore = sparkData[sparkData.length - 1].score
  // Assume roughly 1 exam per 3 days; project exams remaining until exam date
  const examsRemaining = Math.round(daysUntil / 3)
  const projectedScore = Math.min(10, currentScore + slope * examsRemaining)
  const gainNeeded = Math.max(0, +(projectedScore - currentScore).toFixed(1))

  const summary = gainNeeded > 0
    ? `Nếu giữ đà này, bạn có thể đạt ${projectedScore.toFixed(1)} điểm vào ngày thi (tăng ${gainNeeded} điểm).`
    : `Điểm hiện tại ${currentScore.toFixed(1)} — tiếp tục ôn luyện để giữ vững.`

  return {
    projectedScore: +projectedScore.toFixed(1),
    currentScore: +currentScore.toFixed(1),
    gainNeeded,
    summary,
  }
}

/**
 * Simple 2-exam fallback estimate for basic/student tier users.
 * Returns a wide-band prediction after 2+ exams when Kalman is unavailable.
 * @param {number[]} scores - array of exam scores (0-10 scale)
 * @returns {{ predicted: number, low: number, high: number, confidence: string, label: string } | null}
 */
export function getTwoExamEstimate(scores) {
  if (!scores || scores.length < 2) return null
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  const predicted = Math.round(avg * 10) / 10
  return {
    predicted,
    low: Math.max(0, Math.round((avg - 1.5) * 10) / 10),
    high: Math.min(10, Math.round((avg + 1.5) * 10) / 10),
    confidence: 'low',
    label: 'Dự đoán sơ bộ (cần thêm đề để chính xác hơn)',
  }
}

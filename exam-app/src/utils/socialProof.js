/**
 * Given the peer stats response, returns a display-ready object for social proof UI.
 *
 * @param {object|null} peerStats - Response from GET /insights/peer-stats
 * @param {number} userAvgScore - The current user's average exam score
 * @returns {{ headline, detail, benchmarkLabel, isAboveBenchmark } | null}
 */
export function getSocialProofMessage(peerStats, userAvgScore) {
  if (!peerStats) return null
  if (!peerStats.sample_size || peerStats.sample_size < 5) return null
  if (!peerStats.message) return null

  const threshold = peerStats.top_percentile_threshold
  const isAboveBenchmark = userAvgScore >= threshold

  const detail = isAboveBenchmark
    ? 'Bạn đang ở top nhóm cao điểm trong lớp của bạn!'
    : `Cải thiện thêm ${(threshold - userAvgScore).toFixed(1)} điểm để vào nhóm cao điểm`

  return {
    headline: peerStats.message,
    detail,
    benchmarkLabel: `Top điểm: ${threshold.toFixed(1)}`,
    isAboveBenchmark,
  }
}

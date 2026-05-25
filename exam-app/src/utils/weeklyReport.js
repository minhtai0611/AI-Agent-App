export function generateWeeklyReport(results, radarData = null) {
  if (!results || results.length === 0) return null

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recent = results.filter(r => new Date(r.finishedAt).getTime() >= cutoff)
  if (recent.length === 0) return null

  const examCount = recent.length
  const avgScore = (recent.reduce((s, r) => s + (r.score ?? 0), 0) / examCount).toFixed(1)

  const topWeakTopic = radarData && radarData.length > 0
    ? radarData.reduce((min, d) => d.score < min.score ? d : min, radarData[0]).topic
    : null

  let summary = `Tuần này: ${examCount} bài thi, điểm trung bình ${avgScore}.`
  if (topWeakTopic) summary += ` Ưu tiên ôn: ${topWeakTopic}.`

  return { examCount, avgScore, topWeakTopic, summary }
}

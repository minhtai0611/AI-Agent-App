const DAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

export function getSessionPatterns(results) {
  if (!results || results.length < 3) return null

  // Aggregate per day-of-week
  const counts = Array(7).fill(0)
  const scoreSums = Array(7).fill(0)

  for (const r of results) {
    const d = new Date(r.finishedAt).getDay()
    counts[d]++
    scoreSums[d] += r.score ?? 0
  }

  const dayPattern = Array.from({ length: 7 }, (_, i) => ({
    dayIndex: i,
    dayName: DAY_NAMES[i],
    count: counts[i],
    avgScore: counts[i] > 0 ? +(scoreSums[i] / counts[i]).toFixed(1) : null,
  }))

  // Most active day
  const maxCount = Math.max(...counts)
  const mostActiveIdx = counts.indexOf(maxCount)
  const mostActiveDay = dayPattern[mostActiveIdx]

  // Best score day — only days with >= 2 sessions qualify
  const qualified = dayPattern.filter(d => d.count >= 2)
  const bestScoreDay = qualified.length > 0
    ? qualified.reduce((best, d) => d.avgScore > best.avgScore ? d : best, qualified[0])
    : null

  // Build insight
  let insight = `Bạn học tích cực nhất vào ${mostActiveDay.dayName} (${mostActiveDay.count} lần).`
  if (bestScoreDay && bestScoreDay.dayIndex !== mostActiveDay.dayIndex) {
    insight += ` Điểm cao nhất thường vào ${bestScoreDay.dayName} (TB ${bestScoreDay.avgScore}).`
  }

  return {
    dayPattern,
    mostActiveDay,
    bestScoreDay,
    insight,
    totalSessions: results.length,
  }
}

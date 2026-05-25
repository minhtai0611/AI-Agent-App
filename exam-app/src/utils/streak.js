export function computeStreak(results) {
  if (!results || results.length === 0) return 0
  const days = new Set(
    results.map(r => new Date(r.finishedAt).toISOString().slice(0, 10))
  )
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (days.has(key)) {
      streak++
    } else if (i > 0) {
      break
    }
  }
  return streak
}

export function computeStreakPersonalBest(results) {
  if (!results || results.length === 0) return 0
  const days = [...new Set(
    results.map(r => new Date(r.finishedAt).toISOString().slice(0, 10))
  )].sort()

  let best = 1, current = 1
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1])
    const curr = new Date(days[i])
    const diffDays = Math.round((curr - prev) / 86400000)
    if (diffDays === 1) {
      current++
      if (current > best) best = current
    } else {
      current = 1
    }
  }
  return best
}

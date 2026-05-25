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

/**
 * Returns recovery status when a student missed exactly 1 day.
 *
 * @param {string|null} lastExamDate - ISO date string (YYYY-MM-DD or full ISO)
 * @param {number} currentStreak - current streak count
 * @param {number} todayExamCount - number of exams completed today
 * @returns {null|{canRecover: boolean, sessionsNeeded: number, reason: string}}
 */
export function getStreakRecoveryStatus(lastExamDate, currentStreak, todayExamCount) {
  if (!lastExamDate || currentStreak === 0) return null

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const lastStr = lastExamDate.slice(0, 10)
  const last = new Date(lastStr + 'T00:00:00Z')
  const todayDate = new Date(todayStr + 'T00:00:00Z')
  const diffDays = Math.round((todayDate - last) / 86400000)

  const sessionsNeeded = Math.max(0, 2 - todayExamCount)

  if (diffDays === 2) {
    if (todayExamCount >= 2) {
      return {
        canRecover: false,
        sessionsNeeded: 0,
        reason: 'Streak đã được khôi phục!',
      }
    }
    return {
      canRecover: true,
      sessionsNeeded,
      reason: `Bạn vắng 1 ngày — làm thêm ${sessionsNeeded} bài để khôi phục streak!`,
    }
  }

  return {
    canRecover: false,
    sessionsNeeded,
    reason: diffDays === 1 ? 'Không có ngày bị bỏ lỡ.' : 'Đã quá hạn khôi phục streak.',
  }
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

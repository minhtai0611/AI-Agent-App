/**
 * Exam-Day Simulation Mode utility
 * Returns a simulation mode object when the exam is within 14 days.
 */

const BRIEFINGS = {
  max: '3 ngày cuối — chỉ ôn trọng tâm, đừng học thêm mới. Giữ bình tĩnh và tin vào những gì đã ôn.',
  high: 'Còn dưới 1 tuần — tập trung vào dạng bài hay ra nhất, luyện tốc độ làm bài.',
  medium: 'Đang vào giai đoạn nước rút — duy trì ôn tập đều đặn và kiểm tra lại kiến thức nền.',
}

const FOCUS_TIPS = {
  max: 'Mỗi bài thi hôm nay tương đương 10 bài ôn thông thường — chất lượng hơn số lượng.',
  high: 'Ưu tiên làm đề thi thử có thời gian thực để quen với áp lực phòng thi.',
  medium: 'Mỗi ngày ôn ít nhất 1 chủ đề yếu và làm 5–10 câu trắc nghiệm để giữ nhịp.',
}

/**
 * @param {number|null|undefined} daysUntil - days until exam
 * @returns {{ active: true, daysUntil: number, intensity: 'max'|'high'|'medium', briefing: string, focusTip: string } | null}
 */
export function getSimulationMode(daysUntil) {
  if (daysUntil == null || daysUntil > 14 || daysUntil < 0) {
    return null
  }

  let intensity
  if (daysUntil <= 3) {
    intensity = 'max'
  } else if (daysUntil <= 7) {
    intensity = 'high'
  } else {
    intensity = 'medium'
  }

  return {
    active: true,
    daysUntil,
    intensity,
    briefing: BRIEFINGS[intensity],
    focusTip: FOCUS_TIPS[intensity],
  }
}

/**
 * Compute a score confidence interval from recent spark data.
 * @param {Array<{score: number, date: string}>} sparkData
 * @param {number|null} targetScore
 * @returns {{ projectedScore: number, low: number, high: number, onTrack: boolean, confidenceLabel: string } | null}
 */
export function getScoreConfidenceInterval(sparkData, targetScore) {
  if (!sparkData || sparkData.length < 5) return null

  // projectedScore: average of last 3 scores
  const last3 = sparkData.slice(-3)
  const projectedScore = last3.reduce((sum, d) => sum + d.score, 0) / last3.length

  // std dev from all sparkData
  const mean = sparkData.reduce((sum, d) => sum + d.score, 0) / sparkData.length
  const variance = sparkData.reduce((sum, d) => sum + (d.score - mean) ** 2, 0) / sparkData.length
  const stdDev = Math.sqrt(variance)

  const low = Math.max(0, projectedScore - stdDev)
  const high = Math.min(10, projectedScore + stdDev)

  const onTrack = targetScore == null ? true : projectedScore >= targetScore

  let confidenceLabel
  if (stdDev < 0.5) {
    confidenceLabel = 'cao'
  } else if (stdDev < 1.0) {
    confidenceLabel = 'trung bình'
  } else {
    confidenceLabel = 'thấp'
  }

  return { projectedScore, low, high, onTrack, confidenceLabel }
}

const SESSION_COUNTS = { max: 3, high: 2, medium: 1 }
const TIME_PER_SESSION = { max: 45, high: 40, medium: 30 }

/**
 * Compute a daily simulation plan based on intensity and weak topics.
 * @param {{ intensity: 'max'|'high'|'medium', daysUntil: number } | null} simulationMode
 * @param {string[]} weakTopics
 * @returns {{ sessionCount: number, focusTopics: string[], timePerSession: number, todayMessage: string } | null}
 */
export function getDailySimulationPlan(simulationMode, weakTopics) {
  if (!simulationMode) return null

  const { intensity } = simulationMode
  const sessionCount = SESSION_COUNTS[intensity] ?? 1
  const timePerSession = TIME_PER_SESSION[intensity] ?? 30
  const focusTopics = (weakTopics ?? []).slice(0, 2)

  const topicsPart = focusTopics.length > 0
    ? `Tập trung: ${focusTopics.join(', ')}`
    : 'Ôn tập tổng hợp'

  const todayMessage = `Hôm nay: ${sessionCount} buổi · ${timePerSession} phút/buổi · ${topicsPart}`

  return { sessionCount, focusTopics, timePerSession, todayMessage }
}

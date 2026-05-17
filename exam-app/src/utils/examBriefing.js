import { TOPIC_LABELS } from './topicLabels.js'

// Returns { weakTopics: [{topic, accuracy, label}], message: string }
export function buildBriefing(results, exam) {
  if (!results || results.length === 0) return null

  // Aggregate per-topic accuracy across all past results
  const topicStats = {}
  for (const r of results) {
    const breakdown = r.topicBreakdown ?? {}
    for (const [topic, tb] of Object.entries(breakdown)) {
      if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 }
      topicStats[topic].correct += tb.correct ?? 0
      topicStats[topic].total += tb.total ?? 0
    }
  }

  // Find topics with accuracy < 60% and at least 3 questions seen
  const weak = Object.entries(topicStats)
    .filter(([, t]) => t.total >= 3 && t.correct / t.total < 0.6)
    .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))
    .slice(0, 3)
    .map(([topic, t]) => ({
      topic,
      accuracy: Math.round((t.correct / t.total) * 100),
      label: TOPIC_LABELS[topic] ?? topic,
    }))

  if (weak.length === 0) return null

  const topicList = weak.map(w => w.label).join(', ')
  const lowest = weak[0]
  const message = weak.length === 1
    ? `Chú ý chủ đề ${lowest.label} — bạn đang đạt ${lowest.accuracy}% ở đây. Hãy dành thêm thời gian cho những câu này.`
    : `Bạn hay mất điểm ở: ${topicList}. Đặc biệt chú ý ${lowest.label} (${lowest.accuracy}%) — hãy đọc kỹ trước khi chọn.`

  return { weakTopics: weak, message }
}

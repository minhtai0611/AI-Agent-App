import { BADGE_DEFS } from './badges.js'

const DAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

// Fit a linear slope to (i, score) pairs via least-squares.
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

export function interpretScoreTrend(data) {
  if (!data || data.length < 3) return null
  const slope = linearSlope(data)
  const latest = data[data.length - 1].score.toFixed(1)
  if (slope > 0.1) return `Xu hướng tăng (+${slope.toFixed(2)}/đề) — hiện tại ${latest} điểm`
  if (slope < -0.1) return `Xu hướng giảm (${slope.toFixed(2)}/đề) — hiện tại ${latest} điểm`
  return `Điểm ổn định quanh ${latest} điểm`
}

export function interpretTopicRadar(data) {
  if (!data || data.length === 0) return null
  const weakest = data.reduce((min, d) => d.score < min.score ? d : min, data[0])
  return `Chủ đề yếu nhất: ${weakest.topic} (${weakest.score}% độ chính xác) — ưu tiên ôn luyện`
}

export function interpretHeatmap(results) {
  if (!results || results.length < 3) return null
  const counts = Array(7).fill(0)
  for (const r of results) {
    const day = new Date(r.finishedAt).getDay()
    counts[day]++
  }
  const maxDay = counts.indexOf(Math.max(...counts))
  return `Ngày học tích cực nhất: ${DAY_LABELS[maxDay]} (${counts[maxDay]} lần)`
}

export function getTodayFocus(data) {
  if (!data || data.length === 0) return null
  return data.reduce((min, d) => d.score < min.score ? d : min, data[0])
}

export function getNextMilestone(results, earnedBadgeIds) {
  if (!results || results.length === 0) return null

  // Priority order: ten_exams first (most trackable), then others
  const priority = ['ten_exams', 'perfect', 'fast', 'improving']
  const ordered = [
    ...priority.map(id => BADGE_DEFS.find(b => b.id === id)).filter(Boolean),
    ...BADGE_DEFS.filter(b => !priority.includes(b.id)),
  ]

  for (const badge of ordered) {
    if (earnedBadgeIds.has(badge.id)) continue

    if (badge.id === 'ten_exams') {
      const done = results.length
      const total = 10
      const remaining = Math.max(0, total - done)
      return {
        icon: badge.icon,
        label: badge.label,
        progress: `${done}/${total} bài`,
        remaining,
        pct: Math.min(1, done / total),
      }
    }

    if (badge.id === 'perfect') {
      const best = results.reduce((m, r) => Math.max(m, r.score ?? 0), 0)
      return {
        icon: badge.icon,
        label: badge.label,
        progress: `Điểm cao nhất: ${best}`,
        remaining: null,
        pct: Math.min(1, best / 10),
      }
    }

    if (badge.id === 'fast') {
      return {
        icon: badge.icon,
        label: badge.label,
        progress: 'Nộp bài trước 70% thời gian',
        remaining: null,
        pct: 0,
      }
    }

    if (badge.id === 'improving') {
      return {
        icon: badge.icon,
        label: badge.label,
        progress: 'Cải thiện ≥2 điểm trên cùng một đề',
        remaining: null,
        pct: 0,
      }
    }
  }

  return null
}

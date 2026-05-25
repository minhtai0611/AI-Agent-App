const EVENT_DEFS = [
  {
    type: 'first_exam',
    icon: '🎓',
    label: 'Bài thi đầu tiên',
    extract: (sorted) => sorted.length > 0 ? { date: sorted[0].finishedAt } : null,
  },
  {
    type: 'first_high_score',
    icon: '⭐',
    label: 'Điểm 8+ lần đầu',
    extract: (sorted) => {
      const r = sorted.find(r => (r.score ?? 0) >= 8)
      return r ? { date: r.finishedAt, extra: r.score.toFixed(1) } : null
    },
  },
  {
    type: 'perfect_score',
    icon: '🏆',
    label: 'Điểm 10 tuyệt đối',
    extract: (sorted) => {
      const r = sorted.find(r => (r.score ?? 0) >= 10)
      return r ? { date: r.finishedAt } : null
    },
  },
  {
    type: 'milestone_5',
    icon: '🔥',
    label: 'Hoàn thành 5 bài thi',
    extract: (sorted) => sorted.length >= 5 ? { date: sorted[4].finishedAt } : null,
  },
  {
    type: 'milestone_10',
    icon: '💪',
    label: 'Chinh phục 10 bài thi',
    extract: (sorted) => sorted.length >= 10 ? { date: sorted[9].finishedAt } : null,
  },
  {
    type: 'milestone_25',
    icon: '🌟',
    label: '25 bài thi hoàn thành',
    extract: (sorted) => sorted.length >= 25 ? { date: sorted[24].finishedAt } : null,
  },
]

export function getLearnerTimeline(results) {
  if (!results || results.length === 0) return []

  const sorted = [...results].sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt))

  const events = []
  for (const def of EVENT_DEFS) {
    const match = def.extract(sorted)
    if (match) {
      events.push({
        type: def.type,
        icon: def.icon,
        label: def.label,
        date: match.date,
        extra: match.extra ?? null,
      })
    }
  }

  return events.sort((a, b) => new Date(a.date) - new Date(b.date))
}

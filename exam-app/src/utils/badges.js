export const BADGE_DEFS = [
  {
    id: 'perfect',
    icon: '🏆',
    label: 'Điểm hoàn hảo',
    desc: 'Đạt 10 điểm trong một bài thi',
    check: results => results.some(r => (r.score ?? 0) >= 10),
  },
  {
    id: 'ten_exams',
    icon: '🔥',
    label: 'Chinh phục 10 đề',
    desc: 'Hoàn thành 10 bài thi',
    check: results => results.length >= 10,
  },
  {
    id: 'fast',
    icon: '⚡',
    label: 'Tốc độ ánh sáng',
    desc: 'Nộp bài trước khi hết 70% thời gian',
    check: results => results.some(r => {
      const dur = r.exam?.duration ?? r.examDuration
      if (!dur) return false
      const used = r.timeSpent ?? 0
      return used < dur * 60 * 0.7
    }),
  },
  {
    id: 'improving',
    icon: '📈',
    label: 'Tiến bộ vượt bậc',
    desc: 'Cải thiện ≥2 điểm so với lần trước trên cùng một đề',
    check: results => {
      const byExam = {}
      for (const r of [...results].sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt))) {
        const id = r.examId
        if (!id) continue
        if (byExam[id] != null && (r.score ?? 0) - byExam[id] >= 2) return true
        byExam[id] = r.score ?? 0
      }
      return false
    },
  },
]

export function computeBadges(results) {
  if (!results || results.length === 0) return []
  return BADGE_DEFS.filter(b => b.check(results))
}

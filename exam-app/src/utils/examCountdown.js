import examDates from '../data/exam_dates.json'

export function getDaysUntilExam(province) {
  if (!province) return null
  const dateStr = examDates[province]
  if (!dateStr) return null
  const target = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  const diff = Math.ceil((target - today) / 86400000)
  return diff > 0 ? diff : null
}

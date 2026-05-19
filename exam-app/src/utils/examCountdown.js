import examDates from '../data/exam_dates.json'

// Returns the upcoming exam year: after September → next year; before September → this year.
export function getExamYear() {
  const now = new Date()
  return now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear()
}

export function getDaysUntilExam(province) {
  if (!province) return null
  const mmdd = examDates[province]
  if (!mmdd) return null
  const year = getExamYear()
  const [month, day] = mmdd.split('-').map(Number)
  const target = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  const diff = Math.ceil((target - today) / 86400000)
  return diff > 0 ? diff : null
}

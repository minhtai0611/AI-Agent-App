export const ARCHETYPES = [
  {
    id: 'expert',
    icon: '🎯',
    label: 'Chuyên gia Chuyên sâu',
    desc: 'Ít đề nhưng điểm rất cao — bạn ưu tiên chất lượng hơn số lượng.',
  },
  {
    id: 'consistent',
    icon: '🔄',
    label: 'Người học Đều đặn',
    desc: 'Ôn luyện đều đặn mỗi ngày — sức mạnh của bạn là tính kiên trì.',
  },
  {
    id: 'explorer',
    icon: '🗺️',
    label: 'Người chinh phục Tổng hợp',
    desc: 'Nhiều đề, nhiều chủ đề — bạn xây dựng nền tảng kiến thức rộng.',
  },
  {
    id: 'sprinter',
    icon: '⚡',
    label: 'Người học Bứt phá',
    desc: 'Điểm số lên xuống mạnh — bạn có tiềm năng lớn, hãy ổn định hơn.',
  },
]

function stdDev(scores) {
  if (scores.length < 2) return 0
  const mean = scores.reduce((s, x) => s + x, 0) / scores.length
  return Math.sqrt(scores.reduce((s, x) => s + (x - mean) ** 2, 0) / scores.length)
}

export function classifyLearner(results) {
  if (!results || results.length < 3) return null

  const scores = results.map(r => r.score ?? 0)
  const avg = scores.reduce((s, x) => s + x, 0) / scores.length
  const variance = stdDev(scores)
  const n = results.length
  const uniqueExams = new Set(results.map(r => r.examId).filter(Boolean)).size

  // Expert: few exams, very high avg score
  if (n < 10 && avg >= 8.5) return ARCHETYPES.find(a => a.id === 'expert')

  // Explorer: many exams with high breadth (unique examIds ≥ 75% of total)
  if (n >= 15 && uniqueExams / n >= 0.75) return ARCHETYPES.find(a => a.id === 'explorer')

  // Consistent: many sessions, low score variance
  if (n >= 10 && variance < 1.0) return ARCHETYPES.find(a => a.id === 'consistent')

  // Sprinter: high variance
  if (variance >= 1.5) return ARCHETYPES.find(a => a.id === 'sprinter')

  // Default fallback — consistent (most aspirational positive framing)
  return ARCHETYPES.find(a => a.id === 'consistent')
}

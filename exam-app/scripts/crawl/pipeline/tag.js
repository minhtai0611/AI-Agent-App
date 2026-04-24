const TOPIC_KEYWORDS = {
  algebra:       ['phương trình', 'bất phương trình', 'hàm số', 'đa thức', 'hệ phương trình', 'căn thức'],
  geometry:      ['tam giác', 'hình tròn', 'đường thẳng', 'góc', 'diện tích', 'chu vi', 'tiếp tuyến'],
  statistics:    ['xác suất', 'thống kê', 'tần số', 'trung bình cộng', 'biểu đồ'],
  combinatorics: ['tổ hợp', 'chỉnh hợp', 'hoán vị', 'nhị thức Newton', 'quy tắc đếm'],
}

function detectTopic(question) {
  const text = question.toLowerCase()
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) return topic
  }
  return 'algebra'
}

function detectDifficulty(index, total) {
  const pct = index / total
  if (pct < 10 / 30) return 'easy'
  if (pct < 25 / 30) return 'medium'
  return 'hard'
}

export function tag(questions) {
  const byYear = {}
  for (const q of questions) {
    if (!byYear[q.year]) byYear[q.year] = []
    byYear[q.year].push(q)
  }
  const result = []
  for (const group of Object.values(byYear)) {
    group.forEach((q, i) => {
      result.push({
        ...q,
        topic: q.topic !== 'algebra' ? q.topic : detectTopic(q.question),
        difficulty: q.difficulty || detectDifficulty(i, group.length),
      })
    })
  }
  return result
}

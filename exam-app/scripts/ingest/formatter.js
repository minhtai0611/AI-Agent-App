const LETTERS = ['A', 'B', 'C', 'D']

export function formatQuestion(q, n) {
  const lines = [`Câu ${n}. ${q.question}`]
  if (Array.isArray(q.choices)) {
    q.choices.forEach((c, i) => lines.push(`${LETTERS[i]}. ${c}`))
  }
  const answerLetter = typeof q.correct === 'number' ? LETTERS[q.correct] : (q.correct ?? 'A')
  lines.push(`Đáp án: ${answerLetter}`)
  if (q.explanation) lines.push(q.explanation)
  return lines.join('\n')
}

export function chunkQuestions(questions, size = 15) {
  const chunks = []
  for (let i = 0; i < questions.length; i += size) {
    const slice = questions.slice(i, i + size)
    chunks.push(slice.map((q, j) => formatQuestion(q, i + j + 1)).join('\n\n'))
  }
  return chunks
}

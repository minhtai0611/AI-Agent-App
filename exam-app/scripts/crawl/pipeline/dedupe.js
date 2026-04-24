import { createHash } from 'crypto'

function hashQuestion(q) {
  return createHash('md5').update(q.question.trim().toLowerCase()).digest('hex')
}

export function dedupe(questions) {
  const seen = new Set()
  const result = []
  for (const q of questions) {
    const h = hashQuestion(q)
    if (!seen.has(h)) {
      seen.add(h)
      result.push(q)
    }
  }
  return result
}

import { createHash } from 'crypto'

function hashQuestion(q) {
  return createHash('md5').update(q.question.trim().toLowerCase()).digest('hex')
}

function normalizeText(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').trim()
}

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
    }
  }
  return dp[m][n]
}

export function dedupe(questions) {
  // Pass 1: exact MD5 dedup
  const seen = new Set()
  let exactRemoved = 0
  const afterExact = []
  for (const q of questions) {
    const h = hashQuestion(q)
    if (!seen.has(h)) {
      seen.add(h)
      afterExact.push(q)
    } else {
      exactRemoved++
    }
  }

  // Pass 2: fuzzy Levenshtein dedup (edit distance < 8% of longer string length)
  const normalized = afterExact.map(q => normalizeText(q.question))
  const keep = new Array(afterExact.length).fill(true)
  let fuzzyRemoved = 0
  for (let i = 0; i < afterExact.length; i++) {
    if (!keep[i]) continue
    for (let j = i + 1; j < afterExact.length; j++) {
      if (!keep[j]) continue
      const maxLen = Math.max(normalized[i].length, normalized[j].length)
      if (maxLen === 0) continue
      const dist = levenshtein(normalized[i], normalized[j])
      if (dist / maxLen < 0.08) {
        // Keep the one with a non-null explanation
        if (afterExact[i].explanation && !afterExact[j].explanation) {
          keep[j] = false
        } else {
          keep[i] = false
        }
        fuzzyRemoved++
        break
      }
    }
  }

  const result = afterExact.filter((_, i) => keep[i])
  console.log(`  dedupe: ${exactRemoved} exact + ${fuzzyRemoved} fuzzy duplicates removed → ${result.length} kept`)
  return result
}

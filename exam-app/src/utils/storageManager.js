const MAX_BYTES = 3 * 1024 * 1024 // 3 MB soft cap

const PRUNE_RULES = [
  { prefix: 'ai-analysis-', maxAge: 7 * 24 * 60 * 60 * 1000 },   // 7 days
  { prefix: 'study-plan-data-', maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
  { prefix: 'study-plan-quiz-', maxAge: 30 * 24 * 60 * 60 * 1000 },
]

function estimateBytes() {
  let total = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i) ?? ''
    total += key.length + (localStorage.getItem(key)?.length ?? 0)
  }
  return total * 2 // UTF-16 approximation
}

export function pruneStorage() {
  const now = Date.now()
  // Pass 1: evict entries older than their TTL
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (!key) continue
    const rule = PRUNE_RULES.find(r => key.startsWith(r.prefix))
    if (!rule) continue
    try {
      const entry = JSON.parse(localStorage.getItem(key) ?? '{}')
      if (entry.ts && now - entry.ts > rule.maxAge) localStorage.removeItem(key)
    } catch {
      localStorage.removeItem(key)
    }
  }
  // Pass 2: if still over cap, evict oldest ai-analysis-* entries first
  if (estimateBytes() > MAX_BYTES) {
    const candidates = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('ai-analysis-')) continue
      try {
        const ts = JSON.parse(localStorage.getItem(key) ?? '{}').ts ?? 0
        candidates.push({ key, ts })
      } catch {
        candidates.push({ key, ts: 0 })
      }
    }
    candidates.sort((a, b) => a.ts - b.ts)
    for (const { key } of candidates) {
      localStorage.removeItem(key)
      if (estimateBytes() <= MAX_BYTES) break
    }
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    pruneStorage()
    try { localStorage.setItem(key, value) } catch { /* quota still exceeded — silently skip */ }
  }
}

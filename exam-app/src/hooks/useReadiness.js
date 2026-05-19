import { useMemo } from 'react'

export function useReadiness(results, questionMap) {
  return useMemo(() => {
    if (!results.length || !Object.keys(questionMap).length) return null
    const cutoff = Date.now() - 30 * 86400000
    const recent = results.filter(r => new Date(r.timestamp).getTime() >= cutoff)
    if (!recent.length) return null

    let correct = 0, total = 0
    for (const r of recent) {
      for (const [qId, chosen] of Object.entries(r.answers ?? {})) {
        const q = questionMap[qId]
        if (!q) continue
        total++
        if (chosen === q.correct) correct++
      }
    }
    if (!total) return null

    const accuracy = correct / total
    const sessionDays = new Set(recent.map(r => r.timestamp?.slice(0, 10))).size
    const consistency = Math.min(1, sessionDays / 20)
    const readiness = Math.round((accuracy * 0.7 + consistency * 0.3) * 100)
    return {
      readiness,
      accuracy: Math.round(accuracy * 100),
      consistency: Math.round(consistency * 100),
    }
  }, [results, questionMap])
}

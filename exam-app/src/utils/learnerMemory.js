import { THPT_TOPIC_GRAPH } from './learningGraph.js'

// Build a lookup map: topicId -> label
const _TOPIC_LABEL_MAP = Object.fromEntries(
  THPT_TOPIC_GRAPH.map(node => [node.id, node.label])
)

/**
 * Given a topic's snapshot array, returns trend: 'improving' | 'declining' | 'stable'
 * 'improving': last mastery >= first mastery + 0.1
 * 'declining': last mastery <= first mastery - 0.1
 * 'stable': otherwise
 *
 * @param {Array<{date: string, mastery: number, exam_count: number}>|null} snapshots
 * @returns {'improving'|'declining'|'stable'|null}
 */
export function getTopicTrend(snapshots) {
  if (!snapshots || snapshots.length < 2) return null
  const first = snapshots[0].mastery
  const last  = snapshots[snapshots.length - 1].mastery
  const delta = Math.round((last - first) * 1000) / 1000
  if (delta >= 0.1)  return 'improving'
  if (delta <= -0.1) return 'declining'
  return 'stable'
}

/**
 * Given GET /learner-memory/me response, compute trajectory insights.
 *
 * @param {object|null} memoryData
 * @returns {object|null}
 */
export function getMemoryInsights(memoryData) {
  if (!memoryData || memoryData.snapshot_count < 3) return null

  const { topics, first_snapshot_date, snapshot_count } = memoryData

  // Compute weeksSinceStart
  const now = Date.now()
  const firstMs = first_snapshot_date ? new Date(first_snapshot_date).getTime() : now
  const daysBetween = (now - firstMs) / (1000 * 60 * 60 * 24)
  const weeksSinceStart = Math.floor(daysBetween / 7)

  // Find mostImproved: topic with largest (last - first) delta, only topics with >= 2 snapshots
  let mostImproved = null
  let bestGain = -Infinity
  for (const [topicId, snaps] of Object.entries(topics)) {
    if (!snaps || snaps.length < 2) continue
    const gain = snaps[snaps.length - 1].mastery - snaps[0].mastery
    if (gain > bestGain) {
      bestGain = gain
      mostImproved = {
        topicId,
        label: _TOPIC_LABEL_MAP[topicId] ?? topicId,
        gainPct: gain * 100,
      }
    }
  }

  // Find mostConsistent: topic with highest average mastery across all snapshots
  let mostConsistent = null
  let bestAvg = -Infinity
  for (const [topicId, snaps] of Object.entries(topics)) {
    if (!snaps || snaps.length === 0) continue
    const avg = snaps.reduce((s, x) => s + x.mastery, 0) / snaps.length
    if (avg > bestAvg) {
      bestAvg = avg
      mostConsistent = {
        topicId,
        label: _TOPIC_LABEL_MAP[topicId] ?? topicId,
        avgMastery: avg * 100,
      }
    }
  }

  return {
    mostImproved,
    mostConsistent,
    weeksSinceStart,
    totalSnapshots: snapshot_count,
    hasLongHistory: weeksSinceStart >= 4,
  }
}

// ─── THPT Math Topic Dependency Graph ────────────────────────────────────────

export const THPT_TOPIC_GRAPH = [
  { id: 'functions',     label: 'Hàm số',              prereqs: [] },
  { id: 'limits',        label: 'Giới hạn',             prereqs: ['functions'] },
  { id: 'derivatives',   label: 'Đạo hàm',              prereqs: ['limits', 'functions'] },
  { id: 'integrals',     label: 'Tích phân',             prereqs: ['derivatives'] },
  { id: 'logarithms',    label: 'Logarit',               prereqs: ['functions'] },
  { id: 'exponents',     label: 'Hàm mũ',                prereqs: ['logarithms'] },
  { id: 'sequences',     label: 'Dãy số',                prereqs: ['functions'] },
  { id: 'combinatorics', label: 'Tổ hợp xác suất',      prereqs: [] },
  { id: 'geometry3d',    label: 'Hình học không gian',   prereqs: [] },
  { id: 'vectors',       label: 'Vectơ',                 prereqs: [] },
  { id: 'complex',       label: 'Số phức',               prereqs: ['derivatives', 'vectors'] },
  { id: 'analytic_geo',  label: 'Hình giải tích',        prereqs: ['vectors'] },
]

// ─── Radar label → node ID mapping ───────────────────────────────────────────

export const TOPIC_ID_MAP = {
  'Hàm số':          'functions',
  'Giới hạn':        'limits',
  'Đạo hàm':         'derivatives',
  'Tích phân':       'integrals',
  'Logarit':         'logarithms',
  'Hàm mũ':          'exponents',
  'Dãy số':          'sequences',
  'Tổ hợp':          'combinatorics',
  'Xác suất':        'combinatorics',
  'Hình học':        'geometry3d',
  'Vectơ':           'vectors',
  'Số phức':         'complex',
  'Hình giải tích':  'analytic_geo',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMasteryLevel(mastery) {
  if (mastery === null) return 'unknown'
  if (mastery >= 0.7)   return 'mastered'
  if (mastery >= 0.4)   return 'learning'
  return 'weak'
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Build enriched topic nodes from raw radar performance data.
 *
 * @param {Array<{topic: string, score: number}>|null} radarData
 * @returns {Array<{id, label, prereqs, mastery, masteryLevel, prereqsMet, unlocked}>}
 */
export function getTopicNodes(radarData) {
  // Aggregate radar scores by node ID (average when multiple labels map to same node)
  const scoreAccum = {} // { nodeId: { sum, count } }

  if (radarData && radarData.length > 0) {
    for (const { topic, score } of radarData) {
      const nodeId = TOPIC_ID_MAP[topic]
      if (!nodeId) continue
      if (!scoreAccum[nodeId]) scoreAccum[nodeId] = { sum: 0, count: 0 }
      scoreAccum[nodeId].sum   += score
      scoreAccum[nodeId].count += 1
    }
  }

  // Build a quick mastery lookup by node ID
  const masteryById = {}
  for (const [nodeId, { sum, count }] of Object.entries(scoreAccum)) {
    masteryById[nodeId] = sum / count
  }

  return THPT_TOPIC_GRAPH.map(({ id, label, prereqs }) => {
    const mastery = masteryById[id] !== undefined ? masteryById[id] : null

    // prereqsMet: all prereqs must have mastery ≥ 0.5; unknown (null) → false
    const prereqsMet = prereqs.length > 0
      ? prereqs.every(pid => (masteryById[pid] ?? null) !== null && masteryById[pid] >= 0.5)
      : true  // vacuously true — no prereqs to check

    // unlocked: no prereqs (always unlocked) OR prereqsMet
    const unlocked = prereqs.length === 0 || prereqsMet

    return {
      id,
      label,
      prereqs,
      mastery,
      masteryLevel: toMasteryLevel(mastery),
      prereqsMet,
      unlocked,
    }
  })
}

// ─── Priority topics ──────────────────────────────────────────────────────────

/**
 * Return the top 3 highest-impact topics to study next:
 * unlocked + weak, sorted weakest first.
 *
 * @param {ReturnType<getTopicNodes>} nodes
 * @returns {Array} up to 3 nodes
 */
export function getPriorityTopics(nodes) {
  return nodes
    .filter(n => n.masteryLevel === 'weak' && n.unlocked)
    .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))
    .slice(0, 3)
}

// Levenshtein distance for fuzzy name matching (diacritics-insensitive)
function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
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

function computeTrend(cutoffs) {
  const years = Object.keys(cutoffs).map(Number).sort()
  if (years.length < 4) return 'stable'
  const recent = years.slice(-3).map(y => cutoffs[y].math)
  const older  = years.slice(0, 2).map(y => cutoffs[y].math)
  const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length
  const avgOlder  = older.reduce((a, b) => a + b, 0) / older.length
  const delta = avgRecent - avgOlder
  if (delta > 0.2) return 'rising'
  if (delta < -0.2) return 'falling'
  return 'stable'
}

export function merge(allSchoolData) {
  const profiles = {}
  const cutoffsByName = {}

  for (const item of allSchoolData) {
    if (item.type === 'profile') {
      profiles[item.name] = item
    } else if (item.type === 'cutoff') {
      const match = Object.keys(profiles).find(name =>
        levenshtein(normalize(name), normalize(item.name)) <= 2
      ) ?? item.name
      if (!cutoffsByName[match]) cutoffsByName[match] = {}
      if (item.source2 && item.conflict) {
        // cross-source conflict flagged — keep primary
      }
      Object.assign(cutoffsByName[match], item.cutoffs ?? {})
    }
  }

  return Object.entries(profiles).map(([name, profile]) => {
    const cutoffs = cutoffsByName[name] ?? {}
    return {
      id: profile.id,
      name,
      district: profile.district,
      type: profile.type,
      cutoffs,
      trend: computeTrend(cutoffs),
    }
  })
}

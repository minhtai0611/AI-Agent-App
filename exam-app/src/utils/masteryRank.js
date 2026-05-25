export const MASTERY_TIERS = [
  { id: 'Pemula',    label: 'Tân học viên',      icon: '🌱', minSolid: 0  },
  { id: 'Học sinh',  label: 'Học sinh Tiến bộ',  icon: '📚', minSolid: 16 },
  { id: 'Sinh viên', label: 'Chiến sĩ Tri thức', icon: '⚔️', minSolid: 36 },
  { id: 'Chuyên gia',label: 'Ngôi sao Zenith',   icon: '⭐', minSolid: 56 },
]

export function getMasteryProgress(rank, solidCount) {
  const idx = MASTERY_TIERS.findIndex(t => t.id === rank)
  const current = MASTERY_TIERS[idx] ?? MASTERY_TIERS[0]
  const next = MASTERY_TIERS[idx + 1] ?? null

  if (!next) {
    return { current, next: null, pct: 1, needed: 0 }
  }

  const bandStart = current.minSolid
  const bandEnd   = next.minSolid
  const pct = Math.min(1, Math.max(0, (solidCount - bandStart) / (bandEnd - bandStart)))
  const needed = Math.max(0, bandEnd - solidCount)

  return { current, next, pct, needed }
}

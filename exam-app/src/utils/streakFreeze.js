/**
 * Streak Freeze utility — Sprint 15
 *
 * Returns freeze info for a user:
 *   { balance, weeklyQuota, canFreeze, lockedReason }
 *
 * Tier quotas:
 *   basic    → 0 freezes/week (feature locked)
 *   student  → 1 freeze/week
 *   complete → 3 freezes/week
 */

const WEEKLY_QUOTA = {
  basic:    0,
  student:  1,
  complete: 3,
}

/**
 * @param {{ subscription_tier?: string, streak_freeze_count?: number }} user
 * @returns {{ balance: number, weeklyQuota: number, canFreeze: boolean, lockedReason: string|null }}
 */
export function getStreakFreezeInfo(user = {}) {
  const tier = user.subscription_tier ?? 'basic'
  const balance = user.streak_freeze_count ?? 0
  const weeklyQuota = WEEKLY_QUOTA[tier] ?? 0

  if (tier === 'basic') {
    return { balance, weeklyQuota, canFreeze: false, lockedReason: 'upgrade' }
  }

  if (balance <= 0) {
    return { balance, weeklyQuota, canFreeze: false, lockedReason: 'empty' }
  }

  return { balance, weeklyQuota, canFreeze: true, lockedReason: null }
}

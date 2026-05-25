// ─── Account tab routing ──────────────────────────────────────────────────────

export const TAB_PROGRESS  = 'progress'
export const TAB_ANALYTICS = 'analytics'
export const TAB_AITIA     = 'aitia'
export const TAB_SETTINGS  = 'settings'

// Returns the initial active tab key based on the URL hash.
// '#topup' deep-links directly to the AI & Tia tab.
export function getInitialTab(hash) {
  if (hash === '#topup') return TAB_AITIA
  return TAB_PROGRESS
}

// ─── Credit display ───────────────────────────────────────────────────────────

// Average credit cost per AI interaction: hint=1, explain=1, analyze=3 → avg ~2.
// Returns a human-readable estimate of remaining AI sessions.
export function formatCreditSessions(balance) {
  if (!balance || balance <= 0) return '0 lượt AI'
  const sessions = Math.max(1, Math.floor(balance / 2))
  return `~${sessions} lượt AI`
}

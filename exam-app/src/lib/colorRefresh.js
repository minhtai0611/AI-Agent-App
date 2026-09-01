// Shared pub/sub behind window.VTG_REFRESH_COLORS — introduced when a second
// canvas (the /probability sand-dune stage) needed to react to theme changes
// alongside BgField. Both register here instead of each overwriting the same
// global slot; useTheme.js keeps calling window.VTG_REFRESH_COLORS() as before.
const listeners = new Set()

function republish() {
  if (typeof window === 'undefined') return
  window.VTG_REFRESH_COLORS = listeners.size ? () => listeners.forEach((fn) => fn()) : undefined
}

export function registerColorRefresh(fn) {
  listeners.add(fn)
  republish()
  return () => {
    listeners.delete(fn)
    republish()
  }
}

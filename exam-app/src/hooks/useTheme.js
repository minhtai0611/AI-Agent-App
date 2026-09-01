import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'vantage-theme'

function readInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // sandboxed environments can throw on localStorage access
  }
  if (typeof document !== 'undefined' && document.documentElement.dataset.theme) {
    return document.documentElement.dataset.theme
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Mirrors the FOUC-prevention inline script in index.html — same storage key,
// same data-theme/.dark class targets, so first paint and post-hydration state
// never disagree. Calls window.VTG_REFRESH_COLORS() (registered by BgField) so
// the ambient canvas re-samples tokens instead of waiting for a reload.
export function useTheme() {
  const [theme, setTheme] = useState(readInitialTheme)

  const applyTheme = useCallback((next) => {
    document.documentElement.dataset.theme = next
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore storage errors
    }
    window.VTG_REFRESH_COLORS?.()
    setTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    applyTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, applyTheme])

  useEffect(() => {
    applyTheme(theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { theme, toggleTheme }
}

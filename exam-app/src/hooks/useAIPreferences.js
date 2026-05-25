import { useState, useCallback } from 'react'
import { loadPreferences, savePreferences, isCustomized } from '../utils/aiPreferences.js'

export function useAIPreferences() {
  const [preferences, setPreferencesState] = useState(() => loadPreferences())

  const setPreferences = useCallback((next) => {
    savePreferences(next)
    setPreferencesState(next)
  }, [])

  return {
    preferences,
    setPreferences,
    isCustomized: isCustomized(preferences),
  }
}

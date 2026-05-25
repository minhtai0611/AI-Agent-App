import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  isCustomized,
  preferencesToPromptContext,
  STORAGE_KEY,
} from '../aiPreferences.js'

// Minimal localStorage-compatible fake store for Node tests
function makeStore() {
  const data = {}
  return {
    getItem: k => data[k] ?? null,
    setItem: (k, v) => { data[k] = v },
    removeItem: k => { delete data[k] },
    clear: () => { for (const k in data) delete data[k] },
  }
}

let store
beforeEach(() => { store = makeStore() })

describe('DEFAULT_PREFERENCES', () => {
  it('has the required preference keys', () => {
    expect(DEFAULT_PREFERENCES).toHaveProperty('hint_style')
    expect(DEFAULT_PREFERENCES).toHaveProperty('explanation_depth')
    expect(DEFAULT_PREFERENCES).toHaveProperty('language_mix')
    expect(DEFAULT_PREFERENCES).toHaveProperty('weak_topic_focus')
  })

  it('hint_style default is socratic', () => {
    expect(DEFAULT_PREFERENCES.hint_style).toBe('socratic')
  })

  it('explanation_depth default is detailed', () => {
    expect(DEFAULT_PREFERENCES.explanation_depth).toBe('detailed')
  })

  it('language_mix default is vietnamese-only', () => {
    expect(DEFAULT_PREFERENCES.language_mix).toBe('vietnamese-only')
  })

  it('weak_topic_focus default is true', () => {
    expect(DEFAULT_PREFERENCES.weak_topic_focus).toBe(true)
  })
})

describe('loadPreferences', () => {
  it('returns DEFAULT_PREFERENCES when store is empty', () => {
    expect(loadPreferences(store)).toEqual(DEFAULT_PREFERENCES)
  })

  it('returns saved preferences merged with defaults', () => {
    store.setItem(STORAGE_KEY, JSON.stringify({ hint_style: 'direct' }))
    const prefs = loadPreferences(store)
    expect(prefs.hint_style).toBe('direct')
    expect(prefs.explanation_depth).toBe(DEFAULT_PREFERENCES.explanation_depth)
  })

  it('returns defaults on invalid JSON', () => {
    store.setItem(STORAGE_KEY, 'not-json')
    expect(loadPreferences(store)).toEqual(DEFAULT_PREFERENCES)
  })
})

describe('savePreferences', () => {
  it('persists preferences to the store', () => {
    savePreferences({ ...DEFAULT_PREFERENCES, hint_style: 'visual' }, store)
    const raw = JSON.parse(store.getItem(STORAGE_KEY))
    expect(raw.hint_style).toBe('visual')
  })

  it('round-trips: save then load returns same object', () => {
    const prefs = { ...DEFAULT_PREFERENCES, explanation_depth: 'step-by-step', language_mix: 'mixed' }
    savePreferences(prefs, store)
    expect(loadPreferences(store)).toEqual(prefs)
  })
})

describe('isCustomized', () => {
  it('returns false for DEFAULT_PREFERENCES', () => {
    expect(isCustomized(DEFAULT_PREFERENCES)).toBe(false)
  })

  it('returns true when any pref differs from default', () => {
    expect(isCustomized({ ...DEFAULT_PREFERENCES, hint_style: 'direct' })).toBe(true)
    expect(isCustomized({ ...DEFAULT_PREFERENCES, weak_topic_focus: false })).toBe(true)
  })
})

describe('preferencesToPromptContext', () => {
  it('returns a string for any preferences', () => {
    expect(typeof preferencesToPromptContext(DEFAULT_PREFERENCES)).toBe('string')
  })

  it('returns empty string for default preferences', () => {
    expect(preferencesToPromptContext(DEFAULT_PREFERENCES)).toBe('')
  })

  it('reflects hint_style direct in the output', () => {
    const ctx = preferencesToPromptContext({ ...DEFAULT_PREFERENCES, hint_style: 'direct' })
    expect(ctx.toLowerCase()).toContain('direct')
  })

  it('reflects explanation_depth step-by-step in the output', () => {
    const ctx = preferencesToPromptContext({ ...DEFAULT_PREFERENCES, explanation_depth: 'step-by-step' })
    expect(ctx).toContain('step-by-step')
  })

  it('reflects language_mix mixed in the output', () => {
    const ctx = preferencesToPromptContext({ ...DEFAULT_PREFERENCES, language_mix: 'mixed' })
    expect(ctx.toLowerCase()).toMatch(/mixed|english/)
  })

  it('includes bracketed prefix when customized', () => {
    const ctx = preferencesToPromptContext({ ...DEFAULT_PREFERENCES, hint_style: 'direct' })
    expect(ctx).toContain('[')
  })
})

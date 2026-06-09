import { describe, it, expect } from 'vitest'
import { cn } from '../utils.js'

describe('cn', () => {
  it('merges class strings', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('resolves Tailwind conflicts — last class wins', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('ignores falsy values', () => {
    expect(cn('text-sm', false, null, undefined, 'font-bold')).toBe('text-sm font-bold')
  })

  it('handles conditional object syntax', () => {
    expect(cn({ 'bg-primary': true, 'bg-surface': false })).toBe('bg-primary')
  })

  it('returns empty string with no args', () => {
    expect(cn()).toBe('')
  })
})

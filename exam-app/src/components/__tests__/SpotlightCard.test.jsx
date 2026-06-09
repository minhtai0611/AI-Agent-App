import { describe, it, expect } from 'vitest'
import { SpotlightCard } from '../SpotlightCard.jsx'

describe('SpotlightCard', () => {
  it('exports SpotlightCard as a function', () => {
    expect(typeof SpotlightCard).toBe('function')
  })

  it('is a named function with one props parameter', () => {
    expect(SpotlightCard.name).toBe('SpotlightCard')
    expect(SpotlightCard.length).toBe(1)
  })
})

import { describe, it, expect } from 'vitest'
import { GradientBorderCard } from '../GradientBorderCard.jsx'

describe('GradientBorderCard', () => {
  it('exports GradientBorderCard as a function', () => {
    expect(typeof GradientBorderCard).toBe('function')
  })

  it('has the expected name', () => {
    expect(GradientBorderCard.name).toBe('GradientBorderCard')
  })
})

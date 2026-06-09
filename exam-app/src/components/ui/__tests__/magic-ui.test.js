import { describe, it, expect } from 'vitest'

describe('BorderBeam', () => {
  it('exports BorderBeam as a function', async () => {
    const { BorderBeam } = await import('../border-beam.jsx')
    expect(typeof BorderBeam).toBe('function')
    expect(BorderBeam.name).toBe('BorderBeam')
  })
})

describe('NumberTicker', () => {
  it('exports NumberTicker as a function', async () => {
    const { NumberTicker } = await import('../number-ticker.jsx')
    expect(typeof NumberTicker).toBe('function')
    expect(NumberTicker.name).toBe('NumberTicker')
  })
})

describe('AnimatedShinyText', () => {
  it('exports AnimatedShinyText as a function', async () => {
    const { AnimatedShinyText } = await import('../animated-shiny-text.jsx')
    expect(typeof AnimatedShinyText).toBe('function')
    expect(AnimatedShinyText.name).toBe('AnimatedShinyText')
  })
})

describe('ShimmerButton', () => {
  it('exports ShimmerButton as a function', async () => {
    const { ShimmerButton } = await import('../shimmer-button.jsx')
    expect(typeof ShimmerButton).toBe('function')
    expect(ShimmerButton.name).toBe('ShimmerButton')
  })
})

import { describe, it, expect } from 'vitest'
import { AuroraBackground } from '../AuroraBackground.jsx'

describe('AuroraBackground', () => {
  it('exports AuroraBackground as a function', () => {
    expect(typeof AuroraBackground).toBe('function')
  })

  it('has the expected name', () => {
    expect(AuroraBackground.name).toBe('AuroraBackground')
  })

  it('is a named function with one props parameter', () => {
    expect(AuroraBackground.name).toBe('AuroraBackground')
    expect(AuroraBackground.length).toBe(1)
  })

  it('module source does not use dynamic animation template literals (GR-3)', async () => {
    // Read the source file to verify static animate class names
    const fs = await import('node:fs')
    const src = fs.readFileSync(
      new URL('../AuroraBackground.jsx', import.meta.url).pathname,
      'utf8'
    )
    expect(src).toContain('ambient-float-0')
    expect(src).not.toContain('`animate-[ambient-float-${')
  })
})

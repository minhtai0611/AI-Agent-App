import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const src = readFileSync(resolve(__dirname, '../Results.jsx'), 'utf8')

describe('Results premium UI (Task #10)', () => {
  it('imports NumberTicker', () => {
    expect(src).toMatch(/import.*NumberTicker.*from/)
  })

  it('imports SpotlightCard', () => {
    expect(src).toMatch(/import.*SpotlightCard.*from/)
  })

  it('applies score-circle class to the SVG for pulse animation', () => {
    expect(src).toContain('score-circle')
  })

  it('uses NumberTicker instead of CountUp for score display', () => {
    expect(src).toContain('NumberTicker')
  })

  it('applies glass-base to the score hero card', () => {
    expect(src).toContain('glass-base')
  })

  it('applies glass-brand to the personal best banner', () => {
    expect(src).toContain('glass-brand')
  })

  it('replaces hardcoded bg-[#0D1526] percentile banner', () => {
    expect(src).not.toContain('bg-[#0D1526]')
  })

  it('replaces hardcoded bg-[#1A1200] personal-best banner', () => {
    expect(src).not.toContain('bg-[#1A1200]')
  })

  it('replaces hardcoded bg-[#1A0D00] score-drop banner', () => {
    expect(src).not.toContain('bg-[#1A0D00]')
  })

  it('replaces hardcoded bg-[#0D1221] sparkline/challenger panels', () => {
    expect(src).not.toContain("background: '#0D1221'")
    expect(src).not.toContain("bg-[#0D1221]")
  })

  it('replaces hardcoded bg-[#0A1020] school cards', () => {
    expect(src).not.toContain('bg-[#0A1020]')
  })

  it('replaces hardcoded bg-[#0D1521] predicted score panel', () => {
    expect(src).not.toContain('bg-[#0D1521]')
  })

  it('replaces text-[#818CF8] with text-info semantic token', () => {
    expect(src).not.toContain('text-[#818CF8]')
  })

  it('replaces text-[#2A3A50] with text-faint', () => {
    expect(src).not.toContain('text-[#2A3A50]')
  })

  it('replaces hardcoded hover:bg-[#1A2440] wrong accordion', () => {
    expect(src).not.toContain('hover:bg-[#1A2440]')
  })
})

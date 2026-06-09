import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const src = readFileSync(resolve(__dirname, '../Account.jsx'), 'utf8')

describe('Account premium UI (Task #11)', () => {
  it('imports SpotlightCard', () => {
    expect(src).toMatch(/import.*SpotlightCard.*from/)
  })

  it('imports AnimatedShinyText', () => {
    expect(src).toMatch(/import.*AnimatedShinyText.*from/)
  })

  it('imports ShimmerButton', () => {
    expect(src).toMatch(/import.*ShimmerButton.*from/)
  })

  it('uses AnimatedShinyText on mastery rank badge', () => {
    expect(src).toContain('AnimatedShinyText')
  })

  it('uses ShimmerButton on upgrade CTAs', () => {
    expect(src).toContain('ShimmerButton')
  })

  it('replaces bg-[#818CF820] info badge bg with semantic token', () => {
    expect(src).not.toContain('bg-[#818CF820]')
  })

  it('replaces text-[#818CF8] with text-info semantic token', () => {
    expect(src).not.toContain('text-[#818CF8]')
  })

  it('replaces border-[#818CF833] with semantic info border', () => {
    expect(src).not.toContain('border-[#818CF833]')
  })

  it('replaces bg-[#818CF81A] with semantic info bg', () => {
    expect(src).not.toContain('bg-[#818CF81A]')
  })

  it('replaces bg-[#818CF8] hardcoded button background', () => {
    expect(src).not.toContain("background: '#818CF8'")
  })

  it('replaces study nudge bg-[#F2A20C0A] with semantic token', () => {
    expect(src).not.toContain('bg-[#F2A20C0A]')
  })

  it('replaces border-[#F2A20C33] nudge border with semantic token', () => {
    expect(src).not.toContain('border-[#F2A20C33]')
  })

  it('replaces bg-[#1A2A10] goal section with glass surface', () => {
    expect(src).not.toContain('bg-[#1A2A10]')
  })

  it('replaces bg-[#0A1A0A] with semantic surface', () => {
    expect(src).not.toContain('bg-[#0A1A0A]')
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const src = readFileSync(resolve(__dirname, '../ExamSelect.jsx'), 'utf8')

describe('ExamSelect premium UI (Task #9)', () => {
  it('imports SpotlightCard', () => {
    expect(src).toMatch(/import.*SpotlightCard.*from/)
  })

  it('imports BorderBeam', () => {
    expect(src).toMatch(/import.*BorderBeam.*from/)
  })

  it('imports AnimatedShinyText', () => {
    expect(src).toMatch(/import.*AnimatedShinyText.*from/)
  })

  it('applies text-gradient-brand to the page headline', () => {
    expect(src).toContain('text-gradient-brand')
  })

  it('uses glass-brand on the Oracle hero card', () => {
    expect(src).toContain('glass-brand')
  })

  it('wraps Oracle hero card with SpotlightCard', () => {
    expect(src).toContain('SpotlightCard')
  })

  it('uses BorderBeam on the Oracle featured card', () => {
    expect(src).toContain('BorderBeam')
  })

  it('replaces hardcoded bg-[#1A2440] mode switcher with glass-base', () => {
    expect(src).not.toContain('bg-[#1A2440]')
    expect(src).toContain('glass-base')
  })

  it('replaces hardcoded bg-[#818CF8] lab-active state with bg-info', () => {
    expect(src).not.toContain("bg-[#818CF8]")
  })

  it('replaces hardcoded border-[#F2A20C33] guest notice with Tailwind primary/20', () => {
    expect(src).not.toContain('border-[#F2A20C33]')
  })

  it('replaces hardcoded OCR button hex colors with semantic tokens', () => {
    expect(src).not.toContain('bg-[#6366F111]')
    expect(src).not.toContain('text-[#818CF8]')
    expect(src).not.toContain('border-[#6366F144]')
  })

  it('replaces hardcoded year filter active bg with semantic token', () => {
    expect(src).not.toContain('bg-[#F2A20C22]')
  })

  it('removes hardcoded border-[#1E2D45] on nav', () => {
    expect(src).not.toContain('border-[#1E2D45]')
  })
})

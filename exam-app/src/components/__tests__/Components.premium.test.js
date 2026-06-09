import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const qc = readFileSync(resolve(__dirname, '../QuestionCard.jsx'), 'utf8')
const ai = readFileSync(resolve(__dirname, '../AIInsights.jsx'), 'utf8')
const po = readFileSync(resolve(__dirname, '../ProfileOnboarding.jsx'), 'utf8')
const lb = readFileSync(resolve(__dirname, '../LowCreditBanner.jsx'), 'utf8')

describe('QuestionCard premium UI (Task #12)', () => {
  it('replaces text-[#2A3A50] rating label with text-faint', () => {
    expect(qc).not.toContain('text-[#2A3A50]')
  })
  it('replaces text-[#818CF8] show-explanation button with text-info', () => {
    expect(qc).not.toContain('text-[#818CF8]')
  })
  it('replaces hover:bg-[#818CF811] with hover:bg-info/5', () => {
    expect(qc).not.toContain('hover:bg-[#818CF811]')
  })
  it('replaces hover:border-[#818CF8] with hover:border-info', () => {
    expect(qc).not.toContain('hover:border-[#818CF8]')
  })
  it('replaces color: #FB7185 wrong-answer mark with text-destructive', () => {
    expect(qc).not.toContain("color: '#FB7185'")
  })
  it('replaces text-[#6EE7B7] correct-answer text with text-success', () => {
    expect(qc).not.toContain('text-[#6EE7B7]')
  })
  it('replaces border-[#A78BFA33] hint box border with semantic token', () => {
    expect(qc).not.toContain('border-[#A78BFA33]')
  })
  it('replaces bg-[#1A1429] hint box bg with glass surface', () => {
    expect(qc).not.toContain('bg-[#1A1429]')
  })
  it('replaces text-[#A78BFA] hint text with text-info/80', () => {
    expect(qc).not.toContain('text-[#A78BFA]')
  })
  it('replaces border-[#2A3A60] panel borders with border-border', () => {
    expect(qc).not.toContain('border-[#2A3A60]')
  })
  it('replaces hover:border-[#4A5A80] with hover:border-primary/30', () => {
    expect(qc).not.toContain('hover:border-[#4A5A80]')
  })
  it('replaces text-[#2A3A60] credit label with text-faint', () => {
    expect(qc).not.toContain('text-[#2A3A60]')
  })
  it('replaces border-[#6366F144] explanation button with border-info/30', () => {
    expect(qc).not.toContain('border-[#6366F144]')
  })
  it('replaces bg-[#6366F108] explanation button bg with bg-info/5', () => {
    expect(qc).not.toContain('bg-[#6366F108]')
  })
  it('replaces hover:border-[#6366F188] with hover:border-info/50', () => {
    expect(qc).not.toContain('hover:border-[#6366F188]')
  })
  it('replaces hover:bg-[#6366F114] with hover:bg-info/10', () => {
    expect(qc).not.toContain('hover:bg-[#6366F114]')
  })
})

describe('AIInsights premium UI (Task #12)', () => {
  it('replaces bg-[#1A2A40] icon box with glass surface', () => {
    expect(ai).not.toContain('bg-[#1A2A40]')
  })
  it('replaces style background #F2A20C button with className bg-primary', () => {
    expect(ai).not.toContain("background: '#F2A20C'")
  })
  it('replaces bg-[#2A0F14] weak topic chip with bg-destructive/10', () => {
    expect(ai).not.toContain('bg-[#2A0F14]')
  })
  it('replaces border-[#5A1A24] weak topic chip border with border-destructive/30', () => {
    expect(ai).not.toContain('border-[#5A1A24]')
  })
  it('replaces bg-[#1F1A0A] warning badge with bg-primary/10', () => {
    expect(ai).not.toContain('bg-[#1F1A0A]')
  })
  it('replaces border-[#4A3A1A] warning badge border with border-primary/30', () => {
    expect(ai).not.toContain('border-[#4A3A1A]')
  })
  it('replaces text-[#FBBF24] warning badge text with text-primary/80', () => {
    expect(ai).not.toContain('text-[#FBBF24]')
  })
  it('replaces border-[#2A3A60] stats panel border with border-border', () => {
    expect(ai).not.toContain('border-[#2A3A60]')
  })
  it('replaces bg-[#1A2A10] study section with glass surface', () => {
    expect(ai).not.toContain('bg-[#1A2A10]')
  })
  it('replaces border-[#2D4A1A] study section border with border-success/20', () => {
    expect(ai).not.toContain('border-[#2D4A1A]')
  })
})

describe('ProfileOnboarding premium UI (Task #12)', () => {
  it('replaces style background #F2A20C button with className', () => {
    expect(po).not.toContain("background: '#F2A20C'")
  })
  it('replaces bg-[#F2A20C11] grade chip active bg with bg-primary/5', () => {
    expect(po).not.toContain('bg-[#F2A20C11]')
  })
  it('replaces hover:border-[#2A3A50] chip hover with hover:border-primary/30', () => {
    expect(po).not.toContain('hover:border-[#2A3A50]')
  })
  it('replaces bg-[#3B82F611] school chip active with bg-info/5', () => {
    expect(po).not.toContain('bg-[#3B82F611]')
  })
})

describe('LowCreditBanner premium UI (Task #12)', () => {
  it('replaces style background #1A1200 with glass-base', () => {
    expect(lb).not.toContain("background: '#1A1200'")
  })
  it('replaces borderBottom #F2A20C33 with border class', () => {
    expect(lb).not.toContain("borderBottom: '1px solid #F2A20C33'")
  })
  it('replaces style background #F2A20C button with className bg-primary', () => {
    expect(lb).not.toContain("background: '#F2A20C'")
  })
})

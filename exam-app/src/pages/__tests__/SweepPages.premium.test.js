import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const page = name => readFileSync(resolve(__dirname, `../${name}.jsx`), 'utf8')
const comp = name => readFileSync(resolve(__dirname, `../../components/${name}.jsx`), 'utf8')

// ─── MathOracle ───────────────────────────────────────────────────────────────
const oracle = page('MathOracle')
describe('MathOracle premium sweep', () => {
  it('no text-[#334155]', () => expect(oracle).not.toContain('text-[#334155]'))
  it('no bg-[#0F1726]', () => expect(oracle).not.toContain('bg-[#0F1726]'))
  it('no bg-[#0A0F1E]', () => expect(oracle).not.toContain('bg-[#0A0F1E]'))
  it('no bg-[#080D1A]', () => expect(oracle).not.toContain('bg-[#080D1A]'))
  it('no bg-[#141D2E]', () => expect(oracle).not.toContain('bg-[#141D2E]'))
  it('no bg-[#1E2D45] hover', () => expect(oracle).not.toContain('hover:bg-[#1E2D45]'))
  it('no border-[#1E2D45]', () => expect(oracle).not.toContain('border-[#1E2D45]'))
  it('no text-[#EF4444]', () => expect(oracle).not.toContain('text-[#EF4444]'))
  it('no text-[#6366F1]', () => expect(oracle).not.toContain('text-[#6366F1]'))
  it('no bg-[#6366F1]', () => expect(oracle).not.toContain('bg-[#6366F1]'))
  it('no border-[#6366F1]', () => expect(oracle).not.toContain('border-[#6366F1]/'))
  it('no focus-within:border-[#6366F1]', () => expect(oracle).not.toContain('focus-within:border-[#6366F1]'))
  it('no hover:bg-[#4F46E5]', () => expect(oracle).not.toContain('hover:bg-[#4F46E5]'))
  it('no rounded-full bg-[#334155]', () => expect(oracle).not.toContain("bg-[#334155]"))
  it('no border-[#2A3A5E] inline', () => expect(oracle).not.toContain("border: '1px solid #2A3A5E'"))
  it('no bg-[#6366F1] inline style', () => expect(oracle).not.toContain("background: '#6366F1'"))
  it('no color #E2E8F0 textarea inline', () => expect(oracle).not.toContain("color: '#E2E8F0'"))
})

// ─── Landing ──────────────────────────────────────────────────────────────────
const land = page('Landing')
describe('Landing premium sweep', () => {
  it('no text-[#818CF8]', () => expect(land).not.toContain('text-[#818CF8]'))
  it('no text-[#34D399]', () => expect(land).not.toContain('text-[#34D399]'))
  it('no bg-[#141D2E]', () => expect(land).not.toContain('bg-[#141D2E]'))
  it('no bg-[#0D1527]', () => expect(land).not.toContain('bg-[#0D1527]'))
  it('no bg-[#6366F144]', () => expect(land).not.toContain('bg-[#6366F144]'))
  it('no text-[#6366F1]', () => expect(land).not.toContain('text-[#6366F1]'))
  it('no bg-[#6366F1] button', () => expect(land).not.toContain("bg-[#6366F1]"))
  it('no hover:bg-[#4F46E5]', () => expect(land).not.toContain('hover:bg-[#4F46E5]'))
  it('no style background #F2A20C', () => expect(land).not.toContain("background: '#F2A20C'"))
  it('no bg-[#EF444420]', () => expect(land).not.toContain('bg-[#EF444420]'))
  it('no text-[#EF4444]', () => expect(land).not.toContain('text-[#EF4444]'))
  it('no hover:border-[#2A3A50]', () => expect(land).not.toContain('hover:border-[#2A3A50]'))
  it('no text-[#334155] footer', () => expect(land).not.toContain('text-[#334155]'))
})

// ─── Mistakes ─────────────────────────────────────────────────────────────────
const mistakes = page('Mistakes')
describe('Mistakes premium sweep', () => {
  it('no bg-[#2A0F14] border-[#5A1A24]', () => expect(mistakes).not.toContain('bg-[#2A0F14]'))
  it('no bg-[#0A2A1A] border-[#1A5A2A]', () => expect(mistakes).not.toContain('bg-[#0A2A1A]'))
  it('no bg-[#F2A20C22]', () => expect(mistakes).not.toContain('bg-[#F2A20C22]'))
  it('no hover:border-[#2A3A50]', () => expect(mistakes).not.toContain('hover:border-[#2A3A50]'))
  it('no border-[#6366F133]', () => expect(mistakes).not.toContain('border-[#6366F133]'))
  it('no bg-[#6366F108]', () => expect(mistakes).not.toContain('bg-[#6366F108]'))
  it('no text-[#818CF8]', () => expect(mistakes).not.toContain('text-[#818CF8]'))
  it('no bg-[#818CF822]', () => expect(mistakes).not.toContain('bg-[#818CF822]'))
  it('no bg-[#818CF8]', () => expect(mistakes).not.toContain("bg-[#818CF8]"))
  it('no style background #F2A20C', () => expect(mistakes).not.toContain("background: '#F2A20C'"))
  it('no border-[#2A1A40]', () => expect(mistakes).not.toContain('border-[#2A1A40]'))
  it('no bg-[#150D2A]', () => expect(mistakes).not.toContain('bg-[#150D2A]'))
  it('no bg-[#1A1240]', () => expect(mistakes).not.toContain('bg-[#1A1240]'))
  it('no text-[#A78BFA]', () => expect(mistakes).not.toContain('text-[#A78BFA]'))
  it('no text-[#34D399]', () => expect(mistakes).not.toContain('text-[#34D399]'))
})

// ─── StudyPlan ────────────────────────────────────────────────────────────────
const plan = page('StudyPlan')
describe('StudyPlan premium sweep', () => {
  it('no text-[#34D399]', () => expect(plan).not.toContain('text-[#34D399]'))
  it('no bg-[#10B9811A]', () => expect(plan).not.toContain('bg-[#10B9811A]'))
  it('no bg-[#F2A20C1A]', () => expect(plan).not.toContain('bg-[#F2A20C1A]'))
  it('no bg-[#1A1505]', () => expect(plan).not.toContain('bg-[#1A1505]'))
  it('no border-[#4A3A05]', () => expect(plan).not.toContain('border-[#4A3A05]'))
  it('no border-[#F2A20C40]', () => expect(plan).not.toContain('border-[#F2A20C40]'))
  it('no style background #F2A20C', () => expect(plan).not.toContain("background: '#F2A20C'"))
  it('no bg-[#0A1020]', () => expect(plan).not.toContain('bg-[#0A1020]'))
  it('no bg-[#2A1A05]', () => expect(plan).not.toContain('bg-[#2A1A05]'))
  it('no bg-[#6366F108]', () => expect(plan).not.toContain('bg-[#6366F108]'))
  it('no text-[#818CF8]', () => expect(plan).not.toContain('text-[#818CF8]'))
  it('no bg-[#0A1F14] border-[#2D4A1A]', () => expect(plan).not.toContain('bg-[#0A1F14]'))
  it('no style background #10B981', () => expect(plan).not.toContain("background: '#10B981'"))
})

// ─── ConceptMap ───────────────────────────────────────────────────────────────
const cmap = page('ConceptMap')
describe('ConceptMap premium sweep', () => {
  it('no text-[#60A5FA]', () => expect(cmap).not.toContain('text-[#60A5FA]'))
  it('no text-[#22C55E]', () => expect(cmap).not.toContain('text-[#22C55E]'))
  it('no bg-[#1C1400]', () => expect(cmap).not.toContain('bg-[#1C1400]'))
  it('no style background #F2A20C', () => expect(cmap).not.toContain("background: '#F2A20C'"))
})

// ─── TestInterface ────────────────────────────────────────────────────────────
const ti = page('TestInterface')
describe('TestInterface premium sweep', () => {
  it('no text-[#2A3A50] close btn', () => expect(ti).not.toContain('text-[#2A3A50]'))
  it('no bg-[#1A0D00]', () => expect(ti).not.toContain('bg-[#1A0D00]'))
  it('no border-[#F2A20C44]', () => expect(ti).not.toContain('border-[#F2A20C44]'))
  it('no bg-[#1B2540]', () => expect(ti).not.toContain('bg-[#1B2540]'))
  it('no border-[#2A3A60]', () => expect(ti).not.toContain('border-[#2A3A60]'))
  it('no style background #F2A20C', () => expect(ti).not.toContain("background: '#F2A20C'"))
  it('no text-[#EF4444]', () => expect(ti).not.toContain('text-[#EF4444]'))
  it('no bg-[#F2A20C11]', () => expect(ti).not.toContain('bg-[#F2A20C11]'))
})

// ─── AdaptiveStudyPlan ────────────────────────────────────────────────────────
const asp = page('AdaptiveStudyPlan')
describe('AdaptiveStudyPlan premium sweep', () => {
  it('no bg-[#FB718514]', () => expect(asp).not.toContain('bg-[#FB718514]'))
  it('no text-[#34D399]', () => expect(asp).not.toContain('text-[#34D399]'))
  it('no text-[#818CF8]', () => expect(asp).not.toContain('text-[#818CF8]'))
  it('no hover:border-[#4A5A80]', () => expect(asp).not.toContain('hover:border-[#4A5A80]'))
  it('no border-[#34D39930]', () => expect(asp).not.toContain('border-[#34D39930]'))
  it('no border-[#6366F130]', () => expect(asp).not.toContain('border-[#6366F130]'))
  it('no border-[#2A3A60]', () => expect(asp).not.toContain('border-[#2A3A60]'))
})

// ─── ReviewSession ────────────────────────────────────────────────────────────
const rs = page('ReviewSession')
describe('ReviewSession premium sweep', () => {
  it('no style background #F2A20C', () => expect(rs).not.toContain("background: '#F2A20C'"))
  it('no text-[#34D399]', () => expect(rs).not.toContain('text-[#34D399]'))
  it('no border-[#A78BFA33]', () => expect(rs).not.toContain('border-[#A78BFA33]'))
  it('no bg-[#1A1429]', () => expect(rs).not.toContain('bg-[#1A1429]'))
  it('no text-[#A78BFA]', () => expect(rs).not.toContain('text-[#A78BFA]'))
  it('no border-[#6366F133]', () => expect(rs).not.toContain('border-[#6366F133]'))
  it('no text-[#818CF8]', () => expect(rs).not.toContain('text-[#818CF8]'))
  it('no text-[#2A3A50]', () => expect(rs).not.toContain('text-[#2A3A50]'))
})

// ─── Progress ─────────────────────────────────────────────────────────────────
const prog = page('Progress')
describe('Progress premium sweep', () => {
  it('no style background #F2A20C', () => expect(prog).not.toContain("background: '#F2A20C'"))
  it('no text-[#34D399]', () => expect(prog).not.toContain('text-[#34D399]'))
  it('no bg-[#0A1F14]', () => expect(prog).not.toContain('bg-[#0A1F14]'))
  it('no border-[#2D4A1A]', () => expect(prog).not.toContain('border-[#2D4A1A]'))
  it('no border-[#6366F133]', () => expect(prog).not.toContain('border-[#6366F133]'))
  it('no bg-[#6366F108]', () => expect(prog).not.toContain('bg-[#6366F108]'))
  it('no text-[#818CF8]', () => expect(prog).not.toContain('text-[#818CF8]'))
  it('no style background #10B981', () => expect(prog).not.toContain("background: '#10B981'"))
})

// ─── ErrorAnalysis ────────────────────────────────────────────────────────────
const ea = page('ErrorAnalysis')
describe('ErrorAnalysis premium sweep', () => {
  it('no style background #F2A20C repeated CTAs', () => expect(ea.split("background: '#F2A20C'").length - 1).toBe(0))
})

// ─── DiagnosticTest ───────────────────────────────────────────────────────────
const dt = page('DiagnosticTest')
describe('DiagnosticTest premium sweep', () => {
  it('no style background #F2A20C', () => expect(dt).not.toContain("background: '#F2A20C'"))
})

// ─── Admin ────────────────────────────────────────────────────────────────────
const adm = page('Admin')
describe('Admin premium sweep', () => {
  it('no text-[#334155]', () => expect(adm).not.toContain('text-[#334155]'))
  it('no style background #F2A20C', () => expect(adm).not.toContain("background: '#F2A20C'"))
  it('no style background #EF4444', () => expect(adm).not.toContain("background: '#EF4444'"))
})

// ─── AdminSecurityEvents ──────────────────────────────────────────────────────
const ase = page('AdminSecurityEvents')
describe('AdminSecurityEvents premium sweep', () => {
  it('no hover:border-[#2E3A54]', () => expect(ase).not.toContain('hover:border-[#2E3A54]'))
  it('no style background #F2A20C', () => expect(ase).not.toContain("background: '#F2A20C'"))
  it('no text-[#334155]', () => expect(ase).not.toContain('text-[#334155]'))
})

// ─── AdaptivePractice ─────────────────────────────────────────────────────────
const ap = page('AdaptivePractice')
describe('AdaptivePractice premium sweep', () => {
  it('no style background #F2A20C', () => expect(ap).not.toContain("background: '#F2A20C'"))
  it('no border-[#6366F144]', () => expect(ap).not.toContain('border-[#6366F144]'))
  it('no bg-[#0D0D1A]', () => expect(ap).not.toContain('bg-[#0D0D1A]'))
})

// ─── DailyChallenge ───────────────────────────────────────────────────────────
const dc = page('DailyChallenge')
describe('DailyChallenge premium sweep', () => {
  it('no text-[#818CF8]', () => expect(dc).not.toContain('text-[#818CF8]'))
  it('no bg-[#0A1F14] choice', () => expect(dc).not.toContain("bg-[#0A1F14]"))
  it('no text-[#6EE7B7]', () => expect(dc).not.toContain("text-[#6EE7B7]"))
  it('no bg-[#1F0A0E]', () => expect(dc).not.toContain("bg-[#1F0A0E]"))
  it('no bg-[#1A1505]', () => expect(dc).not.toContain("bg-[#1A1505]"))
  it('no text-[#34D399]', () => expect(dc).not.toContain("text-[#34D399]"))
  it('no style background #F2A20C', () => expect(dc).not.toContain("background: '#F2A20C'"))
})

// ─── ChallengeLanding ─────────────────────────────────────────────────────────
const cl = page('ChallengeLanding')
describe('ChallengeLanding premium sweep', () => {
  it('no border-[#F2A20C33]', () => expect(cl).not.toContain('border-[#F2A20C33]'))
  it('no text-[#2A3A50]', () => expect(cl).not.toContain('text-[#2A3A50]'))
})

// ─── Placement ────────────────────────────────────────────────────────────────
const pl = page('Placement')
describe('Placement premium sweep', () => {
  it('no bg-[#0D1527]', () => expect(pl).not.toContain('bg-[#0D1527]'))
  it('no bg-[#6366F1] button', () => expect(pl).not.toContain('bg-[#6366F1]'))
  it('no hover:bg-[#4F46E5]', () => expect(pl).not.toContain('hover:bg-[#4F46E5]'))
  it('no text-[#6366F1]', () => expect(pl).not.toContain('text-[#6366F1]'))
  it('no text-[#E2E8F0]', () => expect(pl).not.toContain("text-[#E2E8F0]"))
  it('no text-[#2A3A50]', () => expect(pl).not.toContain('text-[#2A3A50]'))
})

// ─── ShareView ────────────────────────────────────────────────────────────────
const sv = page('ShareView')
describe('ShareView premium sweep', () => {
  it('no text-[#2A3A50]', () => expect(sv).not.toContain('text-[#2A3A50]'))
})

// ─── Navbar component ─────────────────────────────────────────────────────────
const nav = comp('Navbar')
describe('Navbar premium sweep', () => {
  it('no border-[#6366F130]', () => expect(nav).not.toContain('border-[#6366F130]'))
  it('no bg-[#6366F10A]', () => expect(nav).not.toContain('bg-[#6366F10A]'))
  it('no text-[#818CF8]', () => expect(nav).not.toContain('text-[#818CF8]'))
  it('no style background #F2A20C', () => expect(nav).not.toContain("background: '#F2A20C'"))
})

// ─── OfflineBanner ────────────────────────────────────────────────────────────
const ob = comp('OfflineBanner')
describe('OfflineBanner premium sweep', () => {
  it('no bg-[#0A2A1A]', () => expect(ob).not.toContain('bg-[#0A2A1A]'))
  it('no border-[#1A5A2A]', () => expect(ob).not.toContain('border-[#1A5A2A]'))
  it('no text-[#34D399]', () => expect(ob).not.toContain('text-[#34D399]'))
  it('no bg-[#1A1200]', () => expect(ob).not.toContain('bg-[#1A1200]'))
  it('no text-[#FBBF24]', () => expect(ob).not.toContain('text-[#FBBF24]'))
})

// ─── AuthModal ────────────────────────────────────────────────────────────────
const am = comp('AuthModal')
describe('AuthModal premium sweep', () => {
  it('no inline bg #0A0E1A border #F2A20C', () => expect(am).not.toContain("background: '#0A0E1A'"))
})

// ─── ExtendedOnboarding ───────────────────────────────────────────────────────
const eo = comp('ExtendedOnboarding')
describe('ExtendedOnboarding premium sweep', () => {
  it('no bg-[#F2A20C11]', () => expect(eo).not.toContain('bg-[#F2A20C11]'))
  it('no hover:border-[#2A3A50]', () => expect(eo).not.toContain('hover:border-[#2A3A50]'))
})

// ─── InstallPrompt ────────────────────────────────────────────────────────────
const ip = comp('InstallPrompt')
describe('InstallPrompt premium sweep', () => {
  it('no inline bg #0D1221', () => expect(ip).not.toContain("background: '#0D1221'"))
  it('no style background #F2A20C', () => expect(ip).not.toContain("background: '#F2A20C'"))
})

// ─── LockedFeatureCard ────────────────────────────────────────────────────────
const lfc = comp('LockedFeatureCard')
describe('LockedFeatureCard premium sweep', () => {
  it('no style background #F2A20C', () => expect(lfc).not.toContain("background: '#F2A20C'"))
  it('no bg-[#141D2E]', () => expect(lfc).not.toContain('bg-[#141D2E]'))
})

// ─── ReportButton ─────────────────────────────────────────────────────────────
const rb = comp('ReportButton')
describe('ReportButton premium sweep', () => {
  it('no text-[#34D399]', () => expect(rb).not.toContain('text-[#34D399]'))
})

// ─── SymbolPalette ────────────────────────────────────────────────────────────
const sp = comp('SymbolPalette')
describe('SymbolPalette premium sweep', () => {
  it('no border-b-2 border-[#6366F1]', () => expect(sp).not.toContain('border-[#6366F1]'))
  it('no hover:bg-[#1E293B]', () => expect(sp).not.toContain('hover:bg-[#1E293B]'))
  it('no hover:text-[#E2E8F0]', () => expect(sp).not.toContain('hover:text-[#E2E8F0]'))
})

// ─── Account residuals ────────────────────────────────────────────────────────
const acc = page('Account')
describe('Account residual premium sweep', () => {
  it('no bg-[#F2A20C15]', () => expect(acc).not.toContain('bg-[#F2A20C15]'))
  it('no border-[#F2A20C30]', () => expect(acc).not.toContain('border-[#F2A20C30]'))
  it('no bg-[#10B9810D]', () => expect(acc).not.toContain('bg-[#10B9810D]'))
  it('no border-[#10B98133]', () => expect(acc).not.toContain('border-[#10B98133]'))
  it('no text-[#34D399]', () => expect(acc).not.toContain('text-[#34D399]'))
  it('no border-[#818CF850]', () => expect(acc).not.toContain('border-[#818CF850]'))
  it('no bg-[#818CF8] toggle', () => expect(acc).not.toContain("bg-[#818CF8]"))
  it('no bg-[#10B9811A]', () => expect(acc).not.toContain('bg-[#10B9811A]'))
  it('no bg-[#1A0A0A]', () => expect(acc).not.toContain('bg-[#1A0A0A]'))
  it('no bg-[#0A1A12]', () => expect(acc).not.toContain('bg-[#0A1A12]'))
})

import { crawlQuestions } from './sources/questions/vndoc.js'
import { crawlThuVienHocLieu } from './sources/questions/thuvienhoclieu.js'
import { crawlLoiGiaiHay } from './sources/questions/loigiaihay.js'
import { crawlToanMath } from './sources/questions/toanmath.js'
import { crawlTaiLieu } from './sources/questions/tailieu.js'
import { crawlTuyenSinh247 } from './sources/schools/tuyensinh247.js'
import { crawlDantri } from './sources/schools/dantri.js'
import { crawlHcmedu } from './sources/schools/hcmedu.js'
import { normalize } from './pipeline/normalize.js'
import { tag } from './pipeline/tag.js'
import { addFigures } from './pipeline/figure.js'
import { dedupe } from './pipeline/dedupe.js'
import { aiValidate } from './pipeline/aiValidate.js'
import { validate } from './pipeline/validate.js'
import { merge } from './pipeline/merge.js'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, 'output')
const RAW_DIR = join(OUTPUT_DIR, 'raw')

const only          = process.argv.find(a => a.startsWith('--only='))?.split('=')[1]
const skipValidate  = process.argv.includes('--skip-validate')
const ignoreRobots  = process.argv.includes('--ignore-robots')

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function checkRobots(domain) {
  try {
    const { default: axios } = await import('axios')
    const res = await axios.get(`https://${domain}/robots.txt`, { timeout: 5000 })
    if (res.data.includes('Disallow: /')) {
      console.warn(`[WARN] ${domain}/robots.txt has broad Disallow — skipping`)
      return false
    }
    return true
  } catch {
    return true // assume allowed if robots.txt unreachable
  }
}

async function runQuestions() {
  console.log('Crawling questions...')
  const sources = [
    { fn: crawlQuestions,      domain: 'vndoc.com' },
    { fn: crawlThuVienHocLieu, domain: 'thuvienhoclieu.com' },
    { fn: crawlLoiGiaiHay,     domain: 'loigiaihay.com' },
    { fn: crawlToanMath,       domain: 'toanmath.com' },
    { fn: crawlTaiLieu,        domain: 'tailieu.vn' },
  ]
  let allRaw = []
  for (const { fn, domain } of sources) {
    if (!ignoreRobots) {
      const ok = await checkRobots(domain)
      if (!ok) continue
    }
    try {
      const items = await fn()
      allRaw.push(...items)
      console.log(`  ${domain}: ${items.length} questions`)
    } catch (e) {
      console.error(`  [ERROR] ${domain}: ${e.message}`)
    }
    await sleep(1500)
  }
  writeFileSync(join(RAW_DIR, 'questions-raw.json'), JSON.stringify(allRaw, null, 2))

  const normalized  = normalize.questions(allRaw)
  const tagged      = tag(normalized)
  const withFigures = await addFigures(tagged)
  const deduped     = dedupe(withFigures)
  if (!skipValidate) await aiValidate(deduped)
  const exams       = normalize.exams(deduped)
  const report      = validate(deduped, null)
  report.exams      = exams.length

  writeFileSync(join(OUTPUT_DIR, 'questions.json'), JSON.stringify(deduped, null, 2))
  writeFileSync(join(OUTPUT_DIR, 'exams.json'),     JSON.stringify(exams, null, 2))
  return { deduped, exams, report }
}

async function runSchools() {
  console.log('Crawling schools...')
  const sources = [
    { fn: crawlTuyenSinh247, domain: 'tuyensinh247.com' },
    { fn: crawlDantri,       domain: 'dantri.com.vn' },
    { fn: crawlHcmedu,       domain: 'hcm.edu.vn' },
  ]
  let allSchoolData = []
  for (const { fn, domain } of sources) {
    const ok = await checkRobots(domain)
    if (!ok) continue
    try {
      const items = await fn()
      allSchoolData.push(...items)
      console.log(`  ${domain}: ${items.length} schools`)
    } catch (e) {
      console.error(`  [ERROR] ${domain}: ${e.message}`)
    }
    await sleep(1500)
  }
  writeFileSync(join(RAW_DIR, 'schools-raw.json'), JSON.stringify(allSchoolData, null, 2))

  const schools = merge(allSchoolData)
  const report  = validate(null, schools)

  writeFileSync(join(OUTPUT_DIR, 'schools.json'), JSON.stringify(schools, null, 2))
  return { schools, report }
}

async function main() {
  mkdirSync(RAW_DIR, { recursive: true })
  const report = { timestamp: new Date().toISOString(), conflicts: [] }

  try {
    if (!only || only === 'questions') {
      const { report: qReport } = await runQuestions()
      Object.assign(report, qReport)
    }
    if (!only || only === 'schools') {
      const { report: sReport } = await runSchools()
      Object.assign(report, sReport)
    }
    writeFileSync(join(OUTPUT_DIR, 'crawl-report.json'), JSON.stringify(report, null, 2))
    console.log('Done. Report:', join(OUTPUT_DIR, 'crawl-report.json'))
  } catch (e) {
    console.error('Fatal:', e.message)
    process.exit(1)
  }
}

main()

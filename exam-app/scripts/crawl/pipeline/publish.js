import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '../output')
const DATA_DIR   = join(__dirname, '../../../src/data')

const checkOnly = process.argv.includes('--check-only')

function readJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
}

function mergeById(existing, incoming) {
  const map = Object.fromEntries(existing.map(x => [x.id, x]))
  for (const item of incoming) {
    if (!map[item.id]) {
      map[item.id] = item
    } else if (item.figure?.data && !map[item.id].figure?.data) {
      // Update figure data if incoming has one and existing doesn't
      map[item.id] = { ...map[item.id], figure: item.figure }
    }
  }
  return Object.values(map)
}

const crawledQuestions = readJson(join(OUTPUT_DIR, 'questions.json'))
const crawledExams     = readJson(join(OUTPUT_DIR, 'exams.json'))

if (!crawledQuestions || !crawledExams) {
  console.error('Missing output files. Run: node exam-app/scripts/crawl/index.js --only=questions')
  process.exit(1)
}

const existingQuestions = readJson(join(DATA_DIR, 'questions.json')) ?? []
const existingExams     = readJson(join(DATA_DIR, 'exams.json')) ?? []

const mergedQuestions = mergeById(existingQuestions, crawledQuestions)
const mergedExams     = mergeById(existingExams, crawledExams)

// Integrity checks
const questionIds = new Set(mergedQuestions.map(q => q.id))
const integrityErrors = []

for (const exam of mergedExams) {
  for (const qid of (exam.questionIds ?? [])) {
    if (!questionIds.has(qid))
      integrityErrors.push(`Exam ${exam.id}: questionId "${qid}" not found in questions`)
  }
}
for (const q of mergedQuestions) {
  if (!Array.isArray(q.choices) || q.choices.length !== 4)
    integrityErrors.push(`Question ${q.id}: must have exactly 4 choices`)
  if (typeof q.correct !== 'number' || q.correct < 0 || q.correct > 3)
    integrityErrors.push(`Question ${q.id}: correct=${q.correct} out of range 0–3`)
  if (q.needs_figure && !q.figure?.data)
    console.warn(`  [WARN] ${q.id}: needs_figure but no SVG — will render text only`)
}

if (integrityErrors.length > 0) {
  integrityErrors.forEach(e => console.error('[INTEGRITY]', e))
  process.exit(1)
}

const thiThuExams     = mergedExams.filter(e => e.mode === 'thithu')
const thiThuQuestions = mergedQuestions.filter(q => crawledQuestions.some(c => c.id === q.id))

console.log(`Integrity: OK`)
console.log(`  Questions: ${existingQuestions.length} existing + ${thiThuQuestions.length} new = ${mergedQuestions.length} total`)
console.log(`  Exams: ${existingExams.length} existing + ${thiThuExams.length} thithu = ${mergedExams.length} total`)

if (checkOnly) {
  console.log('--check-only: no files written.')
  process.exit(0)
}

writeFileSync(join(DATA_DIR, 'questions.json'), JSON.stringify(mergedQuestions, null, 2))
writeFileSync(join(DATA_DIR, 'exams.json'),     JSON.stringify(mergedExams, null, 2))
console.log('Published to src/data/')

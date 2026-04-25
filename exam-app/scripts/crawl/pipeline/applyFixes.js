import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '../output')

const reportPath    = join(OUTPUT_DIR, 'validation-report.json')
const questionsPath = join(OUTPUT_DIR, 'questions.json')

if (!existsSync(reportPath)) {
  console.error('Run aiValidate first (via crawl pipeline).')
  process.exit(1)
}

const report    = JSON.parse(readFileSync(reportPath, 'utf8'))
const questions = JSON.parse(readFileSync(questionsPath, 'utf8'))
const qMap      = Object.fromEntries(questions.map(q => [q.id, q]))

const wrongItems = report.filter(r => r.verdict === 'WRONG')
const fixes = []

for (const item of wrongItems) {
  const q = qMap[item.id]
  if (!q) continue
  fixes.push({
    id: item.id,
    oldCorrect: q.correct,
    newCorrect: item.aiCorrect,
    oldExplanation: q.explanation,
    newExplanation: item.aiExplanation,
  })
  q.correct = item.aiCorrect
  if (item.aiExplanation) q.explanation = item.aiExplanation
}

writeFileSync(questionsPath, JSON.stringify(questions, null, 2))
writeFileSync(join(OUTPUT_DIR, 'fixes-applied.json'), JSON.stringify(fixes, null, 2))
console.log(`Applied ${fixes.length} fixes. Details: output/fixes-applied.json`)

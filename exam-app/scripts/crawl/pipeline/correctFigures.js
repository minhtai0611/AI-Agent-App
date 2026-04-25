import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { addFigures } from './figure.js'

const __dirname   = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR  = join(__dirname, '../output')

const flaggedArg = process.argv.find(a => a.startsWith('--flagged='))?.split('=')[1]
if (!flaggedArg || !existsSync(flaggedArg)) {
  console.error('Usage: node correctFigures.js --flagged=<path-to-flagged-ids.json>')
  process.exit(1)
}

const flaggedIds = new Set(JSON.parse(readFileSync(flaggedArg, 'utf8')))
const questionsPath = join(OUTPUT_DIR, 'questions.json')
const questions = JSON.parse(readFileSync(questionsPath, 'utf8'))

console.log(`Re-generating figures for ${flaggedIds.size} flagged questions...`)

// Clear figure data for flagged questions so addFigures regenerates them
for (const q of questions) {
  if (flaggedIds.has(q.id)) {
    q.figure = null
    q.needs_figure = true
  }
}

const updated = await addFigures(questions)
writeFileSync(questionsPath, JSON.stringify(updated, null, 2))
console.log('Corrections applied. Re-run buildPreview.js to verify.')

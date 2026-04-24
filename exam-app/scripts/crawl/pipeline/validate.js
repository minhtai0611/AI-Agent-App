import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '../output')

const checkOnly = process.argv.includes('--check-only')

function validateQuestions(questions) {
  const errors = []
  if (!questions || questions.length < 60)
    errors.push(`questions.json: only ${questions?.length ?? 0} questions, need ≥ 60`)

  const years = new Set(questions?.map(q => q.year) ?? [])
  if (years.size < 3)
    errors.push(`questions.json: only ${years.size} years, need ≥ 3`)

  for (const q of (questions ?? [])) {
    if (typeof q.correct !== 'number' || q.correct < 0 || q.correct > 3)
      errors.push(`Question ${q.id}: correct=${q.correct} out of range 0–3`)
  }

  const topics = ['algebra', 'geometry', 'statistics', 'combinatorics']
  const total = questions?.length ?? 0
  for (const topic of topics) {
    const count = questions?.filter(q => q.topic === topic).length ?? 0
    if (count / total > 0.6)
      errors.push(`Topic "${topic}" is ${Math.round(count/total*100)}% of total — exceeds 60%`)
  }
  return errors
}

function validateSchools(schools) {
  const errors = []
  if (!schools || schools.length < 30)
    errors.push(`schools.json: only ${schools?.length ?? 0} schools, need ≥ 30`)

  for (const s of (schools ?? [])) {
    if (!s.trend) errors.push(`School ${s.id}: missing trend`)
    const years = Object.keys(s.cutoffs ?? {})
    if (years.length < 3) errors.push(`School ${s.id}: only ${years.length} cutoff years`)
    for (const yr of years) {
      if (!s.cutoffs[yr].math || !s.cutoffs[yr].total)
        errors.push(`School ${s.id} year ${yr}: missing math or total cutoff`)
    }
  }
  return errors
}

export function validate(questions, schools) {
  const errors = [
    ...validateQuestions(questions),
    ...validateSchools(schools),
  ]
  return { valid: errors.length === 0, errors }
}

// CLI entry
if (checkOnly) {
  let questions, schools
  try { questions = JSON.parse(readFileSync(join(OUTPUT_DIR, 'questions.json'), 'utf8')) } catch {}
  try { schools   = JSON.parse(readFileSync(join(OUTPUT_DIR, 'schools.json'), 'utf8')) } catch {}
  const { valid, errors } = validate(questions, schools)
  if (!valid) {
    errors.forEach(e => console.error('[INVALID]', e))
    process.exit(1)
  }
  console.log('Validation passed.')
}

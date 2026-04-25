import axios from 'axios'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '../output')
const BACKEND    = 'http://localhost:8000'
const DELAY_MS   = 3000

async function checkHealth() {
  try {
    await axios.get(`${BACKEND}/health`, { timeout: 3000 })
    return true
  } catch {
    return false
  }
}

export async function aiValidate(questions) {
  const alive = await checkHealth()
  if (!alive) {
    console.warn('  [WARN] aiValidate: backend not running — skipping AI validation')
    console.warn('         Start backend with: uvicorn app.main:app --reload')
    return { questions, report: [], skipped: true }
  }

  console.log(`  aiValidate: checking ${questions.length} questions via /explain...`)
  const report = []

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    try {
      const { data } = await axios.post(`${BACKEND}/explain`, {
        question: q,
        chosen_index: q.correct,
      }, { timeout: 15000 })

      const aiCorrect = data?.correct_index ?? q.correct
      const verdict = aiCorrect === q.correct ? 'CORRECT' : 'WRONG'
      report.push({
        id: q.id,
        year: q.year,
        storedCorrect: q.correct,
        aiCorrect,
        aiExplanation: data?.explanation ?? null,
        verdict,
      })

      if (verdict === 'WRONG') {
        console.warn(`  [WARN] ${q.id}: stored=${q.correct} ai=${aiCorrect}`)
      }
    } catch (e) {
      report.push({ id: q.id, verdict: 'ERROR', error: e.message })
    }

    if (i < questions.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }

  const wrong = report.filter(r => r.verdict === 'WRONG').length
  const errors = report.filter(r => r.verdict === 'ERROR').length
  const pct = Math.round((wrong / questions.length) * 100)
  console.log(`  aiValidate: ${wrong} WRONG, ${errors} ERROR out of ${questions.length} (${pct}% wrong)`)

  writeFileSync(join(OUTPUT_DIR, 'validation-report.json'), JSON.stringify(report, null, 2))

  if (pct > 10) {
    console.error(`  [ERROR] ${pct}% wrong answers exceeds 10% threshold — review crawled data`)
    process.exitCode = 1
  }

  return { questions, report }
}

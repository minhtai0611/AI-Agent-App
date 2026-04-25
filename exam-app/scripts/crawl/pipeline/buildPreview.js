import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '../output')
const QUESTIONS_PATH = join(OUTPUT_DIR, 'questions.json')
const PREVIEW_PATH   = join(OUTPUT_DIR, 'figure-preview.html')

if (!existsSync(QUESTIONS_PATH)) {
  console.error('Run the crawl pipeline first: node index.js --only=questions')
  process.exit(1)
}

const questions = JSON.parse(readFileSync(QUESTIONS_PATH, 'utf8'))
const withFigures = questions.filter(q => q.figure?.data)

console.log(`Building preview for ${withFigures.length} figures...`)

const cards = withFigures.map(q => `
  <div class="card" data-id="${q.id}">
    <div class="question">
      <p class="id">${q.id} · ${q.year} · ${q.topic}</p>
      <p>${q.question}</p>
      <ul>${q.choices.map((c, i) => `<li>${'ABCD'[i]}. ${c}</li>`).join('')}</ul>
      <p class="correct">Correct: ${'ABCD'[q.correct]}</p>
    </div>
    <div class="figure">${q.figure.data}</div>
    <div class="actions">
      <label><input type="checkbox" class="flag" data-id="${q.id}"> Flag as incorrect</label>
    </div>
  </div>
`).join('\n')

const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Figure Preview</title>
<style>
  body { font-family: sans-serif; background: #0A0E1A; color: #F8FAFC; padding: 20px; }
  h1 { color: #F2A20C; }
  .card { display: flex; gap: 20px; border: 1px solid #1E2A44; border-radius: 12px;
    padding: 16px; margin-bottom: 16px; background: #0D1521; align-items: flex-start; }
  .question { flex: 1; }
  .question .id { color: #64748B; font-size: 11px; margin: 0 0 8px; }
  .question ul { padding-left: 16px; color: #94A3B8; font-size: 13px; }
  .question .correct { color: #10B981; font-size: 12px; }
  .figure { flex-shrink: 0; border: 1px solid #2A3A5E; border-radius: 8px;
    background: #0D1221; padding: 8px; }
  .figure svg { display: block; }
  .actions { align-self: flex-end; }
  label { font-size: 13px; color: #94A3B8; cursor: pointer; }
  input[type=checkbox] { accent-color: #F2A20C; }
  #export-btn { margin: 20px 0; padding: 10px 24px; background: #F2A20C;
    color: #0A0E1A; border: none; border-radius: 8px; font-weight: bold;
    cursor: pointer; font-size: 14px; }
  #export-btn:hover { opacity: 0.9; }
  #summary { color: #64748B; font-size: 13px; margin-bottom: 8px; }
</style>
</head>
<body>
<h1>Figure Preview — ${withFigures.length} diagrams</h1>
<p id="summary">Check each figure. Flag any that are geometrically incorrect, then click Export.</p>
<button id="export-btn">Export flagged IDs</button>
${cards}
<script>
document.getElementById('export-btn').addEventListener('click', () => {
  const flagged = [...document.querySelectorAll('.flag:checked')].map(el => el.dataset.id)
  const json = JSON.stringify(flagged, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'flagged-ids.json'
  a.click()
  console.log('Flagged:', flagged)
})
</script>
</body>
</html>`

writeFileSync(PREVIEW_PATH, html)
console.log('Preview written to:', PREVIEW_PATH)
console.log('Open it in a browser, flag incorrect figures, then run:')
console.log('  node scripts/crawl/pipeline/correctFigures.js --flagged=output/flagged-ids.json')

/**
 * AI-based dataset generator.
 * Generates 30 MCQ questions per year (2015-2024) matching the HCMC Grade 10
 * Math entrance exam format, including SVG figures for geometry questions.
 *
 * Usage: node scripts/crawl/generate.js
 *        node scripts/crawl/generate.js --years=2023,2024   (subset)
 *        node scripts/crawl/generate.js --skip-figures
 */

import axios from 'axios'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { normalize } from './pipeline/normalize.js'
import { tag } from './pipeline/tag.js'
import { dedupe } from './pipeline/dedupe.js'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, 'output')
const RAW_DIR    = join(OUTPUT_DIR, 'raw')

const skipFigures = process.argv.includes('--skip-figures')
const yearsArg    = process.argv.find(a => a.startsWith('--years='))?.split('=')[1]
const ALL_YEARS   = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]
const YEARS       = yearsArg ? yearsArg.split(',').map(Number) : ALL_YEARS

// ── env ──────────────────────────────────────────────────────────────────────

function loadEnv() {
  const p = join(__dirname, '../../../backend/.env')
  if (!existsSync(p)) return {}
  const env = {}
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim()
  }
  return env
}

const ENV    = loadEnv()
const BASE   = (ENV.ANTHROPIC_BASE_URL || 'https://ai-router.locdo.tech') + '/v2'
const TOKEN  = ENV.ANTHROPIC_AUTH_TOKEN
const SONNET = ENV.ANTHROPIC_DEFAULT_SONNET_MODEL || 'claude-sonnet-4.6'
const HAIKU  = ENV.ANTHROPIC_DEFAULT_HAIKU_MODEL  || 'claude-haiku-4.5'

if (!TOKEN) { console.error('Missing ANTHROPIC_AUTH_TOKEN in backend/.env'); process.exit(1) }

async function callAI(model, prompt, maxTokens = 4000) {
  const res = await axios.post(
    `${BASE}/chat/completions`,
    { model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] },
    { headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, timeout: 60000 }
  )
  return res.data?.choices?.[0]?.message?.content ?? ''
}

// ── question generation ───────────────────────────────────────────────────────

const TOPIC_DISTRIBUTION = [
  // [topic, count] totaling 30 per exam
  ['algebra', 12],
  ['geometry', 10],
  ['statistics', 4],
  ['combinatorics', 4],
]

// Difficulty by question position (first 10 easy, next 15 medium, last 5 hard)
function difficulty(idx) {
  if (idx < 10) return 'easy'
  if (idx < 25) return 'medium'
  return 'hard'
}

function buildPrompt(year, topic, count, startIdx) {
  const diffLabels = Array.from({ length: count }, (_, i) => difficulty(startIdx + i))

  const topicGuide = {
    algebra: `phương trình bậc nhất/bậc hai, hệ phương trình, bất phương trình, hàm số y=ax+b và y=ax², căn thức, đa thức`,
    geometry: `tam giác (Pythagoras, đồng dạng, tứ giác nội tiếp), đường tròn (tiếp tuyến, dây cung), hệ thức lượng trong tam giác vuông, diện tích và chu vi`,
    statistics: `trung bình cộng, tần số, biểu đồ, xác suất cơ bản`,
    combinatorics: `quy tắc đếm, hoán vị, chỉnh hợp, tổ hợp`,
  }

  return `Bạn là giáo viên Toán lớp 9 tại TP.HCM. Hãy tạo ${count} câu hỏi trắc nghiệm Toán cho kỳ thi tuyển sinh vào lớp 10 TP.HCM năm ${year}.

Chủ đề: ${topic} — ${topicGuide[topic]}
Độ khó: ${diffLabels.join(', ')} (câu ${startIdx + 1} đến ${startIdx + count})

YÊU CẦU:
- Câu hỏi đúng chuẩn đề thi tuyển sinh lớp 10 TP.HCM (không dùng kiến thức lớp 10)
- Mỗi câu có đúng 4 lựa chọn (A, B, C, D), chỉ 1 đáp án đúng
- Câu hỏi đa dạng, không lặp lại dạng bài
- Giải thích ngắn gọn, rõ ràng bước giải
- Với câu hình học: mô tả đủ dữ liệu (độ dài, góc, bán kính...) để vẽ hình
- Năm ${year}: điều chỉnh độ khó phù hợp với xu hướng đề thi năm đó

TRẢ VỀ JSON array (không có markdown):
[
  {
    "question": "Nội dung câu hỏi...",
    "choices": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
    "correct": 0,
    "explanation": "Giải: ..."
  }
]`
}

async function generateQuestionsForTopic(year, topic, count, startIdx) {
  const prompt = buildPrompt(year, topic, count, startIdx)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await callAI(SONNET, prompt, 4000)
      // Extract the outermost JSON array robustly (handles trailing text after array)
      const start = raw.indexOf('[')
      if (start === -1) throw new Error('No JSON array in response')
      let depth = 0, end = -1
      for (let i = start; i < raw.length; i++) {
        if (raw[i] === '[') depth++
        else if (raw[i] === ']') { depth--; if (depth === 0) { end = i; break } }
      }
      if (end === -1) throw new Error('Unclosed JSON array')
      const parsed = JSON.parse(raw.slice(start, end + 1))
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty array')
      return parsed.slice(0, count).map((q, i) => ({
        ...q,
        topic,
        difficulty: difficulty(startIdx + i),
        year,
        source: 'ai-generated',
      }))
    } catch (e) {
      console.warn(`  [WARN] ${year} ${topic} attempt ${attempt}: ${e.message}`)
      if (attempt < 3) await new Promise(r => setTimeout(r, 3000))
    }
  }
  return []
}

// ── SVG figure generation ─────────────────────────────────────────────────────

function isValidSvg(s) {
  return typeof s === 'string' && s.trimStart().startsWith('<svg') && s.includes('</svg>')
}

async function generateSvg(question) {
  const prompt = `Generate a minimal SVG diagram (viewBox="0 0 200 160", no width/height attrs) for this Vietnamese Grade 10 math geometry question.
Style: background rect fill="#0D1221", strokes stroke="#94A3B8", text fill="#F8FAFC" font-size="11" font-family="sans-serif". Mark right angles with a small square (5px).
Return ONLY the <svg> element — no explanation, no markdown fences.

Question: ${question}`
  try {
    const raw = await callAI(HAIKU, prompt, 600)
    const m = raw.match(/<svg[\s\S]*<\/svg>/i)
    return (m && isValidSvg(m[0])) ? m[0] : null
  } catch {
    return null
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function generateYear(year) {
  console.log(`\nGenerating ${year}...`)
  const questions = []
  let idx = 0

  for (const [topic, count] of TOPIC_DISTRIBUTION) {
    process.stdout.write(`  ${topic} (${count})... `)
    const qs = await generateQuestionsForTopic(year, topic, count, idx)
    console.log(`${qs.length} generated`)
    questions.push(...qs)
    idx += count
    await new Promise(r => setTimeout(r, 2000))
  }

  // Add SVG figures for geometry questions
  if (!skipFigures) {
    const geoQs = questions.filter(q => q.topic === 'geometry')
    process.stdout.write(`  figures (${geoQs.length} geometry)... `)
    let figCount = 0
    for (const q of geoQs) {
      const svg = await generateSvg(q.question)
      if (svg) {
        q.figure = { type: 'svg', data: svg }
        figCount++
      }
      await new Promise(r => setTimeout(r, 1000))
    }
    console.log(`${figCount} SVGs generated`)
  }

  return questions
}

async function main() {
  mkdirSync(RAW_DIR, { recursive: true })
  console.log(`Generating ${YEARS.length} exam years: ${YEARS.join(', ')}`)
  console.log(`Model: ${SONNET} (questions), ${HAIKU} (figures)`)

  const allRaw = []

  for (const year of YEARS) {
    const questions = await generateYear(year)
    allRaw.push(...questions)
    writeFileSync(join(RAW_DIR, `ai-${year}.json`), JSON.stringify(questions, null, 2))
    console.log(`  year ${year}: ${questions.length} questions saved`)
    // Pause between years to be gentle on rate limits
    if (year !== YEARS[YEARS.length - 1]) await new Promise(r => setTimeout(r, 3000))
  }

  writeFileSync(join(RAW_DIR, 'questions-raw.json'), JSON.stringify(allRaw, null, 2))
  console.log(`\nRaw total: ${allRaw.length} questions`)

  // Run through pipeline
  const normalized = normalize.questions(allRaw)
  const tagged     = tag(normalized)
  const deduped    = dedupe(tagged)
  const exams      = normalize.exams(deduped)

  writeFileSync(join(OUTPUT_DIR, 'questions.json'), JSON.stringify(deduped, null, 2))
  writeFileSync(join(OUTPUT_DIR, 'exams.json'),     JSON.stringify(exams, null, 2))

  console.log(`\nDone.`)
  console.log(`  ${deduped.length} questions → output/questions.json`)
  console.log(`  ${exams.length} exams      → output/exams.json`)
  console.log(`\nNext steps:`)
  console.log(`  npm run crawl:preview   # review SVG figures`)
  console.log(`  npm run crawl:publish   # publish to src/data/`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })

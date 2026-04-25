import axios from 'axios'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_PATH  = join(__dirname, '../../../../backend/.env')

function loadEnv() {
  if (!existsSync(ENV_PATH)) return {}
  const env = {}
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim()
  }
  return env
}

function isValidSvg(data) {
  return typeof data === 'string' && data.trimStart().startsWith('<svg') && data.includes('</svg>')
}

async function generateSvg(question, env, attempt = 1) {
  const baseUrl = env.ANTHROPIC_BASE_URL || 'https://ai-router.locdo.tech'
  const token   = env.ANTHROPIC_AUTH_TOKEN
  const model   = env.ANTHROPIC_DEFAULT_HAIKU_MODEL || 'claude-haiku-4.5'

  const prompt = `Generate a minimal SVG diagram (viewBox="0 0 200 160", no width/height attrs) for this Vietnamese Grade 10 math geometry problem. Dark theme: add a background <rect width="200" height="160" fill="#0D1221"/>, draw shapes with stroke="#94A3B8" stroke-width="1.5" fill="none", add text labels with fill="#F8FAFC" font-size="11" font-family="sans-serif". Mark right angles with a small 6px square. Keep it simple and accurate. Output ONLY the raw <svg> element — no markdown, no explanation.

Question: ${question}`

  try {
    const res = await axios.post(
      `${baseUrl}/v2/chat/completions`,
      { model, max_tokens: 1000, messages: [{ role: 'user', content: prompt }] },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 25000 }
    )
    const text = res.data?.choices?.[0]?.message?.content ?? ''
    // Extract first complete <svg>...</svg> block
    const start = text.indexOf('<svg')
    const end   = text.lastIndexOf('</svg>')
    if (start === -1 || end === -1) return null
    const svg = text.slice(start, end + 6)
    return isValidSvg(svg) ? svg : null
  } catch (e) {
    if (e.response?.status === 429 && attempt <= 4) {
      const wait = attempt * 8000  // 8s, 16s, 24s, 32s
      await new Promise(r => setTimeout(r, wait))
      return generateSvg(question, env, attempt + 1)
    }
    throw e
  }
}

export async function addFigures(questions) {
  const env = loadEnv()
  if (!env.ANTHROPIC_AUTH_TOKEN) {
    console.warn('  [WARN] figure.js: ANTHROPIC_AUTH_TOKEN not found — skipping figure generation')
    return questions
  }

  const needsFigure = questions.filter(q => q.needs_figure && !q.figure?.data)
  console.log(`  figures: ${needsFigure.length} questions need SVG generation`)

  // Sequential with generous delay to stay under rate limit
  for (let i = 0; i < needsFigure.length; i++) {
    const q = needsFigure[i]
    process.stdout.write(`  figure ${i + 1}/${needsFigure.length} (${q.id})... `)
    try {
      const svg = await generateSvg(q.question, env)
      if (svg) {
        q.figure = { type: 'svg', data: svg }
        process.stdout.write('OK\n')
      } else {
        q.figure = { type: 'svg', data: null, error: 'invalid SVG returned' }
        process.stdout.write('invalid SVG\n')
      }
    } catch (e) {
      q.figure = { type: 'svg', data: null, error: e.message }
      process.stdout.write(`error: ${e.message}\n`)
    }
    // 4s between each request — safe for 20 req/min limit
    if (i < needsFigure.length - 1) await new Promise(r => setTimeout(r, 4000))
  }

  const succeeded = questions.filter(q => q.figure?.data).length
  console.log(`  figures: ${succeeded} total SVGs now present`)
  return questions
}

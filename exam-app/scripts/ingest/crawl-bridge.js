import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { listPending, markIngested } from './state.js'
import { chunkQuestions } from './formatter.js'
import { ingestChunk } from './httpClient.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const QUESTIONS_PATH = join(__dirname, '../crawl/output/questions.json')
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

const dryRun = process.argv.includes('--dry-run')
const onlyArg = process.argv.find(a => a.startsWith('--only='))?.split('=')[1]
const onlyKeys = onlyArg ? new Set(onlyArg.split(',')) : null

function groupBySourceKey(questions) {
  const groups = new Map()
  for (const q of questions) {
    const key = `${q.source}_${q.year}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(q)
  }
  return groups
}

async function main() {
  const questions = JSON.parse(readFileSync(QUESTIONS_PATH, 'utf8'))
  const groups = groupBySourceKey(questions)
  const allKeys = [...groups.keys()]
  let pendingKeys = listPending(allKeys)
  if (onlyKeys) pendingKeys = pendingKeys.filter(k => onlyKeys.has(k))

  console.log(`Total source keys: ${allKeys.length} | pending: ${pendingKeys.length}`)

  if (dryRun) {
    console.log('DRY RUN — keys that would be ingested:')
    pendingKeys.forEach((k, i) => console.log(`  [${i + 1}/${pendingKeys.length}] ${k} (${groups.get(k).length} questions)`))
    return
  }

  let done = 0
  for (const key of pendingKeys) {
    done++
    const chunks = chunkQuestions(groups.get(key))
    let totalProblems = 0
    let totalWikiUnits = 0
    try {
      for (const chunk of chunks) {
        const res = await ingestChunk(chunk, BACKEND_URL)
        totalProblems += res.problems
        totalWikiUnits += res.wiki_units
      }
      markIngested(key)
      console.log(`[${done}/${pendingKeys.length}] ${key} → ${totalProblems} problems, ${totalWikiUnits} wiki_units`)
    } catch (e) {
      console.error(`[${done}/${pendingKeys.length}] ${key} FAILED: ${e.message}`)
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })

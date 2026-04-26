/**
 * HSG (Học sinh giỏi) math competition scraper — thuvienhoclieu.com
 * Returns competition problems tagged source:"hsg", difficulty:"hard".
 */
import * as cheerio from 'cheerio'
import { http } from '../../httpClient.js'
import { parseQuestionBlock } from '../../pipeline/normalize.js'

const BASE = 'https://thuvienhoclieu.com'
const LISTING = '/toan/hsg'
const YEAR_RANGE = [2018, 2019, 2020, 2021, 2022, 2023, 2024]

export async function crawlHSG() {
  let listing
  try {
    listing = await http.get(BASE + LISTING)
  } catch (e) {
    console.warn(`  [WARN] hsg listing: ${e.message}`)
    return []
  }

  const $ = cheerio.load(listing.data)
  const byYear = {}
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (!href.toLowerCase().includes('hsg') && !href.includes('hoc-sinh-gioi')) return
    const m = href.match(/20(\d{2})/)
    if (!m) return
    const year = 2000 + parseInt(m[1])
    if (!YEAR_RANGE.includes(year) || byYear[year]) return
    byYear[year] = href.startsWith('http') ? href : BASE + href
  })

  const results = []
  for (const [year, url] of Object.entries(byYear)) {
    try {
      const page = await http.get(url)
      const $p = cheerio.load(page.data)
      const text = $p('.post-content, .article-content, .entry-content').text()
      const questions = parseQuestionBlock(text, parseInt(year), 'hsg')
      results.push(...questions.map(q => ({ ...q, difficulty: 'hard' })))
      console.log(`  hsg ${year}: ${questions.length} questions`)
      await new Promise(r => setTimeout(r, 1500))
    } catch (e) {
      console.warn(`  [WARN] hsg ${year}: ${e.message}`)
    }
  }
  return results
}

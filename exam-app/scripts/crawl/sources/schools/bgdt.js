/**
 * BGDT (Bộ Giáo dục và Đào tạo) official exam scraper — moet.gov.vn
 * Returns structured exam questions tagged source:"bgdt_official".
 * Deduplicates against hcmedu output by source key.
 */
import * as cheerio from 'cheerio'
import { http } from '../../httpClient.js'
import { parseQuestionBlock } from '../../pipeline/normalize.js'

const BASE = 'https://moet.gov.vn'
const LISTING = '/giaoducquocdan/de-thi-vao-lop-10'
const YEAR_RANGE = [2018, 2019, 2020, 2021, 2022, 2023, 2024]

export async function crawlBGDT() {
  let listing
  try {
    listing = await http.get(BASE + LISTING)
  } catch (e) {
    console.warn(`  [WARN] bgdt listing: ${e.message}`)
    return []
  }

  const $ = cheerio.load(listing.data)
  const byYear = {}
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (!href.includes('toan') && !href.includes('de-thi')) return
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
      const text = $p('.post-content, .article-content, .entry-content, .content').text()
      const questions = parseQuestionBlock(text, parseInt(year), 'bgdt_official')
      results.push(...questions)
      console.log(`  bgdt_official ${year}: ${questions.length} questions`)
      await new Promise(r => setTimeout(r, 1500))
    } catch (e) {
      console.warn(`  [WARN] bgdt_official ${year}: ${e.message}`)
    }
  }
  return results
}

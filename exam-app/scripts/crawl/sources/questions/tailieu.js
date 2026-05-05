import * as cheerio from 'cheerio'
import { http } from '../../httpClient.js'
import { parseQuestionBlock } from '../../pipeline/normalize.js'

const BASE = 'https://tailieu.vn'
const TAG  = '/tag/toan-vao-lop-10-tphcm'
const YEAR_RANGE = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]

export async function crawlTaiLieu() {
  const res = await http.get(BASE + TAG)
  const $ = cheerio.load(res.data)

  const byYear = {}
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (!href.includes('de-thi') && !href.includes('toan')) return
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
      const text = $p('.document-content, .content-detail, article').text()
      const questions = parseQuestionBlock(text, parseInt(year), 'tailieu')
      if (questions.length === 0) {
        console.warn(`  [WARN] tailieu ${year}: 0 questions parsed`)
        continue
      }
      results.push(...questions)
      console.log(`  tailieu ${year}: ${questions.length} questions`)
      await new Promise(r => setTimeout(r, 1500))
    } catch (e) {
      console.warn(`  [WARN] tailieu ${year}: ${e.message}`)
    }
  }
  return results
}

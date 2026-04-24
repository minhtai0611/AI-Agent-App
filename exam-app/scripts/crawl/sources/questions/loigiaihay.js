import axios from 'axios'
import * as cheerio from 'cheerio'
import { parseQuestionBlock } from '../../pipeline/normalize.js'

const BASE = 'https://loigiaihay.com'
const LISTING = '/de-thi-vao-lop-10'

export async function crawlLoiGiaiHay() {
  const res = await axios.get(BASE + LISTING, { timeout: 10000 })
  const $ = cheerio.load(res.data)
  const links = []
  $('a[href*="de-thi"]').each((_, el) => {
    const href = $(el).attr('href')
    if (href && !links.includes(href)) links.push(href)
  })

  const results = []
  for (const link of links.slice(0, 10)) {
    try {
      const url = link.startsWith('http') ? link : BASE + link
      const page = await axios.get(url, { timeout: 10000 })
      const $p = cheerio.load(page.data)
      const text = $p('.post-content, article').text()
      const yearMatch = url.match(/20(\d{2})/)
      const year = yearMatch ? 2000 + parseInt(yearMatch[1]) : 2022
      const questions = parseQuestionBlock(text, year, 'loigiaihay')
      results.push(...questions)
      await new Promise(r => setTimeout(r, 1500))
    } catch (e) {
      console.warn(`  loigiaihay skip ${link}: ${e.message}`)
    }
  }
  return results
}

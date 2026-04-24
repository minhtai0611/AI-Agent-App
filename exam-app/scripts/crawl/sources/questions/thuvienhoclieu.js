import axios from 'axios'
import * as cheerio from 'cheerio'
import { parseQuestionBlock } from '../../pipeline/normalize.js'

const BASE = 'https://thuvienhoclieu.com'
const TAG  = '/de-thi-thu-toan-lop-10-tphcm'

export async function crawlThuVienHocLieu() {
  const res = await axios.get(BASE + TAG, { timeout: 10000 })
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
      const text = $p('.entry-content, .post-content').text()
      const yearMatch = url.match(/20(\d{2})/)
      const year = yearMatch ? 2000 + parseInt(yearMatch[1]) : 2023
      const questions = parseQuestionBlock(text, year, 'thuvienhoclieu')
      results.push(...questions)
      await new Promise(r => setTimeout(r, 1500))
    } catch (e) {
      console.warn(`  thuvienhoclieu skip ${link}: ${e.message}`)
    }
  }
  return results
}

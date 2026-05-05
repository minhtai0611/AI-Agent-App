import axios from 'axios'
import * as cheerio from 'cheerio'

const BASE = 'https://hcm.edu.vn'
const DIRECTORY = '/truong-thpt'

const TYPE_MAP = { 'chuyên': 'chuyên', 'chất lượng cao': 'chất_lượng_cao', 'thường': 'thường' }

export async function crawlHcmedu() {
  const results = []
  try {
    const res = await axios.get(BASE + DIRECTORY, { timeout: 10000 })
    const $ = cheerio.load(res.data)
    $('.school-item, tr').each((_, el) => {
      const name     = $(el).find('.school-name, td:nth-child(1)').text().trim()
      const district = $(el).find('.district, td:nth-child(2)').text().trim()
      const typeRaw  = $(el).find('.type, td:nth-child(3)').text().trim().toLowerCase()
      const type     = TYPE_MAP[typeRaw] ?? 'thường'
      if (!name) return
      const id = name.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
        .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      results.push({ type: 'profile', id: `thpt_${id}`, name, district, type })
    })
  } catch (e) {
    console.warn(`  hcmedu: ${e.message}`)
  }
  return results
}

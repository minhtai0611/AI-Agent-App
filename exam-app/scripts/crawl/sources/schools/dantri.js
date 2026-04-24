import axios from 'axios'
import * as cheerio from 'cheerio'

const BASE = 'https://dantri.com.vn'
const YEARS = [2020, 2021, 2022, 2023, 2024]

export async function crawlDantri() {
  const results = []
  for (const year of YEARS) {
    const url = `${BASE}/giao-duc-huong-nghiep/diem-chuan-vao-lop-10-tphcm-${year}.htm`
    try {
      const res = await axios.get(url, { timeout: 10000 })
      const $ = cheerio.load(res.data)
      const primary = {}
      $('table tr').each((_, row) => {
        const cells = $(row).find('td')
        if (cells.length < 3) return
        const name  = $(cells[0]).text().trim()
        const math  = parseFloat($(cells[1]).text())
        const total = parseFloat($(cells[2]).text())
        if (!name || isNaN(math)) return
        if (primary[name]) {
          // cross-validation: flag conflict if > 0.5 difference
          if (Math.abs(primary[name].math - math) > 0.5) {
            results.push({ type: 'conflict', name, year, primary: primary[name].math, secondary: math })
          }
        } else {
          primary[name] = { math, total }
          results.push({ type: 'cutoff', name, source: 'dantri', cutoffs: { [year]: { math, total } } })
        }
      })
      await new Promise(r => setTimeout(r, 1500))
    } catch (e) {
      console.warn(`  dantri ${year}: ${e.message}`)
    }
  }
  return results
}

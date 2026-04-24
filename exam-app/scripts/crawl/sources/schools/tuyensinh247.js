import axios from 'axios'
import * as cheerio from 'cheerio'

const BASE = 'https://tuyensinh247.com'
const YEARS = [2020, 2021, 2022, 2023, 2024]

export async function crawlTuyenSinh247() {
  const results = []
  for (const year of YEARS) {
    const url = `${BASE}/diem-chuan-vao-lop-10-tphcm-${year}.html`
    try {
      const res = await axios.get(url, { timeout: 10000 })
      const $ = cheerio.load(res.data)
      $('table tr').each((_, row) => {
        const cells = $(row).find('td')
        if (cells.length < 3) return
        const name  = $(cells[0]).text().trim()
        const math  = parseFloat($(cells[1]).text())
        const total = parseFloat($(cells[2]).text())
        if (!name || isNaN(math)) return
        results.push({ type: 'cutoff', name, source: 'tuyensinh247', cutoffs: { [year]: { math, total } } })
      })
      await new Promise(r => setTimeout(r, 1500))
    } catch (e) {
      console.warn(`  tuyensinh247 ${year}: ${e.message}`)
    }
  }
  return results
}

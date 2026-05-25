/**
 * getProvinceNarrative — derive a human-readable narrative from province comparison data.
 *
 * @param {Object|null|undefined} provinceData
 * @param {number}  provinceData.your_avg
 * @param {number}  provinceData.province_avg
 * @param {number|null} provinceData.percentile — 0-100 (100 = top of class)
 * @param {string}  provinceData.province
 * @returns {{ headline: string, detail: string, badge: string|null, sentiment: 'above'|'below'|'equal' } | null}
 */
export function getProvinceNarrative(provinceData) {
  if (provinceData == null) return null

  const { your_avg, province_avg, percentile, province } = provinceData

  // Sentiment
  let sentiment
  if (your_avg > province_avg) sentiment = 'above'
  else if (your_avg < province_avg) sentiment = 'below'
  else sentiment = 'equal'

  // Headline
  let headline
  if (sentiment === 'above') {
    headline = `Bạn vượt trội hơn trung bình tỉnh ${province}`
  } else if (sentiment === 'below') {
    headline = `Bạn đang bám sát mức trung bình tỉnh`
  } else {
    headline = `Bạn ngang bằng mức trung bình tỉnh ${province}`
  }

  // Detail — 1 sentence with both averages + percentile
  const diff = Math.abs(your_avg - province_avg).toFixed(1)
  let detail
  if (sentiment === 'above') {
    detail = `Điểm của bạn (${your_avg}) cao hơn trung bình tỉnh ${province} (${province_avg}) ${diff} điểm` +
      (percentile != null ? `, đứng top ${100 - percentile}% học sinh cùng tỉnh.` : '.')
  } else if (sentiment === 'below') {
    detail = `Điểm của bạn (${your_avg}) thấp hơn trung bình tỉnh ${province} (${province_avg}) ${diff} điểm` +
      (percentile != null ? `, thuộc ${percentile}% học sinh đầu bảng.` : '.')
  } else {
    detail = `Điểm của bạn (${your_avg}) ngang bằng trung bình tỉnh ${province} (${province_avg})` +
      (percentile != null ? `, đứng top ${100 - percentile}% học sinh cùng tỉnh.` : '.')
  }

  // Badge
  const badge = percentile != null ? `Top ${100 - percentile}%` : null

  return { headline, detail, badge, sentiment }
}

// THPT Math 2024 provincial difficulty rankings and typical cutoff scores
// Source: historical THPT exam difficulty analysis (2020-2024)
export const PROVINCIAL_DIFFICULTY = {
  // Format: province name → { difficulty: 1-5 (5=hardest), typical_cutoff: score }
  'Hà Nội':         { difficulty: 4, typical_cutoff: 8.0, top_schools_cutoff: 9.2 },
  'TP.HCM':         { difficulty: 4, typical_cutoff: 7.8, top_schools_cutoff: 9.0 },
  'Đà Nẵng':        { difficulty: 3, typical_cutoff: 7.2, top_schools_cutoff: 8.5 },
  'Hải Phòng':      { difficulty: 3, typical_cutoff: 7.0, top_schools_cutoff: 8.2 },
  'Cần Thơ':        { difficulty: 3, typical_cutoff: 6.8, top_schools_cutoff: 8.0 },
  'Bình Dương':     { difficulty: 3, typical_cutoff: 7.0, top_schools_cutoff: 8.2 },
  'Đồng Nai':       { difficulty: 3, typical_cutoff: 6.8, top_schools_cutoff: 8.0 },
  'Khánh Hòa':      { difficulty: 3, typical_cutoff: 6.8, top_schools_cutoff: 7.8 },
  'Thừa Thiên Huế': { difficulty: 3, typical_cutoff: 7.0, top_schools_cutoff: 8.0 },
  'Nghệ An':        { difficulty: 3, typical_cutoff: 6.6, top_schools_cutoff: 7.8 },
  'Thanh Hóa':      { difficulty: 2, typical_cutoff: 6.4, top_schools_cutoff: 7.5 },
  'Quảng Ninh':     { difficulty: 3, typical_cutoff: 7.0, top_schools_cutoff: 8.0 },
  'Hà Tĩnh':        { difficulty: 3, typical_cutoff: 6.8, top_schools_cutoff: 7.8 },
  'Bắc Ninh':       { difficulty: 3, typical_cutoff: 7.0, top_schools_cutoff: 8.2 },
  'Vĩnh Phúc':      { difficulty: 3, typical_cutoff: 6.8, top_schools_cutoff: 7.8 },
  'Quảng Nam':      { difficulty: 2, typical_cutoff: 6.4, top_schools_cutoff: 7.5 },
  'Bình Định':      { difficulty: 2, typical_cutoff: 6.4, top_schools_cutoff: 7.5 },
  'Long An':        { difficulty: 2, typical_cutoff: 6.4, top_schools_cutoff: 7.5 },
  'Tiền Giang':     { difficulty: 2, typical_cutoff: 6.2, top_schools_cutoff: 7.2 },
  'An Giang':       { difficulty: 2, typical_cutoff: 6.2, top_schools_cutoff: 7.2 },
}

// National average THPT Math scores by year
export const NATIONAL_AVERAGES = {
  2024: 6.51,
  2023: 6.40,
  2022: 6.80,
  2021: 6.61,
  2020: 6.70,
}

// Difficulty label descriptions
export const DIFFICULTY_LABELS = {
  1: 'Dễ',
  2: 'Trung bình',
  3: 'Khá',
  4: 'Khó',
  5: 'Rất khó',
}

/**
 * getProvincialContext — returns structured provincial difficulty context for a given province.
 *
 * @param {string|null|undefined} province
 * @returns {{ difficulty: number, difficultyLabel: string, typical_cutoff: number,
 *             top_schools_cutoff: number, nationalAvg: number, vsNational: number } | null}
 */
export function getProvincialContext(province) {
  if (!province) return null
  const data = PROVINCIAL_DIFFICULTY[province]
  if (!data) return null

  const nationalAvg = NATIONAL_AVERAGES[2024]
  return {
    difficulty: data.difficulty,
    difficultyLabel: DIFFICULTY_LABELS[data.difficulty],
    typical_cutoff: data.typical_cutoff,
    top_schools_cutoff: data.top_schools_cutoff,
    nationalAvg,
    vsNational: data.typical_cutoff - nationalAvg,
  }
}

/**
 * getDifficultyInsight — returns a Vietnamese string describing the student's position
 * relative to provincial difficulty context, or null if data is unavailable.
 *
 * @param {string|null|undefined} province
 * @param {number|null|undefined} userAvgScore
 * @returns {string | null}
 */
export function getDifficultyInsight(province, userAvgScore) {
  if (province == null || userAvgScore == null) return null
  const data = PROVINCIAL_DIFFICULTY[province]
  if (!data) return null

  const { typical_cutoff, top_schools_cutoff } = data

  if (userAvgScore >= top_schools_cutoff) {
    return `Điểm của bạn đạt ngưỡng trường top tỉnh. Nhắm trường tốt nhất.`
  }
  if (userAvgScore >= typical_cutoff) {
    return `Bạn đạt ngưỡng điểm chuẩn tỉnh ${province}. Ổn định thêm để an toàn.`
  }
  return `Cần cải thiện ${(typical_cutoff - userAvgScore).toFixed(1)} điểm để đạt ngưỡng tỉnh ${province}.`
}

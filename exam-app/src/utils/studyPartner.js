/**
 * canUseStudyPartners — returns true only for 'complete' tier users.
 * @param {string|null|undefined} tier
 * @returns {boolean}
 */
export function canUseStudyPartners(tier) {
  return tier === 'complete'
}

/**
 * getPartnerMatchLabel — returns a display string describing a candidate partner.
 * Example: "Cùng lớp 12 · Điểm TB 7.8 · Chênh lệch 0.3"
 *
 * @param {{ grade?: string, avg_score?: number|null, score_diff?: number|null, province?: string }} candidate
 * @returns {string}
 */
export function getPartnerMatchLabel(candidate = {}) {
  const { grade, avg_score, score_diff } = candidate

  const gradeStr = grade ? `Cùng lớp ${grade}` : 'Cùng lớp'
  const scoreStr = avg_score != null ? `Điểm TB ${Number(avg_score).toFixed(1)}` : 'Điểm TB —'
  const diffStr = score_diff != null ? `Chênh lệch ${Number(score_diff).toFixed(1)}` : 'Chênh lệch —'

  return `${gradeStr} · ${scoreStr} · ${diffStr}`
}

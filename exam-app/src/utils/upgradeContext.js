/**
 * getUpgradeContext — returns contextual upgrade info when the user's tier doesn't have access to a feature.
 *
 * Feature access:
 *   'study-plan': student, complete
 *   'strategy':   complete
 *   'province':   complete
 *
 * @param {'basic'|'student'|'complete'} tier
 * @param {'study-plan'|'strategy'|'province'} featureId
 * @returns {{ featureLabel: string, requiredTier: string, requiredTierLabel: string, pitch: string } | null}
 */

const FEATURE_REQUIREMENTS = {
  'study-plan': ['student', 'complete'],
  'strategy':   ['complete'],
  'province':   ['complete'],
}

const FEATURE_LABELS = {
  'study-plan': 'Kế hoạch học tập AI',
  'strategy':   'Chiến lược ôn thi AI',
  'province':   'So sánh tỉnh thành',
}

const TIER_LABELS = {
  student:  'Học sinh',
  complete: 'Toàn diện',
}

const PITCHES = {
  'study-plan': 'Nhận kế hoạch ôn tập 4 tuần cá nhân hoá dựa trên điểm yếu của bạn — chỉ từ gói Học sinh.',
  'strategy':   'AI phân tích toàn bộ lịch sử thi và tạo chiến lược ôn thi riêng cho bạn — tính năng độc quyền gói Toàn diện.',
  'province':   'Xem bạn đứng ở vị trí nào so với học sinh cùng tỉnh — chỉ có ở gói Toàn diện.',
}

export function getUpgradeContext(tier, featureId) {
  const allowed = FEATURE_REQUIREMENTS[featureId]
  if (!allowed) return null
  if (allowed.includes(tier)) return null

  // Determine minimum required tier
  const requiredTier = allowed[0] // e.g. 'student' or 'complete'

  return {
    featureLabel:     FEATURE_LABELS[featureId] ?? featureId,
    requiredTier,
    requiredTierLabel: TIER_LABELS[requiredTier] ?? requiredTier,
    pitch:            PITCHES[featureId] ?? `Tính năng này yêu cầu gói ${TIER_LABELS[requiredTier] ?? requiredTier}.`,
  }
}

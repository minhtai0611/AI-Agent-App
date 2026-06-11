/**
 * getTierGap — what features is this tier missing vs the next tier?
 *
 * @param {'basic'|'student'|'complete'} tier
 * @returns {{ missingFeatures: string[], ctaLabel: string, ctaTier: string } | null}
 */
export function getTierGap(tier) {
  if (tier === 'complete') return null

  if (tier === 'basic') {
    return {
      missingFeatures: [
        'Kế hoạch học tập AI cá nhân hoá 4 tuần',
        'Zenith AI không giới hạn (500 credits/tháng)',
        'AI Phân tích kết quả miễn phí',
        'Xu hướng tiến bộ 30 ngày',
      ],
      ctaLabel: 'Nâng lên gói Học sinh',
      ctaTier: 'student',
    }
  }

  // student tier
  return {
    missingFeatures: [
      'Chiến lược ôn thi AI cá nhân hoá (1 lần/tháng)',
      'So sánh điểm với học sinh cùng tỉnh',
      'Tạo đề thi AI riêng theo điểm yếu',
    ],
    ctaLabel: 'Khám phá gói Toàn diện',
    ctaTier: 'complete',
  }
}

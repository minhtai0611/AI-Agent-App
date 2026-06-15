const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000
const TRIAL_WINDOW_DAYS = 7
const HIGH_BALANCE_THRESHOLD = 100

export function getTopupRecommendation(creditLog, balance, packages) {
  const now = Date.now()
  const recentSpend = creditLog
    .filter(e => e.delta < 0 && now - new Date(e.created_at).getTime() <= SEVEN_DAYS_MS)
    .reduce((sum, e) => sum + Math.abs(e.delta), 0)

  if (recentSpend === 0) return null
  if (balance > HIGH_BALANCE_THRESHOLD) return null

  const dailyRate = recentSpend / 7
  const daysLeft = balance / dailyRate

  // Pick smallest pack that covers at least 14 days, else largest affordable
  const sorted = [...packages].sort((a, b) => a.credits - b.credits)
  const pack = sorted.find(p => p.credits / dailyRate >= 14) ?? sorted[sorted.length - 1]
  const coversDays = Math.round(pack.credits / dailyRate)

  const reasoning = `Bạn dùng trung bình ${dailyRate.toFixed(1)} lượt hỏi AI/ngày. Gói ${pack.label} đủ cho ~${coversDays} ngày.`

  return { pack, coversDays, reasoning }
}

export function getTrialUrgency(user) {
  if (!user || !user.trial_expires_at) return null

  const expiresAt = new Date(user.trial_expires_at).getTime()
  const now = Date.now()
  if (expiresAt <= now) return null

  const daysLeft = Math.floor((expiresAt - now) / 86400000)
  const pct = Math.min(1, Math.max(0, (TRIAL_WINDOW_DAYS - daysLeft) / TRIAL_WINDOW_DAYS))

  const message = daysLeft <= 1
    ? 'Hôm nay là ngày cuối dùng thử gói Student!'
    : `Còn ${daysLeft} ngày dùng thử — hãy trải nghiệm đầy đủ AI trước khi hết hạn.`

  const lossItems = [
    'Kế hoạch học tập 4 tuần',
    'Phân tích điểm yếu bằng AI',
    '500 lượt hỏi AI/tháng',
    'Gợi ý đề thi theo tỉnh thành',
  ]

  return { daysLeft, pct, message, lossItems }
}

export function getAnnualSavingsDays(monthlyPrice, annualPrice) {
  const savings = monthlyPrice * 12 - annualPrice
  return Math.max(0, Math.round((savings / monthlyPrice) * 30))
}

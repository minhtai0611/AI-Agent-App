export function generateProgressReport(user, results, streak, personalBest, radarData) {
  if (!user || !results || results.length === 0) return null

  const scores = results.map(r => r.score ?? 0)
  const totalExams = scores.length
  const avgScore = +(scores.reduce((s, x) => s + x, 0) / totalExams).toFixed(1)

  // Score improvement: avg of last 5 vs avg of first 5
  const window = Math.min(5, totalExams)
  const firstAvg = scores.slice(0, window).reduce((s, x) => s + x, 0) / window
  const lastAvg  = scores.slice(-window).reduce((s, x) => s + x, 0) / window
  const scoreImprovement = +(lastAvg - firstAvg).toFixed(1)

  // Topic rankings
  const sorted = [...(radarData || [])].sort((a, b) => b.score - a.score)
  const topTopics  = sorted.slice(0, 3).map(t => t.topic)
  const weakTopics = sorted.slice(-3).reverse().map(t => t.topic)

  const studentName = user.display_name
    || (user.email ? user.email.split('@')[0] : null)
    || 'Học viên'

  return {
    studentName,
    grade: user.grade ? `Lớp ${user.grade}` : null,
    totalExams,
    avgScore,
    scoreImprovement,
    streakDays: streak ?? 0,
    personalBest: personalBest ?? 0,
    topTopics,
    weakTopics,
    masteryRank: user.mastery_rank ?? null,
    solidConcepts: user.solid_concept_count ?? 0,
    generatedAt: new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  }
}

export function reportToText(report) {
  const lines = [
    `📊 Báo cáo học tập Vantage — ${report.generatedAt}`,
    `👤 ${report.studentName}${report.grade ? ` · ${report.grade}` : ''}`,
    ``,
    `📝 Đã hoàn thành: ${report.totalExams} bài thi`,
    `⭐ Điểm trung bình: ${report.avgScore}/10`,
    report.scoreImprovement > 0 ? `📈 Cải thiện: +${report.scoreImprovement} điểm so với ban đầu` : null,
    `🔥 Streak: ${report.streakDays} ngày · Kỷ lục: ${report.personalBest} ngày`,
  ]

  if (report.topTopics.length > 0) {
    lines.push(``, `✅ Điểm mạnh: ${report.topTopics.join(' · ')}`)
  }
  if (report.weakTopics.length > 0) {
    lines.push(`⚠️ Cần ôn thêm: ${report.weakTopics.join(' · ')}`)
  }

  lines.push(``, `🎓 Ôn thi cùng Vantage AI: https://exam-app-ey0.pages.dev`)

  return lines.filter(l => l !== null).join('\n')
}

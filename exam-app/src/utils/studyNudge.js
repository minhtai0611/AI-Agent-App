export function getStudyNudge(results) {
  if (!results || results.length === 0) return null

  const latest = results.reduce((a, b) =>
    new Date(a.finishedAt) > new Date(b.finishedAt) ? a : b
  )

  const gapHours = (Date.now() - new Date(latest.finishedAt).getTime()) / 3600000
  if (gapHours <= 24) return null

  const gapDays = Math.floor(gapHours / 24)

  if (gapDays >= 2) {
    return `Bạn chưa ôn luyện ${gapDays} ngày rồi. Một bài hôm nay giữ được đà tiến bộ.`
  }
  return 'Hôm qua bạn đã học, hôm nay tiếp tục để giữ streak nhé!'
}

import { getScoreProjection } from './scoreProjection.js'

export function getGoalStatus(user, sparkData) {
  if (!user?.exam_date) return null

  const daysUntil = Math.round(
    (new Date(user.exam_date).getTime() - Date.now()) / 86400000
  )
  if (daysUntil <= 0) return null

  const projection = getScoreProjection(sparkData, daysUntil)
  const currentScore = Array.isArray(sparkData) && sparkData.length >= 1
    ? sparkData[sparkData.length - 1].score
    : null

  let status, headline, detail

  if (!projection) {
    status = 'no_data'
    headline = daysUntil <= 30
      ? 'Ôn luyện ngay để có dữ liệu dự đoán'
      : 'Chưa đủ dữ liệu để dự đoán điểm số'
    detail = `Còn ${daysUntil} ngày đến ngày thi. Hoàn thành ít nhất 3 bài để xem dự đoán điểm số.`
  } else {
    const gain = projection.projectedScore - projection.currentScore
    if (gain >= 1.0) {
      status = 'ahead'
      headline = `Đang tiến bộ tốt — dự đoán đạt ${projection.projectedScore.toFixed(1)} điểm`
      detail = `Tăng ${gain.toFixed(1)} điểm trong ${daysUntil} ngày còn lại với đà học hiện tại.`
    } else if (gain >= 0.2) {
      status = 'steady'
      headline = `Điểm ổn định — dự đoán ${projection.projectedScore.toFixed(1)} điểm`
      detail = 'Tiếp tục ôn luyện đều đặn để duy trì đà tiến bộ đến ngày thi.'
    } else {
      status = 'at_risk'
      headline = 'Cần tăng tốc để cải thiện điểm trước ngày thi'
      detail = `Điểm hiện tại ${projection.currentScore.toFixed(1)} — tăng tần suất ôn luyện để bứt phá.`
    }
  }

  return {
    daysUntil,
    targetSchool: user.target_school ?? null,
    weeklyHours: user.weekly_study_hours ?? null,
    projectedScore: projection?.projectedScore ?? null,
    currentScore: projection?.currentScore ?? currentScore,
    status,
    headline,
    detail,
  }
}

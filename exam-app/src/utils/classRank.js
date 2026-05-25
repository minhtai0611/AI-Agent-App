/**
 * classRank.js
 * Given a GET /classes/me response, returns display-ready rank data for the student.
 */

/**
 * @param {object|null} classData - Response from GET /classes/me
 * @returns {object|null} Display-ready rank object, or null if not in a class
 */
export function getClassRankDisplay(classData) {
  if (!classData || classData.class_id == null) return null

  const {
    teacher_name: teacherName,
    subject,
    member_count: memberCount,
    your_rank: rank,
    your_avg_score: avgScore,
    class_avg_score: classAvg,
  } = classData

  const percentile = Math.round((1 - (rank - 1) / memberCount) * 100)
  const isTopHalf = rank <= Math.ceil(memberCount / 2)
  const badge = `Top ${percentile}%`

  return {
    teacherName,
    subject,
    memberCount,
    rank,
    total: memberCount,
    percentile,
    avgScore,
    classAvg,
    isTopHalf,
    badge,
  }
}

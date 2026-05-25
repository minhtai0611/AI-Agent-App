export function getAdvisorMessage({
  results,
  streak = 0,
  streakPB = 0,
  sessionPatterns = null,
  scoreProjection = null,
  goalStatus = null,
  weeklyReport = null,
  examPhase = null,
  progressReport = null,
}) {
  if (!results || results.length < 3) return null

  const totalExams = results.length
  const phaseId = examPhase?.id ?? 'explorer'

  // ── P1: urgent — critical/review phase + at_risk goal ────────────────────
  if ((phaseId === 'review' || phaseId === 'critical') && goalStatus?.status === 'at_risk') {
    return {
      category: 'urgent',
      message: `Còn ${goalStatus.daysUntil} ngày — cần tăng tốc ngay bây giờ. Tập trung vào điểm yếu, mỗi bài thi hôm nay đều có giá trị.`,
    }
  }

  // ── P2: goal ahead — projected improvement looks strong ──────────────────
  if (goalStatus?.status === 'ahead' && scoreProjection) {
    const { projectedScore, currentScore } = scoreProjection
    return {
      category: 'goal',
      message: `Đang đi đúng hướng — điểm dự đoán ${projectedScore.toFixed(1)} vào ngày thi (hiện tại ${currentScore.toFixed(1)}). Giữ đà này là đủ.`,
    }
  }

  // ── P3: strong score improvement ─────────────────────────────────────────
  if ((progressReport?.scoreImprovement ?? 0) >= 1.0) {
    const gain = progressReport.scoreImprovement
    return {
      category: 'progress',
      message: `Điểm của bạn đã tăng ${gain > 0 ? '+' : ''}${gain} so với lúc bắt đầu — tiến bộ rõ rệt qua ${totalExams} bài thi. Tiếp tục như vậy.`,
    }
  }

  // ── P4: day optimization — best score day differs from most active day ───
  if (
    sessionPatterns?.bestScoreDay &&
    sessionPatterns.bestScoreDay.dayIndex !== sessionPatterns.mostActiveDay.dayIndex
  ) {
    const { bestScoreDay, mostActiveDay } = sessionPatterns
    return {
      category: 'optimization',
      message: `Bạn học nhiều nhất vào ${mostActiveDay.dayName} nhưng điểm cao nhất vào ${bestScoreDay.dayName} (TB ${bestScoreDay.avgScore}). Thử ôn bài khó hơn vào ${bestScoreDay.dayName}.`,
    }
  }

  // ── P5: streak is personal best ──────────────────────────────────────────
  if (streak > 0 && streak >= streakPB && streakPB >= 5) {
    return {
      category: 'encouragement',
      message: `🔥 Streak ${streak} ngày — đây là kỷ lục cá nhân của bạn! Mỗi ngày ôn luyện đều xây dựng thói quen học mạnh hơn.`,
    }
  }

  // ── P6: consistency nudge — low streak despite good history ─────────────
  if (streak < 3 && totalExams >= 8) {
    return {
      category: 'consistency',
      message: `Bạn đã hoàn thành ${totalExams} bài thi — nền tảng tốt. Chỉ cần ôn đều hơn để streak tăng và điểm ổn định hơn.`,
    }
  }

  // ── P7: weak topic focus ─────────────────────────────────────────────────
  if (weeklyReport?.topWeakTopic) {
    return {
      category: 'encouragement',
      message: `Tuần này điểm yếu nhất là ${weeklyReport.topWeakTopic}. Một buổi ôn tập chuyên sâu chủ đề này sẽ giúp điểm tổng tăng nhanh nhất.`,
    }
  }

  // ── P8: default encouragement based on volume ────────────────────────────
  const avgScore = results.reduce((s, r) => s + (r.score ?? 0), 0) / totalExams
  return {
    category: 'encouragement',
    message: avgScore >= 8
      ? `Điểm trung bình ${avgScore.toFixed(1)} qua ${totalExams} bài thi — thành tích xuất sắc. Duy trì phong độ này nhé.`
      : `Đã hoàn thành ${totalExams} bài thi với điểm TB ${avgScore.toFixed(1)}. Mỗi bài thi là một bước tiến — tiếp tục ôn luyện đều đặn.`,
  }
}

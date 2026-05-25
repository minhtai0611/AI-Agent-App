/**
 * Exam-Day Simulation Mode utility
 * Returns a simulation mode object when the exam is within 14 days.
 */

const BRIEFINGS = {
  max: '3 ngày cuối — chỉ ôn trọng tâm, đừng học thêm mới. Giữ bình tĩnh và tin vào những gì đã ôn.',
  high: 'Còn dưới 1 tuần — tập trung vào dạng bài hay ra nhất, luyện tốc độ làm bài.',
  medium: 'Đang vào giai đoạn nước rút — duy trì ôn tập đều đặn và kiểm tra lại kiến thức nền.',
}

const FOCUS_TIPS = {
  max: 'Mỗi bài thi hôm nay tương đương 10 bài ôn thông thường — chất lượng hơn số lượng.',
  high: 'Ưu tiên làm đề thi thử có thời gian thực để quen với áp lực phòng thi.',
  medium: 'Mỗi ngày ôn ít nhất 1 chủ đề yếu và làm 5–10 câu trắc nghiệm để giữ nhịp.',
}

/**
 * @param {number|null|undefined} daysUntil - days until exam
 * @returns {{ active: true, daysUntil: number, intensity: 'max'|'high'|'medium', briefing: string, focusTip: string } | null}
 */
export function getSimulationMode(daysUntil) {
  if (daysUntil == null || daysUntil > 14 || daysUntil < 0) {
    return null
  }

  let intensity
  if (daysUntil <= 3) {
    intensity = 'max'
  } else if (daysUntil <= 7) {
    intensity = 'high'
  } else {
    intensity = 'medium'
  }

  return {
    active: true,
    daysUntil,
    intensity,
    briefing: BRIEFINGS[intensity],
    focusTip: FOCUS_TIPS[intensity],
  }
}

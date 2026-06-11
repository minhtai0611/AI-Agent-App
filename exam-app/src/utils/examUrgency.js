export const EXAM_PHASES = [
  {
    id: 'review',
    label: 'Ôn tập nước rút',
    icon: '🚨',
    colorPrimary: '#EF4444',
    bg: '#1A0808',
    border: '#EF444460',
    headline: 'Còn dưới 7 ngày — mỗi buổi ôn tập đều quan trọng',
    cta: 'Ôn luyện ngay',
  },
  {
    id: 'critical',
    label: 'Giai đoạn then chốt',
    icon: '⚠️',
    colorPrimary: '#F97316',
    bg: '#1A0E08',
    border: '#F9731660',
    headline: 'Tuần cuối — tập trung vào điểm yếu là ưu tiên số 1',
    cta: 'Luyện điểm yếu',
  },
  {
    id: 'urgent',
    label: 'Tăng tốc',
    icon: '🔥',
    colorPrimary: '#F59E0B',
    bg: '#1A1308',
    border: '#F59E0B60',
    headline: 'Hãy tăng cường luyện tập — còn đủ thời gian để bứt phá',
    cta: 'Luyện tập ngay',
  },
  {
    id: 'focused',
    label: 'Tập trung',
    icon: '📚',
    colorPrimary: '#818CF8',
    bg: '#0D1521',
    border: '#818CF860',
    headline: 'Đây là thời điểm vàng — xây nền tảng vững chắc',
    cta: 'Xem kế hoạch học',
  },
  {
    id: 'explorer',
    label: 'Khám phá',
    icon: '🗺️',
    colorPrimary: '#10B981',
    bg: '#0A1A12',
    border: '#10B98160',
    headline: 'Còn nhiều thời gian — khám phá rộng, xây nền kiến thức',
    cta: 'Bắt đầu học',
  },
]

export function getExamPhase(daysUntil) {
  if (daysUntil == null || daysUntil < 0) return null
  if (daysUntil < 7)  return EXAM_PHASES.find(p => p.id === 'review')
  if (daysUntil < 14) return EXAM_PHASES.find(p => p.id === 'critical')
  if (daysUntil < 30) return EXAM_PHASES.find(p => p.id === 'urgent')
  if (daysUntil < 60) return EXAM_PHASES.find(p => p.id === 'focused')
  return EXAM_PHASES.find(p => p.id === 'explorer')
}

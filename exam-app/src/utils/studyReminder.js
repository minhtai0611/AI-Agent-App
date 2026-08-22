const PERMISSION_ASKED_KEY = 'notif_permission_asked'
const WEEKLY_REPORT_KEY = 'weekly_report_shown_week'

function currentWeekKey() {
  const d = new Date()
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${week}`
}

export async function requestStudyReminder() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return
  if (localStorage.getItem(PERMISSION_ASKED_KEY)) return
  localStorage.setItem(PERMISSION_ASKED_KEY, '1')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return

  const reg = await navigator.serviceWorker.ready.catch(() => null)
  if (!reg) return

  // Show a reminder after ~24h via the service worker (best-effort)
  // For local-only scheduling we store intent and check on next load
  localStorage.setItem('study_reminder_enabled', '1')
}

/**
 * Show a weekly report notification on Sunday or Monday if not yet shown this week.
 * stats: { streak, masteredThisWeek, accuracyTrend }
 */
export function checkAndShowWeeklyReport({ streak = 0, masteredThisWeek = 0, accuracyTrend = null } = {}) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const dayOfWeek = new Date().getDay() // 0=Sun, 1=Mon
  if (dayOfWeek !== 0 && dayOfWeek !== 1) return

  const weekKey = currentWeekKey()
  if (localStorage.getItem(WEEKLY_REPORT_KEY) === weekKey) return
  localStorage.setItem(WEEKLY_REPORT_KEY, weekKey)

  const lines = []
  if (masteredThisWeek > 0) lines.push(`${masteredThisWeek} khái niệm vững mới tuần này`)
  if (accuracyTrend !== null) lines.push(`Độ chính xác: ${accuracyTrend}%`)
  if (streak > 0) lines.push(`Chuỗi học: ${streak} ngày`)

  const body = lines.length
    ? lines.join(' · ')
    : 'Bắt đầu tuần mới với một buổi ôn tập ngắn!'

  try {
    new Notification('Vantage — Tuần học vừa qua', {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'weekly-report',
    })
  } catch { /* ignore */ }
}

export function checkAndShowStudyReminder() {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  if (!localStorage.getItem('study_reminder_enabled')) return

  const lastKey = 'last_study_reminder_shown'
  const last = parseInt(localStorage.getItem(lastKey) ?? '0', 10)
  const now = Date.now()
  const oneDayMs = 24 * 60 * 60 * 1000

  if (now - last < oneDayMs) return

  const lastExamKey = 'last_exam_completed_at'
  const lastExam = parseInt(localStorage.getItem(lastExamKey) ?? '0', 10)
  if (lastExam && now - lastExam < oneDayMs) return

  localStorage.setItem(lastKey, String(now))
  try {
    new Notification('Vantage — Ôn tập hôm nay chưa?', {
      body: 'Một bài thi ngắn giúp bạn ghi nhớ kiến thức tốt hơn!',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'study-reminder',
    })
  } catch { /* ignore */ }
}

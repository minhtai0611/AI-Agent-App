const PERMISSION_ASKED_KEY = 'notif_permission_asked'

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
    new Notification('Zenith — Ôn tập hôm nay chưa?', {
      body: 'Một bài thi ngắn giúp bạn ghi nhớ kiến thức tốt hơn!',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'study-reminder',
    })
  } catch { /* ignore */ }
}

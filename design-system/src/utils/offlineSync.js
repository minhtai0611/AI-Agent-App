const QUEUE_KEY = 'offline-history-queue'

export function getPendingCount() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]').length
  } catch {
    return 0
  }
}

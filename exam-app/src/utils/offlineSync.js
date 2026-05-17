// Queues exam history entries for later sync when the device is offline.
// Uses localStorage (small payloads, no IndexedDB overhead needed).

const QUEUE_KEY = 'offline-history-queue'
const MAX_QUEUE = 20  // cap to avoid unbounded growth

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeQueue(q) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
    // Broadcast queue size so Navbar can show a status chip
    localStorage.setItem('offline_queue_size', String(q.length))
  } catch { /* quota exceeded — drop oldest */ }
}

export function enqueueHistoryEntry(entry) {
  const q = readQueue()
  // Deduplicate by result_id
  const filtered = q.filter(e => e.result_id !== entry.result_id)
  const next = [...filtered, entry].slice(-MAX_QUEUE)
  writeQueue(next)
}

export function getPendingCount() {
  return readQueue().length
}

// Calls postFn (which should be the real postHistory API call) for all queued entries.
// Removes successfully synced entries; leaves failures in the queue.
export async function flushQueue(postFn) {
  const q = readQueue()
  if (q.length === 0) return 0

  const remaining = []
  let flushed = 0
  for (const entry of q) {
    try {
      const { error } = await postFn([entry])
      if (!error) {
        flushed++
      } else {
        remaining.push(entry)
      }
    } catch {
      remaining.push(entry)
    }
  }
  writeQueue(remaining)
  return flushed
}

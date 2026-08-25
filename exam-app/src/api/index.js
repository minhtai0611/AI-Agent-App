import examsData from '../data/exams.json'

const _API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function _apiFetch(path) {
  const res = await fetch(`${_API_BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// In-memory caches
let _questionsCache = null  // { [id]: question }
let _questionsPromise = null

async function _loadQuestionsFromJson() {
  const { default: local } = await import('../data/questions.json')
  _questionsCache = Object.fromEntries(local.map(q => [q.id, q]))
  return local
}

export async function loadQuestions() {
  if (_questionsCache) return Object.values(_questionsCache)
  if (_questionsPromise) return _questionsPromise
  _questionsPromise = (async () => {
    try {
      const data = await _apiFetch('/questions')
      if (data?.length) {
        _questionsCache = Object.fromEntries(data.map(q => [q.id, q]))
        return data
      }
    } catch {}
    // Offline or backend-unavailable fallback — bundled JSON
    return _loadQuestionsFromJson()
  })()
  const result = await _questionsPromise
  _questionsPromise = null
  return result
}

// Exam list cache — populated from API, falls back to bundled JSON
let _examsCache = null

async function _loadExamsData() {
  if (_examsCache) return
  try {
    const data = await _apiFetch('/exams')
    _examsCache = data?.length ? data : examsData
  } catch {
    _examsCache = examsData
  }
}

export async function loadExams() {
  await _loadExamsData()
  return _examsCache.filter(e => e.mode !== 'thithu' && e.mode !== 'retired')
}

export async function loadThiThuExams() {
  await _loadExamsData()
  return _examsCache.filter(e => e.mode === 'thithu').sort((a, b) => b.year - a.year)
}

// Synchronous lookup (always uses bundled JSON — safe for sync render paths)
export function loadExamById(examId) {
  return examsData.find(e => e.id === examId) ?? null
}

// Async variant — fetches from API on cold cache, useful for deep-links before loadExams() runs
export async function loadExamByIdAsync(examId) {
  const fromJson = loadExamById(examId)
  if (fromJson) return fromJson
  try {
    return await _apiFetch(`/exams/${examId}`)
  } catch {
    return null
  }
}

export async function loadQuestionsByIds(ids) {
  const data = await loadQuestions()
  const map = Object.fromEntries(data.map(q => [q.id, q]))
  return ids.map(id => map[id]).filter(Boolean)
}

// Content-issue reporting (Phase 2) — a bug report on the content ("this rendered
// wrong", "this answer key looks wrong"), not a learning-experience survey. No static
// fallback: there's nothing to report against when the backend is unreachable.
export async function reportQuestion(questionId, kind, note) {
  const res = await fetch(`${_API_BASE}/questions/${encodeURIComponent(questionId)}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, note }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// Content review queue — student-submitted reports and AI-audit-filed mismatches
// (backend/app/agent/auditor.py) both live in content_reports; no static fallback,
// there's nothing to review when the backend is unreachable.
export async function loadContentReports(kind) {
  const qs = kind ? `?kind=${encodeURIComponent(kind)}` : ''
  return _apiFetch(`/content-reports${qs}`)
}

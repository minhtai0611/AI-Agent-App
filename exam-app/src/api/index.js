import examsData from '../data/exams.json'
import schoolsData from '../data/schools.json'

const _API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function _apiFetch(path, token) {
  const res = await fetch(`${_API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
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
      const token = localStorage.getItem('auth_token')
      if (token) {
        const data = await _apiFetch('/questions', token)
        if (data?.length) {
          _questionsCache = Object.fromEntries(data.map(q => [q.id, q]))
          return data
        }
      }
    } catch {}
    // Offline fallback — JSON bundle
    return _loadQuestionsFromJson()
  })()
  const result = await _questionsPromise
  _questionsPromise = null
  return result
}

// Auth-gated variant — rejects unauthenticated callers
export async function loadQuestionsForExam() {
  const token = localStorage.getItem('auth_token')
  if (!token) throw new Error('auth_required')
  return loadQuestions()
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


export function loadSchools() {
  return schoolsData
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

export async function loadQuestionsByIds(ids, requireAuth = false) {
  const data = requireAuth ? await loadQuestionsForExam() : await loadQuestions()
  const map = Object.fromEntries(data.map(q => [q.id, q]))
  return ids.map(id => map[id]).filter(Boolean)
}

const PASS_THRESHOLD = 5.0
const GATED_MODES = new Set(['thithu', 'practice'])

/**
 * Returns which exam IDs are accessible based on sequential progression.
 * Within each category, exams sorted by year ascending; first is always open.
 * Each subsequent exam unlocks when: (a) previous year passed ≥ 5.0, OR
 * (b) user already has any result for it (grandfather clause for existing users).
 *
 * @param {Array} results - user's exam history (array of {examId, score})
 * @param {Array} allExams - exams currently in view (mode-filtered)
 * @returns {{ accessible: Set<string>, prerequisites: Object<string,string> }}
 */
export function getAccessibleExamIds(results, allExams) {
  const passedIds = new Set(results.filter(r => (r.score ?? 0) >= PASS_THRESHOLD).map(r => r.examId))
  const submittedIds = new Set(results.map(r => r.examId))
  const accessible = new Set()
  const prerequisites = {}

  for (const category of ['grade10', 'thpt']) {
    const ordered = allExams
      .filter(e => e.category === category && (GATED_MODES.has(e.mode) || !e.mode))
      .sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
    if (ordered.length === 0) continue
    accessible.add(ordered[0].id)
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1]
      const curr = ordered[i]
      prerequisites[curr.id] = prev.id
      if (passedIds.has(prev.id) || submittedIds.has(curr.id)) {
        accessible.add(curr.id)
      } else {
        break
      }
    }
  }
  return { accessible, prerequisites }
}

const DIFF_RANK = { hard: 3, medium: 2, easy: 1 }

// Normalize a Vietnamese province string for fuzzy matching
function _normProvince(p = '') {
  return p.toLowerCase()
    .replace(/thành phố|tp\.|tỉnh\s*/gi, '')
    .replace(/\bhcm\b|ho chi minh|hồ chí minh/gi, 'hcm')
    .trim()
}

// Get the most recent math cutoff score from a school record
function _latestCutoff(school) {
  const years = Object.keys(school.cutoffs || {}).sort().reverse()
  for (const yr of years) {
    const c = school.cutoffs[yr]?.math
    if (c != null) return c
  }
  return null
}

// Build matched school recommendations for the analyze payload
function _matchSchools(studentScore, province) {
  const userProv = _normProvince(province)
  return schoolsData
    .filter(s => {
      const cutoff = _latestCutoff(s)
      return cutoff !== null && Math.abs(studentScore - cutoff) <= 2.0
    })
    .sort((a, b) => {
      const aMatch = userProv && _normProvince(a.province).includes(userProv) ? 0 : 1
      const bMatch = userProv && _normProvince(b.province).includes(userProv) ? 0 : 1
      if (aMatch !== bMatch) return aMatch - bMatch
      return Math.abs(studentScore - _latestCutoff(a)) - Math.abs(studentScore - _latestCutoff(b))
    })
    .slice(0, 6)
    .map(s => ({
      school: { name: s.name },
      matchStrength: studentScore >= _latestCutoff(s) ? 'Rất phù hợp' : 'Khá phù hợp',
      cutoff: _latestCutoff(s),
    }))
}

// Province-only school lookup for admin panel (no score filter)
export function getSchoolsByProvince(province) {
  if (!province) return []
  const norm = _normProvince(province)
  return schoolsData
    .filter(s => _normProvince(s.province).includes(norm) || norm.includes(_normProvince(s.province)))
    .slice(0, 3)
}

// Builds the payload for /analyze including wrong questions.
export async function buildAnalyzePayload(result, history, _unused, examCategory, userProfile) {
  const exam = loadExamById(result.examId)
  const questions = exam ? await loadQuestionsByIds(exam.questionIds) : []

  const wrong = questions
    .filter(q => {
      const chosen = result.answers?.[q.id]
      return chosen !== undefined && chosen !== null && chosen !== q.correct
    })
    .map(q => ({
      topic: q.topic,
      difficulty: q.difficulty,
      question: q.question,
      correct_answer: q.choices[q.correct],
    }))
    .sort((a, b) => (DIFF_RANK[b.difficulty] || 0) - (DIFF_RANK[a.difficulty] || 0))
    .slice(0, 8)

  const province = userProfile?.province || userProfile?.location || ''
  const studentScore = result?.score ?? 0
  const schoolRecs = _matchSchools(studentScore, province)

  return {
    result,
    history,
    wrong_questions: wrong,
    school_recommendations: schoolRecs,
    exam_category: examCategory || exam?.category || "",
    user_profile: userProfile || {},
  }
}

// Returns { result, history, wrong_questions, topic_miss_counts } enriched
// with representative wrong questions (max 2–3 per topic, hardest first).
// Capped at 8 total so the prompt stays within token limits.
export async function buildStudyPlanPayload(result, history) {
  const exam = loadExamById(result.examId)
  const questions = exam ? await loadQuestionsByIds(exam.questionIds) : []

  const allWrong = questions
    .filter(q => {
      const chosen = result.answers?.[q.id]
      return chosen === undefined || chosen === null || chosen !== q.correct
    })
    .map(q => ({
      topic: q.topic,
      difficulty: q.difficulty,
      question: q.question,
      correct_answer: q.choices[q.correct],
      explanation: q.explanation || '',
    }))

  // Per-topic miss counts (full picture for the AI)
  const topic_miss_counts = {}
  for (const q of allWrong) {
    topic_miss_counts[q.topic] = (topic_miss_counts[q.topic] || 0) + 1
  }

  // Select up to 3 representative questions per topic, hardest first, 8 total
  const byTopic = {}
  for (const q of allWrong) {
    if (!byTopic[q.topic]) byTopic[q.topic] = []
    byTopic[q.topic].push(q)
  }
  for (const topic of Object.keys(byTopic)) {
    byTopic[topic].sort((a, b) => (DIFF_RANK[b.difficulty] || 0) - (DIFF_RANK[a.difficulty] || 0))
  }

  const wrong_questions = []
  const PER_TOPIC = 3
  for (const qs of Object.values(byTopic)) {
    wrong_questions.push(...qs.slice(0, PER_TOPIC))
  }
  wrong_questions.sort((a, b) => (DIFF_RANK[b.difficulty] || 0) - (DIFF_RANK[a.difficulty] || 0))
  wrong_questions.splice(8)

  return { result, history, wrong_questions, topic_miss_counts }
}

// Returns the best unattempted exam for the student given weak topics.
export async function recommendNextExam(weakTopics, attemptedExamIds) {
  const allQuestions = await loadQuestions()
  const allExams = examsData.filter(e => e.mode !== 'retired')

  const attempted = new Set(attemptedExamIds)
  const candidates = allExams.filter(e => !attempted.has(e.id))
  if (!candidates.length) return null

  const weakSet = new Set(weakTopics)

  // Score each candidate by weak-topic overlap with its questions
  const scores = await Promise.all(candidates.map(async exam => {
    const qs = exam.questionIds
      ? exam.questionIds.map(id => allQuestions.find(q => q.id === id)).filter(Boolean)
      : []
    const overlap = qs.filter(q => weakSet.has(q.topic)).length
    const ratio = qs.length > 0 ? overlap / qs.length : 0
    return { exam, score: ratio }
  }))

  scores.sort((a, b) => b.score - a.score)
  return scores[0]?.exam ?? null
}

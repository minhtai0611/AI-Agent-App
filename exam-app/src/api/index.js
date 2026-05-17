import examsData from '../data/exams.json'
import schoolsData from '../data/schools.json'

// Lazy-load questions.json — only fetched when first needed, then cached
let _questionsData = null
let _questionsPromise = null

async function _loadQuestionsAsync() {
  if (_questionsData) return _questionsData
  if (!_questionsPromise) {
    _questionsPromise = import('../data/questions.json').then(m => {
      _questionsData = m.default
      return _questionsData
    })
  }
  return _questionsPromise
}

export async function loadQuestions() {
  return _loadQuestionsAsync()
}

// Auth-gated variant used by exam flows — rejects unauthenticated callers
// before the questions bundle is parsed and handed to the caller.
export async function loadQuestionsForExam() {
  const token = localStorage.getItem('auth_token')
  if (!token) throw new Error('auth_required')
  return _loadQuestionsAsync()
}

export function loadExams() {
  return examsData.filter(e => e.mode !== 'thithu' && e.mode !== 'retired')
}

export function loadThiThuExams() {
  return examsData
    .filter(e => e.mode === 'thithu')
    .sort((a, b) => b.year - a.year)
}

export function loadSchools() {
  return schoolsData
}

export function loadExamById(examId) {
  return examsData.find(e => e.id === examId) ?? null
}

export async function loadQuestionsByIds(ids, requireAuth = false) {
  const data = requireAuth ? await loadQuestionsForExam() : await _loadQuestionsAsync()
  const map = Object.fromEntries(data.map(q => [q.id, q]))
  return ids.map(id => map[id]).filter(Boolean)
}

const DIFF_RANK = { hard: 3, medium: 2, easy: 1 }

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

  return {
    result,
    history,
    wrong_questions: wrong,
    school_recommendations: [],
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
  const allQuestions = await _loadQuestionsAsync()
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

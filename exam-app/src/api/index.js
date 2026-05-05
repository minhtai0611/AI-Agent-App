import questionsData from '../data/questions.json'
import examsData from '../data/exams.json'
import schoolsData from '../data/schools.json'

export function loadQuestions() {
  return questionsData
}

export function loadExams() {
  return examsData.filter(e => e.mode !== 'thithu')
}

export function loadThiThuExams() {
  return examsData
    .filter(e => e.mode === 'thithu')
    .sort((a, b) => b.year - a.year)
    .slice(0, 3)
}

export function loadSchools() {
  return schoolsData
}

export function loadExamById(examId) {
  return examsData.find(e => e.id === examId) ?? null
}

export function loadQuestionsByIds(ids) {
  const map = Object.fromEntries(questionsData.map(q => [q.id, q]))
  return ids.map(id => map[id]).filter(Boolean)
}

const DIFF_RANK = { hard: 3, medium: 2, easy: 1 }

// Returns { result, history, wrong_questions, topic_miss_counts } enriched
// with representative wrong questions (max 2–3 per topic, hardest first).
// Capped at 8 total so the prompt stays within token limits.
export function buildStudyPlanPayload(result, history) {
  const exam = loadExamById(result.examId)
  const questions = exam ? loadQuestionsByIds(exam.questionIds) : []

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

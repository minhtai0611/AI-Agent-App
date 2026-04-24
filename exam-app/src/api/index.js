import questionsData from '../data/questions.json'
import examsData from '../data/exams.json'
import schoolsData from '../data/schools.json'

export function loadQuestions() {
  return questionsData
}

export function loadExams() {
  return examsData
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

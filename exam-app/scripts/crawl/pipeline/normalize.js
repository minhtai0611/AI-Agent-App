const CHOICE_RE = /([A-D])[.)]\s*(.+?)(?=[A-D][.)]|$)/gi
const ANSWER_RE = /Câu\s*(\d+)[:\s]*([A-D])/gi
const QUESTION_RE = /Câu\s*(\d+)[:.]\s*([\s\S]+?)(?=Câu\s*\d+|Đáp án|$)/gi

const LETTER_TO_INDEX = { A: 0, B: 1, C: 2, D: 3 }

export function parseQuestionBlock(block, year, source) {
  const questions = []
  QUESTION_RE.lastIndex = 0
  let m
  while ((m = QUESTION_RE.exec(block)) !== null) {
    const num = parseInt(m[1])
    const body = m[2].trim()
    const choiceMatches = [...body.matchAll(new RegExp(CHOICE_RE.source, 'gi'))]
    const choices = choiceMatches.map(c => c[2].trim())
    if (choices.length !== 4) continue
    questions.push({ num, question: body.split(/[A-D][.)]/)[0].trim(), choices, year, source })
  }
  // parse answers separately and attach
  const answers = {}
  ANSWER_RE.lastIndex = 0
  let am
  while ((am = ANSWER_RE.exec(block)) !== null) {
    answers[parseInt(am[1])] = LETTER_TO_INDEX[am[2].toUpperCase()] ?? 0
  }
  return questions.map(q => ({ ...q, correct: answers[q.num] ?? 0 }))
}

function normalizeQuestions(raw) {
  return raw.map((q, i) => ({
    id: q.id || `q_${q.source}_${q.year}_${String(i + 1).padStart(3, '0')}`,
    source: q.source,
    year: q.year,
    topic: q.topic || 'algebra',
    difficulty: q.difficulty || 'medium',
    question: q.question,
    choices: q.choices,
    correct: typeof q.correct === 'number' ? q.correct : (LETTER_TO_INDEX[q.correct] ?? 0),
    explanation: q.explanation ?? null,
  }))
}

function normalizeExams(questions) {
  const byYear = {}
  for (const q of questions) {
    if (!byYear[q.year]) byYear[q.year] = []
    byYear[q.year].push(q.id)
  }
  return Object.entries(byYear).map(([year, ids]) => ({
    id: `hcmc_${year}_math`,
    year: parseInt(year),
    title: `Đề thi thử Toán - TPHCM ${year}`,
    duration: 90,
    questionIds: ids,
    totalQuestions: ids.length,
  }))
}

export const normalize = { questions: normalizeQuestions, exams: normalizeExams }

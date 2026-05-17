export function shuffleArray(arr) {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function shuffleChoices(question) {
  const indices = shuffleArray([0, 1, 2, 3])
  const choices = indices.map(i => question.choices[i])
  const correct = indices.indexOf(question.correct)
  return { choices, correct }
}

export function createSession(exam, questions, mode) {
  const shuffledQuestions = shuffleArray(questions).map(q => {
    const { choices, correct } = shuffleChoices(q)
    return { ...q, choices, correct }
  })
  return {
    exam,
    questions: shuffledQuestions,
    answers: {},
    mode,
    timeLeft: mode === 'timed' ? exam.duration * 60 : null,
    status: 'active',
    startedAt: new Date().toISOString(),
  }
}

export function tick(session) {
  if (session.timeLeft === null) return session
  if (session.timeLeft <= 1) return { ...session, timeLeft: 0, status: 'timeout' }
  return { ...session, timeLeft: session.timeLeft - 1 }
}

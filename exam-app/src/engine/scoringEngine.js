export function scoreExam(session) {
  const { questions, answers, exam } = session
  const startedAt = session.startedAt ?? new Date().toISOString()
  const finishedAt = new Date().toISOString()

  const timeSpent = session.mode === 'timed' && session.timeLeft !== null
    ? exam.duration * 60 - session.timeLeft
    : Math.round((new Date(finishedAt) - new Date(startedAt)) / 1000)

  // Derive topics from actual questions (replaces hardcoded 4-topic list)
  const allTopics = [...new Set(questions.map(q => q.topic).filter(Boolean))]
  const topicBreakdown = Object.fromEntries(
    allTopics.map(t => [t, { correct: 0, total: 0, accuracy: 0 }])
  )

  let correctCount = 0
  for (const q of questions) {
    const chosen = answers[q.id] ?? null
    const isCorrect = chosen !== null && chosen === q.correct
    if (isCorrect) correctCount++
    const tb = topicBreakdown[q.topic]
    if (tb) { tb.total++; if (isCorrect) tb.correct++ }
  }

  for (const tb of Object.values(topicBreakdown)) {
    tb.accuracy = tb.total > 0 ? tb.correct / tb.total : 0
  }

  const total = questions.length
  const score = total > 0 ? Math.round((correctCount / total) * 100) / 10 : 0
  const maxScore = 10
  const accuracy = total > 0 ? correctCount / total : 0
  const answeredCount = Object.values(answers).filter(v => v !== null).length

  return {
    id: `result_${Date.now()}`,
    examId: exam.id,
    startedAt,
    finishedAt,
    answers: { ...answers },
    score,
    maxScore,
    accuracy,
    timeSpent,
    topicBreakdown,
    answeredCount,
    timePerQuestion: session.timePerQuestion ?? {},
    // Shuffled choices+correct per question — used by Results.jsx to fix wrong-answer highlights
    questionData: Object.fromEntries(
      questions.map(q => [q.id, { choices: q.choices, correct: q.correct }])
    ),
  }
}

import { describe, it, expect } from 'vitest'
import { shuffleArray, shuffleChoices, createSession, tick } from '../examEngine.js'

const mockQuestion = {
  id: 'q1',
  question: 'Test?',
  choices: ['A', 'B', 'C', 'D'],
  correct: 2,
  topic: 'algebra',
  difficulty: 'easy',
}

const mockExam = { id: 'exam1', duration: 90, title: 'Test Exam' }

describe('shuffleArray', () => {
  it('returns same elements in different order', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7]
    const seen = new Set()
    for (let i = 0; i < 100; i++) {
      seen.add(JSON.stringify(shuffleArray(arr)))
    }
    expect(seen.size).toBeGreaterThan(1)
    expect(shuffleArray(arr)).toHaveLength(arr.length)
  })

  it('does not mutate original array', () => {
    const arr = [1, 2, 3]
    const original = [...arr]
    shuffleArray(arr)
    expect(arr).toEqual(original)
  })
})

describe('shuffleChoices', () => {
  it('returns 4 choices and a valid correct index', () => {
    for (let i = 0; i < 50; i++) {
      const { choices, correct } = shuffleChoices(mockQuestion)
      expect(choices).toHaveLength(4)
      expect(correct).toBeGreaterThanOrEqual(0)
      expect(correct).toBeLessThanOrEqual(3)
      expect(choices[correct]).toBe(mockQuestion.choices[mockQuestion.correct])
    }
  })

  it('correct is always valid index 0-3', () => {
    const allPositions = new Set()
    for (let i = 0; i < 200; i++) {
      const { correct } = shuffleChoices(mockQuestion)
      allPositions.add(correct)
    }
    expect(allPositions.size).toBe(4)
  })
})

describe('createSession', () => {
  it('timed mode: timeLeft = duration * 60', () => {
    const session = createSession(mockExam, [mockQuestion], 'timed')
    expect(session.timeLeft).toBe(90 * 60)
    expect(session.status).toBe('active')
  })

  it('practice mode: timeLeft = null', () => {
    const session = createSession(mockExam, [mockQuestion], 'practice')
    expect(session.timeLeft).toBeNull()
  })

  it('shuffles question order', () => {
    const questions = Array.from({ length: 10 }, (_, i) => ({
      ...mockQuestion, id: `q${i}`, question: `Q${i}?`, choices: [`${i}a`,`${i}b`,`${i}c`,`${i}d`],
    }))
    const orders = new Set()
    for (let i = 0; i < 20; i++) {
      const session = createSession(mockExam, questions, 'timed')
      orders.add(session.questions.map(q => q.id).join(','))
    }
    expect(orders.size).toBeGreaterThan(1)
  })
})

describe('tick', () => {
  it('decrements timeLeft by 1', () => {
    const session = { timeLeft: 100, status: 'active' }
    expect(tick(session).timeLeft).toBe(99)
  })

  it('at timeLeft === 1 sets status to timeout and timeLeft to 0', () => {
    const session = { timeLeft: 1, status: 'active' }
    const next = tick(session)
    expect(next.status).toBe('timeout')
    expect(next.timeLeft).toBe(0)
  })

  it('returns session unchanged when timeLeft is null', () => {
    const session = { timeLeft: null, status: 'active' }
    expect(tick(session)).toBe(session)
  })
})

import { describe, it, expect } from 'vitest'
import questions from '../../data/questions.json'

// T1/T8: question.image field — data shape contract
describe('question.image field', () => {
  it('at least one real image question exists', () => {
    const withImage = questions.filter(q => q.image != null)
    expect(withImage.length).toBeGreaterThanOrEqual(35)
  })

  it('first AMC 8 2019 figure question has a valid image URL', () => {
    const q = questions.find(q => q.id === 'q_amc8_19_21')
    expect(q).toBeDefined()
    expect(q.image).toMatch(/^\/images\/questions\/.+\.png$/)
  })

  it('all questions with image field have a valid URL format', () => {
    const withImage = questions.filter(q => q.image != null)
    for (const q of withImage) {
      expect(q.image, `${q.id}: invalid image URL`).toMatch(/^\/images\/questions\/.+\.(png|jpg|svg)$/)
    }
  })

  it('questions without image field are unaffected', () => {
    const withoutImage = questions.filter(q => q.image == null)
    expect(withoutImage.length).toBeGreaterThan(0)
  })
})

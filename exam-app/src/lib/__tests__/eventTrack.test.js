import { describe, it, expect, afterEach, vi } from 'vitest'
import { track } from '../eventTrack.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('track', () => {
  it('no-ops silently when no analytics script is loaded', () => {
    vi.stubGlobal('window', {})
    expect(() => track('exam_started', { examId: 'x' })).not.toThrow()
  })

  it('forwards to window.rybbit.event when present', () => {
    const calls = []
    vi.stubGlobal('window', { rybbit: { event: (...args) => calls.push(args) } })
    track('question_answered', { questionId: 'q1' })
    expect(calls).toEqual([['question_answered', { questionId: 'q1' }]])
  })

  it('forwards to window.plausible when present, wrapping props', () => {
    const calls = []
    vi.stubGlobal('window', { plausible: (...args) => calls.push(args) })
    track('exam_submitted', { examId: 'x', score: 5 })
    expect(calls).toEqual([['exam_submitted', { props: { examId: 'x', score: 5 } }]])
  })

  it('prefers rybbit over plausible when both are present', () => {
    const rybbitCalls = []
    const plausibleCalls = []
    vi.stubGlobal('window', {
      rybbit: { event: (...args) => rybbitCalls.push(args) },
      plausible: (...args) => plausibleCalls.push(args),
    })
    track('exam_paused', {})
    expect(rybbitCalls.length).toBe(1)
    expect(plausibleCalls.length).toBe(0)
  })

  it('never throws even if the analytics global itself throws', () => {
    vi.stubGlobal('window', { rybbit: { event: () => { throw new Error('boom') } } })
    expect(() => track('exam_started', {})).not.toThrow()
  })
})

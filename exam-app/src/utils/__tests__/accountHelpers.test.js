import { describe, it, expect } from 'vitest'
import { getInitialTab, formatCreditSessions } from '../accountHelpers.js'

describe('getInitialTab', () => {
  it('returns aitia when hash is #topup', () => {
    expect(getInitialTab('#topup')).toBe('aitia')
  })
  it('returns progress as default for empty hash', () => {
    expect(getInitialTab('')).toBe('progress')
  })
  it('returns progress as default for unrelated hash', () => {
    expect(getInitialTab('#other')).toBe('progress')
  })
  it('returns progress as default for null', () => {
    expect(getInitialTab(null)).toBe('progress')
  })
  it('returns progress as default for undefined', () => {
    expect(getInitialTab(undefined)).toBe('progress')
  })
})

describe('formatCreditSessions', () => {
  it('returns 0 lượt AI for zero balance', () => {
    expect(formatCreditSessions(0)).toBe('0 lượt AI')
  })
  it('calculates approximately 1 session per 2 credits', () => {
    expect(formatCreditSessions(2)).toBe('~1 lượt AI')
    expect(formatCreditSessions(10)).toBe('~5 lượt AI')
    expect(formatCreditSessions(100)).toBe('~50 lượt AI')
  })
  it('floors fractional results', () => {
    expect(formatCreditSessions(3)).toBe('~1 lượt AI')
    expect(formatCreditSessions(5)).toBe('~2 lượt AI')
  })
  it('handles large balances', () => {
    expect(formatCreditSessions(2000)).toBe('~1000 lượt AI')
  })
  it('handles balance of 1', () => {
    expect(formatCreditSessions(1)).toBe('~1 lượt AI')
  })
})

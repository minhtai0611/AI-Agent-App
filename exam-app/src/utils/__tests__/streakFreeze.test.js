import { describe, it, expect } from 'vitest'
import { getStreakFreezeInfo } from '../streakFreeze.js'

const make = (tier, balance) => ({ subscription_tier: tier, streak_freeze_count: balance })

describe('getStreakFreezeInfo', () => {
  // weeklyQuota per tier
  it('returns weeklyQuota=0 for basic tier', () => {
    expect(getStreakFreezeInfo(make('basic', 0)).weeklyQuota).toBe(0)
  })
  it('returns weeklyQuota=1 for student tier', () => {
    expect(getStreakFreezeInfo(make('student', 0)).weeklyQuota).toBe(1)
  })
  it('returns weeklyQuota=3 for complete tier', () => {
    expect(getStreakFreezeInfo(make('complete', 0)).weeklyQuota).toBe(3)
  })

  // balance reflects streak_freeze_count
  it('returns balance=0 when streak_freeze_count is 0', () => {
    expect(getStreakFreezeInfo(make('student', 0)).balance).toBe(0)
  })
  it('returns balance=2 when streak_freeze_count is 2', () => {
    expect(getStreakFreezeInfo(make('student', 2)).balance).toBe(2)
  })
  it('defaults balance to 0 when streak_freeze_count is undefined', () => {
    expect(getStreakFreezeInfo({ subscription_tier: 'student' }).balance).toBe(0)
  })

  // basic tier: always locked regardless of balance
  it('basic tier with balance 0: canFreeze=false, lockedReason=upgrade', () => {
    const info = getStreakFreezeInfo(make('basic', 0))
    expect(info.canFreeze).toBe(false)
    expect(info.lockedReason).toBe('upgrade')
  })
  it('basic tier with positive balance: canFreeze=false, lockedReason=upgrade', () => {
    const info = getStreakFreezeInfo(make('basic', 5))
    expect(info.canFreeze).toBe(false)
    expect(info.lockedReason).toBe('upgrade')
  })

  // student tier with balance > 0: allowed
  it('student tier with balance > 0: canFreeze=true, lockedReason=null', () => {
    const info = getStreakFreezeInfo(make('student', 1))
    expect(info.canFreeze).toBe(true)
    expect(info.lockedReason).toBeNull()
  })

  // complete tier with balance > 0: allowed
  it('complete tier with balance > 0: canFreeze=true, lockedReason=null', () => {
    const info = getStreakFreezeInfo(make('complete', 3))
    expect(info.canFreeze).toBe(true)
    expect(info.lockedReason).toBeNull()
  })

  // any tier with balance=0: empty
  it('student tier with balance=0: canFreeze=false, lockedReason=empty', () => {
    const info = getStreakFreezeInfo(make('student', 0))
    expect(info.canFreeze).toBe(false)
    expect(info.lockedReason).toBe('empty')
  })
  it('complete tier with balance=0: canFreeze=false, lockedReason=empty', () => {
    const info = getStreakFreezeInfo(make('complete', 0))
    expect(info.canFreeze).toBe(false)
    expect(info.lockedReason).toBe('empty')
  })
})

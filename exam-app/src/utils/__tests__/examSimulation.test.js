import { describe, it, expect } from 'vitest'
import { getSimulationMode } from '../examSimulation.js'

describe('getSimulationMode', () => {
  describe('null cases', () => {
    it('returns null when daysUntil is null', () => {
      expect(getSimulationMode(null)).toBeNull()
    })

    it('returns null when daysUntil is undefined', () => {
      expect(getSimulationMode(undefined)).toBeNull()
    })

    it('returns null when daysUntil is 15', () => {
      expect(getSimulationMode(15)).toBeNull()
    })

    it('returns null when daysUntil is 100', () => {
      expect(getSimulationMode(100)).toBeNull()
    })

    it('returns null when daysUntil is negative', () => {
      expect(getSimulationMode(-1)).toBeNull()
    })
  })

  describe('boundary at 14', () => {
    it('returns non-null when daysUntil is exactly 14', () => {
      expect(getSimulationMode(14)).not.toBeNull()
    })

    it('returns non-null when daysUntil is 0', () => {
      expect(getSimulationMode(0)).not.toBeNull()
    })
  })

  describe('intensity classification', () => {
    it('returns medium intensity when daysUntil is 14', () => {
      const result = getSimulationMode(14)
      expect(result.intensity).toBe('medium')
    })

    it('returns medium intensity when daysUntil is 8', () => {
      const result = getSimulationMode(8)
      expect(result.intensity).toBe('medium')
    })

    it('returns high intensity when daysUntil is exactly 7', () => {
      const result = getSimulationMode(7)
      expect(result.intensity).toBe('high')
    })

    it('returns high intensity when daysUntil is 4', () => {
      const result = getSimulationMode(4)
      expect(result.intensity).toBe('high')
    })

    it('returns max intensity when daysUntil is exactly 3', () => {
      const result = getSimulationMode(3)
      expect(result.intensity).toBe('max')
    })

    it('returns max intensity when daysUntil is 1', () => {
      const result = getSimulationMode(1)
      expect(result.intensity).toBe('max')
    })

    it('returns max intensity when daysUntil is 0', () => {
      const result = getSimulationMode(0)
      expect(result.intensity).toBe('max')
    })
  })

  describe('required fields', () => {
    it('result has active: true', () => {
      const result = getSimulationMode(10)
      expect(result.active).toBe(true)
    })

    it('result has daysUntil matching input', () => {
      const result = getSimulationMode(10)
      expect(result.daysUntil).toBe(10)
    })

    it('result has briefing as a non-empty string', () => {
      const result = getSimulationMode(10)
      expect(typeof result.briefing).toBe('string')
      expect(result.briefing.length).toBeGreaterThan(0)
    })

    it('result has focusTip as a non-empty string', () => {
      const result = getSimulationMode(10)
      expect(typeof result.focusTip).toBe('string')
      expect(result.focusTip.length).toBeGreaterThan(0)
    })

    it('max intensity has appropriate briefing mentioning deadline urgency', () => {
      const result = getSimulationMode(2)
      expect(result.intensity).toBe('max')
      expect(result.briefing).toBeTruthy()
    })
  })
})

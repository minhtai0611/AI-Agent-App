import { describe, it, expect } from 'vitest'
import { traceImplicitCurve, sampleInequalityCells } from '../marchingSquares.js'

const BOUNDS = { xMin: -3, xMax: 3, yMin: -3, yMax: 3 }

describe('traceImplicitCurve', () => {
  it('traces a circle x^2+y^2-4=0 with segment endpoints near radius 2', () => {
    const fn = (x, y) => x * x + y * y - 4
    const segments = traceImplicitCurve(fn, BOUNDS, { cols: 40, rows: 40 })
    expect(segments.length).toBeGreaterThan(10)
    for (const { x1, y1, x2, y2 } of segments) {
      expect(Math.hypot(x1, y1)).toBeCloseTo(2, 0)
      expect(Math.hypot(x2, y2)).toBeCloseTo(2, 0)
    }
  })

  it('returns no segments when the function never crosses zero in the domain', () => {
    const fn = (x, y) => x * x + y * y + 100
    expect(traceImplicitCurve(fn, BOUNDS)).toEqual([])
  })

  it('skips cells where the function throws or returns non-finite values, without throwing', () => {
    const fn = (x, y) => {
      if (x > 0) throw new Error('boom')
      return x + y
    }
    expect(() => traceImplicitCurve(fn, BOUNDS, { cols: 10, rows: 10 })).not.toThrow()
  })

  it('returns [] for a degenerate (zero-area) domain', () => {
    expect(traceImplicitCurve(() => 0, { xMin: 1, xMax: 1, yMin: -1, yMax: 1 })).toEqual([])
  })
})

describe('sampleInequalityCells', () => {
  it('returns cells inside a circle for x^2+y^2-4 < 0', () => {
    const fn = (x, y) => x * x + y * y - 4
    const cells = sampleInequalityCells(fn, '<', BOUNDS, { cols: 30, rows: 30 })
    expect(cells.length).toBeGreaterThan(0)
    for (const { x, y, w, h } of cells) {
      const cx = x + w / 2
      const cy = y + h / 2
      expect(cx * cx + cy * cy).toBeLessThan(4)
    }
  })

  it('returns [] for a non-inequality relop (nothing to shade for equality)', () => {
    const fn = (x, y) => x * x + y * y - 4
    expect(sampleInequalityCells(fn, '=', BOUNDS)).toEqual([])
  })

  it('does not throw when the function throws for some inputs', () => {
    const fn = (x, y) => {
      if (x > 0) throw new Error('boom')
      return -1
    }
    expect(() => sampleInequalityCells(fn, '<', BOUNDS, { cols: 10, rows: 10 })).not.toThrow()
  })
})

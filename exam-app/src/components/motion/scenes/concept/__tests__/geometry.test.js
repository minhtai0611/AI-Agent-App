import { describe, it, expect } from 'vitest'
import {
  pyramidGeometry, pyramidCrossSection, prismGeometry, sphereConeGeometry,
  vectorAddGeometry, functionSurfaceSample, solidOfRevolutionSample,
} from '../geometry.js'

describe('pyramidGeometry', () => {
  it('places a square base of the given side length centered at the origin', () => {
    const { baseVertices, apex } = pyramidGeometry({ base: 'square', base_side: 4, apex_height: 6 })
    expect(baseVertices).toHaveLength(4)
    for (const [x, y, z] of baseVertices) {
      expect(y).toBe(0)
      expect(Math.abs(x)).toBe(2)
      expect(Math.abs(z)).toBe(2)
    }
    expect(apex).toEqual([0, 6, 0])
  })

  it('throws for an unknown base shape', () => {
    expect(() => pyramidGeometry({ base: 'circle', apex_height: 6 })).toThrow(/unknown base/)
  })
})

describe('pyramidCrossSection', () => {
  const spec = { base: 'square', base_side: 4, apex_height: 6 }

  it('returns the full base at t=0', () => {
    const section = pyramidCrossSection(spec, 0)
    expect(section.map(([x, , z]) => [x, z])).toEqual(
      pyramidGeometry(spec).baseVertices.map(([x, , z]) => [x, z])
    )
  })

  it('collapses to the apex point at t=1', () => {
    const section = pyramidCrossSection(spec, 1)
    for (const [x, y, z] of section) {
      expect(x).toBeCloseTo(0)
      expect(z).toBeCloseTo(0)
      expect(y).toBe(6)
    }
  })

  it('rejects an out-of-range height ratio', () => {
    expect(() => pyramidCrossSection(spec, 1.5)).toThrow(/t must be in/)
  })
})

describe('prismGeometry', () => {
  it('extrudes the base polygon from y=0 to y=height', () => {
    const { bottom, top } = prismGeometry({ base: 'rectangle', base_dims: [2, 3], height: 5 })
    expect(bottom.every(([, y]) => y === 0)).toBe(true)
    expect(top.every(([, y]) => y === 5)).toBe(true)
    expect(bottom).toHaveLength(top.length)
  })
})

describe('sphereConeGeometry', () => {
  it('returns just radius for a sphere', () => {
    expect(sphereConeGeometry({ shape: 'sphere', radius: 3 })).toEqual({ shape: 'sphere', radius: 3 })
  })

  it('requires height for a cone/cylinder', () => {
    expect(() => sphereConeGeometry({ shape: 'cone', radius: 3 })).toThrow(/requires height/)
  })
})

describe('vectorAddGeometry', () => {
  it('chains vectors tip-to-tail and sums them from the origin', () => {
    const { segments, sum } = vectorAddGeometry({ dim: 2, vectors: [[1, 0], [0, 1]], show_sum: true })
    expect(segments[0]).toEqual({ start: [0, 0, 0], end: [1, 0, 0] })
    expect(segments[1]).toEqual({ start: [1, 0, 0], end: [1, 1, 0] })
    expect(sum).toEqual({ start: [0, 0, 0], end: [1, 1, 0] })
  })

  it('omits the sum vector when show_sum is false', () => {
    const { sum } = vectorAddGeometry({ dim: 2, vectors: [[1, 1]], show_sum: false })
    expect(sum).toBeNull()
  })
})

describe('functionSurfaceSample', () => {
  it('samples expr(x, y) across the full domain grid', () => {
    const points = functionSurfaceSample({ expr: 'x + y', domain: [0, 2, 0, 2] }, 2)
    expect(points).toHaveLength(3)
    expect(points[0]).toHaveLength(3)
    const [x, y, z] = points[2][2]
    expect(x).toBe(2)
    expect(z).toBe(2)
    expect(y).toBe(4) // expr(x=2, y=2) = 4
  })
})

describe('solidOfRevolutionSample', () => {
  it('samples expr(x) across the bounds', () => {
    const points = solidOfRevolutionSample({ expr: 'x**2', bounds: [0, 2] }, 2)
    expect(points).toEqual([[0, 0, 0], [1, 1, 0], [2, 4, 0]])
  })
})

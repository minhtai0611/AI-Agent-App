import { describe, it, expect } from 'vitest'
import {
  evaluateExpression, simplifyExpression, toMathjsSyntax, compileFunctionOfX,
  toComplex, toPolar, fromPolar,
} from '../casEngine.js'

describe('evaluateExpression', () => {
  const cases = [
    ['2 + 2', '4'],
    ['sqrt(16)', '4'],
    ['(3 + 5) * 2', '16'],
    ['2^10', '1024'],
  ]

  it.each(cases)('evaluates "%s" to "%s"', (expr, expected) => {
    const { value, error } = evaluateExpression(expr)
    expect(error).toBeNull()
    expect(value).toBe(expected)
  })

  it('returns null value and no error for empty input', () => {
    expect(evaluateExpression('')).toEqual({ value: null, error: null })
  })

  it('returns an error, never throws, for invalid syntax', () => {
    const { value, error } = evaluateExpression('2 +* 3')
    expect(value).toBeNull()
    expect(typeof error).toBe('string')
  })
})

describe('simplifyExpression', () => {
  it('combines like terms', () => {
    const { value, error } = simplifyExpression('x + x')
    expect(error).toBeNull()
    expect(value).toBe('2 * x')
  })

  it('returns an error, never throws, for invalid syntax', () => {
    const { error } = simplifyExpression('x +* y')
    expect(typeof error).toBe('string')
  })
})

describe('toMathjsSyntax', () => {
  it('converts sympy-style ** power to mathjs-style ^', () => {
    expect(toMathjsSyntax('x**2 + 2*x**3')).toBe('x^2 + 2*x^3')
  })

  it('leaves expressions without ** unchanged', () => {
    expect(toMathjsSyntax('x^2 + 1')).toBe('x^2 + 1')
  })
})

describe('compileFunctionOfX', () => {
  it('compiles a reusable (x) => number function', () => {
    const { fn, error } = compileFunctionOfX('x^2 + 1')
    expect(error).toBeNull()
    expect(fn(3)).toBe(10)
    expect(fn(0)).toBe(1)
  })

  it('returns a null fn and no error for empty input', () => {
    expect(compileFunctionOfX('')).toEqual({ fn: null, error: null })
  })

  it('returns an error, never throws, for invalid syntax', () => {
    const { fn, error } = compileFunctionOfX('x +* 1')
    expect(fn).toBeNull()
    expect(typeof error).toBe('string')
  })
})

describe('toComplex', () => {
  it('evaluates a rectangular complex expression', () => {
    const { re, im, error } = toComplex('3 + 4i')
    expect(error).toBeNull()
    expect(re).toBe(3)
    expect(im).toBe(4)
  })

  it('treats a real number as a complex number with zero imaginary part', () => {
    const { re, im, error } = toComplex('5')
    expect(error).toBeNull()
    expect(re).toBe(5)
    expect(im).toBe(0)
  })

  it('returns null and no error for empty input', () => {
    expect(toComplex('')).toEqual({ re: null, im: null, error: null })
  })

  it('returns an error, never throws, for invalid syntax', () => {
    const { re, error } = toComplex('3 +* 4i')
    expect(re).toBeNull()
    expect(typeof error).toBe('string')
  })
})

describe('toPolar', () => {
  it('converts a rectangular expression to polar form', () => {
    const { r, phi, error } = toPolar('3 + 4i')
    expect(error).toBeNull()
    expect(r).toBeCloseTo(5)
    expect(phi).toBeCloseTo(Math.atan2(4, 3))
  })

  it('returns an error, never throws, for invalid syntax', () => {
    const { r, error } = toPolar('3 +* 4i')
    expect(r).toBeNull()
    expect(typeof error).toBe('string')
  })
})

describe('fromPolar', () => {
  it('converts polar form back to rectangular, round-tripping with toPolar', () => {
    const { r, phi } = toPolar('3 + 4i')
    const { re, im, error } = fromPolar(r, phi)
    expect(error).toBeNull()
    expect(re).toBeCloseTo(3)
    expect(im).toBeCloseTo(4)
  })

  it('returns an error, never throws, for non-numeric input', () => {
    const { re, error } = fromPolar('not-a-number', 'also-not-a-number')
    expect(re).toBeNull()
    expect(typeof error).toBe('string')
  })
})

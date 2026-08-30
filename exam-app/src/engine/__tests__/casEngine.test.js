import { describe, it, expect } from 'vitest'
import {
  evaluateExpression, simplifyExpression, toMathjsSyntax, compileFunctionOfX,
  compileFunctionOfY, compileParametric, compilePolar, compileImplicit,
  toComplex, toPolar, fromPolar, compilePolynomialFromCoefficients,
} from '../casEngine.js'

describe('compilePolynomialFromCoefficients', () => {
  it('evaluates a linear fit (numpy.polyfit order: highest degree first)', () => {
    const fn = compilePolynomialFromCoefficients([2, 1]) // y = 2x + 1
    expect(fn(0)).toBeCloseTo(1)
    expect(fn(3)).toBeCloseTo(7)
  })

  it('evaluates a quadratic fit', () => {
    const fn = compilePolynomialFromCoefficients([1, 0, 0]) // y = x^2
    expect(fn(3)).toBeCloseTo(9)
  })

  it('never throws on empty/invalid coefficients', () => {
    expect(compilePolynomialFromCoefficients([])(1)).toBeNaN()
    expect(compilePolynomialFromCoefficients(null)(1)).toBeNaN()
  })
})

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

  it('binds extra scope variables (slider parameters) alongside x', () => {
    const { fn, error } = compileFunctionOfX('a*x^2', { a: 3 })
    expect(error).toBeNull()
    expect(fn(2)).toBe(12)
  })
})

describe('compileFunctionOfY', () => {
  it('compiles a reusable (y) => number function for x=f(y) curves', () => {
    const { fn, error } = compileFunctionOfY('y^2')
    expect(error).toBeNull()
    expect(fn(3)).toBe(9)
  })

  it('returns a null fn and no error for empty input', () => {
    expect(compileFunctionOfY('')).toEqual({ fn: null, error: null })
  })

  it('returns an error, never throws, for invalid syntax', () => {
    const { fn, error } = compileFunctionOfY('y +* 1')
    expect(fn).toBeNull()
    expect(typeof error).toBe('string')
  })
})

describe('compileParametric', () => {
  it('compiles a (t) => [x, y] function from two expressions', () => {
    const { fn, error } = compileParametric('cos(t)', 'sin(t)')
    expect(error).toBeNull()
    const [x, y] = fn(0)
    expect(x).toBeCloseTo(1)
    expect(y).toBeCloseTo(0)
  })

  it('returns a null fn and no error when either expression is empty', () => {
    expect(compileParametric('', 'sin(t)')).toEqual({ fn: null, error: null })
    expect(compileParametric('cos(t)', '')).toEqual({ fn: null, error: null })
  })

  it('returns an error, never throws, for invalid syntax', () => {
    const { fn, error } = compileParametric('t +* 1', 't')
    expect(fn).toBeNull()
    expect(typeof error).toBe('string')
  })
})

describe('compilePolar', () => {
  it('converts r(theta) into a (theta) => [x, y] parametric function', () => {
    const { fn, error } = compilePolar('2')
    expect(error).toBeNull()
    const [x, y] = fn(0)
    expect(x).toBeCloseTo(2)
    expect(y).toBeCloseTo(0)
  })

  it('returns an error, never throws, for invalid syntax', () => {
    const { fn, error } = compilePolar('r +* 1')
    expect(fn).toBeNull()
    expect(typeof error).toBe('string')
  })
})

describe('compileImplicit', () => {
  it('splits "lhs = rhs" into a g(x,y) = lhs - rhs function and relop "="', () => {
    const { fn, relop, error } = compileImplicit('x^2 + y^2 = 4')
    expect(error).toBeNull()
    expect(relop).toBe('=')
    expect(fn(2, 0)).toBeCloseTo(0)
    expect(fn(0, 0)).toBeCloseTo(-4)
  })

  it('handles inequality relops', () => {
    const { fn, relop, error } = compileImplicit('x^2 + y^2 < 4')
    expect(error).toBeNull()
    expect(relop).toBe('<')
    expect(fn(0, 0)).toBeLessThan(0)
  })

  it('defaults to relop "=" when no relational operator is present', () => {
    const { relop, error } = compileImplicit('x^2 + y^2 - 4')
    expect(error).toBeNull()
    expect(relop).toBe('=')
  })

  it('returns an error, never throws, for invalid syntax', () => {
    const { fn, error } = compileImplicit('x +* y = 4')
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

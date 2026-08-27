import { describe, it, expect } from 'vitest'
import { compileExpr } from '../mathExpr.js'

describe('compileExpr', () => {
  it('evaluates polynomial expressions with two variables', () => {
    const fn = compileExpr('x**2 + y**2')
    expect(fn({ x: 3, y: 4 })).toBe(25)
  })

  it('respects operator precedence (multiplication before addition)', () => {
    const fn = compileExpr('2 + 3 * 4')
    expect(fn({})).toBe(14)
  })

  it('handles unary minus and parentheses', () => {
    const fn = compileExpr('-(x + 1) * 2')
    expect(fn({ x: 3 })).toBe(-8)
  })

  it('supports the allow-listed function names', () => {
    expect(compileExpr('sqrt(x)')({ x: 16 })).toBe(4)
    expect(compileExpr('abs(x)')({ x: -7 })).toBe(7)
  })

  it('throws on an unknown identifier rather than silently returning NaN', () => {
    expect(() => compileExpr('x + z')({ x: 1 })).toThrow(/unknown identifier/)
  })

  it('throws on an unknown function name', () => {
    expect(() => compileExpr('foo(x)')).toThrow(/unknown function/)
  })

  it('throws on malformed input instead of eval-ing arbitrary code', () => {
    expect(() => compileExpr('x +')).toThrow()
    expect(() => compileExpr('alert(1)')).toThrow(/unknown function/)
  })
})

// Minimal safe expression compiler for AI-generated `expr` strings (function_surface,
// solid_of_revolution specs) — no eval()/new Function() on model output. Supports
// +, -, *, /, **, unary minus, parentheses, the variables passed in `vars`, and the
// function names below. Throws on anything else (unknown identifier, unbalanced
// parens, trailing tokens) — callers treat a throw as "cannot render this expr."

const FUNCTIONS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp, log: Math.log,
}

function tokenize(src) {
  const tokens = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) { i++; continue }
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      tokens.push({ type: 'num', value: parseFloat(src.slice(i, j)) })
      i = j
      continue
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++
      tokens.push({ type: 'ident', value: src.slice(i, j) })
      i = j
      continue
    }
    if (c === '*' && src[i + 1] === '*') { tokens.push({ type: 'op', value: '**' }); i += 2; continue }
    if ('+-*/(),'.includes(c)) { tokens.push({ type: 'op', value: c }); i++; continue }
    throw new Error(`mathExpr: unexpected character '${c}'`)
  }
  return tokens
}

// Recursive-descent parser: expr -> term (('+'|'-') term)*
//                            term -> pow (('*'|'/') pow)*
//                            pow  -> unary ('**' unary)?
//                            unary -> '-' unary | atom
//                            atom -> num | ident '(' expr ')' | ident | '(' expr ')'
function parse(tokens) {
  let pos = 0
  const peek = () => tokens[pos]
  const expect = (value) => {
    const t = tokens[pos]
    if (!t || t.value !== value) throw new Error(`mathExpr: expected '${value}'`)
    pos++
  }

  function parseAtom() {
    const t = peek()
    if (!t) throw new Error('mathExpr: unexpected end of input')
    if (t.type === 'num') { pos++; return () => t.value }
    if (t.type === 'ident') {
      const name = t.value
      pos++
      if (peek() && peek().value === '(') {
        pos++
        const argFn = parseExpr()
        expect(')')
        const fn = FUNCTIONS[name]
        if (!fn) throw new Error(`mathExpr: unknown function '${name}'`)
        return (scope) => fn(argFn(scope))
      }
      return (scope) => {
        if (!(name in scope)) throw new Error(`mathExpr: unknown identifier '${name}'`)
        return scope[name]
      }
    }
    if (t.value === '(') {
      pos++
      const fn = parseExpr()
      expect(')')
      return fn
    }
    throw new Error(`mathExpr: unexpected token '${t.value}'`)
  }

  function parseUnary() {
    if (peek() && peek().value === '-') {
      pos++
      const fn = parseUnary()
      return (scope) => -fn(scope)
    }
    return parseAtom()
  }

  function parsePow() {
    const base = parseUnary()
    if (peek() && peek().value === '**') {
      pos++
      const exp = parseUnary()
      return (scope) => Math.pow(base(scope), exp(scope))
    }
    return base
  }

  function parseTerm() {
    let fn = parsePow()
    while (peek() && (peek().value === '*' || peek().value === '/')) {
      const op = peek().value
      pos++
      const rhs = parsePow()
      const lhs = fn
      fn = op === '*' ? (scope) => lhs(scope) * rhs(scope) : (scope) => lhs(scope) / rhs(scope)
    }
    return fn
  }

  function parseExpr() {
    let fn = parseTerm()
    while (peek() && (peek().value === '+' || peek().value === '-')) {
      const op = peek().value
      pos++
      const rhs = parseTerm()
      const lhs = fn
      fn = op === '+' ? (scope) => lhs(scope) + rhs(scope) : (scope) => lhs(scope) - rhs(scope)
    }
    return fn
  }

  const fn = parseExpr()
  if (pos !== tokens.length) throw new Error('mathExpr: trailing tokens')
  return fn
}

/** Compiles `exprStr` (e.g. "x**2 + y**2") into (scope) => number. Throws on invalid input. */
export function compileExpr(exprStr) {
  return parse(tokenize(exprStr))
}

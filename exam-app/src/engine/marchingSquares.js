// Client-side marching-squares tracer for implicit curves f(x,y)=0 and a companion
// grid-cell sampler for inequality shading, backing the Math Playground's `implicit`
// row kind. Pure functions — no React, no DOM — for direct table-driven tests, same
// convention as casEngine.js. Never throws: a fn(x,y) that throws or returns NaN just
// makes that grid cell contribute nothing, so one bad expression can't crash the canvas.

function safeEval(fn, x, y) {
  try {
    const v = fn(x, y)
    return typeof v === 'number' && Number.isFinite(v) ? v : NaN
  } catch {
    return NaN
  }
}

function lerp(pa, va, pb, vb) {
  const t = va / (va - vb)
  return [pa[0] + t * (pb[0] - pa[0]), pa[1] + t * (pb[1] - pa[1])]
}

// case index -> pairs of edges to connect, each edge named by the two corners it joins.
// Corners: bl (bottom-left), br (bottom-right), tr (top-right), tl (top-left).
// bit0=bl, bit1=br, bit2=tr, bit3=tl (set when that corner's value is > 0).
const _EDGE_PAIRS = {
  1: [['left', 'bottom']],
  2: [['bottom', 'right']],
  3: [['left', 'right']],
  4: [['right', 'top']],
  5: [['left', 'top'], ['bottom', 'right']], // ambiguous saddle — arbitrary resolution
  6: [['bottom', 'top']],
  7: [['left', 'top']],
  8: [['top', 'left']],
  9: [['bottom', 'top']],
  10: [['left', 'bottom'], ['top', 'right']], // ambiguous saddle — arbitrary resolution
  11: [['right', 'top']],
  12: [['left', 'right']],
  13: [['bottom', 'right']],
  14: [['left', 'bottom']],
}

/** Traces the zero set of `fn(x, y)` inside `bounds = {xMin,xMax,yMin,yMax}` on a
 * `cols`x`rows` grid, returning an array of `{x1,y1,x2,y2}` line segments (marching
 * squares with linear edge interpolation; the two saddle cases pick one of the two
 * valid diagonal resolutions arbitrarily, which is an accepted approximation for
 * visualization — it never produces a topologically-guaranteed-correct contour). */
export function traceImplicitCurve(fn, bounds, { cols = 60, rows = 60 } = {}) {
  const { xMin, xMax, yMin, yMax } = bounds
  if (!(xMax > xMin) || !(yMax > yMin) || cols < 1 || rows < 1) return []

  const dx = (xMax - xMin) / cols
  const dy = (yMax - yMin) / rows
  const segments = []

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x0 = xMin + i * dx
      const x1 = x0 + dx
      const y0 = yMin + j * dy
      const y1 = y0 + dy

      const pBL = [x0, y0]
      const pBR = [x1, y0]
      const pTR = [x1, y1]
      const pTL = [x0, y1]

      const vBL = safeEval(fn, x0, y0)
      const vBR = safeEval(fn, x1, y0)
      const vTR = safeEval(fn, x1, y1)
      const vTL = safeEval(fn, x0, y1)
      if ([vBL, vBR, vTR, vTL].some(Number.isNaN)) continue

      const caseIndex = (vBL > 0 ? 1 : 0) | (vBR > 0 ? 2 : 0) | (vTR > 0 ? 4 : 0) | (vTL > 0 ? 8 : 0)
      const pairs = _EDGE_PAIRS[caseIndex]
      if (!pairs) continue

      const edgePoint = (name) => {
        switch (name) {
          case 'bottom': return lerp(pBL, vBL, pBR, vBR)
          case 'right': return lerp(pBR, vBR, pTR, vTR)
          case 'top': return lerp(pTL, vTL, pTR, vTR)
          case 'left': return lerp(pBL, vBL, pTL, vTL)
          default: return null
        }
      }

      for (const [a, b] of pairs) {
        const pa = edgePoint(a)
        const pb = edgePoint(b)
        if (pa && pb) segments.push({ x1: pa[0], y1: pa[1], x2: pb[0], y2: pb[1] })
      }
    }
  }

  return segments
}

const _COMPARATORS = {
  '>': (v) => v > 0,
  '>=': (v) => v >= 0,
  '<': (v) => v < 0,
  '<=': (v) => v <= 0,
}

/** Samples `fn(x,y)` over a `cols`x`rows` grid of cells inside `bounds` and returns the
 * cells (as `{x,y,w,h}` rects, x/y at the cell's lower-left corner) whose center
 * satisfies the relop against zero — a dense grid-fill shading for an inequality,
 * deliberately simpler than exact polygon clipping (accurate boundary is still drawn
 * separately via traceImplicitCurve). Returns [] for `relop` values that aren't an
 * inequality (e.g. "="), since equality has no area to shade. */
export function sampleInequalityCells(fn, relop, bounds, { cols = 60, rows = 60 } = {}) {
  const test = _COMPARATORS[relop]
  if (!test) return []

  const { xMin, xMax, yMin, yMax } = bounds
  if (!(xMax > xMin) || !(yMax > yMin) || cols < 1 || rows < 1) return []

  const w = (xMax - xMin) / cols
  const h = (yMax - yMin) / rows
  const cells = []

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = xMin + i * w
      const y = yMin + j * h
      const v = safeEval(fn, x + w / 2, y + h / 2)
      if (!Number.isNaN(v) && test(v)) cells.push({ x, y, w, h })
    }
  }

  return cells
}

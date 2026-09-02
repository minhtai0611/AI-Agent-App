import { useEffect, useRef } from 'react'
import { registerColorRefresh } from '../../lib/colorRefresh.js'

// Vantage v1.4.1 ambient field — "bản đồ địa hình đang thở": 7 hills pushed
// to the edges/corners (center stays clean for reading) × 5 contour rings
// each. 08-hero-polish-pass P1: rings are level sets of ONE combined height
// field h(x,y) = Σᵢ gaussianᵢ(x,y), traced via marching squares — level sets
// of a continuous scalar field cannot cross each other, which the previous
// per-hill "independent polar ellipse" drawing could (and did). No particles,
// no noise texture. Vanilla canvas per design-system.html's motion spec
// (Ambient field row): DPR capped at 1.5, alpha ≤0.22 at the screen edge /
// ~0.09 at center via a vignette (raised post-launch — the original ~0.03-0.04
// center floor read as "no background" to users; the hero readzone still
// dampens further under the text via readzoneRect()), two "sky wash" radial
// glows, cursor + scroll parallax, pauses off-tab, static single frame under
// prefers-reduced-motion (traced with the same marching-squares method, not
// a snapshot of the old crossing rings), plus the reference mockup's "đường
// mòn" accent trail — a faint climbing path that draws itself in once over
// ~2.2s after mount, bottom-left to top-right, then sits static with a dot
// marker at its end. Colors are re-sampled from CSS custom properties on
// init and whenever window.VTG_REFRESH_COLORS() runs (theme toggle).
//
// #bgField's position:fixed/inset:0 sizing rule lives in index.css, not
// inline style — see the comment there for why (cover-bug lesson).

const HILLS = [
  { cx: 0.06, cy: 0.08, sx: 0.34, sz: 0.22, k: 1.00, depth: 0.7, phase: 0.0 },
  { cx: 0.95, cy: 0.05, sx: 0.30, sz: 0.24, k: 0.92, depth: 1.3, phase: 1.1 },
  { cx: 0.02, cy: 0.92, sx: 0.32, sz: 0.26, k: 0.98, depth: 0.9, phase: 2.4 },
  { cx: 0.97, cy: 0.95, sx: 0.36, sz: 0.28, k: 1.05, depth: 1.5, phase: 3.6 },
  { cx: 0.50, cy: -0.05, sx: 0.42, sz: 0.16, k: 0.85, depth: 0.6, phase: 4.2 },
  { cx: -0.04, cy: 0.45, sx: 0.22, sz: 0.30, k: 0.80, depth: 1.1, phase: 0.8 },
  { cx: 1.02, cy: 0.55, sx: 0.24, sz: 0.32, k: 0.88, depth: 1.4, phase: 5.0 },
]
const RINGS_PER_HILL = 5
const RING_STEP = 0.42
// Iso levels derived from the same radii the old ellipse rings used
// (r = 1 + ring*RING_STEP), mapped through a unit gaussian exp(-r²/2) —
// this reproduces the original ring footprint/spacing exactly, just as
// level sets of a summed field instead of independent ellipses.
const ISO_LEVELS = Array.from({ length: RINGS_PER_HILL }, (_, ring) => {
  const r = 1 + ring * RING_STEP
  return Math.exp(-(r * r) / 2)
})
const GRID_COLS = 128
const GRID_ROWS = 72

// Local marching-squares over a precomputed vertex grid, shared across all
// ISO_LEVELS in one pass (the general-purpose tracer in engine/marchingSquares.js
// re-evaluates fn(x,y) per grid-cell corner per iso level independently, which
// would mean ~5x redundant Math.exp-heavy field evaluations per frame here —
// too slow for a 60fps ambient background at this grid size).
const _EDGE_PAIRS = {
  1: [['left', 'bottom']], 2: [['bottom', 'right']], 3: [['left', 'right']],
  4: [['right', 'top']], 5: [['left', 'top'], ['bottom', 'right']],
  6: [['bottom', 'top']], 7: [['left', 'top']], 8: [['top', 'left']],
  9: [['bottom', 'top']], 10: [['left', 'bottom'], ['top', 'right']],
  11: [['right', 'top']], 12: [['left', 'right']], 13: [['bottom', 'right']],
  14: [['left', 'bottom']],
}
function traceGrid(values, cols, rows, x0, y0, dx, dy, level, out) {
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const iBL = j * (cols + 1) + i, iBR = iBL + 1
      const iTL = iBL + (cols + 1), iTR = iTL + 1
      const vBL = values[iBL] - level, vBR = values[iBR] - level
      const vTR = values[iTR] - level, vTL = values[iTL] - level
      const caseIndex = (vBL > 0 ? 1 : 0) | (vBR > 0 ? 2 : 0) | (vTR > 0 ? 4 : 0) | (vTL > 0 ? 8 : 0)
      const pairs = _EDGE_PAIRS[caseIndex]
      if (!pairs) continue
      const px0 = x0 + i * dx, px1 = px0 + dx
      const py0 = y0 + j * dy, py1 = py0 + dy
      const edgePoint = (name) => {
        if (name === 'bottom') { const t = vBL / (vBL - vBR); return [px0 + t * dx, py0] }
        if (name === 'right') { const t = vBR / (vBR - vTR); return [px1, py0 + t * dy] }
        if (name === 'top') { const t = vTL / (vTL - vTR); return [px0 + t * dx, py1] }
        return /* left */ (() => { const t = vBL / (vBL - vTL); return [px0, py0 + t * dy] })()
      }
      for (const [a, b] of pairs) {
        const [ax, ay] = edgePoint(a), [bx, by] = edgePoint(b)
        out.push(ax, ay, bx, by)
      }
    }
  }
}

function readColors() {
  const cs = getComputedStyle(document.documentElement)
  const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback
  return {
    inkRgb: v('--ink-rgb', '28,35,51'),
    accentRgb: v('--accent-rgb', '228,87,46'),
  }
}

export default function BgField() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let colors = readColors()
    let w = 0, h = 0, dpr = 1
    let raf = null
    let visible = true
    let startTime = performance.now()
    let mouse = { x: 0.5, y: 0.5 }
    let scrollY = 0

    function resize() {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = rect.width
      h = rect.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(startTime)
    }

    // Animated per-hill center (drift + cursor/scroll parallax) — same motion as before,
    // just factored out so both the height-field sampler and the static frame reuse it.
    function hillCenter(hill, t) {
      const driftT = (t * 0.001 * (0.012 + hill.depth * 0.004)) + hill.phase
      const driftX = Math.sin(driftT) * 0.028
      const driftY = Math.cos(driftT * 0.8) * 0.022
      const parX = (mouse.x - 0.5) * 0.02 * hill.depth
      const parY = (mouse.y - 0.5) * 0.02 * hill.depth + scrollY * 0.00006 * hill.depth
      return [(hill.cx + driftX + parX) * w, (hill.cy + driftY + parY) * h]
    }

    function vignetteAlpha(px, py) {
      const cxr = Math.abs(px - w / 2) / (w / 2)
      const cyr = Math.abs(py - h / 2) / (h / 2)
      const cr = Math.max(cxr, cyr)
      // Raised floor (was 0.28) — the readzone dampener below still keeps text
      // legible, so the rest of the frame can read as more clearly "alive".
      return 0.55 + 0.45 * Math.pow(Math.min(cr, 1), 1.4)
    }

    function readzoneRect() {
      const el = document.querySelector('[data-hero-readzone]')
      if (!el) return null
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return null
      const pad = 16
      return { x0: r.left - pad, y0: r.top - pad, x1: r.right + pad, y1: r.bottom + pad }
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h)

      // Sky wash — two large, very faint radial glows (accent top-right, ink bottom-left)
      const washT = reduceMotion ? 0 : t * 0.00003
      const g1x = w * (0.82 + Math.sin(washT) * 0.03)
      const g1y = h * (0.14 + Math.cos(washT * 0.7) * 0.02)
      const grad1 = ctx.createRadialGradient(g1x, g1y, 0, g1x, g1y, Math.max(w, h) * 0.65)
      grad1.addColorStop(0, `rgba(${colors.accentRgb},0.12)`)
      grad1.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grad1
      ctx.fillRect(0, 0, w, h)

      const g2x = w * (0.10 - Math.sin(washT * 0.9) * 0.03)
      const g2y = h * (0.88 - Math.cos(washT * 0.6) * 0.02)
      const grad2 = ctx.createRadialGradient(g2x, g2y, 0, g2x, g2y, Math.max(w, h) * 0.6)
      grad2.addColorStop(0, `rgba(${colors.inkRgb},0.09)`)
      grad2.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grad2
      ctx.fillRect(0, 0, w, h)

      // "Đường mòn" accent trail — a faint climbing path sweeping bottom-left to
      // top-right, drawn in once over ~2.2s after mount then left static (matches
      // the reference mockup's ambient field; this was the one signature ambient
      // element the earlier port dropped — everything else here is decorative
      // contour lines, this is the only element that reads as a "path").
      const trailProgress = reduceMotion ? 1 : Math.min(1, Math.max(0, (t - 600) / 2200))
      if (trailProgress > 0 && w > 0 && h > 0) {
        ctx.save()
        ctx.globalAlpha = 0.16
        ctx.strokeStyle = `rgb(${colors.accentRgb})`
        ctx.lineWidth = 1.3
        ctx.lineCap = 'round'
        ctx.beginPath()
        const TN = 90
        const upTo = Math.max(1, Math.floor(TN * trailProgress))
        let lastX = 0, lastY = 0
        for (let i = 0; i <= upTo; i++) {
          const u = i / TN
          const px = (0.05 + 0.86 * u + 0.03 * Math.sin(u * 4.4 + 1.2)) * w
          const py = (0.96 - 0.86 * u + 0.085 * Math.sin(u * 7.0)) * h
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
          lastX = px; lastY = py
        }
        ctx.stroke()
        if (trailProgress >= 1) {
          ctx.globalAlpha = 0.35
          ctx.beginPath()
          ctx.arc(lastX, lastY, 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgb(${colors.accentRgb})`
          ctx.fill()
        }
        ctx.restore()
      }

      // Contour = level sets of one combined height field (marching squares over a
      // shared vertex grid, one iso level per ring index) — mathematically cannot cross.
      if (w > 0 && h > 0) {
        const centers = HILLS.map((hill) => hillCenter(hill, reduceMotion ? 0 : t))
        const cols = GRID_COLS, rows = GRID_ROWS
        const dx = w / cols, dy = h / rows
        const values = new Float32Array((cols + 1) * (rows + 1))
        for (let j = 0; j <= rows; j++) {
          const py = j * dy
          for (let i = 0; i <= cols; i++) {
            const px = i * dx
            let sum = 0
            for (let k = 0; k < HILLS.length; k++) {
              const hill = HILLS[k]
              const [ccx, ccy] = centers[k]
              const ndx = (px - ccx) / (hill.sx * w)
              const ndy = (py - ccy) / (hill.sz * h)
              sum += hill.k * Math.exp(-(ndx * ndx + ndy * ndy) / 2)
            }
            values[j * (cols + 1) + i] = sum
          }
        }

        const zone = readzoneRect()
        const segBuf = []
        // Bucket segments by rounded alpha so each ring costs a handful of stroke()
        // calls (one per distinct bucket) instead of one per tiny segment — segment
        // count from a 128x72 trace can run into the hundreds per ring.
        const buckets = new Map()
        ctx.lineWidth = 1.6
        for (let ring = 0; ring < RINGS_PER_HILL; ring++) {
          segBuf.length = 0
          traceGrid(values, cols, rows, 0, 0, dx, dy, ISO_LEVELS[ring], segBuf)
          const baseAlpha = Math.max(0.06, 0.34 - ring * 0.04)
          for (let s = 0; s < segBuf.length; s += 4) {
            const ax = segBuf[s], ay = segBuf[s + 1], bx = segBuf[s + 2], by = segBuf[s + 3]
            const mx = (ax + bx) / 2, my = (ay + by) / 2
            let alpha = baseAlpha * vignetteAlpha(mx, my)
            if (zone && mx >= zone.x0 && mx <= zone.x1 && my >= zone.y0 && my <= zone.y1) {
              alpha *= 0.35
            }
            const key = Math.round(alpha * 500) // ~0.002 buckets
            let arr = buckets.get(key)
            if (!arr) { arr = []; buckets.set(key, arr) }
            arr.push(ax, ay, bx, by)
          }
        }
        for (const [key, arr] of buckets) {
          const alpha = key / 500
          ctx.strokeStyle = `rgba(${colors.inkRgb},${alpha.toFixed(3)})`
          ctx.beginPath()
          for (let s = 0; s < arr.length; s += 4) {
            ctx.moveTo(arr[s], arr[s + 1])
            ctx.lineTo(arr[s + 2], arr[s + 3])
          }
          ctx.stroke()
        }
      }
    }

    function frame(now) {
      draw(now - startTime)
      if (!reduceMotion) raf = requestAnimationFrame(frame)
    }

    function onPointerMove(e) {
      mouse.x = e.clientX / window.innerWidth
      mouse.y = e.clientY / window.innerHeight
    }
    function onScroll() {
      scrollY = window.scrollY
    }
    function onVisibility() {
      visible = !document.hidden
      if (visible && !reduceMotion && raf === null) {
        startTime = performance.now()
        raf = requestAnimationFrame(frame)
      } else if (!visible && raf !== null) {
        cancelAnimationFrame(raf)
        raf = null
      }
    }

    const unregisterColorRefresh = registerColorRefresh(() => {
      colors = readColors()
      draw(reduceMotion ? 0 : performance.now() - startTime)
    })

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    if (!reduceMotion) {
      raf = requestAnimationFrame(frame)
    }

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      if (raf !== null) cancelAnimationFrame(raf)
      unregisterColorRefresh()
    }
  }, [])

  return (
    <canvas
      id="bgField"
      ref={canvasRef}
      role="img"
      aria-label="Bản đồ địa hình nền — các đường đồng mức mờ mô phỏng sườn núi, trang trí, không mang thông tin"
    />
  )
}

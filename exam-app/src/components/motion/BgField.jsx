import { useEffect, useRef } from 'react'
import { registerColorRefresh } from '../../lib/colorRefresh.js'

// Vantage v1.4.1 ambient field — "bản đồ địa hình đang thở": a faithful port
// of the reference mockup's NỀN ĐỘNG AMBIENT script (mockup:1179-1338), not
// an approximation of it. 7 hills, pushed to the edges/corners (center stays
// clean for reading), each drawn as 5 independent closed contour curves via
// the polar equation r(θ) = k / √(cos²θ/sx² + sin²θ/sz²) — no merged scalar
// field, no marching squares, no particles/noise. An earlier pass here
// replaced this with a summed-gaussian-field + marching-squares tracer to
// avoid rings ever crossing, but that's a different algorithm from the
// mockup's and visibly under-renders it (fewer, blobbier contour clusters
// instead of 7 crisp separate ones) — reverted in favor of matching the
// mockup exactly, since independent per-hill rings is what it actually does.
// Two "sky wash" radial glows, cursor + scroll parallax (2 layers), pauses
// off-tab, static single frame under prefers-reduced-motion, plus the
// mockup's "đường mòn" accent trail (a faint climbing path that draws itself
// in once over ~2.2s after mount, bottom-left to top-right, then sits static
// with a dot marker at its end). Colors are re-sampled from CSS custom
// properties on init and whenever window.VTG_REFRESH_COLORS() runs (theme
// toggle).
//
// Coordinates below are in CSS px (not device px): ctx.setTransform(dpr,...)
// in resize() maps 1 unit = 1 CSS px regardless of backing-store DPR, so
// mockup constants that were expressed in device px (its W,Hh × its own DPR)
// are ported here WITHOUT an extra ×DPR — the transform already accounts
// for it.
//
// #bgField's position:fixed/inset:0 sizing rule lives in index.css, not
// inline style — see the comment there for why (cover-bug lesson).

const HILLS = [
  { cx: 0.08, cy: 0.16, sx: 0.42, sz: 0.27, ph: 0.0, spd: 0.8, depth: 1.35 },
  { cx: 0.52, cy: 0.05, sx: 0.55, sz: 0.30, ph: 2.1, spd: 0.5, depth: 0.55 },
  { cx: 0.92, cy: 0.28, sx: 0.30, sz: 0.40, ph: 4.0, spd: 1.0, depth: 1.1 },
  { cx: 0.10, cy: 0.58, sx: 0.36, sz: 0.25, ph: 5.2, spd: 0.65, depth: 0.85 },
  { cx: 0.80, cy: 0.66, sx: 0.27, sz: 0.20, ph: 1.3, spd: 0.9, depth: 1.5 },
  { cx: 0.38, cy: 1.04, sx: 0.46, sz: 0.28, ph: 3.3, spd: 0.6, depth: 0.7 },
  { cx: 0.99, cy: 0.97, sx: 0.32, sz: 0.23, ph: 5.8, spd: 1.15, depth: 1.25 },
]
const ISO = [0.55, 0.95, 1.35, 1.75, 2.15]

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
    const finePointer = window.matchMedia('(pointer: fine)').matches

    let colors = readColors()
    let w = 0, h = 0, dpr = 1
    let raf = null
    let docVisible = true
    let running = false
    let startTime = performance.now()

    // Cursor + scroll parallax state, eased toward target each frame — ported
    // 1:1 from the mockup's ox/oy/sy/tox/toy/tsy (mockup:1228, 1318).
    let ox = 0, oy = 0, sy = 0, tox = 0, toy = 0, tsy = 0

    function resize() {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = rect.width
      h = rect.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(reduceMotion ? 0 : performance.now() - startTime)
    }

    function draw(now) {
      ctx.clearRect(0, 0, w, h)
      if (w <= 0 || h <= 0) return
      const S = Math.min(w, h)
      const t = now / 1000

      // Sky wash — two large, very faint radial glows, tied to parallax offset
      // only (no independent time-based drift) — mockup:1245-1254.
      const wy = h * 0.16 + oy * 0.30 - sy * 0.30
      const grad1 = ctx.createRadialGradient(w * 0.80, wy, 0, w * 0.80, wy, Math.max(w, h) * 0.62)
      grad1.addColorStop(0, `rgba(${colors.accentRgb},0.05)`)
      grad1.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grad1
      ctx.fillRect(0, 0, w, h)

      const g2y = h * 0.94 - sy * 0.20
      const grad2 = ctx.createRadialGradient(w * 0.10, g2y, 0, w * 0.10, g2y, Math.max(w, h) * 0.55)
      grad2.addColorStop(0, `rgba(${colors.inkRgb},0.035)`)
      grad2.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grad2
      ctx.fillRect(0, 0, w, h)

      // "Đường mòn" accent trail — draws in once over ~2.2s after mount, then
      // sits static with a dot marker at its end — mockup:1256-1281.
      const trailProgress = reduceMotion ? 1 : Math.min(1, Math.max(0, (now - 600) / 2200))
      if (trailProgress > 0) {
        ctx.save()
        ctx.globalAlpha = 0.13
        ctx.strokeStyle = `rgb(${colors.accentRgb})`
        ctx.lineWidth = 1.1
        ctx.lineCap = 'round'
        ctx.beginPath()
        const TN = 90
        const upTo = Math.max(1, Math.floor(TN * trailProgress))
        let lastX = 0, lastY = 0
        for (let i = 0; i <= upTo; i++) {
          const u = i / TN
          const px = (0.05 + 0.86 * u + 0.030 * Math.sin(u * 4.4 + 1.2)) * w + ox * 0.5
          const py = (0.96 - 0.86 * u + 0.085 * Math.sin(u * 7.0)) * h + oy * 0.5 - sy * 0.5
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
          lastX = px; lastY = py
        }
        ctx.stroke()
        if (trailProgress >= 1) {
          ctx.globalAlpha = 0.3
          ctx.beginPath()
          ctx.arc(lastX, lastY, 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgb(${colors.accentRgb})`
          ctx.fill()
        }
        ctx.restore()
      }

      // Contour "thở" — each hill is 5 independent closed curves (not level
      // sets of a shared field), r(θ) = k/√(cos²θ/sx²+sin²θ/sz²) —
      // mockup:1283-1312.
      for (const hl of HILLS) {
        const cxn = hl.cx + Math.sin(t * 0.0785 * hl.spd + hl.ph) * 0.045
        const cyn = hl.cy + Math.cos(t * 0.0661 * hl.spd + hl.ph * 1.7) * 0.038
        const br = 1 + Math.sin(t * 0.052 * hl.spd + hl.ph * 0.6) * 0.05
        const cxpx = cxn * w + ox * hl.depth
        const cypx = cyn * h + oy * hl.depth - sy * hl.depth
        const sx = hl.sx * S * br, sz = hl.sz * S * br

        // Vignette: contour deepens toward the horizontal edges, center stays
        // clean for reading. Horizontal distance only — matches mockup.
        const cxr = Math.min(1, Math.abs(cxpx - w * 0.5) / (w * 0.5))
        const vis = 0.42 + 0.58 * Math.pow(cxr, 1.4)

        for (const k of ISO) {
          const alpha = (0.12 - (k - 0.55) * 0.048) * vis
          if (alpha <= 0.008) continue
          ctx.beginPath()
          for (let s = 0; s <= 44; s++) {
            const th = (s / 44) * Math.PI * 2
            const c = Math.cos(th), sn = Math.sin(th)
            const q = (c * c) / (sx * sx) + (sn * sn) / (sz * sz)
            const r = k / Math.sqrt(q)
            const px = cxpx + c * r, py = cypx + sn * r
            if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
          }
          ctx.closePath()
          ctx.strokeStyle = `rgba(${colors.inkRgb},${alpha.toFixed(3)})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }
    }

    function tick(now) {
      if (!running) return
      ox += (tox - ox) * 0.05
      oy += (toy - oy) * 0.05
      sy += (tsy - sy) * 0.07
      draw(now - startTime)
      raf = requestAnimationFrame(tick)
    }
    function start() {
      if (running || reduceMotion || !docVisible) return
      running = true
      raf = requestAnimationFrame(tick)
    }
    function stop() {
      running = false
      if (raf) cancelAnimationFrame(raf)
      raf = null
    }

    function onPointerMove(e) {
      const nx = e.clientX / Math.max(1, window.innerWidth) - 0.5
      const ny = e.clientY / Math.max(1, window.innerHeight) - 0.5
      tox = nx * 18
      toy = ny * 14
    }
    function onScroll() {
      tsy = (window.scrollY || 0) * 0.055
    }
    function onVisibility() {
      docVisible = !document.hidden
      if (docVisible) start(); else stop()
    }

    const unregisterColorRefresh = registerColorRefresh(() => {
      colors = readColors()
      if (reduceMotion) draw(0)
    })

    resize()
    window.addEventListener('resize', resize)
    if (finePointer && !reduceMotion) {
      window.addEventListener('pointermove', onPointerMove, { passive: true })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    if (reduceMotion) {
      draw(0)
    } else {
      start()
    }

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
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

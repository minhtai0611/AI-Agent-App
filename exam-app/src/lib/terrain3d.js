// Vantage terrain-3D engine — ported from the reference prototype at
// vantage/uploads/hero-redesign-3d.html (the "ĐỊA HÌNH 3D" hero build).
// Vanilla canvas, no Three.js/WebGL, per design-system.html's Terrain 3D
// motion-spec row. Deliberately split from the hero's specific content
// (the two named ascent routes) so a different caller — e.g. the /linalg
// "ma trận là địa hình" page — can drive the same camera/mesh/lifecycle
// mechanics with its own heightFn and no routes at all.
//
// API: createTerrainScene(canvas, options) -> { handlePointerMove, handlePointerLeave, destroy, project }
//   options.heightFn(x, z) -> y            required — terrain surface
//   options.routes[]                       optional — climbing paths + hover tooltips (see HeroTerrain.jsx for shape)
//   options.world { xMin,xMax,zMin,zMax,nx,nz }   optional, defaults below
//   options.camera { focal,centerZ,baseYaw,basePitch,sScale,cy }  optional, defaults below
//   options.interactive                    default true — cursor tilt + route hit-test
//   options.onHoverChange(route|null)      called each frame interaction state changes
import { registerColorRefresh } from './colorRefresh.js'

const DEFAULT_WORLD = { xMin: -1.25, xMax: 1.25, zMin: 0.02, zMax: 1.7, nx: 64, nz: 46 }
const DEFAULT_CAMERA = { focal: 3.4, centerZ: 0.86, baseYaw: -0.05, basePitch: 1.03, sScale: 0.30, cy: 0.58 }
const R_N = 170

function readColors() {
  const cs = getComputedStyle(document.documentElement)
  const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback
  return {
    ink: v('--ink-rgb', '28,35,51'),
    paper: v('--paper-rgb', '245,242,234'),
    accent: v('--accent', '#E4572E'),
    accentRgb: v('--accent-rgb', '228,87,46'),
    altitude: v('--altitude', '#2F5D8A'),
    altitudeRgb: v('--altitude-rgb', '47,93,138'),
  }
}

export function createTerrainScene(canvas, options = {}) {
  const {
    heightFn,
    routes = [],
    world: worldOpt = {},
    camera: cameraOpt = {},
    interactive = true,
    onHoverChange = null,
    // showOrigin: the "MỐC 01 · XUẤT PHÁT" start marker only makes sense for the
    // hero's named climbing routes — a data-driven caller (e.g. /linalg's eigen-axis
    // overlay) draws routes with no such semantics and sets this false. Additive,
    // defaults true so HeroTerrain.jsx's existing behavior is unchanged.
    showOrigin = true,
  } = options

  const ctx = canvas.getContext('2d')
  const world = { ...DEFAULT_WORLD, ...worldOpt }
  const camera = { ...DEFAULT_CAMERA, ...cameraOpt }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const finePointer = window.matchMedia('(pointer: fine)').matches

  let colors = readColors()
  let W = 2, H = 2, DPR = 1
  let yaw = camera.baseYaw, pitch = camera.basePitch, tYaw = camera.baseYaw, tPitch = camera.basePitch
  let startT = null, raf = null, running = false, inView = true, docVisible = true
  const mouse = { x: -9999, y: -9999, inside: false }
  let hovered = null

  for (const r of routes) r.progress = reduced ? 1 : 0

  function resize() {
    const rect = canvas.getBoundingClientRect()
    DPR = Math.min(window.devicePixelRatio || 1, 1.75)
    W = Math.max(2, Math.round(rect.width * DPR))
    H = Math.max(2, Math.round(rect.height * DPR))
    canvas.width = W
    canvas.height = H
    if (reduced) drawFrame(0, true)
  }

  function project(x, y, z) {
    const cyw = Math.cos(yaw), syw = Math.sin(yaw)
    const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw
    const zz = z1 - camera.centerZ
    const cp = Math.cos(pitch), sp = Math.sin(pitch)
    const y2 = y * cp + zz * sp, z2 = zz * cp - y * sp
    const s = camera.focal / (camera.focal + z2)
    const S = Math.min(W, H) * camera.sScale
    return [W * 0.5 + x1 * s * S, H * camera.cy - y2 * s * S]
  }

  function haloText(txt, sx, sy, fillStyle) {
    ctx.lineWidth = 3 * DPR
    ctx.strokeStyle = `rgba(${colors.paper},0.92)`
    ctx.strokeText(txt, sx, sy)
    ctx.fillStyle = fillStyle
    ctx.fillText(txt, sx, sy)
  }

  function hitTest() {
    hovered = null
    if (!interactive || !mouse.inside || !finePointer || reduced || routes.length === 0) return
    const mx = mouse.x * DPR, my = mouse.y * DPR
    let best = Infinity
    for (const r of routes) {
      const N = 72
      for (let i = 0; i <= N; i++) {
        const q = r.point(i / N)
        const p = project(q.x, q.y, q.z)
        const dx = p[0] - mx, dy = p[1] - my
        const d2 = dx * dx + dy * dy
        if (d2 < best) { best = d2; hovered = r }
      }
    }
    if (best > (26 * DPR) ** 2) hovered = null
  }

  function drawFrame(now, staticFrame) {
    ctx.clearRect(0, 0, W, H)
    let p

    for (let i = world.nz; i >= 0; i--) {
      const z = world.zMin + (world.zMax - world.zMin) * i / world.nz
      const near = 1 - (z - world.zMin) / (world.zMax - world.zMin)
      const a = 0.055 + 0.27 * near
      ctx.beginPath()
      for (let j = 0; j <= world.nx; j++) {
        const x = world.xMin + (world.xMax - world.xMin) * j / world.nx
        p = project(x, heightFn(x, z), z)
        if (j === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1])
      }
      ctx.strokeStyle = `rgba(${colors.ink},${a.toFixed(3)})`
      ctx.lineWidth = 0.9 * DPR
      ctx.stroke()
    }
    for (let j = 0; j <= world.nx; j += 8) {
      const x = world.xMin + (world.xMax - world.xMin) * j / world.nx
      ctx.beginPath()
      for (let i = 0; i <= world.nz; i++) {
        const z = world.zMin + (world.zMax - world.zMin) * i / world.nz
        p = project(x, heightFn(x, z), z)
        if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1])
      }
      ctx.strokeStyle = `rgba(${colors.ink},0.09)`
      ctx.lineWidth = 0.75 * DPR
      ctx.stroke()
    }

    ctx.textAlign = 'center'
    ctx.font = `500 ${9.5 * DPR}px "IBM Plex Mono", ui-monospace, monospace`

    if (routes.length > 0) {
      const first = routes[0]
      if (showOrigin && (first.progress > 0.02 || staticFrame)) {
        const b0 = first.point(0)
        p = project(b0.x, b0.y, b0.z)
        // Below the basecamp marker, clear of the mesh's bottom edge (08-hero-polish-pass P3.3).
        haloText('MỐC 01 · XUẤT PHÁT', p[0], p[1] + 30 * DPR, `rgba(${colors.ink},0.8)`)
        ctx.beginPath(); ctx.arc(p[0], p[1], 4.4 * DPR, 0, 6.2832)
        ctx.fillStyle = `rgba(${colors.paper},1)`; ctx.fill()
        ctx.strokeStyle = `rgba(${colors.ink},0.85)`; ctx.lineWidth = 1.8 * DPR; ctx.stroke()
      }

      // Pre-pass (08-hero-polish-pass P3.2): if both summit flags are done climbing,
      // check their on-screen distance and, if under the 56px minimum, shift the
      // non-labelBelow flag's label (THPT) right so the two never crowd each other.
      let thptFlagShiftX = 0
      const flagTips = []
      for (const r of routes) {
        if (r.progress > 0.985 && !r.noFlag) {
          const q = r.point(1)
          flagTips.push({ r, tp: project(q.x, q.y, q.z) })
        }
      }
      if (flagTips.length === 2) {
        const [a, b] = flagTips
        const dist = Math.hypot(a.tp[0] - b.tp[0], a.tp[1] - b.tp[1])
        if (dist < 56 * DPR) {
          const thpt = flagTips.find((f) => !f.r.labelBelow)
          if (thpt) thptFlagShiftX = 10 * DPR
        }
      }

      routes.forEach((r, ri) => {
        // Per-route mark-label collision state (P3.2): resets each route so marks on
        // different routes never fight for space, only marks sharing one route/line.
        let lastMarkScreenY = null
        const col = r.color === 'accent' ? colors.accent : colors.altitude
        const rgb = r.color === 'accent' ? colors.accentRgb : colors.altitudeRgb
        const upto = Math.max(0, Math.floor(r.progress * R_N))
        const isHover = hovered === r

        ctx.save()
        ctx.setLineDash([3 * DPR, 5 * DPR])
        ctx.strokeStyle = `rgba(${colors.ink},0.22)`
        ctx.lineWidth = 1.3 * DPR
        ctx.beginPath()
        for (let i = upto; i <= R_N; i++) {
          const q0 = r.point(i / R_N); p = project(q0.x, q0.y, q0.z)
          if (i === upto) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1])
        }
        ctx.stroke()
        ctx.restore()

        if (r.progress > 0.002) {
          ctx.strokeStyle = col
          ctx.lineWidth = (isHover ? 3.4 : 2.4) * DPR
          ctx.lineJoin = 'round'; ctx.lineCap = 'round'
          ctx.beginPath()
          for (let i = 0; i <= upto; i++) {
            const q1 = r.point(i / R_N); p = project(q1.x, q1.y, q1.z)
            if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1])
          }
          ctx.stroke()
        }

        if (!reduced && r.progress > 0.002 && r.progress < 1) {
          const hk = r.point(r.progress); const hp = project(hk.x, hk.y, hk.z)
          ctx.beginPath(); ctx.arc(hp[0], hp[1], 3.4 * DPR, 0, 6.2832)
          ctx.fillStyle = col; ctx.fill()
          ctx.beginPath(); ctx.arc(hp[0], hp[1], 6.2 * DPR, 0, 6.2832)
          ctx.strokeStyle = `rgba(${colors.paper},0.9)`; ctx.lineWidth = 1.2 * DPR; ctx.stroke()
        }

        ;(r.marks || []).forEach((m, k) => {
          if (r.progress < m.u) return
          const q2 = r.point(m.u); p = project(q2.x, q2.y, q2.z)
          // P3.1: offset further out (was 16/22px) so the label clears the dashed
          // route line, and connect marker→label with a short leader stroke.
          const dir = r.labelBelow ? 1 : -1
          let labelOffset = 28 * dir * DPR
          // P3.2: collision pass — if this mark's label would land within one
          // text-line's height of the previous mark on the same route, push it
          // further out along the same offset direction until clear.
          const minGap = 14 * DPR
          while (
            lastMarkScreenY !== null &&
            Math.abs((p[1] + labelOffset) - lastMarkScreenY) < minGap
          ) {
            labelOffset += dir * minGap
          }
          lastMarkScreenY = p[1] + labelOffset
          const leaderLen = 10 * DPR
          const leaderEndY = p[1] + dir * Math.min(Math.abs(labelOffset) - 6 * DPR, leaderLen)
          ctx.save()
          ctx.strokeStyle = `rgba(${colors.ink},0.3)`
          ctx.lineWidth = 1 * DPR
          ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], leaderEndY); ctx.stroke()
          ctx.restore()
          haloText(m.label, p[0], p[1] + labelOffset, `rgba(${colors.ink},0.8)`)
          ctx.beginPath(); ctx.arc(p[0], p[1], 4.4 * DPR, 0, 6.2832)
          ctx.fillStyle = `rgba(${colors.paper},1)`; ctx.fill()
          ctx.strokeStyle = col; ctx.lineWidth = 1.8 * DPR; ctx.stroke()
          if (!staticFrame) {
            const phase = ((now / 2400) + k * 0.4 + ri * 0.2) % 1
            ctx.beginPath()
            ctx.arc(p[0], p[1], (5 + 11 * phase) * DPR, 0, 6.2832)
            ctx.strokeStyle = `rgba(${rgb},${(0.5 * (1 - phase)).toFixed(3)})`
            ctx.lineWidth = 1 * DPR; ctx.stroke()
          }
        })

        if (r.progress > 0.985 && !r.noFlag) {
          const tp0 = r.point(1); const tp = project(tp0.x, tp0.y, tp0.z)
          const pole = r.flagPole * DPR
          ctx.beginPath(); ctx.moveTo(tp[0], tp[1]); ctx.lineTo(tp[0], tp[1] - pole)
          ctx.strokeStyle = `rgba(${colors.ink},0.95)`; ctx.lineWidth = 1.5 * DPR; ctx.stroke()
          const wob = staticFrame ? 0 : Math.sin(now / 500 + ri * 1.3) * 1.5 * DPR
          ctx.beginPath()
          ctx.moveTo(tp[0], tp[1] - pole)
          ctx.lineTo(tp[0] + 15 * DPR, tp[1] - pole + 5 * DPR + wob)
          ctx.lineTo(tp[0], tp[1] - pole + 10 * DPR)
          ctx.closePath()
          ctx.fillStyle = col; ctx.fill()
          ctx.beginPath(); ctx.arc(tp[0], tp[1], 4.6 * DPR, 0, 6.2832)
          ctx.fillStyle = col; ctx.fill()
          if (r.labelBelow) {
            haloText(r.flagLabel, tp[0], tp[1] - r.flagPole * DPR - 8 * DPR, col)
          } else {
            // P3.2: shifted right when the two flags would otherwise sit <56px apart.
            haloText(r.flagLabel, tp[0] - 6 * DPR + thptFlagShiftX, tp[1] + 22 * DPR, col)
          }
        }
      })
    }
  }

  function tick(now) {
    if (!running) return
    yaw += (tYaw - yaw) * 0.045
    pitch += (tPitch - pitch) * 0.045
    if (startT === null) startT = now
    for (const r of routes) {
      const pr = (now - startT - r.delay) / r.dur
      r.progress = pr <= 0 ? 0 : pr >= 1 ? 1 : 1 - (1 - pr) ** 3
    }
    hitTest()
    if (onHoverChange) onHoverChange(hovered)
    drawFrame(now, false)
    raf = requestAnimationFrame(tick)
  }

  function start() {
    if (running || reduced || !inView || !docVisible) return
    running = true
    raf = requestAnimationFrame(tick)
  }
  function stop() {
    running = false
    if (raf) cancelAnimationFrame(raf)
    raf = null
  }

  function handlePointerMove(clientX, clientY, hostRect) {
    if (!interactive || !finePointer || reduced) return
    const nx = (clientX - hostRect.left) / hostRect.width - 0.5
    const ny = (clientY - hostRect.top) / hostRect.height - 0.5
    tYaw = camera.baseYaw + nx * 0.36
    tPitch = Math.max(0.93, Math.min(1.13, camera.basePitch + ((0.5 - ny) * 0.10 - 0.05)))
    const cr = canvas.getBoundingClientRect()
    mouse.x = clientX - cr.left; mouse.y = clientY - cr.top
    mouse.inside = mouse.x >= 0 && mouse.y >= 0 && mouse.x <= cr.width && mouse.y <= cr.height
  }
  function handlePointerLeave() {
    tYaw = camera.baseYaw; tPitch = camera.basePitch
    mouse.inside = false
    hovered = null
    if (onHoverChange) onHoverChange(null)
  }

  let idleInterval = null
  if (!finePointer && !reduced && interactive) {
    idleInterval = setInterval(() => {
      if (!running) return
      tYaw = camera.baseYaw + Math.sin(performance.now() / 5200) * 0.10
    }, 50)
  }

  let io = null
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting
      if (inView) start(); else stop()
    }, { threshold: 0.08 })
    io.observe(canvas)
  }
  function onVisibility() {
    docVisible = !document.hidden
    if (docVisible) start(); else stop()
  }
  document.addEventListener('visibilitychange', onVisibility)

  window.addEventListener('resize', resize)
  resize()

  const unregisterColorRefresh = registerColorRefresh(() => {
    colors = readColors()
    if (reduced) drawFrame(0, true)
  })

  if (reduced) {
    drawFrame(0, true)
  } else {
    setTimeout(start, 350)
  }

  function destroy() {
    stop()
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', onVisibility)
    if (io) io.disconnect()
    if (idleInterval) clearInterval(idleInterval)
    unregisterColorRefresh()
  }

  // On-demand repaint for a data-driven caller (e.g. /linalg after a matrix edit or
  // operation result) whose heightFn output changed but who can't wait for the next
  // rAF tick — most importantly under reduced-motion, where the internal tick() loop
  // never runs at all and drawFrame is otherwise only called once at mount/theme-change.
  // Additive; HeroTerrain.jsx doesn't need it since its own tick loop already redraws
  // continuously when not reduced.
  function redraw() {
    drawFrame(performance.now(), reduced || !running)
  }

  return { handlePointerMove, handlePointerLeave, destroy, project, redraw }
}

import { useEffect, useRef } from 'react'
import { createTerrainScene } from '../../lib/terrain3d.js'

// /linalg "ma trận là địa hình" terrain — reuses the exact camera/mesh/lifecycle
// engine from terrain3d.js (see HeroTerrain.jsx for the sibling hero usage) with a
// matrix-derived heightFn instead of named climbing routes. Grid values morph live
// via a per-frame lerp toward the latest target (typed cell edits, or an operation's
// result matrix), independent of terrain3d's own render loop — see the `current`/
// `target` refs below.
//
// Deviation from the spec's exact camera tuning ("yaw ±0.12 lerp 0.045, pitch cố
// định ~1.0 rad"): terrain3d.js's handlePointerMove has the hero's tilt sensitivity
// (yaw ±0.36, pitch ±0.10) hardcoded, not exposed as a per-scene option. Reusing it
// as-is (same subtle cursor-parallax feel, just not exactly re-tuned) rather than
// widening the engine's API further in this pass — noted, not silently done.

const AMPLITUDE = 0.15
const LERP_RATE = 0.2

function bilinear(grid, rows, cols, rowF, colF) {
  const r0 = Math.max(0, Math.min(rows - 1, Math.floor(rowF)))
  const r1 = Math.min(rows - 1, r0 + 1)
  const c0 = Math.max(0, Math.min(cols - 1, Math.floor(colF)))
  const c1 = Math.min(cols - 1, c0 + 1)
  const fr = rowF - r0, fc = colF - c0
  const v00 = grid[r0][c0], v01 = grid[r0][c1], v10 = grid[r1][c0], v11 = grid[r1][c1]
  const top = v00 + (v01 - v00) * fc
  const bot = v10 + (v11 - v10) * fc
  return top + (bot - top) * fr
}

export default function LinalgTerrain({ grid, flatCollapse, axes, reducedMotionSnap }) {
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)
  const currentRef = useRef(null) // lerped grid actually sampled by heightFn
  const targetRef = useRef(null)
  const rafRef = useRef(null)

  // Mount once — heightFn closes over currentRef.current (mutated in place below),
  // so terrain3d's own tick() loop naturally picks up updates without re-creating it.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function heightFn(x, z) {
      const g = currentRef.current
      if (!g) return 0
      const rows = g.length, cols = g[0].length
      const fx = (x - world.xMin) / (world.xMax - world.xMin)
      const fz = (z - world.zMin) / (world.zMax - world.zMin)
      return bilinear(g, rows, cols, fz * (rows - 1), fx * (cols - 1)) * AMPLITUDE
    }

    const world = { xMin: -1.1, xMax: 1.1, zMin: 0.15, zMax: 1.55, nx: 56, nz: 40 }
    const scene = createTerrainScene(canvas, {
      heightFn,
      routes: axesToRoutes(axes),
      world,
      interactive: true,
      showOrigin: false,
    })
    sceneRef.current = scene

    return () => {
      scene.destroy()
      sceneRef.current = null
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Grid data changes: set target, run/continue the lerp loop (or snap under
  // reduced-motion, since terrain3d's own tick loop doesn't run in that mode).
  useEffect(() => {
    if (!grid) return
    targetRef.current = grid
    if (!currentRef.current || currentRef.current.length !== grid.length || currentRef.current[0].length !== grid[0].length) {
      // Shape changed (row/col added/removed) — no sane lerp target shape-mismatch, snap.
      currentRef.current = grid.map(row => [...row])
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced || reducedMotionSnap) {
      currentRef.current = grid.map(row => [...row])
      sceneRef.current?.redraw()
      return
    }

    if (rafRef.current) return // a lerp loop is already running toward whatever the latest target is
    function step() {
      const cur = currentRef.current, tgt = targetRef.current
      let settled = true
      for (let r = 0; r < cur.length; r++) {
        for (let c = 0; c < cur[0].length; c++) {
          const d = tgt[r][c] - cur[r][c]
          if (Math.abs(d) > 0.002) settled = false
          cur[r][c] += d * LERP_RATE
        }
      }
      if (!settled) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        cur.forEach((row, r) => row.forEach((_, c) => { cur[r][c] = tgt[r][c] }))
        rafRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }, [grid, reducedMotionSnap])

  return (
    <div
      className="relative w-full"
      style={{
        aspectRatio: '4 / 3',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        background: flatCollapse ? 'color-mix(in srgb, var(--accent) 6%, var(--paper-2))' : 'var(--paper-2)',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={flatCollapse ? 'Địa hình sụp phẳng — định thức xấp xỉ 0' : 'Địa hình 3D dựng từ ma trận đang nhập'}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  )
}

// Eigen/SVD principal-axis overlay: two static "routes" (terrain3d's route contract)
// drawn as straight lines through the terrain center, one 600ms draw-on each, no
// flag/marker semantics (noFlag) since these aren't climbing paths.
function axesToRoutes(axes) {
  if (!axes) return []
  const mk = (dir, color, delay, label) => ({
    color, delay, dur: 600, noFlag: true,
    point(u) {
      const t = (u - 0.5) * 1.7
      return { x: dir.x * t, z: 0.85 + dir.z * t * 0.55, y: 0.02 }
    },
    marks: [{ u: 0.92, label }],
    labelBelow: false,
  })
  const out = [mk(axes.v1, 'accent', 0, axes.label1 ?? 'λ₁')]
  if (axes.v2) out.push(mk(axes.v2, 'altitude', 250, axes.label2 ?? 'λ₂'))
  return out
}

import { useEffect, useRef, useState } from 'react'
import { createTerrainScene } from '../../lib/terrain3d.js'

// Landing hero terrain — ports the two named ascent routes from the
// reference prototype (vantage/uploads/hero-redesign-3d.html): THPT climbs
// a cubic z = t³−3t (accent), lớp 10 climbs a parabola z = 1−t² (altitude).
// Replaces the earlier static two-peak SVG illustration (see git history /
// Landing.jsx's prior TerrainCard) with the live camera+mesh engine.
//
// Deliberately NOT ported: the reference file's "chế độ năng lực" (URL-driven
// competency-mode terrain morph, ?ham-so=8.5&... share links, slider panel).
// That's a distinct, much larger feature the redesign spec didn't ask this
// step to build — noted as a possible future follow-up, not silently dropped.

function gaussian(dx, dz, sx, sz) {
  return Math.exp(-((dx * dx) / (2 * sx * sx) + (dz * dz) / (2 * sz * sz)))
}
function heightFn(x, z) {
  const gA = gaussian(x - 0.34, z - 0.86, 0.40, 0.44)
  return (
    Math.pow(gA, 1.7) * 1.0 +
    0.52 * gaussian(x + 0.72, z - 0.30, 0.34, 0.30) +
    0.24 * gaussian(x - 0.95, z - 0.15, 0.50, 0.55) +
    0.10 * gaussian(x + 1.00, z - 0.90, 0.45, 0.50) +
    0.045 * Math.sin(x * 6.3 + z * 4.1) * Math.sin(z * 5.2 - x * 2.7) +
    0.022 * Math.sin(x * 13.1) * Math.sin(z * 10.9 + 1.7)
  )
}

function mkRouteMath(sx, sz, ex, ez, wFn, amp) {
  const dx = ex - sx, dz = ez - sz, L = Math.sqrt(dx * dx + dz * dz)
  const nx = -dz / L, ny = dx / L
  return (u) => {
    const off = wFn(u) * amp
    return { x: sx + dx * u + nx * off, z: sz + dz * u + ny * off }
  }
}
const wCubic = (u) => { const t = (2 * u - 1) * Math.sqrt(3); return (t * t * t - 3 * t) / 2 }
const wParab = (u) => 1 - (2 * u - 1) ** 2

function buildRoutes() {
  const thptPath = mkRouteMath(0.02, 0.06, 0.34, 0.86, wCubic, 0.24)
  const l10Path = mkRouteMath(0.02, 0.06, -0.72, 0.30, (u) => -wParab(u), 0.16)
  return [
    {
      key: 'thpt', color: 'accent', delay: 650, dur: 2400,
      fp: thptPath,
      point(u) { const q = this.fp(u); return { x: q.x, z: q.z, y: heightFn(q.x, q.z) + 0.016 } },
      marks: [
        { u: 0.38, label: 'MỐC 02 · ĐỀ 2023' },
        { u: 0.62, label: 'MỐC 03 · ĐỀ 2024' },
        { u: 0.83, label: 'MỐC 04 · ĐỀ 2025' },
      ],
      flagLabel: 'ĐỈNH · ĐH MƠ ƯỚC', flagPole: 26,
      formula: 'z = t³ − 3t', formulaNote: 'HÀM BẬC BA · KHẢO SÁT & CỰC TRỊ · LỚP 12',
    },
    {
      key: 'l10', color: 'altitude', delay: 1450, dur: 2000,
      fp: l10Path,
      point(u) { const q = this.fp(u); return { x: q.x, z: q.z, y: heightFn(q.x, q.z) + 0.016 } },
      marks: [
        { u: 0.46, label: 'L10 · ĐỀ 2024' },
        { u: 0.70, label: 'L10 · ĐỀ 2025' },
      ],
      labelBelow: true,
      flagLabel: 'ĐỈNH 10 · TRƯỜNG MƠ ƯỚC', flagPole: 20,
      formula: 'z = 1 − t²', formulaNote: 'PARABOLA · HÀM SỐ BẬC HAI · LỚP 10',
    },
  ]
}

export default function HeroTerrain() {
  const hostRef = useRef(null)
  const canvasRef = useRef(null)
  const [tip, setTip] = useState(null) // { x, y, formula, note } in host-local CSS px
  const mousePos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    const host = hostRef.current
    if (!canvas || !host) return

    const routes = buildRoutes()
    const scene = createTerrainScene(canvas, {
      heightFn,
      routes,
      interactive: true,
      onHoverChange: (route) => {
        setTip(route ? { x: mousePos.current.x, y: mousePos.current.y, formula: route.formula, note: route.formulaNote } : null)
      },
    })

    function onMove(e) {
      const hr = host.getBoundingClientRect()
      mousePos.current = { x: e.clientX - hr.left, y: e.clientY - hr.top }
      scene.handlePointerMove(e.clientX, e.clientY, hr)
    }
    function onLeave() {
      scene.handlePointerLeave()
      setTip(null)
    }
    host.addEventListener('mousemove', onMove)
    host.addEventListener('mouseleave', onLeave)

    return () => {
      host.removeEventListener('mousemove', onMove)
      host.removeEventListener('mouseleave', onLeave)
      scene.destroy()
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className="relative w-full"
      style={{
        aspectRatio: '640 / 520',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        background: 'var(--paper-2)',
        overflow: 'hidden',
      }}
    >
      <span
        className="absolute top-3 left-3 z-10"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.06em' }}
      >
        VN-02 · 1:63.000
      </span>
      <span
        className="absolute bottom-3 right-3 z-10 text-right"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.06em' }}
      >
        ĐỊA HÌNH 3D · 2 TUYẾN
      </span>
      <span
        className="absolute bottom-3 left-3 z-10 flex items-center gap-2"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.06em' }}
      >
        <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
        RÊ TUYẾN → XEM HÀM
      </span>
      <div
        className="absolute top-9 right-3 z-10 flex flex-col items-end gap-1.5 pointer-events-none"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.06em', color: 'var(--ink-2)', background: 'var(--paper)', padding: '8px 10px', borderRadius: 'var(--r-sm)' }}
      >
        <span className="flex items-center gap-1.5">
          THPT → ĐH MƠ ƯỚC
          <span aria-hidden="true" style={{ width: 14, height: 2, borderRadius: 1, background: 'var(--accent)', display: 'inline-block' }} />
        </span>
        <span style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>z = t³ − 3t</span>
        <span className="flex items-center gap-1.5">
          LỚP 10 → TRƯỜNG MƠ ƯỚC
          <span aria-hidden="true" style={{ width: 14, height: 2, borderRadius: 1, background: 'var(--altitude)', display: 'inline-block' }} />
        </span>
        <span style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>z = 1 − t²</span>
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Địa hình 3D: hai tuyến hành trình. Tuyến THPT theo hàm bậc ba z = t³ − 3t leo lên đỉnh xa; tuyến lớp 10 theo parabola z = 1 − t² leo lên đỉnh gần."
        style={{ width: '100%', height: '100%', display: 'block' }}
      />

      {tip && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            left: tip.x, top: tip.y, transform: 'translate(-50%, -130%)',
            background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
            padding: '6px 10px', whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink)' }}>{tip.formula}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>{tip.note}</div>
        </div>
      )}
    </div>
  )
}

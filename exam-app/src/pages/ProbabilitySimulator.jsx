import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { pageVariants } from '../utils/animations.js'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { describeAgentFetchError } from '../lib/agentError.js'
import { registerColorRefresh } from '../lib/colorRefresh.js'

// /probability — "Thung lũng hội tụ" (Converging Valley), per
// vantage/uploads/06-xac-suat-mo-phong.md. One signature moment: a hand-rolled
// canvas sand-dune histogram that fills as trials are sown, with the
// theoretical distribution drawn on top once n is large enough. No chart
// library — the spec forbids it outright.
//
// "dice" (sum of n dice) and "coin" (heads count over n flips) both accept an
// n stepper, which covers the mockup's "TỔNG 2 XÚC XẮC" (n=2 case of dice)
// and "ĐỒNG XU ×10" (n=10 default case of coin) without needing separate
// modes. "custom" (binomial n=10, adjustable p) is genuinely new: the
// backend (stats_simulator.py) has no arbitrary-p experiment to back it, so
// it runs entirely client-side — real Math.random() trials and an exact
// binomial PMF via C(n,k), matching vantage/uploads/xac-suat.html's own
// implementation. No numpy/sympy needed for this one; n is fixed at 10 like
// the mockup, so a small closed-form PMF is exact, not an approximation.

const _API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const EXPERIMENTS = [
  { key: 'dice', label: 'XÚC XẮC (TỔNG)', statistic: 'sum', nLabel: 'Số xúc xắc', nMin: 1, nMax: 10, nDefault: 2 },
  { key: 'coin', label: 'ĐỒNG XU', statistic: 'count', nLabel: 'Số lần tung', nMin: 1, nMax: 30, nDefault: 10 },
  { key: 'custom', label: 'TÙY CHỈNH p', statistic: 'custom', client: true },
]

const CUSTOM_N = 10

function factorial(n) {
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}
function binomCoeff(n, k) {
  return factorial(n) / (factorial(k) * factorial(n - k))
}
function customPmf(p) {
  const out = {}
  for (let k = 0; k <= CUSTOM_N; k++) {
    out[k] = binomCoeff(CUSTOM_N, k) * p ** k * (1 - p) ** (CUSTOM_N - k)
  }
  return out
}
function sampleCustom(p) {
  let s = 0
  for (let i = 0; i < CUSTOM_N; i++) if (Math.random() < p) s++
  return s
}

// Bin-value range known statically per experiment, without needing a
// simulation result yet — used to pre-render the chart frame/axis at rest,
// matching the mockup (which pre-renders its frame from static bin arrays).
function previewBinValues(experiment, n) {
  if (experiment.key === 'dice') return Array.from({ length: 5 * n + 1 }, (_, i) => n + i)
  if (experiment.key === 'coin') return Array.from({ length: n + 1 }, (_, i) => i)
  if (experiment.key === 'custom') return Array.from({ length: CUSTOM_N + 1 }, (_, i) => i)
  return []
}

const BATCH_SIZES = [
  { key: 1, label: '×1' },
  { key: 100, label: '×100' },
  { key: 1000, label: '×1000' },
]

async function runSimulation(body) {
  try {
    const res = await fetch(`${_API_BASE}/agent/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { available: false, reason: await describeAgentFetchError(res) }
    return await res.json()
  } catch (err) {
    return { available: false, reason: err.message }
  }
}

function mean(values) {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}
function stdDev(values, m) {
  if (values.length < 2) return 0
  const variance = values.reduce((a, v) => a + (v - m) ** 2, 0) / values.length
  return Math.sqrt(variance)
}
function pmfMoments(pmf) {
  const m = Object.entries(pmf).reduce((a, [k, p]) => a + Number(k) * p, 0)
  const variance = Object.entries(pmf).reduce((a, [k, p]) => a + p * (Number(k) - m) ** 2, 0)
  return { mean: m, std: Math.sqrt(variance) }
}

// ---------------------------------------------------------------------------
// Canvas stage — owns its own landed-particle state via refs (not React
// state) for animation performance. Parent drives it imperatively through
// stageRef.current.sow(values, durationMs).
// ---------------------------------------------------------------------------
function ValleyStage({ stageRef, bins, previewBins, showTheory, onAriaUpdate }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const stateRef = useRef({
    landed: new Map(), // bin value -> count actually drawn so far
    displayHeight: new Map(), // bin value -> smoothed pixel-height fraction (for the lerp-up dune effect)
    fallers: [], // { value, x, startT, duration }
    total: 0,
    maxCount: 0,
    displayMaxCount: 1,
    theoryProgress: 0, // 0..1 draw-on state
    theoryDrawn: false,
    colors: { ink: '28,35,51', accent: '228,87,46', paper: '245,242,234' },
  })
  const rafRef = useRef(null)
  const reduceMotionRef = useRef(false)
  const lastAriaRef = useRef(0)

  function readColors() {
    const cs = getComputedStyle(document.documentElement)
    const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback
    return {
      ink: v('--ink-rgb', '28,35,51'),
      accent: v('--accent-rgb', '228,87,46'),
      paper: v('--paper-rgb', '245,242,234'),
    }
  }

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    stateRef.current.colors = readColors()

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let w = 0, h = 0, dpr = 1

    function resize() {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 1.75)
      w = rect.width
      h = rect.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(performance.now())
    }

    function binX(i, n) {
      const pad = 36
      const usable = w - pad * 2
      const slot = usable / n
      return pad + slot * (i + 0.5)
    }

    function draw(now) {
      const s = stateRef.current
      ctx.clearRect(0, 0, w, h)
      if (w === 0 || h === 0) return

      const activeBins = bins.length ? bins : previewBins
      if (!activeBins.length) return

      const floorY = h - 28
      const topPad = 28
      const plotH = floorY - topPad

      // y-scale morph: smoothly chase the real max
      const targetMax = Math.max(1, s.maxCount)
      s.displayMaxCount += (targetMax - s.displayMaxCount) * 0.12
      const scaleMax = Math.max(s.displayMaxCount, 1)

      // axis baseline — drawn even at rest (n=0) so the frame is visible
      // before the first roll, matching the mockup.
      ctx.strokeStyle = `rgba(${s.colors.ink},0.28)`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(24, floorY + 0.5)
      ctx.lineTo(w - 12, floorY + 0.5)
      ctx.stroke()

      // y-axis gridlines at rest (0 / half / full of current scale) — only
      // label 0 and the top value; a middle label would round to a
      // duplicate of one of those while scaleMax is still small (≤1).
      const topLabel = Math.max(1, Math.round(scaleMax))
      ;[0, 0.5, 1].forEach((frac) => {
        const y = floorY - frac * plotH
        ctx.strokeStyle = `rgba(${s.colors.ink},0.08)`
        ctx.beginPath()
        ctx.moveTo(24, y)
        ctx.lineTo(w - 12, y)
        ctx.stroke()
        if (frac === 0 || frac === 1) {
          ctx.fillStyle = `rgba(${s.colors.ink},0.4)`
          ctx.font = '10px "IBM Plex Mono", monospace'
          ctx.textAlign = 'left'
          ctx.fillText(String(frac === 0 ? 0 : topLabel), 4, y + 3)
        }
      })

      const n = activeBins.length
      const barW = Math.max(4, (w - 72) / n - 6)

      activeBins.forEach((bin, i) => {
        const x = binX(i, n)
        const landed = s.landed.get(bin.value) || 0
        const targetFrac = landed / scaleMax
        const prevFrac = s.displayHeight.get(bin.value) || 0
        const frac = prevFrac + (targetFrac - prevFrac) * 0.18
        s.displayHeight.set(bin.value, frac)
        const barH = frac * plotH
        const alpha = landed >= 300 ? 0.35 : 0.42

        if (barH > 0.5) {
          ctx.fillStyle = `rgba(${s.colors.ink},${alpha})`
          ctx.fillRect(x - barW / 2, floorY - barH, barW, barH)
        }

        // x-axis label
        ctx.fillStyle = `rgba(${s.colors.ink},0.55)`
        ctx.font = '11px "IBM Plex Mono", monospace'
        ctx.textAlign = 'center'
        ctx.fillText(String(bin.value), x, floorY + 16)
      })

      // rest-state overlay — the frame above is already drawn, this just
      // labels it as empty (matches the mockup, which shows both at once)
      if (s.total === 0) {
        ctx.fillStyle = `rgba(${s.colors.ink},0.4)`
        ctx.font = '12px "IBM Plex Mono", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('THUNG LŨNG ĐANG PHẲNG — GIEO HẠT ĐẦU TIÊN', w / 2, (topPad + floorY) / 2)
      }

      // falling particles (only spawned while a bin's landed count < 300)
      const t = now
      s.fallers = s.fallers.filter((f) => {
        const p = Math.min(1, (t - f.startT) / f.duration)
        const ease = 1 - (1 - p) * (1 - p) // ease-in-ish quad, no bounce
        const bin = activeBins.find((b) => b.value === f.value)
        if (!bin) return false
        const i = activeBins.indexOf(bin)
        const x = binX(i, n)
        const landedAtSpawn = f.landedAtSpawn
        const targetFrac = (landedAtSpawn + 1) / scaleMax
        const y = floorY - targetFrac * plotH * ease
        ctx.beginPath()
        ctx.fillStyle = `rgba(${s.colors.ink},0.55)`
        ctx.arc(x, Math.max(topPad, y), 3, 0, Math.PI * 2)
        ctx.fill()
        return p < 1
      })

      // theoretical line, drawn on top of the dune
      if (showTheory && s.total >= 100) {
        if (!s.theoryDrawn) {
          s.theoryProgress = Math.min(1, s.theoryProgress + (reduceMotionRef.current ? 1 : 16 / 1200))
          if (s.theoryProgress >= 1) s.theoryDrawn = true
        } else {
          s.theoryProgress = 1
        }
        const pts = bins.map((bin, i) => {
          const x = binX(i, n)
          const y = floorY - (bin.p * s.total / scaleMax) * plotH
          return [x, y]
        })
        const drawCount = Math.max(1, Math.round(pts.length * s.theoryProgress))
        ctx.strokeStyle = `rgba(${s.colors.accent},0.95)`
        ctx.lineWidth = 2
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        pts.slice(0, drawCount).forEach(([x, y], idx) => {
          if (idx === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()
        ctx.setLineDash([])
      }

      // corner readout
      const empiricalMean = mean(flattenLanded(s.landed))
      ctx.fillStyle = `rgba(${s.colors.ink},0.62)`
      ctx.font = '11px "IBM Plex Mono", monospace'
      ctx.textAlign = 'right'
      ctx.fillText(
        `n = ${s.total.toLocaleString('vi-VN')} · μ = ${empiricalMean.toFixed(2)}${showTheory ? ' · TUYẾN ĐỎ = LÝ THUYẾT' : ''}`,
        w - 12, 18,
      )
    }

    function flattenLanded(map) {
      const out = []
      for (const [value, count] of map) for (let i = 0; i < count; i++) out.push(value)
      return out
    }

    let visible = true
    function frame(now) {
      draw(now)
      const s = stateRef.current
      const needsMotion = s.fallers.length > 0 || Math.abs(s.displayMaxCount - s.maxCount) > 0.5 ||
        (showTheory && s.total >= 100 && !s.theoryDrawn)
      if (visible && (!reduceMotionRef.current || needsMotion)) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        rafRef.current = null
      }
    }
    function ensureLoop() {
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(frame)
    }

    const unregisterColorRefresh = registerColorRefresh(() => {
      stateRef.current.colors = readColors()
      draw(performance.now())
    })

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) ensureLoop()
    }, { threshold: 0.08 })
    io.observe(canvas)

    function onVisibility() {
      if (document.hidden) {
        if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      } else if (visible) ensureLoop()
    }
    document.addEventListener('visibilitychange', onVisibility)

    resize()
    window.addEventListener('resize', resize)
    draw(performance.now())

    stageRef.current = {
      sow(values, durationMs) {
        const s = stateRef.current
        const perParticle = durationMs / Math.max(1, values.length)
        const now = performance.now()
        values.forEach((value, idx) => {
          const landedSoFar = s.landed.get(value) || 0
          s.landed.set(value, landedSoFar + 1)
          s.total += 1
          s.maxCount = Math.max(s.maxCount, s.landed.get(value))
          if (landedSoFar < 300 && !reduceMotionRef.current) {
            s.fallers.push({
              value,
              landedAtSpawn: landedSoFar,
              startT: now + idx * Math.min(perParticle, 420),
              duration: 420,
            })
          }
        })
        ensureLoop()
        const t = performance.now()
        if (t - lastAriaRef.current > 1000) {
          lastAriaRef.current = t
          const flat = flattenLanded(s.landed)
          onAriaUpdate?.(s.total, mean(flat))
        }
      },
      reset() {
        const s = stateRef.current
        s.landed = new Map()
        s.displayHeight = new Map()
        s.fallers = []
        s.total = 0
        s.maxCount = 0
        s.displayMaxCount = 1
        s.theoryProgress = 0
        s.theoryDrawn = false
        draw(performance.now())
        onAriaUpdate?.(0, 0)
      },
    }

    return () => {
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      io.disconnect()
      unregisterColorRefresh()
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      stageRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bins, previewBins, showTheory])

  return (
    <div
      ref={wrapRef}
      style={{
        border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', background: 'var(--paper)',
        aspectRatio: '21 / 9', minHeight: 320, position: 'relative', overflow: 'hidden',
      }}
    >
      <canvas ref={canvasRef} role="img" aria-label="Thung lũng hội tụ — hạt rơi tạo thành histogram" style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}

export default function ProbabilitySimulator() {
  usePageMeta('Thung lũng hội tụ', { description: 'Mô phỏng xác suất — gieo hạt cát, xem định lý giới hạn trung tâm tự hiện hình.' })

  const [experimentKey, setExperimentKey] = useState('dice')
  const experiment = EXPERIMENTS.find((e) => e.key === experimentKey)
  const [n, setN] = useState(experiment.nDefault)
  const [pCustom, setPCustom] = useState(0.5)
  const [pendingSwitch, setPendingSwitch] = useState(null)
  const [showTheory, setShowTheory] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [samples, setSamples] = useState([])
  const [pmf, setPmf] = useState(null)
  const [ariaText, setAriaText] = useState('Chưa gieo hạt nào.')

  const stageRef = useRef(null)

  const bins = useMemo(() => {
    if (!pmf) return []
    return Object.entries(pmf)
      .map(([value, p]) => ({ value: Number(value), p }))
      .sort((a, b) => a.value - b.value)
  }, [pmf])

  const previewBins = useMemo(
    () => previewBinValues(experiment, n).map((value) => ({ value, p: 0 })),
    [experiment, n],
  )

  const totalN = samples.length
  const empiricalMean = useMemo(() => mean(samples), [samples])
  const empiricalStd = useMemo(() => stdDev(samples, empiricalMean), [samples, empiricalMean])
  const theory = useMemo(() => (pmf ? pmfMoments(pmf) : null), [pmf])

  function handleAriaUpdate(total, m) {
    if (total === 0) { setAriaText('Chưa gieo hạt nào.'); return }
    const t = theory
    setAriaText(
      `Đã gieo ${total.toLocaleString('vi-VN')} hạt, trung bình mẫu ${m.toFixed(2)}` +
      (t ? ` so lý thuyết ${t.mean.toFixed(2)}` : ''),
    )
  }

  async function sow(trials) {
    if (experiment.client) {
      // "custom" runs entirely in the browser — real Math.random() trials,
      // exact closed-form binomial PMF, no backend round-trip.
      const histogram = Array.from({ length: trials }, () => sampleCustom(pCustom))
      setPmf(customPmf(pCustom))
      setSamples((prev) => [...prev, ...histogram])
      const duration = trials <= 1 ? 420 : trials <= 100 ? Math.min(3300, trials * 33) : 1000
      stageRef.current?.sow(histogram, duration)
      return
    }
    setLoading(true)
    setError(null)
    const res = await runSimulation({ experiment: experimentKey, n_dice: n, trials, statistic: experiment.statistic })
    setLoading(false)
    if (!res.available) { setError(res.reason ?? 'Không thể mô phỏng.'); return }
    setPmf(res.pmf)
    setSamples((prev) => [...prev, ...res.histogram])
    const duration = trials <= 1 ? 420 : trials <= 100 ? Math.min(3300, trials * 33) : 1000
    stageRef.current?.sow(res.histogram, duration)
  }

  function handlePCustomChange(value) {
    setPCustom(value)
    resetValley()
  }

  function resetValley() {
    setSamples([])
    setPmf(null)
    setError(null)
    stageRef.current?.reset()
  }

  function requestExperimentChange(key) {
    if (key === experimentKey) return
    if (totalN > 1000) { setPendingSwitch(key); return }
    applyExperimentChange(key)
  }
  function applyExperimentChange(key) {
    const next = EXPERIMENTS.find((e) => e.key === key)
    setExperimentKey(key)
    setN(next.nDefault)
    setPendingSwitch(null)
    resetValley()
  }

  const diffPct = theory && totalN > 0 ? Math.abs(empiricalMean - theory.mean) / (Math.abs(theory.mean) || 1) * 100 : null

  return (
    <motion.div
      variants={pageVariants} initial="hidden" animate="show" exit="exit"
      className="relative z-[1] min-h-screen"
    >
      <div className="max-w-5xl mx-auto w-full px-6 sm:px-10 pt-8 pb-20 flex flex-col gap-6">
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 8 }}>
            TRẠM · DỤNG CỤ · D·05
          </div>
          <h1 className="font-display font-bold" style={{ fontSize: 39, color: 'var(--ink)' }}>Thung lũng hội tụ.</h1>
          <p style={{ color: 'var(--ink-2)', maxWidth: '60ch', marginTop: 8 }}>
            Gieo từng hạt cát. Sau vài nghìn lần, ngọn đồi tự hiện hình — đó là định lý giới hạn trung tâm, nhìn bằng mắt.
          </p>
        </div>

        <ValleyStage stageRef={stageRef} bins={bins} previewBins={previewBins} showTheory={showTheory} onAriaUpdate={handleAriaUpdate} />
        <p aria-live="polite" className="sr-only">{ariaText}</p>

        {error && (
          <p style={{ color: 'var(--accent-deep)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{error}</p>
        )}

        {/* Control rail */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-4">
            {EXPERIMENTS.map((e) => (
              <button
                key={e.key}
                onClick={() => requestExperimentChange(e.key)}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12.5, letterSpacing: '0.05em',
                  color: experimentKey === e.key ? 'var(--ink)' : 'var(--ink-3)',
                  borderBottom: experimentKey === e.key ? '2px solid var(--accent)' : '2px solid transparent',
                  paddingBottom: 4,
                }}
              >
                {e.label}
              </button>
            ))}
          </div>

          {experiment.client ? (
            <label className="flex items-center gap-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>
              XÁC SUẤT p
              <input
                type="range" min={0.05} max={0.95} step={0.05} value={pCustom}
                onChange={(e) => handlePCustomChange(Number(e.target.value))}
                aria-label="Xác suất p"
                style={{ width: 160, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)', minWidth: '4ch' }}>
                p = {pCustom.toLocaleString('vi-VN', { minimumFractionDigits: 2 })}
              </span>
            </label>
          ) : (
            <label className="flex items-center gap-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>
              {experiment.nLabel}
              <input
                type="number" min={experiment.nMin} max={experiment.nMax} value={n}
                onChange={(e) => setN(Math.min(experiment.nMax, Math.max(experiment.nMin, parseInt(e.target.value, 10) || experiment.nMin)))}
                style={{ width: 48, fontFamily: 'var(--font-mono)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--paper)', color: 'var(--ink)', padding: '2px 6px' }}
              />
            </label>
          )}

          <label className="flex items-center gap-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>
            <input type="checkbox" checked={showTheory} onChange={(e) => setShowTheory(e.target.checked)} />
            TUYẾN LÝ THUYẾT
          </label>
        </div>

        {pendingSwitch && (
          <div className="flex items-center gap-3" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-deep)' }}>
            <span>Đã gieo hơn 1.000 hạt — đổi thí nghiệm sẽ dọn sạch thung lũng.</span>
            <button onClick={() => applyExperimentChange(pendingSwitch)} style={{ color: 'var(--accent)', fontWeight: 700 }}>XÁC NHẬN</button>
            <button onClick={() => setPendingSwitch(null)} style={{ color: 'var(--ink-3)' }}>HUỶ</button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {BATCH_SIZES.map((b) => (
            <button
              key={b.key}
              disabled={loading}
              onClick={() => sow(b.key)}
              style={b.key === 1000
                ? { fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.03em', background: 'var(--accent)', color: 'var(--paper)', border: '1px solid var(--accent)', borderRadius: 'var(--r-sm)', padding: '10px 18px', opacity: loading ? 0.5 : 1 }
                : { fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.03em', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '10px 16px', opacity: loading ? 0.5 : 1 }}
            >
              {b.key === 1000 ? 'GIEO ×1000 ▲' : `GIEO ${b.label}`}
            </button>
          ))}
          <button
            onClick={resetValley}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-3)', marginLeft: 8 }}
          >
            DỌN THUNG LŨNG
          </button>
        </div>

        {/* Comparison ledger — the only other element on the page */}
        {totalN > 0 && theory && (
          <table style={{ borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 13, marginTop: 8, maxWidth: 420 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--ink)' }}>
                <th style={{ textAlign: 'left', color: 'var(--ink-3)', fontWeight: 500, padding: '6px 12px 6px 0', fontSize: 11 }}></th>
                <th style={{ textAlign: 'right', color: 'var(--ink-3)', fontWeight: 500, padding: '6px 12px', fontSize: 11 }}>MÔ PHỎNG</th>
                <th style={{ textAlign: 'right', color: 'var(--ink-3)', fontWeight: 500, padding: '6px 0', fontSize: 11 }}>LÝ THUYẾT</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
                <td style={{ padding: '6px 12px 6px 0', color: 'var(--ink-2)' }}>μ (TRUNG BÌNH)</td>
                <td style={{ textAlign: 'right', padding: '6px 12px', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{empiricalMean.toFixed(3)}</td>
                <td style={{ textAlign: 'right', padding: '6px 0', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{theory.mean.toFixed(3)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
                <td style={{ padding: '6px 12px 6px 0', color: 'var(--ink-2)' }}>σ (ĐỘ LỆCH)</td>
                <td style={{ textAlign: 'right', padding: '6px 12px', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{empiricalStd.toFixed(3)}</td>
                <td style={{ textAlign: 'right', padding: '6px 0', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{theory.std.toFixed(3)}</td>
              </tr>
              <tr>
                <td style={{ padding: '6px 12px 6px 0', color: 'var(--ink-2)' }}>SAI KHÁC CHUẨN</td>
                <td colSpan={2} style={{ textAlign: 'right', padding: '6px 0', fontVariantNumeric: 'tabular-nums', color: diffPct < 2 ? 'var(--pine)' : 'var(--accent)', fontWeight: 600 }}>
                  {diffPct.toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>
        )}

        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.05em', color: 'var(--ink-3)', textAlign: 'center', marginTop: 24 }}>
          ĐỊNH LÝ GIỚI HẠN TRUNG TÂM — HẠT NÀO CŨNG RƠI NGẪU NHIÊN, CỒN NÀO CŨNG DÂNG THÀNH ĐỒI.
        </p>
      </div>
    </motion.div>
  )
}

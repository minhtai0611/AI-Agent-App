import { useEffect, useRef } from 'react'

const STAR_COUNT = typeof navigator !== 'undefined' && (navigator.deviceMemory ?? 4) >= 4 ? 120 : 60

function makeStars(w, h) {
  return Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    z: Math.random() * 800 + 200,
    speed: 0.05 + Math.random() * 0.1,
  }))
}

export default function StarfieldCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let w = canvas.offsetWidth
    let h = canvas.offsetHeight
    canvas.width  = w
    canvas.height = h

    const stars = makeStars(w, h)
    let rafId = null
    let running = true

    function draw() {
      if (!running) return
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        s.y += s.speed
        if (s.y > h) { s.y = 0; s.x = Math.random() * w }
        const radius  = (1 - s.z / 1000) * 1.5
        const opacity = 1 - s.z / 1000
        ctx.beginPath()
        ctx.arc(s.x, s.y, Math.max(0.3, radius), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${opacity * 0.6})`
        ctx.fill()
      }
      rafId = requestAnimationFrame(draw)
    }

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        running = false
        if (rafId) cancelAnimationFrame(rafId)
      } else {
        running = true
        draw()
      }
    }

    // Respect prefers-reduced-motion — skip RAF loop entirely
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    document.addEventListener('visibilitychange', onVisibility)
    draw()

    return () => {
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0, opacity: 0.5 }}
      aria-hidden="true"
    />
  )
}

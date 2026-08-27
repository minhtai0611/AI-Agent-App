// Plain-SVG fallback rendered by Scene3DLazy when canUseTier3() fails (reduced-motion
// preference, low-memory/low-bandwidth device) or the WebGL scene throws at runtime.
// One flat, non-interactive sketch per template from the same spec fields — no three.js.
function Caption() {
  return (
    <p data-testid="tier2-caption" className="font-sans text-[0.6875rem] text-faint text-center mt-2">
      Chế độ 2D — thiết bị của bạn không hỗ trợ 3D
    </p>
  )
}

function Frame({ children }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <svg viewBox="0 0 200 160" width="240" height="192" role="img" aria-label="Sơ đồ 2D minh hoạ">
        {children}
      </svg>
      <Caption />
    </div>
  )
}

function pyramidSketch() {
  return (
    <>
      <polygon points="40,120 160,120 120,140 20,140" fill="none" stroke="#F0A93E" strokeWidth="2" />
      <line x1="20" y1="140" x2="100" y2="20" stroke="#F0A93E" strokeWidth="2" />
      <line x1="160" y1="120" x2="100" y2="20" stroke="#F0A93E" strokeWidth="2" />
      <line x1="120" y1="140" x2="100" y2="20" stroke="#F0A93E" strokeWidth="2" />
      <line x1="40" y1="120" x2="100" y2="20" stroke="#F0A93E" strokeWidth="2" />
    </>
  )
}

function prismSketch() {
  return (
    <>
      <polygon points="40,120 160,120 120,140 20,140" fill="none" stroke="#F0A93E" strokeWidth="2" />
      <polygon points="40,40 160,40 120,60 20,60" fill="none" stroke="#F0A93E" strokeWidth="2" />
      <line x1="40" y1="120" x2="40" y2="40" stroke="#F0A93E" strokeWidth="2" />
      <line x1="160" y1="120" x2="160" y2="40" stroke="#F0A93E" strokeWidth="2" />
      <line x1="120" y1="140" x2="120" y2="60" stroke="#F0A93E" strokeWidth="2" />
      <line x1="20" y1="140" x2="20" y2="60" stroke="#F0A93E" strokeWidth="2" />
    </>
  )
}

function sphereConeSketch(spec) {
  if (spec.shape === 'sphere') return <circle cx="100" cy="80" r="55" fill="none" stroke="#4C3B8C" strokeWidth="2" />
  if (spec.shape === 'cone') return <polygon points="100,15 40,140 160,140" fill="none" stroke="#4C3B8C" strokeWidth="2" />
  return <rect x="45" y="20" width="110" height="120" rx="30" fill="none" stroke="#4C3B8C" strokeWidth="2" />
}

function conicSectionSketch(spec) {
  if (spec.kind === 'parabola') return <path d="M 20 140 Q 100 -10 180 140" fill="none" stroke="#059669" strokeWidth="2" />
  if (spec.kind === 'hyperbola') return (
    <>
      <path d="M 100 10 Q 150 80 100 150" fill="none" stroke="#059669" strokeWidth="2" />
      <path d="M 100 10 Q 50 80 100 150" fill="none" stroke="#059669" strokeWidth="2" />
    </>
  )
  return <ellipse cx="100" cy="80" rx="70" ry="45" fill="none" stroke="#059669" strokeWidth="2" />
}

function vectorAddSketch() {
  return (
    <>
      <line x1="20" y1="140" x2="120" y2="80" stroke="#F0A93E" strokeWidth="2" markerEnd="url(#arrow)" />
      <line x1="120" y1="80" x2="180" y2="30" stroke="#F0A93E" strokeWidth="2" />
      <line x1="20" y1="140" x2="180" y2="30" stroke="#6366F1" strokeWidth="2" />
    </>
  )
}

function functionSurfaceSketch() {
  return <path d="M 20 30 Q 100 150 180 30" fill="none" stroke="#6366F1" strokeWidth="2" />
}

function solidOfRevolutionSketch() {
  return (
    <>
      <path d="M 60 20 Q 100 20 100 80 Q 100 140 60 140" fill="none" stroke="#F0A93E" strokeWidth="2" />
      <path d="M 140 20 Q 100 20 100 80 Q 100 140 140 140" fill="none" stroke="#F0A93E" strokeWidth="2" strokeDasharray="4 3" />
    </>
  )
}

const SKETCHES = {
  pyramid: pyramidSketch,
  prism: prismSketch,
  sphere_cone: sphereConeSketch,
  conic_section: conicSectionSketch,
  vector_add: vectorAddSketch,
  function_surface: functionSurfaceSketch,
  solid_of_revolution: solidOfRevolutionSketch,
}

export default function Static2DFallback({ spec }) {
  const sketch = spec ? SKETCHES[spec.template] : null
  if (!sketch) return <Frame />
  return <Frame>{sketch(spec)}</Frame>
}

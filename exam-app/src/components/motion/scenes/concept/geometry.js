// Pure geometry-derivation helpers for the Concept Explorer scene templates. Kept
// framework-free (no three.js/R3F imports) so they're plain-function testable,
// mirroring engine/aiEngine.js's convention. Each scene component calls these to
// turn a validated backend spec into vertex/point arrays it then renders.
import { compileExpr } from '../../../../utils/mathExpr.js'

function baseVertices2D(spec) {
  const { base, base_side, base_dims } = spec
  if (base === 'square') {
    const s = base_side / 2
    return [[-s, -s], [s, -s], [s, s], [-s, s]]
  }
  if (base === 'rectangle') {
    const [w, h] = base_dims
    return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
  }
  if (base === 'triangle') {
    const s = base_side
    const r = s / Math.sqrt(3)
    return [0, 1, 2].map((i) => {
      const angle = (Math.PI / 2) + (i * 2 * Math.PI) / 3
      return [r * Math.cos(angle), r * Math.sin(angle)]
    })
  }
  if (base === 'hexagon') {
    const r = base_side
    return Array.from({ length: 6 }, (_, i) => {
      const angle = (i * Math.PI) / 3
      return [r * Math.cos(angle), r * Math.sin(angle)]
    })
  }
  throw new Error(`geometry: unknown base '${base}'`)
}

/** Pyramid: base polygon at y=0, apex at [0, apex_height, 0]. */
export function pyramidGeometry(spec) {
  const base2D = baseVertices2D(spec)
  const baseVertices = base2D.map(([x, z]) => [x, 0, z])
  return { baseVertices, apex: [0, spec.apex_height, 0] }
}

/** Cross-section of a pyramid at height ratio t (0 = base, 1 = apex) — the base
 * polygon linearly scaled toward the apex, since every pyramid edge is a straight
 * line from a base vertex to the single apex point. */
export function pyramidCrossSection(spec, t) {
  if (t < 0 || t > 1) throw new Error('geometry: t must be in [0, 1]')
  const { baseVertices } = pyramidGeometry(spec)
  const scale = 1 - t
  return baseVertices.map(([x, , z]) => [x * scale, spec.apex_height * t, z * scale])
}

/** Prism: base polygon extruded from y=0 to y=height. */
export function prismGeometry(spec) {
  const base2D = baseVertices2D(spec)
  const bottom = base2D.map(([x, z]) => [x, 0, z])
  const top = base2D.map(([x, z]) => [x, spec.height, z])
  return { bottom, top }
}

/** Sphere/cone/cylinder: just the dimensions R3F's primitive geometries need. */
export function sphereConeGeometry(spec) {
  const { shape, radius, height } = spec
  if (shape === 'sphere') return { shape, radius }
  if (height == null) throw new Error(`geometry: ${shape} requires height`)
  return { shape, radius, height }
}

/** Vector addition: endpoints of each input vector plus their running sum, tip-to-tail. */
export function vectorAddGeometry(spec) {
  const { dim, vectors, show_sum } = spec
  const to3D = (v) => (dim === 2 ? [v[0], v[1], 0] : [v[0], v[1], v[2]])
  let cursor = [0, 0, 0]
  const segments = vectors.map((v) => {
    const start = cursor
    const vec3 = to3D(v)
    const end = [start[0] + vec3[0], start[1] + vec3[1], start[2] + vec3[2]]
    cursor = end
    return { start, end }
  })
  const sum = show_sum ? { start: [0, 0, 0], end: cursor } : null
  return { segments, sum }
}

/** Samples expr(x, y) on a resolution x resolution grid over the spec's domain. */
export function functionSurfaceSample(spec, resolution = 24) {
  const [xmin, xmax, ymin, ymax] = spec.domain
  const fn = compileExpr(spec.expr)
  const points = []
  for (let i = 0; i <= resolution; i++) {
    const row = []
    const x = xmin + ((xmax - xmin) * i) / resolution
    for (let j = 0; j <= resolution; j++) {
      const y = ymin + ((ymax - ymin) * j) / resolution
      row.push([x, fn({ x, y }), y])
    }
    points.push(row)
  }
  return points
}

/** Samples expr(x) revolved around `axis` for a lathe-style solid of revolution. */
export function solidOfRevolutionSample(spec, resolution = 48) {
  const [lower, upper] = spec.bounds
  const fn = compileExpr(spec.expr)
  const points = []
  for (let i = 0; i <= resolution; i++) {
    const x = lower + ((upper - lower) * i) / resolution
    points.push([x, fn({ x }), 0])
  }
  return points
}

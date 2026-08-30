import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGSAP } from '@gsap/react'
import { gsap } from '../../../lib/gsap.js'
import { functionSurfaceSample } from './concept/geometry.js'

// Ambient front-door hero — a real computed math surface (not decorative stock
// geometry), reusing the Concept Explorer's own sampling helper so this stays
// "the app's real math," per the Vantage rebrand's differentiator from generic
// culture-motif hero art. Fixed spec, no per-exam variation: this is chrome,
// not a question visualization.
const HERO_SPEC = { expr: 'sin(sqrt(x*x+y*y))*1.2', domain: [-6, 6, -6, 6] }
const RESOLUTION = 32

// Mirrors FunctionSurfaceScene.jsx's buildSurfaceGeometry — kept local rather
// than imported from that page-specific scene component to avoid coupling two
// unrelated scene entry points together.
function buildSurfaceGeometry(points) {
  const resolution = points.length - 1
  const geometry = new THREE.PlaneGeometry(1, 1, resolution, resolution)
  const positions = geometry.attributes.position
  let idx = 0
  for (let i = 0; i <= resolution; i++) {
    for (let j = 0; j <= resolution; j++) {
      const [x, y, z] = points[i][j]
      positions.setXYZ(idx, x, y, z)
      idx++
    }
  }
  geometry.computeVertexNormals()
  return geometry
}

function RippleSurface() {
  const groupRef = useRef(null)
  const points = useMemo(() => functionSurfaceSample(HERO_SPEC, RESOLUTION), [])
  const geometry = useMemo(() => buildSurfaceGeometry(points), [points])

  useGSAP(() => {
    gsap.from(groupRef.current.scale, { x: 0, y: 0, z: 0, duration: 1, ease: 'back.out(1.4)' })
  }, { scope: groupRef })

  // Continuous ambient rotation — persistent per-frame motion, so useFrame
  // (not GSAP) owns it; GSAP above only owns the one-shot mount entrance.
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.08
  })

  return (
    <group ref={groupRef} rotation={[-0.5, 0, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color="#8B5CF6"
          emissive="#8B5CF6"
          emissiveIntensity={0.35}
          side={THREE.DoubleSide}
          transparent
          opacity={0.22}
        />
      </mesh>
      <mesh geometry={geometry}>
        <meshBasicMaterial color="#A78BFA" wireframe transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

export default function ExamSelectHeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 3, 11], fov: 45 }}
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      gl={{ alpha: true }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 3]} intensity={0.4} />
      <RippleSurface />
    </Canvas>
  )
}

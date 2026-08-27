import { useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'
import { useGSAP } from '@gsap/react'
import { gsap } from '../../../../lib/gsap.js'

function conicPoints(spec) {
  const { kind, params } = spec
  const { a = 1, b = 1 } = params
  const N = 96
  const points = []
  if (kind === 'ellipse') {
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2
      points.push([a * Math.cos(t), b * Math.sin(t), 0])
    }
  } else if (kind === 'hyperbola') {
    for (let i = 0; i <= N; i++) {
      const t = -2 + (4 * i) / N
      points.push([a * Math.cosh(t), b * Math.sinh(t), 0])
    }
  } else {
    // parabola: y^2 = 4a*x, sampled by x
    for (let i = 0; i <= N; i++) {
      const y = -b + (2 * b * i) / N
      points.push([(y * y) / (4 * a || 1), y, 0])
    }
  }
  return points
}

function ConicMesh({ spec }) {
  const groupRef = useRef(null)
  const points = useMemo(() => conicPoints(spec), [spec])

  useGSAP(() => {
    gsap.from(groupRef.current.scale, { x: 0, y: 0, z: 0, duration: 0.8, ease: 'back.out(1.5)' })
  }, { scope: groupRef })

  return (
    <group ref={groupRef}>
      <Line points={points} color="#059669" lineWidth={2} />
    </group>
  )
}

export default function ConicSectionScene({ spec }) {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 50 }} style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={0.9} />
      <ConicMesh spec={spec} />
      <OrbitControls makeDefault />
    </Canvas>
  )
}

export { ConicMesh, conicPoints }

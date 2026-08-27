import { useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Line, Html } from '@react-three/drei'
import { useGSAP } from '@gsap/react'
import { gsap } from '../../../../lib/gsap.js'
import { vectorAddGeometry } from './geometry.js'

function Arrow({ start, end, color, label }) {
  return (
    <>
      <Line points={[start, end]} color={color} lineWidth={3} />
      <Html position={end} center>
        <span style={{ color, fontSize: 12, fontWeight: 700 }}>{label}</span>
      </Html>
    </>
  )
}

function VectorMesh({ spec }) {
  const groupRef = useRef(null)
  const { segments, sum } = useMemo(() => vectorAddGeometry(spec), [spec])

  useGSAP(() => {
    gsap.from(groupRef.current.scale, { x: 0, y: 0, z: 0, duration: 0.8, ease: 'back.out(1.5)' })
  }, { scope: groupRef })

  return (
    <group ref={groupRef}>
      {segments.map((seg, i) => (
        <Arrow key={i} start={seg.start} end={seg.end} color="#F0A93E" label={`v${i + 1}`} />
      ))}
      {sum && <Arrow start={sum.start} end={sum.end} color="#6366F1" label="tổng" />}
    </group>
  )
}

export default function VectorAdditionScene({ spec }) {
  return (
    <Canvas camera={{ position: [4, 3, 5], fov: 50 }} style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={0.9} />
      <VectorMesh spec={spec} />
      <OrbitControls makeDefault />
    </Canvas>
  )
}

export { VectorMesh }

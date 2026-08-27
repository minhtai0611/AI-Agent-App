import { useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'
import { useGSAP } from '@gsap/react'
import { gsap } from '../../../../lib/gsap.js'
import { prismGeometry } from './geometry.js'

function PrismMesh({ spec }) {
  const groupRef = useRef(null)
  const { bottom, top } = useMemo(() => prismGeometry(spec), [spec])

  useGSAP(() => {
    gsap.from(groupRef.current.scale, { x: 0, y: 0, z: 0, duration: 0.8, ease: 'back.out(1.5)' })
  }, { scope: groupRef })

  const bottomLoop = [...bottom, bottom[0]]
  const topLoop = [...top, top[0]]
  const verticals = bottom.map((v, i) => [v, top[i]])

  return (
    <group ref={groupRef}>
      <Line points={bottomLoop} color="#F0A93E" lineWidth={2} />
      <Line points={topLoop} color="#F0A93E" lineWidth={2} />
      {verticals.map((seg, i) => <Line key={i} points={seg} color="#F0A93E" lineWidth={2} />)}
    </group>
  )
}

export default function PrismScene({ spec }) {
  return (
    <Canvas camera={{ position: [4, 3, 5], fov: 50 }} style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 2]} intensity={0.6} />
      <PrismMesh spec={spec} />
      <OrbitControls makeDefault />
    </Canvas>
  )
}

export { PrismMesh }

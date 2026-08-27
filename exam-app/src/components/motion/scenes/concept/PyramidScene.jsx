import { useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Line, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGSAP } from '@gsap/react'
import { gsap } from '../../../../lib/gsap.js'
import { pyramidGeometry, pyramidCrossSection } from './geometry.js'

function Edges({ points, color = '#F0A93E' }) {
  return <Line points={points} color={color} lineWidth={2} />
}

function PyramidMesh({ spec }) {
  const groupRef = useRef(null)
  const [heightRatio, setHeightRatio] = useState(0.5)
  const { baseVertices, apex } = useMemo(() => pyramidGeometry(spec), [spec])
  const crossSection = useMemo(
    () => (spec.highlight === 'cross_section' ? pyramidCrossSection(spec, heightRatio) : null),
    [spec, heightRatio]
  )

  useGSAP(() => {
    gsap.from(groupRef.current.scale, { x: 0, y: 0, z: 0, duration: 0.8, ease: 'back.out(1.5)' })
  }, { scope: groupRef })

  const baseLoop = [...baseVertices, baseVertices[0]]
  const apexEdges = baseVertices.map((v) => [v, apex])

  return (
    <group ref={groupRef}>
      <Edges points={baseLoop} />
      {apexEdges.map((seg, i) => <Edges key={i} points={seg} />)}
      {crossSection && <Edges points={[...crossSection, crossSection[0]]} color="#6366F1" />}
      {spec.highlight === 'cross_section' && (
        <Html position={[0, spec.apex_height + 0.6, 0]} center>
          <input
            aria-label="Chiều cao mặt cắt"
            type="range" min={0} max={1} step={0.01} value={heightRatio}
            onChange={(e) => setHeightRatio(parseFloat(e.target.value))}
          />
        </Html>
      )}
    </group>
  )
}

export default function PyramidScene({ spec }) {
  return (
    <Canvas camera={{ position: [4, 3, 5], fov: 50 }} style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 2]} intensity={0.6} />
      <PyramidMesh spec={spec} />
      <OrbitControls makeDefault />
    </Canvas>
  )
}

export { PyramidMesh }

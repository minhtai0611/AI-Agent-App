import { useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useGSAP } from '@gsap/react'
import { gsap } from '../../../../lib/gsap.js'
import { solidOfRevolutionSample } from './geometry.js'

// THREE.LatheGeometry revolves a profile of Vector2(radius, height) around the Y axis.
// For axis='x' (revolving around the x-axis instead), we swap radius/height roles.
function buildLatheGeometry(points, axis) {
  const profile = points.map(([x, y]) => {
    const radius = Math.max(Math.abs(axis === 'x' ? y : y), 1e-4)
    const height = axis === 'x' ? x : x
    return new THREE.Vector2(radius, height)
  })
  return new THREE.LatheGeometry(profile, 48)
}

function LatheMesh({ spec }) {
  const meshRef = useRef(null)
  const points = useMemo(() => solidOfRevolutionSample(spec, 48), [spec])
  const geometry = useMemo(() => buildLatheGeometry(points, spec.axis), [points, spec.axis])

  useGSAP(() => {
    gsap.from(meshRef.current.scale, { x: 0, y: 0, z: 0, duration: 0.8, ease: 'back.out(1.5)' })
  }, { scope: meshRef })

  const rotation = spec.axis === 'x' ? [0, 0, Math.PI / 2] : [0, 0, 0]

  return (
    <mesh ref={meshRef} rotation={rotation}>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial color="#F0A93E" side={THREE.DoubleSide} />
    </mesh>
  )
}

export default function SolidOfRevolutionScene({ spec }) {
  return (
    <Canvas camera={{ position: [4, 3, 5], fov: 50 }} style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 2]} intensity={0.5} />
      <LatheMesh spec={spec} />
      <OrbitControls makeDefault />
    </Canvas>
  )
}

export { LatheMesh, buildLatheGeometry }

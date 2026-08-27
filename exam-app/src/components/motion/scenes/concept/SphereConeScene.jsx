import { useRef, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useGSAP } from '@gsap/react'
import { gsap } from '../../../../lib/gsap.js'
import { sphereConeGeometry } from './geometry.js'

function ShapeMesh({ spec }) {
  const meshRef = useRef(null)
  const g = useMemo(() => sphereConeGeometry(spec), [spec])

  useGSAP(() => {
    gsap.from(meshRef.current.scale, { x: 0, y: 0, z: 0, duration: 0.8, ease: 'back.out(1.5)' })
  }, { scope: meshRef })

  return (
    <mesh ref={meshRef}>
      {g.shape === 'sphere' && <sphereGeometry args={[g.radius, 32, 32]} />}
      {g.shape === 'cone' && <coneGeometry args={[g.radius, g.height, 32]} />}
      {g.shape === 'cylinder' && <cylinderGeometry args={[g.radius, g.radius, g.height, 32]} />}
      <meshStandardMaterial color="#4C3B8C" wireframe={spec.highlight === 'cross_section'} />
    </mesh>
  )
}

export default function SphereConeScene({ spec }) {
  return (
    <Canvas camera={{ position: [4, 3, 5], fov: 50 }} style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 2]} intensity={0.6} />
      <ShapeMesh spec={spec} />
      <OrbitControls makeDefault />
    </Canvas>
  )
}

export { ShapeMesh }

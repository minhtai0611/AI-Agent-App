import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'

// Tier 3 — ambient 3D rendering of the summit-beacon motif behind the Landing
// hero. Kept deliberately minimal (one mesh, two lights, no textures/postfx)
// so the WebGL payload earns its cost rather than becoming its own liability.
function Peak() {
  const groupRef = useRef(null)
  const lightRef = useRef(null)

  useFrame((state, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.08
    if (lightRef.current) {
      const t = state.clock.elapsedTime
      lightRef.current.intensity = 1.4 + Math.sin(t * 1.1) * 0.5
    }
  })

  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.3, 0]}>
        <coneGeometry args={[1.6, 2.2, 5, 1, true]} />
        <meshStandardMaterial
          color="#A6620C"
          wireframe
          transparent
          opacity={0.55}
        />
      </mesh>
      <pointLight ref={lightRef} position={[0, 1.1, 0]} color="#F0A93E" intensity={1.6} distance={6} />
    </group>
  )
}

export default function LandingHeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 4.2], fov: 42 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 1.5]}
    >
      <ambientLight intensity={0.35} color="#4C3B8C" />
      <Peak />
    </Canvas>
  )
}

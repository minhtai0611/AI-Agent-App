import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const PARTICLE_COUNT = 60
const COLORS = ['#A6620C', '#F0A93E', '#4C3B8C', '#059669']
const DURATION = 1.8 // seconds — one-shot burst, not a looping effect

// Tier 3 — a one-shot 3D particle burst layered alongside (not replacing) the
// existing canvas-confetti celebration on a big win. Self-contained: fades
// and calls onComplete so the parent can unmount it, keeping this off the
// page permanently rather than as a persistent decorative loop.
function Burst({ onComplete }) {
  const meshRef = useRef(null)
  const startRef = useRef(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const directions = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, () => {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(Math.random() * 2 - 1)
        return new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi)
        )
      }),
    []
  )

  useFrame((state) => {
    if (startRef.current === null) startRef.current = state.clock.elapsedTime
    const t = (state.clock.elapsedTime - startRef.current) / DURATION
    if (t >= 1) {
      onComplete?.()
      return
    }
    const ease = 1 - Math.pow(1 - t, 3)
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const dir = directions[i]
      dummy.position.copy(dir).multiplyScalar(ease * 3.2)
      dummy.scale.setScalar((1 - t) * 0.12)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={COLORS[0]} />
    </instancedMesh>
  )
}

export default function ResultsCelebrationScene({ onComplete }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 1.5]}
    >
      <ambientLight intensity={1} />
      <Burst onComplete={onComplete} />
    </Canvas>
  )
}

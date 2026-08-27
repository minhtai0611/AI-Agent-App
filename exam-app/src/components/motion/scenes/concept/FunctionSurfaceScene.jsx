import { useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Line, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGSAP } from '@gsap/react'
import { gsap } from '../../../../lib/gsap.js'
import { functionSurfaceSample } from './geometry.js'
import { compileExpr } from '../../../../utils/mathExpr.js'

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

function SurfaceMesh({ spec }) {
  const groupRef = useRef(null)
  const [ySlice, setYSlice] = useState(() => (spec.domain[2] + spec.domain[3]) / 2)
  const points = useMemo(() => functionSurfaceSample(spec, 24), [spec])
  const geometry = useMemo(() => buildSurfaceGeometry(points), [points])
  const slicePoints = useMemo(() => {
    const fn = compileExpr(spec.expr)
    const [xmin, xmax] = spec.domain
    return Array.from({ length: 25 }, (_, i) => {
      const x = xmin + ((xmax - xmin) * i) / 24
      return [x, fn({ x, y: ySlice }), ySlice]
    })
  }, [spec, ySlice])

  useGSAP(() => {
    gsap.from(groupRef.current.scale, { x: 0, y: 0, z: 0, duration: 0.8, ease: 'back.out(1.5)' })
  }, { scope: groupRef })

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#6366F1" side={THREE.DoubleSide} wireframe={false} transparent opacity={0.85} />
      </mesh>
      <Line points={slicePoints} color="#F0A93E" lineWidth={3} />
      <Html position={[0, spec.domain[3] + 1, 0]} center>
        <input
          aria-label="Mặt cắt theo y"
          type="range" min={spec.domain[2]} max={spec.domain[3]} step={0.1} value={ySlice}
          onChange={(e) => setYSlice(parseFloat(e.target.value))}
        />
      </Html>
    </group>
  )
}

export default function FunctionSurfaceScene({ spec }) {
  return (
    <Canvas camera={{ position: [4, 3, 5], fov: 50 }} style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 2]} intensity={0.5} />
      <SurfaceMesh spec={spec} />
      <OrbitControls makeDefault />
    </Canvas>
  )
}

export { SurfaceMesh, buildSurfaceGeometry }

import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

function Particles() {
  const ref = useRef<THREE.Points>(null);
  const { mouse, viewport } = useThree();
  const [hovered, setHovered] = useState(false);
  
  const count = 3000;
  const [positions, speeds] = useMemo(() => {
    const p = new Float32Array(count * 3);
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos((Math.random() * 2) - 1);
      const r = 4 + Math.random() * 4; // Sphere radius between 4 and 8
      
      p[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      p[i * 3 + 2] = r * Math.cos(phi);
      
      s[i] = Math.random() * 0.2 + 0.1;
    }
    return [p, s];
  }, [count]);

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.x += delta * 0.05;
      ref.current.rotation.y += delta * 0.08;
      
      // Gentle mouse parallax
      const targetX = (mouse.x * viewport.width) / 10;
      const targetY = (mouse.y * viewport.height) / 10;
      
      ref.current.position.x += (targetX - ref.current.position.x) * delta * 2;
      ref.current.position.y += (targetY - ref.current.position.y) * delta * 2;
    }
  });

  return (
    <Points 
      ref={ref} 
      positions={positions} 
      stride={3} 
      frustumCulled={false}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <PointMaterial
        transparent
        color="#000000"
        size={hovered ? 0.03 : 0.02}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.4}
      />
    </Points>
  );
}

function AbstractShape() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { mouse, viewport } = useThree();

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.2;
      meshRef.current.rotation.y += delta * 0.3;
      
      // Interactive scale
      const targetScale = 1 + (Math.abs(mouse.x) + Math.abs(mouse.y)) * 0.1;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[2, 1]} />
      <meshBasicMaterial color="#000000" wireframe transparent opacity={0.1} />
    </mesh>
  );
}

export default function ThreeBackground() {
  return (
    <div className="fixed inset-0 -z-10 bg-white">
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
        <fog attach="fog" args={['#ffffff', 5, 15]} />
        <Particles />
        <AbstractShape />
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-white pointer-events-none" />
    </div>
  );
}

/**
 * Avatar3DScene - The heavy WebGL portion of the avatar.
 *
 * Kept in its own file so React.lazy can split it into a separate chunk —
 * the main bundle stays lean. Loaded only when the full Concierge stage
 * opens; the launcher uses the cheap 2D image fallback.
 */
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarEmotion, AvatarState } from "./Avatar";

const EMOTION_COLOR: Record<AvatarEmotion, string> = {
  neutral:    "#5aa8ff",
  happy:      "#ffb24a",
  excited:    "#ff8a3a",
  thoughtful: "#b48cff",
  listening:  "#3ad8ff",
  anger:      "#ff4d4d",
};

interface SceneProps {
  amplitude: number;
  emotion: AvatarEmotion;
  state: AvatarState;
}

function AvatarCard({
  pointer, amplitude, state, emotion,
}: SceneProps & { pointer: React.MutableRefObject<{ x: number; y: number }> }) {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useLoader(THREE.TextureLoader, "/nimbus-avatar.png");

  useEffect(() => {
    if (!texture) return;
    texture.anisotropy = 8;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
  }, [texture]);

  // Curved plane for that "3D bust" feel
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(2.4, 2.4, 64, 64);
    const positions = g.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = -Math.cos((x / 1.2) * (Math.PI / 2)) * 0.18;
      positions.setZ(i, z);
    }
    positions.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();

    // Mouse parallax — smoothed
    const targetRotY = pointer.current.x * 0.22;
    const targetRotX = -pointer.current.y * 0.16;
    groupRef.current.rotation.y += (targetRotY - groupRef.current.rotation.y) * 0.08;
    groupRef.current.rotation.x += (targetRotX - groupRef.current.rotation.x) * 0.08;

    // Breathe + speak tilt
    groupRef.current.position.y = Math.sin(t * 1.3) * 0.02;
    if (state === "speaking") {
      groupRef.current.rotation.z = Math.sin(t * 3) * 0.04 * (0.5 + amplitude);
    } else {
      groupRef.current.rotation.z += (0 - groupRef.current.rotation.z) * 0.1;
    }

    // Shake on anger / excited
    if (emotion === "anger") {
      groupRef.current.position.x = (Math.random() - 0.5) * 0.04;
    } else if (emotion === "excited") {
      groupRef.current.position.x = Math.sin(t * 12) * 0.015;
    } else {
      groupRef.current.position.x += (0 - groupRef.current.position.x) * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial
          map={texture}
          transparent
          roughness={0.55}
          metalness={0.05}
          emissive={new THREE.Color(EMOTION_COLOR[emotion])}
          emissiveIntensity={
            state === "speaking" ? 0.25 + amplitude * 0.25
              : state === "listening" ? 0.18 : 0.08
          }
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function Particles({ emotion }: { emotion: AvatarEmotion }) {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 220;

  const { positions, baseY } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const baseY = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.6 + Math.random() * 1.8;
      const y = (Math.random() - 0.5) * 3.5;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius - 0.6;
      baseY[i] = y;
    }
    return { positions, baseY };
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const arr = ref.current.geometry.attributes.position.array as Float32Array;
    const speed = emotion === "anger" || emotion === "excited" ? 1.6 : 0.6;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] = baseY[i] + Math.sin(t * speed + i * 0.7) * 0.25;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    ref.current.rotation.y = t * 0.08;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={COUNT}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={EMOTION_COLOR[emotion]}
        size={0.04}
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Pedestal({ amplitude, state, emotion }: SceneProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const t = clock.getElapsedTime();
    const base = state === "speaking"
      ? 1.4 + amplitude * 0.6
      : state === "listening" ? 1.4 + Math.sin(t * 3) * 0.06 : 1.35;
    ringRef.current.scale.set(base, base, 1);
    (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 2) * 0.1;
  });
  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.8, 0]}>
      <ringGeometry args={[0.85, 1.0, 64]} />
      <meshBasicMaterial color={EMOTION_COLOR[emotion]} transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

function EmotionLighting({ emotion, state, amplitude }: SceneProps) {
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    const t = clock.getElapsedTime();
    const r = 2.2;
    lightRef.current.position.x = Math.cos(t * 0.6) * r;
    lightRef.current.position.z = Math.sin(t * 0.6) * r + 0.5;
    lightRef.current.position.y = 0.8 + Math.sin(t * 0.4) * 0.3;
    lightRef.current.intensity = state === "speaking"
      ? 1.6 + amplitude * 1.4
      : state === "listening" ? 1.8 : 1.4;
  });
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 3, 2]} intensity={1.2} castShadow />
      <pointLight ref={lightRef} color={EMOTION_COLOR[emotion]} intensity={1.4} distance={6} />
    </>
  );
}

export default function Avatar3DScene({
  amplitude, emotion, state,
}: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      pointer.current = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    };
    const onLeave = () => { pointer.current = { x: 0, y: 0 }; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <Canvas
        className="!absolute inset-0"
        camera={{ position: [0, 0.1, 3.6], fov: 38 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        shadows
      >
        <EmotionLighting emotion={emotion} state={state} amplitude={amplitude} />
        <Suspense fallback={null}>
          <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.35}>
            <AvatarCard pointer={pointer} amplitude={amplitude} state={state} emotion={emotion} />
          </Float>
        </Suspense>
        <Particles emotion={emotion} />
        <Pedestal amplitude={amplitude} state={state} emotion={emotion} />
      </Canvas>
    </div>
  );
}

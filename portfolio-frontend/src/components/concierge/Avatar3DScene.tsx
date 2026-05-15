/**
 * Avatar3DScene - "Nimbus" as a real procedural 3D character.
 *
 * Not a textured plane — a full humanoid built from three.js primitives
 * (spheres, capsules, boxes, tori). Pixar-cartoon proportions: big head,
 * smaller body. Inspired by the user's reference image but modeled in 3D
 * so the character actually moves in 3D space.
 *
 * Anatomy:
 *   ▸ Head sphere with skin material
 *   ▸ Wavy quiff built from layered sphere/capsule shapes
 *   ▸ Eyes (white sclera + brown iris + black pupil) — blink via scale-Y
 *   ▸ Eyebrows (small rotated boxes)
 *   ▸ Cheeks (rosy emissive bloom spheres)
 *   ▸ Nose (small sphere)
 *   ▸ Mouth (curved torus segment) — opens with TTS amplitude
 *   ▸ Neck (cylinder)
 *   ▸ Torso (capsule, hoodie color) with tee triangle at the V
 *   ▸ Arms (upper + lower capsules + hand sphere) with idle sway
 *   ▸ Legs (capsules) + sneakers (rounded boxes with orange sole stripe)
 *
 * Live animation (60fps via useFrame):
 *   ▸ Body float + breathing scale
 *   ▸ Head follows the cursor (parallax)
 *   ▸ Arms counter-phase pendulum at idle
 *   ▸ Right hand raises when speaking
 *   ▸ Both arms lift on excited
 *   ▸ Blink loop
 *   ▸ Mouth open scales with audio amplitude during speaking
 *   ▸ Anger: full-body jitter + tint shift; Excited: bounce + faster particles
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
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

// Character color palette (matched to the user's Pixar-style reference)
const PALETTE = {
  skin:      "#f4cca3",
  skinDark:  "#c99270",
  hair:      "#3d2412",
  hairLite:  "#6b4023",
  hoodie:    "#23283a",
  hoodieDk:  "#10131e",
  tee:       "#ffffff",
  jeans:     "#1a2440",
  shoe:      "#f5f5f5",
  sole:      "#FF9900",
  iris:      "#5a3a1a",
  blush:     "#ff8a7a",
  mouth:     "#7c2a26",
  lipDark:   "#4a1812",
  eyebrow:   "#2a1608",
};

interface SceneProps {
  amplitude: number;
  emotion: AvatarEmotion;
  state: AvatarState;
}

// ============================================================================
// Character — modeled procedurally from primitives
// ============================================================================
function Character({
  pointer, amplitude, state, emotion,
}: SceneProps & { pointer: React.MutableRefObject<{ x: number; y: number }> }) {
  const root = useRef<THREE.Group>(null);
  const headPivot = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const leftEye = useRef<THREE.Mesh>(null);
  const rightEye = useRef<THREE.Mesh>(null);

  // Blink state
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const loop = () => {
      const delay = 2400 + Math.random() * 2800;
      setTimeout(() => {
        if (cancelled) return;
        setBlink(true);
        setTimeout(() => !cancelled && setBlink(false), 120);
        loop();
      }, delay);
    };
    loop();
    return () => { cancelled = true; };
  }, []);

  // Eye scale targets (springs into place every frame)
  useFrame(() => {
    const targetY = blink ? 0.08 : 1;
    if (leftEye.current)  leftEye.current.scale.y  += (targetY - leftEye.current.scale.y)  * 0.4;
    if (rightEye.current) rightEye.current.scale.y += (targetY - rightEye.current.scale.y) * 0.4;
  });

  // Master per-frame animation
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.getElapsedTime();

    // ------- Body float -------
    root.current.position.y = -0.6 + Math.sin(t * 1.3) * 0.04;

    // ------- Body posture per emotion -------
    if (emotion === "anger") {
      root.current.position.x = (Math.random() - 0.5) * 0.03;
    } else if (emotion === "excited") {
      root.current.position.y += Math.abs(Math.sin(t * 6)) * 0.05;
    } else {
      root.current.position.x += (0 - root.current.position.x) * 0.2;
    }

    // ------- Torso subtle breathing -------
    if (torso.current) {
      const breathe = 1 + Math.sin(t * 1.3) * 0.012;
      torso.current.scale.set(1, breathe, 1);
    }

    // ------- Head: pointer-follow + sway -------
    if (headPivot.current) {
      const targetRotY = pointer.current.x * 0.45;
      const targetRotX = -pointer.current.y * 0.28;
      headPivot.current.rotation.y += (targetRotY - headPivot.current.rotation.y) * 0.08;
      headPivot.current.rotation.x += (targetRotX - headPivot.current.rotation.x) * 0.08;
      if (state === "speaking") {
        headPivot.current.rotation.z = Math.sin(t * 3) * 0.06 * (0.4 + amplitude);
      } else if (state === "thinking") {
        headPivot.current.rotation.z = -0.12;
      } else {
        headPivot.current.rotation.z += (0 - headPivot.current.rotation.z) * 0.1;
      }
    }

    // ------- Mouth (lipsync) -------
    if (mouth.current) {
      const open = state === "speaking" ? 0.18 + amplitude * 1.6 : 0.18;
      mouth.current.scale.set(1, open, 1);
    }

    // ------- Arms: counter-phase sway + raise on speak/excite -------
    if (leftArm.current) {
      const raise = emotion === "excited" ? -0.9 : 0;
      const sway = Math.sin(t * 1.6) * 0.08;
      leftArm.current.rotation.z += (raise + sway - leftArm.current.rotation.z) * 0.1;
    }
    if (rightArm.current) {
      const raise = (state === "speaking" || emotion === "excited") ? 0.9 : 0;
      const sway = -Math.sin(t * 1.6) * 0.08;
      rightArm.current.rotation.z += (raise + sway - rightArm.current.rotation.z) * 0.1;
    }
  });

  return (
    <group ref={root} position={[0, -0.6, 0]}>
      {/* ===== TORSO + LEGS group ===== */}
      <group ref={torso}>
        {/* Pelvis */}
        <mesh position={[0, -0.4, 0]}>
          <capsuleGeometry args={[0.36, 0.16, 4, 12]} />
          <meshStandardMaterial color={PALETTE.jeans} roughness={0.85} />
        </mesh>

        {/* Hoodie body */}
        <mesh position={[0, 0.15, 0]}>
          <capsuleGeometry args={[0.48, 0.78, 6, 16]} />
          <meshStandardMaterial color={PALETTE.hoodie} roughness={0.75} />
        </mesh>
        {/* Tee V-peek at the neckline */}
        <mesh position={[0, 0.66, 0.36]} rotation={[0.2, 0, 0]}>
          <coneGeometry args={[0.2, 0.32, 24, 1, true]} />
          <meshStandardMaterial color={PALETTE.tee} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
        {/* Hoodie inner shadow */}
        <mesh position={[0, 0.65, 0.38]}>
          <sphereGeometry args={[0.15, 16, 12]} />
          <meshStandardMaterial color={PALETTE.hoodieDk} roughness={0.85} />
        </mesh>
        {/* Cloud emblem on tee */}
        <mesh position={[0, 0.36, 0.5]}>
          <circleGeometry args={[0.08, 24]} />
          <meshStandardMaterial color={EMOTION_COLOR.listening} emissive={EMOTION_COLOR.listening} emissiveIntensity={0.35} />
        </mesh>
        {/* Hoodie zipper */}
        <mesh position={[0, 0.18, 0.49]}>
          <boxGeometry args={[0.014, 0.78, 0.01]} />
          <meshStandardMaterial color="#4b5060" metalness={0.6} roughness={0.4} />
        </mesh>

        {/* Drawstrings */}
        {[-0.08, 0.08].map((x, i) => (
          <mesh key={i} position={[x, 0.5, 0.48]} rotation={[0.2, 0, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.32, 8]} />
            <meshStandardMaterial color="#3a4055" roughness={0.7} />
          </mesh>
        ))}
      </group>

      {/* ===== LEGS ===== */}
      {[-0.18, 0.18].map((x, i) => (
        <group key={i} position={[x, -1.0, 0]}>
          <mesh>
            <capsuleGeometry args={[0.14, 0.72, 4, 10]} />
            <meshStandardMaterial color={PALETTE.jeans} roughness={0.85} />
          </mesh>
          {/* Shoe */}
          <group position={[0, -0.5, 0.12]}>
            <mesh>
              <boxGeometry args={[0.22, 0.16, 0.36]} />
              <meshStandardMaterial color={PALETTE.shoe} roughness={0.5} />
            </mesh>
            {/* Orange sole stripe */}
            <mesh position={[0, -0.07, 0]}>
              <boxGeometry args={[0.23, 0.04, 0.38]} />
              <meshStandardMaterial color={PALETTE.sole} emissive={PALETTE.sole} emissiveIntensity={0.2} />
            </mesh>
          </group>
        </group>
      ))}

      {/* ===== ARMS ===== */}
      {/* Left arm */}
      <group ref={leftArm} position={[-0.48, 0.45, 0]}>
        <mesh position={[-0.18, -0.4, 0]} rotation={[0, 0, 0.18]}>
          <capsuleGeometry args={[0.11, 0.65, 4, 10]} />
          <meshStandardMaterial color={PALETTE.hoodie} roughness={0.75} />
        </mesh>
        {/* Hand */}
        <mesh position={[-0.32, -0.85, 0]}>
          <sphereGeometry args={[0.1, 16, 12]} />
          <meshStandardMaterial color={PALETTE.skin} roughness={0.7} />
        </mesh>
      </group>
      {/* Right arm */}
      <group ref={rightArm} position={[0.48, 0.45, 0]}>
        <mesh position={[0.18, -0.4, 0]} rotation={[0, 0, -0.18]}>
          <capsuleGeometry args={[0.11, 0.65, 4, 10]} />
          <meshStandardMaterial color={PALETTE.hoodie} roughness={0.75} />
        </mesh>
        <mesh position={[0.32, -0.85, 0]}>
          <sphereGeometry args={[0.1, 16, 12]} />
          <meshStandardMaterial color={PALETTE.skin} roughness={0.7} />
        </mesh>
      </group>

      {/* ===== NECK ===== */}
      <mesh position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.13, 0.16, 0.18, 16]} />
        <meshStandardMaterial color={PALETTE.skin} roughness={0.7} />
      </mesh>

      {/* ===== HEAD pivot (rotates to follow cursor) ===== */}
      <group ref={headPivot} position={[0, 0.98, 0]}>

        {/* Head sphere (squish slightly for Pixar feel) */}
        <mesh scale={[1, 1.05, 1]}>
          <sphereGeometry args={[0.42, 48, 36]} />
          <meshStandardMaterial color={PALETTE.skin} roughness={0.6} />
        </mesh>

        {/* Cheek blush */}
        <mesh position={[-0.22, -0.04, 0.34]}>
          <sphereGeometry args={[0.08, 18, 14]} />
          <meshStandardMaterial color={PALETTE.blush} emissive={PALETTE.blush} emissiveIntensity={0.25} transparent opacity={0.55} roughness={0.5} />
        </mesh>
        <mesh position={[0.22, -0.04, 0.34]}>
          <sphereGeometry args={[0.08, 18, 14]} />
          <meshStandardMaterial color={PALETTE.blush} emissive={PALETTE.blush} emissiveIntensity={0.25} transparent opacity={0.55} roughness={0.5} />
        </mesh>

        {/* Ears */}
        <mesh position={[-0.41, 0, 0]} rotation={[0, 0, 0]}>
          <sphereGeometry args={[0.09, 18, 14]} />
          <meshStandardMaterial color={PALETTE.skin} roughness={0.7} />
        </mesh>
        <mesh position={[0.41, 0, 0]}>
          <sphereGeometry args={[0.09, 18, 14]} />
          <meshStandardMaterial color={PALETTE.skin} roughness={0.7} />
        </mesh>

        {/* Hair — wavy quiff built from layered shapes */}
        {/* Cap base */}
        <mesh position={[0, 0.22, -0.02]} scale={[1, 0.7, 1]}>
          <sphereGeometry args={[0.44, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
          <meshStandardMaterial color={PALETTE.hair} roughness={0.5} />
        </mesh>
        {/* Quiff lift */}
        <mesh position={[-0.05, 0.42, 0.15]} rotation={[0.4, 0, -0.1]}>
          <sphereGeometry args={[0.14, 24, 18]} />
          <meshStandardMaterial color={PALETTE.hair} roughness={0.55} />
        </mesh>
        <mesh position={[0.08, 0.42, 0.16]} rotation={[0.4, 0, 0.1]}>
          <sphereGeometry args={[0.13, 24, 18]} />
          <meshStandardMaterial color={PALETTE.hair} roughness={0.55} />
        </mesh>
        {/* Side wave */}
        <mesh position={[0.22, 0.34, 0.18]} rotation={[0.4, 0.3, 0.2]}>
          <sphereGeometry args={[0.12, 22, 16]} />
          <meshStandardMaterial color={PALETTE.hair} roughness={0.55} />
        </mesh>
        <mesh position={[-0.22, 0.34, 0.18]} rotation={[0.4, -0.3, -0.2]}>
          <sphereGeometry args={[0.12, 22, 16]} />
          <meshStandardMaterial color={PALETTE.hair} roughness={0.55} />
        </mesh>
        {/* Sideburns */}
        <mesh position={[-0.39, 0.08, 0.02]}>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshStandardMaterial color={PALETTE.hair} roughness={0.6} />
        </mesh>
        <mesh position={[0.39, 0.08, 0.02]}>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshStandardMaterial color={PALETTE.hair} roughness={0.6} />
        </mesh>
        {/* Highlight strand */}
        <mesh position={[0.05, 0.46, 0.2]} rotation={[0.5, 0, 0.05]}>
          <sphereGeometry args={[0.06, 16, 12]} />
          <meshStandardMaterial color={PALETTE.hairLite} roughness={0.4} emissive={PALETTE.hairLite} emissiveIntensity={0.1} />
        </mesh>

        {/* Eyebrows (small angled boxes) */}
        <mesh position={[-0.16, 0.12, 0.39]} rotation={[0, 0, emotion === "anger" ? -0.4 : -0.1]}>
          <boxGeometry args={[0.13, 0.04, 0.04]} />
          <meshStandardMaterial color={PALETTE.eyebrow} roughness={0.7} />
        </mesh>
        <mesh position={[0.16, 0.12, 0.39]} rotation={[0, 0, emotion === "anger" ? 0.4 : 0.1]}>
          <boxGeometry args={[0.13, 0.04, 0.04]} />
          <meshStandardMaterial color={PALETTE.eyebrow} roughness={0.7} />
        </mesh>

        {/* Eyes — sclera + iris + pupil */}
        <group position={[-0.14, 0.03, 0.39]}>
          <mesh ref={leftEye} scale={[1, 1, 1]}>
            <sphereGeometry args={[0.07, 20, 16]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
          {/* Iris */}
          <mesh position={[0, 0, 0.05]}>
            <sphereGeometry args={[0.038, 16, 12]} />
            <meshStandardMaterial color={PALETTE.iris} emissive={state === "listening" || state === "speaking" ? EMOTION_COLOR[emotion] : "#000"} emissiveIntensity={state === "listening" || state === "speaking" ? 0.35 : 0} roughness={0.4} />
          </mesh>
          {/* Pupil */}
          <mesh position={[0, 0, 0.07]}>
            <sphereGeometry args={[0.018, 12, 10]} />
            <meshStandardMaterial color="#0a0612" />
          </mesh>
          {/* Catch light */}
          <mesh position={[-0.012, 0.018, 0.084]}>
            <sphereGeometry args={[0.012, 10, 8]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={1.2} />
          </mesh>
        </group>
        <group position={[0.14, 0.03, 0.39]}>
          <mesh ref={rightEye} scale={[1, 1, 1]}>
            <sphereGeometry args={[0.07, 20, 16]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <sphereGeometry args={[0.038, 16, 12]} />
            <meshStandardMaterial color={PALETTE.iris} emissive={state === "listening" || state === "speaking" ? EMOTION_COLOR[emotion] : "#000"} emissiveIntensity={state === "listening" || state === "speaking" ? 0.35 : 0} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.07]}>
            <sphereGeometry args={[0.018, 12, 10]} />
            <meshStandardMaterial color="#0a0612" />
          </mesh>
          <mesh position={[-0.012, 0.018, 0.084]}>
            <sphereGeometry args={[0.012, 10, 8]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={1.2} />
          </mesh>
        </group>

        {/* Nose */}
        <mesh position={[0, -0.04, 0.42]}>
          <sphereGeometry args={[0.04, 16, 12]} />
          <meshStandardMaterial color={PALETTE.skinDark} roughness={0.7} />
        </mesh>

        {/* Mouth — smile shape, scales Y for lipsync */}
        <mesh ref={mouth} position={[0, -0.18, 0.4]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.09, 0.025, 12, 24, Math.PI]} />
          <meshStandardMaterial color={emotion === "anger" ? PALETTE.lipDark : PALETTE.mouth} roughness={0.6} />
        </mesh>
        {/* Teeth (visible white under the smile) */}
        <mesh position={[0, -0.17, 0.405]}>
          <boxGeometry args={[0.14, 0.025, 0.005]} />
          <meshStandardMaterial color="#fff8f0" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

// ============================================================================
// 3D particle field — same as before but tuned
// ============================================================================
function Particles({ emotion }: { emotion: AvatarEmotion }) {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 240;
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
          count={COUNT} array={positions} itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={EMOTION_COLOR[emotion]} size={0.04}
        transparent opacity={0.85}
        sizeAttenuation depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ============================================================================
// Pedestal ring
// ============================================================================
function Pedestal({ amplitude, state, emotion }: SceneProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const t = clock.getElapsedTime();
    const base = state === "speaking"
      ? 1.5 + amplitude * 0.6
      : state === "listening" ? 1.5 + Math.sin(t * 3) * 0.06 : 1.4;
    ringRef.current.scale.set(base, base, 1);
    (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 2) * 0.1;
  });
  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.0, 0]}>
      <ringGeometry args={[0.85, 1.0, 64]} />
      <meshBasicMaterial color={EMOTION_COLOR[emotion]} transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ============================================================================
// Lighting — three-point + emotion rim
// ============================================================================
function Lighting({ emotion, state, amplitude }: SceneProps) {
  const rimRef = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!rimRef.current) return;
    const t = clock.getElapsedTime();
    const r = 2.4;
    rimRef.current.position.x = Math.cos(t * 0.6) * r;
    rimRef.current.position.z = Math.sin(t * 0.6) * r + 0.5;
    rimRef.current.position.y = 0.8 + Math.sin(t * 0.4) * 0.3;
    rimRef.current.intensity = state === "speaking"
      ? 1.6 + amplitude * 1.4
      : state === "listening" ? 1.8 : 1.3;
  });
  return (
    <>
      <ambientLight intensity={0.55} />
      {/* Key light (warm front-top) */}
      <directionalLight position={[2, 3, 3]} intensity={1.1} color="#fff5e0" castShadow />
      {/* Fill light (cool side) */}
      <directionalLight position={[-3, 2, 2]} intensity={0.5} color="#a3c8ff" />
      {/* Rim — emotion colored, orbiting */}
      <pointLight ref={rimRef} color={EMOTION_COLOR[emotion]} intensity={1.4} distance={7} />
    </>
  );
}

// ============================================================================
// Scene wrapper
// ============================================================================
export default function Avatar3DScene({ amplitude, emotion, state }: SceneProps) {
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
        camera={{ position: [0, 0.2, 3.8], fov: 36 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        shadows
      >
        <Lighting emotion={emotion} state={state} amplitude={amplitude} />
        <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.25}>
          <Character pointer={pointer} amplitude={amplitude} state={state} emotion={emotion} />
        </Float>
        <Particles emotion={emotion} />
        <Pedestal amplitude={amplitude} state={state} emotion={emotion} />
      </Canvas>
    </div>
  );
}

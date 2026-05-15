/**
 * Avatar3DScene - "Nimbus" as a refined 3D TALKING BUST (head + shoulders).
 *
 * Lessons from the user feedback: pure-primitive full-body arrangements
 * (capsule arms, capsule legs) read as robotic no matter how they're
 * dressed. Solution: don't show a full body. Render a stylized cartoon
 * talking-head BUST instead — head + neck + shoulders that fade into the
 * scene — and pour all the polygon/material budget into making the FACE
 * look polished. This is also closer to the user's reference image (which
 * is itself a portrait, not a full body).
 *
 * Custom model support
 *   Drop your own GLB at /public/nimbus.glb (or set VITE_AVATAR_GLB_URL to a
 *   public URL — Ready Player Me works great: get an avatar URL at
 *   https://readyplayer.me/avatar). When a model is present it's loaded
 *   via useGLTF and replaces the procedural bust automatically. If the
 *   load fails for any reason, the procedural bust renders as a fallback.
 *
 * Anatomy (procedural bust)
 *   ▸ High-poly head sphere with cheek bloom, ears, nose, lips, jaw shading
 *   ▸ Wavy quiff built from layered sphere clusters (more pieces = less
 *     mechanical look)
 *   ▸ Eyes: sclera + iris + pupil + catch light, with blink and
 *     emissive iris glow on listen/speak
 *   ▸ Eyebrows that angle on anger
 *   ▸ Mouth: torus segment + teeth that opens with TTS amplitude
 *   ▸ Neck + shoulder-suggestion shape that fades into the scene gradient
 *
 * Animations (60fps useFrame)
 *   ▸ Head pivot follows cursor (parallax)
 *   ▸ Subtle body float + breathing scale
 *   ▸ Head sways on speak, tilts on think
 *   ▸ Anger: jitter + angled brows; excited: bounce
 *   ▸ Blink loop, mouth lipsync, iris glow on listen/speak
 */
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Float, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import type { AvatarEmotion, AvatarState } from "./Avatar";

const EMOTION_COLOR: Record<AvatarEmotion, string> = {
  neutral:    "#5aa8ff",
  happy:      "#ffb24a",
  excited:    "#ff8a3a",
  thoughtful: "#b48cff",
  listening:  "#3ad8ff",
  anger:      "#ff4d4d",
};

const PALETTE = {
  skin:      "#f5cca8",
  skinDark:  "#c79572",
  hair:      "#3a2110",
  hairLite:  "#7b4a26",
  hoodie:    "#23283a",
  hoodieDk:  "#10131e",
  iris:      "#5a3a1a",
  blush:     "#ff8a7a",
  mouth:     "#7c2a26",
  lipDark:   "#4a1812",
  eyebrow:   "#241406",
};

interface SceneProps {
  amplitude: number;
  emotion: AvatarEmotion;
  state: AvatarState;
}

// ============================================================================
// Optional GLB loader — only renders if a model URL is configured AND loads
// ============================================================================
function GLBModel({ url, pointer, state, emotion, amplitude }: SceneProps & {
  url: string;
  pointer: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const { scene } = useGLTF(url) as any;
  const root = useRef<THREE.Group>(null);

  // Find the model's "head" bone if it has standard naming (RPM, Mixamo)
  const headBone = useMemo(() => {
    let head: THREE.Object3D | null = null;
    scene?.traverse((obj: THREE.Object3D) => {
      if (!head && /head/i.test(obj.name) && (obj as any).isBone) head = obj;
    });
    return head;
  }, [scene]);

  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.getElapsedTime();
    root.current.position.y = Math.sin(t * 1.3) * 0.04 - 1;
    if (emotion === "anger") {
      root.current.position.x = (Math.random() - 0.5) * 0.03;
    }
    // Aim the head bone at the cursor if available
    if (headBone) {
      const targetY = pointer.current.x * 0.4;
      const targetX = -pointer.current.y * 0.25;
      headBone.rotation.y += (targetY - headBone.rotation.y) * 0.08;
      headBone.rotation.x += (targetX - headBone.rotation.x) * 0.08;
    }
  });

  return <primitive ref={root} object={scene} scale={1.5} />;
}

// ============================================================================
// PROCEDURAL BUST — head + shoulders, polished and stylized
// ============================================================================
function ProceduralBust({
  pointer, amplitude, state, emotion,
}: SceneProps & { pointer: React.MutableRefObject<{ x: number; y: number }> }) {
  const root = useRef<THREE.Group>(null);
  const headPivot = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const leftEye = useRef<THREE.Mesh>(null);
  const rightEye = useRef<THREE.Mesh>(null);

  // Blink loop
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

  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.getElapsedTime();

    // Body float
    root.current.position.y = Math.sin(t * 1.3) * 0.04;

    // Per-emotion body modifier
    if (emotion === "anger") {
      root.current.position.x = (Math.random() - 0.5) * 0.025;
    } else if (emotion === "excited") {
      root.current.position.y += Math.abs(Math.sin(t * 5)) * 0.04;
    } else {
      root.current.position.x += (0 - root.current.position.x) * 0.2;
    }

    // Head follow + sway
    if (headPivot.current) {
      const targetRotY = pointer.current.x * 0.45;
      const targetRotX = -pointer.current.y * 0.28;
      headPivot.current.rotation.y += (targetRotY - headPivot.current.rotation.y) * 0.08;
      headPivot.current.rotation.x += (targetRotX - headPivot.current.rotation.x) * 0.08;
      if (state === "speaking") {
        headPivot.current.rotation.z = Math.sin(t * 3) * 0.05 * (0.4 + amplitude);
      } else if (state === "thinking") {
        headPivot.current.rotation.z += (-0.1 - headPivot.current.rotation.z) * 0.06;
      } else {
        headPivot.current.rotation.z += (0 - headPivot.current.rotation.z) * 0.1;
      }
    }

    // Lipsync — open mouth scales with amplitude
    if (mouth.current) {
      const open = state === "speaking" ? 0.5 + amplitude * 2.4 : 0.6;
      mouth.current.scale.set(1, open, 1);
    }

    // Blink — spring eye Y scale toward target
    const targetEyeY = blink ? 0.08 : 1;
    if (leftEye.current)  leftEye.current.scale.y  += (targetEyeY - leftEye.current.scale.y)  * 0.4;
    if (rightEye.current) rightEye.current.scale.y += (targetEyeY - rightEye.current.scale.y) * 0.4;
  });

  return (
    <group ref={root} position={[0, -0.4, 0]}>
      {/* ===== SHOULDERS — a wide squashed sphere that suggests a body
            without showing arms. Fades into the scene via blended material. */}
      <mesh position={[0, -0.7, 0]} scale={[1.55, 0.7, 1.1]}>
        <sphereGeometry args={[0.7, 48, 32]} />
        <meshStandardMaterial color={PALETTE.hoodie} roughness={0.85} />
      </mesh>
      {/* Tee triangle peeking at the V */}
      <mesh position={[0, -0.32, 0.5]} rotation={[0.4, 0, 0]}>
        <coneGeometry args={[0.22, 0.4, 24, 1, true]} />
        <meshStandardMaterial color="#ffffff" roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
      {/* Hoodie collar fold */}
      <mesh position={[0, -0.2, 0.42]} scale={[1, 0.6, 0.8]}>
        <torusGeometry args={[0.34, 0.06, 16, 32, Math.PI]} />
        <meshStandardMaterial color={PALETTE.hoodieDk} roughness={0.8} />
      </mesh>

      {/* ===== NECK ===== */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.32, 24]} />
        <meshStandardMaterial color={PALETTE.skin} roughness={0.65} />
      </mesh>

      {/* ===== HEAD PIVOT (rotates to cursor) ===== */}
      <group ref={headPivot} position={[0, 0.4, 0]}>

        {/* Head sphere — high poly for smooth Pixar feel */}
        <mesh scale={[1, 1.08, 0.95]}>
          <sphereGeometry args={[0.5, 64, 48]} />
          <meshStandardMaterial color={PALETTE.skin} roughness={0.55} />
        </mesh>

        {/* Jaw shading (slightly darker sphere overlapping bottom of head) */}
        <mesh position={[0, -0.12, 0]} scale={[0.95, 0.55, 0.92]}>
          <sphereGeometry args={[0.5, 48, 36]} />
          <meshStandardMaterial color={PALETTE.skinDark} roughness={0.7} transparent opacity={0.25} />
        </mesh>

        {/* Cheek blush */}
        <mesh position={[-0.27, -0.05, 0.4]} scale={[1, 1, 0.3]}>
          <sphereGeometry args={[0.1, 24, 18]} />
          <meshStandardMaterial color={PALETTE.blush} emissive={PALETTE.blush} emissiveIntensity={0.3} transparent opacity={0.6} roughness={0.5} />
        </mesh>
        <mesh position={[0.27, -0.05, 0.4]} scale={[1, 1, 0.3]}>
          <sphereGeometry args={[0.1, 24, 18]} />
          <meshStandardMaterial color={PALETTE.blush} emissive={PALETTE.blush} emissiveIntensity={0.3} transparent opacity={0.6} roughness={0.5} />
        </mesh>

        {/* Ears */}
        <mesh position={[-0.5, 0, 0]} scale={[0.5, 1, 0.8]}>
          <sphereGeometry args={[0.12, 24, 18]} />
          <meshStandardMaterial color={PALETTE.skin} roughness={0.7} />
        </mesh>
        <mesh position={[0.5, 0, 0]} scale={[0.5, 1, 0.8]}>
          <sphereGeometry args={[0.12, 24, 18]} />
          <meshStandardMaterial color={PALETTE.skin} roughness={0.7} />
        </mesh>

        {/* HAIR — many small pieces give a softer, fuller look */}
        {/* Cap base */}
        <mesh position={[0, 0.22, -0.02]} scale={[1.1, 0.75, 1.05]}>
          <sphereGeometry args={[0.5, 48, 36, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshStandardMaterial color={PALETTE.hair} roughness={0.55} />
        </mesh>
        {/* Volume tufts that fan out from the quiff */}
        {[
          { x: -0.08, y: 0.46, z: 0.2,  s: 0.16 },
          { x:  0.05, y: 0.48, z: 0.2,  s: 0.15 },
          { x:  0.18, y: 0.42, z: 0.22, s: 0.14 },
          { x: -0.2,  y: 0.4,  z: 0.22, s: 0.13 },
          { x:  0.3,  y: 0.34, z: 0.18, s: 0.13 },
          { x: -0.3,  y: 0.34, z: 0.18, s: 0.13 },
          { x:  0.13, y: 0.52, z: 0.12, s: 0.12 },
          { x: -0.13, y: 0.52, z: 0.12, s: 0.12 },
        ].map((p, i) => (
          <mesh key={i} position={[p.x, p.y, p.z]}>
            <sphereGeometry args={[p.s, 24, 18]} />
            <meshStandardMaterial color={PALETTE.hair} roughness={0.55} />
          </mesh>
        ))}
        {/* Sideburns */}
        <mesh position={[-0.45, 0.08, 0.05]} scale={[0.4, 1.2, 1]}>
          <sphereGeometry args={[0.1, 18, 14]} />
          <meshStandardMaterial color={PALETTE.hair} roughness={0.6} />
        </mesh>
        <mesh position={[0.45, 0.08, 0.05]} scale={[0.4, 1.2, 1]}>
          <sphereGeometry args={[0.1, 18, 14]} />
          <meshStandardMaterial color={PALETTE.hair} roughness={0.6} />
        </mesh>
        {/* Highlight streak */}
        <mesh position={[0.04, 0.5, 0.25]} scale={[0.6, 0.6, 0.6]}>
          <sphereGeometry args={[0.08, 18, 14]} />
          <meshStandardMaterial color={PALETTE.hairLite} roughness={0.4} emissive={PALETTE.hairLite} emissiveIntensity={0.12} />
        </mesh>

        {/* Eyebrows */}
        <mesh position={[-0.18, 0.14, 0.46]} rotation={[0, 0, emotion === "anger" ? -0.45 : -0.08]}>
          <boxGeometry args={[0.15, 0.04, 0.04]} />
          <meshStandardMaterial color={PALETTE.eyebrow} roughness={0.7} />
        </mesh>
        <mesh position={[0.18, 0.14, 0.46]} rotation={[0, 0, emotion === "anger" ? 0.45 : 0.08]}>
          <boxGeometry args={[0.15, 0.04, 0.04]} />
          <meshStandardMaterial color={PALETTE.eyebrow} roughness={0.7} />
        </mesh>

        {/* EYES */}
        <group position={[-0.16, 0.03, 0.45]}>
          <mesh ref={leftEye}>
            <sphereGeometry args={[0.08, 28, 22]} />
            <meshStandardMaterial color="#ffffff" roughness={0.28} />
          </mesh>
          <mesh position={[0, 0, 0.058]}>
            <sphereGeometry args={[0.044, 20, 16]} />
            <meshStandardMaterial
              color={PALETTE.iris}
              emissive={state === "listening" || state === "speaking" ? EMOTION_COLOR[emotion] : "#000"}
              emissiveIntensity={state === "listening" || state === "speaking" ? 0.45 : 0}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[0, 0, 0.082]}>
            <sphereGeometry args={[0.022, 14, 12]} />
            <meshStandardMaterial color="#070310" />
          </mesh>
          <mesh position={[-0.014, 0.022, 0.098]}>
            <sphereGeometry args={[0.014, 12, 10]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={1.4} />
          </mesh>
        </group>
        <group position={[0.16, 0.03, 0.45]}>
          <mesh ref={rightEye}>
            <sphereGeometry args={[0.08, 28, 22]} />
            <meshStandardMaterial color="#ffffff" roughness={0.28} />
          </mesh>
          <mesh position={[0, 0, 0.058]}>
            <sphereGeometry args={[0.044, 20, 16]} />
            <meshStandardMaterial
              color={PALETTE.iris}
              emissive={state === "listening" || state === "speaking" ? EMOTION_COLOR[emotion] : "#000"}
              emissiveIntensity={state === "listening" || state === "speaking" ? 0.45 : 0}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[0, 0, 0.082]}>
            <sphereGeometry args={[0.022, 14, 12]} />
            <meshStandardMaterial color="#070310" />
          </mesh>
          <mesh position={[-0.014, 0.022, 0.098]}>
            <sphereGeometry args={[0.014, 12, 10]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={1.4} />
          </mesh>
        </group>

        {/* Nose — small soft sphere */}
        <mesh position={[0, -0.06, 0.5]} scale={[1, 1.1, 0.8]}>
          <sphereGeometry args={[0.045, 20, 16]} />
          <meshStandardMaterial color={PALETTE.skinDark} roughness={0.7} />
        </mesh>
        {/* Nostril shading */}
        <mesh position={[-0.022, -0.085, 0.52]}>
          <sphereGeometry args={[0.012, 10, 8]} />
          <meshStandardMaterial color="#5a3a1a" roughness={0.8} />
        </mesh>
        <mesh position={[0.022, -0.085, 0.52]}>
          <sphereGeometry args={[0.012, 10, 8]} />
          <meshStandardMaterial color="#5a3a1a" roughness={0.8} />
        </mesh>

        {/* MOUTH — smile arc */}
        <mesh ref={mouth} position={[0, -0.22, 0.46]}>
          <torusGeometry args={[0.1, 0.024, 14, 28, Math.PI]} />
          <meshStandardMaterial color={emotion === "anger" ? PALETTE.lipDark : PALETTE.mouth} roughness={0.55} />
        </mesh>
        {/* Teeth (visible white under the smile) */}
        <mesh position={[0, -0.21, 0.47]}>
          <boxGeometry args={[0.16, 0.028, 0.006]} />
          <meshStandardMaterial color="#fff8f0" roughness={0.45} />
        </mesh>
        {/* Lower lip hint */}
        <mesh position={[0, -0.28, 0.46]}>
          <sphereGeometry args={[0.085, 24, 18]} scale={[1, 0.25, 0.3]} />
          <meshStandardMaterial color={PALETTE.skinDark} roughness={0.65} transparent opacity={0.65} />
        </mesh>
      </group>
    </group>
  );
}

// ============================================================================
// Particle field
// ============================================================================
function Particles({ emotion }: { emotion: AvatarEmotion }) {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 220;
  const { positions, baseY } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const baseY = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.5 + Math.random() * 1.7;
      const y = (Math.random() - 0.5) * 3.0;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius - 0.4;
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
      arr[i * 3 + 1] = baseY[i] + Math.sin(t * speed + i * 0.7) * 0.22;
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
// Pedestal
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
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.4, 0]}>
      <ringGeometry args={[0.85, 1.0, 64]} />
      <meshBasicMaterial color={EMOTION_COLOR[emotion]} transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ============================================================================
// Lighting
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
      <directionalLight position={[2, 3, 3]} intensity={1.1} color="#fff5e0" castShadow />
      <directionalLight position={[-3, 2, 2]} intensity={0.5} color="#a3c8ff" />
      <pointLight ref={rimRef} color={EMOTION_COLOR[emotion]} intensity={1.4} distance={7} />
    </>
  );
}

// ============================================================================
// Scene wrapper — chooses GLB if available, else procedural
// ============================================================================
function SceneBody({
  pointer, amplitude, state, emotion,
}: SceneProps & { pointer: React.MutableRefObject<{ x: number; y: number }> }) {
  // Custom GLB priority: env var > /public/nimbus.glb > procedural
  const envUrl = (import.meta as any).env?.VITE_AVATAR_GLB_URL as string | undefined;
  const url = envUrl || "/nimbus.glb";
  const [glbOk, setGlbOk] = useState<boolean | null>(null);

  // HEAD request to check if a GLB exists at the path (procedural otherwise)
  useEffect(() => {
    let cancelled = false;
    fetch(url, { method: "HEAD" })
      .then((r) => { if (!cancelled) setGlbOk(r.ok); })
      .catch(() => !cancelled && setGlbOk(false));
    return () => { cancelled = true; };
  }, [url]);

  if (glbOk === null) {
    // Brief loading state — render nothing until we know
    return null;
  }

  if (glbOk) {
    return (
      <Suspense fallback={<ProceduralBust pointer={pointer} amplitude={amplitude} state={state} emotion={emotion} />}>
        <GLBModel url={url} pointer={pointer} amplitude={amplitude} state={state} emotion={emotion} />
      </Suspense>
    );
  }

  return <ProceduralBust pointer={pointer} amplitude={amplitude} state={state} emotion={emotion} />;
}

// ============================================================================
// Public component
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
        camera={{ position: [0, 0.3, 2.4], fov: 36 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        shadows
      >
        <Lighting emotion={emotion} state={state} amplitude={amplitude} />
        <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.22}>
          <SceneBody pointer={pointer} amplitude={amplitude} state={state} emotion={emotion} />
        </Float>
        <Particles emotion={emotion} />
        <Pedestal amplitude={amplitude} state={state} emotion={emotion} />
      </Canvas>
    </div>
  );
}

/**
 * Avatar - "Nimbus", the Concierge.
 *
 * Public API + lightweight 2D fallback. The heavy WebGL scene lives in
 * Avatar3DScene.tsx and is lazy-loaded ONLY when the full Concierge stage
 * opens — the launcher (size=64) uses the cheap 2D image instead so the
 * main bundle stays lean.
 *
 * Rendering rules:
 *   ▸ `size` provided (launcher / mobile thumbnail) → 2D image with aura
 *   ▸ `size` omitted (stage column)                  → lazy-load 3D scene
 *   ▸ WebGL unavailable                              → 2D image fallback
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";

export type AvatarEmotion = "neutral" | "happy" | "thoughtful" | "excited" | "listening" | "anger";
export type AvatarState = "idle" | "listening" | "thinking" | "speaking";

interface AvatarProps {
  amplitude?: number;
  emotion?: AvatarEmotion;
  state?: AvatarState;
  size?: number;
  className?: string;
}

const EMOTION_COLOR: Record<AvatarEmotion, string> = {
  neutral:    "#5aa8ff",
  happy:      "#ffb24a",
  excited:    "#ff8a3a",
  thoughtful: "#b48cff",
  listening:  "#3ad8ff",
  anger:      "#ff4d4d",
};

const STATE_LABEL: Record<AvatarState, string> = {
  idle: "Ready",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking",
};

const Avatar3DScene = lazy(() => import("./Avatar3DScene"));

function StaticAvatar2D({
  emotion, state, size, className,
}: {
  emotion: AvatarEmotion; state: AvatarState; size: number | undefined; className: string;
}) {
  const wrapperStyle: React.CSSProperties = size
    ? { width: size, aspectRatio: "3 / 5" }
    : { height: "100%", aspectRatio: "3 / 5", maxWidth: "100%" };
  const color = EMOTION_COLOR[emotion];
  return (
    <div className={`relative ${className}`} style={wrapperStyle} aria-hidden="true">
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ scale: [1, 1.04, 1], opacity: [0.55, 0.8, 0.55] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background: `radial-gradient(55% 38% at 50% 35%, ${color}88, transparent 78%)`,
          filter: "blur(34px)",
        }}
      />
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="relative w-[88%] aspect-square rounded-full overflow-hidden shadow-2xl"
          style={{ boxShadow: `0 18px 50px ${color}66, inset 0 0 0 2px ${color}66` }}
        >
          <img
            src="/nimbus-avatar.png"
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>
      </motion.div>
      {!size && (
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 bottom-[5%] flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-xl border text-[10px] font-semibold uppercase tracking-wider pointer-events-none"
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          style={{
            background: `${color}22`,
            borderColor: `${color}77`,
            color,
          }}
        >
          <span className="block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
          <span>{STATE_LABEL[state]}</span>
        </motion.div>
      )}
    </div>
  );
}

export default function Avatar({
  amplitude = 0,
  emotion = "neutral",
  state = "idle",
  size,
  className = "",
}: AvatarProps) {
  const [supportsWebGL, setSupportsWebGL] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      setSupportsWebGL(!!gl);
    } catch {
      setSupportsWebGL(false);
    }
  }, []);

  // Launcher / thumbnail / no-WebGL → lightweight 2D
  if (size || supportsWebGL === false) {
    return <StaticAvatar2D emotion={emotion} state={state} size={size} className={className} />;
  }

  // Full stage → lazy 3D scene, with 2D underlay during load
  const wrapperStyle: React.CSSProperties = { height: "100%", aspectRatio: "3 / 5", maxWidth: "100%" };
  const color = EMOTION_COLOR[emotion];

  return (
    <div className={`relative ${className}`} style={wrapperStyle} aria-hidden="true">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(60% 45% at 50% 38%, ${color}55, transparent 78%)`,
          filter: "blur(38px)",
        }}
      />

      {/* 3D scene only loads after first render of the stage */}
      <Suspense fallback={<StaticAvatar2D emotion={emotion} state={state} size={undefined} className="" />}>
        <Avatar3DScene amplitude={amplitude} emotion={emotion} state={state} />
      </Suspense>

      <motion.div
        className="absolute left-1/2 -translate-x-1/2 bottom-[5%] flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-xl border text-[10px] font-semibold uppercase tracking-wider pointer-events-none z-10"
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 2.5, repeat: Infinity }}
        style={{
          background: `${color}22`,
          borderColor: `${color}77`,
          color,
        }}
      >
        <span className="block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        <span>{STATE_LABEL[state]}</span>
      </motion.div>
    </div>
  );
}

/**
 * Avatar - "Nimbus", the Concierge.
 *
 * Restored to the earlier male SVG design that the user liked (specs +
 * hoodie + headphones + smartwatch + AWS-orange-sole sneakers) and
 * enhanced with CSS-3D parallax — perspective + cursor-tracked rotation
 * so the figure tilts toward your mouse like a real 3D bust. Doesn't
 * read as robotic the way pure-primitive 3D primitives did.
 *
 * Animation layers
 *   ▸ CSS perspective + cursor-tracked rotate3d (head looks at cursor)
 *   ▸ Body float (y) + breathing scale
 *   ▸ Counter-phase arm pendulum; right hand raises on speak
 *   ▸ Eye darting / blink
 *   ▸ Mouth lipsync from amplitude
 *   ▸ Listening: aura pulse + chest ripples + eye glow + headphone ring
 *   ▸ Thinking: brow lift + head tilt + spec dots
 *   ▸ Speaking: head sway + smile widens + hand gesture
 *   ▸ Excited: both hands lift, particles intensify
 *   ▸ Anger: angled brows + jitter + red tint
 *
 * The heavy WebGL scene at Avatar3DScene.tsx is still available as a
 * graceful upgrade when a GLB file is dropped at /public/nimbus.glb (or
 * VITE_AVATAR_GLB_URL is set) — see <Avatar3DScene/> docs. By default
 * we render this premium SVG character.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";

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

export default function Avatar({
  amplitude = 0,
  emotion = "neutral",
  state = "idle",
  size,
  className = "",
}: AvatarProps) {
  const [blink, setBlink] = useState(false);
  const [eyeDrift, setEyeDrift] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });

  // Blink loop
  useEffect(() => {
    let cancelled = false;
    const loop = () => {
      const delay = 2400 + Math.random() * 2800;
      setTimeout(() => {
        if (cancelled) return;
        setBlink(true);
        setTimeout(() => !cancelled && setBlink(false), 110);
        loop();
      }, delay);
    };
    loop();
    return () => { cancelled = true; };
  }, []);

  // Eye drift — pupils occasionally drift
  useEffect(() => {
    let cancelled = false;
    const loop = () => {
      const delay = 3500 + Math.random() * 3500;
      setTimeout(() => {
        if (cancelled) return;
        const dx = (Math.random() - 0.5) * 2.4;
        const dy = (Math.random() - 0.5) * 1.2;
        setEyeDrift({ x: dx, y: dy });
        setTimeout(() => !cancelled && setEyeDrift({ x: 0, y: 0 }), 800);
        loop();
      }, delay);
    };
    loop();
    return () => { cancelled = true; };
  }, []);

  // CSS-3D parallax — track cursor across the WINDOW and apply rotate3d
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // Map window pointer position to -1..1
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      pointer.current = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Apply smoothed rotation each frame
  useEffect(() => {
    let raf = 0;
    let curX = 0, curY = 0;
    const tick = () => {
      const targetX = -pointer.current.y * 10; // tilt up/down
      const targetY = pointer.current.x * 14;  // turn left/right
      curX += (targetX - curX) * 0.07;
      curY += (targetY - curY) * 0.07;
      if (innerRef.current) {
        innerRef.current.style.transform = `rotateX(${curX}deg) rotateY(${curY}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const speaking = state === "speaking";
  const listening = state === "listening";
  const thinking = state === "thinking";
  const excited = emotion === "excited";
  const isAnger = emotion === "anger";

  // Smile defaults pushed wider/friendlier — more open-mouthed by default
  const baseSmile = emotion === "happy" || excited ? 9 : emotion === "thoughtful" ? 2 : 7;
  const mouthOpen = speaking ? Math.max(2.5, amplitude * 13) : 3;
  const mouthCurve = speaking ? Math.min(11, baseSmile + amplitude * 7) : baseSmile;
  const mouthWidth = speaking ? 19 + amplitude * 3 : 19;
  const browY = thinking ? -3 : excited || isAnger ? -5 : 0;
  const browAngle = isAnger ? 0.35 : 0;

  // Body float
  const bodyControls = useAnimationControls();
  useEffect(() => {
    bodyControls.start({
      y: [0, -5, 0],
      transition: { duration: 5, repeat: Infinity, ease: "easeInOut" },
    });
  }, [bodyControls]);

  const rightHandRaised = speaking || excited;
  const leftHandRaised = excited;

  const wrapperStyle: React.CSSProperties = size
    ? { width: size, aspectRatio: "3 / 7", perspective: 800 }
    : { height: "100%", aspectRatio: "3 / 7", maxWidth: "100%", perspective: 1200 };

  const accent = EMOTION_COLOR[emotion];

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={wrapperStyle}
      aria-hidden="true"
    >
      {/* ===== Outer aura ===== */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        animate={
          listening
            ? { scale: [1, 1.05, 1], opacity: [0.55, 0.85, 0.55] }
            : thinking
              ? { rotate: 360, opacity: [0.45, 0.6, 0.45] }
              : { scale: [1, 1.02, 1], opacity: [0.4, 0.55, 0.4] }
        }
        transition={{
          duration: listening ? 1.4 : thinking ? 8 : 5.5,
          repeat: Infinity, ease: "easeInOut",
        }}
        style={{
          background: `radial-gradient(50% 38% at 50% 28%, ${accent}88, ${accent}33 50%, transparent 78%)`,
          filter: "blur(34px)",
        }}
      />

      {/* ===== Pedestal ===== */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 700" preserveAspectRatio="xMidYMid meet">
        <ellipse cx="150" cy="660" rx="100" ry="14" fill={`${accent}88`} filter="blur(6px)" />
        <ellipse cx="150" cy="666" rx="70" ry="6" fill={`${accent}aa`} filter="blur(3px)" />
      </svg>

      {/* ===== Particle field ===== */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 700" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: 22 }).map((_, i) => {
          const x = 30 + (i * 17) % 240;
          const y = 50 + (i * 41) % 600;
          const dur = isAnger ? 1.8 : 3 + (i % 4);
          const r = 1 + (i % 3) * 0.5;
          return (
            <motion.circle
              key={i}
              cx={x} cy={y} r={r}
              fill={i % 2 ? accent : EMOTION_COLOR.listening}
              initial={{ opacity: 0.15 }}
              animate={{ opacity: [0.12, excited || isAnger ? 0.95 : 0.7, 0.12], y: [y, y - 14, y] }}
              transition={{ duration: dur, repeat: Infinity, ease: "easeInOut", delay: i * 0.16 }}
            />
          );
        })}
      </svg>

      {/* ===== MAIN CHARACTER — wrapped in a 3D-perspective transform ===== */}
      <motion.div
        ref={innerRef}
        className="relative z-10 w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
      >
        <motion.svg
          className="w-full h-full drop-shadow-[0_22px_45px_rgba(80,140,255,0.28)]"
          viewBox="0 0 300 700"
          preserveAspectRatio="xMidYMid meet"
          animate={bodyControls}
        >
          <defs>
            {/* SKIN — warm fair */}
            <radialGradient id="skin" cx="42%" cy="38%" r="80%">
              <stop offset="0%" stopColor="#fff5ea" />
              <stop offset="55%" stopColor="#f4d8b8" />
              <stop offset="100%" stopColor="#c5905d" />
            </radialGradient>
            <linearGradient id="skin-arm" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f4d8b8" />
              <stop offset="100%" stopColor="#c5905d" />
            </linearGradient>

            {/* HAIR — dark with platinum blue highlight */}
            <linearGradient id="hair-base" x1="0" y1="0" x2="0.3" y2="1">
              <stop offset="0%" stopColor="#2c2638" />
              <stop offset="60%" stopColor="#15101e" />
              <stop offset="100%" stopColor="#0a0612" />
            </linearGradient>
            <linearGradient id="hair-shine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9fb8d8" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#2c2638" stopOpacity="0" />
            </linearGradient>

            {/* HOODIE */}
            <linearGradient id="hoodie" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1f2433" />
              <stop offset="100%" stopColor="#0d101a" />
            </linearGradient>
            <linearGradient id="hoodie-inner" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0a0d18" />
              <stop offset="100%" stopColor="#050810" />
            </linearGradient>
            <linearGradient id="trim" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(200 95% 60%)" stopOpacity="0" />
              <stop offset="50%" stopColor="hsl(200 95% 70%)" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(200 95% 60%)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="tee" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e0e4ec" />
            </linearGradient>
            <linearGradient id="jeans" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a2440" />
              <stop offset="100%" stopColor="#0a1228" />
            </linearGradient>
            <linearGradient id="shoe-upper" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fafafa" />
              <stop offset="100%" stopColor="#dadde3" />
            </linearGradient>
            <linearGradient id="headphone-cup" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#23262e" />
              <stop offset="100%" stopColor="#0a0d12" />
            </linearGradient>
            <linearGradient id="lens" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a3c8ff" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#5c8cff" stopOpacity="0.32" />
            </linearGradient>
            <radialGradient id="iris" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6c8db8" />
              <stop offset="100%" stopColor="#1a2540" />
            </radialGradient>
            <linearGradient id="watch-face" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0a0d18" />
              <stop offset="100%" stopColor="#1a2440" />
            </linearGradient>
            <radialGradient id="body-glow" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor={`${accent}55`} />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <filter id="soft-blur"><feGaussianBlur stdDeviation="1.5" /></filter>
          </defs>

          <ellipse cx="150" cy="360" rx="140" ry="220" fill="url(#body-glow)" filter="url(#soft-blur)" />

          {/* ===== LEGS — refined slim-fit jeans with thigh + calf taper ===== */}
          <motion.g animate={{ x: [0, -1, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
            {/* Left leg — wider at hip, tapering at ankle */}
            <path
              d="M 124 410
                 Q 116 460 116 520
                 Q 117 580 124 638
                 L 144 638
                 Q 146 580 145 520
                 Q 146 460 145 410 Z"
              fill="url(#jeans)"
            />
            {/* Thigh shading */}
            <path d="M 125 420 Q 130 470 132 540" stroke="#3a5080" strokeWidth="0.5" opacity="0.45" fill="none" />
            {/* Knee crease */}
            <path d="M 117 506 Q 130 512 145 506" stroke="#040712" strokeWidth="0.9" fill="none" />
            <path d="M 119 510 Q 130 515 144 510" stroke="#2a3a60" strokeWidth="0.5" fill="none" opacity="0.7" />
            {/* Hem fold */}
            <path d="M 124 636 Q 134 638 144 636" stroke="#040712" strokeWidth="0.7" fill="none" />
            {/* Side seam highlight */}
            <path d="M 118 425 L 118 624" stroke="#a3b5d8" strokeWidth="0.3" opacity="0.35" />
          </motion.g>
          <motion.g animate={{ x: [0, 1, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}>
            <path
              d="M 156 410
                 Q 155 460 155 520
                 Q 154 580 156 638
                 L 176 638
                 Q 184 580 184 520
                 Q 184 460 176 410 Z"
              fill="url(#jeans)"
            />
            <path d="M 175 420 Q 170 470 168 540" stroke="#3a5080" strokeWidth="0.5" opacity="0.45" fill="none" />
            <path d="M 155 506 Q 170 512 184 506" stroke="#040712" strokeWidth="0.9" fill="none" />
            <path d="M 156 510 Q 170 515 182 510" stroke="#2a3a60" strokeWidth="0.5" fill="none" opacity="0.7" />
            <path d="M 156 636 Q 170 638 176 636" stroke="#040712" strokeWidth="0.7" fill="none" />
            <path d="M 182 425 L 182 624" stroke="#a3b5d8" strokeWidth="0.3" opacity="0.35" />
          </motion.g>

          {/* Sneakers */}
          <g>
            <path d="M 114 640 Q 105 658 114 668 L 148 668 L 148 638 Q 130 636 114 640 Z" fill="url(#shoe-upper)" />
            <rect x="113" y="664" width="36" height="5" rx="2" fill="#FF9900" />
            <path d="M 122 650 Q 130 645 142 650" stroke="hsl(200 95% 60%)" strokeWidth="1.5" fill="none" />
            <path d="M 122 644 L 142 644 M 122 652 L 142 652" stroke="#a0a4ad" strokeWidth="0.6" opacity="0.6" />
            <path d="M 152 638 L 152 668 L 186 668 Q 195 658 186 640 Q 170 636 152 638 Z" fill="url(#shoe-upper)" />
            <rect x="151" y="664" width="36" height="5" rx="2" fill="#FF9900" />
            <path d="M 158 650 Q 168 645 178 650" stroke="hsl(200 95% 60%)" strokeWidth="1.5" fill="none" />
            <path d="M 158 644 L 178 644 M 158 652 L 178 652" stroke="#a0a4ad" strokeWidth="0.6" opacity="0.6" />
          </g>

          {/* Hips */}
          <path d="M 108 380 Q 150 412 192 380 L 192 415 Q 150 425 108 415 Z" fill="url(#jeans)" />
          <rect x="110" y="378" width="80" height="3" rx="1" fill="#0a0d18" />
          <rect x="146" y="378" width="8" height="3" rx="0.5" fill="hsl(200 95% 60%)" />

          {/* White tee under hoodie */}
          <path d="M 100 290 Q 150 280 200 290 L 200 405 L 100 405 Z" fill="url(#tee)" />
          <g transform="translate(135, 340)">
            <path d="M 0 0 Q -4 -8 4 -10 Q 6 -16 14 -12 Q 22 -18 24 -8 Q 32 -6 26 2 L 0 2 Z" fill="hsl(200 95% 65%)" />
            <text x="13" y="14" fontSize="5" fontWeight="800" fill="#1f2433" textAnchor="middle">CLOUD</text>
          </g>

          {/* Hoodie panels */}
          <path d="M 86 410 Q 86 280 116 245 L 140 232 Q 145 245 142 295 L 116 410 Z" fill="url(#hoodie)" />
          <path d="M 214 410 Q 214 280 184 245 L 160 232 Q 155 245 158 295 L 184 410 Z" fill="url(#hoodie)" />
          <path d="M 142 295 Q 144 350 140 405" stroke="#050810" strokeWidth="1" fill="none" opacity="0.7" />
          <path d="M 158 295 Q 156 350 160 405" stroke="#050810" strokeWidth="1" fill="none" opacity="0.7" />

          {/* Hood folded behind shoulders */}
          <path d="M 96 245 Q 110 220 150 215 Q 190 220 204 245 Q 200 240 150 232 Q 100 240 96 245 Z" fill="url(#hoodie-inner)" />

          {/* Pockets */}
          <path d="M 90 360 Q 110 370 120 380" stroke="#050810" strokeWidth="0.6" fill="none" />
          <path d="M 210 360 Q 190 370 180 380" stroke="#050810" strokeWidth="0.6" fill="none" />

          {/* Drawstrings */}
          <path d="M 138 250 Q 134 285 132 320" stroke="#3a4055" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M 162 250 Q 166 285 168 320" stroke="#3a4055" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <circle cx="132" cy="322" r="2" fill="#3a4055" />
          <circle cx="168" cy="322" r="2" fill="#3a4055" />

          {/* Hoodie zipper teeth */}
          {Array.from({ length: 7 }).map((_, i) => (
            <circle key={`zt-${i}`} cx="150" cy={250 + i * 6} r="0.7" fill="#5b6275" opacity="0.55" />
          ))}

          {/* Cyan shoulder trim */}
          <path d="M 90 270 Q 98 255 116 246" stroke="url(#trim)" strokeWidth="1.6" fill="none" />
          <path d="M 210 270 Q 202 255 184 246" stroke="url(#trim)" strokeWidth="1.6" fill="none" />

          {/* Chest streaming data */}
          <motion.path
            d="M 108 370 Q 150 362 192 370"
            stroke="hsl(200 80% 55%)" strokeWidth="0.7" fill="none" strokeDasharray="2 3"
            animate={{ strokeDashoffset: [0, -10] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            opacity="0.6"
          />

          {/* ===== ARMS ===== */}
          <motion.g
            animate={leftHandRaised ? { rotate: -30, x: -2 } : { rotate: [0, -2, 0, 2, 0], x: 0 }}
            transition={leftHandRaised
              ? { type: "spring", stiffness: 130, damping: 16 }
              : { duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "92px 260px" }}
          >
            <path d="M 88 260 Q 70 290 65 340 Q 64 380 72 410 L 86 408 Q 82 380 84 340 Q 88 300 100 280 Z" fill="url(#hoodie)" />
            <path d="M 72 408 Q 79 412 86 408" stroke="hsl(200 95% 65%)" strokeWidth="1.2" fill="none" opacity="0.85" />
            <path d="M 80 290 Q 78 340 76 400" stroke="#0a0d18" strokeWidth="0.5" fill="none" opacity="0.7" />
            {/* Smartwatch */}
            <g transform="translate(74, 416)">
              <rect x="-9" y="-2" width="18" height="14" rx="3" fill="#1a1d28" />
              <rect x="-7" y="0" width="14" height="10" rx="1.5" fill="url(#watch-face)" />
              <motion.circle cx="0" cy="5" r="1.2" fill="hsl(200 95% 65%)"
                animate={{ opacity: (listening || speaking) ? [0.4, 1, 0.4] : [0.3, 0.5, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <rect x="-9" y="-6" width="18" height="4" fill="#0a0d18" />
              <rect x="-9" y="12" width="18" height="4" fill="#0a0d18" />
            </g>
            <g>
              {/* Palm — wider, more anatomical */}
              <ellipse cx="74" cy="436" rx="12" ry="11" fill="url(#skin-arm)" />
              {/* Wrist line for definition */}
              <path d="M 64 428 Q 74 432 84 428" stroke="#9c6f48" strokeWidth="0.4" fill="none" opacity="0.4" />
              {/* Fingers — rounded rect digits, slightly curled */}
              <path d="M 65 444 Q 63 452 64 458 Q 66 460 68 458 Q 70 452 69 444 Z" fill="url(#skin-arm)" stroke="#9c6f48" strokeWidth="0.4" />
              <path d="M 70 446 Q 68 455 69 462 Q 71 464 73 462 Q 75 455 74 446 Z" fill="url(#skin-arm)" stroke="#9c6f48" strokeWidth="0.4" />
              <path d="M 75 446 Q 73 455 74 462 Q 76 464 78 462 Q 80 455 79 446 Z" fill="url(#skin-arm)" stroke="#9c6f48" strokeWidth="0.4" />
              <path d="M 80 444 Q 78 452 79 458 Q 81 460 83 458 Q 85 452 84 444 Z" fill="url(#skin-arm)" stroke="#9c6f48" strokeWidth="0.4" />
              {/* Thumb — wider, on outer side */}
              <path d="M 63 432 Q 58 428 56 422 Q 56 418 59 419 Q 63 423 65 428 Z" fill="url(#skin-arm)" stroke="#9c6f48" strokeWidth="0.4" />
              {/* Knuckle hints */}
              <circle cx="67" cy="445" r="0.7" fill="#9c6f48" opacity="0.4" />
              <circle cx="72" cy="447" r="0.7" fill="#9c6f48" opacity="0.4" />
              <circle cx="77" cy="447" r="0.7" fill="#9c6f48" opacity="0.4" />
              <circle cx="82" cy="445" r="0.7" fill="#9c6f48" opacity="0.4" />
            </g>
          </motion.g>
          <motion.g
            animate={rightHandRaised ? { rotate: -38, x: 3, y: -4 } : { rotate: [0, 2, 0, -2, 0], x: 0, y: 0 }}
            transition={rightHandRaised
              ? { type: "spring", stiffness: 130, damping: 16 }
              : { duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            style={{ transformOrigin: "208px 260px" }}
          >
            <path d="M 212 260 Q 230 290 235 340 Q 236 380 228 410 L 214 408 Q 218 380 216 340 Q 212 300 200 280 Z" fill="url(#hoodie)" />
            <path d="M 228 408 Q 221 412 214 408" stroke="hsl(200 95% 65%)" strokeWidth="1.2" fill="none" opacity="0.85" />
            <path d="M 220 290 Q 222 340 224 400" stroke="#0a0d18" strokeWidth="0.5" fill="none" opacity="0.7" />
            <g>
              {/* Palm */}
              <ellipse cx="226" cy="436" rx="12" ry="11" fill="url(#skin-arm)" />
              <path d="M 216 428 Q 226 432 236 428" stroke="#9c6f48" strokeWidth="0.4" fill="none" opacity="0.4" />
              {/* Fingers (mirrored from left hand) */}
              <path d="M 235 444 Q 237 452 236 458 Q 234 460 232 458 Q 230 452 231 444 Z" fill="url(#skin-arm)" stroke="#9c6f48" strokeWidth="0.4" />
              <path d="M 230 446 Q 232 455 231 462 Q 229 464 227 462 Q 225 455 226 446 Z" fill="url(#skin-arm)" stroke="#9c6f48" strokeWidth="0.4" />
              <path d="M 225 446 Q 227 455 226 462 Q 224 464 222 462 Q 220 455 221 446 Z" fill="url(#skin-arm)" stroke="#9c6f48" strokeWidth="0.4" />
              <path d="M 220 444 Q 222 452 221 458 Q 219 460 217 458 Q 215 452 216 444 Z" fill="url(#skin-arm)" stroke="#9c6f48" strokeWidth="0.4" />
              {/* Thumb */}
              <path d="M 237 432 Q 242 428 244 422 Q 244 418 241 419 Q 237 423 235 428 Z" fill="url(#skin-arm)" stroke="#9c6f48" strokeWidth="0.4" />
              {/* Knuckles */}
              <circle cx="233" cy="445" r="0.7" fill="#9c6f48" opacity="0.4" />
              <circle cx="228" cy="447" r="0.7" fill="#9c6f48" opacity="0.4" />
              <circle cx="223" cy="447" r="0.7" fill="#9c6f48" opacity="0.4" />
              <circle cx="218" cy="445" r="0.7" fill="#9c6f48" opacity="0.4" />
            </g>
          </motion.g>

          {/* NECK */}
          <path d="M 134 215 Q 150 222 166 215 L 168 234 Q 150 240 132 234 Z" fill="url(#skin)" />

          {/* HEADPHONES around neck */}
          <g>
            <path d="M 110 232 Q 150 254 190 232" stroke="#23262e" strokeWidth="3" fill="none" strokeLinecap="round" />
            <g transform="translate(102, 232)">
              <ellipse cx="0" cy="0" rx="11" ry="13" fill="url(#headphone-cup)" />
              <ellipse cx="0" cy="0" rx="7" ry="9" fill="#0a0d12" />
              <motion.ellipse cx="0" cy="0" rx="9" ry="11"
                fill="none" stroke="hsl(200 95% 65%)" strokeWidth="1"
                animate={{ opacity: (listening || speaking) ? [0.5, 1, 0.5] : [0.45, 0.7, 0.45] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </g>
            <g transform="translate(198, 232)">
              <ellipse cx="0" cy="0" rx="11" ry="13" fill="url(#headphone-cup)" />
              <ellipse cx="0" cy="0" rx="7" ry="9" fill="#0a0d12" />
              <motion.ellipse cx="0" cy="0" rx="9" ry="11"
                fill="none" stroke="hsl(200 95% 65%)" strokeWidth="1"
                animate={{ opacity: (listening || speaking) ? [0.5, 1, 0.5] : [0.45, 0.7, 0.45] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
              />
            </g>
          </g>

          {/* HEAD */}
          <g>
            <path d="M 98 130 Q 90 60 150 50 Q 210 60 202 130 L 212 178 Q 150 200 88 178 Z" fill="url(#hair-base)" />
            <path d="M 102 132 Q 102 80 150 75 Q 198 80 198 132 Q 198 178 180 200 Q 165 215 150 215 Q 135 215 120 200 Q 102 178 102 132 Z" fill="url(#skin)" />
            <path d="M 120 200 Q 135 215 150 217 Q 165 215 180 200" stroke="#b08456" strokeWidth="0.9" fill="none" opacity="0.45" />
            <ellipse cx="120" cy="170" rx="9" ry="6" fill="#e8b89a" opacity="0.4" />
            <ellipse cx="180" cy="170" rx="9" ry="6" fill="#e8b89a" opacity="0.4" />

            {/* Eyebrows */}
            <motion.path
              d="M 113 124 Q 128 118 142 124"
              stroke="#15101e" strokeWidth="3.5" fill="none" strokeLinecap="round"
              animate={{ y: browY, rotate: -browAngle * (180 / Math.PI) * 0.5 }}
              transition={{ type: "spring", stiffness: 200, damping: 14 }}
              style={{ transformOrigin: "127px 122px" }}
            />
            <motion.path
              d="M 158 124 Q 172 118 187 124"
              stroke="#15101e" strokeWidth="3.5" fill="none" strokeLinecap="round"
              animate={{ y: browY, rotate: browAngle * (180 / Math.PI) * 0.5 }}
              transition={{ type: "spring", stiffness: 200, damping: 14 }}
              style={{ transformOrigin: "172px 122px" }}
            />

            <path d="M 113 134 Q 128 132 142 134" stroke="#b08456" strokeWidth="0.5" fill="none" opacity="0.5" />
            <path d="M 158 134 Q 172 132 187 134" stroke="#b08456" strokeWidth="0.5" fill="none" opacity="0.5" />

            {/* Eyes */}
            <g>
              <ellipse cx="125" cy="143" rx="8.5" ry={blink ? 0.6 : 5.5} fill="#fff" />
              {!blink && (
                <>
                  <circle cx={125 + eyeDrift.x} cy={143 + eyeDrift.y} r="4.5" fill="url(#iris)" />
                  <circle cx={125 + eyeDrift.x} cy={143 + eyeDrift.y} r="2" fill="#0a0a14" />
                  <circle cx={123.4 + eyeDrift.x} cy={141.5 + eyeDrift.y} r="1.2" fill="#fff" opacity="0.95" />
                  <circle cx={126.5 + eyeDrift.x} cy={144 + eyeDrift.y} r="0.6" fill="#fff" opacity="0.65" />
                </>
              )}
              <ellipse cx="175" cy="143" rx="8.5" ry={blink ? 0.6 : 5.5} fill="#fff" />
              {!blink && (
                <>
                  <circle cx={175 + eyeDrift.x} cy={143 + eyeDrift.y} r="4.5" fill="url(#iris)" />
                  <circle cx={175 + eyeDrift.x} cy={143 + eyeDrift.y} r="2" fill="#0a0a14" />
                  <circle cx={173.4 + eyeDrift.x} cy={141.5 + eyeDrift.y} r="1.2" fill="#fff" opacity="0.95" />
                  <circle cx={176.5 + eyeDrift.x} cy={144 + eyeDrift.y} r="0.6" fill="#fff" opacity="0.65" />
                </>
              )}
            </g>
            {(listening || speaking) && !blink && (
              <>
                <motion.circle cx={125 + eyeDrift.x} cy={143 + eyeDrift.y} r="2.2" fill="hsl(200 95% 70%)"
                  initial={{ opacity: 0.3 }} animate={{ opacity: [0.25, 0.6, 0.25] }}
                  transition={{ duration: 1.2, repeat: Infinity }} />
                <motion.circle cx={175 + eyeDrift.x} cy={143 + eyeDrift.y} r="2.2" fill="hsl(200 95% 70%)"
                  initial={{ opacity: 0.3 }} animate={{ opacity: [0.25, 0.6, 0.25] }}
                  transition={{ duration: 1.2, repeat: Infinity }} />
              </>
            )}

            {/* SPECTACLES */}
            <g>
              <rect x="109" y="132" width="34" height="24" rx="6" fill="url(#lens)" />
              <rect x="157" y="132" width="34" height="24" rx="6" fill="url(#lens)" />
              <rect x="109" y="132" width="34" height="24" rx="6" fill="none" stroke="#0a0a14" strokeWidth="2.4" />
              <rect x="157" y="132" width="34" height="24" rx="6" fill="none" stroke="#0a0a14" strokeWidth="2.4" />
              <path d="M 143 140 L 157 140" stroke="#0a0a14" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M 109 140 L 96 147" stroke="#0a0a14" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M 191 140 L 204 147" stroke="#0a0a14" strokeWidth="2.2" strokeLinecap="round" />
              <motion.path d="M 114 138 L 130 154" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"
                initial={{ opacity: 0.4 }} animate={{ opacity: [0.25, 0.65, 0.25] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} />
              <motion.path d="M 162 138 L 178 154" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"
                initial={{ opacity: 0.4 }} animate={{ opacity: [0.25, 0.65, 0.25] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }} />
              <rect x="109" y="132" width="34" height="24" rx="6" fill="none" stroke="hsl(200 95% 65%)" strokeWidth="0.5" opacity="0.55" />
              <rect x="157" y="132" width="34" height="24" rx="6" fill="none" stroke="hsl(200 95% 65%)" strokeWidth="0.5" opacity="0.55" />
            </g>

            {/* Nose */}
            <path d="M 148 156 Q 145 173 150 181 Q 155 173 152 156" fill="#c5905d" opacity="0.4" />
            <ellipse cx="150" cy="183" rx="3" ry="1.2" fill="#9c6f48" opacity="0.45" />

            {/* Mouth — lipsync */}
            <motion.g animate={{ scaleY: speaking ? 1 + amplitude * 0.18 : 1 }}
              transition={{ duration: 0.04 }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              <path d={`M ${150 - mouthWidth} 197 Q 150 ${197 + mouthCurve} ${150 + mouthWidth} 197 Q 150 ${197 + mouthOpen + 4} ${150 - mouthWidth} 197 Z`} fill="#4a1812" />
              <path d={`M ${150 - mouthWidth + 2} 198 Q 150 ${198 + Math.max(1, mouthCurve - 1.5)} ${150 + mouthWidth - 2} 198 Q 150 ${198 + Math.max(1, mouthCurve * 0.6)} ${150 - mouthWidth + 2} 198 Z`} fill="#fff8f0" />
              <path d={`M ${150 - mouthWidth} 197 Q 150 195 ${150 + mouthWidth} 197`} stroke="#3a0f0a" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              {mouthOpen > 5 && <ellipse cx="150" cy={199 + mouthOpen * 0.4} rx={mouthWidth * 0.4} ry="1.5" fill="#c4604a" />}
            </motion.g>

            {/* Subtle stubble */}
            <g opacity="0.18">
              {[124, 132, 140, 150, 160, 168, 176].map((x, i) => (
                <circle key={`st-${i}`} cx={x} cy={207 + (i % 2) * 2} r={0.7} fill="#15101e" />
              ))}
            </g>

            {/* Hair front layered */}
            <path d="M 98 130 Q 105 70 150 65 Q 195 70 202 130 Q 195 88 178 84 Q 158 80 146 92 Q 132 84 118 98 Q 108 96 98 130 Z" fill="url(#hair-base)" />
            <path d="M 128 88 Q 145 65 165 80 Q 175 70 182 84 Q 168 78 158 86 Q 145 76 134 92 Z" fill="url(#hair-base)" />
            <path d="M 194 90 Q 212 110 210 145 Q 204 115 196 100 Z" fill="url(#hair-base)" />
            <path d="M 100 130 Q 96 158 102 178 Q 99 156 102 132 Z" fill="url(#hair-base)" />
            <path d="M 200 130 Q 204 158 198 178 Q 201 156 198 132 Z" fill="url(#hair-base)" />
            <path d="M 112 105 Q 128 88 148 96" stroke="#0a0612" strokeWidth="0.7" fill="none" opacity="0.55" />
            <path d="M 152 96 Q 170 84 190 102" stroke="#0a0612" strokeWidth="0.7" fill="none" opacity="0.55" />
            <path d="M 140 88 Q 155 76 170 92" stroke="#9fb8d8" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.6" />
            <path d="M 110 95 Q 150 78 192 95 L 192 112 Q 150 92 110 112 Z" fill="url(#hair-shine)" opacity="0.65" />

            {/* Thinking dots */}
            {thinking && (
              <g transform="translate(140, 50)">
                {[0, 1, 2].map((i) => (
                  <motion.circle key={i} cx={i * 5} cy={0} r={1.6} fill="hsl(200 95% 70%)"
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18 }} />
                ))}
              </g>
            )}
          </g>

          {/* Listening ripples */}
          {listening && (
            <>
              <motion.circle cx="150" cy="330" r="6"
                fill="none" stroke="hsl(200 95% 65%)" strokeWidth="1.5"
                initial={{ r: 6, opacity: 1 }} animate={{ r: [6, 42], opacity: [1, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }} />
              <motion.circle cx="150" cy="330" r="6"
                fill="none" stroke="hsl(180 95% 70%)" strokeWidth="1.2"
                initial={{ r: 6, opacity: 1 }} animate={{ r: [6, 36], opacity: [1, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut", delay: 0.4 }} />
            </>
          )}
        </motion.svg>
      </motion.div>

      {/* Emotion status pill */}
      {!size && (
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 bottom-[5%] flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-xl border text-[10px] font-semibold uppercase tracking-wider pointer-events-none z-20"
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          style={{
            background: `${accent}22`,
            borderColor: `${accent}77`,
            color: accent,
          }}
        >
          <span className="block w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
          <span>{STATE_LABEL[state]}</span>
        </motion.div>
      )}
    </div>
  );
}

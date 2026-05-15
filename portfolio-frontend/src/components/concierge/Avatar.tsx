/**
 * Avatar - "Aria", a full-body stylized AI character.
 *
 * Designed for the split-stage layout where the avatar occupies the left
 * column. Full vertical figure: head, neck, torso, both arms with hands,
 * legs, feet — floating just above an ambient pedestal so she reads as a
 * holographic AI presence rather than a person standing on a floor.
 *
 * Animation layers (all GPU-accelerated, SVG + framer-motion):
 *  - Body float: subtle vertical drift
 *  - Head sway: independent gentle tilt
 *  - Arms: counter-phase pendulum sway
 *  - Hair tips: drifting wave
 *  - Blink: every 3–5s
 *  - Mouth: amplitude-driven lipsync (driven by external `amplitude` prop)
 *  - Speaking: right hand raises in light gesture
 *  - Listening: outer aura ring pulses, eyes brighten, chest mic ripple
 *  - Thinking: brow lift, head tilts slightly, AR-visor dots stream
 *  - Excited: both hands raise briefly, particles intensify
 *
 * Color story: porcelain skin with magenta undertones, platinum-magenta
 * hair, dark navy attire with cyan glowing trim — reads as AI, not human.
 */
import { useEffect, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";

export type AvatarEmotion = "neutral" | "happy" | "thoughtful" | "excited" | "listening";
export type AvatarState = "idle" | "listening" | "thinking" | "speaking";

interface AvatarProps {
  amplitude?: number;
  emotion?: AvatarEmotion;
  state?: AvatarState;
  size?: number;
  className?: string;
}

export default function Avatar({
  amplitude = 0,
  emotion = "neutral",
  state = "idle",
  size = 480,
  className = "",
}: AvatarProps) {
  const [blink, setBlink] = useState(false);

  // Auto-blink every 3–5s — keeps the character alive
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

  const speaking = state === "speaking";
  const listening = state === "listening";
  const thinking = state === "thinking";
  const excited = emotion === "excited";

  // Mouth shape
  const baseMouthCurve = emotion === "happy" || emotion === "excited"
    ? 4
    : emotion === "thoughtful" ? -1 : 2;
  const mouthOpen = speaking ? Math.max(1.4, amplitude * 10) : 1.4;
  const mouthCurve = speaking ? Math.min(6, 2 + amplitude * 6) : baseMouthCurve;

  // Eyebrow lift
  const browY = thinking ? -3 : excited ? -5 : 0;

  // Body float
  const bodyControls = useAnimationControls();
  useEffect(() => {
    bodyControls.start({
      y: [0, -6, 0],
      transition: { duration: 5, repeat: Infinity, ease: "easeInOut" },
    });
  }, [bodyControls]);

  // Head sway (independent)
  const headControls = useAnimationControls();
  useEffect(() => {
    headControls.start({
      rotate: thinking ? [-2, -4, -2] : [-1.5, 1.5, -1.5],
      transition: { duration: thinking ? 4 : 6, repeat: Infinity, ease: "easeInOut" },
    });
  }, [headControls, thinking]);

  // Right hand pose — raises on speaking/excited
  const rightHandRaised = speaking || excited;
  // Left hand mirrors only on excited
  const leftHandRaised = excited;

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, aspectRatio: "3 / 7" }}
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
          background:
            "radial-gradient(50% 38% at 50% 28%, hsl(290 95% 65% / 0.55), hsl(190 95% 60% / 0.28) 50%, transparent 78%)",
          filter: "blur(34px)",
        }}
      />

      {/* ===== Orbital rings around upper body ===== */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 700">
        <defs>
          <linearGradient id="orbit-g" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(290 95% 70%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(290 95% 70%)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="hsl(190 95% 60%)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.ellipse
          cx="150" cy="150" rx="118" ry="34"
          fill="none" stroke="url(#orbit-g)" strokeWidth="1.3"
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "150px 150px" }}
        />
        <motion.ellipse
          cx="150" cy="150" rx="133" ry="42"
          fill="none" stroke="url(#orbit-g)" strokeWidth="0.8" opacity="0.6"
          animate={{ rotate: -360 }}
          transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "150px 150px" }}
        />
      </svg>

      {/* ===== Particle field ===== */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 700">
        {Array.from({ length: 24 }).map((_, i) => {
          const x = 30 + (i * 17) % 240;
          const y = 50 + (i * 41) % 600;
          const dur = 3 + (i % 4);
          return (
            <motion.circle
              key={i}
              cx={x} cy={y} r={1 + (i % 3) * 0.6}
              fill={i % 2 ? "hsl(290 95% 70%)" : "hsl(190 95% 60%)"}
              initial={{ opacity: 0.15 }}
              animate={{ opacity: [0.15, excited ? 0.95 : 0.8, 0.15], y: [y, y - 14, y] }}
              transition={{ duration: dur, repeat: Infinity, ease: "easeInOut", delay: i * 0.16 }}
            />
          );
        })}
      </svg>

      {/* ===== Pedestal — soft glowing platform under the feet ===== */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 700">
        <ellipse cx="150" cy="660" rx="95" ry="14" fill="hsl(290 95% 60% / 0.55)" filter="blur(6px)" />
        <ellipse cx="150" cy="666" rx="60" ry="6" fill="hsl(190 95% 65% / 0.7)" filter="blur(3px)" />
      </svg>

      {/* ===== MAIN CHARACTER ===== */}
      <motion.svg
        className="relative z-10 w-full h-full drop-shadow-[0_22px_45px_rgba(150,75,255,0.28)]"
        viewBox="0 0 300 700"
        preserveAspectRatio="xMidYMid meet"
        animate={bodyControls}
      >
        <defs>
          {/* SKIN gradients */}
          <radialGradient id="skin" cx="40%" cy="35%" r="80%">
            <stop offset="0%" stopColor="#fff8f5" />
            <stop offset="40%" stopColor="#f3e0e8" />
            <stop offset="100%" stopColor="#c89cd6" />
          </radialGradient>
          <linearGradient id="skin-arm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f3e0e8" />
            <stop offset="100%" stopColor="#c89cd6" />
          </linearGradient>

          {/* HAIR */}
          <linearGradient id="hair-main" x1="0" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="#f1e9ff" />
            <stop offset="55%" stopColor="#c9b3ff" />
            <stop offset="100%" stopColor="#6a3fc9" />
          </linearGradient>
          <linearGradient id="hair-tip" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e91e9f" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#9b27d4" stopOpacity="0" />
          </linearGradient>

          {/* CLOTHING — jacket, turtleneck, slacks, boots */}
          <linearGradient id="jacket" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a1335" />
            <stop offset="100%" stopColor="#0a0820" />
          </linearGradient>
          <linearGradient id="jacket-shine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="trim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(190 95% 60%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(190 95% 65%)" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(190 95% 60%)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="turtle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a1f4d" />
            <stop offset="100%" stopColor="#1a1335" />
          </linearGradient>
          <linearGradient id="slacks" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a1335" />
            <stop offset="100%" stopColor="#08051a" />
          </linearGradient>
          <linearGradient id="boots" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0e0a22" />
            <stop offset="100%" stopColor="#03020a" />
          </linearGradient>

          {/* EYES + accents */}
          <radialGradient id="eye-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a3f0ff" stopOpacity="1" />
            <stop offset="60%" stopColor="#3b9eff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#5b2dff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bloom" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff8cc8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ff8cc8" stopOpacity="0" />
          </radialGradient>

          {/* Background body glow */}
          <radialGradient id="body-glow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="hsl(290 95% 70% / 0.4)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          <filter id="soft-blur"><feGaussianBlur stdDeviation="1.5" /></filter>
        </defs>

        {/* Behind-body soft glow */}
        <ellipse cx="150" cy="360" rx="140" ry="220" fill="url(#body-glow)" filter="url(#soft-blur)" />

        {/* ===== LEGS ===== */}
        {/* Left leg */}
        <motion.g
          animate={{ x: [0, -1, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M 130 410 Q 124 460 122 530 Q 122 590 128 640 L 142 640 Q 144 590 142 530 Q 142 460 145 410 Z"
            fill="url(#slacks)"
          />
          {/* knee crease */}
          <path d="M 124 510 Q 134 514 144 510" stroke="#06031c" strokeWidth="0.6" fill="none" />
          {/* trim glow on outer seam */}
          <path d="M 122 430 L 121 620" stroke="hsl(190 95% 65% / 0.4)" strokeWidth="0.6" />
        </motion.g>

        {/* Right leg */}
        <motion.g
          animate={{ x: [0, 1, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        >
          <path
            d="M 155 410 Q 156 460 158 530 Q 158 590 152 640 L 168 640 Q 174 590 178 530 Q 176 460 170 410 Z"
            fill="url(#slacks)"
          />
          <path d="M 156 510 Q 166 514 176 510" stroke="#06031c" strokeWidth="0.6" fill="none" />
          <path d="M 179 430 L 180 620" stroke="hsl(190 95% 65% / 0.4)" strokeWidth="0.6" />
        </motion.g>

        {/* ===== FEET / BOOTS (floating just above pedestal) ===== */}
        <g>
          {/* Left boot */}
          <path
            d="M 118 640 Q 113 650 116 658 L 145 658 L 145 640 Z"
            fill="url(#boots)"
          />
          <path d="M 116 658 L 145 658" stroke="hsl(190 95% 65%)" strokeWidth="1" opacity="0.7" />
          {/* Right boot */}
          <path
            d="M 152 640 L 152 658 L 182 658 Q 184 650 178 640 Z"
            fill="url(#boots)"
          />
          <path d="M 152 658 L 182 658" stroke="hsl(190 95% 65%)" strokeWidth="1" opacity="0.7" />
        </g>

        {/* ===== HIPS / waist transition ===== */}
        <path
          d="M 110 380 Q 150 410 190 380 L 190 415 Q 150 425 110 415 Z"
          fill="url(#slacks)"
        />
        {/* belt accent */}
        <rect x="112" y="378" width="76" height="5" rx="1" fill="#0a0820" />
        <rect x="146" y="378" width="8" height="5" fill="hsl(190 95% 60%)" opacity="0.7" />

        {/* ===== TORSO / JACKET ===== */}
        {/* Main jacket silhouette */}
        <path
          d="M 88 410 Q 88 280 120 240 L 140 230 Q 150 235 160 230 L 180 240 Q 212 280 212 410 Z"
          fill="url(#jacket)"
        />
        {/* Subtle shine across chest */}
        <path
          d="M 88 280 Q 150 260 212 280 L 212 340 Q 150 320 88 340 Z"
          fill="url(#jacket-shine)" opacity="0.6"
        />
        {/* Jacket V collar */}
        <path
          d="M 125 245 L 150 320 L 175 245 L 168 240 L 150 305 L 132 240 Z"
          fill="#06031c"
        />
        {/* Glowing trim along V */}
        <path
          d="M 125 245 L 150 320 L 175 245"
          stroke="hsl(190 95% 65%)" strokeWidth="1.5" fill="none" opacity="0.9" strokeLinecap="round"
        />
        {/* Shoulder trim accents */}
        <path d="M 95 290 Q 100 268 116 256" stroke="url(#trim)" strokeWidth="1.4" fill="none" />
        <path d="M 205 290 Q 200 268 184 256" stroke="url(#trim)" strokeWidth="1.4" fill="none" />
        {/* Side jacket lines */}
        <path d="M 92 350 L 92 408" stroke="hsl(190 95% 60% / 0.35)" strokeWidth="0.6" />
        <path d="M 208 350 L 208 408" stroke="hsl(190 95% 60% / 0.35)" strokeWidth="0.6" />

        {/* Turtleneck */}
        <path
          d="M 130 245 Q 150 255 170 245 L 170 215 Q 150 208 130 215 Z"
          fill="url(#turtle)"
        />
        <path
          d="M 130 215 Q 150 211 170 215"
          stroke="hsl(290 95% 75% / 0.4)" strokeWidth="1" fill="none"
        />

        {/* Holographic data lines on chest (streaming) */}
        <motion.path
          d="M 100 335 Q 150 327 200 335"
          stroke="hsl(190 95% 65%)" strokeWidth="0.7" fill="none" strokeDasharray="2 3"
          animate={{ strokeDashoffset: [0, -10] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          opacity="0.7"
        />
        <motion.path
          d="M 95 360 Q 150 350 205 360"
          stroke="hsl(290 95% 70%)" strokeWidth="0.6" fill="none" strokeDasharray="1 2"
          animate={{ strokeDashoffset: [0, 10] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
          opacity="0.5"
        />

        {/* ===== ARMS — BOTH visible, with hands ===== */}

        {/* LEFT ARM (viewer's left, character's right when mirrored — keep as drawn) */}
        <motion.g
          animate={
            leftHandRaised
              ? { rotate: -30, x: -2 }
              : { rotate: [0, -2, 0, 2, 0], x: 0 }
          }
          transition={
            leftHandRaised
              ? { type: "spring", stiffness: 130, damping: 16 }
              : { duration: 4.5, repeat: Infinity, ease: "easeInOut" }
          }
          style={{ transformOrigin: "92px 260px" }}
        >
          {/* Upper sleeve */}
          <path
            d="M 88 260 Q 70 290 65 340 Q 64 380 72 410 L 86 408 Q 82 380 84 340 Q 88 300 100 280 Z"
            fill="url(#jacket)"
          />
          {/* Sleeve trim cuff */}
          <path d="M 72 405 Q 80 410 86 408" stroke="hsl(190 95% 65%)" strokeWidth="1" fill="none" opacity="0.85" />
          {/* Hand */}
          <g>
            <ellipse cx="74" cy="424" rx="11" ry="10" fill="url(#skin-arm)" />
            {/* Fingers */}
            <path d="M 66 432 Q 64 442 68 446" stroke="#b58cc7" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 71 434 Q 69 444 73 448" stroke="#b58cc7" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 76 435 Q 75 445 79 448" stroke="#b58cc7" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 82 432 Q 84 442 80 446" stroke="#b58cc7" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* Thumb */}
            <path d="M 65 420 Q 59 416 62 412" stroke="#b58cc7" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        </motion.g>

        {/* RIGHT ARM (drawn on viewer's right) */}
        <motion.g
          animate={
            rightHandRaised
              ? { rotate: -38, x: 3, y: -4 }
              : { rotate: [0, 2, 0, -2, 0], x: 0, y: 0 }
          }
          transition={
            rightHandRaised
              ? { type: "spring", stiffness: 130, damping: 16 }
              : { duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 }
          }
          style={{ transformOrigin: "208px 260px" }}
        >
          {/* Upper sleeve */}
          <path
            d="M 212 260 Q 230 290 235 340 Q 236 380 228 410 L 214 408 Q 218 380 216 340 Q 212 300 200 280 Z"
            fill="url(#jacket)"
          />
          {/* Sleeve trim cuff */}
          <path d="M 228 405 Q 220 410 214 408" stroke="hsl(190 95% 65%)" strokeWidth="1" fill="none" opacity="0.85" />
          {/* Hand */}
          <g>
            <ellipse cx="226" cy="424" rx="11" ry="10" fill="url(#skin-arm)" />
            <path d="M 234 432 Q 236 442 232 446" stroke="#b58cc7" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 229 434 Q 231 444 227 448" stroke="#b58cc7" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 224 435 Q 225 445 221 448" stroke="#b58cc7" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 218 432 Q 216 442 220 446" stroke="#b58cc7" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 235 420 Q 241 416 238 412" stroke="#b58cc7" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        </motion.g>

        {/* ===== NECK ===== */}
        <path d="M 134 215 Q 150 222 166 215 L 168 232 Q 150 237 132 232 Z" fill="url(#skin)" />
        <path d="M 134 232 Q 150 237 166 232" stroke="#b58cc7" strokeWidth="0.6" fill="none" opacity="0.5" />

        {/* ===== HEAD GROUP (independent sway) ===== */}
        <motion.g animate={headControls} style={{ transformOrigin: "150px 175px" }}>
          {/* Back hair */}
          <path
            d="M 95 115 Q 90 40 150 32 Q 210 40 205 115 L 215 175 Q 150 210 85 175 Z"
            fill="url(#hair-main)"
          />
          {/* Hair tip pink-glow overlay */}
          <path
            d="M 95 115 Q 90 40 150 32 Q 210 40 205 115"
            fill="url(#hair-tip)" opacity="0.7"
          />

          {/* Face oval */}
          <ellipse cx="150" cy="140" rx="52" ry="62" fill="url(#skin)" />

          {/* Cheek bloom */}
          <ellipse cx="118" cy="165" rx="14" ry="9" fill="url(#bloom)" />
          <ellipse cx="182" cy="165" rx="14" ry="9" fill="url(#bloom)" />

          {/* Holographic tech accent on left cheek */}
          <path d="M 100 150 L 95 145 M 100 150 L 105 155" stroke="hsl(190 95% 65%)" strokeWidth="0.8" opacity="0.7" strokeLinecap="round" />
          <circle cx="100" cy="150" r="1.5" fill="hsl(190 95% 70%)" opacity="0.9" />

          {/* Eyebrows */}
          <motion.path
            d="M 115 125 Q 128 120 138 125"
            stroke="#4a3a7c" strokeWidth="2.5" fill="none" strokeLinecap="round"
            animate={{ y: browY }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }}
          />
          <motion.path
            d="M 162 125 Q 172 120 185 125"
            stroke="#4a3a7c" strokeWidth="2.5" fill="none" strokeLinecap="round"
            animate={{ y: browY }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }}
          />

          {/* EYE SHADOWS */}
          <ellipse cx="125" cy="142" rx="12" ry="3" fill="#a37cb8" opacity="0.25" />
          <ellipse cx="175" cy="142" rx="12" ry="3" fill="#a37cb8" opacity="0.25" />

          {/* LEFT eye */}
          <g>
            <ellipse cx="125" cy="140" rx="10" ry={blink ? 0.6 : 7} fill="#fff" />
            {!blink && (
              <>
                <circle cx="125" cy="140" r="6.5" fill="url(#eye-glow)" />
                <circle cx="125" cy="140" r="3.2" fill="#0a0820" />
                <circle cx="123.5" cy="138" r="1.4" fill="#fff" opacity="0.95" />
                <circle cx="127" cy="142" r="0.7" fill="#fff" opacity="0.6" />
              </>
            )}
          </g>
          {/* RIGHT eye */}
          <g>
            <ellipse cx="175" cy="140" rx="10" ry={blink ? 0.6 : 7} fill="#fff" />
            {!blink && (
              <>
                <circle cx="175" cy="140" r="6.5" fill="url(#eye-glow)" />
                <circle cx="175" cy="140" r="3.2" fill="#0a0820" />
                <circle cx="173.5" cy="138" r="1.4" fill="#fff" opacity="0.95" />
                <circle cx="177" cy="142" r="0.7" fill="#fff" opacity="0.6" />
              </>
            )}
          </g>

          {/* Pupil emissive glow */}
          {(listening || speaking) && !blink && (
            <>
              <motion.circle
                cx="125" cy="140" r="3.2" fill="hsl(190 95% 70%)"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <motion.circle
                cx="175" cy="140" r="3.2" fill="hsl(190 95% 70%)"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            </>
          )}

          {/* Nose */}
          <path d="M 148 150 Q 146 165 150 172 Q 154 165 152 150" fill="#c89cd6" opacity="0.35" />
          <ellipse cx="150" cy="174" rx="3" ry="1" fill="#a07bb8" opacity="0.5" />

          {/* Mouth — amplitude driven */}
          <motion.g
            animate={{ scaleY: speaking ? 1 + amplitude * 0.2 : 1 }}
            transition={{ duration: 0.04 }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <path
              d={`M ${150 - 14} 190 Q 150 ${190 + mouthCurve} ${150 + 14} 190 Q 150 ${190 + mouthOpen + 1} ${150 - 14} 190 Z`}
              fill="#7b2d5e"
            />
            <path
              d={`M ${150 - 14} 190 Q 150 188 ${150 + 14} 190`}
              stroke="#5b1f48" strokeWidth="1.2" fill="none" strokeLinecap="round"
            />
          </motion.g>

          {/* FRONT HAIR strands — asymmetric sweep */}
          <path
            d="M 95 115 Q 100 60 150 52 Q 200 60 205 115
               Q 200 85 165 80 Q 130 85 115 105 Q 105 95 95 115 Z"
            fill="url(#hair-main)"
          />
          {/* Hair shine */}
          <path
            d="M 110 80 Q 145 65 175 72"
            stroke="#fff" strokeWidth="2" fill="none" opacity="0.45" strokeLinecap="round"
          />
          {/* Side bang */}
          <path
            d="M 195 80 Q 215 105 215 145 Q 208 115 196 95 Z"
            fill="url(#hair-main)"
          />

          {/* AR visor — glowing arc above one eye */}
          <motion.path
            d="M 110 130 Q 130 123 145 128"
            stroke="hsl(190 95% 70%)" strokeWidth="1.2" fill="none" strokeLinecap="round"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.circle
            cx="146" cy="128" r="1.6" fill="hsl(190 95% 70%)"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Thinking dots on visor */}
          {thinking && (
            <g transform="translate(115, 102)">
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={i}
                  cx={i * 6} cy={0} r={1.5}
                  fill="hsl(190 95% 70%)"
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                  transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </g>
          )}
        </motion.g>

        {/* ===== Listening ripples from chest ===== */}
        {listening && (
          <>
            <motion.circle
              cx="150" cy="330" r="6" fill="none" stroke="hsl(190 95% 65%)" strokeWidth="1.5"
              animate={{ r: [6, 42], opacity: [1, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.circle
              cx="150" cy="330" r="6" fill="none" stroke="hsl(290 95% 70%)" strokeWidth="1.2"
              animate={{ r: [6, 36], opacity: [1, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
            />
          </>
        )}

        {/* ===== Mic emblem on chest (visual anchor for "listening") ===== */}
        <g transform="translate(150, 330)">
          <circle r="6" fill="#06031c" stroke="hsl(190 95% 65%)" strokeWidth="0.8" />
          <circle r="3" fill="hsl(190 95% 65%)" opacity={listening ? 1 : 0.5} />
        </g>
      </motion.svg>
    </div>
  );
}

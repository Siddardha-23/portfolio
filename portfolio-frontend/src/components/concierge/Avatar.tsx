/**
 * Avatar - "Aria", the AI Concierge character.
 *
 * A stylized 3/4-body humanoid AI persona. Intentionally NOT a face mimic —
 * platinum hair, holographic accents, luminous eyes — reads as a digital
 * being, not a real person. Designed for the split-stage layout where the
 * avatar takes the left half of the viewport.
 *
 * Animations (composed, GPU-accelerated):
 *  - Idle: gentle vertical sway + breathing scale
 *  - Blink: every 3-5s, both eyes
 *  - Speak: jaw open driven by external amplitude (0..1)
 *  - Listen: outer aura ring pulses, eyes glow brighter
 *  - Think: brow lift, slow head tilt, hand-to-chin gesture
 *  - Excited: hand raises, particles intensify, eyebrow raise
 *
 * All effects are pure SVG + framer-motion. No 3D, no GLB loading, ships in
 * the main bundle weight (~12KB of JSX → <3KB gzipped).
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

  // Mouth — amplitude-driven when speaking, smile when happy/excited
  const baseMouthCurve = emotion === "happy" || emotion === "excited" ? 5 : emotion === "thoughtful" ? -1 : 2;
  const mouthOpen = speaking ? Math.max(1.5, amplitude * 12) : 1.5;
  const mouthCurve = speaking ? Math.min(7, 2 + amplitude * 7) : baseMouthCurve;

  // Eyebrow
  const browY = thinking ? -3 : emotion === "excited" ? -5 : 0;

  // Body sway
  const bodyControls = useAnimationControls();
  useEffect(() => {
    bodyControls.start({
      y: [0, -4, 0],
      transition: { duration: 4.5, repeat: Infinity, ease: "easeInOut" },
    });
  }, [bodyControls]);

  // Hand position — raises during excited or thinking (chin)
  const handRaised = emotion === "excited" || thinking;

  return (
    <div className={`relative ${className}`} style={{ width: size, aspectRatio: "3 / 5" }} aria-hidden="true">
      {/* Ambient aura — pulses on listening, slow drift otherwise */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        animate={
          listening
            ? { scale: [1, 1.06, 1], opacity: [0.55, 0.85, 0.55] }
            : thinking
              ? { rotate: 360, opacity: [0.4, 0.55, 0.4] }
              : { scale: [1, 1.02, 1], opacity: [0.4, 0.55, 0.4] }
        }
        transition={{ duration: listening ? 1.4 : thinking ? 8 : 5.5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(60% 50% at 50% 40%, hsl(290 95% 65% / 0.45), hsl(190 95% 60% / 0.25) 50%, transparent 75%)",
          filter: "blur(28px)",
        }}
      />

      {/* Orbit rings */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 300 500"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="orbit-g1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(290 95% 70%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(290 95% 70%)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="hsl(190 95% 60%)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.ellipse
          cx="150" cy="160" rx="120" ry="32"
          fill="none" stroke="url(#orbit-g1)" strokeWidth="1.2"
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "150px 160px" }}
        />
        <motion.ellipse
          cx="150" cy="160" rx="135" ry="40"
          fill="none" stroke="url(#orbit-g1)" strokeWidth="0.8" opacity="0.6"
          animate={{ rotate: -360 }}
          transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "150px 160px" }}
        />
      </svg>

      {/* Particle field */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 500">
        {Array.from({ length: 18 }).map((_, i) => {
          const x = 30 + (i * 17) % 240;
          const y = 60 + (i * 31) % 380;
          const dur = 3 + (i % 4);
          return (
            <motion.circle
              key={i}
              cx={x}
              cy={y}
              r={1 + (i % 3) * 0.6}
              fill={i % 2 ? "hsl(290 95% 70%)" : "hsl(190 95% 60%)"}
              initial={{ opacity: 0.15 }}
              animate={{ opacity: [0.15, 0.85, 0.15], y: [y, y - 10, y] }}
              transition={{ duration: dur, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
            />
          );
        })}
      </svg>

      {/* Main character */}
      <motion.svg
        className="relative z-10 w-full h-full drop-shadow-[0_20px_40px_rgba(155,80,255,0.25)]"
        viewBox="0 0 300 500"
        preserveAspectRatio="xMidYMid meet"
        animate={bodyControls}
      >
        <defs>
          {/* Holographic skin — porcelain with cyan undertone */}
          <radialGradient id="skin" cx="40%" cy="35%" r="80%">
            <stop offset="0%" stopColor="#fff8f5" />
            <stop offset="40%" stopColor="#f3e0e8" />
            <stop offset="100%" stopColor="#c89cd6" />
          </radialGradient>
          {/* Hair — platinum with magenta highlight */}
          <linearGradient id="hair-main" x1="0" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="#f1e9ff" />
            <stop offset="55%" stopColor="#c9b3ff" />
            <stop offset="100%" stopColor="#6a3fc9" />
          </linearGradient>
          <linearGradient id="hair-tip" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e91e9f" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#9b27d4" stopOpacity="0" />
          </linearGradient>
          {/* Jacket — deep navy with cyan glow trim */}
          <linearGradient id="jacket" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a1335" />
            <stop offset="100%" stopColor="#0a0820" />
          </linearGradient>
          <linearGradient id="jacket-trim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(190 95% 60%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(190 95% 65%)" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(190 95% 60%)" stopOpacity="0" />
          </linearGradient>
          {/* Inner shirt — turtleneck */}
          <linearGradient id="turtle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a1f4d" />
            <stop offset="100%" stopColor="#1a1335" />
          </linearGradient>
          {/* Eye glow */}
          <radialGradient id="eye-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a3f0ff" stopOpacity="1" />
            <stop offset="60%" stopColor="#3b9eff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#5b2dff" stopOpacity="0" />
          </radialGradient>
          {/* Cheek bloom */}
          <radialGradient id="bloom" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff8cc8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ff8cc8" stopOpacity="0" />
          </radialGradient>
          {/* Subtle inner-shadow under jaw */}
          <filter id="soft-blur">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>

        {/* ===== BODY ===== */}

        {/* Behind-body soft glow */}
        <ellipse cx="150" cy="350" rx="120" ry="100" fill="hsl(290 95% 65% / 0.18)" filter="url(#soft-blur)" />

        {/* Jacket — outer silhouette */}
        <path
          d="M 60 500 Q 60 350 110 300 L 130 285 Q 150 295 170 285 L 190 300 Q 240 350 240 500 Z"
          fill="url(#jacket)"
        />
        {/* Jacket collar V */}
        <path
          d="M 120 295 L 150 360 L 180 295 L 175 290 L 150 345 L 125 290 Z"
          fill="#0a0820"
        />
        {/* Glowing trim on jacket edges */}
        <path
          d="M 120 295 L 150 360 L 180 295"
          stroke="hsl(190 95% 65%)" strokeWidth="1.5" fill="none" opacity="0.85"
          strokeLinecap="round"
        />
        {/* Shoulder trim accents */}
        <path d="M 70 360 Q 75 340 90 330" stroke="url(#jacket-trim)" strokeWidth="1.4" fill="none" />
        <path d="M 230 360 Q 225 340 210 330" stroke="url(#jacket-trim)" strokeWidth="1.4" fill="none" />

        {/* Turtleneck */}
        <path
          d="M 125 295 Q 150 305 175 295 L 175 270 Q 150 260 125 270 Z"
          fill="url(#turtle)"
        />
        {/* Turtleneck top edge */}
        <path
          d="M 125 270 Q 150 264 175 270"
          stroke="hsl(290 95% 75% / 0.4)" strokeWidth="1" fill="none"
        />

        {/* Holographic data line across chest */}
        <motion.path
          d="M 95 380 Q 150 372 205 380"
          stroke="hsl(190 95% 65%)" strokeWidth="0.8" fill="none" strokeDasharray="2 3"
          animate={{ strokeDashoffset: [0, -10] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          opacity="0.7"
        />
        <motion.path
          d="M 90 410 Q 150 400 210 410"
          stroke="hsl(290 95% 70%)" strokeWidth="0.6" fill="none" strokeDasharray="1 2"
          animate={{ strokeDashoffset: [0, 10] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
          opacity="0.5"
        />

        {/* ===== HAND — visible at lower-right, raises on excited/thinking ===== */}
        <motion.g
          animate={handRaised ? { rotate: -18, y: -28, x: -4 } : { rotate: 0, y: 0, x: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 16 }}
          style={{ transformOrigin: "210px 410px" }}
        >
          {/* Sleeve */}
          <path
            d="M 200 410 Q 220 420 230 450 L 220 460 Q 210 440 195 425 Z"
            fill="url(#jacket)"
          />
          {/* Palm */}
          <ellipse cx="225" cy="455" rx="14" ry="11" fill="url(#skin)" />
          {/* Fingers */}
          <path d="M 215 460 Q 213 470 218 472" stroke="#c89cd6" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M 222 462 Q 220 473 226 475" stroke="#c89cd6" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M 230 461 Q 230 472 235 472" stroke="#c89cd6" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* Thumb */}
          <path d="M 234 452 Q 240 450 240 446" stroke="#c89cd6" strokeWidth="2" fill="none" strokeLinecap="round" />
        </motion.g>

        {/* ===== NECK ===== */}
        <path d="M 134 268 Q 150 275 166 268 L 168 285 Q 150 290 132 285 Z" fill="url(#skin)" />
        <path d="M 134 285 Q 150 290 166 285" stroke="#b58cc7" strokeWidth="0.6" fill="none" opacity="0.5" />

        {/* ===== HEAD ===== */}

        {/* Back hair silhouette */}
        <path
          d="M 95 165 Q 90 90 150 80 Q 210 90 205 165 L 215 230 Q 150 260 85 230 Z"
          fill="url(#hair-main)"
        />
        {/* Hair tip glow */}
        <path
          d="M 95 165 Q 90 90 150 80 Q 210 90 205 165"
          fill="url(#hair-tip)"
          opacity="0.7"
        />

        {/* Face shape */}
        <ellipse cx="150" cy="190" rx="52" ry="62" fill="url(#skin)" />

        {/* Subtle cheek bloom */}
        <ellipse cx="118" cy="215" rx="14" ry="9" fill="url(#bloom)" />
        <ellipse cx="182" cy="215" rx="14" ry="9" fill="url(#bloom)" />

        {/* Holographic cheek tech-line — faint glowing geometric accent */}
        <path d="M 100 200 L 95 195 M 100 200 L 105 205" stroke="hsl(190 95% 65%)" strokeWidth="0.8" opacity="0.7" strokeLinecap="round" />
        <circle cx="100" cy="200" r="1.5" fill="hsl(190 95% 70%)" opacity="0.9" />

        {/* Eyebrows */}
        <motion.path
          d="M 115 175 Q 128 170 138 175"
          stroke="#4a3a7c" strokeWidth="2.5" fill="none" strokeLinecap="round"
          animate={{ y: browY }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
        />
        <motion.path
          d="M 162 175 Q 172 170 185 175"
          stroke="#4a3a7c" strokeWidth="2.5" fill="none" strokeLinecap="round"
          animate={{ y: browY }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
        />

        {/* ===== EYES — large, expressive, luminous ===== */}
        {/* Eye sockets (subtle shadow under eye) */}
        <ellipse cx="125" cy="192" rx="12" ry="3" fill="#a37cb8" opacity="0.25" />
        <ellipse cx="175" cy="192" rx="12" ry="3" fill="#a37cb8" opacity="0.25" />

        {/* Left eye */}
        <g>
          {/* White sclera */}
          <ellipse cx="125" cy="190" rx="10" ry={blink ? 0.6 : 7} fill="#fff" />
          {/* Outer iris glow */}
          {!blink && (
            <>
              <circle cx="125" cy="190" r="6.5" fill="url(#eye-glow)" />
              {/* Pupil */}
              <circle cx="125" cy="190" r="3.2" fill="#0a0820" />
              {/* Inner highlight */}
              <circle cx="123.5" cy="188" r="1.4" fill="#fff" opacity="0.95" />
              {/* Tiny secondary catch-light */}
              <circle cx="127" cy="192" r="0.7" fill="#fff" opacity="0.6" />
            </>
          )}
        </g>

        {/* Right eye */}
        <g>
          <ellipse cx="175" cy="190" rx="10" ry={blink ? 0.6 : 7} fill="#fff" />
          {!blink && (
            <>
              <circle cx="175" cy="190" r="6.5" fill="url(#eye-glow)" />
              <circle cx="175" cy="190" r="3.2" fill="#0a0820" />
              <circle cx="173.5" cy="188" r="1.4" fill="#fff" opacity="0.95" />
              <circle cx="177" cy="192" r="0.7" fill="#fff" opacity="0.6" />
            </>
          )}
        </g>

        {/* Pupil emissive glow (when listening or speaking) */}
        {(listening || speaking) && !blink && (
          <>
            <motion.circle
              cx="125" cy="190" r="3.2" fill="hsl(190 95% 70%)"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <motion.circle
              cx="175" cy="190" r="3.2" fill="hsl(190 95% 70%)"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          </>
        )}

        {/* ===== NOSE — minimal, just two soft contour lines ===== */}
        <path d="M 148 200 Q 146 215 150 222 Q 154 215 152 200" fill="#c89cd6" opacity="0.35" />
        <ellipse cx="150" cy="224" rx="3" ry="1" fill="#a07bb8" opacity="0.5" />

        {/* ===== MOUTH — lipsync-driven ===== */}
        <motion.g
          animate={{ scaleY: speaking ? 1 + amplitude * 0.2 : 1 }}
          transition={{ duration: 0.04 }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          {/* Lip shadow */}
          <path
            d={`M ${150 - 14} 240 Q 150 ${240 + mouthCurve} ${150 + 14} 240 Q 150 ${240 + mouthOpen + 1} ${150 - 14} 240 Z`}
            fill="#7b2d5e"
          />
          {/* Top lip line */}
          <path
            d={`M ${150 - 14} 240 Q 150 238 ${150 + 14} 240`}
            stroke="#5b1f48" strokeWidth="1.2" fill="none" strokeLinecap="round"
          />
        </motion.g>

        {/* ===== FRONT HAIR strands — modern asymmetric sweep ===== */}
        <path
          d="M 95 165 Q 100 110 150 102 Q 200 110 205 165
             Q 200 135 165 130 Q 130 135 115 155 Q 105 145 95 165 Z"
          fill="url(#hair-main)"
        />
        {/* Hair shine */}
        <path
          d="M 110 130 Q 145 115 175 122"
          stroke="#fff" strokeWidth="2" fill="none" opacity="0.45" strokeLinecap="round"
        />
        {/* Side bang */}
        <path
          d="M 195 130 Q 215 155 215 195 Q 208 165 196 145 Z"
          fill="url(#hair-main)"
        />
        {/* Bottom hair tips behind shoulder */}
        <path
          d="M 90 220 Q 80 260 95 285 Q 100 250 108 230 Z"
          fill="url(#hair-main)"
        />
        <path
          d="M 210 220 Q 220 260 205 285 Q 200 250 192 230 Z"
          fill="url(#hair-main)"
        />

        {/* ===== AR Visor accent — subtle glowing arc above one eye ===== */}
        <motion.path
          d="M 110 180 Q 130 173 145 178"
          stroke="hsl(190 95% 70%)" strokeWidth="1.2" fill="none" strokeLinecap="round"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.circle
          cx="146" cy="178" r="1.6" fill="hsl(190 95% 70%)"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* ===== Listening ripple - emanates from chest mic ===== */}
        {listening && (
          <>
            <motion.circle
              cx="150" cy="380" r="6" fill="none" stroke="hsl(190 95% 65%)" strokeWidth="1.5"
              animate={{ r: [6, 36], opacity: [1, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.circle
              cx="150" cy="380" r="6" fill="none" stroke="hsl(290 95% 70%)" strokeWidth="1.2"
              animate={{ r: [6, 30], opacity: [1, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
            />
          </>
        )}

        {/* ===== Thinking dots on AR visor ===== */}
        {thinking && (
          <g transform="translate(115, 152)">
            {[0, 1, 2].map((i) => (
              <motion.circle
                key={i}
                cx={i * 6}
                cy={0}
                r={1.5}
                fill="hsl(190 95% 70%)"
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18 }}
              />
            ))}
          </g>
        )}
      </motion.svg>
    </div>
  );
}

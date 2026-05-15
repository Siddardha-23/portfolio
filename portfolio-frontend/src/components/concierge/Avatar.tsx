/**
 * Avatar - "Aris", the Concierge.
 *
 * A polished full-body male AI persona designed for the split-stage layout.
 * Fair skin, modern stylized features, prominent black-rim spectacles,
 * matte-black over-ear headphones with a cyan LED ring resting around the
 * neck, charcoal open zip-hoodie over a white tee with a small cloud
 * emblem, dark indigo slim-fit jeans, white high-top sneakers with cyan
 * accents and an AWS-orange sole stripe, and a smartwatch on the left
 * wrist. He stands above a soft holographic pedestal — reads as a
 * cool digital persona, not a person standing on a floor.
 *
 * Sizing
 *   When `size` is omitted (stage), the wrapper fills the parent's height
 *   and the SVG scales to contain (preserveAspectRatio="xMidYMid meet")
 *   so the head NEVER clips. When `size` is provided (launcher/widget),
 *   the wrapper uses fixed width with locked aspect ratio.
 *
 * Animation layers (all GPU-accelerated SVG + framer-motion):
 *   - Body float
 *   - Independent head sway (slower than body)
 *   - Counter-phase arm pendulum at rest; right hand raises when speaking,
 *     both hands raise on excited
 *   - Hair tip drift
 *   - Blink (every 3–5s)
 *   - Mouth lipsync (amplitude-driven)
 *   - Listening: outer aura pulses, eye glow, chest-mic ripples, headphone
 *     cyan ring brightens
 *   - Thinking: brow lift, head tilts, AR-spec streaming dots
 *   - Smartwatch face glows during listen/speak
 *   - Lens shine streak rotates
 */
import { useEffect, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";

export type AvatarEmotion = "neutral" | "happy" | "thoughtful" | "excited" | "listening";
export type AvatarState = "idle" | "listening" | "thinking" | "speaking";

interface AvatarProps {
  amplitude?: number;
  emotion?: AvatarEmotion;
  state?: AvatarState;
  /** If set, wrapper is fixed width with aspect-ratio. If omitted, fills parent height. */
  size?: number;
  className?: string;
}

export default function Avatar({
  amplitude = 0,
  emotion = "neutral",
  state = "idle",
  size,
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
  const excited = emotion === "excited";

  const baseMouthCurve = emotion === "happy" || emotion === "excited"
    ? 3 : emotion === "thoughtful" ? -1 : 1.5;
  const mouthOpen = speaking ? Math.max(1.2, amplitude * 9) : 1.2;
  const mouthCurve = speaking ? Math.min(5, 1.5 + amplitude * 5) : baseMouthCurve;
  const browY = thinking ? -3 : excited ? -5 : 0;

  const bodyControls = useAnimationControls();
  useEffect(() => {
    bodyControls.start({
      y: [0, -5, 0],
      transition: { duration: 5, repeat: Infinity, ease: "easeInOut" },
    });
  }, [bodyControls]);

  const headControls = useAnimationControls();
  useEffect(() => {
    headControls.start({
      rotate: thinking ? [-2, -4, -2] : [-1.2, 1.2, -1.2],
      transition: { duration: thinking ? 4 : 6, repeat: Infinity, ease: "easeInOut" },
    });
  }, [headControls, thinking]);

  const rightHandRaised = speaking || excited;
  const leftHandRaised = excited;

  const wrapperStyle: React.CSSProperties = size
    ? { width: size, aspectRatio: "3 / 7" }
    : { height: "100%", aspectRatio: "3 / 7", maxWidth: "100%" };

  return (
    <div className={`relative ${className}`} style={wrapperStyle} aria-hidden="true">
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
            "radial-gradient(50% 38% at 50% 28%, hsl(200 95% 60% / 0.5), hsl(220 95% 55% / 0.22) 50%, transparent 78%)",
          filter: "blur(34px)",
        }}
      />

      {/* ===== Orbital rings ===== */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 700" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="orbit-g" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(200 95% 65%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(200 95% 65%)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="hsl(180 95% 60%)" stopOpacity="0" />
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
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 700" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: 22 }).map((_, i) => {
          const x = 30 + (i * 17) % 240;
          const y = 50 + (i * 41) % 600;
          const dur = 3 + (i % 4);
          const r = 1 + (i % 3) * 0.5;
          return (
            <motion.circle
              key={i}
              cx={x} cy={y} r={r}
              fill={i % 2 ? "hsl(200 95% 70%)" : "hsl(180 95% 60%)"}
              initial={{ opacity: 0.15 }}
              animate={{ opacity: [0.12, excited ? 0.95 : 0.75, 0.12], y: [y, y - 14, y] }}
              transition={{ duration: dur, repeat: Infinity, ease: "easeInOut", delay: i * 0.16 }}
            />
          );
        })}
      </svg>

      {/* ===== Pedestal ===== */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 700" preserveAspectRatio="xMidYMid meet">
        <ellipse cx="150" cy="660" rx="100" ry="14" fill="hsl(200 95% 60% / 0.55)" filter="blur(6px)" />
        <ellipse cx="150" cy="666" rx="70" ry="6" fill="hsl(180 95% 65% / 0.7)" filter="blur(3px)" />
      </svg>

      {/* ===== MAIN CHARACTER ===== */}
      <motion.svg
        className="relative z-10 w-full h-full drop-shadow-[0_22px_45px_rgba(80,140,255,0.28)]"
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

          {/* HAIR — dark with subtle blue-grey highlights */}
          <linearGradient id="hair-base" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#2c2638" />
            <stop offset="60%" stopColor="#15101e" />
            <stop offset="100%" stopColor="#0a0612" />
          </linearGradient>
          <linearGradient id="hair-shine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9fb8d8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#2c2638" stopOpacity="0" />
          </linearGradient>

          {/* HOODIE — charcoal */}
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

          {/* WHITE TEE under hoodie */}
          <linearGradient id="tee" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e0e4ec" />
          </linearGradient>

          {/* JEANS — dark indigo */}
          <linearGradient id="jeans" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a2440" />
            <stop offset="100%" stopColor="#0a1228" />
          </linearGradient>
          <linearGradient id="jeans-shine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="50%" stopColor="#5b8aff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>

          {/* SNEAKERS — white with cyan + AWS-orange sole */}
          <linearGradient id="shoe-upper" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fafafa" />
            <stop offset="100%" stopColor="#dadde3" />
          </linearGradient>

          {/* HEADPHONES — matte black with cyan LED ring */}
          <linearGradient id="headphone-cup" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#23262e" />
            <stop offset="100%" stopColor="#0a0d12" />
          </linearGradient>

          {/* SMARTWATCH face */}
          <linearGradient id="watch-face" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0a0d18" />
            <stop offset="100%" stopColor="#1a2440" />
          </linearGradient>

          {/* GLASSES lens (subtle blue tint) */}
          <linearGradient id="lens" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a3c8ff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#5c8cff" stopOpacity="0.32" />
          </linearGradient>

          <radialGradient id="iris" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6c8db8" />
            <stop offset="100%" stopColor="#1a2540" />
          </radialGradient>

          <radialGradient id="body-glow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="hsl(200 95% 65% / 0.35)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          <filter id="soft-blur"><feGaussianBlur stdDeviation="1.5" /></filter>
        </defs>

        {/* Behind-body soft glow */}
        <ellipse cx="150" cy="360" rx="140" ry="220" fill="url(#body-glow)" filter="url(#soft-blur)" />

        {/* ===== LEGS — slim-fit dark indigo jeans ===== */}
        {/* Left leg */}
        <motion.g animate={{ x: [0, -1, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
          <path
            d="M 128 410
               Q 122 470 120 540
               Q 120 600 126 644
               L 142 644
               Q 144 600 142 540
               Q 142 470 144 410 Z"
            fill="url(#jeans)"
          />
          {/* Knee crease */}
          <path d="M 122 510 Q 132 515 142 510" stroke="#06091a" strokeWidth="0.6" fill="none" />
          {/* Side seam */}
          <path d="M 121 420 L 121 630" stroke="#3a5080" strokeWidth="0.4" opacity="0.5" />
          {/* Subtle highlight */}
          <path d="M 128 420 L 130 620" stroke="url(#jeans-shine)" strokeWidth="6" opacity="0.4" />
        </motion.g>
        {/* Right leg */}
        <motion.g animate={{ x: [0, 1, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}>
          <path
            d="M 156 410
               Q 156 470 158 540
               Q 158 600 152 644
               L 170 644
               Q 178 600 180 540
               Q 178 470 172 410 Z"
            fill="url(#jeans)"
          />
          <path d="M 156 510 Q 168 515 178 510" stroke="#06091a" strokeWidth="0.6" fill="none" />
          <path d="M 179 420 L 179 630" stroke="#3a5080" strokeWidth="0.4" opacity="0.5" />
          <path d="M 170 420 L 168 620" stroke="url(#jeans-shine)" strokeWidth="6" opacity="0.4" />
        </motion.g>

        {/* ===== SNEAKERS — modern high-top white with cyan + AWS-orange sole ===== */}
        <g>
          {/* Left sneaker */}
          <path d="M 114 640 Q 105 658 114 668 L 148 668 L 148 638 Q 130 636 114 640 Z" fill="url(#shoe-upper)" />
          {/* AWS-orange sole stripe */}
          <rect x="113" y="664" width="36" height="5" rx="2" fill="#FF9900" />
          {/* Cyan side accent */}
          <path d="M 122 650 Q 130 645 142 650" stroke="hsl(200 95% 60%)" strokeWidth="1.5" fill="none" />
          {/* Lace ghost */}
          <path d="M 122 644 L 142 644 M 122 652 L 142 652" stroke="#a0a4ad" strokeWidth="0.6" opacity="0.6" />

          {/* Right sneaker */}
          <path d="M 152 638 L 152 668 L 186 668 Q 195 658 186 640 Q 170 636 152 638 Z" fill="url(#shoe-upper)" />
          <rect x="151" y="664" width="36" height="5" rx="2" fill="#FF9900" />
          <path d="M 158 650 Q 168 645 178 650" stroke="hsl(200 95% 60%)" strokeWidth="1.5" fill="none" />
          <path d="M 158 644 L 178 644 M 158 652 L 178 652" stroke="#a0a4ad" strokeWidth="0.6" opacity="0.6" />
        </g>

        {/* ===== HIPS / waist ===== */}
        <path d="M 108 380 Q 150 412 192 380 L 192 415 Q 150 425 108 415 Z" fill="url(#jeans)" />
        <rect x="110" y="378" width="80" height="3" rx="1" fill="#0a0d18" />
        {/* Belt buckle */}
        <rect x="146" y="378" width="8" height="3" rx="0.5" fill="hsl(200 95% 60%)" />

        {/* ===== WHITE TEE peek (worn under open hoodie) ===== */}
        <path
          d="M 100 290 Q 150 280 200 290 L 200 405 L 100 405 Z"
          fill="url(#tee)"
        />
        {/* Cloud emblem on tee */}
        <g transform="translate(135, 340)">
          <path
            d="M 0 0 Q -4 -8 4 -10 Q 6 -16 14 -12 Q 22 -18 24 -8 Q 32 -6 26 2 L 0 2 Z"
            fill="hsl(200 95% 65%)"
          />
          <text x="13" y="14" fontSize="5" fontWeight="800" fill="#1f2433" textAnchor="middle">CLOUD</text>
        </g>

        {/* ===== OPEN ZIP-UP HOODIE (shows tee underneath in the gap) ===== */}
        {/* Left front panel */}
        <path
          d="M 86 410
             Q 86 280 116 245
             L 140 232
             Q 145 245 142 295
             L 116 410 Z"
          fill="url(#hoodie)"
        />
        {/* Right front panel */}
        <path
          d="M 214 410
             Q 214 280 184 245
             L 160 232
             Q 155 245 158 295
             L 184 410 Z"
          fill="url(#hoodie)"
        />
        {/* Hoodie inner lining (slightly darker fold along open edges) */}
        <path d="M 142 295 Q 144 350 140 405" stroke="#050810" strokeWidth="1" fill="none" opacity="0.7" />
        <path d="M 158 295 Q 156 350 160 405" stroke="#050810" strokeWidth="1" fill="none" opacity="0.7" />

        {/* Hood folded behind shoulders */}
        <path
          d="M 96 245 Q 110 220 150 215 Q 190 220 204 245 Q 200 240 150 232 Q 100 240 96 245 Z"
          fill="url(#hoodie-inner)"
        />

        {/* Pockets (kangaroo style, both sides) */}
        <path d="M 90 360 Q 110 370 120 380" stroke="#050810" strokeWidth="0.6" fill="none" />
        <path d="M 210 360 Q 190 370 180 380" stroke="#050810" strokeWidth="0.6" fill="none" />

        {/* Drawstrings dangling */}
        <path d="M 138 250 Q 134 285 132 320" stroke="#3a4055" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <path d="M 162 250 Q 166 285 168 320" stroke="#3a4055" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <circle cx="132" cy="322" r="2" fill="#3a4055" />
        <circle cx="168" cy="322" r="2" fill="#3a4055" />

        {/* Hoodie zipper teeth at the V */}
        {Array.from({ length: 7 }).map((_, i) => (
          <circle key={`zt-${i}`} cx="150" cy={250 + i * 6} r="0.7" fill="#5b6275" opacity="0.55" />
        ))}

        {/* Shoulder cyan trim accent */}
        <path d="M 90 270 Q 98 255 116 246" stroke="url(#trim)" strokeWidth="1.6" fill="none" />
        <path d="M 210 270 Q 202 255 184 246" stroke="url(#trim)" strokeWidth="1.6" fill="none" />

        {/* Streaming chest data lines on the tee */}
        <motion.path
          d="M 108 370 Q 150 362 192 370"
          stroke="hsl(200 80% 55%)" strokeWidth="0.7" fill="none" strokeDasharray="2 3"
          animate={{ strokeDashoffset: [0, -10] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          opacity="0.6"
        />

        {/* ===== ARMS — refined sleeves, hands with fingers ===== */}
        {/* LEFT arm */}
        <motion.g
          animate={leftHandRaised ? { rotate: -30, x: -2 } : { rotate: [0, -2, 0, 2, 0], x: 0 }}
          transition={leftHandRaised
            ? { type: "spring", stiffness: 130, damping: 16 }
            : { duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "92px 260px" }}
        >
          {/* Upper sleeve */}
          <path d="M 88 260 Q 70 290 65 340 Q 64 380 72 410 L 86 408 Q 82 380 84 340 Q 88 300 100 280 Z" fill="url(#hoodie)" />
          {/* Cuff trim */}
          <path d="M 72 408 Q 79 412 86 408" stroke="hsl(200 95% 65%)" strokeWidth="1.2" fill="none" opacity="0.85" />
          {/* Sleeve seam shading */}
          <path d="M 80 290 Q 78 340 76 400" stroke="#0a0d18" strokeWidth="0.5" fill="none" opacity="0.7" />

          {/* SMARTWATCH on left wrist */}
          <g transform="translate(74, 416)">
            <rect x="-9" y="-2" width="18" height="14" rx="3" fill="#1a1d28" />
            <rect x="-7" y="0" width="14" height="10" rx="1.5" fill="url(#watch-face)" />
            <motion.circle
              cx="0" cy="5" r="1.2"
              fill="hsl(200 95% 65%)"
              animate={{ opacity: (listening || speaking) ? [0.4, 1, 0.4] : [0.3, 0.5, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            {/* Strap */}
            <rect x="-9" y="-6" width="18" height="4" fill="#0a0d18" />
            <rect x="-9" y="12" width="18" height="4" fill="#0a0d18" />
          </g>

          {/* Hand */}
          <g>
            <ellipse cx="74" cy="436" rx="11" ry="10" fill="url(#skin-arm)" />
            {/* Fingers */}
            <path d="M 66 444 Q 64 454 68 458" stroke="#9c6f48" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 71 446 Q 69 456 73 460" stroke="#9c6f48" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 76 447 Q 75 457 79 460" stroke="#9c6f48" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 82 444 Q 84 454 80 458" stroke="#9c6f48" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 65 432 Q 59 428 62 424" stroke="#9c6f48" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        </motion.g>

        {/* RIGHT arm */}
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
            <ellipse cx="226" cy="436" rx="11" ry="10" fill="url(#skin-arm)" />
            <path d="M 234 444 Q 236 454 232 458" stroke="#9c6f48" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 229 446 Q 231 456 227 460" stroke="#9c6f48" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 224 447 Q 225 457 221 460" stroke="#9c6f48" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 218 444 Q 216 454 220 458" stroke="#9c6f48" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 235 432 Q 241 428 238 424" stroke="#9c6f48" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        </motion.g>

        {/* ===== NECK ===== */}
        <path d="M 134 215 Q 150 222 166 215 L 168 234 Q 150 240 132 234 Z" fill="url(#skin)" />

        {/* ===== HEADPHONES — over-ear, resting around neck ===== */}
        <g>
          {/* Connecting band behind neck */}
          <path d="M 110 232 Q 150 254 190 232" stroke="#23262e" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* Left earcup */}
          <g transform="translate(102, 232)">
            <ellipse cx="0" cy="0" rx="11" ry="13" fill="url(#headphone-cup)" />
            <ellipse cx="0" cy="0" rx="7" ry="9" fill="#0a0d12" />
            <motion.ellipse
              cx="0" cy="0" rx="9" ry="11"
              fill="none" stroke="hsl(200 95% 65%)" strokeWidth="1"
              animate={{ opacity: (listening || speaking) ? [0.5, 1, 0.5] : [0.45, 0.7, 0.45] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
          </g>
          {/* Right earcup */}
          <g transform="translate(198, 232)">
            <ellipse cx="0" cy="0" rx="11" ry="13" fill="url(#headphone-cup)" />
            <ellipse cx="0" cy="0" rx="7" ry="9" fill="#0a0d12" />
            <motion.ellipse
              cx="0" cy="0" rx="9" ry="11"
              fill="none" stroke="hsl(200 95% 65%)" strokeWidth="1"
              animate={{ opacity: (listening || speaking) ? [0.5, 1, 0.5] : [0.45, 0.7, 0.45] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            />
          </g>
        </g>

        {/* ===== HEAD (independent sway) ===== */}
        <motion.g animate={headControls} style={{ transformOrigin: "150px 175px" }}>
          {/* Back hair */}
          <path
            d="M 98 130 Q 90 60 150 50 Q 210 60 202 130 L 212 178 Q 150 200 88 178 Z"
            fill="url(#hair-base)"
          />

          {/* Face — slightly angular masculine */}
          <path
            d="M 102 132
               Q 102 80 150 75
               Q 198 80 198 132
               Q 198 178 180 200
               Q 165 215 150 215
               Q 135 215 120 200
               Q 102 178 102 132 Z"
            fill="url(#skin)"
          />

          {/* Jaw shading */}
          <path
            d="M 120 200 Q 135 213 150 215 Q 165 213 180 200"
            stroke="#b08456" strokeWidth="0.9" fill="none" opacity="0.45"
          />

          {/* Subtle cheek shading */}
          <ellipse cx="120" cy="170" rx="9" ry="6" fill="#e8b89a" opacity="0.4" />
          <ellipse cx="180" cy="170" rx="9" ry="6" fill="#e8b89a" opacity="0.4" />

          {/* Eyebrows — fuller, masculine */}
          <motion.path
            d="M 113 124 Q 128 118 142 124"
            stroke="#15101e" strokeWidth="3.5" fill="none" strokeLinecap="round"
            animate={{ y: browY }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }}
          />
          <motion.path
            d="M 158 124 Q 172 118 187 124"
            stroke="#15101e" strokeWidth="3.5" fill="none" strokeLinecap="round"
            animate={{ y: browY }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }}
          />

          {/* Eyelid shading above the lens area */}
          <path d="M 113 134 Q 128 132 142 134" stroke="#b08456" strokeWidth="0.5" fill="none" opacity="0.5" />
          <path d="M 158 134 Q 172 132 187 134" stroke="#b08456" strokeWidth="0.5" fill="none" opacity="0.5" />

          {/* EYES — slightly larger anime-stylized for charm */}
          <g>
            {/* Left eye */}
            <ellipse cx="125" cy="143" rx="8.5" ry={blink ? 0.6 : 5.5} fill="#fff" />
            {!blink && (
              <>
                <circle cx="125" cy="143" r="4.5" fill="url(#iris)" />
                <circle cx="125" cy="143" r="2" fill="#0a0a14" />
                {/* Catch-lights */}
                <circle cx="123.4" cy="141.5" r="1.2" fill="#fff" opacity="0.95" />
                <circle cx="126.5" cy="144" r="0.6" fill="#fff" opacity="0.65" />
              </>
            )}
            {/* Right eye */}
            <ellipse cx="175" cy="143" rx="8.5" ry={blink ? 0.6 : 5.5} fill="#fff" />
            {!blink && (
              <>
                <circle cx="175" cy="143" r="4.5" fill="url(#iris)" />
                <circle cx="175" cy="143" r="2" fill="#0a0a14" />
                <circle cx="173.4" cy="141.5" r="1.2" fill="#fff" opacity="0.95" />
                <circle cx="176.5" cy="144" r="0.6" fill="#fff" opacity="0.65" />
              </>
            )}
          </g>

          {/* Pupil emissive glow during listen/speak */}
          {(listening || speaking) && !blink && (
            <>
              <motion.circle
                cx="125" cy="143" r="2.2" fill="hsl(200 95% 70%)"
                initial={{ opacity: 0.3 }}
                animate={{ opacity: [0.25, 0.6, 0.25] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <motion.circle
                cx="175" cy="143" r="2.2" fill="hsl(200 95% 70%)"
                initial={{ opacity: 0.3 }}
                animate={{ opacity: [0.25, 0.6, 0.25] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            </>
          )}

          {/* ===== SPECTACLES — modern thin frames ===== */}
          <g>
            {/* Lens fills */}
            <rect x="109" y="132" width="34" height="24" rx="6" fill="url(#lens)" />
            <rect x="157" y="132" width="34" height="24" rx="6" fill="url(#lens)" />
            {/* Frame outlines */}
            <rect x="109" y="132" width="34" height="24" rx="6"
              fill="none" stroke="#0a0a14" strokeWidth="2.4" />
            <rect x="157" y="132" width="34" height="24" rx="6"
              fill="none" stroke="#0a0a14" strokeWidth="2.4" />
            {/* Bridge */}
            <path d="M 143 140 L 157 140" stroke="#0a0a14" strokeWidth="2.4" strokeLinecap="round" />
            {/* Temple arms going back toward ears */}
            <path d="M 109 140 L 96 147" stroke="#0a0a14" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M 191 140 L 204 147" stroke="#0a0a14" strokeWidth="2.2" strokeLinecap="round" />
            {/* Lens shine streaks */}
            <motion.path
              d="M 114 138 L 130 154"
              stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"
              initial={{ opacity: 0.4 }}
              animate={{ opacity: [0.25, 0.65, 0.25] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.path
              d="M 162 138 L 178 154"
              stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"
              initial={{ opacity: 0.4 }}
              animate={{ opacity: [0.25, 0.65, 0.25] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            />
            {/* Subtle cyan rim inner accent */}
            <rect x="109" y="132" width="34" height="24" rx="6"
              fill="none" stroke="hsl(200 95% 65%)" strokeWidth="0.5" opacity="0.55" />
            <rect x="157" y="132" width="34" height="24" rx="6"
              fill="none" stroke="hsl(200 95% 65%)" strokeWidth="0.5" opacity="0.55" />
          </g>

          {/* NOSE */}
          <path d="M 148 156 Q 145 173 150 181 Q 155 173 152 156" fill="#c5905d" opacity="0.4" />
          <ellipse cx="150" cy="183" rx="3" ry="1.2" fill="#9c6f48" opacity="0.45" />

          {/* MOUTH */}
          <motion.g
            animate={{ scaleY: speaking ? 1 + amplitude * 0.18 : 1 }}
            transition={{ duration: 0.04 }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <path
              d={`M ${150 - 12} 197 Q 150 ${197 + mouthCurve} ${150 + 12} 197 Q 150 ${197 + mouthOpen + 1} ${150 - 12} 197 Z`}
              fill="#7a4a3d"
            />
            <path
              d={`M ${150 - 12} 197 Q 150 195 ${150 + 12} 197`}
              stroke="#52302a" strokeWidth="1.2" fill="none" strokeLinecap="round"
            />
          </motion.g>

          {/* Subtle stubble */}
          <g opacity="0.18">
            {[124, 132, 140, 150, 160, 168, 176].map((x, i) => (
              <circle key={`s-${i}`} cx={x} cy={207 + (i % 2) * 2} r={0.7} fill="#15101e" />
            ))}
          </g>

          {/* ===== HAIR FRONT — layered modern quiff ===== */}
          {/* Base front shape */}
          <path
            d="M 98 130
               Q 105 70 150 65
               Q 195 70 202 130
               Q 195 88 178 84
               Q 158 80 146 92
               Q 132 84 118 98
               Q 108 96 98 130 Z"
            fill="url(#hair-base)"
          />
          {/* Volume on top (quiff lift) */}
          <path
            d="M 128 88 Q 145 65 165 80 Q 175 70 182 84 Q 168 78 158 86 Q 145 76 134 92 Z"
            fill="url(#hair-base)"
          />
          {/* Side bang sweeping right */}
          <path
            d="M 194 90 Q 212 110 210 145 Q 204 115 196 100 Z"
            fill="url(#hair-base)"
          />
          {/* Sideburn-ish lock by left ear */}
          <path
            d="M 100 130 Q 96 158 102 178 Q 99 156 102 132 Z"
            fill="url(#hair-base)"
          />
          {/* Sideburn right */}
          <path
            d="M 200 130 Q 204 158 198 178 Q 201 156 198 132 Z"
            fill="url(#hair-base)"
          />
          {/* Strand textures */}
          <path d="M 112 105 Q 128 88 148 96" stroke="#0a0612" strokeWidth="0.7" fill="none" opacity="0.55" />
          <path d="M 152 96 Q 170 84 190 102" stroke="#0a0612" strokeWidth="0.7" fill="none" opacity="0.55" />
          <path d="M 124 110 Q 138 96 156 108" stroke="#0a0612" strokeWidth="0.6" fill="none" opacity="0.5" />
          <path d="M 158 108 Q 175 96 188 116" stroke="#0a0612" strokeWidth="0.6" fill="none" opacity="0.5" />
          {/* Platinum-blue highlight strand */}
          <path
            d="M 140 88 Q 155 76 170 92"
            stroke="#9fb8d8" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.6"
          />
          {/* Top shine overlay (very subtle) */}
          <path
            d="M 110 95 Q 150 75 192 95 L 192 112 Q 150 90 110 112 Z"
            fill="url(#hair-shine)" opacity="0.65"
          />

          {/* Thinking dots above the glasses */}
          {thinking && (
            <g transform="translate(140, 116)">
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={i} cx={i * 5} cy={0} r={1.5}
                  fill="hsl(200 95% 70%)"
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                  transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </g>
          )}
        </motion.g>

        {/* Listening ripples from chest */}
        {listening && (
          <>
            <motion.circle
              cx="150" cy="330" r="6"
              fill="none" stroke="hsl(200 95% 65%)" strokeWidth="1.5"
              initial={{ r: 6, opacity: 1 }}
              animate={{ r: [6, 42], opacity: [1, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.circle
              cx="150" cy="330" r="6"
              fill="none" stroke="hsl(180 95% 70%)" strokeWidth="1.2"
              initial={{ r: 6, opacity: 1 }}
              animate={{ r: [6, 36], opacity: [1, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
            />
          </>
        )}
      </motion.svg>
    </div>
  );
}

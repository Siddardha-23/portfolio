/**
 * Avatar - "Aris", the Concierge.
 *
 * Stylized full-body MALE AI persona — fair skin, dark hair with a subtle
 * blue highlight, prominent rectangular spectacles, charcoal zip-up hoodie
 * with cyan trim, dark slacks, modern sneakers, and a small cloud emblem on
 * the chest that telegraphs the "cloud engineer" energy. Stands above a
 * soft holographic pedestal — he reads as a digital persona, not a real
 * person.
 *
 * Sizing: when `size` is provided the wrapper uses fixed width with a fixed
 * aspect ratio (good for the launcher and the mobile thumbnail). When
 * `size` is omitted the wrapper fills its parent's height and the SVG
 * scales to contain — so the head never clips inside the stage column.
 *
 * Animation layers (all GPU-accelerated):
 *  - Body float, independent head sway
 *  - Both arms counter-phase pendulum at rest, right hand raises when
 *    speaking, both hands lift when excited
 *  - Blink (every 3–5s), amplitude-driven mouth lipsync
 *  - Listening: aura pulse + cyan ring + eye glow + chest-mic ripples
 *  - Thinking: brow lift, slow tilt, spec-mounted streaming dots
 *  - Subtle leg lateral shift, glasses light glint
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

  // Wrapper sizing: explicit (launcher/widget) vs fill-parent (stage column).
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

      {/* ===== Orbital rings around upper body ===== */}
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
          return (
            <motion.circle
              key={i}
              cx={x} cy={y} r={1 + (i % 3) * 0.5}
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
        <ellipse cx="150" cy="660" rx="95" ry="14" fill="hsl(200 95% 60% / 0.55)" filter="blur(6px)" />
        <ellipse cx="150" cy="666" rx="60" ry="6" fill="hsl(180 95% 65% / 0.7)" filter="blur(3px)" />
      </svg>

      {/* ===== MAIN CHARACTER ===== */}
      <motion.svg
        className="relative z-10 w-full h-full drop-shadow-[0_22px_45px_rgba(80,140,255,0.28)]"
        viewBox="0 0 300 700"
        preserveAspectRatio="xMidYMid meet"
        animate={bodyControls}
      >
        <defs>
          {/* FAIR SKIN gradient — warm white, no magenta */}
          <radialGradient id="skin" cx="42%" cy="38%" r="80%">
            <stop offset="0%" stopColor="#fff5ec" />
            <stop offset="55%" stopColor="#f4ddc4" />
            <stop offset="100%" stopColor="#c99c70" />
          </radialGradient>
          <linearGradient id="skin-arm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f4ddc4" />
            <stop offset="100%" stopColor="#c99c70" />
          </linearGradient>

          {/* HAIR — dark with platinum-blue highlight */}
          <linearGradient id="hair-main" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="#3a3550" />
            <stop offset="60%" stopColor="#1f1a2e" />
            <stop offset="100%" stopColor="#0d0a1a" />
          </linearGradient>
          <linearGradient id="hair-highlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a3c0e8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3a3550" stopOpacity="0" />
          </linearGradient>

          {/* HOODIE — charcoal with cyan trim */}
          <linearGradient id="hoodie" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f2433" />
            <stop offset="100%" stopColor="#0d101a" />
          </linearGradient>
          <linearGradient id="hoodie-shine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="trim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(200 95% 60%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(200 95% 70%)" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(200 95% 60%)" stopOpacity="0" />
          </linearGradient>

          {/* INNER TEE */}
          <linearGradient id="tee" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a2f3d" />
            <stop offset="100%" stopColor="#1a1d28" />
          </linearGradient>

          {/* SLACKS / chinos */}
          <linearGradient id="slacks" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1c2030" />
            <stop offset="100%" stopColor="#0a0d18" />
          </linearGradient>

          {/* SNEAKERS — modern, white sole */}
          <linearGradient id="shoe-upper" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f2433" />
            <stop offset="100%" stopColor="#0d101a" />
          </linearGradient>

          {/* GLASSES lens tint */}
          <linearGradient id="lens" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a3c8ff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#5c8cff" stopOpacity="0.32" />
          </linearGradient>

          {/* Iris (subtle, no holographic burn) */}
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

        {/* ===== LEGS ===== */}
        <motion.g animate={{ x: [0, -1, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
          <path
            d="M 130 410 Q 124 460 122 530 Q 122 595 128 640 L 142 640 Q 144 595 142 530 Q 142 460 145 410 Z"
            fill="url(#slacks)"
          />
          <path d="M 124 510 Q 134 514 144 510" stroke="#06091a" strokeWidth="0.6" fill="none" />
        </motion.g>
        <motion.g animate={{ x: [0, 1, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}>
          <path
            d="M 155 410 Q 156 460 158 530 Q 158 595 152 640 L 168 640 Q 174 595 178 530 Q 176 460 170 410 Z"
            fill="url(#slacks)"
          />
          <path d="M 156 510 Q 166 514 176 510" stroke="#06091a" strokeWidth="0.6" fill="none" />
        </motion.g>

        {/* ===== SNEAKERS ===== */}
        <g>
          {/* Left shoe */}
          <path d="M 116 640 Q 110 654 116 660 L 148 660 L 148 640 Z" fill="url(#shoe-upper)" />
          <rect x="115" y="658" width="34" height="4" rx="1.5" fill="#f5f5f5" />
          {/* Right shoe */}
          <path d="M 152 640 L 152 660 L 184 660 Q 190 654 184 640 Z" fill="url(#shoe-upper)" />
          <rect x="152" y="658" width="33" height="4" rx="1.5" fill="#f5f5f5" />
          {/* Sneaker accent stripes */}
          <path d="M 124 648 Q 132 644 142 648" stroke="hsl(200 95% 65%)" strokeWidth="1.2" fill="none" />
          <path d="M 158 648 Q 168 644 178 648" stroke="hsl(200 95% 65%)" strokeWidth="1.2" fill="none" />
        </g>

        {/* ===== HIPS ===== */}
        <path d="M 108 380 Q 150 412 192 380 L 192 415 Q 150 425 108 415 Z" fill="url(#slacks)" />
        <rect x="110" y="378" width="80" height="4" rx="1" fill="#0a0d18" />

        {/* ===== HOODIE TORSO ===== */}
        <path
          d="M 86 410 Q 86 280 116 240 L 138 232 Q 150 236 162 232 L 184 240 Q 214 280 214 410 Z"
          fill="url(#hoodie)"
        />
        {/* Chest shine */}
        <path
          d="M 86 280 Q 150 260 214 280 L 214 340 Q 150 320 86 340 Z"
          fill="url(#hoodie-shine)" opacity="0.6"
        />
        {/* Zipper */}
        <line x1="150" y1="240" x2="150" y2="408" stroke="#3a4055" strokeWidth="1.5" />
        <line x1="150" y1="240" x2="150" y2="408" stroke="hsl(200 95% 65% / 0.45)" strokeWidth="0.6" />
        {/* Zipper teeth dots */}
        {Array.from({ length: 14 }).map((_, i) => (
          <circle key={i} cx="150" cy={246 + i * 12} r="0.7" fill="#5b6275" />
        ))}
        {/* Zipper pull */}
        <rect x="146" y="406" width="8" height="6" rx="1" fill="#5b6275" />

        {/* Hoodie inner collar / fold */}
        <path
          d="M 128 248 Q 150 258 172 248 L 168 232 Q 150 240 132 232 Z"
          fill="#0a0d18"
        />
        {/* Tee peek (V at neck) */}
        <path
          d="M 138 244 Q 150 250 162 244 L 158 232 Q 150 236 142 232 Z"
          fill="url(#tee)"
        />

        {/* Drawstrings */}
        <path d="M 138 246 Q 132 280 134 320" stroke="#3a4055" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M 162 246 Q 168 280 166 320" stroke="#3a4055" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <circle cx="134" cy="322" r="1.8" fill="#3a4055" />
        <circle cx="166" cy="322" r="1.8" fill="#3a4055" />

        {/* Cloud emblem on chest (left side from viewer) */}
        <g transform="translate(100, 320)">
          <path
            d="M 0 0 Q -4 -6 2 -8 Q 4 -14 10 -10 Q 16 -14 16 -6 Q 22 -4 18 2 L 0 2 Z"
            fill="hsl(200 95% 65%)" opacity="0.85"
          />
          <text x="9" y="14" fontSize="4" fontWeight="700" fill="hsl(200 95% 75%)" textAnchor="middle">CLOUD</text>
        </g>

        {/* Shoulder cyan trim */}
        <path d="M 92 282 Q 98 262 114 252" stroke="url(#trim)" strokeWidth="1.4" fill="none" />
        <path d="M 208 282 Q 202 262 186 252" stroke="url(#trim)" strokeWidth="1.4" fill="none" />

        {/* Streaming chest data lines */}
        <motion.path
          d="M 100 360 Q 150 352 200 360"
          stroke="hsl(200 95% 65%)" strokeWidth="0.7" fill="none" strokeDasharray="2 3"
          animate={{ strokeDashoffset: [0, -10] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          opacity="0.7"
        />

        {/* ===== ARMS — both visible, with hands ===== */}
        <motion.g
          animate={leftHandRaised ? { rotate: -30, x: -2 } : { rotate: [0, -2, 0, 2, 0], x: 0 }}
          transition={leftHandRaised
            ? { type: "spring", stiffness: 130, damping: 16 }
            : { duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "92px 260px" }}
        >
          <path d="M 88 260 Q 70 290 65 340 Q 64 380 72 410 L 86 408 Q 82 380 84 340 Q 88 300 100 280 Z" fill="url(#hoodie)" />
          <path d="M 72 405 Q 80 410 86 408" stroke="hsl(200 95% 65%)" strokeWidth="1" fill="none" opacity="0.85" />
          <g>
            <ellipse cx="74" cy="424" rx="11" ry="10" fill="url(#skin-arm)" />
            <path d="M 66 432 Q 64 442 68 446" stroke="#a07349" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 71 434 Q 69 444 73 448" stroke="#a07349" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 76 435 Q 75 445 79 448" stroke="#a07349" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 82 432 Q 84 442 80 446" stroke="#a07349" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 65 420 Q 59 416 62 412" stroke="#a07349" strokeWidth="2" fill="none" strokeLinecap="round" />
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
          <path d="M 228 405 Q 220 410 214 408" stroke="hsl(200 95% 65%)" strokeWidth="1" fill="none" opacity="0.85" />
          <g>
            <ellipse cx="226" cy="424" rx="11" ry="10" fill="url(#skin-arm)" />
            <path d="M 234 432 Q 236 442 232 446" stroke="#a07349" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 229 434 Q 231 444 227 448" stroke="#a07349" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 224 435 Q 225 445 221 448" stroke="#a07349" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 218 432 Q 216 442 220 446" stroke="#a07349" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 235 420 Q 241 416 238 412" stroke="#a07349" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        </motion.g>

        {/* ===== NECK ===== */}
        <path d="M 134 215 Q 150 222 166 215 L 168 232 Q 150 237 132 232 Z" fill="url(#skin)" />
        <path d="M 134 232 Q 150 237 166 232" stroke="#a07349" strokeWidth="0.6" fill="none" opacity="0.5" />

        {/* ===== HEAD ===== */}
        <motion.g animate={headControls} style={{ transformOrigin: "150px 175px" }}>
          {/* Back hair — short masculine cut */}
          <path
            d="M 100 130 Q 95 65 150 58 Q 205 65 200 130 L 208 180 Q 150 200 92 180 Z"
            fill="url(#hair-main)"
          />

          {/* Face — slightly more angular than the round earlier design */}
          <path
            d="M 102 130
               Q 102 80 150 76
               Q 198 80 198 130
               Q 198 175 180 200
               Q 165 215 150 215
               Q 135 215 120 200
               Q 102 175 102 130 Z"
            fill="url(#skin)"
          />

          {/* Jaw definition — subtle shadow */}
          <path
            d="M 120 200 Q 135 213 150 215 Q 165 213 180 200"
            stroke="#c99c70" strokeWidth="0.8" fill="none" opacity="0.4"
          />

          {/* Cheek shading (no pink bloom — subtle warmth only) */}
          <ellipse cx="120" cy="170" rx="9" ry="6" fill="#e8b89a" opacity="0.4" />
          <ellipse cx="180" cy="170" rx="9" ry="6" fill="#e8b89a" opacity="0.4" />

          {/* Eyebrows — fuller, masculine */}
          <motion.path
            d="M 114 124 Q 128 119 142 124"
            stroke="#1f1a2e" strokeWidth="3.5" fill="none" strokeLinecap="round"
            animate={{ y: browY }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }}
          />
          <motion.path
            d="M 158 124 Q 172 119 186 124"
            stroke="#1f1a2e" strokeWidth="3.5" fill="none" strokeLinecap="round"
            animate={{ y: browY }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }}
          />

          {/* EYES — slightly smaller for masculine proportion */}
          <g>
            {/* Left eye sclera */}
            <ellipse cx="125" cy="142" rx="8" ry={blink ? 0.5 : 5} fill="#fff" />
            {!blink && (
              <>
                <circle cx="125" cy="142" r="4" fill="url(#iris)" />
                <circle cx="125" cy="142" r="1.8" fill="#0a0a14" />
                <circle cx="123.7" cy="140.5" r="1" fill="#fff" opacity="0.95" />
              </>
            )}
            {/* Right eye sclera */}
            <ellipse cx="175" cy="142" rx="8" ry={blink ? 0.5 : 5} fill="#fff" />
            {!blink && (
              <>
                <circle cx="175" cy="142" r="4" fill="url(#iris)" />
                <circle cx="175" cy="142" r="1.8" fill="#0a0a14" />
                <circle cx="173.7" cy="140.5" r="1" fill="#fff" opacity="0.95" />
              </>
            )}
          </g>

          {/* Pupil glow during listen/speak (subtle, not overpowering) */}
          {(listening || speaking) && !blink && (
            <>
              <motion.circle cx="125" cy="142" r="2" fill="hsl(200 95% 70%)"
                animate={{ opacity: [0.2, 0.55, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity }} />
              <motion.circle cx="175" cy="142" r="2" fill="hsl(200 95% 70%)"
                animate={{ opacity: [0.2, 0.55, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity }} />
            </>
          )}

          {/* ===== COOL SPECTACLES — prominent rectangular frames ===== */}
          <g>
            {/* Left lens */}
            <rect x="110" y="132" width="32" height="22" rx="5"
              fill="url(#lens)" stroke="#0a0a14" strokeWidth="2.2" />
            {/* Right lens */}
            <rect x="158" y="132" width="32" height="22" rx="5"
              fill="url(#lens)" stroke="#0a0a14" strokeWidth="2.2" />
            {/* Bridge */}
            <path d="M 142 138 L 158 138" stroke="#0a0a14" strokeWidth="2.2" strokeLinecap="round" />
            {/* Temple arms */}
            <path d="M 110 140 L 100 145" stroke="#0a0a14" strokeWidth="2" strokeLinecap="round" />
            <path d="M 190 140 L 200 145" stroke="#0a0a14" strokeWidth="2" strokeLinecap="round" />
            {/* Lens shine streak */}
            <motion.path
              d="M 116 138 L 132 152"
              stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.5"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.path
              d="M 164 138 L 180 152"
              stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.5"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            />
            {/* Subtle cyan rim accent (tech glasses feel) */}
            <rect x="110" y="132" width="32" height="22" rx="5"
              fill="none" stroke="hsl(200 95% 65%)" strokeWidth="0.5" opacity="0.6" />
            <rect x="158" y="132" width="32" height="22" rx="5"
              fill="none" stroke="hsl(200 95% 65%)" strokeWidth="0.5" opacity="0.6" />
          </g>

          {/* NOSE */}
          <path d="M 148 154 Q 145 170 150 178 Q 155 170 152 154" fill="#c99c70" opacity="0.4" />
          <ellipse cx="150" cy="180" rx="3" ry="1" fill="#a07349" opacity="0.45" />

          {/* MOUTH — masculine, less curvy */}
          <motion.g
            animate={{ scaleY: speaking ? 1 + amplitude * 0.18 : 1 }}
            transition={{ duration: 0.04 }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <path
              d={`M ${150 - 12} 195 Q 150 ${195 + mouthCurve} ${150 + 12} 195 Q 150 ${195 + mouthOpen + 1} ${150 - 12} 195 Z`}
              fill="#7a4a3d"
            />
            <path
              d={`M ${150 - 12} 195 Q 150 193 ${150 + 12} 195`}
              stroke="#52302a" strokeWidth="1.2" fill="none" strokeLinecap="round"
            />
          </motion.g>

          {/* SUBTLE STUBBLE — small dots near jaw */}
          <g opacity="0.18">
            {[124, 132, 140, 150, 160, 168, 176].map((x, i) => (
              <circle key={i} cx={x} cy={205 + (i % 2) * 2} r="0.7" fill="#1f1a2e" />
            ))}
          </g>

          {/* HAIR FRONT — short, modern, swept-up quiff */}
          <path
            d="M 100 130 Q 105 75 150 70 Q 195 75 200 130
               Q 195 90 175 86 Q 155 80 145 92 Q 132 84 118 96 Q 108 96 100 130 Z"
            fill="url(#hair-main)"
          />
          {/* Front quiff volume */}
          <path
            d="M 130 90 Q 145 70 162 85 Q 150 78 138 88 Z"
            fill="url(#hair-main)"
          />
          {/* Platinum-blue highlight strand */}
          <path
            d="M 140 88 Q 155 78 168 92"
            stroke="#a3c0e8" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.55"
          />
          {/* Hair texture lines */}
          <path d="M 115 100 Q 130 85 148 95" stroke="#0d0a1a" strokeWidth="0.6" fill="none" opacity="0.5" />
          <path d="M 155 95 Q 170 82 190 100" stroke="#0d0a1a" strokeWidth="0.6" fill="none" opacity="0.5" />
          {/* Side bang / hair flow */}
          <path
            d="M 195 90 Q 210 110 208 145 Q 202 115 196 100 Z"
            fill="url(#hair-main)"
          />
          {/* Hair-highlight overlay (very subtle blue gleam on top) */}
          <path
            d="M 110 95 Q 150 75 190 95 L 190 110 Q 150 90 110 110 Z"
            fill="url(#hair-highlight)" opacity="0.7"
          />

          {/* Thinking dots above glasses */}
          {thinking && (
            <g transform="translate(140, 116)">
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={i} cx={i * 5} cy={0} r={1.5}
                  fill="hsl(200 95% 70%)"
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
              cx="150" cy="330" r="6" fill="none" stroke="hsl(200 95% 65%)" strokeWidth="1.5"
              animate={{ r: [6, 42], opacity: [1, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.circle
              cx="150" cy="330" r="6" fill="none" stroke="hsl(180 95% 70%)" strokeWidth="1.2"
              animate={{ r: [6, 36], opacity: [1, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
            />
          </>
        )}
      </motion.svg>
    </div>
  );
}

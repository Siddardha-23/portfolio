/**
 * Avatar - Premium stylized 2D character for The Concierge.
 *
 * A vector portrait that nods to Harshith's look (dark hair + beard + slim
 * glasses) without going uncanny. It blinks, breathes, raises an eyebrow when
 * thinking, smiles when happy, and lipsyncs from an external amplitude signal
 * (0..1) provided by the TTS hook.
 *
 * Design choices:
 *  - SVG over canvas: crisp at any size, accessible, themeable via CSS.
 *  - Layered groups (skull → hair-back → face → beard → glasses → hair-front
 *    → mouth) so layering reads correctly on any background.
 *  - Lipsync = jaw open (mouth height scales) + lip width modulation, driven
 *    by amplitude. Cheap, convincing.
 */
import { useEffect, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";

export type AvatarEmotion = "neutral" | "happy" | "thoughtful" | "excited" | "listening";
export type AvatarState = "idle" | "listening" | "thinking" | "speaking";

interface AvatarProps {
  /** External 0..1 amplitude for mouth animation while speaking. */
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
  size = 220,
  className = "",
}: AvatarProps) {
  const [blink, setBlink] = useState(false);

  // Auto-blink every 3-5s — keeps the character alive.
  useEffect(() => {
    let cancelled = false;
    const loop = () => {
      const delay = 2500 + Math.random() * 2500;
      setTimeout(() => {
        if (cancelled) return;
        setBlink(true);
        setTimeout(() => !cancelled && setBlink(false), 120);
        loop();
      }, delay);
    };
    loop();
    return () => {
      cancelled = true;
    };
  }, []);

  // Smile curve based on emotion
  const smile =
    emotion === "happy" || emotion === "excited"
      ? 14
      : emotion === "thoughtful"
        ? -2
        : 6;

  // Eyebrow lift for thinking
  const browLift = emotion === "thoughtful" ? -4 : emotion === "excited" ? -6 : 0;

  // Mouth: width and openness from amplitude (when speaking) or smile (idle)
  const speaking = state === "speaking";
  const mouthOpen = speaking ? Math.max(2, amplitude * 22) : 2.5;
  const mouthWidth = speaking ? 28 + amplitude * 8 : 28 + smile * 0.4;
  const lipCurve = speaking ? Math.min(8, 3 + amplitude * 10) : smile;

  // Subtle head bob & breathing
  const breathControls = useAnimationControls();
  useEffect(() => {
    breathControls.start({
      y: [0, -2, 0],
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
    });
  }, [breathControls]);

  // Listening ring (pulsing aura)
  const isListening = state === "listening";
  const isThinking = state === "thinking";

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Outer aura — pulses on listening, slow swirl on thinking */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={
          isListening
            ? { scale: [1, 1.08, 1], opacity: [0.45, 0.75, 0.45] }
            : isThinking
              ? { rotate: 360, opacity: [0.4, 0.6, 0.4] }
              : { scale: [1, 1.02, 1], opacity: [0.35, 0.5, 0.35] }
        }
        transition={{
          duration: isListening ? 1.4 : isThinking ? 6 : 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          background:
            "radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.45), hsl(var(--primary) / 0) 65%)",
          filter: "blur(8px)",
        }}
      />

      {/* Inner glow ring */}
      <div
        className="absolute inset-2 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 25%, hsl(var(--primary) / 0.25), transparent 70%)",
        }}
      />

      <motion.svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className="relative z-10 drop-shadow-xl"
        animate={breathControls}
      >
        <defs>
          {/* Skin gradient */}
          <radialGradient id="cg-skin" cx="45%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#f3c8a1" />
            <stop offset="55%" stopColor="#d59a73" />
            <stop offset="100%" stopColor="#a36b48" />
          </radialGradient>
          {/* Hair gradient — deep almost-black with a warm highlight */}
          <linearGradient id="cg-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a1d14" />
            <stop offset="100%" stopColor="#171012" />
          </linearGradient>
          {/* Beard gradient */}
          <linearGradient id="cg-beard" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a1f17" />
            <stop offset="100%" stopColor="#13090a" />
          </linearGradient>
          {/* Shirt gradient */}
          <linearGradient id="cg-shirt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.95" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
          </linearGradient>
          {/* Glasses lens tint */}
          <linearGradient id="cg-lens" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0b1220" stopOpacity="0.78" />
            <stop offset="100%" stopColor="#0b1220" stopOpacity="0.55" />
          </linearGradient>
          {/* Drop shadow under chin */}
          <filter id="cg-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        {/* Neck + shoulders / shirt */}
        <path
          d="M 60 188 Q 100 158 140 188 L 145 200 L 55 200 Z"
          fill="url(#cg-shirt)"
        />
        <path
          d="M 78 168 Q 100 178 122 168 L 122 182 Q 100 192 78 182 Z"
          fill="#1a0f17"
          opacity="0.6"
        />

        {/* Back of head / hair silhouette */}
        <path
          d="M 56 80 Q 50 30 100 28 Q 150 30 144 80 L 148 132 Q 100 158 52 132 Z"
          fill="url(#cg-hair)"
        />

        {/* Face oval */}
        <ellipse
          cx="100" cy="98" rx="42" ry="50"
          fill="url(#cg-skin)"
        />
        {/* Cheek subtle warmth */}
        <ellipse cx="80" cy="115" rx="8" ry="5" fill="#d77a5a" opacity="0.25" />
        <ellipse cx="120" cy="115" rx="8" ry="5" fill="#d77a5a" opacity="0.25" />

        {/* Beard (full, well-groomed) */}
        <path
          d="M 64 108 Q 70 150 100 158 Q 130 150 136 108
             Q 132 138 100 144 Q 68 138 64 108 Z"
          fill="url(#cg-beard)"
        />
        {/* Mustache */}
        <path
          d="M 80 118 Q 100 124 120 118 Q 116 125 100 126 Q 84 125 80 118 Z"
          fill="url(#cg-beard)"
        />
        {/* Sideburns */}
        <path d="M 60 92 Q 64 110 70 118 L 64 118 Q 58 105 60 92 Z" fill="url(#cg-beard)" />
        <path d="M 140 92 Q 136 110 130 118 L 136 118 Q 142 105 140 92 Z" fill="url(#cg-beard)" />

        {/* Eyebrows */}
        <motion.path
          d="M 70 80 Q 80 76 90 80"
          stroke="#1a0f0a"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          animate={{ y: browLift }}
          transition={{ type: "spring", stiffness: 180, damping: 14 }}
        />
        <motion.path
          d="M 110 80 Q 120 76 130 80"
          stroke="#1a0f0a"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          animate={{ y: browLift }}
          transition={{ type: "spring", stiffness: 180, damping: 14 }}
        />

        {/* Eyes (behind glasses — visible) */}
        <g>
          {/* Left eye */}
          <ellipse cx="80" cy="92" rx="5" ry={blink ? 0.5 : 3.2} fill="#fff" />
          <circle cx="80" cy="92" r={blink ? 0 : 2} fill="#2c1810" />
          {/* Right eye */}
          <ellipse cx="120" cy="92" rx="5" ry={blink ? 0.5 : 3.2} fill="#fff" />
          <circle cx="120" cy="92" r={blink ? 0 : 2} fill="#2c1810" />
        </g>

        {/* Glasses — slim modern wire frames */}
        <g stroke="#1a1a1a" strokeWidth="1.6" fill="none" strokeLinecap="round">
          {/* Lenses */}
          <rect x="66" y="83" width="28" height="18" rx="6" fill="url(#cg-lens)" opacity="0.32" />
          <rect x="66" y="83" width="28" height="18" rx="6" />
          <rect x="106" y="83" width="28" height="18" rx="6" fill="url(#cg-lens)" opacity="0.32" />
          <rect x="106" y="83" width="28" height="18" rx="6" />
          {/* Bridge */}
          <path d="M 94 90 L 106 90" />
          {/* Temples */}
          <path d="M 66 88 L 58 92" />
          <path d="M 134 88 L 142 92" />
        </g>

        {/* Nose */}
        <path d="M 100 96 Q 96 110 100 116 Q 104 110 100 96" fill="#a36b48" opacity="0.5" />
        <ellipse cx="100" cy="117" rx="3" ry="1.5" fill="#7a4a30" opacity="0.4" />

        {/* Mouth — driven by amplitude (lipsync) */}
        <motion.g
          animate={{ scaleY: speaking ? 1 + amplitude * 0.15 : 1 }}
          transition={{ duration: 0.04 }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          {/* Lower lip (the surface that moves with jaw) */}
          <motion.path
            d={`M ${100 - mouthWidth / 2} 134
                Q 100 ${134 + lipCurve} ${100 + mouthWidth / 2} 134
                Q 100 ${134 + mouthOpen} ${100 - mouthWidth / 2} 134 Z`}
            fill="#5a1f1a"
          />
          {/* Upper lip line */}
          <path
            d={`M ${100 - mouthWidth / 2} 134 Q 100 132 ${100 + mouthWidth / 2} 134`}
            stroke="#3a1410"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
          />
        </motion.g>

        {/* Forehead highlight for dimension */}
        <ellipse cx="95" cy="62" rx="20" ry="8" fill="#fff" opacity="0.07" />

        {/* Hair-front strands sweeping right (gives the look character) */}
        <path
          d="M 64 70 Q 80 38 110 36 Q 138 40 144 70 Q 138 56 120 54 Q 96 58 86 70 Q 76 64 64 70 Z"
          fill="url(#cg-hair)"
        />
      </motion.svg>

      {/* Status ring overlays */}
      {isListening && (
        <motion.div
          className="absolute -inset-1 rounded-full pointer-events-none"
          style={{ border: "2px solid hsl(var(--primary))" }}
          animate={{ scale: [1, 1.12, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      )}
      {isThinking && (
        <div className="absolute bottom-2 right-2 flex gap-1 z-20">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary"
              animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

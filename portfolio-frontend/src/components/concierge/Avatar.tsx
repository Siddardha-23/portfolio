/**
 * Avatar - "Nimbus", the Concierge.
 *
 * 3D-cartoon style (Pixar/Disney-inspired) male character based on the
 * user's reference image: warm brown wavy quiff, big expressive brown
 * eyes with strong catch lights, rosy cheek bloom, open friendly smile,
 * strong but soft jawline. Charcoal hoodie + white tee with a small
 * CLOUD emblem signals the cloud-engineer identity without overpowering
 * the friendliness.
 *
 * Sizing: when `size` is provided the wrapper is fixed-width with locked
 * aspect; when omitted the wrapper fills the parent's height and the SVG
 * scales to contain — the head never clips.
 *
 * "Game-level" animation layers:
 *   - Body float + subtle weight-shift swap between feet
 *   - Independent head sway, with occasional 4° "look" tilt
 *   - Eye darting — pupils drift left/right every 4-6s
 *   - Blink (every 3-5s)
 *   - Smile width pulse on speak (mouth wider when amplitude peaks)
 *   - Mouth lipsync — amplitude-driven jaw + lip curve
 *   - Counter-phase arm pendulum; right hand raises while speaking,
 *     both lift on excited
 *   - Hair tip sway (top quiff bobs slightly with body float)
 *   - Listening: aura pulse + chest ripples + pupil glow
 *   - Thinking: brow lift + head tilt + streaming thinking dots
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
  size,
  className = "",
}: AvatarProps) {
  const [blink, setBlink] = useState(false);
  const [eyeDrift, setEyeDrift] = useState({ x: 0, y: 0 });

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

  // Eye darting — pupils occasionally drift to feel alive
  useEffect(() => {
    let cancelled = false;
    const loop = () => {
      const delay = 3500 + Math.random() * 3500;
      setTimeout(() => {
        if (cancelled) return;
        // Random direction, small magnitude
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

  const speaking = state === "speaking";
  const listening = state === "listening";
  const thinking = state === "thinking";
  const excited = emotion === "excited";

  // Smile / mouth shape — wider when excited, opens with amplitude when speaking
  const baseSmile = emotion === "happy" || emotion === "excited" ? 6
    : emotion === "thoughtful" ? 1 : 4;
  const mouthOpen = speaking ? Math.max(1.5, amplitude * 11) : 1.5;
  const mouthCurve = speaking ? Math.min(8, baseSmile + amplitude * 6) : baseSmile;
  const mouthWidth = speaking ? 16 + amplitude * 3 : 16;

  const browY = thinking ? -3 : excited ? -4 : 0;

  // Body float
  const bodyControls = useAnimationControls();
  useEffect(() => {
    bodyControls.start({
      y: [0, -5, 0],
      transition: { duration: 5, repeat: Infinity, ease: "easeInOut" },
    });
  }, [bodyControls]);

  // Head sway — bigger arc during speaking (game-style emphasis)
  const headControls = useAnimationControls();
  useEffect(() => {
    const amp = speaking ? 3 : thinking ? 4 : 1.5;
    const dur = speaking ? 2.8 : thinking ? 4 : 6;
    headControls.start({
      rotate: speaking ? [0, amp, 0, -amp, 0] : thinking ? [-2, -amp, -2] : [-amp, amp, -amp],
      transition: { duration: dur, repeat: Infinity, ease: "easeInOut" },
    });
  }, [headControls, speaking, thinking]);

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
            "radial-gradient(50% 38% at 50% 28%, hsl(35 95% 70% / 0.45), hsl(15 95% 65% / 0.22) 50%, transparent 78%)",
          filter: "blur(34px)",
        }}
      />

      {/* ===== Orbital rings ===== */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 700" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="orbit-g" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(35 95% 65%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(35 95% 65%)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="hsl(195 95% 60%)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.ellipse
          cx="150" cy="150" rx="118" ry="34"
          fill="none" stroke="url(#orbit-g)" strokeWidth="1.3"
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "150px 150px" }}
        />
      </svg>

      {/* ===== Particle field ===== */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 700" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: 20 }).map((_, i) => {
          const x = 30 + (i * 17) % 240;
          const y = 50 + (i * 41) % 600;
          const dur = 3 + (i % 4);
          const r = 1 + (i % 3) * 0.5;
          return (
            <motion.circle
              key={i}
              cx={x} cy={y} r={r}
              fill={i % 2 ? "hsl(35 95% 70%)" : "hsl(195 95% 65%)"}
              initial={{ opacity: 0.15 }}
              animate={{ opacity: [0.12, excited ? 0.95 : 0.7, 0.12], y: [y, y - 14, y] }}
              transition={{ duration: dur, repeat: Infinity, ease: "easeInOut", delay: i * 0.16 }}
            />
          );
        })}
      </svg>

      {/* ===== Pedestal ===== */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 700" preserveAspectRatio="xMidYMid meet">
        <ellipse cx="150" cy="660" rx="100" ry="14" fill="hsl(35 95% 60% / 0.5)" filter="blur(6px)" />
        <ellipse cx="150" cy="666" rx="70" ry="6" fill="hsl(195 95% 65% / 0.65)" filter="blur(3px)" />
      </svg>

      {/* ===== MAIN CHARACTER ===== */}
      <motion.svg
        className="relative z-10 w-full h-full drop-shadow-[0_22px_45px_rgba(255,140,80,0.28)]"
        viewBox="0 0 300 700"
        preserveAspectRatio="xMidYMid meet"
        animate={bodyControls}
      >
        <defs>
          {/* SKIN — warm fair, Pixar-style render */}
          <radialGradient id="skin" cx="42%" cy="36%" r="80%">
            <stop offset="0%" stopColor="#fff0e4" />
            <stop offset="55%" stopColor="#f5cca3" />
            <stop offset="100%" stopColor="#b87a4a" />
          </radialGradient>
          <linearGradient id="skin-arm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5cca3" />
            <stop offset="100%" stopColor="#b87a4a" />
          </linearGradient>

          {/* HAIR — warm chocolate brown */}
          <linearGradient id="hair-base" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="#6b4023" />
            <stop offset="60%" stopColor="#3d2412" />
            <stop offset="100%" stopColor="#221206" />
          </linearGradient>
          <linearGradient id="hair-shine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d49b66" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#6b4023" stopOpacity="0" />
          </linearGradient>

          {/* CHEEK BLOOM — Pixar-style rosy */}
          <radialGradient id="cheek" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff8a7a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ff8a7a" stopOpacity="0" />
          </radialGradient>

          {/* HOODIE — charcoal */}
          <linearGradient id="hoodie" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#262b3a" />
            <stop offset="100%" stopColor="#10131c" />
          </linearGradient>
          <linearGradient id="hoodie-shine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="trim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(195 95% 60%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(195 95% 70%)" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(195 95% 60%)" stopOpacity="0" />
          </linearGradient>

          {/* WHITE TEE */}
          <linearGradient id="tee" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#dde2e8" />
          </linearGradient>

          {/* JEANS — dark indigo */}
          <linearGradient id="jeans" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a2440" />
            <stop offset="100%" stopColor="#0a1228" />
          </linearGradient>

          {/* SNEAKERS — white + AWS orange sole */}
          <linearGradient id="shoe-upper" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fafafa" />
            <stop offset="100%" stopColor="#dadde3" />
          </linearGradient>

          {/* Iris — warm brown like the reference */}
          <radialGradient id="iris" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#9b6b40" />
            <stop offset="100%" stopColor="#3a1f0a" />
          </radialGradient>

          <radialGradient id="body-glow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="hsl(35 95% 65% / 0.3)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          <filter id="soft-blur"><feGaussianBlur stdDeviation="1.5" /></filter>
        </defs>

        {/* Behind-body soft glow */}
        <ellipse cx="150" cy="360" rx="140" ry="220" fill="url(#body-glow)" filter="url(#soft-blur)" />

        {/* ===== LEGS ===== */}
        <motion.g animate={{ x: [0, -1, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
          <path d="M 128 410 Q 122 470 120 540 Q 120 600 126 644 L 142 644 Q 144 600 142 540 Q 142 470 144 410 Z" fill="url(#jeans)" />
          <path d="M 122 510 Q 132 515 142 510" stroke="#06091a" strokeWidth="0.6" fill="none" />
          <path d="M 121 420 L 121 630" stroke="#3a5080" strokeWidth="0.4" opacity="0.5" />
        </motion.g>
        <motion.g animate={{ x: [0, 1, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}>
          <path d="M 156 410 Q 156 470 158 540 Q 158 600 152 644 L 170 644 Q 178 600 180 540 Q 178 470 172 410 Z" fill="url(#jeans)" />
          <path d="M 156 510 Q 168 515 178 510" stroke="#06091a" strokeWidth="0.6" fill="none" />
          <path d="M 179 420 L 179 630" stroke="#3a5080" strokeWidth="0.4" opacity="0.5" />
        </motion.g>

        {/* ===== SNEAKERS ===== */}
        <g>
          <path d="M 114 640 Q 105 658 114 668 L 148 668 L 148 638 Q 130 636 114 640 Z" fill="url(#shoe-upper)" />
          <rect x="113" y="664" width="36" height="5" rx="2" fill="#FF9900" />
          <path d="M 122 650 Q 130 645 142 650" stroke="hsl(195 95% 60%)" strokeWidth="1.5" fill="none" />

          <path d="M 152 638 L 152 668 L 186 668 Q 195 658 186 640 Q 170 636 152 638 Z" fill="url(#shoe-upper)" />
          <rect x="151" y="664" width="36" height="5" rx="2" fill="#FF9900" />
          <path d="M 158 650 Q 168 645 178 650" stroke="hsl(195 95% 60%)" strokeWidth="1.5" fill="none" />
        </g>

        {/* ===== HIPS ===== */}
        <path d="M 108 380 Q 150 412 192 380 L 192 415 Q 150 425 108 415 Z" fill="url(#jeans)" />
        <rect x="110" y="378" width="80" height="3" rx="1" fill="#0a0d18" />

        {/* ===== WHITE TEE peek ===== */}
        <path d="M 100 290 Q 150 280 200 290 L 200 405 L 100 405 Z" fill="url(#tee)" />
        {/* Cloud emblem on tee */}
        <g transform="translate(135, 340)">
          <path d="M 0 0 Q -4 -8 4 -10 Q 6 -16 14 -12 Q 22 -18 24 -8 Q 32 -6 26 2 L 0 2 Z" fill="hsl(35 95% 60%)" />
          <text x="13" y="14" fontSize="5" fontWeight="800" fill="#1a1f2e" textAnchor="middle">CLOUD</text>
        </g>

        {/* ===== OPEN HOODIE (panels) ===== */}
        <path d="M 86 410 Q 86 280 116 245 L 140 232 Q 145 245 142 295 L 116 410 Z" fill="url(#hoodie)" />
        <path d="M 214 410 Q 214 280 184 245 L 160 232 Q 155 245 158 295 L 184 410 Z" fill="url(#hoodie)" />
        <path d="M 142 295 Q 144 350 140 405" stroke="#080a14" strokeWidth="1" fill="none" opacity="0.7" />
        <path d="M 158 295 Q 156 350 160 405" stroke="#080a14" strokeWidth="1" fill="none" opacity="0.7" />

        {/* Hood folded behind shoulders */}
        <path d="M 96 245 Q 110 220 150 215 Q 190 220 204 245 Q 200 240 150 232 Q 100 240 96 245 Z" fill="#10131c" />

        {/* Drawstrings */}
        <path d="M 138 250 Q 134 285 132 320" stroke="#3a4055" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <path d="M 162 250 Q 166 285 168 320" stroke="#3a4055" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <circle cx="132" cy="322" r="2" fill="#3a4055" />
        <circle cx="168" cy="322" r="2" fill="#3a4055" />

        {/* Cyan shoulder trim */}
        <path d="M 90 270 Q 98 255 116 246" stroke="url(#trim)" strokeWidth="1.6" fill="none" />
        <path d="M 210 270 Q 202 255 184 246" stroke="url(#trim)" strokeWidth="1.6" fill="none" />

        {/* ===== ARMS ===== */}
        <motion.g
          animate={leftHandRaised ? { rotate: -30, x: -2 } : { rotate: [0, -2, 0, 2, 0], x: 0 }}
          transition={leftHandRaised
            ? { type: "spring", stiffness: 130, damping: 16 }
            : { duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "92px 260px" }}
        >
          <path d="M 88 260 Q 70 290 65 340 Q 64 380 72 410 L 86 408 Q 82 380 84 340 Q 88 300 100 280 Z" fill="url(#hoodie)" />
          <path d="M 72 408 Q 79 412 86 408" stroke="hsl(195 95% 65%)" strokeWidth="1.2" fill="none" opacity="0.85" />
          <g>
            <ellipse cx="74" cy="436" rx="11" ry="10" fill="url(#skin-arm)" />
            <path d="M 66 444 Q 64 454 68 458" stroke="#8b5a30" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 71 446 Q 69 456 73 460" stroke="#8b5a30" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 76 447 Q 75 457 79 460" stroke="#8b5a30" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 82 444 Q 84 454 80 458" stroke="#8b5a30" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 65 432 Q 59 428 62 424" stroke="#8b5a30" strokeWidth="2" fill="none" strokeLinecap="round" />
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
          <path d="M 228 408 Q 221 412 214 408" stroke="hsl(195 95% 65%)" strokeWidth="1.2" fill="none" opacity="0.85" />
          <g>
            <ellipse cx="226" cy="436" rx="11" ry="10" fill="url(#skin-arm)" />
            <path d="M 234 444 Q 236 454 232 458" stroke="#8b5a30" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 229 446 Q 231 456 227 460" stroke="#8b5a30" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 224 447 Q 225 457 221 460" stroke="#8b5a30" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 218 444 Q 216 454 220 458" stroke="#8b5a30" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 235 432 Q 241 428 238 424" stroke="#8b5a30" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        </motion.g>

        {/* ===== NECK ===== */}
        <path d="M 134 218 Q 150 225 166 218 L 168 236 Q 150 240 132 236 Z" fill="url(#skin)" />

        {/* ===== HEAD ===== */}
        <motion.g animate={headControls} style={{ transformOrigin: "150px 175px" }}>
          {/* Back hair */}
          <path
            d="M 96 130 Q 88 55 150 46 Q 212 55 204 130 L 214 180 Q 150 202 86 180 Z"
            fill="url(#hair-base)"
          />

          {/* Face — rounder Pixar-style oval */}
          <path
            d="M 100 132
               Q 100 75 150 70
               Q 200 75 200 132
               Q 200 180 182 204
               Q 168 218 150 219
               Q 132 218 118 204
               Q 100 180 100 132 Z"
            fill="url(#skin)"
          />

          {/* Big rosy cheek blooms — Pixar signature */}
          <ellipse cx="118" cy="170" rx="14" ry="10" fill="url(#cheek)" />
          <ellipse cx="182" cy="170" rx="14" ry="10" fill="url(#cheek)" />

          {/* Jaw + chin shading */}
          <path d="M 118 200 Q 135 215 150 217 Q 165 215 182 200" stroke="#a16a40" strokeWidth="0.9" fill="none" opacity="0.5" />
          <ellipse cx="150" cy="210" rx="6" ry="3" fill="#a16a40" opacity="0.2" />

          {/* Eyebrows — thicker, slightly curved, Pixar-style */}
          <motion.path
            d="M 112 122 Q 128 116 144 122 L 144 126 Q 128 121 112 126 Z"
            fill="#3d2412"
            animate={{ y: browY }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }}
          />
          <motion.path
            d="M 156 122 Q 172 116 188 122 L 188 126 Q 172 121 156 126 Z"
            fill="#3d2412"
            animate={{ y: browY }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }}
          />

          {/* EYES — big expressive Pixar eyes */}
          <g>
            {/* Sclera */}
            <ellipse cx="125" cy="148" rx="11" ry={blink ? 0.6 : 9} fill="#fff" />
            {!blink && (
              <>
                {/* Iris (with eye drift) */}
                <circle cx={125 + eyeDrift.x} cy={148 + eyeDrift.y} r="7" fill="url(#iris)" />
                {/* Pupil */}
                <circle cx={125 + eyeDrift.x} cy={148 + eyeDrift.y} r="3.5" fill="#0a0a14" />
                {/* HUGE catch lights */}
                <circle cx={123 + eyeDrift.x} cy={146 + eyeDrift.y} r="2.2" fill="#fff" />
                <circle cx={127 + eyeDrift.x} cy={150 + eyeDrift.y} r="1" fill="#fff" opacity="0.7" />
                {/* Bottom lash glint */}
                <path d="M 116 152 Q 125 156 134 152" stroke="#3d2412" strokeWidth="0.6" fill="none" opacity="0.6" />
              </>
            )}
            {/* Top lash line */}
            <path d="M 114 142 Q 125 138 136 142" stroke="#3d2412" strokeWidth="1.2" fill="none" strokeLinecap="round" />

            {/* Right eye */}
            <ellipse cx="175" cy="148" rx="11" ry={blink ? 0.6 : 9} fill="#fff" />
            {!blink && (
              <>
                <circle cx={175 + eyeDrift.x} cy={148 + eyeDrift.y} r="7" fill="url(#iris)" />
                <circle cx={175 + eyeDrift.x} cy={148 + eyeDrift.y} r="3.5" fill="#0a0a14" />
                <circle cx={173 + eyeDrift.x} cy={146 + eyeDrift.y} r="2.2" fill="#fff" />
                <circle cx={177 + eyeDrift.x} cy={150 + eyeDrift.y} r="1" fill="#fff" opacity="0.7" />
                <path d="M 166 152 Q 175 156 184 152" stroke="#3d2412" strokeWidth="0.6" fill="none" opacity="0.6" />
              </>
            )}
            <path d="M 164 142 Q 175 138 186 142" stroke="#3d2412" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          </g>

          {/* Pupil emissive glow during listen/speak */}
          {(listening || speaking) && !blink && (
            <>
              <motion.circle
                cx={125 + eyeDrift.x} cy={148 + eyeDrift.y} r="3.5"
                fill="hsl(195 95% 65%)"
                initial={{ opacity: 0.3 }}
                animate={{ opacity: [0.25, 0.55, 0.25] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <motion.circle
                cx={175 + eyeDrift.x} cy={148 + eyeDrift.y} r="3.5"
                fill="hsl(195 95% 65%)"
                initial={{ opacity: 0.3 }}
                animate={{ opacity: [0.25, 0.55, 0.25] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            </>
          )}

          {/* NOSE — small, soft, Pixar-style */}
          <ellipse cx="150" cy="176" rx="6" ry="4.5" fill="#e8a87a" opacity="0.55" />
          <ellipse cx="147" cy="178" rx="1.4" ry="1" fill="#9c6240" opacity="0.5" />
          <ellipse cx="153" cy="178" rx="1.4" ry="1" fill="#9c6240" opacity="0.5" />

          {/* MOUTH — big open friendly smile */}
          <motion.g
            animate={{ scaleY: speaking ? 1 + amplitude * 0.18 : 1 }}
            transition={{ duration: 0.04 }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            {/* Smile outer shape (open mouth, teeth visible) */}
            <path
              d={`M ${150 - mouthWidth} 197
                  Q 150 ${197 + mouthCurve} ${150 + mouthWidth} 197
                  Q 150 ${197 + mouthOpen + 4} ${150 - mouthWidth} 197 Z`}
              fill="#4a1812"
            />
            {/* Teeth (visible white strip) */}
            <path
              d={`M ${150 - mouthWidth + 2} 198
                  Q 150 ${198 + Math.max(1, mouthCurve - 1.5)} ${150 + mouthWidth - 2} 198
                  Q 150 ${198 + Math.max(1, mouthCurve * 0.6)} ${150 - mouthWidth + 2} 198 Z`}
              fill="#fff8f0"
            />
            {/* Top lip line */}
            <path
              d={`M ${150 - mouthWidth} 197 Q 150 195 ${150 + mouthWidth} 197`}
              stroke="#3a0f0a" strokeWidth="1.4" fill="none" strokeLinecap="round"
            />
            {/* Tongue hint when very open */}
            {mouthOpen > 5 && (
              <ellipse cx="150" cy={199 + mouthOpen * 0.4} rx={mouthWidth * 0.4} ry="1.5" fill="#c4604a" />
            )}
          </motion.g>

          {/* ===== HAIR FRONT — wavy quiff like the reference ===== */}
          {/* Big quiff lifted on top */}
          <path
            d="M 100 130
               Q 105 70 132 60
               Q 145 50 158 60
               Q 175 55 192 75
               Q 202 95 200 130
               Q 195 92 178 86
               Q 168 78 154 84
               Q 140 76 124 90
               Q 110 92 100 130 Z"
            fill="url(#hair-base)"
          />
          {/* Wave detail at the front of quiff */}
          <path
            d="M 116 92 Q 130 76 148 84 Q 142 84 132 92 Q 124 90 116 92 Z"
            fill="url(#hair-base)"
          />
          <path
            d="M 152 84 Q 168 72 184 86 Q 172 80 160 86 Q 156 86 152 84 Z"
            fill="url(#hair-base)"
          />
          {/* Hair strands separating */}
          <path d="M 118 92 Q 128 78 142 84" stroke="#221206" strokeWidth="0.6" fill="none" opacity="0.6" />
          <path d="M 144 84 Q 158 72 170 82" stroke="#221206" strokeWidth="0.6" fill="none" opacity="0.6" />
          <path d="M 168 82 Q 180 72 192 90" stroke="#221206" strokeWidth="0.6" fill="none" opacity="0.6" />
          {/* Highlight strand */}
          <path
            d="M 130 88 Q 150 72 175 86"
            stroke="#d49b66" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.5"
          />
          {/* Hair shine overlay */}
          <path
            d="M 110 95 Q 150 78 192 95 L 192 112 Q 150 92 110 112 Z"
            fill="url(#hair-shine)" opacity="0.65"
          />
          {/* Side bang */}
          <path d="M 194 95 Q 212 115 210 145 Q 204 118 196 102 Z" fill="url(#hair-base)" />
          {/* Sideburns */}
          <path d="M 102 130 Q 100 158 106 178 Q 102 156 102 132 Z" fill="url(#hair-base)" />
          <path d="M 198 130 Q 200 158 194 178 Q 198 156 198 132 Z" fill="url(#hair-base)" />

          {/* Thinking dots above head */}
          {thinking && (
            <g transform="translate(140, 50)">
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={i} cx={i * 5} cy={0} r={1.6}
                  fill="hsl(195 95% 70%)"
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
              fill="none" stroke="hsl(195 95% 65%)" strokeWidth="1.5"
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

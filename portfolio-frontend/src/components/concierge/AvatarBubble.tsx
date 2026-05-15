/**
 * AvatarBubble - Compact face-only avatar for the launcher button.
 *
 * Purpose-built for the small circular launcher. Renders just Nimbus's
 * face/head (no body, no scale-hack) in a 56×56 circle so it actually
 * looks like a profile-picture-style avatar icon. Matches the main
 * full-body Avatar's visual design (specs, hair, skin tone) so the
 * identity reads consistently across the site.
 *
 * Animations: subtle blink + tiny float. Designed to be cheap — no
 * cursor tracking, no heavy state.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface AvatarBubbleProps {
  size?: number;
  className?: string;
}

export default function AvatarBubble({ size = 56, className = "" }: AvatarBubbleProps) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loop = () => {
      const delay = 2500 + Math.random() * 2500;
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

  return (
    <motion.div
      className={`relative overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
      animate={{ y: [0, -1.5, 0] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Soft background gradient — studio backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, hsl(200 95% 65% / 0.32), hsl(220 60% 25%) 65%, hsl(220 60% 18%) 100%)",
        }}
      />

      {/* Avatar SVG — square viewport, just the head + chest */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="bub-skin" cx="42%" cy="38%" r="80%">
            <stop offset="0%" stopColor="#fff5ea" />
            <stop offset="55%" stopColor="#f4d8b8" />
            <stop offset="100%" stopColor="#c5905d" />
          </radialGradient>
          <linearGradient id="bub-hair" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#2c2638" />
            <stop offset="60%" stopColor="#15101e" />
            <stop offset="100%" stopColor="#0a0612" />
          </linearGradient>
          <linearGradient id="bub-hood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f2433" />
            <stop offset="100%" stopColor="#0d101a" />
          </linearGradient>
          <linearGradient id="bub-lens" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a3c8ff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#5c8cff" stopOpacity="0.34" />
          </linearGradient>
          <radialGradient id="bub-iris" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6c8db8" />
            <stop offset="100%" stopColor="#1a2540" />
          </radialGradient>
        </defs>

        {/* Shoulders / hoodie peek at the bottom of the bubble */}
        <path
          d="M -10 100 Q 50 70 110 100 Z"
          fill="url(#bub-hood)"
        />
        {/* Tee V */}
        <path
          d="M 42 84 L 50 96 L 58 84 Z"
          fill="#ffffff"
        />

        {/* Back hair */}
        <path
          d="M 22 48 Q 18 18 50 12 Q 82 18 78 48 L 84 70 Q 50 80 16 70 Z"
          fill="url(#bub-hair)"
        />

        {/* Face oval */}
        <path
          d="M 26 50 Q 26 22 50 18 Q 74 22 74 50 Q 74 72 64 80 Q 56 86 50 86 Q 44 86 36 80 Q 26 72 26 50 Z"
          fill="url(#bub-skin)"
        />

        {/* Cheek bloom */}
        <ellipse cx="36" cy="62" rx="5" ry="3" fill="#e8a890" opacity="0.55" />
        <ellipse cx="64" cy="62" rx="5" ry="3" fill="#e8a890" opacity="0.55" />

        {/* Eyebrows */}
        <path
          d="M 32 42 Q 39 39 46 42"
          stroke="#15101e" strokeWidth="2" fill="none" strokeLinecap="round"
        />
        <path
          d="M 54 42 Q 61 39 68 42"
          stroke="#15101e" strokeWidth="2" fill="none" strokeLinecap="round"
        />

        {/* Eyes */}
        <g>
          <ellipse cx="38" cy="50" rx="4" ry={blink ? 0.4 : 3} fill="#fff" />
          {!blink && (
            <>
              <circle cx="38" cy="50" r="2.2" fill="url(#bub-iris)" />
              <circle cx="38" cy="50" r="1" fill="#0a0a14" />
              <circle cx="37.3" cy="49.3" r="0.6" fill="#fff" />
            </>
          )}
          <ellipse cx="62" cy="50" rx="4" ry={blink ? 0.4 : 3} fill="#fff" />
          {!blink && (
            <>
              <circle cx="62" cy="50" r="2.2" fill="url(#bub-iris)" />
              <circle cx="62" cy="50" r="1" fill="#0a0a14" />
              <circle cx="61.3" cy="49.3" r="0.6" fill="#fff" />
            </>
          )}
        </g>

        {/* Spectacles */}
        <g>
          <rect x="30" y="44" width="16" height="12" rx="3" fill="url(#bub-lens)" />
          <rect x="54" y="44" width="16" height="12" rx="3" fill="url(#bub-lens)" />
          <rect x="30" y="44" width="16" height="12" rx="3" fill="none" stroke="#0a0a14" strokeWidth="1.4" />
          <rect x="54" y="44" width="16" height="12" rx="3" fill="none" stroke="#0a0a14" strokeWidth="1.4" />
          <path d="M 46 48 L 54 48" stroke="#0a0a14" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M 30 47 L 24 50" stroke="#0a0a14" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M 70 47 L 76 50" stroke="#0a0a14" strokeWidth="1.3" strokeLinecap="round" />
          {/* Lens shine */}
          <path d="M 32 46 L 38 53" stroke="#fff" strokeWidth="0.8" fill="none" opacity="0.55" strokeLinecap="round" />
          <path d="M 56 46 L 62 53" stroke="#fff" strokeWidth="0.8" fill="none" opacity="0.55" strokeLinecap="round" />
        </g>

        {/* Nose */}
        <path d="M 48 58 Q 47 64 50 67 Q 53 64 52 58" fill="#c5905d" opacity="0.5" />
        <ellipse cx="50" cy="68" rx="1.5" ry="0.6" fill="#9c6f48" opacity="0.5" />

        {/* Smile */}
        <path
          d="M 42 73 Q 50 78 58 73"
          stroke="#3a0f0a" strokeWidth="1.6" fill="none" strokeLinecap="round"
        />
        <path
          d="M 43 73 Q 50 76 57 73"
          fill="#fff8f0" opacity="0.85"
        />

        {/* Front hair quiff */}
        <path
          d="M 24 50 Q 28 18 50 16 Q 72 18 76 50 Q 72 28 60 26 Q 50 22 44 30 Q 34 24 28 36 Q 24 38 24 50 Z"
          fill="url(#bub-hair)"
        />
        {/* Quiff lift */}
        <path
          d="M 38 26 Q 50 16 60 28 Q 50 20 42 28 Z"
          fill="url(#bub-hair)"
        />
        {/* Highlight strand */}
        <path
          d="M 42 25 Q 52 17 60 27"
          stroke="#9fb8d8" strokeWidth="1" fill="none" opacity="0.55" strokeLinecap="round"
        />
        {/* Sideburns */}
        <path d="M 25 50 Q 24 64 26 72 Q 25 62 26 52 Z" fill="url(#bub-hair)" />
        <path d="M 75 50 Q 76 64 74 72 Q 75 62 74 52 Z" fill="url(#bub-hair)" />

        {/* Earpiece hint of headphone */}
        <circle cx="23" cy="58" r="3.5" fill="#23262e" />
        <circle cx="23" cy="58" r="2" fill="#0a0d12" />
        <circle cx="77" cy="58" r="3.5" fill="#23262e" />
        <circle cx="77" cy="58" r="2" fill="#0a0d12" />
      </svg>
    </motion.div>
  );
}

/**
 * Specialist design tokens — single source of truth for tone-based styling.
 *
 * Each specialist has its own color story. We avoid Tailwind dynamic class
 * generation (which the JIT can't see) by mapping every tone to a literal
 * class string at module scope.
 */
export type Tone = "amber" | "emerald" | "violet" | "rose" | "slate";

interface ToneTokens {
  /** Solid mid-saturation hex (used for inline glow / chart accents). */
  hex: string;
  /** Tailwind text class for label glyphs. */
  text: string;
  /** Tailwind border class for cards / chips. */
  border: string;
  /** Subtle background tint for cards. */
  bg: string;
  /** Stronger background for active state. */
  bgActive: string;
  /** Ring class used during pulse / running. */
  ring: string;
  /** Gradient pair for the avatar puck. */
  avatarGradient: string;
  /** Glow/shadow class for active orbs. */
  glow: string;
  /** Single short word the user sees on the chip ("knowledge", "live", etc). */
  word: string;
}

export const TONE_TOKENS: Record<Tone, ToneTokens> = {
  amber: {
    hex: "#f59e0b",
    text: "text-amber-300",
    border: "border-amber-400/30",
    bg: "bg-amber-500/[0.06]",
    bgActive: "bg-amber-500/15",
    ring: "ring-amber-400/40",
    avatarGradient: "from-amber-300 via-orange-400 to-amber-600",
    glow: "shadow-[0_0_20px_-4px_rgba(245,158,11,0.6)]",
    word: "knowledge",
  },
  emerald: {
    hex: "#10b981",
    text: "text-emerald-300",
    border: "border-emerald-400/30",
    bg: "bg-emerald-500/[0.06]",
    bgActive: "bg-emerald-500/15",
    ring: "ring-emerald-400/40",
    avatarGradient: "from-emerald-300 via-teal-400 to-emerald-600",
    glow: "shadow-[0_0_20px_-4px_rgba(16,185,129,0.6)]",
    word: "live",
  },
  violet: {
    hex: "#8b5cf6",
    text: "text-violet-300",
    border: "border-violet-400/30",
    bg: "bg-violet-500/[0.06]",
    bgActive: "bg-violet-500/15",
    ring: "ring-violet-400/40",
    avatarGradient: "from-violet-300 via-fuchsia-400 to-violet-600",
    glow: "shadow-[0_0_20px_-4px_rgba(139,92,246,0.6)]",
    word: "fit",
  },
  rose: {
    hex: "#f43f5e",
    text: "text-rose-300",
    border: "border-rose-400/30",
    bg: "bg-rose-500/[0.06]",
    bgActive: "bg-rose-500/15",
    ring: "ring-rose-400/40",
    avatarGradient: "from-rose-300 via-pink-400 to-rose-600",
    glow: "shadow-[0_0_20px_-4px_rgba(244,63,94,0.6)]",
    word: "intro",
  },
  slate: {
    hex: "#94a3b8",
    text: "text-slate-300",
    border: "border-slate-400/30",
    bg: "bg-slate-500/[0.06]",
    bgActive: "bg-slate-500/15",
    ring: "ring-slate-400/40",
    avatarGradient: "from-slate-300 via-zinc-400 to-slate-600",
    glow: "shadow-[0_0_20px_-4px_rgba(148,163,184,0.5)]",
    word: "system",
  },
};

export function toneFor(input?: string): Tone {
  const t = (input || "").toLowerCase();
  if (t === "amber" || t === "emerald" || t === "violet" || t === "rose" || t === "slate") {
    return t as Tone;
  }
  return "slate";
}

export const SPECIALIST_ICONS: Record<string, string> = {
  curator: "library",
  builder: "activity",
  analyst: "scope",
  concierge: "handshake",
  orchestrator: "brain",
};

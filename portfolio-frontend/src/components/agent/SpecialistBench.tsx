/**
 * SpecialistBench — the always-visible "team" header inside the agent panel.
 *
 * Renders the four specialist agents as a row of luminous avatars. Whichever
 * specialist is currently working pulses with its tone. This is the single
 * most important UX cue that the user is talking to a *team*, not a chatbot.
 */
import { motion } from "framer-motion";
import { Activity, BrainCircuit, Crosshair, Handshake, Library } from "lucide-react";
import type { ReactNode } from "react";
import { TONE_TOKENS, toneFor } from "./agentTokens";
import type { Specialist, SpecialistId } from "@/hooks/useBuilderAgent";

const ICON_MAP: Record<string, ReactNode> = {
  curator: <Library className="h-4 w-4" />,
  builder: <Activity className="h-4 w-4" />,
  analyst: <Crosshair className="h-4 w-4" />,
  concierge: <Handshake className="h-4 w-4" />,
  orchestrator: <BrainCircuit className="h-4 w-4" />,
};

interface Props {
  specialists: Specialist[];
  active: Set<SpecialistId>;
}

export function SpecialistBench({ specialists, active }: Props) {
  return (
    <div className="flex items-stretch gap-1.5 px-3 py-2.5">
      {specialists.map((s) => {
        const isActive = active.has(s.id);
        const tone = TONE_TOKENS[toneFor(s.tone)];
        return (
          <motion.div
            key={s.id}
            layout
            className={`relative flex-1 group rounded-xl border ${tone.border} ${
              isActive ? tone.bgActive : tone.bg
            } px-2 py-2 transition-colors`}
            animate={isActive ? { scale: [1, 1.02, 1] } : { scale: 1 }}
            transition={isActive ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
          >
            {/* Pulse ring for the active specialist */}
            {isActive && (
              <motion.div
                className={`absolute inset-0 rounded-xl ring-2 ${tone.ring}`}
                animate={{ opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <div className="relative flex items-center gap-1.5">
              <div
                className={`relative flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br ${
                  tone.avatarGradient
                } text-white shadow-sm ${isActive ? tone.glow : ""}`}
              >
                {ICON_MAP[s.id] ?? ICON_MAP.orchestrator}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-[10.5px] font-semibold leading-tight ${tone.text}`}>{s.label}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70 truncate">
                  {tone.word}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

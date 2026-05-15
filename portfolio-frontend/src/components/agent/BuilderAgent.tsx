/**
 * BuilderAgent — the multi-agent concierge that replaces the legacy Chatbot.
 *
 * UX intentions (treat as design contract):
 *   ▸ Glass + gradient mesh — no flat plastic look.
 *   ▸ Specialist bench up top so the user *sees* the team, not a single bot.
 *   ▸ Visible reasoning trail (collapsible) — the engineering is the demo.
 *   ▸ Action chips at end-of-turn so the recruiter never gets stuck.
 *   ▸ Distinct floating trigger (multi-orb cluster) so it doesn't read as a
 *     stock chatbot icon.
 *   ▸ One floating button only — the legacy Chatbot is removed in Home.tsx.
 */
import { AnimatePresence, motion } from "framer-motion";
import { Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useBuilderAgent } from "@/hooks/useBuilderAgent";
import { ActionChips } from "./ActionChips";
import { AgentMessage } from "./AgentMessage";
import { SpecialistBench } from "./SpecialistBench";

const STARTER_PROMPTS: Array<{ label: string; value: string }> = [
  { label: "Most complex thing built", value: "What's the most complex thing Harshith has built and what made it hard?" },
  { label: "Score me against a JD", value: "I'll paste a job description — score Harshith's fit honestly with matched skills and gaps." },
  { label: "What's shipping this week", value: "What has Harshith shipped recently? Pull the latest from GitHub and the cloud diary." },
  { label: "Set up an intro", value: "I'd like to set up a 15-minute intro with Harshith." },
];

function FloatingTrigger({ open, onOpen, hasUnseen }: { open: boolean; onOpen: () => void; hasUnseen: boolean }) {
  // Multi-orb cluster — visually distinct from any "single bubble" chatbot
  return (
    <AnimatePresence>
      {!open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <button onClick={onOpen} aria-label="Open Harshith's AI agent" className="group relative">
            {/* Outer gradient halo */}
            <motion.div
              className="absolute -inset-3 rounded-full bg-gradient-to-br from-amber-400/40 via-violet-500/40 to-emerald-400/40 blur-xl opacity-70 group-hover:opacity-100 transition-opacity"
              animate={{ rotate: 360 }}
              transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
            />
            {/* Pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-full border border-foreground/20"
              animate={{ scale: [1, 1.45], opacity: [0.6, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
            />
            <div className="relative h-14 w-14 rounded-full bg-background/80 backdrop-blur-xl border border-border/60 shadow-2xl flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
              {/* 4 mini orbs representing the 4 specialists */}
              <div className="grid grid-cols-2 gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.7)]" />
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(139,92,246,0.7)]" />
                <span className="h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.7)]" />
              </div>
            </div>
            {hasUnseen && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
            )}
            {/* Hover label */}
            <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="rounded-lg bg-background/90 backdrop-blur border border-border/60 px-2.5 py-1 text-[11px] font-medium text-foreground whitespace-nowrap shadow-lg">
                Ask the team
              </div>
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Inline trigger — the SAME multi-orb pulse icon (cluster of 4 colored dots
 * + halo + pulse ring) that used to float in the bottom-right, but sized for
 * inline placement (e.g. next to the user's name). Click fires the
 * "builder-agent:open" event the BuilderAgent component listens for.
 */
export function BuilderAgentInlineTrigger({
  label = "Ask the team",
  size = 40,
}: { label?: string; size?: number }) {
  const onClick = () => window.dispatchEvent(new Event("builder-agent:open"));
  const innerSize = `${size}px`;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open the AI agent team"
      className="group relative inline-flex items-center gap-2 align-middle"
    >
      {/* Halo */}
      <span className="relative inline-flex items-center justify-center" style={{ width: innerSize, height: innerSize }}>
        <motion.span
          className="absolute -inset-1.5 rounded-full bg-gradient-to-br from-amber-400/40 via-violet-500/40 to-emerald-400/40 blur-lg opacity-80 group-hover:opacity-100 transition-opacity"
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        />
        {/* Pulse ring */}
        <motion.span
          className="absolute inset-0 rounded-full border border-foreground/25"
          animate={{ scale: [1, 1.45], opacity: [0.7, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
        />
        {/* Cluster */}
        <span
          className="relative rounded-full bg-background/85 backdrop-blur-xl border border-border/60 shadow-lg flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform"
          style={{ width: innerSize, height: innerSize }}
        >
          <span className="grid grid-cols-2 gap-[3px]">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_5px_rgba(245,158,11,0.7)]" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(16,185,129,0.7)]" />
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_5px_rgba(139,92,246,0.7)]" />
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_5px_rgba(244,63,94,0.7)]" />
          </span>
        </span>
      </span>
      <span className="hidden sm:inline text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
        {label}
      </span>
    </button>
  );
}

export default function BuilderAgent() {
  const { turns, status, specialists, activeAgents, send, reset } = useBuilderAgent();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [hasUnseen, setHasUnseen] = useState(false);
  const [hasBlockingDialog, setHasBlockingDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, status]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 240);
      setHasUnseen(false);
    }
  }, [open]);

  // External open trigger — fired from the inline icon next to the name in Hero.
  // Lets us drop the floating bottom-right launcher (which collided with the
  // Concierge launcher) without losing access to the multi-agent panel.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("builder-agent:open", handler);
    return () => window.removeEventListener("builder-agent:open", handler);
  }, []);

  // Hide "Ask the team" trigger while another modal/dialog is open.
  useEffect(() => {
    const evaluate = () => {
      const anyOpenDialog = !!document.querySelector('[role="dialog"]');
      const bodyLocked = document.body.style.overflow === "hidden";
      setHasBlockingDialog(anyOpenDialog || bodyLocked);
    };

    evaluate();
    const observer = new MutationObserver(evaluate);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "aria-hidden"],
    });

    return () => observer.disconnect();
  }, []);

  const handleSubmit = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setInput("");
    send(value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  const isEmpty = turns.length === 0;

  // FloatingTrigger removed — the multi-orb launcher now lives inline next to
  // the name in Hero.tsx (see <BuilderAgentInlineTrigger />) and fires the
  // "builder-agent:open" event handled above. Frees the bottom-right corner
  // for the Concierge launcher. The component below is kept as an unused
  // reference for the design tokens. `hasBlockingDialog` is still computed so
  // any future re-introduction stays compatible.
  void FloatingTrigger;
  void hasBlockingDialog;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="fixed z-50 inset-3 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[440px] sm:h-[640px] flex flex-col rounded-2xl overflow-hidden border border-border/60 shadow-2xl shadow-black/30"
          >
            {/* Layered background — base + gradient mesh + grain */}
            <div className="absolute inset-0 bg-background/95 backdrop-blur-2xl" />
            <div
              className="absolute inset-0 opacity-70"
              style={{
                background:
                  "radial-gradient(circle at 15% 5%, rgba(245,158,11,0.10), transparent 35%), radial-gradient(circle at 85% 0%, rgba(16,185,129,0.10), transparent 35%), radial-gradient(circle at 90% 100%, rgba(139,92,246,0.10), transparent 40%), radial-gradient(circle at 10% 100%, rgba(244,63,94,0.08), transparent 40%)",
              }}
              aria-hidden
            />

            {/* Header */}
            <div className="relative border-b border-border/40">
              <div className="flex items-center justify-between px-3 pt-3 pb-1">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 via-violet-500 to-emerald-400 p-[1px] shadow-lg">
                      <div className="h-full w-full rounded-[10px] bg-background/80 backdrop-blur flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-foreground" />
                      </div>
                    </div>
                    <motion.span
                      className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background"
                      animate={status === "streaming" ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                      transition={{ duration: 1.2, repeat: status === "streaming" ? Infinity : 0 }}
                    />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold leading-tight text-foreground">
                      Harshith's AI agents
                    </div>
                    <div className="text-[10.5px] text-muted-foreground/80">
                      4-specialist team · Gemini · live tools
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {turns.length > 0 && (
                    <button
                      onClick={reset}
                      className="text-[10.5px] uppercase tracking-wider text-muted-foreground/70 hover:text-foreground px-2 py-1 rounded-md hover:bg-foreground/[0.04] transition-colors"
                    >
                      reset
                    </button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setOpen(false)}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Specialist bench */}
              <SpecialistBench specialists={specialists} active={activeAgents} />
            </div>

            {/* Conversation */}
            <div className="relative flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-3">
              {isEmpty ? (
                <EmptyState onPick={handleSubmit} />
              ) : (
                turns.map((turn) => {
                  if (turn.role === "user") {
                    return (
                      <motion.div
                        key={turn.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-end"
                      >
                        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-3.5 py-2 text-[13px] leading-relaxed shadow-sm">
                          {turn.content}
                        </div>
                      </motion.div>
                    );
                  }
                  return (
                    <div key={turn.id} className="space-y-2">
                      <AgentMessage turn={turn} />
                      {turn.actions.length > 0 && (
                        <ActionChips actions={turn.actions} onSelect={handleSubmit} />
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="relative border-t border-border/40 px-3 py-2.5 bg-background/60 backdrop-blur">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={
                    status === "streaming"
                      ? "Specialists at work…"
                      : "Ask the team — projects, fit, what's shipping, intros…"
                  }
                  maxLength={1500}
                  disabled={status === "streaming"}
                  className="w-full rounded-xl bg-background/70 border border-border/60 pl-3.5 pr-11 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-shadow disabled:opacity-50"
                />
                <button
                  onClick={() => handleSubmit(input)}
                  disabled={status === "streaming" || !input.trim()}
                  aria-label="Send"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-md hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-transform"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[9.5px] uppercase tracking-wider text-muted-foreground/50">
                <span>multi-agent · gemini · sse</span>
                <span>{input.length}/1500</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function EmptyState({ onPick }: { onPick: (v: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3 py-2"
    >
      <div className="rounded-xl border border-border/40 bg-gradient-to-br from-background/95 to-background/70 px-3.5 py-3">
        <p className="text-[12.5px] leading-relaxed text-foreground/85">
          You're talking to a <strong className="font-semibold">multi-agent team</strong> Harshith built — an
          orchestrator that routes your question to the right specialist (Curator, Builder, Analyst, Concierge),
          calls the matching tools, and answers with receipts.
        </p>
        <p className="mt-1.5 text-[11px] text-muted-foreground/80">
          Ask anything — the reasoning trail is visible above the answer.
        </p>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold pl-1 mb-1.5">
          try a starter
        </div>
        <div className="flex flex-col gap-1.5">
          {STARTER_PROMPTS.map((p) => (
            <motion.button
              key={p.label}
              whileHover={{ x: 2 }}
              onClick={() => onPick(p.value)}
              className="group flex items-center justify-between rounded-lg border border-border/40 bg-background/40 hover:bg-primary/[0.06] hover:border-primary/30 px-3 py-2 text-left transition-colors"
            >
              <span className="text-[12px] text-foreground/85 group-hover:text-primary transition-colors">
                {p.label}
              </span>
              <span className="text-[10px] text-muted-foreground/60 group-hover:text-primary/80">→</span>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

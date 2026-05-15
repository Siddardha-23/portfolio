/**
 * ConciergeStage - The split-stage layout for The Concierge.
 *
 * Replaces the old chatbot-bubble UX. Full-viewport overlay with:
 *   - LEFT (45% / hidden on mobile): the avatar, large, on a soft holographic
 *     stage with ambient gradient. This is the visual "presence."
 *   - RIGHT (55% / full on mobile): the conversation window — active card
 *     lane on top, transcript in the middle, suggestion chips + mic/text
 *     input at the bottom.
 *
 * Minimize: collapses to a corner widget (small avatar + last caption) so
 * users can see the page being driven by intents. Click the widget to
 * restore.
 *
 * Backdrop is dimmed + blurred but visible — the avatar isn't hiding the
 * portfolio, it's hosting a conversation in front of it.
 */
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import {
  Send, Mic, MicOff, Volume2, VolumeX, X, Minimize2, Maximize2, Sparkles, Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Avatar, { AvatarState, AvatarEmotion } from "./Avatar";
import { CardRenderer } from "./cards/Cards";
import type { TranscriptEntry } from "./types";

interface StageProps {
  open: boolean;
  minimized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onRestore: () => void;
  transcript: TranscriptEntry[];
  pending: boolean;
  partial: string;
  inputValue: string;
  setInputValue: (s: string) => void;
  onSubmit: () => void;
  micSupported: boolean;
  micActive: boolean;
  ttsMuted: boolean;
  ttsAmplitude: number;
  onToggleMic: () => void;
  onToggleMute: () => void;
  suggestions: string[];
  onSuggestion: (s: string) => void;
  recruiterMode: boolean;
  avatarState: AvatarState;
  emotion: AvatarEmotion;
}

export default function ConciergeStage(props: StageProps) {
  const {
    open, minimized, onClose, onMinimize, onRestore,
    transcript, pending, partial, inputValue, setInputValue, onSubmit,
    micSupported, micActive, ttsMuted, ttsAmplitude,
    onToggleMic, onToggleMute, suggestions, onSuggestion, recruiterMode,
    avatarState, emotion,
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !minimized && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, pending, open, minimized]);

  useEffect(() => {
    if (open && !minimized) {
      const t = setTimeout(() => inputRef.current?.focus(), 320);
      return () => clearTimeout(t);
    }
  }, [open, minimized]);

  // Active card = the most recent model turn's display card
  const activeCard = [...transcript].reverse().find((t) => t.role === "model" && t.display)?.display || null;
  const latestModelText = [...transcript].reverse().find((t) => t.role === "model")?.text || "";

  return (
    <AnimatePresence>
      {/* ===== MINIMIZED corner widget ===== */}
      {open && minimized && (
        <motion.button
          key="concierge-mini"
          onClick={onRestore}
          initial={{ opacity: 0, scale: 0.7, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: 30 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-5 right-5 z-[60] flex items-center gap-3 max-w-[300px] px-3 py-2 rounded-2xl bg-background/95 backdrop-blur-xl border border-border/60 shadow-2xl hover:border-primary/50 transition-colors group"
          aria-label="Restore Concierge"
        >
          <div className="shrink-0 w-12 h-20 -my-1">
            <Avatar size={48} state={avatarState} emotion={emotion} amplitude={ttsAmplitude} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[10px] uppercase font-semibold tracking-wider text-primary mb-0.5">Concierge</div>
            <div className="text-xs text-foreground/80 truncate">
              {pending ? "Thinking…" : latestModelText || "Tap to expand"}
            </div>
          </div>
          <Maximize2 className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
        </motion.button>
      )}

      {/* ===== FULL STAGE ===== */}
      {open && !minimized && (
        <motion.div
          key="concierge-stage"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[58]"
          role="dialog"
          aria-label="The Concierge"
        >
          {/* Backdrop — dim + blur but visible. Purely decorative; the only way
              to dismiss/minimize is via the header buttons. Removing the
              backdrop-click handler also removed a `pointer-events-none`
              cascade on the stage container that was blocking the input. */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ backdropFilter: "blur(0px)", backgroundColor: "rgba(0,0,0,0)" }}
            animate={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(8,4,20,0.55)" }}
            exit={{ backdropFilter: "blur(0px)", backgroundColor: "rgba(0,0,0,0)" }}
            transition={{ duration: 0.35 }}
          />

          {/* Two-column stage */}
          <div className="relative h-full w-full flex flex-col md:flex-row">

            {/* ===== LEFT: Avatar stage ===== */}
            <motion.div
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="hidden md:flex md:w-[45%] lg:w-[42%] items-end justify-center relative pointer-events-none"
            >
              {/* Floor reflection / pedestal glow */}
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-32 pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse at center bottom, hsl(290 95% 65% / 0.45), transparent 70%)",
                  filter: "blur(20px)",
                }}
              />
              {/* Vertical light beam behind avatar */}
              <div
                className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[80%] pointer-events-none"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 0%, hsl(290 95% 65% / 0.12) 30%, hsl(190 95% 60% / 0.18) 70%, transparent 100%)",
                }}
              />
              <div className="relative w-[78%] max-w-[480px] mb-[-2%]">
                <Avatar
                  size={480}
                  state={avatarState}
                  emotion={emotion}
                  amplitude={ttsAmplitude}
                />
              </div>
            </motion.div>

            {/* Mobile inline avatar (top) */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="md:hidden flex justify-center pt-12 pb-2 pointer-events-none"
            >
              <div className="w-[160px]">
                <Avatar size={160} state={avatarState} emotion={emotion} amplitude={ttsAmplitude} />
              </div>
            </motion.div>

            {/* ===== RIGHT: Conversation window ===== */}
            <motion.div
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
              className="flex-1 md:w-[55%] lg:w-[58%] flex flex-col p-3 md:p-6 lg:p-8"
            >
              <div className="flex-1 flex flex-col bg-background/85 backdrop-blur-2xl rounded-2xl border border-border/60 shadow-2xl overflow-hidden max-h-full">

                {/* Header */}
                <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-border/60 bg-gradient-to-r from-background/60 to-transparent">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center shrink-0">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">The Concierge</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {recruiterMode ? "Recruiter mode active" : "Harshith's AI · ask anything"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={onToggleMute}
                      aria-label={ttsMuted ? "Unmute" : "Mute"}
                      title={ttsMuted ? "Unmute voice" : "Mute voice (transcript continues)"}
                      className="h-8 w-8"
                    >
                      {ttsMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={onMinimize}
                      aria-label="Minimize" title="Minimize (so you can see the page)"
                      className="h-8 w-8"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={onClose}
                      aria-label="Close" className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Active card lane */}
                {activeCard && (
                  <div className="px-4 md:px-5 pt-3">
                    <CardRenderer card={activeCard} />
                  </div>
                )}

                {/* Transcript */}
                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto px-4 md:px-5 py-3 space-y-2.5 scroll-smooth min-h-[120px]"
                >
                  {transcript.length === 0 && !pending && (
                    <div className="h-full flex flex-col items-center justify-center text-center text-xs text-muted-foreground py-10">
                      <p className="mb-2 text-sm font-medium text-foreground">I'm Aria — Harshith's AI Concierge.</p>
                      <p>Ask me anything, or tap a chip below.</p>
                    </div>
                  )}
                  {transcript.map((t) => (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22 }}
                      className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                        t.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted/60 rounded-tl-sm"
                      }`}>
                        {t.caption || t.text}
                      </div>
                    </motion.div>
                  ))}
                  {pending && (
                    <div className="flex items-center gap-1.5 px-1 py-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-primary/60"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }}
                        />
                      ))}
                    </div>
                  )}
                  {partial && micActive && (
                    <div className="px-3 py-1.5 rounded-lg bg-primary/5 text-[11px] italic text-muted-foreground">
                      "{partial}"
                    </div>
                  )}
                </div>

                {/* Suggestions */}
                {suggestions.length > 0 && !pending && (
                  <div className="px-4 md:px-5 pb-2 flex flex-wrap gap-1.5">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => onSuggestion(s)}
                        className="px-2.5 py-1 text-[11px] rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {/* Listening overlay — covers the input bar with a big visual
                    indicator while the mic is hot. Tap "Stop" or the mic
                    button to finalize and submit. */}
                <AnimatePresence>
                  {micActive && (
                    <motion.div
                      key="listening-overlay"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="mx-3 md:mx-4 mb-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 flex items-center gap-3"
                    >
                      <div className="relative w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                        <Mic className="h-4 w-4" />
                        <motion.span
                          className="absolute inset-0 rounded-full border-2 border-primary"
                          animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-primary flex items-center gap-1.5">
                          <Radio className="h-3 w-3 animate-pulse" />
                          Listening…
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {partial ? `"${partial}"` : "Speak now — tap stop when done"}
                        </div>
                      </div>
                      <Button size="sm" onClick={onToggleMic} className="shrink-0">
                        Stop
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Big "Tap to speak" CTA when idle — much more discoverable
                    than the tiny mic icon. Disappears while listening (the
                    overlay above replaces it) and while typing in the box. */}
                {!micActive && micSupported && !inputValue && (
                  <div className="mx-3 md:mx-4 mb-2">
                    <button
                      type="button"
                      onClick={onToggleMic}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors px-4 py-2.5 text-xs font-medium text-primary group"
                    >
                      <Mic className="h-4 w-4" />
                      Tap to speak with Aria
                      <span className="text-[10px] text-muted-foreground font-normal hidden sm:inline">
                        · she'll listen then answer
                      </span>
                    </button>
                  </div>
                )}

                {!micSupported && (
                  <div className="mx-3 md:mx-4 mb-2 text-[10px] text-muted-foreground italic text-center">
                    Voice input isn't supported in this browser — use the box below.
                  </div>
                )}

                {/* Input bar */}
                <form
                  className="flex items-center gap-2 p-3 md:p-4 border-t border-border/60 bg-background/60"
                  onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
                >
                  <Button
                    type="button" size="icon"
                    variant={micActive ? "destructive" : "outline"}
                    onClick={onToggleMic}
                    disabled={!micSupported}
                    aria-label={micActive ? "Stop listening" : "Tap to speak"}
                    title={micSupported ? (micActive ? "Stop listening" : "Tap to speak") : "Mic not supported"}
                    className="h-11 w-11 shrink-0 relative"
                  >
                    {micActive ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    {micActive && (
                      <motion.span
                        className="absolute inset-0 rounded-md border-2 border-destructive"
                        animate={{ scale: [1, 1.25], opacity: [0.7, 0] }}
                        transition={{ duration: 1.1, repeat: Infinity }}
                      />
                    )}
                  </Button>
                  <input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={micActive ? "Listening…" : "Type or tap mic to speak…"}
                    maxLength={500}
                    disabled={micActive}
                    className="flex-1 h-11 px-3 rounded-md border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                  />
                  <Button
                    type="submit" size="icon"
                    disabled={!inputValue.trim() || pending || micActive}
                    className="h-11 w-11 shrink-0"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </form>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

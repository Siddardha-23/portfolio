/**
 * ConciergePanel - Side dock with transcript, active card, and follow-up chips.
 * On mobile it converts to a bottom sheet automatically via CSS.
 */
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, MicOff, Volume2, VolumeX, X, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { TranscriptEntry } from "./types";
import { CardRenderer } from "./cards/Cards";

interface PanelProps {
  open: boolean;
  onClose: () => void;
  transcript: TranscriptEntry[];
  pending: boolean;
  partial: string;
  inputValue: string;
  setInputValue: (s: string) => void;
  onSubmit: () => void;
  micSupported: boolean;
  micActive: boolean;
  ttsMuted: boolean;
  onToggleMic: () => void;
  onToggleMute: () => void;
  suggestions: string[];
  onSuggestion: (s: string) => void;
  recruiterMode: boolean;
}

export default function ConciergePanel(props: PanelProps) {
  const {
    open, onClose, transcript, pending, partial,
    inputValue, setInputValue, onSubmit,
    micSupported, micActive, ttsMuted,
    onToggleMic, onToggleMute,
    suggestions, onSuggestion, recruiterMode,
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, pending, open]);

  useEffect(() => {
    if (open) {
      // Focus input after open animation
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Pick latest model entry's display card to surface in the active card lane
  const activeCard = [...transcript].reverse().find((t) => t.role === "model" && t.display)?.display || null;

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="concierge-panel"
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed right-0 top-0 bottom-0 z-[55] w-full sm:w-[420px] md:w-[440px] bg-background/95 backdrop-blur-xl border-l border-border/60 shadow-2xl flex flex-col"
          role="dialog"
          aria-label="Concierge panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold leading-tight">The Concierge</div>
                <div className="text-[10px] text-muted-foreground leading-tight">
                  {recruiterMode ? "Recruiter mode · Harshith's AI avatar" : "Harshith's AI avatar"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon" variant="ghost"
                onClick={onToggleMute}
                aria-label={ttsMuted ? "Unmute" : "Mute"}
                title={ttsMuted ? "Unmute voice" : "Mute voice (transcript continues)"}
                className="h-8 w-8"
              >
                {ttsMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Button
                size="icon" variant="ghost"
                onClick={onClose}
                aria-label="Close panel"
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Active card lane */}
          {activeCard && (
            <div className="px-4 pt-3">
              <CardRenderer card={activeCard} />
            </div>
          )}

          {/* Transcript */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scroll-smooth">
            {transcript.length === 0 && !pending && (
              <div className="text-center text-xs text-muted-foreground py-12">
                <p className="mb-1 font-medium">Ask me anything.</p>
                <p>Try the suggestions below — I'll show you around.</p>
              </div>
            )}
            {transcript.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    t.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted/70 rounded-tl-sm"
                  }`}
                >
                  {t.caption || t.text}
                </div>
              </motion.div>
            ))}
            {pending && (
              <div className="flex items-center gap-1.5 px-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-primary/50"
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
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
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

          {/* Input bar */}
          <form
            className="flex items-center gap-2 p-3 border-t border-border/60 bg-background/80"
            onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
          >
            <Button
              type="button"
              size="icon"
              variant={micActive ? "default" : "outline"}
              onClick={onToggleMic}
              disabled={!micSupported}
              aria-label={micActive ? "Stop listening" : "Push to talk"}
              title={micSupported ? "Push to talk" : "Mic not supported in this browser"}
              className="h-9 w-9 shrink-0"
            >
              {micActive ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask about skills, projects, or paste a JD…"
              maxLength={500}
              className="flex-1 h-9 px-3 rounded-md border border-border/60 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || pending}
              className="h-9 w-9 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

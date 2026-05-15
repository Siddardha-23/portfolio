/**
 * ConciergeStage - "Spotlight" UI (not a chatbot).
 *
 * Replaces the message-bubble transcript with a single-focus layout:
 *   - Top : the question you just asked, in a glowing banner.
 *   - Mid : the active response area. Changes based on state:
 *           • IDLE  → friendly hero copy + starter chips
 *           • LISTENING → HUGE live transcript of your voice, mic pulse,
 *                         waveform-style amplitude bars, big Stop button
 *           • THINKING  → echo of the question + Aria's "thinking" stream
 *           • SPEAKING/IDLE post-answer → big answer text + active card
 *   - Hist: collapsed history rail (chips you can scrub to recall prior
 *           turns) instead of bubbles stacked all the way up the panel.
 *   - Foot: suggestion chips + mic + input + send.
 *
 * Live transcription is the centerpiece while the mic is hot — words
 * appear at 24-28px as recognition fires, so it's impossible to miss.
 */
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  Send, Mic, MicOff, Volume2, VolumeX, X, Minimize2, Maximize2,
  Sparkles, Radio, Clock, Quote,
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
  micError: string | null;
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

/** Compact audio-amplitude bar viz (synthesizes a visual while no real
 *  PCM stream is hooked up to the AnalyserNode). */
function VoiceWaveform({ active }: { active: boolean }) {
  const bars = 24;
  return (
    <div className="flex items-end justify-center gap-1 h-10">
      {Array.from({ length: bars }).map((_, i) => (
        <motion.span
          key={i}
          className="w-1 rounded-full bg-primary"
          initial={{ height: 6 }}
          animate={{
            height: active
              ? [4, 8 + Math.random() * 22, 4 + Math.random() * 8, 14, 4]
              : 4,
          }}
          transition={{
            duration: 0.8 + Math.random() * 0.6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.04,
          }}
        />
      ))}
    </div>
  );
}

export default function ConciergeStage(props: StageProps) {
  const {
    open, minimized, onClose, onMinimize, onRestore,
    transcript, pending, partial, inputValue, setInputValue, onSubmit,
    micSupported, micActive, micError, ttsMuted, ttsAmplitude,
    onToggleMic, onToggleMute, suggestions, onSuggestion, recruiterMode,
    avatarState, emotion,
  } = props;

  const inputRef = useRef<HTMLInputElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (open && !minimized) {
      const t = setTimeout(() => inputRef.current?.focus(), 320);
      return () => clearTimeout(t);
    }
  }, [open, minimized]);

  // Latest pair
  const lastUserTurn = [...transcript].reverse().find((t) => t.role === "user");
  const lastModelTurn = [...transcript].reverse().find((t) => t.role === "model");
  const activeCard = lastModelTurn?.display || null;
  const latestModelText = lastModelTurn?.caption || lastModelTurn?.text || "";

  // Visual state for the central spotlight
  const showListening = micActive;
  const showThinking = pending && !micActive;
  const showAnswer = !showListening && !showThinking && !!lastModelTurn;
  const showIdle = !showListening && !showThinking && !lastModelTurn;

  const historyTurns = transcript.filter((t) => t.role === "user");

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
          {/* Backdrop (decorative only — close via header buttons) */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ backdropFilter: "blur(0px)", backgroundColor: "rgba(0,0,0,0)" }}
            animate={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(8,4,20,0.55)" }}
            exit={{ backdropFilter: "blur(0px)", backgroundColor: "rgba(0,0,0,0)" }}
            transition={{ duration: 0.35 }}
          />

          <div className="relative h-full w-full flex flex-col md:flex-row">

            {/* ===== Avatar stage (mobile: top, desktop: LEFT) ===== */}
            <motion.div
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="hidden md:flex md:w-[45%] lg:w-[42%] items-center justify-center relative pointer-events-none py-6"
            >
              <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[60%] h-28 pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse at center bottom, hsl(200 95% 60% / 0.45), transparent 70%)",
                  filter: "blur(20px)",
                }}
              />
              <div
                className="absolute inset-y-4 left-1/2 -translate-x-1/2 w-[70%] pointer-events-none"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 0%, hsl(200 95% 60% / 0.12) 30%, hsl(180 95% 60% / 0.18) 70%, transparent 100%)",
                }}
              />
              <div className="relative h-full max-h-[88vh] flex items-center justify-center">
                <Avatar
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

            {/* ===== Spotlight window (mobile: bottom, desktop: RIGHT) ===== */}
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
                        {recruiterMode ? "Recruiter mode active" : "Aris · ask anything"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {historyTurns.length > 0 && (
                      <Button size="icon" variant="ghost"
                        onClick={() => setHistoryOpen((v) => !v)}
                        aria-label="History"
                        title={`${historyTurns.length} turn${historyTurns.length === 1 ? "" : "s"} in this session`}
                        className="h-8 w-8"
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={onToggleMute}
                      aria-label={ttsMuted ? "Unmute" : "Mute"}
                      title={ttsMuted ? "Unmute voice" : "Mute voice"}
                      className="h-8 w-8"
                    >
                      {ttsMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={onMinimize}
                      aria-label="Minimize" title="Minimize"
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

                {/* Question banner — only when there's a current turn and not listening */}
                <AnimatePresence>
                  {lastUserTurn && !showListening && (
                    <motion.div
                      key={lastUserTurn.id}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                      className="mx-4 md:mx-5 mt-4 mb-2 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/20"
                    >
                      <div className="flex items-start gap-2">
                        <Quote className="h-3.5 w-3.5 text-primary mt-1 shrink-0" />
                        <div>
                          <div className="text-[10px] uppercase tracking-wider font-semibold text-primary">
                            You asked
                          </div>
                          <div className="text-sm font-medium text-foreground leading-snug">
                            {lastUserTurn.text}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ===== SPOTLIGHT main area ===== */}
                <div className="flex-1 overflow-y-auto px-4 md:px-5 py-3 scroll-smooth">

                  {/* IDLE state */}
                  {showIdle && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-full flex flex-col items-center justify-center text-center py-8"
                    >
                      <div className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
                        Ask me anything.
                      </div>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        I'm Aris — Harshith's AI Concierge.
                        Speak or type and I'll show you his work.
                      </p>
                    </motion.div>
                  )}

                  {/* LISTENING state — HUGE live transcript */}
                  <AnimatePresence>
                    {showListening && (
                      <motion.div
                        key="listening-spotlight"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="h-full flex flex-col items-center justify-center text-center"
                      >
                        {/* Pulsing mic icon */}
                        <div className="relative mb-4">
                          <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-2xl shadow-primary/40">
                            <Mic className="h-7 w-7" />
                          </div>
                          <motion.div
                            className="absolute inset-0 rounded-full border-2 border-primary"
                            initial={{ scale: 1, opacity: 0.7 }}
                            animate={{ scale: [1, 1.5], opacity: [0.7, 0] }}
                            transition={{ duration: 1.2, repeat: Infinity }}
                          />
                          <motion.div
                            className="absolute inset-0 rounded-full border-2 border-primary"
                            initial={{ scale: 1, opacity: 0.7 }}
                            animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                          />
                        </div>

                        {/* Status line */}
                        <div className="text-xs uppercase font-semibold tracking-widest text-primary flex items-center gap-2 mb-4">
                          <Radio className="h-3 w-3 animate-pulse" />
                          Listening
                        </div>

                        {/* HUGE live transcript */}
                        <div className="min-h-[80px] md:min-h-[110px] w-full max-w-md flex items-center justify-center">
                          {partial ? (
                            <motion.div
                              key={partial}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-xl md:text-2xl font-medium leading-snug text-foreground"
                            >
                              {partial}
                              <motion.span
                                className="inline-block w-[2px] h-5 bg-primary ml-1 align-middle"
                                animate={{ opacity: [1, 0, 1] }}
                                transition={{ duration: 0.8, repeat: Infinity }}
                              />
                            </motion.div>
                          ) : (
                            <div className="text-base md:text-lg text-muted-foreground italic">
                              Speak now — I'll transcribe in real time
                            </div>
                          )}
                        </div>

                        {/* Waveform */}
                        <div className="mt-6">
                          <VoiceWaveform active={micActive} />
                        </div>

                        {/* Stop button */}
                        <Button onClick={onToggleMic} className="mt-6 px-6" size="lg">
                          <MicOff className="h-4 w-4 mr-2" />
                          Stop & Ask
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* THINKING state */}
                  {showThinking && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-full flex flex-col items-center justify-center text-center"
                    >
                      <div className="text-sm uppercase tracking-widest font-semibold text-primary mb-3">
                        Thinking
                      </div>
                      <div className="flex items-center gap-2">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="w-3 h-3 rounded-full bg-primary"
                            animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18 }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* ANSWER state */}
                  {showAnswer && lastModelTurn && (
                    <motion.div
                      key={lastModelTurn.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="space-y-4"
                    >
                      {/* Aris label + answer */}
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[10px] uppercase tracking-wider font-semibold text-primary mb-1">
                            Aris
                          </div>
                          <div className="text-base md:text-lg leading-relaxed text-foreground/90 whitespace-pre-wrap">
                            {lastModelTurn.caption || lastModelTurn.text}
                          </div>
                        </div>
                      </div>

                      {/* Active visual card */}
                      {activeCard && <CardRenderer card={activeCard} />}
                    </motion.div>
                  )}

                  {/* History panel — collapsed unless toggled */}
                  <AnimatePresence>
                    {historyOpen && historyTurns.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-6 pt-4 border-t border-border/60"
                      >
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                          Earlier in this session
                        </div>
                        <div className="space-y-2">
                          {historyTurns.slice(0, -1).reverse().map((t) => (
                            <button
                              key={t.id}
                              onClick={() => onSuggestion(t.text)}
                              className="w-full text-left px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/60 text-xs transition-colors"
                            >
                              <span className="text-muted-foreground">↻ </span>
                              {t.text}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Suggestion chips */}
                {suggestions.length > 0 && !pending && !micActive && (
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

                {/* Mic CTA pill — only when idle */}
                {!micActive && micSupported && !inputValue && !showListening && (
                  <div className="mx-3 md:mx-4 mb-2">
                    <button
                      type="button"
                      onClick={onToggleMic}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors px-4 py-2.5 text-xs font-medium text-primary group"
                    >
                      <Mic className="h-4 w-4" />
                      Tap to speak with Aris
                      <span className="text-[10px] text-muted-foreground font-normal hidden sm:inline">
                        · live transcript appears as you talk
                      </span>
                    </button>
                  </div>
                )}

                {!micSupported && (
                  <div className="mx-3 md:mx-4 mb-2 text-[10px] text-muted-foreground italic text-center">
                    Voice input isn't supported in this browser — use the box below.
                  </div>
                )}

                {micError && (
                  <div className="mx-3 md:mx-4 mb-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-[11px] text-destructive">
                    {micError}
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
                        initial={{ scale: 1, opacity: 0.7 }}
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

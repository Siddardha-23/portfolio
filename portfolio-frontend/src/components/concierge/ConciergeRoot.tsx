/**
 * ConciergeRoot - The animated AI avatar that drives Harshith's portfolio.
 *
 * Responsibilities:
 *   - Floating trigger button on idle.
 *   - On click: avatar materializes, side panel slides in.
 *   - Owns state machine: idle | listening | thinking | speaking.
 *   - Pumps user input → backend → executes intents + renders cards + speaks.
 *   - Detects recruiter context from query string / referrer.
 *   - Per-session cost guardrail (TURNS_PER_SESSION).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircleHeart, Sparkles } from "lucide-react";
import Avatar, { AvatarState } from "./Avatar";
import ConciergePanel from "./ConciergePanel";
import { useMic } from "./useMic";
import { useTTS } from "./useTTS";
import { runConciergeTurn } from "./transport";
import { executeIntents, detectCurrentSection } from "./IntentBus";
import type { ConciergeTurn, TranscriptEntry } from "./types";

const TURNS_PER_SESSION = 40;
const STORAGE_KEY = "concierge:turns";

function readTurnCount(): number {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch { return 0; }
}
function bumpTurnCount(): number {
  const next = readTurnCount() + 1;
  try { sessionStorage.setItem(STORAGE_KEY, String(next)); } catch { /* no-op */ }
  return next;
}

function detectRecruiterMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(window.location.href);
    const from = url.searchParams.get("from") || url.searchParams.get("utm_source") || "";
    if (/recruiter|linkedin|indeed|wellfound|builtin/i.test(from)) return true;
    const ref = document.referrer || "";
    if (/linkedin\.com|indeed\.com|wellfound\.com|builtin\.com/i.test(ref)) return true;
    // Manual override via localStorage
    if (localStorage.getItem("concierge:recruiter") === "1") return true;
    return false;
  } catch { return false; }
}

interface ConciergeRootProps {
  /** Optional: render the trigger inside an existing container instead of fixed. */
  hideTrigger?: boolean;
}

export default function ConciergeRoot({ hideTrigger = false }: ConciergeRootProps) {
  const [open, setOpen] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([
    "Show me your projects",
    "What are your top skills?",
    "Tell me about AEROSEC",
  ]);
  const [emotion, setEmotion] = useState<ConciergeTurn["emotion"]>("neutral");
  const [recruiterMode] = useState<boolean>(detectRecruiterMode);
  const [trayHint, setTrayHint] = useState(false);

  const mic = useMic();
  const tts = useTTS();
  const turnCountRef = useRef<number>(readTurnCount());

  // Compute the avatar state for the Avatar component
  const avatarState: AvatarState = pending
    ? "thinking"
    : mic.listening
      ? "listening"
      : tts.speaking
        ? "speaking"
        : "idle";

  // After mount, tease the trigger so visitors notice it
  useEffect(() => {
    const t = setTimeout(() => setTrayHint(true), 2400);
    const t2 = setTimeout(() => setTrayHint(false), 8000);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, []);

  // Greet on first open
  useEffect(() => {
    if (!open || hasGreeted) return;
    setHasGreeted(true);
    const greeting: TranscriptEntry = {
      id: `model-${Date.now()}`,
      role: "model",
      text: recruiterMode
        ? "Hey — I'm Harshith. Want the 30-second pitch, or should I just show you my best work?"
        : "Hey, I'm Harshith. Ask me anything about my work, or I can give you the tour.",
      caption: recruiterMode
        ? "Hey — I'm Harshith. Want the **30-second pitch**, or should I just show you my best work?"
        : "Hey, I'm Harshith. Ask me anything about my work, or I can give you the tour.",
      emotion: "happy",
      ts: Date.now(),
    };
    setTranscript([greeting]);
    setEmotion("happy");
    if (recruiterMode) {
      setSuggestions(["Give me the 30-second pitch", "Show me your AWS projects", "Paste a JD to match"]);
    }
    tts.speak(greeting.text);
  }, [open, hasGreeted, recruiterMode, tts]);

  const buildHistory = useCallback((): Array<{ role: string; content: string }> => {
    return transcript
      .filter((t) => t.role === "user" || t.role === "model")
      .slice(-12)
      .map((t) => ({ role: t.role, content: t.text }));
  }, [transcript]);

  const sendMessage = useCallback(async (raw: string) => {
    const message = raw.trim().slice(0, 500);
    if (!message || pending) return;

    if (turnCountRef.current >= TURNS_PER_SESSION) {
      const cap: TranscriptEntry = {
        id: `model-${Date.now()}`,
        role: "model",
        text: "I've chatted a lot this session — for more, refresh the page. Or email me directly.",
        emotion: "thoughtful",
        ts: Date.now(),
      };
      setTranscript((prev) => [...prev, cap]);
      tts.speak(cap.text);
      return;
    }

    const userEntry: TranscriptEntry = {
      id: `user-${Date.now()}`,
      role: "user",
      text: message,
      ts: Date.now(),
    };
    setTranscript((prev) => [...prev, userEntry]);
    setInputValue("");
    setPending(true);
    tts.cancel(); // stop any in-flight speech when user takes a turn

    try {
      const envelope = await runConciergeTurn({
        message,
        history: buildHistory(),
        current_section: detectCurrentSection(),
        recruiter_mode: recruiterMode,
      });

      turnCountRef.current = bumpTurnCount();

      const modelEntry: TranscriptEntry = {
        id: `model-${Date.now()}`,
        role: "model",
        text: envelope.spoken,
        caption: envelope.caption,
        display: envelope.display,
        emotion: envelope.emotion,
        ts: Date.now(),
      };
      setTranscript((prev) => [...prev, modelEntry]);
      setSuggestions(envelope.suggestions?.length ? envelope.suggestions : suggestions);
      setEmotion(envelope.emotion);

      // Fire intents in parallel with speech for that "moves while talking" feel
      void executeIntents(envelope.intents as any);
      tts.speak(envelope.spoken);
    } catch (err) {
      const errEntry: TranscriptEntry = {
        id: `model-${Date.now()}`,
        role: "model",
        text: "Something hiccuped. Try again?",
        emotion: "thoughtful",
        ts: Date.now(),
      };
      setTranscript((prev) => [...prev, errEntry]);
      tts.speak(errEntry.text);
    } finally {
      setPending(false);
    }
  }, [pending, buildHistory, recruiterMode, suggestions, tts]);

  const onToggleMic = useCallback(async () => {
    if (mic.listening) {
      const final = await mic.stop();
      if (final) sendMessage(final);
    } else {
      mic.start();
    }
  }, [mic, sendMessage]);

  const onToggleMute = useCallback(() => {
    tts.setMuted(!tts.muted);
  }, [tts]);

  const onSuggestion = useCallback((s: string) => {
    sendMessage(s);
  }, [sendMessage]);

  const onSubmit = useCallback(() => {
    if (inputValue.trim()) sendMessage(inputValue);
  }, [inputValue, sendMessage]);

  const onClose = useCallback(() => {
    tts.cancel();
    if (mic.listening) void mic.stop();
    setOpen(false);
  }, [tts, mic]);

  const avatarSize = useMemo(() => (open ? 220 : 64), [open]);

  return (
    <>
      {/* Floating trigger — visible when panel closed (or always if anchored) */}
      {!hideTrigger && !open && (
        <motion.button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[54] group"
          initial={{ opacity: 0, scale: 0.85, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 1.2, type: "spring", stiffness: 180, damping: 16 }}
          aria-label="Open The Concierge"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="relative">
            <Avatar size={64} state="idle" emotion="happy" />
            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-background flex items-center justify-center">
              <Sparkles className="h-2.5 w-2.5 text-white" />
            </div>
          </div>
          <AnimatePresence>
            {trayHint && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="absolute right-[72px] top-1/2 -translate-y-1/2 whitespace-nowrap px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium shadow-lg"
              >
                <MessageCircleHeart className="inline h-3.5 w-3.5 mr-1" />
                Talk to me
                <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-primary" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      )}

      {/* Stage Avatar — visible when panel is open, sits to the left of the panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="stage-avatar"
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-6 right-[440px] z-[56] hidden md:block pointer-events-none"
          >
            <Avatar
              size={avatarSize}
              state={avatarState}
              emotion={emotion}
              amplitude={tts.amplitude}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile inline avatar (top of panel) */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-avatar"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden fixed top-3 right-3 z-[57] pointer-events-none"
          >
            <Avatar
              size={72}
              state={avatarState}
              emotion={emotion}
              amplitude={tts.amplitude}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ConciergePanel
        open={open}
        onClose={onClose}
        transcript={transcript}
        pending={pending}
        partial={mic.partial}
        inputValue={inputValue}
        setInputValue={setInputValue}
        onSubmit={onSubmit}
        micSupported={mic.supported}
        micActive={mic.listening}
        ttsMuted={tts.muted}
        onToggleMic={onToggleMic}
        onToggleMute={onToggleMute}
        suggestions={suggestions}
        onSuggestion={onSuggestion}
        recruiterMode={recruiterMode}
      />
    </>
  );
}

/**
 * ConciergeRoot - The animated AI Concierge that drives the portfolio.
 *
 * Split-stage UX (replaces the old chatbot bubble):
 *  - Floating launcher at bottom-right shows the avatar as a teaser.
 *  - Click → full-viewport stage opens: avatar large on the LEFT, panel on
 *    the RIGHT, backdrop dimmed-but-visible.
 *  - When the avatar fires a navigate/highlight/open_project intent, the
 *    stage auto-minimizes to a corner widget so the user can SEE the page
 *    being driven. Restores on click or next user turn.
 *
 * Owns the state machine: idle | listening | thinking | speaking.
 * Recruiter mode detected from URL/referrer.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircleHeart, Sparkles } from "lucide-react";
import Avatar, { AvatarState, AvatarEmotion } from "./Avatar";
import ConciergeStage from "./ConciergeStage";
import { useMic } from "./useMic";
import { useTTS } from "./useTTS";
import { runConciergeTurn } from "./transport";
import { executeIntents, detectCurrentSection } from "./IntentBus";
import type { ConciergeTurn, TranscriptEntry, ConciergeIntent } from "./types";

const TURNS_PER_SESSION = 40;
const STORAGE_KEY = "concierge:turns";

const NAVIGATION_INTENTS = new Set<ConciergeIntent["name"]>([
  "navigate_to_section",
  "highlight_section",
  "open_project",
  "filter_skills",
]);

function readTurnCount(): number {
  try { return parseInt(sessionStorage.getItem(STORAGE_KEY) || "0", 10) || 0; } catch { return 0; }
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
    if (localStorage.getItem("concierge:recruiter") === "1") return true;
    return false;
  } catch { return false; }
}

export default function ConciergeRoot() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([
    "Show me your projects",
    "What are your top skills?",
    "Tell me about AEROSEC",
  ]);
  const [emotion, setEmotion] = useState<AvatarEmotion>("neutral");
  const [recruiterMode] = useState<boolean>(detectRecruiterMode);
  const [trayHint, setTrayHint] = useState(false);

  const mic = useMic();
  const tts = useTTS();
  const turnCountRef = useRef<number>(readTurnCount());

  const avatarState: AvatarState = pending
    ? "thinking"
    : mic.listening
      ? "listening"
      : tts.speaking
        ? "speaking"
        : "idle";

  useEffect(() => {
    const t = setTimeout(() => setTrayHint(true), 2400);
    const t2 = setTimeout(() => setTrayHint(false), 8200);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, []);

  // Greet on first open
  useEffect(() => {
    if (!open || hasGreeted) return;
    setHasGreeted(true);
    const greetSpoken = recruiterMode
      ? "Hey, I'm Nimbus — Harshith's AI Concierge. Want the 30-second pitch, or should I show you his best work?"
      : "Hey, I'm Nimbus — Harshith's AI Concierge. Ask me anything, or I can give you the tour.";
    const greeting: TranscriptEntry = {
      id: `model-${Date.now()}`,
      role: "model",
      text: greetSpoken,
      caption: greetSpoken,
      emotion: "happy",
      ts: Date.now(),
    };
    setTranscript([greeting]);
    setEmotion("happy");
    if (recruiterMode) {
      setSuggestions(["Give me the 30-second pitch", "Show me your AWS projects", "Paste a JD to match"]);
    }
    tts.speak(greetSpoken);
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
        text: "I've chatted a lot this session — for more, refresh the page. Or email Harshith directly.",
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
    setMinimized(false); // restore stage when user submits a new turn
    tts.cancel();

    try {
      const envelope: ConciergeTurn = await runConciergeTurn({
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

      // Auto-minimize when the avatar is about to move the page — so the user can SEE it
      const willNavigate = envelope.intents?.some((it) => NAVIGATION_INTENTS.has(it.name));
      if (willNavigate) {
        // Tiny delay so the caption + speech start before the stage shrinks
        window.setTimeout(() => setMinimized(true), 350);
      }

      void executeIntents(envelope.intents as ConciergeIntent[]);
      tts.speak(envelope.spoken);
    } catch {
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

  const onToggleMute = useCallback(() => tts.setMuted(!tts.muted), [tts]);
  const onSuggestion = useCallback((s: string) => sendMessage(s), [sendMessage]);
  const onSubmit = useCallback(() => { if (inputValue.trim()) sendMessage(inputValue); }, [inputValue, sendMessage]);
  const onClose = useCallback(() => {
    tts.cancel();
    if (mic.listening) void mic.stop();
    setOpen(false);
    setMinimized(false);
  }, [tts, mic]);

  return (
    <>
      {/* Launcher — visible only when fully closed */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="concierge-launcher"
            onClick={() => { setOpen(true); setMinimized(false); }}
            // Compact circular launcher at far-right, vertically centered low.
            // FloatingFormPrompt lives at bottom-LEFT so no horizontal clash;
            // we sit above the page footer so we don't cover content.
            className="fixed bottom-6 right-4 z-[55] group"
            initial={{ opacity: 0, scale: 0.85, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 16 }}
            transition={{ delay: 0.6, type: "spring", stiffness: 180, damping: 16 }}
            aria-label="Open The Concierge"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="relative h-14 w-14 rounded-full overflow-hidden bg-background/85 backdrop-blur-xl border border-border/60 shadow-2xl flex items-center justify-center">
              {/* Just the head — much more compact than full-body */}
              <div className="absolute inset-0 flex items-center justify-center scale-[2.2] translate-y-[18%]">
                <Avatar size={56} state="idle" emotion="happy" />
              </div>
              <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-background flex items-center justify-center z-20">
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
                  Meet Aria, my AI
                  <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-primary" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        )}
      </AnimatePresence>

      <ConciergeStage
        open={open}
        minimized={minimized}
        onClose={onClose}
        onMinimize={() => setMinimized(true)}
        onRestore={() => setMinimized(false)}
        transcript={transcript}
        pending={pending}
        partial={mic.partial}
        inputValue={inputValue}
        setInputValue={setInputValue}
        onSubmit={onSubmit}
        micSupported={mic.supported}
        micActive={mic.listening}
        micError={mic.error}
        audioLevel={mic.audioLevel}
        ttsMuted={tts.muted}
        ttsAmplitude={tts.amplitude}
        onToggleMic={onToggleMic}
        onToggleMute={onToggleMute}
        suggestions={suggestions}
        onSuggestion={onSuggestion}
        recruiterMode={recruiterMode}
        avatarState={avatarState}
        emotion={emotion}
      />
    </>
  );
}

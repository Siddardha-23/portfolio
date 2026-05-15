/**
 * useTTS - Browser SpeechSynthesis with a synthesized amplitude signal for lipsync.
 *
 * Real audio-level analysis from SpeechSynthesis is impossible in browsers
 * (no PCM output). Instead we synthesize a plausible amplitude envelope using:
 *   - onboundary events (word timing) → punch peaks
 *   - syllable estimation per word → faster oscillation
 *   - small random jitter → naturalness
 * The avatar consumes this 0..1 amplitude every animation frame.
 *
 * Mute disables audio output but the amplitude signal still pulses, so the
 * panel transcript keeps animating in sync with what *would* be spoken.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface UseTTSResult {
  supported: boolean;
  speaking: boolean;
  muted: boolean;
  amplitude: number;
  speak: (text: string, opts?: { onEnd?: () => void }) => void;
  cancel: () => void;
  setMuted: (m: boolean) => void;
  selectedVoice: SpeechSynthesisVoice | null;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  // Prefer high-quality English male voices that sound natural
  const ranked = [
    /Google US English/i,
    /Google UK English Male/i,
    /Microsoft Guy/i,
    /Microsoft Brandon/i,
    /Microsoft Ryan/i,
    /Daniel/i,
    /Alex/i,
  ];
  for (const re of ranked) {
    const v = voices.find((v) => re.test(v.name) && /en/i.test(v.lang));
    if (v) return v;
  }
  return voices.find((v) => /en[-_]US/i.test(v.lang)) || voices[0];
}

function estimateSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 1;
  const groups = w.match(/[aeiouy]+/g) || [];
  return Math.max(1, groups.length);
}

export function useTTS(): UseTTSResult {
  const supported = typeof window !== "undefined" && !!window.speechSynthesis;
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [amplitude, setAmplitude] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const rafRef = useRef<number | null>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const peakRef = useRef<number>(0);
  const peakAtRef = useRef<number>(0);
  const wordCharsRef = useRef<number>(4);

  useEffect(() => {
    if (!supported) return;
    const update = () => setSelectedVoice(pickVoice());
    update();
    window.speechSynthesis.onvoiceschanged = update;
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
    };
  }, [supported]);

  // Drive amplitude signal — runs while speaking even if muted (so visual continues)
  useEffect(() => {
    if (!speaking) {
      setAmplitude(0);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      const now = performance.now();
      const sincePeak = now - peakAtRef.current;
      // Decay from the last word-boundary peak, with high-frequency syllable wobble
      const base = Math.max(0, peakRef.current - sincePeak / 320);
      const wobble = (Math.sin(now / 60) + Math.sin(now / 41)) * 0.08;
      const jitter = (Math.random() - 0.5) * 0.06;
      const amp = Math.max(0, Math.min(1, base + wobble + jitter));
      setAmplitude(amp);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [speaking]);

  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
    if (m && supported) {
      // Cancel audio playback but keep amplitude pulse via fake timer below
      window.speechSynthesis.cancel();
    }
  }, [supported]);

  const speak = useCallback((text: string, opts?: { onEnd?: () => void }) => {
    if (!supported || !text.trim()) {
      opts?.onEnd?.();
      return;
    }
    // Cancel anything in flight
    try { window.speechSynthesis.cancel(); } catch { /* no-op */ }

    setSpeaking(true);
    peakRef.current = 0.4;
    peakAtRef.current = performance.now();

    // If muted, simulate speaking with a timer to drive amplitude + onEnd
    if (muted) {
      const approxDur = Math.max(1200, text.length * 55); // ~55ms per char
      const start = performance.now();
      let lastPeak = start;
      const sim = setInterval(() => {
        const now = performance.now();
        if (now - lastPeak > 240) {
          peakRef.current = 0.5 + Math.random() * 0.4;
          peakAtRef.current = now;
          lastPeak = now;
        }
        if (now - start >= approxDur) {
          clearInterval(sim);
          setSpeaking(false);
          opts?.onEnd?.();
        }
      }, 60);
      return;
    }

    const u = new SpeechSynthesisUtterance(text);
    const v = selectedVoice || pickVoice();
    if (v) u.voice = v;
    u.rate = 1.05;
    u.pitch = 1.0;
    u.volume = 1.0;
    utterRef.current = u;

    u.onboundary = (evt: SpeechSynthesisEvent) => {
      // 'word' boundary — extract char span and estimate syllables
      const idx = (evt as any).charIndex ?? 0;
      const len = (evt as any).charLength ?? 0;
      const word = len > 0 ? text.slice(idx, idx + len) : text.slice(idx).split(/\s+/)[0] || "a";
      const sylls = estimateSyllables(word);
      wordCharsRef.current = Math.max(1, word.length);
      // Peak proportional to syllables (capped)
      peakRef.current = Math.min(0.95, 0.5 + sylls * 0.12);
      peakAtRef.current = performance.now();
    };

    u.onend = () => {
      setSpeaking(false);
      utterRef.current = null;
      opts?.onEnd?.();
    };

    u.onerror = () => {
      setSpeaking(false);
      utterRef.current = null;
      opts?.onEnd?.();
    };

    try {
      window.speechSynthesis.speak(u);
    } catch {
      setSpeaking(false);
      opts?.onEnd?.();
    }
  }, [supported, muted, selectedVoice]);

  const cancel = useCallback(() => {
    if (supported) {
      try { window.speechSynthesis.cancel(); } catch { /* no-op */ }
    }
    setSpeaking(false);
    setAmplitude(0);
    utterRef.current = null;
  }, [supported]);

  // Cleanup on unmount
  useEffect(() => () => cancel(), [cancel]);

  return { supported, speaking, muted, amplitude, speak, cancel, setMuted, selectedVoice };
}

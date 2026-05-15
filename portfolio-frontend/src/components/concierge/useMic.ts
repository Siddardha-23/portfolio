/**
 * useMic - Push-to-talk Web Speech API wrapper.
 *
 * Yields partial transcripts while the user holds the mic, and a final
 * transcript on stop. Gracefully reports unsupported environments so the UI
 * can hide the mic button on Safari/Firefox without crashing.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface UseMicResult {
  supported: boolean;
  listening: boolean;
  partial: string;
  start: () => void;
  stop: () => Promise<string>;
  error: string | null;
}

interface MinimalSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
}

function getRecognitionCtor(): { new (): MinimalSpeechRecognition } | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useMic(): UseMicResult {
  const Ctor = getRecognitionCtor();
  const supported = !!Ctor;
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MinimalSpeechRecognition | null>(null);
  const finalRef = useRef<string>("");

  useEffect(() => {
    return () => {
      try { recRef.current?.abort(); } catch { /* no-op */ }
    };
  }, []);

  const start = useCallback(() => {
    if (!Ctor || listening) return;
    setError(null);
    setPartial("");
    finalRef.current = "";

    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (final) finalRef.current += final + " ";
      setPartial((finalRef.current + interim).trim());
    };

    rec.onerror = (e: any) => {
      const code = e?.error || "unknown";
      // Don't surface aborts/no-speech as real errors
      if (code !== "aborted" && code !== "no-speech") setError(code);
      setListening(false);
    };

    rec.onend = () => setListening(false);

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch (err: any) {
      setError(err?.message || "Failed to start microphone");
      setListening(false);
    }
  }, [Ctor, listening]);

  const stop = useCallback(async (): Promise<string> => {
    const rec = recRef.current;
    if (!rec) return finalRef.current.trim();
    return new Promise<string>((resolve) => {
      const prevOnEnd = rec.onend;
      rec.onend = () => {
        prevOnEnd?.();
        resolve((finalRef.current + partial).trim());
      };
      try { rec.stop(); } catch { resolve(finalRef.current.trim()); }
    });
  }, [partial]);

  return { supported, listening, partial, start, stop, error };
}

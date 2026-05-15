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

  const start = useCallback(async () => {
    if (!Ctor || listening) return;
    setError(null);
    setPartial("");
    finalRef.current = "";

    // Preflight: explicitly request mic permission via getUserMedia so the
    // browser shows a clear permission prompt (some browsers won't prompt
    // from SpeechRecognition.start() alone, especially after a prior denial).
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // We don't actually consume the stream — SpeechRecognition uses its
        // own mic pipeline. Stop the tracks immediately to release the LED.
        stream.getTracks().forEach((t) => t.stop());
      } catch (permErr: any) {
        const name = permErr?.name || "NotAllowedError";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setError("Mic permission denied. Click the 🔒 in your browser's address bar to allow it.");
        } else if (name === "NotFoundError") {
          setError("No microphone found on this device.");
        } else {
          setError(`Mic unavailable: ${name}`);
        }
        return;
      }
    }

    const rec = new Ctor();
    // continuous=true so a brief pause mid-sentence doesn't end recognition
    rec.continuous = true;
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
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("Mic permission denied. Allow it in your browser's site settings.");
      } else if (code === "no-speech") {
        // Don't surface — common false positive when user is thinking
      } else if (code === "audio-capture") {
        setError("No mic detected. Plug one in and try again.");
      } else if (code === "network") {
        setError("Network hiccup — voice service unreachable.");
      } else if (code !== "aborted") {
        setError(`Voice error: ${code}`);
      }
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

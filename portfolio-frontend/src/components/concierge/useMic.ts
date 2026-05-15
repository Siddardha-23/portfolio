/**
 * useMic - Voice capture with real mic-level monitoring + Web Speech.
 *
 * The previous implementation only wired the Web Speech API. When recognition
 * silently failed (browser bug, mic muted, etc.) the user got no feedback —
 * they could see "Listening…" but nothing was being captured.
 *
 * This version runs THREE things in parallel while the mic is hot:
 *   1. Web Speech API → text transcript
 *   2. Live MediaStream via getUserMedia → kept open so we can…
 *   3. AnalyserNode tap → real RMS audio level (0..1) exposed as `audioLevel`
 *
 * The audioLevel proves the mic is hearing sound even if Web Speech is
 * silently failing. The UI surfaces it as a live waveform/meter — the user
 * can see if their voice is reaching the browser at all.
 *
 * On stop, all three are cleaned up.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface UseMicResult {
  supported: boolean;
  listening: boolean;
  partial: string;
  /** RMS amplitude of the live mic stream, 0..1. Proves the mic is hearing audio. */
  audioLevel: number;
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
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onaudioend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
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
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<MinimalSpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const finalRef = useRef<string>("");

  const cleanupAudio = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (analyserRef.current) {
      try { analyserRef.current.disconnect(); } catch { /* no-op */ }
      analyserRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* no-op */ }
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      try { recRef.current?.abort(); } catch { /* no-op */ }
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const startAudioMeter = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // autoGainControl: false fixes the "loud for 3 sec then quiet" bug —
        // AGC silently reduces gain after detecting loud input, which made
        // the level meter (and the apparent voice loudness) drop off. We
        // keep echoCancellation so we don't feed back the TTS, and keep
        // noiseSuppression to avoid spurious recognition on background noise.
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      // Audio analyser pipeline
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(buf);
        // RMS
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        // Light easing toward 0..1; voice typically peaks around 0.1-0.3
        setAudioLevel(Math.min(1, rms * 4));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      return stream;
    } catch (e: any) {
      const name = e?.name || "NotAllowedError";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Mic permission denied. Click the 🔒 in your browser's address bar and allow microphone.");
      } else if (name === "NotFoundError") {
        setError("No microphone found on this device.");
      } else {
        setError(`Mic unavailable: ${name}`);
      }
      return null;
    }
  }, []);

  const start = useCallback(async () => {
    if (!Ctor || listening) return;
    setError(null);
    setPartial("");
    finalRef.current = "";

    // 1. Get the live mic stream (and start the level meter)
    const stream = await startAudioMeter();
    if (!stream) {
      // Permission denied or no device — error already set
      return;
    }

    // 2. Start Web Speech recognition
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => {
      // Speech recognition has actually started — confirm to the user
      setListening(true);
    };

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
        setError("Didn't catch that — speak a bit louder or closer to your mic.");
      } else if (code === "audio-capture") {
        setError("Mic not capturing. Plug in / check your input device.");
      } else if (code === "network") {
        setError("Voice service unreachable. Web Speech needs an online connection.");
      } else if (code === "aborted") {
        // Expected on stop — no message
      } else {
        setError(`Voice error: ${code}`);
      }
      setListening(false);
      cleanupAudio();
    };

    rec.onend = () => {
      setListening(false);
      cleanupAudio();
    };

    try {
      rec.start();
      recRef.current = rec;
      // Optimistically flip listening on (onstart will confirm); some browsers
      // never fire onstart even though recognition is running.
      setListening(true);
    } catch (err: any) {
      const msg = err?.message || "Failed to start microphone";
      setError(msg);
      setListening(false);
      cleanupAudio();
    }
  }, [Ctor, listening, startAudioMeter, cleanupAudio]);

  const stop = useCallback(async (): Promise<string> => {
    const rec = recRef.current;
    if (!rec) {
      cleanupAudio();
      return finalRef.current.trim();
    }
    return new Promise<string>((resolve) => {
      const prevOnEnd = rec.onend;
      rec.onend = () => {
        prevOnEnd?.();
        // `partial` already equals (finalRef + interim). Returning
        // finalRef + partial would duplicate the finalized portion
        // (caused the visible "X X" bug). Just use `partial`.
        const text = partial.trim() || finalRef.current.trim();
        cleanupAudio();
        resolve(text);
      };
      try { rec.stop(); } catch { cleanupAudio(); resolve(finalRef.current.trim()); }
    });
  }, [partial, cleanupAudio]);

  return { supported, listening, partial, audioLevel, start, stop, error };
}

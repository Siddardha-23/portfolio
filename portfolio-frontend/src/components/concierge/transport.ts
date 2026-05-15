/**
 * transport.ts - Concierge transport layer.
 *
 * Strategy:
 *   1. Try the WebSocket endpoint (VITE_CONCIERGE_WS_URL or derived from origin)
 *      with a tight handshake budget (1.5s) and a per-turn timeout.
 *   2. Fall back to REST (apiService.sendConciergeTurn) on any WS failure.
 *
 * WebSocket protocol (one turn = one request/response):
 *   client -> { type: "turn", message, history, current_section, recruiter_mode }
 *   server -> { type: "partial", chunk }          // optional incremental text
 *   server -> { type: "final", envelope }          // complete ConciergeTurn
 *   server -> { type: "error", error }
 *
 * The frontend already works in single-shot mode, so progressive text is a
 * pure enhancement: partial chunks update the in-flight transcript bubble.
 */
import { apiService } from "@/lib/api";
import type { ConciergeTurn } from "./types";

export interface TurnRequest {
  message: string;
  history: Array<{ role: string; content: string }>;
  current_section?: string | null;
  recruiter_mode?: boolean;
}

export interface TurnHandlers {
  onPartial?: (chunk: string, accumulated: string) => void;
}

function getWsUrl(): string | null {
  const explicit = (import.meta as any).env?.VITE_CONCIERGE_WS_URL as string | undefined;
  if (explicit) return explicit;
  if (typeof window === "undefined") return null;
  // Build same-origin ws URL (works when API Gateway WebSocket is exposed via /ws)
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  // Only attempt WS in production-like envs (we don't run a WS server locally by default)
  const isLocalhost = /localhost|127\.0\.0\.1/.test(window.location.hostname);
  if (isLocalhost) return null;
  return `${proto}//${window.location.host}/ws/concierge`;
}

const HANDSHAKE_TIMEOUT_MS = 1500;
const TURN_TIMEOUT_MS = 25000;

async function tryWebSocket(req: TurnRequest, handlers: TurnHandlers): Promise<ConciergeTurn | null> {
  const url = getWsUrl();
  if (!url) return null;
  return new Promise<ConciergeTurn | null>((resolve) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      resolve(null);
      return;
    }

    let settled = false;
    let accumulated = "";

    const handshakeTimer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        try { ws.close(); } catch { /* no-op */ }
        resolve(null);
      }
    }, HANDSHAKE_TIMEOUT_MS);

    const turnTimer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        try { ws.close(); } catch { /* no-op */ }
        resolve(null);
      }
    }, TURN_TIMEOUT_MS);

    ws.onopen = () => {
      window.clearTimeout(handshakeTimer);
      try {
        ws.send(JSON.stringify({ type: "turn", ...req }));
      } catch {
        if (!settled) { settled = true; resolve(null); }
      }
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "partial" && typeof msg.chunk === "string") {
          accumulated += msg.chunk;
          handlers.onPartial?.(msg.chunk, accumulated);
        } else if (msg.type === "final" && msg.envelope) {
          settled = true;
          window.clearTimeout(turnTimer);
          try { ws.close(); } catch { /* no-op */ }
          resolve(msg.envelope as ConciergeTurn);
        } else if (msg.type === "error") {
          settled = true;
          window.clearTimeout(turnTimer);
          try { ws.close(); } catch { /* no-op */ }
          resolve(null);
        }
      } catch {
        // Ignore malformed frames
      }
    };

    ws.onerror = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(handshakeTimer);
        window.clearTimeout(turnTimer);
        resolve(null);
      }
    };

    ws.onclose = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(handshakeTimer);
        window.clearTimeout(turnTimer);
        resolve(null);
      }
    };
  });
}

/** Run a turn — tries WebSocket first, falls back to REST. */
export async function runConciergeTurn(
  req: TurnRequest,
  handlers: TurnHandlers = {},
): Promise<ConciergeTurn> {
  const wsResult = await tryWebSocket(req, handlers);
  if (wsResult) return wsResult;

  const { data, error } = await apiService.sendConciergeTurn({
    message: req.message,
    history: req.history,
    current_section: req.current_section ?? undefined,
    recruiter_mode: req.recruiter_mode,
  });

  if (data) return data as ConciergeTurn;
  return {
    spoken: "I'm having trouble reaching my brain right now. Try again in a moment?",
    caption: error || "Service unavailable.",
    intents: [],
    display: null,
    suggestions: ["What are your top skills?", "Show me your projects", "How can I reach you?"],
    emotion: "thoughtful",
    success: false,
  };
}

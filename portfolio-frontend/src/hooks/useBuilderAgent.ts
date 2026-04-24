/**
 * useBuilderAgent — drives the multi-agent orchestrator stream.
 *
 * Consumes the POST /api/chat/agent SSE stream (event: <name>\ndata: <json>)
 * and exposes a reactive state machine for the UI to render:
 *
 *   - turns[]        full conversation, each turn has user msg + agent timeline
 *   - status         'idle' | 'streaming' | 'error'
 *   - specialists    metadata for the four specialists (Curator/Builder/Analyst/Concierge)
 *   - activeAgents   set of specialist ids currently "thinking" or running tools
 *   - send(message)  fire a new turn
 *   - cancel()       abort the in-flight stream
 *   - reset()        clear conversation
 *
 * Implementation: native fetch + ReadableStream reader. EventSource isn't an
 * option because the endpoint is POST. We parse the spec-compliant SSE frame
 * format (`event: name\\ndata: payload\\n\\n`) by hand — one allocation per frame.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type SpecialistId = "curator" | "builder" | "analyst" | "concierge" | "orchestrator";

export interface Specialist {
  id: SpecialistId;
  label: string;
  tagline: string;
  tone: string;
}

export interface ToolCall {
  callId: string;
  tool: string;
  specialist: SpecialistId;
  specialistLabel: string;
  specialistTone: string;
  description?: string;
  args: Record<string, unknown>;
  status: "running" | "ok" | "error";
  preview?: Record<string, unknown>;
  startedAt: number;
  finishedAt?: number;
}

export interface AgentAction {
  id: string;
  label: string;
  kind: string;
  value: string;
}

export type Turn =
  | { id: string; role: "user"; content: string }
  | {
      id: string;
      role: "agent";
      sessionId?: string;
      thinkingRound: number;
      toolCalls: ToolCall[];
      streamedText: string;
      finalText?: string;
      actions: AgentAction[];
      latencyMs?: number;
      specialistsUsed: SpecialistId[];
      status: "streaming" | "done" | "error";
      errorMessage?: string;
    };

interface ApiBaseConfig {
  baseUrl: string;
}

const DEFAULT_SPECIALISTS: Specialist[] = [
  { id: "curator", label: "Curator", tagline: "knows the portfolio cold", tone: "amber" },
  { id: "builder", label: "Builder", tagline: "tracks what's shipping right now", tone: "emerald" },
  { id: "analyst", label: "Analyst", tagline: "scores fit honestly", tone: "violet" },
  { id: "concierge", label: "Concierge", tagline: "handles intros & follow-ups", tone: "rose" },
];

function buildBaseUrl(): string {
  const build = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:5000/api";
  if (typeof window !== "undefined" && window.location?.origin && !window.location.origin.includes("localhost")) {
    return `${window.location.origin}/api`;
  }
  return build;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface ParsedFrame {
  event: string;
  data: unknown;
}

/** Pull as many complete SSE frames as we have out of a buffer. */
function drainSseFrames(buffer: string): { frames: ParsedFrame[]; rest: string } {
  const frames: ParsedFrame[] = [];
  let rest = buffer;
  let idx;
  while ((idx = rest.indexOf("\n\n")) !== -1) {
    const raw = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    let event = "message";
    const dataLines: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }
    if (dataLines.length === 0) continue;
    const dataStr = dataLines.join("\n");
    let data: unknown = dataStr;
    try {
      data = JSON.parse(dataStr);
    } catch {
      // pass through as raw string
    }
    frames.push({ event, data });
  }
  return { frames, rest };
}

export function useBuilderAgent(config?: Partial<ApiBaseConfig>) {
  const baseUrl = useMemo(() => config?.baseUrl ?? buildBaseUrl(), [config?.baseUrl]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<"idle" | "streaming" | "error">("idle");
  const [specialists, setSpecialists] = useState<Specialist[]>(DEFAULT_SPECIALISTS);
  const [activeAgents, setActiveAgents] = useState<Set<SpecialistId>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  // Lazy fetch specialist metadata (in case the backend updates it)
  useEffect(() => {
    let cancelled = false;
    fetch(`${baseUrl}/chat/specialists`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        const items = j?.data?.specialists;
        if (Array.isArray(items) && items.length > 0) {
          setSpecialists(items as Specialist[]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setActiveAgents(new Set());
  }, []);

  const reset = useCallback(() => {
    cancel();
    setTurns([]);
  }, [cancel]);

  const updateAgentTurn = useCallback((turnId: string, mutator: (turn: Extract<Turn, { role: "agent" }>) => Extract<Turn, { role: "agent" }>) => {
    setTurns((prev) =>
      prev.map((t) => {
        if (t.id !== turnId || t.role !== "agent") return t;
        return mutator(t);
      }),
    );
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (!message || status === "streaming") return;

      // Build history excluding any error turns
      const history = turns
        .filter((t) => {
          if (t.role === "user") return true;
          return t.role === "agent" && t.status === "done" && t.finalText;
        })
        .slice(-12)
        .map((t) =>
          t.role === "user"
            ? { role: "user", content: t.content }
            : { role: "model", content: (t as Extract<Turn, { role: "agent" }>).finalText ?? "" },
        );

      const userTurn: Turn = { id: newId("u"), role: "user", content: message };
      const agentTurnId = newId("a");
      const agentTurn: Turn = {
        id: agentTurnId,
        role: "agent",
        thinkingRound: 0,
        toolCalls: [],
        streamedText: "",
        actions: [],
        specialistsUsed: [],
        status: "streaming",
      };
      setTurns((prev) => [...prev, userTurn, agentTurn]);
      setStatus("streaming");
      setActiveAgents(new Set(["orchestrator" as SpecialistId]));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const resp = await fetch(`${baseUrl}/chat/agent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ message, history }),
          signal: controller.signal,
        });

        if (!resp.ok || !resp.body) {
          let errorText = `HTTP ${resp.status}`;
          try {
            const j = await resp.json();
            errorText = j.error || errorText;
          } catch {}
          updateAgentTurn(agentTurnId, (t) => ({
            ...t,
            status: "error",
            errorMessage: errorText,
          }));
          setStatus("error");
          setActiveAgents(new Set());
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { frames, rest } = drainSseFrames(buffer);
          buffer = rest;

          for (const frame of frames) {
            const data = frame.data as Record<string, unknown>;
            switch (frame.event) {
              case "session": {
                updateAgentTurn(agentTurnId, (t) => ({
                  ...t,
                  sessionId: typeof data?.session_id === "string" ? data.session_id : undefined,
                }));
                break;
              }
              case "thinking": {
                const round = Number(data?.round ?? 1);
                updateAgentTurn(agentTurnId, (t) => ({ ...t, thinkingRound: round }));
                break;
              }
              case "dispatch": {
                const callId = String(data?.call_id ?? newId("c"));
                const specialist = (data?.specialist as SpecialistId) ?? "orchestrator";
                setActiveAgents((prev) => {
                  const next = new Set(prev);
                  next.delete("orchestrator");
                  next.add(specialist);
                  return next;
                });
                updateAgentTurn(agentTurnId, (t) => ({
                  ...t,
                  toolCalls: [
                    ...t.toolCalls,
                    {
                      callId,
                      tool: String(data?.tool ?? "unknown"),
                      specialist,
                      specialistLabel: String(data?.specialist_label ?? specialist),
                      specialistTone: String(data?.specialist_tone ?? "slate"),
                      description: typeof data?.description === "string" ? (data.description as string) : "",
                      args: (data?.args as Record<string, unknown>) ?? {},
                      status: "running",
                      startedAt: Date.now(),
                    },
                  ],
                  specialistsUsed: t.specialistsUsed.includes(specialist)
                    ? t.specialistsUsed
                    : [...t.specialistsUsed, specialist],
                }));
                break;
              }
              case "tool_result": {
                const callId = String(data?.call_id ?? "");
                const ok = Boolean(data?.ok);
                updateAgentTurn(agentTurnId, (t) => ({
                  ...t,
                  toolCalls: t.toolCalls.map((c) =>
                    c.callId === callId
                      ? {
                          ...c,
                          status: ok ? "ok" : "error",
                          preview: (data?.preview as Record<string, unknown>) ?? {},
                          finishedAt: Date.now(),
                        }
                      : c,
                  ),
                }));
                break;
              }
              case "delta": {
                const text = String(data?.text ?? "");
                if (!text) break;
                updateAgentTurn(agentTurnId, (t) => ({ ...t, streamedText: t.streamedText + text }));
                break;
              }
              case "actions": {
                const items = Array.isArray(data?.items) ? (data.items as AgentAction[]) : [];
                updateAgentTurn(agentTurnId, (t) => ({ ...t, actions: items }));
                break;
              }
              case "done": {
                const latency = Number(data?.latency_ms ?? 0);
                const specialistsUsed = (Array.isArray(data?.specialists_used)
                  ? (data!.specialists_used as SpecialistId[])
                  : []) as SpecialistId[];
                const finalText = typeof data?.final_text === "string" ? (data.final_text as string) : undefined;
                updateAgentTurn(agentTurnId, (t) => ({
                  ...t,
                  status: "done",
                  finalText: finalText || t.streamedText,
                  latencyMs: latency,
                  specialistsUsed: specialistsUsed.length > 0 ? specialistsUsed : t.specialistsUsed,
                }));
                setActiveAgents(new Set());
                setStatus("idle");
                break;
              }
              case "error": {
                const msg = typeof data?.message === "string" ? (data.message as string) : "Agent error";
                updateAgentTurn(agentTurnId, (t) => ({
                  ...t,
                  status: "error",
                  errorMessage: msg,
                }));
                setActiveAgents(new Set());
                setStatus("error");
                break;
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          updateAgentTurn(agentTurnId, (t) => ({ ...t, status: "done", finalText: t.streamedText || "Cancelled." }));
        } else {
          updateAgentTurn(agentTurnId, (t) => ({
            ...t,
            status: "error",
            errorMessage: (err as Error)?.message || "Network error",
          }));
          setStatus("error");
        }
        setActiveAgents(new Set());
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        // Status is driven by the `done`/`error` SSE events; ensure we always
        // leave streaming state if the stream ended without one.
        setStatus((s) => (s === "streaming" ? "idle" : s));
      }
    },
    [baseUrl, status, turns, updateAgentTurn],
  );

  return {
    turns,
    status,
    specialists,
    activeAgents,
    send,
    cancel,
    reset,
  };
}

/**
 * AgentMessage — renders one orchestrated turn (reasoning trail + final answer).
 *
 * Visual structure:
 *   ┌── reasoning rail ──────────────────────────────────┐
 *   │  ▸ thinking pill                                   │
 *   │  ▸ tool call cards (one per dispatch)              │
 *   └────────────────────────────────────────────────────┘
 *      → final markdown answer in a clean card
 *      → action chips
 */
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, BrainCircuit, Sparkles } from "lucide-react";
import { useState } from "react";
import { ToolCallCard } from "./ToolCallCard";
import type { Turn } from "@/hooks/useBuilderAgent";

function formatMarkdownInline(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+?)`/g, '<code class="px-1 py-0.5 rounded bg-foreground/[0.06] text-[11.5px] font-mono">$1</code>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline-offset-2 hover:underline">$1</a>',
    );
}

function MarkdownBlock({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  const blocks: Array<{ type: "p" | "ul" | "h"; content: string[] }> = [];
  let buffer: string[] = [];
  let bufferType: "p" | "ul" | "h" | null = null;

  const flush = () => {
    if (bufferType && buffer.length > 0) {
      blocks.push({ type: bufferType, content: buffer });
    }
    buffer = [];
    bufferType = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^#{1,4}\s+/.test(line)) {
      flush();
      blocks.push({ type: "h", content: [line.replace(/^#{1,4}\s+/, "")] });
      continue;
    }
    if (/^\s*[-•]\s+/.test(line)) {
      if (bufferType !== "ul") {
        flush();
        bufferType = "ul";
      }
      buffer.push(line.replace(/^\s*[-•]\s+/, ""));
      continue;
    }
    if (bufferType !== "p") {
      flush();
      bufferType = "p";
    }
    buffer.push(line);
  }
  flush();

  return (
    <div className="space-y-2 text-[13px] leading-relaxed text-foreground/90">
      {blocks.map((b, i) => {
        if (b.type === "h") {
          return (
            <div key={i} className="text-[12px] font-semibold uppercase tracking-wider text-foreground/80">
              <span dangerouslySetInnerHTML={{ __html: formatMarkdownInline(b.content[0]) }} />
            </div>
          );
        }
        if (b.type === "ul") {
          return (
            <ul key={i} className="space-y-1 pl-3">
              {b.content.map((item, j) => (
                <li key={j} className="relative pl-3 before:absolute before:left-0 before:top-2 before:h-1 before:w-1 before:rounded-full before:bg-primary/60">
                  <span dangerouslySetInnerHTML={{ __html: formatMarkdownInline(item) }} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-[13px] leading-relaxed">
            <span dangerouslySetInnerHTML={{ __html: formatMarkdownInline(b.content.join(" ")) }} />
          </p>
        );
      })}
    </div>
  );
}

interface Props {
  turn: Extract<Turn, { role: "agent" }>;
}

export function AgentMessage({ turn }: Props) {
  const [trailExpanded, setTrailExpanded] = useState(true);
  const hasTrail = turn.toolCalls.length > 0 || turn.thinkingRound > 0;
  const isStreaming = turn.status === "streaming";
  const visibleText = turn.streamedText || turn.finalText || "";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="flex flex-col gap-2"
    >
      {/* Reasoning rail */}
      {hasTrail && (
        <div className="rounded-xl border border-border/40 bg-background/40 backdrop-blur-sm p-2">
          <button
            onClick={() => setTrailExpanded((v) => !v)}
            className="flex w-full items-center gap-1.5 px-1 py-0.5 text-[10.5px] uppercase tracking-wider text-muted-foreground/80 hover:text-foreground transition-colors"
          >
            <BrainCircuit className="h-3 w-3" />
            <span className="font-semibold">reasoning</span>
            <span className="text-muted-foreground/60">·</span>
            <span>{turn.toolCalls.length} tool{turn.toolCalls.length === 1 ? "" : "s"}</span>
            {turn.specialistsUsed.length > 0 && (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span>{turn.specialistsUsed.length} agent{turn.specialistsUsed.length === 1 ? "" : "s"}</span>
              </>
            )}
            <span className="ml-auto text-[10px]">{trailExpanded ? "hide" : "show"}</span>
          </button>
          <AnimatePresence initial={false}>
            {trailExpanded && (
              <motion.div
                key="trail"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="mt-1.5 space-y-1.5 pl-1">
                  {isStreaming && turn.toolCalls.length === 0 && (
                    <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-muted-foreground">
                      <motion.span
                        className="inline-block h-1.5 w-1.5 rounded-full bg-primary"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.4, repeat: Infinity }}
                      />
                      Orchestrator deciding which specialists to call…
                    </div>
                  )}
                  {turn.toolCalls.map((call) => (
                    <ToolCallCard key={call.callId} call={call} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Final answer card */}
      {visibleText && (
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-background/95 via-background/85 to-background/70 px-3.5 py-3 shadow-sm backdrop-blur-sm">
          <div className="absolute -top-12 -right-12 h-28 w-28 rounded-full bg-primary/10 blur-3xl" aria-hidden />
          <div className="relative">
            <MarkdownBlock text={visibleText} />
            {isStreaming && (
              <motion.span
                className="ml-0.5 inline-block h-3 w-1 align-baseline bg-primary/70"
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </div>
          {turn.status === "done" && turn.latencyMs != null && (
            <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground/60 uppercase tracking-wider">
              <Sparkles className="h-2.5 w-2.5" />
              <span>
                {turn.toolCalls.length} tool call{turn.toolCalls.length === 1 ? "" : "s"} · {turn.latencyMs}ms
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {turn.status === "error" && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-[12px] text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{turn.errorMessage || "Something went wrong."}</span>
        </div>
      )}
    </motion.div>
  );
}

/**
 * ToolCallCard — renders one specialist tool invocation in the reasoning trail.
 *
 * Visible engineering: tool name, specialist badge, arg summary, and a
 * tone-colored status pill (running → ok → error). When complete and
 * useful, shows a tiny preview of the result (top hits / score / count).
 */
import { motion } from "framer-motion";
import { Check, ChevronRight, Loader2, X } from "lucide-react";
import { TONE_TOKENS, toneFor } from "./agentTokens";
import type { ToolCall } from "@/hooks/useBuilderAgent";

const FRIENDLY_TOOL_NAMES: Record<string, string> = {
  search_my_work: "searching portfolio",
  explain_project: "loading project",
  show_evidence: "pulling evidence",
  list_skills: "listing skills",
  get_contact: "fetching contact",
  whats_new: "checking GitHub",
  repo_snapshot: "scanning repos",
  get_cloud_diary: "reading Cloud Diary",
  am_i_a_fit: "scoring JD fit",
  book_chat: "logging intro request",
  compose_intro: "drafting intro",
};

function summarizeArgs(tool: string, args: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) return "";
  if (tool === "am_i_a_fit") {
    const text = String(args.jd_text ?? "").trim();
    return text ? `"${text.slice(0, 70)}${text.length > 70 ? "…" : ""}"` : "";
  }
  if (tool === "book_chat") {
    return `${String(args.recruiter_email ?? "")}`.slice(0, 60);
  }
  if (typeof args.query === "string") return `"${args.query.slice(0, 60)}"`;
  if (typeof args.name === "string") return args.name.slice(0, 60);
  if (typeof args.skill === "string") return args.skill.slice(0, 60);
  if (typeof args.role === "string") return args.role.slice(0, 60);
  if (typeof args.days === "number") return `last ${args.days}d`;
  if (typeof args.limit === "number") return `limit ${args.limit}`;
  return JSON.stringify(args).slice(0, 60);
}

function PreviewLine({ call }: { call: ToolCall }) {
  if (call.status !== "ok" || !call.preview) return null;
  const p = call.preview;
  if (call.tool === "search_my_work") {
    const top = (p.top as Array<{ title: string; score: number }>) || [];
    if (top.length === 0) return null;
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {top.slice(0, 3).map((t, i) => (
          <span
            key={i}
            className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/[0.04] text-muted-foreground/90 truncate max-w-[160px]"
            title={t.title}
          >
            {t.title}
          </span>
        ))}
      </div>
    );
  }
  if (call.tool === "am_i_a_fit") {
    const score = Number(p.score ?? 0);
    return (
      <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
        <span className="font-mono font-semibold text-foreground/80">{score}</span>
        <span>/100 fit · {String(p.matched_count ?? 0)} matched · {String(p.gap_count ?? 0)} gaps</span>
      </div>
    );
  }
  if (call.tool === "whats_new") {
    const latest = p.latest as { repo?: string; message?: string } | undefined;
    if (!latest?.message) return null;
    return (
      <div className="mt-1 text-[10.5px] text-muted-foreground truncate" title={latest.message}>
        {latest.repo}: {latest.message}
      </div>
    );
  }
  if (call.tool === "get_cloud_diary") {
    if (p.latest_date) {
      return <div className="mt-1 text-[10.5px] text-muted-foreground">latest: {String(p.latest_date)}</div>;
    }
  }
  if (call.tool === "show_evidence") {
    return (
      <div className="mt-1 text-[10.5px] text-muted-foreground">
        {String(p.match_count ?? 0)} project{Number(p.match_count) === 1 ? "" : "s"} found
      </div>
    );
  }
  return null;
}

interface Props {
  call: ToolCall;
}

export function ToolCallCard({ call }: Props) {
  const tone = TONE_TOKENS[toneFor(call.specialistTone)];
  const friendly = FRIENDLY_TOOL_NAMES[call.tool] || call.tool;
  const argSummary = summarizeArgs(call.tool, call.args);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={`relative rounded-lg border ${tone.border} ${tone.bg} px-2.5 py-1.5`}
    >
      <div className="flex items-start gap-2">
        {/* Tone strip */}
        <div className={`w-0.5 self-stretch rounded-full bg-gradient-to-b ${tone.avatarGradient}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-[10.5px] font-semibold ${tone.text}`}>{call.specialistLabel}</span>
            <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/60" />
            <span className="text-[11px] font-medium text-foreground/85 truncate">{friendly}</span>
            <span className="ml-auto inline-flex items-center">
              {call.status === "running" && (
                <Loader2 className={`h-3 w-3 animate-spin ${tone.text}`} />
              )}
              {call.status === "ok" && (
                <Check className="h-3 w-3 text-emerald-400" />
              )}
              {call.status === "error" && (
                <X className="h-3 w-3 text-rose-400" />
              )}
            </span>
          </div>
          {argSummary && (
            <div className="mt-0.5 text-[10.5px] text-muted-foreground/80 truncate" title={argSummary}>
              {argSummary}
            </div>
          )}
          <PreviewLine call={call} />
        </div>
      </div>
    </motion.div>
  );
}

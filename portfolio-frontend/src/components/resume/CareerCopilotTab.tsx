import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  ChevronRight,
  GraduationCap,
  History,
  Loader2,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { apiService } from "@/lib/api";

type CopilotMessage = {
  role: string;
  content: string;
  at?: string;
  id?: string;
  meta?: {
    pipeline?: Array<{ agent: string; label: string; summary: string }>;
    citations?: Array<{ id: string; snippet: string }>;
  };
};

type NextAction = { title: string; reason: string };

type PlaygroundState = {
  active_track?: string;
  custom_title?: string | null;
  custom_topic?: string | null;
  current_step?: number;
  steps?: Array<{ title: string; type: string; body: string }>;
  completed?: number[];
  finished_at?: string;
};

const AGENT_TONE: Record<string, string> = {
  memory: "from-violet-500/20 to-fuchsia-500/10",
  strategist: "from-sky-500/20 to-cyan-500/10",
  tailor: "from-amber-500/20 to-orange-500/10",
  interview: "from-emerald-500/20 to-teal-500/10",
  outreach: "from-rose-500/20 to-pink-500/10",
  project: "from-indigo-500/20 to-blue-500/10",
  router: "from-slate-500/20 to-gray-500/10",
};

function PipelineChips({ pipeline }: { pipeline: Array<{ agent: string; label: string; summary: string }> }) {
  if (!pipeline?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2" aria-label="Agent pipeline">
      {pipeline.map((p, i) => {
        const key = (p.agent || "router").toLowerCase();
        const grad = AGENT_TONE[key] || AGENT_TONE.router;
        return (
          <span
            key={`${p.agent}-${i}`}
            title={p.summary}
            className={`inline-flex max-w-full items-center gap-1 rounded-lg border border-white/10 bg-gradient-to-r ${grad} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-800 dark:text-gray-200`}
          >
            <span className="shrink-0 text-[9px] opacity-80">{p.agent}</span>
            <span className="truncate font-normal normal-case">{p.label}</span>
          </span>
        );
      })}
    </div>
  );
}

export default function CareerCopilotTab() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [jdPaste, setJdPaste] = useState("");
  const [showJd, setShowJd] = useState(false);
  const [hasResume, setHasResume] = useState(true);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [nba, setNba] = useState<NextAction[]>([]);
  const [compliance, setCompliance] = useState("");
  const [citations, setCitations] = useState<Array<{ id: string; snippet: string }>>([]);
  const [playground, setPlayground] = useState<PlaygroundState | null>(null);
  const [tracks, setTracks] = useState<
    Array<{ id: string; title: string; description: string; steps: Array<{ title: string; type: string; body: string }> }>
  >([]);
  const [playTab, setPlayTab] = useState<"chat" | "playground">("chat");
  const [customTopic, setCustomTopic] = useState("");
  const [pgBusy, setPgBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadState = useCallback(async () => {
    setLoading(true);
    const r = await apiService.getCareerCopilotState();
    setLoading(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    const d = r.data!;
    setMessages((d.messages || []) as CopilotMessage[]);
    setHasResume(!!d.has_resume);
    setSuggested(d.suggested_prompts || []);
    setNba(d.next_best_actions || []);
    setPlayground((d.playground as PlaygroundState) || null);
    setTracks(d.tracks || []);
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setSending(true);
    setInput("");
    const r = await apiService.sendCareerCopilotMessage(
      msg,
      showJd && jdPaste.trim() ? jdPaste : undefined,
    );
    setSending(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    const d = r.data!;
    if (d.messages) setMessages(d.messages as CopilotMessage[]);
    if (d.citations) setCitations(d.citations);
    if (d.compliance) setCompliance(d.compliance);
    if (d.suggested_prompts?.length) setSuggested(d.suggested_prompts);
    if (d.next_best_actions?.length) setNba(d.next_best_actions);
  };

  const onReset = async () => {
    if (!window.confirm("Clear this chat history?")) return;
    const r = await apiService.resetCareerCopilotChat();
    if (r.error) {
      toast.error(r.error);
      return;
    }
    setMessages([]);
    setCitations([]);
    setCompliance("");
    void loadState();
  };

  const startTrack = async (trackId?: string) => {
    setPgBusy(true);
    const r = await apiService.startPlaygroundTrack(
      trackId
        ? { track_id: trackId }
        : { custom_topic: customTopic.trim() || undefined },
    );
    setPgBusy(false);
    if (r.error || !r.data?.ok) {
      toast.error(r.data?.error || r.error || "Could not start track");
      return;
    }
    setPlayground((r.data.playground as PlaygroundState) || null);
    setCustomTopic("");
    toast.success("Track started");
  };

  const advance = async () => {
    setPgBusy(true);
    const r = await apiService.advancePlaygroundStep();
    setPgBusy(false);
    if (r.error || !r.data?.ok) {
      toast.error(r.data?.error || r.error);
      return;
    }
    setPlayground((r.data.playground as PlaygroundState) || null);
  };

  const resetPlay = async () => {
    if (!window.confirm("Reset learning progress?")) return;
    await apiService.resetPlaygroundTrack();
    setPlayground(null);
  };

  const currentStep = playground?.steps?.[playground.current_step ?? 0];
  const pgProgress =
    playground?.steps?.length && playground.current_step != null
      ? Math.min(100, (playground.current_step / playground.steps.length) * 100)
      : 0;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white/60 dark:bg-gray-900/40">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-indigo-500/15 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600/90 dark:text-indigo-300">
              Multi-agent career copilot
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-950 dark:text-white">
              RAG on your resume + specialists
            </h2>
            <p className="max-w-2xl text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Grounded in your stored resume, with routing across tailoring, interview prep, ethical cold
              outreach, and project scaffolds. Paste a JD anytime for role-specific help.
            </p>
            {!hasResume && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                No parsed resume on file — upload in <strong>My Resumes</strong> for best results, or paste a
                short summary in chat.
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void loadState()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white/80 px-3 text-xs font-semibold text-gray-700 transition hover:border-indigo-500/30 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
            >
              <History className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void onReset()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 text-xs font-semibold text-red-700 dark:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear chat
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200/80 p-1 dark:border-white/10">
            {(
              [
                { id: "chat" as const, label: "Copilot", icon: Bot },
                { id: "playground" as const, label: "Learning playground", icon: GraduationCap },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPlayTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  playTab === t.id
                    ? "bg-indigo-500/15 text-indigo-800 dark:text-indigo-200 ring-1 ring-indigo-500/20"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {playTab === "chat" && (
            <div className="rounded-2xl border border-gray-200/90 bg-white/90 shadow-sm dark:border-white/[0.08] dark:bg-gray-900/50">
              <div className="max-h-[min(52vh,560px)] overflow-y-auto p-4 sm:p-5 space-y-4">
                {messages.length === 0 && (
                  <div className="rounded-xl border border-dashed border-indigo-500/25 bg-indigo-500/[0.04] p-5 text-sm text-gray-600 dark:text-gray-400">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-indigo-700 dark:text-indigo-300">
                      <Sparkles className="h-4 w-4" />
                      Start with a play or ask anything
                    </div>
                    <ul className="ml-1 list-inside list-disc space-y-1.5 text-[13px]">
                      <li>Tailor a bullet to a target role (paste a JD in the field below first).</li>
                      <li>Draft a non-spammy follow-up 48h after applying.</li>
                      <li>Build a 3-week project plan for your portfolio with milestones.</li>
                    </ul>
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {messages.map((m) => {
                    const isUser = m.role === "user";
                    const p = m.meta?.pipeline;
                    return (
                      <motion.div
                        key={m.id || `${m.role}-${m.at}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                            isUser
                              ? "bg-indigo-600 text-white"
                              : "bg-gray-100/90 text-gray-900 dark:bg-white/10 dark:text-gray-100"
                          }`}
                        >
                          <div className="whitespace-pre-wrap break-words">{m.content}</div>
                          {!isUser && p?.length ? <PipelineChips pipeline={p} /> : null}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {sending && (
                  <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Specialists are working…
                  </div>
                )}
                <div ref={endRef} />
              </div>
              {citations.length > 0 && (
                <div className="border-t border-gray-200/80 px-4 py-3 text-xs text-gray-500 dark:text-gray-400 dark:border-white/10">
                  <p className="mb-1 font-semibold text-gray-700 dark:text-gray-300">RAG context</p>
                  <ul className="space-y-1.5">
                    {citations.slice(0, 3).map((c) => (
                      <li key={c.id}>
                        <span className="font-mono text-[10px] text-indigo-500 dark:text-indigo-400">
                          {c.id}
                        </span>{" "}
                        {c.snippet}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t border-gray-200/90 p-3 sm:p-4 space-y-3 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowJd((s) => !s)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400"
                >
                  {showJd ? "Hide" : "Add"} job description (optional)
                </button>
                {showJd && (
                  <textarea
                    value={jdPaste}
                    onChange={(e) => setJdPaste(e.target.value)}
                    rows={4}
                    placeholder="Paste a JD here — I’ll use it for tailoring, questions, and outreach that reference this role."
                    className="w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-gray-950/50 dark:text-white"
                  />
                )}
                {compliance && (
                  <p className="text-[11px] text-amber-800/90 dark:text-amber-200/80">{compliance}</p>
                )}
                {suggested.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {suggested.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void send(s)}
                        className="rounded-full border border-indigo-500/20 bg-indigo-500/5 px-2.5 py-1 text-[11px] font-medium text-indigo-800 dark:text-indigo-200"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    rows={2}
                    placeholder="Ask: outreach, interview plan, project scope, PPT outline…"
                    className="min-h-[44px] flex-1 rounded-xl border border-gray-200 bg-white/90 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-gray-950/60 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => void send()}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:opacity-95 disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {playTab === "playground" && (
            <div className="rounded-2xl border border-gray-200/90 bg-white/90 p-5 dark:border-white/[0.08] dark:bg-gray-900/50 space-y-5">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Guided paths</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Theory and practice, basic → advanced. Or generate a custom track from a topic.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="e.g. Kubernetes for backend interviews"
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm dark:border-white/10 dark:bg-gray-950/50 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={pgBusy}
                    onClick={() => void startTrack()}
                    className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {pgBusy ? "…" : "Generate custom track"}
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {tracks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => void startTrack(t.id)}
                    disabled={pgBusy}
                    className="text-left rounded-xl border border-gray-200/80 p-3 text-xs transition hover:border-indigo-500/30 dark:border-white/10"
                  >
                    <span className="block font-bold text-gray-900 dark:text-white text-[13px] leading-snug">
                      {t.title}
                    </span>
                    <span className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{t.description}</span>
                  </button>
                ))}
              </div>
              {playground?.steps && playground.steps.length > 0 && (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] p-4">
                  <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-gray-200/80 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                      style={{ width: `${pgProgress}%` }}
                    />
                  </div>
                  <p className="text-xs font-bold text-indigo-800 dark:text-indigo-200">
                    {playground.custom_title || (playground.active_track && tracks.find((x) => x.id === playground.active_track)?.title) || "Track"}
                    {playground.finished_at && " — complete ✓"}
                  </p>
                  {playground.finished_at && !currentStep && (
                    <p className="text-sm text-gray-700 dark:text-gray-200 mt-2">
                      You’ve completed every step. Use the copilot to turn this into resume bullets, a project README, or mock
                      interview practice.
                    </p>
                  )}
                  {currentStep && !playground.finished_at && (
                    <>
                      <p className="text-[10px] uppercase font-bold text-gray-500 mt-2">{currentStep.type}</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{currentStep.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed whitespace-pre-wrap">
                        {currentStep.body}
                      </p>
                      <button
                        type="button"
                        disabled={pgBusy}
                        onClick={() => void advance()}
                        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-300"
                      >
                        Mark step done
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => void resetPlay()}
                    className="mt-2 text-xs text-gray-500 underline"
                  >
                    Reset playground
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-gray-200/90 bg-gradient-to-b from-white to-gray-50/50 p-4 dark:border-white/[0.08] dark:from-gray-900/80 dark:to-gray-950/80">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              Next best actions
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              Picks from your last run + light behavior signals — not a static list.
            </p>
            <ul className="mt-3 space-y-2">
              {nba.map((a, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-gray-200/80 bg-white/60 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <p className="font-semibold text-gray-900 dark:text-white">{a.title}</p>
                  <p className="text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{a.reason}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-gray-200/90 p-4 text-xs text-gray-500 dark:text-gray-400 leading-relaxed dark:border-white/[0.08]">
            <p className="font-semibold text-gray-800 dark:text-gray-200">Agentic by design</p>
            <p className="mt-1.5">
              Each reply includes a <strong>visible pipeline</strong> (RAG, strategist, tailor, interview, outreach, project) so
              you see how the system reasoned. Grounding comes from your resume text chunks; paste a JD when you need role-specific
              work.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

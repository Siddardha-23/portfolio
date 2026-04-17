import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiService } from "@/lib/api";
import type { InterviewPrepContent, TailoringRecord } from "@/types/resume";
import { formatDate } from "@/components/resume/ResumeDashboard";

// ─── Defensive parsing of Gemini fields ────────────────────────────────────
// Gemini sometimes returns: (a) a proper array; (b) a JSON-encoded string of
// an array; (c) a plain prose string. The prior renderer treated (b) as prose
// and split on newlines, exposing raw `[`, `]` tokens in the UI. This parses
// each case safely.

function sanitize(s: string): string {
  return s
    .replace(/^[\s"'\[\{`]+/, "")
    .replace(/[\s"'\]\}`]+$/, "")
    .replace(/^\*\*|\*\*$/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1") // drop bold markdown
    .replace(/\s+/g, " ")
    .trim();
}

function tryParseJSON(raw: string): unknown | null {
  const s = raw.trim();
  if (!s) return null;
  const looksJson = /^[\[\{]/.test(s) || /^```/.test(s);
  if (!looksJson) return null;
  const cleaned = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  // Fallback: some responses quote individual items with backticks or escape them
  try {
    const unescaped = cleaned.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    return JSON.parse(unescaped);
  } catch { return null; }
}

function asStrArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap(x => asStrArray(x));
  if (v && typeof v === "object") {
    const q = (v as any).question ?? (v as any).q ?? (v as any).text;
    if (q) return [sanitize(String(q))];
  }
  if (typeof v === "string") {
    const parsed = tryParseJSON(v);
    if (parsed !== null && parsed !== v) return asStrArray(parsed);
    const cleaned = sanitize(v);
    if (!cleaned) return [];
    // If it still looks like a JSON array of items, split on commas between
    // closing and opening quotes; otherwise split on sentence breaks.
    if (/",\s*"/.test(v)) {
      return v.split(/",\s*"/).map(sanitize).filter(Boolean);
    }
    return cleaned.split(/(?<=\.)\s+(?=[A-Z])|\n+|;\s+/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

interface QItem { question: string; why_asked?: string; answer_outline?: string }

function asQArray(v: unknown): QItem[] {
  if (Array.isArray(v)) return v.flatMap(asQArray);
  if (v && typeof v === "object") {
    const q = (v as any).question ?? (v as any).q;
    if (q) {
      return [{
        question: sanitize(String(q)),
        why_asked: (v as any).why_asked ? sanitize(String((v as any).why_asked)) : undefined,
        answer_outline: (v as any).answer_outline ?? (v as any).defense
          ? sanitize(String((v as any).answer_outline ?? (v as any).defense))
          : undefined,
      }];
    }
  }
  if (typeof v === "string") {
    const parsed = tryParseJSON(v);
    if (parsed !== null && parsed !== v) return asQArray(parsed);
    const cleaned = sanitize(v);
    if (cleaned) return [{ question: cleaned }];
  }
  return [];
}

// Detect STAR structure in an answer outline and break it into parts
function splitStar(s?: string): { label: string; text: string }[] | null {
  if (!s) return null;
  const m = s.match(/\bS:\s*(.+?)\s*T:\s*(.+?)\s*A:\s*(.+?)\s*R:\s*(.+)$/);
  if (!m) return null;
  return [
    { label: "Situation", text: m[1] },
    { label: "Task", text: m[2] },
    { label: "Action", text: m[3] },
    { label: "Result", text: m[4] },
  ];
}

// ─── UI atoms ─────────────────────────────────────────────────────────────
function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return <span className={`inline-block rounded-full border-2 border-current border-t-transparent animate-spin ${className}`} />;
}

function CopyButton({ text, title = "Copy" }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); }
        catch { /* noop */ }
      }}
      title={title}
      className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-purple-500 hover:bg-purple-500/10 transition-colors"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg>
      )}
    </button>
  );
}

// ─── Question card ────────────────────────────────────────────────────────
function QuestionCard({
  q,
  index,
  reviewed,
  onToggleReviewed,
}: {
  q: QItem;
  index: number;
  reviewed: boolean;
  onToggleReviewed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const star = useMemo(() => splitStar(q.answer_outline), [q.answer_outline]);

  return (
    <div className={`group rounded-xl border overflow-hidden transition-all ${
      reviewed
        ? "border-emerald-500/30 bg-emerald-500/5"
        : "border-gray-200 dark:border-gray-800/60 bg-white/60 dark:bg-gray-900/40 hover:border-purple-500/30"
    }`}>
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        {/* Review checkbox */}
        <button
          onClick={onToggleReviewed}
          title={reviewed ? "Mark as not reviewed" : "Mark as reviewed"}
          className={`shrink-0 mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
            reviewed
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "border-gray-300 dark:border-gray-600 hover:border-emerald-400"
          }`}
        >
          {reviewed && (
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          )}
        </button>

        {/* Number badge */}
        <span className="shrink-0 mt-0.5 inline-flex w-5 h-5 items-center justify-center rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-300 text-[10px] font-bold tabular-nums">
          {index + 1}
        </span>

        {/* Question (click to expand) */}
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-1 min-w-0 text-left"
        >
          <p className={`text-[12.5px] leading-snug ${reviewed ? "text-gray-500 dark:text-gray-500" : "text-gray-800 dark:text-gray-200"}`}>
            {q.question}
          </p>
          {!open && q.answer_outline && (
            <p className="text-[10.5px] text-gray-400 dark:text-gray-500 mt-1 line-clamp-1 italic">
              {q.answer_outline}
            </p>
          )}
        </button>

        <CopyButton text={`Q: ${q.question}${q.answer_outline ? `\nA: ${q.answer_outline}` : ""}`} />
        <button
          onClick={() => setOpen(o => !o)}
          className="shrink-0 w-6 h-6 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>

      {open && (q.why_asked || q.answer_outline) && (
        <div className="border-t border-gray-200 dark:border-gray-800/60 bg-gray-50/40 dark:bg-gray-900/20 px-3 py-3 space-y-2.5">
          {q.why_asked && (
            <div className="flex gap-2">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-purple-500 dark:text-purple-400 w-14">Why</span>
              <p className="text-[11.5px] text-gray-600 dark:text-gray-300 leading-relaxed">{q.why_asked}</p>
            </div>
          )}
          {q.answer_outline && (
            star ? (
              <div className="pl-16 -ml-16">
                <div className="flex gap-2 mb-1.5">
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-emerald-500 dark:text-emerald-400 w-14">Answer</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">STAR framework</span>
                </div>
                <div className="ml-16 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {star.map(p => (
                    <div key={p.label} className="rounded-md bg-white dark:bg-gray-900/60 border border-emerald-500/20 px-2 py-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{p.label}</p>
                      <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-snug mt-0.5">{p.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-emerald-500 dark:text-emerald-400 w-14">Answer</span>
                <p className="text-[11.5px] text-gray-700 dark:text-gray-300 leading-relaxed flex-1">{q.answer_outline}</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Bullet-list card (for talking points, gaps, etc.) ───────────────────
function BulletCard({
  text,
  index,
  accent,
  reviewed,
  onToggleReviewed,
}: {
  text: string;
  index: number;
  accent: "purple" | "amber" | "red" | "emerald" | "blue";
  reviewed: boolean;
  onToggleReviewed: () => void;
}) {
  const colorMap = {
    purple:  { bg: "bg-purple-500/10",  text: "text-purple-600 dark:text-purple-300",   dot: "bg-purple-400" },
    amber:   { bg: "bg-amber-500/10",   text: "text-amber-600 dark:text-amber-300",     dot: "bg-amber-400" },
    red:     { bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-300",         dot: "bg-red-400" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-300", dot: "bg-emerald-400" },
    blue:    { bg: "bg-blue-500/10",    text: "text-blue-600 dark:text-blue-300",       dot: "bg-blue-400" },
  }[accent];

  return (
    <div className={`rounded-lg border px-3 py-2 flex items-start gap-2.5 transition-all ${
      reviewed ? "border-emerald-500/30 bg-emerald-500/5 opacity-70" : `border-gray-200 dark:border-gray-800/60 bg-white/50 dark:bg-gray-900/40 hover:border-${accent}-500/30`
    }`}>
      <button
        onClick={onToggleReviewed}
        className={`shrink-0 mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
          reviewed ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 dark:border-gray-600 hover:border-emerald-400"
        }`}
      >
        {reviewed && <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>}
      </button>
      <span className={`shrink-0 inline-flex w-5 h-5 items-center justify-center rounded-md ${colorMap.bg} ${colorMap.text} text-[10px] font-bold tabular-nums`}>
        {index + 1}
      </span>
      <p className={`flex-1 text-[12px] leading-relaxed ${reviewed ? "text-gray-500 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"}`}>{text}</p>
      <CopyButton text={text} />
    </div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────
type TabKey = "overview" | "behavioral" | "technical" | "company" | "asks" | "gaps" | "tough";

// ─── Main ─────────────────────────────────────────────────────────────────
export default function InterviewPrepTab() {
  const [records, setRecords] = useState<TailoringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState<InterviewPrepContent | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [qSearch, setQSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  useEffect(() => {
    (async () => {
      const resp = await apiService.listTailoringRecords();
      if (resp.data) {
        const list = (resp.data.records || []) as TailoringRecord[];
        setRecords(list);
        if (!selectedId && list.length > 0) setSelectedId(list[0].record_id);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(
    () => records.find(r => r.record_id === selectedId) || null,
    [records, selectedId],
  );

  // Reviewed-question persistence: localStorage keyed by record_id.
  const reviewedKey = selectedId ? `prep-reviewed:${selectedId}` : null;
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!reviewedKey) { setReviewed(new Set()); return; }
    try {
      const raw = localStorage.getItem(reviewedKey);
      setReviewed(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch { setReviewed(new Set()); }
  }, [reviewedKey]);
  const toggleReviewed = useCallback((id: string) => {
    setReviewed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (reviewedKey) {
        try { localStorage.setItem(reviewedKey, JSON.stringify([...next])); } catch { /* noop */ }
      }
      return next;
    });
  }, [reviewedKey]);

  // Load prep when selection changes
  useEffect(() => {
    if (!selectedId) { setContent(null); setGeneratedAt(null); return; }
    const rec = records.find(r => r.record_id === selectedId);
    const hasCached = rec?.interview_prep?.generated_at;
    if (!hasCached) { setContent(null); setGeneratedAt(null); return; }
    (async () => {
      const full = await apiService.getTailoringRecord(selectedId);
      const prep = full.data?.record?.interview_prep;
      if (prep?.content) {
        setContent(prep.content);
        setGeneratedAt(prep.generated_at || null);
      }
    })();
  }, [selectedId, records]);

  const handleGenerate = useCallback(async (force = false) => {
    if (!selectedId) return;
    setGenerating(true);
    const resp = await apiService.generateInterviewPrep(selectedId, { force });
    setGenerating(false);
    if (resp.error) { toast.error("Failed to generate prep", { description: resp.error }); return; }
    const prep = resp.data?.interview_prep;
    if (prep?.content) {
      setContent(prep.content);
      setGeneratedAt(prep.generated_at);
      toast.success(resp.data?.cached ? "Loaded cached prep" : "Prep generated");
      if (!resp.data?.cached) {
        setRecords(prev => prev.map(r =>
          r.record_id === selectedId
            ? { ...r, interview_prep: { generated_at: prep.generated_at, grounded_version_id: prep.grounded_version_id } }
            : r,
        ));
      }
    }
  }, [selectedId]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r =>
      `${r.jd_analysis?.job_title || ""} ${r.jd_analysis?.company || ""}`.toLowerCase().includes(q),
    );
  }, [records, search]);

  // Normalise all fields once and memoise
  const norm = useMemo(() => {
    if (!content) return null;
    return {
      pitch: content.elevator_pitch ? sanitize(content.elevator_pitch) : "",
      talking: asStrArray(content.talking_points),
      behavioral: asQArray(content.behavioral_questions),
      technical: asQArray(content.technical_questions),
      company: asQArray(content.company_specific),
      gaps: asStrArray(content.gaps_to_address),
      tough: asQArray(content.red_flags),
      asks: asStrArray(content.questions_to_ask_them),
    };
  }, [content]);

  // Optional question search across behavioural / technical / company
  const qFilter = (items: QItem[]): QItem[] => {
    const q = qSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(x => `${x.question} ${x.why_asked || ""} ${x.answer_outline || ""}`.toLowerCase().includes(q));
  };
  const bFilter = (items: string[]): string[] => {
    const q = qSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(x => x.toLowerCase().includes(q));
  };

  const counts = norm ? {
    overview: 0,
    behavioral: norm.behavioral.length,
    technical: norm.technical.length,
    company: norm.company.length,
    asks: norm.asks.length,
    gaps: norm.gaps.length,
    tough: norm.tough.length,
  } : null;

  const totalItems = norm ? norm.behavioral.length + norm.technical.length + norm.company.length + norm.gaps.length + norm.tough.length + norm.asks.length + norm.talking.length : 0;
  const reviewedCount = reviewed.size;
  const progress = totalItems > 0 ? Math.round((reviewedCount / totalItems) * 100) : 0;

  if (loading) {
    return <div className="animate-pulse h-24 rounded-xl bg-gray-100/40 dark:bg-gray-800/40" />;
  }
  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gradient-to-b from-purple-500/5 to-transparent p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 text-white flex items-center justify-center mx-auto mb-3 text-xl shadow-lg shadow-purple-500/30">💡</div>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">No tailored resumes yet</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tailor a resume first — prep is grounded in your JD + resume.</p>
      </div>
    );
  }

  const TABS: { key: TabKey; label: string; icon: string; count?: number }[] = [
    { key: "overview",   label: "Overview",    icon: "✨" },
    { key: "behavioral", label: "Behavioral",  icon: "🧠", count: counts?.behavioral },
    { key: "technical",  label: "Technical",   icon: "⚙",  count: counts?.technical },
    { key: "company",    label: "Company",     icon: "🏢", count: counts?.company },
    { key: "asks",       label: "Ask them",    icon: "❓", count: counts?.asks },
    { key: "gaps",       label: "Gaps",        icon: "⚠",  count: counts?.gaps },
    { key: "tough",      label: "Tough Qs",    icon: "🔥", count: counts?.tough },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Interview Prep</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          AI-generated briefs grounded in the exact JD + resume version you applied with.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        {/* ── Record picker ── */}
        <aside className="rounded-xl border border-gray-200 dark:border-gray-800/60 bg-white/50 dark:bg-gray-900/30 p-2 space-y-1 max-h-[75vh] overflow-y-auto">
          <div className="relative mb-1">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search records…"
              className="w-full pl-8 pr-2 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/60 text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>
          {filteredRecords.map(r => {
            const isSel = r.record_id === selectedId;
            const hasPrep = !!r.interview_prep?.generated_at;
            return (
              <button
                key={r.record_id}
                onClick={() => setSelectedId(r.record_id)}
                className={`w-full text-left px-2.5 py-2 rounded-md transition-colors ${isSel ? "bg-purple-500/15 border border-purple-500/30" : "hover:bg-gray-100/60 dark:hover:bg-gray-800/40 border border-transparent"}`}
              >
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{r.jd_analysis?.job_title || "Untitled"}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                  {r.jd_analysis?.company && r.jd_analysis.company !== "Not specified" ? r.jd_analysis.company : "—"}
                  <span className="mx-1">·</span>
                  {formatDate(r.created_at || "")}
                </p>
                {hasPrep && (
                  <span className="mt-1 inline-block text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/25">Prep ready</span>
                )}
              </button>
            );
          })}
        </aside>

        {/* ── Prep content ── */}
        <main className="space-y-4">
          {!selected ? (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-xs text-gray-500 dark:text-gray-400">
              Select a tailoring record to view or generate its prep pack.
            </div>
          ) : (
            <>
              {/* Title card */}
              <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-gradient-to-br from-purple-500/5 via-white/50 to-transparent dark:from-purple-500/10 dark:via-gray-900/40 dark:to-transparent p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-500 dark:text-purple-400">Prep for</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-0.5 leading-snug">
                      {selected.jd_analysis?.job_title || "Untitled role"}
                      {selected.jd_analysis?.company && selected.jd_analysis.company !== "Not specified" && (
                        <span className="text-gray-500 dark:text-gray-400 font-normal"> at {selected.jd_analysis.company}</span>
                      )}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                      {generatedAt ? `Generated ${formatDate(generatedAt)}` : "No prep generated yet"}
                      {totalItems > 0 && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{reviewedCount}</span>
                          <span> of {totalItems} reviewed</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {content && (
                      <button
                        onClick={() => handleGenerate(true)}
                        disabled={generating}
                        className="px-3 py-1.5 rounded-md text-[11px] font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 disabled:opacity-50"
                      >
                        {generating ? "Regenerating…" : "Regenerate"}
                      </button>
                    )}
                    {!content && (
                      <button
                        onClick={() => handleGenerate(false)}
                        disabled={generating}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 shadow-sm shadow-purple-500/25"
                      >
                        {generating && <Spinner />} {generating ? "Generating prep…" : "Generate prep"}
                      </button>
                    )}
                  </div>
                </div>

                {totalItems > 0 && (
                  <div className="mt-4">
                    <div className="h-1 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">{progress}% reviewed</p>
                  </div>
                )}
              </div>

              {!content && !generating && (
                <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-xs text-gray-500 dark:text-gray-400">
                  Click <b>Generate prep</b> to create an interview pack grounded in the JD + current resume version.
                </div>
              )}
              {generating && !content && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-800/60 p-8 text-center text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
                  <Spinner /> Generating prep — usually 10–20 seconds.
                </div>
              )}

              {content && norm && (
                <>
                  {/* Tab bar */}
                  <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800/60 pb-0.5 -mx-1 px-1">
                    {TABS.map(t => {
                      const isActive = activeTab === t.key;
                      const count = t.count;
                      return (
                        <button
                          key={t.key}
                          onClick={() => setActiveTab(t.key)}
                          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[11px] font-medium transition-all border-b-2 ${
                            isActive
                              ? "border-purple-500 text-gray-900 dark:text-gray-100 bg-purple-500/5"
                              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                          }`}
                        >
                          <span>{t.icon}</span>
                          <span>{t.label}</span>
                          {typeof count === "number" && count > 0 && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full tabular-nums font-bold ${isActive ? "bg-purple-500/20 text-purple-600 dark:text-purple-300" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>{count}</span>
                          )}
                        </button>
                      );
                    })}
                    <div className="flex-1" />
                    {(activeTab === "behavioral" || activeTab === "technical" || activeTab === "company" || activeTab === "tough" || activeTab === "gaps" || activeTab === "asks") && (
                      <div className="relative shrink-0 ml-2">
                        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                        <input
                          value={qSearch}
                          onChange={e => setQSearch(e.target.value)}
                          placeholder="Filter in view…"
                          className="pl-7 pr-2 py-1 w-[160px] rounded-md bg-gray-100 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/60 text-[11px] text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        />
                      </div>
                    )}
                  </div>

                  {/* Tab content */}
                  <div className="pt-2">
                    {activeTab === "overview" && (
                      <div className="space-y-4">
                        {norm.pitch && (
                          <div className="rounded-xl border border-purple-500/25 bg-purple-500/5 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm">🎤</span>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-300">Elevator pitch</p>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400">— open with this</span>
                              <div className="flex-1" />
                              <CopyButton text={norm.pitch} />
                            </div>
                            <p className="text-[13px] text-gray-800 dark:text-gray-200 leading-relaxed">{norm.pitch}</p>
                          </div>
                        )}

                        {norm.talking.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm">💪</span>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">Talking points</p>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400">— your strongest selling points</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {norm.talking.map((t, i) => (
                                <BulletCard
                                  key={i} index={i} text={t} accent="purple"
                                  reviewed={reviewed.has(`tp-${i}`)}
                                  onToggleReviewed={() => toggleReviewed(`tp-${i}`)}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {TABS.slice(1).map(t => (
                            <button
                              key={t.key}
                              onClick={() => setActiveTab(t.key)}
                              className="rounded-lg border border-gray-200 dark:border-gray-800/60 bg-white/50 dark:bg-gray-900/30 px-3 py-2.5 text-left hover:border-purple-500/40 hover:bg-purple-500/5 transition-colors"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs">{t.icon}</span>
                                <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{t.label}</p>
                              </div>
                              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums mt-0.5">{t.count ?? 0}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeTab === "behavioral" && (
                      <div className="space-y-2">
                        {qFilter(norm.behavioral).map((q, i) => (
                          <QuestionCard key={i} index={i} q={q}
                            reviewed={reviewed.has(`b-${i}`)}
                            onToggleReviewed={() => toggleReviewed(`b-${i}`)} />
                        ))}
                        {qFilter(norm.behavioral).length === 0 && <EmptyState label="behavioral questions" />}
                      </div>
                    )}

                    {activeTab === "technical" && (
                      <div className="space-y-2">
                        {qFilter(norm.technical).map((q, i) => (
                          <QuestionCard key={i} index={i} q={q}
                            reviewed={reviewed.has(`t-${i}`)}
                            onToggleReviewed={() => toggleReviewed(`t-${i}`)} />
                        ))}
                        {qFilter(norm.technical).length === 0 && <EmptyState label="technical questions" />}
                      </div>
                    )}

                    {activeTab === "company" && (
                      <div className="space-y-2">
                        {qFilter(norm.company).map((q, i) => (
                          <QuestionCard key={i} index={i} q={q}
                            reviewed={reviewed.has(`c-${i}`)}
                            onToggleReviewed={() => toggleReviewed(`c-${i}`)} />
                        ))}
                        {qFilter(norm.company).length === 0 && <EmptyState label="company-specific questions" />}
                      </div>
                    )}

                    {activeTab === "asks" && (
                      <div className="space-y-2">
                        {bFilter(norm.asks).map((a, i) => (
                          <BulletCard key={i} index={i} text={a} accent="blue"
                            reviewed={reviewed.has(`a-${i}`)}
                            onToggleReviewed={() => toggleReviewed(`a-${i}`)} />
                        ))}
                        {bFilter(norm.asks).length === 0 && <EmptyState label="questions to ask them" />}
                      </div>
                    )}

                    {activeTab === "gaps" && (
                      <div className="space-y-2">
                        {bFilter(norm.gaps).map((g, i) => (
                          <BulletCard key={i} index={i} text={g} accent="amber"
                            reviewed={reviewed.has(`g-${i}`)}
                            onToggleReviewed={() => toggleReviewed(`g-${i}`)} />
                        ))}
                        {bFilter(norm.gaps).length === 0 && <EmptyState label="gaps" />}
                      </div>
                    )}

                    {activeTab === "tough" && (
                      <div className="space-y-2">
                        {qFilter(norm.tough).map((q, i) => (
                          <QuestionCard key={i} index={i} q={q}
                            reviewed={reviewed.has(`tf-${i}`)}
                            onToggleReviewed={() => toggleReviewed(`tf-${i}`)} />
                        ))}
                        {qFilter(norm.tough).length === 0 && <EmptyState label="tough questions" />}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center">
      <p className="text-[11px] text-gray-500 dark:text-gray-400">No {label} to show.</p>
    </div>
  );
}

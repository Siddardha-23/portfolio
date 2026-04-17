import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiService } from "@/lib/api";
import type { InterviewPrepContent, TailoringRecord } from "@/types/resume";
import { formatDate } from "@/components/resume/ResumeDashboard";

function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return <span className={`inline-block rounded-full border-2 border-current border-t-transparent animate-spin ${className}`} />;
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-purple-400/80">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

function QuestionCard({ q }: { q: { question: string; why_asked?: string; answer_outline?: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800/60 bg-white/50 dark:bg-gray-900/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-gray-100/50 dark:hover:bg-gray-800/30"
      >
        <span className="text-[11px] text-purple-500/70 mt-0.5 select-none">{open ? "▾" : "▸"}</span>
        <span className="text-[12px] text-gray-800 dark:text-gray-200 flex-1 leading-snug">{q.question}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0 space-y-1.5 border-t border-gray-200 dark:border-gray-800/60">
          {q.why_asked && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
              <span className="font-semibold text-gray-600 dark:text-gray-300">Why asked: </span>{q.why_asked}
            </p>
          )}
          {q.answer_outline && (
            <p className="text-[11px] text-gray-700 dark:text-gray-300">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Answer outline: </span>{q.answer_outline}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function InterviewPrepTab() {
  const [records, setRecords] = useState<TailoringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState<InterviewPrepContent | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");

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

  // Load prep when selection changes
  useEffect(() => {
    if (!selectedId) { setContent(null); setGeneratedAt(null); return; }
    const rec = records.find(r => r.record_id === selectedId);
    const hasCached = rec?.interview_prep?.generated_at;
    if (!hasCached) { setContent(null); setGeneratedAt(null); return; }
    // Fetch full record to get full prep content
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
    if (resp.error) {
      toast.error("Failed to generate prep", { description: resp.error });
      return;
    }
    const prep = resp.data?.interview_prep;
    if (prep?.content) {
      setContent(prep.content);
      setGeneratedAt(prep.generated_at);
      if (resp.data?.cached) {
        toast.success("Loaded cached prep");
      } else {
        toast.success("Prep generated");
        // Also update the list so the chip shows "ready"
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

  if (loading) {
    return <div className="animate-pulse h-24 rounded-xl bg-gray-100/40 dark:bg-gray-800/40" />;
  }

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-900/40 p-10 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">No tailored resumes yet</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Tailor a resume first — prep is grounded in your JD + resume.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Interview Prep</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          AI-generated, grounded in the exact JD + resume version you applied with.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        {/* Record picker */}
        <aside className="rounded-xl border border-gray-200 dark:border-gray-800/60 bg-white/50 dark:bg-gray-900/30 p-2 space-y-1 max-h-[70vh] overflow-y-auto">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search role or company…"
            className="w-full px-2.5 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/60 text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 mb-1"
          />
          {filteredRecords.map(r => {
            const isSel = r.record_id === selectedId;
            const hasPrep = !!r.interview_prep?.generated_at;
            return (
              <button
                key={r.record_id}
                onClick={() => setSelectedId(r.record_id)}
                className={`w-full text-left px-2.5 py-2 rounded-md transition-colors ${isSel ? "bg-purple-500/15 border border-purple-500/30" : "hover:bg-gray-100/60 dark:hover:bg-gray-800/40 border border-transparent"}`}
              >
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                  {r.jd_analysis?.job_title || "Untitled"}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                  {r.jd_analysis?.company && r.jd_analysis.company !== "Not specified" ? r.jd_analysis.company : "—"}
                  <span className="mx-1">·</span>
                  {formatDate(r.created_at || "")}
                </p>
                {hasPrep && (
                  <span className="mt-1 inline-block text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/25">
                    Prep ready
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Prep content */}
        <main className="space-y-4">
          {selected ? (
            <>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800/60 bg-white/50 dark:bg-gray-900/30 p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {selected.jd_analysis?.job_title || "Untitled role"}
                    {selected.jd_analysis?.company && selected.jd_analysis.company !== "Not specified" ? ` · ${selected.jd_analysis.company}` : ""}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {generatedAt ? `Generated ${formatDate(generatedAt)}` : "No prep generated yet"}
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50"
                    >
                      {generating && <Spinner />} {generating ? "Generating prep…" : "Generate prep"}
                    </button>
                  )}
                </div>
              </div>

              {!content && !generating && (
                <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-xs text-gray-500 dark:text-gray-400">
                  Click <b>Generate prep</b> to create an interview pack grounded in the JD + current resume version.
                </div>
              )}

              {generating && !content && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-800/60 p-8 text-center text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
                  <Spinner /> Generating prep — this usually takes 10-20 seconds.
                </div>
              )}

              {content && (() => {
                // Gemini occasionally returns a field as a string (or {question:...})
                // instead of the expected list. Normalise everything defensively
                // so a malformed field can never crash the render.
                const asStrArray = (v: unknown): string[] => {
                  if (Array.isArray(v)) return v.filter(Boolean).map(String);
                  if (typeof v === "string" && v.trim()) {
                    // Split on sentence/newline/semicolon when a plain string comes back
                    return v.split(/\n+|(?<=\.)\s+|; /).map(s => s.trim()).filter(Boolean);
                  }
                  return [];
                };
                const asQArray = (v: unknown): { question: string; why_asked?: string; answer_outline?: string }[] => {
                  if (Array.isArray(v)) {
                    return v
                      .map(item => {
                        if (typeof item === "string") return { question: item };
                        if (item && typeof item === "object") {
                          const q = (item as any).question ?? (item as any).q ?? "";
                          if (!q) return null;
                          return {
                            question: String(q),
                            why_asked: (item as any).why_asked ? String((item as any).why_asked) : undefined,
                            answer_outline: (item as any).answer_outline ? String((item as any).answer_outline) : undefined,
                          };
                        }
                        return null;
                      })
                      .filter((x): x is { question: string; why_asked?: string; answer_outline?: string } => !!x);
                  }
                  if (typeof v === "string" && v.trim()) return [{ question: v }];
                  return [];
                };

                const talkingPoints = asStrArray(content.talking_points);
                const behavioral = asQArray(content.behavioral_questions);
                const technical = asQArray(content.technical_questions);
                const companySpecific = asQArray(content.company_specific);
                const gaps = asStrArray(content.gaps_to_address);
                const redFlags = asStrArray(content.red_flags);
                const askThem = asStrArray(content.questions_to_ask_them);

                return (
                  <div className="space-y-5 rounded-xl border border-gray-200 dark:border-gray-800/60 bg-white/50 dark:bg-gray-900/30 p-5">
                    {content.elevator_pitch && (
                      <Section title="Elevator pitch" subtitle="Open the interview with this.">
                        <p className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed">{content.elevator_pitch}</p>
                      </Section>
                    )}

                    {talkingPoints.length > 0 && (
                      <Section title="Talking points" subtitle="Your strongest selling points for this role.">
                        <ul className="space-y-1.5">
                          {talkingPoints.map((p, i) => (
                            <li key={i} className="text-[12px] text-gray-700 dark:text-gray-300 flex gap-2">
                              <span className="text-purple-500/70 shrink-0">•</span><span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </Section>
                    )}

                    {behavioral.length > 0 && (
                      <Section title={`Behavioral questions (${behavioral.length})`}>
                        <div className="space-y-1.5">
                          {behavioral.map((q, i) => <QuestionCard key={i} q={q} />)}
                        </div>
                      </Section>
                    )}

                    {technical.length > 0 && (
                      <Section title={`Technical questions (${technical.length})`}>
                        <div className="space-y-1.5">
                          {technical.map((q, i) => <QuestionCard key={i} q={q} />)}
                        </div>
                      </Section>
                    )}

                    {companySpecific.length > 0 && (
                      <Section title="Company-specific">
                        <div className="space-y-1.5">
                          {companySpecific.map((q, i) => <QuestionCard key={i} q={q} />)}
                        </div>
                      </Section>
                    )}

                    {gaps.length > 0 && (
                      <Section title="Gaps to address" subtitle="JD requirements not obvious in the resume — have a ready answer.">
                        <ul className="space-y-1">
                          {gaps.map((g, i) => (
                            <li key={i} className="text-[12px] text-amber-600 dark:text-amber-300 flex gap-2">
                              <span className="text-amber-500 shrink-0">⚠</span><span>{g}</span>
                            </li>
                          ))}
                        </ul>
                      </Section>
                    )}

                    {redFlags.length > 0 && (
                      <Section title="Likely tough questions">
                        <ul className="space-y-1">
                          {redFlags.map((r, i) => (
                            <li key={i} className="text-[12px] text-gray-700 dark:text-gray-300 flex gap-2">
                              <span className="text-red-500 shrink-0">!</span><span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </Section>
                    )}

                    {askThem.length > 0 && (
                      <Section title="Questions to ask them" subtitle="Thoughtful questions that show interest and due diligence.">
                        <ul className="space-y-1">
                          {askThem.map((q, i) => (
                            <li key={i} className="text-[12px] text-gray-700 dark:text-gray-300 flex gap-2">
                              <span className="text-purple-500/70 shrink-0">?</span><span>{q}</span>
                            </li>
                          ))}
                        </ul>
                      </Section>
                    )}

                    {talkingPoints.length + behavioral.length + technical.length + companySpecific.length + gaps.length + redFlags.length + askThem.length === 0 && !content.elevator_pitch && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                        The model didn't return structured content. Try <b>Regenerate</b>.
                      </p>
                    )}
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-xs text-gray-500 dark:text-gray-400">
              Select a tailoring record to generate or view its prep pack.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

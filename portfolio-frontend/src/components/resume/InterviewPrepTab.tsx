import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiService } from "@/lib/api";
import type {
  InterviewPrepContent, TailoringRecord, QDifficulty,
} from "@/types/resume";
import { formatDate } from "@/components/resume/ResumeDashboard";
import { normalize, difficultyChip } from "./InterviewPrep/prepUtils";
import type { NormalizedPrep } from "./InterviewPrep/prepUtils";
import {
  Spinner, CopyButton, DifficultyBadge, EmptyState,
  QuestionCard, BulletCard, CodingCard, CaseCard, SystemDesignCard, DataChallengeCard,
} from "./InterviewPrep/PracticeCards";
import CoachChat from "./InterviewPrep/CoachChat";
import MockInterview from "./InterviewPrep/MockInterview";

type TopTab = "overview" | "questions" | "practical" | "edge" | "mock" | "coach";
type QSubTab = "behavioral" | "technical" | "company" | "tough";
type PracticalSubTab = "coding" | "system_design" | "case_study" | "data_challenge";

const Q_SUBTABS: { key: QSubTab; label: string; icon: string }[] = [
  { key: "behavioral", label: "Behavioral", icon: "🧠" },
  { key: "technical",  label: "Technical",  icon: "⚙" },
  { key: "company",    label: "Company",    icon: "🏢" },
  { key: "tough",      label: "Tough Qs",   icon: "🔥" },
];

const PRACTICAL_SUBTABS: { key: PracticalSubTab; label: string; icon: string }[] = [
  { key: "coding",         label: "Coding",        icon: "💻" },
  { key: "system_design",  label: "System Design", icon: "🏗" },
  { key: "case_study",     label: "Case Studies",  icon: "📊" },
  { key: "data_challenge", label: "Data",          icon: "🔢" },
];

const ROLE_LABELS: Record<string, string> = {
  coding: "Coding / SWE",
  data: "Data / ML",
  devops: "DevOps / SRE",
  design: "Design",
  pm: "Product / PM",
  business: "Business / Consulting",
  research: "Research",
  generic: "General",
};

export default function InterviewPrepTab() {
  const [records, setRecords] = useState<TailoringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState<InterviewPrepContent | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [topTab, setTopTab] = useState<TopTab>("overview");
  const [qSub, setQSub] = useState<QSubTab>("behavioral");
  const [practicalSub, setPracticalSub] = useState<PracticalSubTab>("coding");
  const [diffFilter, setDiffFilter] = useState<QDifficulty | "all">("all");
  const [fetchingMore, setFetchingMore] = useState<string | null>(null); // key = category
  const [coachPrompt, setCoachPrompt] = useState<string | null>(null);

  // ── Load records
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

  // ── Reviewed-items persistence (localStorage per record)
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
      if (reviewedKey) { try { localStorage.setItem(reviewedKey, JSON.stringify([...next])); } catch {} }
      return next;
    });
  }, [reviewedKey]);

  // ── Load prep when selection changes
  useEffect(() => {
    if (!selectedId) { setContent(null); setGeneratedAt(null); return; }
    const rec = records.find(r => r.record_id === selectedId);
    const hasCached = rec?.interview_prep?.generated_at;
    if (!hasCached) { setContent(null); setGeneratedAt(null); return; }
    (async () => {
      const full = await apiService.getTailoringRecord(selectedId);
      const prep = full.data?.record?.interview_prep;
      if (prep?.content) { setContent(prep.content); setGeneratedAt(prep.generated_at || null); }
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

  const norm: NormalizedPrep | null = useMemo(() => normalize(content), [content]);

  // ── "Get another" — fetch a fresh question from backend, append to content
  const fetchAnother = useCallback(async (
    category: "behavioral" | "technical" | "company" | "coding" | "system_design" | "case_study" | "data_challenge",
    difficulty: QDifficulty,
  ) => {
    if (!selectedId) return;
    setFetchingMore(category);

    const seen: string[] = [];
    if (norm) {
      if (category === "behavioral") seen.push(...norm.behavioral.map(q => q.question));
      if (category === "technical") seen.push(...norm.technical.map(q => q.question));
      if (category === "company") seen.push(...norm.company.map(q => q.question));
      if (category === "coding") seen.push(...norm.coding.map(c => c.title));
      if (category === "system_design") seen.push(...norm.systemDesign.map(c => c.title));
      if (category === "case_study") seen.push(...norm.cases.map(c => c.title));
      if (category === "data_challenge") seen.push(...norm.data.map(c => c.title));
    }

    const r = await apiService.getPracticeQuestion(selectedId, {
      category, difficulty, seen_titles: seen.slice(-20),
    });
    setFetchingMore(null);
    if (r.error || !r.data?.question) {
      toast.error("Couldn't get another", { description: r.error });
      return;
    }
    // Append into local content
    setContent(prev => {
      if (!prev) return prev;
      const next = { ...prev };
      const q = r.data!.question;
      switch (category) {
        case "behavioral":    next.behavioral_questions = [...(prev.behavioral_questions || []), q]; break;
        case "technical":     next.technical_questions  = [...(prev.technical_questions  || []), q]; break;
        case "company":       next.company_specific     = [...(prev.company_specific     || []), q]; break;
        case "coding":        next.coding_problems      = [...(prev.coding_problems      || []), q]; break;
        case "system_design": next.system_design_prompts = [...(prev.system_design_prompts || []), q]; break;
        case "case_study":    next.case_studies         = [...(prev.case_studies         || []), q]; break;
        case "data_challenge": next.data_challenges     = [...(prev.data_challenges      || []), q]; break;
      }
      return next;
    });
    toast.success("Added a fresh question");
  }, [selectedId, norm]);

  const askCoach = useCallback((prompt: string) => {
    setCoachPrompt(prompt);
    setTopTab("coach");
  }, []);

  // ── Difficulty filter helper
  const applyDiff = <T extends { difficulty?: QDifficulty }>(items: T[]): T[] => {
    if (diffFilter === "all") return items;
    return items.filter(x => x.difficulty === diffFilter);
  };

  const totalItems = norm ? (
    norm.behavioral.length + norm.technical.length + norm.company.length
    + norm.coding.length + norm.cases.length + norm.systemDesign.length + norm.data.length
    + norm.gaps.length + norm.tough.length + norm.asks.length + norm.talking.length
  ) : 0;
  const progress = totalItems > 0 ? Math.round((reviewed.size / totalItems) * 100) : 0;

  // Which practical sub-tabs have content / are worth showing?
  const practicalAvailable = norm ? {
    coding: norm.coding.length > 0,
    system_design: norm.systemDesign.length > 0,
    case_study: norm.cases.length > 0,
    data_challenge: norm.data.length > 0,
  } : null;
  const hasAnyPractical = practicalAvailable && Object.values(practicalAvailable).some(Boolean);

  // Auto-pick a practical subtab that has content
  useEffect(() => {
    if (!practicalAvailable) return;
    if (!practicalAvailable[practicalSub]) {
      const first = (Object.keys(practicalAvailable) as PracticalSubTab[]).find(k => practicalAvailable[k]);
      if (first) setPracticalSub(first);
    }
  }, [practicalAvailable, practicalSub]);

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

  const TOP_TABS: { key: TopTab; label: string; icon: string; show?: boolean }[] = [
    { key: "overview",  label: "Overview",    icon: "✨" },
    { key: "questions", label: "Questions",   icon: "❓" },
    { key: "practical", label: "Practical",   icon: "🧪", show: !!hasAnyPractical },
    { key: "edge",      label: "Your Edge",   icon: "🎯" },
    { key: "mock",      label: "Mock Interview", icon: "🎤" },
    { key: "coach",     label: "AI Coach",    icon: "🧑‍🏫" },
  ].filter(t => t.show === undefined || t.show);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Interview Prep</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          A collaborative practice system — question banks, timed mock answers with AI grading, an always-on coach who knows your resume and JD.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        {/* Record picker */}
        <aside className="rounded-xl border border-gray-200 dark:border-gray-800/60 bg-white/50 dark:bg-gray-900/30 p-2 space-y-1 max-h-[80vh] overflow-y-auto">
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

        {/* Main */}
        <main className="space-y-4">
          {!selected ? (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-xs text-gray-500 dark:text-gray-400">
              Select a tailoring record to view or generate its prep pack.
            </div>
          ) : (
            <>
              {/* Title / generate card */}
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
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>{generatedAt ? `Generated ${formatDate(generatedAt)}` : "No prep generated yet"}</span>
                      {norm?.role_type && (
                        <>
                          <span>·</span>
                          <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25 text-[10px] font-semibold">{ROLE_LABELS[norm.role_type] || norm.role_type}</span>
                        </>
                      )}
                      {totalItems > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{reviewed.size}</span>
                          <span>of {totalItems} reviewed</span>
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
                      >{generating ? "Regenerating…" : "Regenerate"}</button>
                    )}
                    {!content && (
                      <button
                        onClick={() => handleGenerate(false)}
                        disabled={generating}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 shadow-sm shadow-purple-500/25"
                      >{generating && <Spinner />} {generating ? "Generating prep…" : "Generate prep"}</button>
                    )}
                  </div>
                </div>

                {totalItems > 0 && (
                  <div className="mt-4">
                    <div className="h-1 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">{progress}% reviewed</p>
                  </div>
                )}
              </div>

              {!content && !generating && (
                <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-xs text-gray-500 dark:text-gray-400">
                  Click <b>Generate prep</b> to create an interview pack with role-adaptive questions, coding / case / system design problems, and open the AI coach.
                </div>
              )}
              {generating && !content && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-800/60 p-8 text-center text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
                  <Spinner /> Generating prep — usually 15–30 seconds for a full pack.
                </div>
              )}

              {content && norm && (
                <>
                  {/* Top-level tabs */}
                  <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800/60 pb-0.5">
                    {TOP_TABS.map(t => {
                      const isActive = topTab === t.key;
                      return (
                        <button
                          key={t.key}
                          onClick={() => setTopTab(t.key)}
                          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[11px] font-medium transition-all border-b-2 ${
                            isActive
                              ? "border-purple-500 text-gray-900 dark:text-gray-100 bg-purple-500/5"
                              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                          }`}
                        >
                          <span>{t.icon}</span>{t.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2">
                    {/* ── Overview ── */}
                    {topTab === "overview" && (
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
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-2">💪 Talking points</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {norm.talking.map((t, i) => (
                                <BulletCard key={i} index={i} text={t} accent="purple"
                                  reviewed={reviewed.has(`tp-${i}`)}
                                  onToggleReviewed={() => toggleReviewed(`tp-${i}`)} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Section counts as jump-links */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {[
                            { label: "Behavioral",   count: norm.behavioral.length,   tab: "questions", sub: "behavioral", icon: "🧠" },
                            { label: "Technical",    count: norm.technical.length,    tab: "questions", sub: "technical",  icon: "⚙" },
                            { label: "Company",      count: norm.company.length,      tab: "questions", sub: "company",    icon: "🏢" },
                            { label: "Tough Qs",     count: norm.tough.length,        tab: "questions", sub: "tough",      icon: "🔥" },
                            { label: "Coding",       count: norm.coding.length,       tab: "practical", sub: "coding",     icon: "💻" },
                            { label: "System Design",count: norm.systemDesign.length, tab: "practical", sub: "system_design", icon: "🏗" },
                            { label: "Case Studies", count: norm.cases.length,        tab: "practical", sub: "case_study", icon: "📊" },
                            { label: "Data",         count: norm.data.length,         tab: "practical", sub: "data_challenge", icon: "🔢" },
                          ].filter(x => x.count > 0).map(x => (
                            <button
                              key={x.label}
                              onClick={() => { setTopTab(x.tab as TopTab); if (x.tab === "questions") setQSub(x.sub as QSubTab); if (x.tab === "practical") setPracticalSub(x.sub as PracticalSubTab); }}
                              className="rounded-lg border border-gray-200 dark:border-gray-800/60 bg-white/50 dark:bg-gray-900/30 px-3 py-2.5 text-left hover:border-purple-500/40 hover:bg-purple-500/5 transition-colors"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs">{x.icon}</span>
                                <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{x.label}</p>
                              </div>
                              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums mt-0.5">{x.count}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Questions ── */}
                    {topTab === "questions" && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800/60 p-0.5 border border-gray-200 dark:border-gray-800">
                            {Q_SUBTABS.map(s => (
                              <button
                                key={s.key}
                                onClick={() => setQSub(s.key)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium rounded capitalize ${qSub === s.key ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}
                              >
                                <span>{s.icon}</span>{s.label}
                              </button>
                            ))}
                          </div>
                          <DifficultyFilter value={diffFilter} onChange={setDiffFilter} />
                          <div className="flex-1" />
                          {(["behavioral", "technical", "company"].includes(qSub)) && (
                            <GetAnotherButton
                              loading={fetchingMore === qSub}
                              difficulty={diffFilter === "all" ? "medium" : diffFilter}
                              onClick={(d) => fetchAnother(qSub as any, d)}
                            />
                          )}
                        </div>
                        {qSub === "behavioral" && (
                          <QuestionList
                            items={applyDiff(norm.behavioral)}
                            keyPrefix="b"
                            reviewed={reviewed} toggleReviewed={toggleReviewed}
                            emptyLabel="behavioral questions"
                            onPractice={(q) => { setTopTab("mock"); /* user can pick it up from mock */ }}
                            onAskCoach={askCoach}
                          />
                        )}
                        {qSub === "technical" && (
                          <QuestionList items={applyDiff(norm.technical)} keyPrefix="t"
                            reviewed={reviewed} toggleReviewed={toggleReviewed}
                            emptyLabel="technical questions" onAskCoach={askCoach} />
                        )}
                        {qSub === "company" && (
                          <QuestionList items={applyDiff(norm.company)} keyPrefix="c"
                            reviewed={reviewed} toggleReviewed={toggleReviewed}
                            emptyLabel="company questions" onAskCoach={askCoach} />
                        )}
                        {qSub === "tough" && (
                          <QuestionList items={applyDiff(norm.tough as any)} keyPrefix="tough"
                            reviewed={reviewed} toggleReviewed={toggleReviewed}
                            emptyLabel="tough questions" onAskCoach={askCoach} />
                        )}
                      </div>
                    )}

                    {/* ── Practical ── */}
                    {topTab === "practical" && practicalAvailable && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800/60 p-0.5 border border-gray-200 dark:border-gray-800">
                            {PRACTICAL_SUBTABS.filter(s => practicalAvailable[s.key]).map(s => (
                              <button
                                key={s.key}
                                onClick={() => setPracticalSub(s.key)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium rounded ${practicalSub === s.key ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}
                              >
                                <span>{s.icon}</span>{s.label}
                              </button>
                            ))}
                          </div>
                          <DifficultyFilter value={diffFilter} onChange={setDiffFilter} />
                          <div className="flex-1" />
                          <GetAnotherButton
                            loading={fetchingMore === practicalSub}
                            difficulty={diffFilter === "all" ? "medium" : diffFilter}
                            onClick={(d) => fetchAnother(practicalSub as any, d)}
                          />
                        </div>

                        {practicalSub === "coding" && (
                          <CardList items={applyDiff(norm.coding)} empty="coding problems">
                            {(p, i) => (
                              <CodingCard p={p} index={i}
                                reviewed={reviewed.has(`code-${i}`)}
                                onToggleReviewed={() => toggleReviewed(`code-${i}`)}
                                onAskCoach={askCoach} />
                            )}
                          </CardList>
                        )}
                        {practicalSub === "system_design" && (
                          <CardList items={applyDiff(norm.systemDesign)} empty="system design prompts">
                            {(p, i) => (
                              <SystemDesignCard p={p} index={i}
                                reviewed={reviewed.has(`sd-${i}`)}
                                onToggleReviewed={() => toggleReviewed(`sd-${i}`)}
                                onAskCoach={askCoach} />
                            )}
                          </CardList>
                        )}
                        {practicalSub === "case_study" && (
                          <CardList items={applyDiff(norm.cases)} empty="case studies">
                            {(c, i) => (
                              <CaseCard c={c} index={i}
                                reviewed={reviewed.has(`case-${i}`)}
                                onToggleReviewed={() => toggleReviewed(`case-${i}`)}
                                onAskCoach={askCoach} />
                            )}
                          </CardList>
                        )}
                        {practicalSub === "data_challenge" && (
                          <CardList items={applyDiff(norm.data)} empty="data challenges">
                            {(d, i) => (
                              <DataChallengeCard d={d} index={i}
                                reviewed={reviewed.has(`data-${i}`)}
                                onToggleReviewed={() => toggleReviewed(`data-${i}`)}
                                onAskCoach={askCoach} />
                            )}
                          </CardList>
                        )}
                      </div>
                    )}

                    {/* ── Edge: gaps + asks ── */}
                    {topTab === "edge" && (
                      <div className="space-y-4">
                        {norm.gaps.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300 mb-2">⚠ Gaps to close</p>
                            <div className="space-y-1.5">
                              {norm.gaps.map((g, i) => (
                                <BulletCard key={i} index={i} text={g} accent="amber"
                                  reviewed={reviewed.has(`g-${i}`)} onToggleReviewed={() => toggleReviewed(`g-${i}`)} />
                              ))}
                            </div>
                          </div>
                        )}
                        {norm.asks.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300 mb-2">❓ Questions to ask them</p>
                            <div className="space-y-1.5">
                              {norm.asks.map((a, i) => (
                                <BulletCard key={i} index={i} text={a} accent="blue"
                                  reviewed={reviewed.has(`a-${i}`)} onToggleReviewed={() => toggleReviewed(`a-${i}`)} />
                              ))}
                            </div>
                          </div>
                        )}
                        {norm.gaps.length === 0 && norm.asks.length === 0 && <EmptyState label="edge notes" />}
                      </div>
                    )}

                    {/* ── Mock Interview ── */}
                    {topTab === "mock" && (
                      <MockInterview recordId={selected.record_id} prep={norm} />
                    )}

                    {/* ── AI Coach ── */}
                    {topTab === "coach" && (
                      <CoachChat
                        recordId={selected.record_id}
                        externalPrompt={coachPrompt}
                        onClearExternal={() => setCoachPrompt(null)}
                      />
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

// ─── Small helpers ────────────────────────────────────────────────────────

function DifficultyFilter({
  value, onChange,
}: {
  value: QDifficulty | "all";
  onChange: (v: QDifficulty | "all") => void;
}) {
  const opts: { key: QDifficulty | "all"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "easy", label: "Easy" },
    { key: "medium", label: "Medium" },
    { key: "hard", label: "Hard" },
  ];
  return (
    <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800/60 p-0.5 border border-gray-200 dark:border-gray-800">
      {opts.map(o => {
        const active = value === o.key;
        const chip = o.key === "all" ? { cls: "" } : difficultyChip(o.key);
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`px-2 py-1 text-[10px] font-medium rounded ${active ? (o.key === "all" ? "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm" : `${chip.cls} border-0 shadow-sm`) : "text-gray-500 dark:text-gray-400"}`}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

function GetAnotherButton({
  loading, difficulty, onClick,
}: {
  loading: boolean;
  difficulty: QDifficulty;
  onClick: (d: QDifficulty) => void;
}) {
  return (
    <button
      onClick={() => onClick(difficulty)}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 shadow-sm"
      title={`Generate a new ${difficulty} question`}
    >
      {loading ? <Spinner className="w-3 h-3" /> : <span>+</span>} Get another
    </button>
  );
}

function QuestionList({
  items, keyPrefix, reviewed, toggleReviewed, emptyLabel, onPractice, onAskCoach,
}: {
  items: any[];
  keyPrefix: string;
  reviewed: Set<string>;
  toggleReviewed: (id: string) => void;
  emptyLabel: string;
  onPractice?: () => void;
  onAskCoach?: (prompt: string) => void;
}) {
  if (items.length === 0) return <EmptyState label={emptyLabel} />;
  return (
    <div className="space-y-2">
      {items.map((q, i) => (
        <QuestionCard
          key={`${keyPrefix}-${i}`}
          q={q}
          index={i}
          reviewed={reviewed.has(`${keyPrefix}-${i}`)}
          onToggleReviewed={() => toggleReviewed(`${keyPrefix}-${i}`)}
          onPractice={onPractice}
          {...(onAskCoach ? { onPractice: () => onAskCoach(`Let's drill this behavioral question together. Question: "${q.question}". Start by asking me to answer, then give me feedback STAR-style.`) } : {})}
        />
      ))}
    </div>
  );
}

function CardList<T>({
  items, empty, children,
}: {
  items: T[];
  empty: string;
  children: (item: T, index: number) => React.ReactNode;
}) {
  if (items.length === 0) return <EmptyState label={empty} />;
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i}>{children(it, i)}</div>
      ))}
    </div>
  );
}

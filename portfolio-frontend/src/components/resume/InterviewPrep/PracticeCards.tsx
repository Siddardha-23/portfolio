import { useMemo, useState } from "react";
import type {
  InterviewPrepQuestion,
  CodingProblem,
  CaseStudy,
  SystemDesignPrompt,
  DataChallenge,
  QDifficulty,
} from "@/types/resume";
import { difficultyChip, splitStar } from "./prepUtils";

// ─── Shared atoms ─────────────────────────────────────────────────────────
export function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return <span className={`inline-block rounded-full border-2 border-current border-t-transparent animate-spin ${className}`} />;
}

export function CopyButton({ text, title = "Copy" }: { text: string; title?: string }) {
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

export function DifficultyBadge({ d }: { d?: QDifficulty | string }) {
  const chip = difficultyChip(d);
  return (
    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${chip.cls}`}>
      {chip.label}
    </span>
  );
}

export function ReviewCheckbox({ reviewed, onToggle }: { reviewed: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={reviewed ? "Mark as not reviewed" : "Mark as reviewed"}
      className={`shrink-0 mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
        reviewed ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 dark:border-gray-600 hover:border-emerald-400"
      }`}
    >
      {reviewed && <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>}
    </button>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center">
      <p className="text-[11px] text-gray-500 dark:text-gray-400">No {label} to show.</p>
    </div>
  );
}

// ─── Question card (behavioral / technical / company / tough) ─────────────
export function QuestionCard({
  q,
  index,
  reviewed,
  onToggleReviewed,
  onPractice,
}: {
  q: InterviewPrepQuestion;
  index: number;
  reviewed: boolean;
  onToggleReviewed: () => void;
  onPractice?: () => void;
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
        <ReviewCheckbox reviewed={reviewed} onToggle={onToggleReviewed} />
        <span className="shrink-0 mt-0.5 inline-flex w-5 h-5 items-center justify-center rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-300 text-[10px] font-bold tabular-nums">
          {index + 1}
        </span>
        <button onClick={() => setOpen(o => !o)} className="flex-1 min-w-0 text-left">
          <div className="flex items-start gap-2">
            <p className={`flex-1 text-[12.5px] leading-snug ${reviewed ? "text-gray-500 dark:text-gray-500" : "text-gray-800 dark:text-gray-200"}`}>
              {q.question}
            </p>
            <DifficultyBadge d={q.difficulty} />
          </div>
          {!open && q.answer_outline && (
            <p className="text-[10.5px] text-gray-400 dark:text-gray-500 mt-1 line-clamp-1 italic">
              {q.answer_outline}
            </p>
          )}
        </button>
        {onPractice && (
          <button
            onClick={onPractice}
            title="Practice this question"
            className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
            </svg>
          </button>
        )}
        <CopyButton text={`Q: ${q.question}${q.answer_outline ? `\nA: ${q.answer_outline}` : ""}`} />
        <button onClick={() => setOpen(o => !o)} className="shrink-0 w-6 h-6 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
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
              <div>
                <div className="flex gap-2 mb-1.5 items-center">
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

// ─── Bullet card (talking points, gaps, asks) ─────────────────────────────
export function BulletCard({
  text, index, accent, reviewed, onToggleReviewed,
}: {
  text: string;
  index: number;
  accent: "purple" | "amber" | "blue" | "emerald";
  reviewed: boolean;
  onToggleReviewed: () => void;
}) {
  const colorMap = {
    purple:  "bg-purple-500/10 text-purple-600 dark:text-purple-300",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    blue:    "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  }[accent];
  return (
    <div className={`rounded-lg border px-3 py-2 flex items-start gap-2.5 ${reviewed ? "border-emerald-500/30 bg-emerald-500/5 opacity-70" : "border-gray-200 dark:border-gray-800/60 bg-white/50 dark:bg-gray-900/40"}`}>
      <ReviewCheckbox reviewed={reviewed} onToggle={onToggleReviewed} />
      <span className={`shrink-0 inline-flex w-5 h-5 items-center justify-center rounded-md ${colorMap} text-[10px] font-bold tabular-nums`}>
        {index + 1}
      </span>
      <p className={`flex-1 text-[12px] leading-relaxed ${reviewed ? "text-gray-500 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"}`}>{text}</p>
      <CopyButton text={text} />
    </div>
  );
}

// ─── Coding problem card ──────────────────────────────────────────────────
export function CodingCard({
  p, index, reviewed, onToggleReviewed, onAskCoach,
}: {
  p: CodingProblem;
  index: number;
  reviewed: boolean;
  onToggleReviewed: () => void;
  onAskCoach?: (prompt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(0);
  const [showApproach, setShowApproach] = useState(false);

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${reviewed ? "border-emerald-500/30 bg-emerald-500/5" : "border-gray-200 dark:border-gray-800/60 bg-white/70 dark:bg-gray-900/40"}`}>
      <div className="px-4 py-3 flex items-start gap-2.5">
        <ReviewCheckbox reviewed={reviewed} onToggle={onToggleReviewed} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold tabular-nums text-purple-500 dark:text-purple-400">#{index + 1}</span>
            <h4 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{p.title}</h4>
            <DifficultyBadge d={p.difficulty} />
            {(p.skill_tags || []).slice(0, 4).map((t, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">{t}</span>
            ))}
          </div>
          <p className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed mt-2">{p.problem_statement}</p>

          {(p.constraints?.length || 0) > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">Constraints</p>
              <ul className="text-[11px] text-gray-600 dark:text-gray-400 space-y-0.5">
                {p.constraints!.map((c, i) => <li key={i} className="pl-3 before:content-['•'] before:text-purple-400 before:mr-1 before:-ml-3">{c}</li>)}
              </ul>
            </div>
          )}

          {(p.examples?.length || 0) > 0 && (
            <div className="mt-2 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Examples</p>
              {p.examples!.map((ex, i) => (
                <div key={i} className="rounded-md bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 p-2 font-mono text-[10.5px]">
                  <div><span className="text-blue-500">input:</span> <span className="text-gray-700 dark:text-gray-300">{ex.input}</span></div>
                  <div><span className="text-emerald-500">output:</span> <span className="text-gray-700 dark:text-gray-300">{ex.output}</span></div>
                  {ex.explanation && <div className="text-gray-500 dark:text-gray-500 italic mt-0.5 font-sans text-[10.5px]">{ex.explanation}</div>}
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {(p.hints?.length || 0) > 0 && (
              <button
                onClick={() => setShowHint(h => Math.min((p.hints?.length || 0), h + 1))}
                disabled={showHint >= (p.hints?.length || 0)}
                className="text-[10px] px-2 py-1 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
              >
                💡 {showHint === 0 ? "Reveal hint" : showHint >= (p.hints?.length || 0) ? "All hints shown" : `Next hint (${showHint}/${p.hints?.length})`}
              </button>
            )}
            {p.approach && (
              <button
                onClick={() => setShowApproach(v => !v)}
                className="text-[10px] px-2 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20"
              >
                🧭 {showApproach ? "Hide approach" : "Reveal approach"}
              </button>
            )}
            {onAskCoach && (
              <button
                onClick={() => onAskCoach(`Help me solve this problem step-by-step: ${p.title}. ${p.problem_statement}`)}
                className="text-[10px] px-2 py-1 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300 hover:bg-purple-500/20"
              >
                💬 Ask coach
              </button>
            )}
            <button
              onClick={() => setOpen(o => !o)}
              className="text-[10px] px-2 py-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >{open ? "Less" : "More"}</button>
            <CopyButton text={`${p.title}\n\n${p.problem_statement}`} />
          </div>

          {showHint > 0 && (p.hints?.length || 0) > 0 && (
            <div className="mt-2 space-y-1">
              {p.hints!.slice(0, showHint).map((h, i) => (
                <div key={i} className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                  <span className="font-bold mr-1">Hint {i + 1}:</span>{h}
                </div>
              ))}
            </div>
          )}

          {showApproach && p.approach && (
            <div className="mt-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-2 text-[11px] text-emerald-700 dark:text-emerald-300">
              <p className="font-bold text-[10px] uppercase tracking-wider mb-0.5">Approach</p>
              {p.approach}
              {p.complexity && (
                <p className="mt-1 font-mono text-[10.5px] text-emerald-600 dark:text-emerald-400">{p.complexity}</p>
              )}
            </div>
          )}

          {open && (
            <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-800/60 text-[10px] text-gray-500 dark:text-gray-400">
              Tip: use the <b>Mock Interview</b> tab to attempt this under a timer and get graded feedback.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Case study card ──────────────────────────────────────────────────────
export function CaseCard({
  c, index, reviewed, onToggleReviewed, onAskCoach,
}: {
  c: CaseStudy;
  index: number;
  reviewed: boolean;
  onToggleReviewed: () => void;
  onAskCoach?: (prompt: string) => void;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${reviewed ? "border-emerald-500/30 bg-emerald-500/5" : "border-gray-200 dark:border-gray-800/60 bg-white/70 dark:bg-gray-900/40"}`}>
      <div className="flex items-start gap-2.5">
        <ReviewCheckbox reviewed={reviewed} onToggle={onToggleReviewed} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold tabular-nums text-blue-500">#{index + 1}</span>
            <h4 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{c.title}</h4>
            <DifficultyBadge d={c.difficulty} />
          </div>
          <p className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed mt-2">{c.scenario}</p>

          {(c.subtasks?.length || 0) > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Subtasks</p>
              <ul className="space-y-1">
                {c.subtasks!.map((s, i) => (
                  <li key={i} className="flex gap-2 text-[11.5px] text-gray-700 dark:text-gray-300">
                    <span className="shrink-0 text-blue-400">▸</span><span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(c.evaluation_criteria?.length || 0) > 0 && (
            <details className="mt-2 group">
              <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-emerald-500 hover:text-emerald-400">
                What the interviewer evaluates ↓
              </summary>
              <ul className="mt-1 space-y-0.5 pl-3">
                {c.evaluation_criteria!.map((e, i) => (
                  <li key={i} className="text-[11px] text-gray-600 dark:text-gray-400 list-disc ml-3">{e}</li>
                ))}
              </ul>
            </details>
          )}

          {(c.hints?.length || 0) > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-amber-500 hover:text-amber-400">
                Hints ↓
              </summary>
              <ul className="mt-1 space-y-0.5 pl-3">
                {c.hints!.map((h, i) => (
                  <li key={i} className="text-[11px] text-amber-700 dark:text-amber-300 list-disc ml-3">{h}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-2 flex items-center gap-2">
            {onAskCoach && (
              <button
                onClick={() => onAskCoach(`Walk me through how to approach this case: ${c.title}. ${c.scenario}`)}
                className="text-[10px] px-2 py-1 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300 hover:bg-purple-500/20"
              >💬 Discuss with coach</button>
            )}
            <CopyButton text={`${c.title}\n${c.scenario}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── System design card ───────────────────────────────────────────────────
export function SystemDesignCard({
  p, index, reviewed, onToggleReviewed, onAskCoach,
}: {
  p: SystemDesignPrompt;
  index: number;
  reviewed: boolean;
  onToggleReviewed: () => void;
  onAskCoach?: (prompt: string) => void;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${reviewed ? "border-emerald-500/30 bg-emerald-500/5" : "border-gray-200 dark:border-gray-800/60 bg-white/70 dark:bg-gray-900/40"}`}>
      <div className="flex items-start gap-2.5">
        <ReviewCheckbox reviewed={reviewed} onToggle={onToggleReviewed} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold tabular-nums text-indigo-500">#{index + 1}</span>
            <h4 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{p.title}</h4>
            <DifficultyBadge d={p.difficulty} />
          </div>
          <p className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed mt-2">{p.scope}</p>

          {(p.requirements?.length || 0) > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Requirements</p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-1">
                {p.requirements!.map((r, i) => (
                  <li key={i} className="text-[11px] text-gray-700 dark:text-gray-300 flex gap-1.5">
                    <span className="text-indigo-400 shrink-0">◆</span><span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(p.suggested_components?.length || 0) > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Suggested components</p>
              <div className="flex flex-wrap gap-1">
                {p.suggested_components!.map((c, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">{c}</span>
                ))}
              </div>
            </div>
          )}

          {(p.discussion_points?.length || 0) > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-emerald-500 hover:text-emerald-400">
                Tradeoffs to surface ↓
              </summary>
              <ul className="mt-1 space-y-0.5 pl-3">
                {p.discussion_points!.map((d, i) => (
                  <li key={i} className="text-[11px] text-gray-600 dark:text-gray-400 list-disc ml-3">{d}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-2 flex items-center gap-2">
            {onAskCoach && (
              <button
                onClick={() => onAskCoach(`Let's design this together: ${p.title}. ${p.scope}. What do I clarify first?`)}
                className="text-[10px] px-2 py-1 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300 hover:bg-purple-500/20"
              >💬 Whiteboard with coach</button>
            )}
            <CopyButton text={`${p.title}\n${p.scope}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Data challenge card ──────────────────────────────────────────────────
export function DataChallengeCard({
  d, index, reviewed, onToggleReviewed, onAskCoach,
}: {
  d: DataChallenge;
  index: number;
  reviewed: boolean;
  onToggleReviewed: () => void;
  onAskCoach?: (prompt: string) => void;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${reviewed ? "border-emerald-500/30 bg-emerald-500/5" : "border-gray-200 dark:border-gray-800/60 bg-white/70 dark:bg-gray-900/40"}`}>
      <div className="flex items-start gap-2.5">
        <ReviewCheckbox reviewed={reviewed} onToggle={onToggleReviewed} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold tabular-nums text-cyan-500">#{index + 1}</span>
            <h4 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{d.title}</h4>
            <DifficultyBadge d={d.difficulty} />
          </div>
          <p className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed mt-2">{d.scenario}</p>
          {d.deliverable && (
            <div className="mt-2 rounded-md bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-300">Deliverable</p>
              <p className="text-[11.5px] text-gray-700 dark:text-gray-300 mt-0.5">{d.deliverable}</p>
            </div>
          )}
          {(d.hints?.length || 0) > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-amber-500 hover:text-amber-400">Hints ↓</summary>
              <ul className="mt-1 space-y-0.5 pl-3">
                {d.hints!.map((h, i) => (
                  <li key={i} className="text-[11px] text-amber-700 dark:text-amber-300 list-disc ml-3">{h}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-2 flex items-center gap-2">
            {onAskCoach && (
              <button
                onClick={() => onAskCoach(`How would you tackle this data challenge? ${d.title}. ${d.scenario}`)}
                className="text-[10px] px-2 py-1 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300 hover:bg-purple-500/20"
              >💬 Ask coach</button>
            )}
            <CopyButton text={`${d.title}\n${d.scenario}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

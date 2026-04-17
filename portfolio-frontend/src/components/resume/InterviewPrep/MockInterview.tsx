import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiService } from "@/lib/api";
import type { QDifficulty, MockEvaluation } from "@/types/resume";
import { DifficultyBadge, Spinner } from "./PracticeCards";
import { asStrArray, sanitize } from "./prepUtils";
import type { NormalizedPrep } from "./prepUtils";

// Gemini sometimes returns evaluation list fields as JSON-encoded strings or
// single strings. Normalise defensively so the render never crashes.
function normalizeEvaluation(raw: any): MockEvaluation {
  const scoreRaw = raw?.score;
  let score = 0;
  if (typeof scoreRaw === "number") score = Math.round(scoreRaw);
  else if (typeof scoreRaw === "string") {
    const m = scoreRaw.match(/\d+/);
    score = m ? Math.min(100, parseInt(m[0], 10)) : 0;
  }
  return {
    score: Math.max(0, Math.min(100, score)),
    verdict: raw?.verdict ? sanitize(String(raw.verdict)) : "",
    strengths: asStrArray(raw?.strengths),
    improvements: asStrArray(raw?.improvements),
    missing_points: asStrArray(raw?.missing_points),
    model_answer: raw?.model_answer ? sanitize(String(raw.model_answer)) : "",
  };
}

type Category =
  | "behavioral" | "technical" | "company"
  | "coding" | "system_design" | "case_study" | "data_challenge" | "mixed";

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: "mixed",          label: "Mixed",        icon: "🎲" },
  { key: "behavioral",     label: "Behavioral",   icon: "🧠" },
  { key: "technical",      label: "Technical",    icon: "⚙" },
  { key: "coding",         label: "Coding",       icon: "💻" },
  { key: "system_design",  label: "System design", icon: "🏗" },
  { key: "case_study",     label: "Case study",   icon: "📊" },
  { key: "data_challenge", label: "Data",         icon: "🔢" },
  { key: "company",        label: "Company",      icon: "🏢" },
];

const DIFFICULTIES: { key: QDifficulty | "mixed"; label: string }[] = [
  { key: "mixed",  label: "Mixed" },
  { key: "easy",   label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard",   label: "Hard" },
];

// Convert any question-like object into plain text for display + eval
interface CurrentQ {
  text: string;
  kind: Category;
  difficulty?: QDifficulty;
  meta?: any;
}

export default function MockInterview({
  recordId, prep,
}: {
  recordId: string;
  prep: NormalizedPrep | null;
}) {
  const [cat, setCat] = useState<Category>("mixed");
  const [diff, setDiff] = useState<QDifficulty | "mixed">("mixed");
  const [current, setCurrent] = useState<CurrentQ | null>(null);
  const [answer, setAnswer] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [evaluation, setEvaluation] = useState<MockEvaluation | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [history, setHistory] = useState<{ q: string; score: number; cat: Category }[]>([]);

  // Derive banks from the existing prep for cheap (free) questions
  const banks = useMemo(() => {
    if (!prep) return null;
    return {
      behavioral: prep.behavioral,
      technical: prep.technical,
      company: prep.company,
      coding: prep.coding,
      system_design: prep.systemDesign,
      case_study: prep.cases,
      data_challenge: prep.data,
    } as Record<string, any[]>;
  }, [prep]);

  // Timer
  useEffect(() => {
    if (!timerActive) return;
    const t = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [timerActive]);

  const avgScore = useMemo(() => {
    if (history.length === 0) return null;
    return Math.round(history.reduce((a, b) => a + b.score, 0) / history.length);
  }, [history]);

  const pickFromBank = (chosenCat: Category, chosenDiff: QDifficulty | "mixed"): CurrentQ | null => {
    if (!banks) return null;
    const tryCat = (c: Category): CurrentQ | null => {
      const items = banks[c] || [];
      const pool = items.filter((it: any) => {
        const title = it.question || it.title;
        if (!title) return false;
        if (chosenDiff !== "mixed" && it.difficulty && it.difficulty !== chosenDiff) return false;
        return !seen.includes(title);
      });
      if (pool.length === 0) return null;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const text = (pick.question || `${pick.title || ""}\n\n${pick.problem_statement || pick.scenario || pick.scope || ""}`).trim();
      return { text, kind: c, difficulty: pick.difficulty, meta: pick };
    };
    if (chosenCat === "mixed") {
      const pool: Category[] = ["behavioral", "technical", "company", "coding", "system_design", "case_study", "data_challenge"];
      const shuffled = pool.sort(() => Math.random() - 0.5);
      for (const c of shuffled) {
        const q = tryCat(c);
        if (q) return q;
      }
      return null;
    }
    return tryCat(chosenCat);
  };

  const fetchFresh = async (chosenCat: Category, chosenDiff: QDifficulty | "mixed"): Promise<CurrentQ | null> => {
    const category = chosenCat === "mixed" ? "behavioral" : chosenCat;
    const difficulty = (chosenDiff === "mixed" ? "medium" : chosenDiff) as QDifficulty;
    const r = await apiService.getPracticeQuestion(recordId, {
      category: category as any,
      difficulty,
      seen_titles: seen.slice(0, 20),
    });
    if (r.error || !r.data?.question) return null;
    const q = r.data.question;
    const text = (q.question || `${q.title || ""}\n\n${q.problem_statement || q.scenario || q.scope || ""}`).trim();
    return { text, kind: category as Category, difficulty, meta: q };
  };

  const nextQuestion = async () => {
    setEvaluation(null); setAnswer(""); setTimerSeconds(0); setTimerActive(false);
    setGenerating(true);
    let q = pickFromBank(cat, diff);
    if (!q) q = await fetchFresh(cat, diff);
    setGenerating(false);
    if (!q) { toast.error("Couldn't get a question — try another category."); return; }
    setCurrent(q);
    setSeen(prev => [...prev, (q!.meta.question || q!.meta.title || q!.text).slice(0, 200)]);
    setTimerActive(true);
  };

  const submit = async () => {
    if (!current || !answer.trim()) return;
    setEvaluating(true); setTimerActive(false);
    const r = await apiService.evaluateMockAnswer(recordId, {
      question: current.text,
      user_answer: answer,
      category: current.kind,
    });
    setEvaluating(false);
    if (r.error || !r.data?.evaluation) {
      toast.error("Evaluation failed", { description: r.error });
      return;
    }
    const evalNorm = normalizeEvaluation(r.data.evaluation);
    setEvaluation(evalNorm);
    setHistory(prev => [{ q: current.text.slice(0, 80), score: evalNorm.score, cat: current.kind }, ...prev].slice(0, 20));
  };

  const scoreColor = (s: number) =>
    s >= 80 ? "text-emerald-500" : s >= 60 ? "text-amber-500" : "text-red-500";

  const mmss = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      {/* Header setup bar */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800/60 bg-white/60 dark:bg-gray-900/40 p-3 space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Category</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(c => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                  cat === c.key
                    ? "bg-gradient-to-br from-purple-500 to-indigo-500 text-white border-transparent shadow-sm shadow-purple-500/30"
                    : "bg-white/80 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700/60 hover:border-purple-400/60"
                }`}
              >
                <span>{c.icon}</span>{c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Difficulty</span>
          <div className="inline-flex rounded-md bg-gray-100 dark:bg-gray-800/60 p-0.5 border border-gray-200 dark:border-gray-800">
            {DIFFICULTIES.map(d => (
              <button
                key={d.key}
                onClick={() => setDiff(d.key)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded capitalize ${
                  diff === d.key ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400"
                }`}
              >{d.label}</button>
            ))}
          </div>
          <div className="flex-1" />
          {history.length > 0 && (
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              <b>{history.length}</b> answered · avg{" "}
              <span className={`font-bold tabular-nums ${avgScore !== null ? scoreColor(avgScore) : ""}`}>{avgScore ?? "—"}</span>
            </span>
          )}
          <button
            onClick={nextQuestion}
            disabled={generating || evaluating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 shadow-sm shadow-purple-500/25"
          >
            {generating ? <Spinner /> : <span>▶</span>} {current ? "Next question" : "Start mock"}
          </button>
        </div>
      </div>

      {/* Question card */}
      {current && (
        <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-white to-transparent dark:from-purple-500/10 dark:via-gray-900/40 dark:to-transparent p-5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500">Q</span>
            <DifficultyBadge d={current.difficulty} />
            <span className="text-[10px] uppercase tracking-wider text-gray-500">{current.kind.replace("_", " ")}</span>
            <div className="flex-1" />
            <span className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
              ⏱ <b className={timerSeconds > 120 ? "text-amber-500" : ""}>{mmss(timerSeconds)}</b>
            </span>
            <button
              onClick={() => setTimerActive(t => !t)}
              className="text-[10px] px-1.5 py-0.5 rounded text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            >{timerActive ? "Pause" : "Resume"}</button>
          </div>
          <p className="text-[13px] text-gray-800 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">{current.text}</p>

          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Type your answer here — aim for structured, specific, grounded in your real experience. The coach scores it on relevance, clarity, specificity, and structure."
            rows={8}
            disabled={evaluating || !!evaluation}
            className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-gray-900/60 border border-gray-300 dark:border-gray-700/60 text-[12px] text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-y font-sans leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 dark:text-gray-500 tabular-nums">{answer.length} chars · ~{Math.max(1, Math.round(answer.split(/\s+/).filter(Boolean).length / 150))} min read</span>
            <div className="flex-1" />
            {!evaluation && (
              <button
                onClick={submit}
                disabled={!answer.trim() || evaluating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 shadow-sm"
              >
                {evaluating ? <Spinner /> : <span>✓</span>} {evaluating ? "Grading…" : "Grade my answer"}
              </button>
            )}
            {evaluation && (
              <button
                onClick={nextQuestion}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
              >Next question →</button>
            )}
          </div>

          {/* Evaluation */}
          {evaluation && (
            <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800/60 bg-white dark:bg-gray-900/60 p-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className={`text-3xl font-bold tabular-nums ${scoreColor(evaluation.score)}`}>
                  {evaluation.score}<span className="text-lg text-gray-400">/100</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Verdict</p>
                  <p className="text-[13px] text-gray-800 dark:text-gray-200">{evaluation.verdict}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {evaluation.strengths?.length > 0 && (
                  <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300 mb-1">💚 Strengths</p>
                    <ul className="space-y-0.5">
                      {evaluation.strengths.map((s, i) => <li key={i} className="text-[11.5px] text-gray-700 dark:text-gray-300">• {s}</li>)}
                    </ul>
                  </div>
                )}
                {evaluation.improvements?.length > 0 && (
                  <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300 mb-1">🎯 Improve</p>
                    <ul className="space-y-0.5">
                      {evaluation.improvements.map((s, i) => <li key={i} className="text-[11.5px] text-gray-700 dark:text-gray-300">• {s}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              {evaluation.missing_points?.length > 0 && (
                <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-300 mb-1">⚠ Missing points</p>
                  <ul className="space-y-0.5">
                    {evaluation.missing_points.map((s, i) => <li key={i} className="text-[11.5px] text-gray-700 dark:text-gray-300">• {s}</li>)}
                  </ul>
                </div>
              )}

              {evaluation.model_answer && (
                <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-300 mb-1">🏆 Model answer</p>
                  <p className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{evaluation.model_answer}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!current && !generating && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ready to practice?</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Pick a category + difficulty, click <b>Start mock</b>, answer in your own words. Your coach grades on relevance, clarity, specificity, and structure.</p>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800/60 bg-white/40 dark:bg-gray-900/30 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">This session · {history.length} graded</p>
          <div className="space-y-1">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className={`tabular-nums font-bold ${scoreColor(h.score)} w-8`}>{h.score}</span>
                <span className="text-gray-500 dark:text-gray-500 uppercase text-[9px] tracking-wider w-24 shrink-0">{h.cat.replace("_", " ")}</span>
                <span className="text-gray-600 dark:text-gray-400 truncate flex-1">{h.q}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import type {
  InterviewPrepContent,
  InterviewPrepQuestion,
  RedFlagItem,
  CodingProblem,
  CaseStudy,
  SystemDesignPrompt,
  DataChallenge,
  QDifficulty,
} from "@/types/resume";

// ─── Defensive parsers ─────────────────────────────────────────────────────
// Gemini occasionally returns list fields as JSON-encoded strings. These
// helpers recover from that so the UI never renders raw JSON tokens.

export function sanitize(s: string): string {
  return s
    .replace(/^[\s"'\[\{`]+/, "")
    .replace(/[\s"'\]\}`]+$/, "")
    .replace(/^\*\*|\*\*$/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function tryParseJSON(raw: string): unknown | null {
  const s = raw.trim();
  if (!s) return null;
  if (!/^[\[\{]|^```/.test(s)) return null;
  const cleaned = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  try { return JSON.parse(cleaned.replace(/\\n/g, "\n").replace(/\\"/g, '"')); } catch { return null; }
}

export function asStrArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap(asStrArray);
  if (v && typeof v === "object") {
    const q = (v as any).question ?? (v as any).q ?? (v as any).text;
    if (q) return [sanitize(String(q))];
  }
  if (typeof v === "string") {
    const parsed = tryParseJSON(v);
    if (parsed !== null && parsed !== v) return asStrArray(parsed);
    const cleaned = sanitize(v);
    if (!cleaned) return [];
    if (/",\s*"/.test(v)) return v.split(/",\s*"/).map(sanitize).filter(Boolean);
    return cleaned.split(/(?<=\.)\s+(?=[A-Z])|\n+|;\s+/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

export function asQArray(v: unknown): InterviewPrepQuestion[] {
  if (Array.isArray(v)) return v.flatMap(asQArray);
  if (v && typeof v === "object") {
    const q = (v as any).question ?? (v as any).q;
    if (q) {
      const ao = (v as any).answer_outline ?? (v as any).defense;
      return [{
        question: sanitize(String(q)),
        why_asked: (v as any).why_asked ? sanitize(String((v as any).why_asked)) : undefined,
        answer_outline: ao ? sanitize(String(ao)) : undefined,
        difficulty: normalizeDifficulty((v as any).difficulty),
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

export function asRedFlagArray(v: unknown): RedFlagItem[] {
  const qs = asQArray(v);
  return qs.map(q => ({
    question: q.question,
    answer_outline: q.answer_outline,
    difficulty: q.difficulty,
  }));
}

function normalizeDifficulty(x: unknown): QDifficulty | undefined {
  if (!x) return undefined;
  const s = String(x).toLowerCase().trim();
  if (s.startsWith("e")) return "easy";
  if (s.startsWith("h")) return "hard";
  if (s.startsWith("m")) return "medium";
  return undefined;
}

function asObjArray<T>(v: unknown, shape: (o: any) => T | null): T[] {
  if (Array.isArray(v)) {
    return v.map(item => {
      if (item && typeof item === "object") return shape(item);
      if (typeof item === "string") {
        const parsed = tryParseJSON(item);
        if (parsed && typeof parsed === "object") return shape(parsed);
      }
      return null;
    }).filter((x): x is T => x !== null);
  }
  if (typeof v === "string") {
    const parsed = tryParseJSON(v);
    if (parsed !== null) return asObjArray(parsed, shape);
  }
  return [];
}

export function asCodingArray(v: unknown): CodingProblem[] {
  return asObjArray<CodingProblem>(v, (o: any) => {
    if (!o?.title && !o?.problem_statement) return null;
    return {
      title: sanitize(String(o.title || "Untitled")),
      difficulty: normalizeDifficulty(o.difficulty),
      problem_statement: sanitize(String(o.problem_statement || "")),
      constraints: asStrArray(o.constraints),
      examples: Array.isArray(o.examples)
        ? o.examples.map((e: any) => ({
            input: sanitize(String(e?.input ?? "")),
            output: sanitize(String(e?.output ?? "")),
            explanation: e?.explanation ? sanitize(String(e.explanation)) : undefined,
          }))
        : [],
      hints: asStrArray(o.hints),
      approach: o.approach ? sanitize(String(o.approach)) : undefined,
      complexity: o.complexity ? sanitize(String(o.complexity)) : undefined,
      skill_tags: asStrArray(o.skill_tags),
    };
  });
}

export function asCaseArray(v: unknown): CaseStudy[] {
  return asObjArray<CaseStudy>(v, (o: any) => {
    if (!o?.title && !o?.scenario) return null;
    return {
      title: sanitize(String(o.title || "Untitled")),
      difficulty: normalizeDifficulty(o.difficulty),
      scenario: sanitize(String(o.scenario || "")),
      subtasks: asStrArray(o.subtasks),
      evaluation_criteria: asStrArray(o.evaluation_criteria),
      hints: asStrArray(o.hints),
    };
  });
}

export function asSystemDesignArray(v: unknown): SystemDesignPrompt[] {
  return asObjArray<SystemDesignPrompt>(v, (o: any) => {
    if (!o?.title && !o?.scope) return null;
    return {
      title: sanitize(String(o.title || "Untitled")),
      difficulty: normalizeDifficulty(o.difficulty),
      scope: sanitize(String(o.scope || "")),
      requirements: asStrArray(o.requirements),
      suggested_components: asStrArray(o.suggested_components),
      discussion_points: asStrArray(o.discussion_points),
    };
  });
}

export function asDataChallengeArray(v: unknown): DataChallenge[] {
  return asObjArray<DataChallenge>(v, (o: any) => {
    if (!o?.title && !o?.scenario) return null;
    return {
      title: sanitize(String(o.title || "Untitled")),
      difficulty: normalizeDifficulty(o.difficulty),
      scenario: sanitize(String(o.scenario || "")),
      deliverable: o.deliverable ? sanitize(String(o.deliverable)) : undefined,
      hints: asStrArray(o.hints),
    };
  });
}

// Normalise a full content blob
export interface NormalizedPrep {
  role_type?: string;
  pitch: string;
  talking: string[];
  behavioral: InterviewPrepQuestion[];
  technical: InterviewPrepQuestion[];
  company: InterviewPrepQuestion[];
  coding: CodingProblem[];
  cases: CaseStudy[];
  systemDesign: SystemDesignPrompt[];
  data: DataChallenge[];
  gaps: string[];
  tough: RedFlagItem[];
  asks: string[];
}

export function normalize(content: InterviewPrepContent | null): NormalizedPrep | null {
  if (!content) return null;
  return {
    role_type: content.role_type,
    pitch: content.elevator_pitch ? sanitize(content.elevator_pitch) : "",
    talking: asStrArray(content.talking_points),
    behavioral: asQArray(content.behavioral_questions),
    technical: asQArray(content.technical_questions),
    company: asQArray(content.company_specific),
    coding: asCodingArray(content.coding_problems),
    cases: asCaseArray(content.case_studies),
    systemDesign: asSystemDesignArray(content.system_design_prompts),
    data: asDataChallengeArray(content.data_challenges),
    gaps: asStrArray(content.gaps_to_address),
    tough: asRedFlagArray(content.red_flags),
    asks: asStrArray(content.questions_to_ask_them),
  };
}

// ─── Difficulty styling ────────────────────────────────────────────────────
export function difficultyChip(d?: QDifficulty | string) {
  const key = typeof d === "string" ? d.toLowerCase() : d;
  switch (key) {
    case "easy":   return { label: "Easy",   cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/25" };
    case "medium": return { label: "Medium", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/25" };
    case "hard":   return { label: "Hard",   cls: "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/25" };
    default:       return { label: "—",      cls: "bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/25" };
  }
}

// STAR splitter for behavioral answer outlines
export function splitStar(s?: string): { label: string; text: string }[] | null {
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

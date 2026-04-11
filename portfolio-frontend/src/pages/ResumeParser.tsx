import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiService } from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import { useAuth } from "@/contexts/AuthContext";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { ThemeToggle } from "@/components/theme-toggle";
import { lazy, Suspense } from "react";
import { toast } from "sonner";
import ResumeDashboard, {
  type BaseResume,
  type GeneratedResume,
  formatDate,
  formatBytes,
  DownloadIcon,
  TrashIcon,
} from "@/components/resume/ResumeDashboard";
import type {
  TailorPipelineResult,
  TailoredFullResume,
  JDAnalysis,
  ATSScores,
} from "@/types/resume";

const ResumeEditor = lazy(() => import("@/components/resume/ResumeEditor"));
const BatchTailor = lazy(() => import("@/components/resume/BatchTailor"));

// ─── Shared Icons ───────────────────────────────────────────────────────────

function SparklesIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  );
}
function UploadCloudIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  );
}
function DocumentArrowDownIcon({
  className = "w-4 h-4",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}
function MagnifyingGlassIcon({
  className = "w-4 h-4",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}
function ClipboardIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
      />
    </svg>
  );
}
function CheckCircleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
function ExclamationIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  );
}
function XCircleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
function HomeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
}
function ArrowPathIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.016 4.656v4.992"
      />
    </svg>
  );
}
function UserCircleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}
function FileIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}
function ChevronIcon({
  open,
  className = "w-4 h-4",
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <svg
      className={`${className} transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
      />
    </svg>
  );
}

type NavTab = "tailor" | "batch" | "my-resumes" | "tailored" | "profile";

const ROLE_OPTIONS = [
  "Software Engineer",
  "Data Scientist",
  "Product Manager",
  "Designer",
  "DevOps Engineer",
  "Student",
  "Other",
];
const SECTOR_OPTIONS = [
  "Technology",
  "Finance",
  "Healthcare",
  "Education",
  "Government",
  "Consulting",
  "Other",
];

// ─── Score bar ──────────────────────────────────────────────────────────────
function ScoreBar({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color?: string;
}) {
  const bg =
    score >= 80
      ? "bg-emerald-500"
      : score >= 60
        ? "bg-amber-500"
        : "bg-red-500";
  const scoreColor =
    score >= 80
      ? "text-emerald-500 dark:text-emerald-400"
      : score >= 60
        ? "text-amber-500 dark:text-amber-400"
        : "text-red-500 dark:text-red-400";
  const badge =
    score >= 90
      ? {
          text: "Excellent",
          cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
        }
      : score >= 80
        ? {
            text: "Strong",
            cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          }
        : score >= 70
          ? {
              text: "Good",
              cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
            }
          : score >= 50
            ? {
                text: "Needs work",
                cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25",
              }
            : {
                text: "Weak",
                cls: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25",
              };
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center gap-2">
        <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-semibold tabular-nums ${scoreColor}`}>
            {score}
          </span>
          <span
            className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border ${badge.cls}`}
          >
            {badge.text}
          </span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-out ${color || bg}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Score ring ─────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const r = (size - 10) / 2,
    c = 2 * Math.PI * r,
    o = c - (score / 100) * c;
  const col = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="stroke-gray-200 dark:stroke-gray-800"
          strokeWidth="5"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={col}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={o}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{ color: col }}
        >
          {score}
        </span>
      </div>
    </div>
  );
}

// ─── ATS Panel ──────────────────────────────────────────────────────────────
function ATSPanel({
  scores,
  onAddKeyword,
  addedKeywords,
}: {
  scores: ATSScores;
  onAddKeyword?: (kw: string) => void;
  addedKeywords?: Set<string>;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20 p-6">
        <div className="flex items-center gap-6">
          <ScoreRing score={scores.overall} />
          <div className="flex-1">
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Overall ATS Score
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Weighted score across all dimensions
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20 p-5">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Score Breakdown
          </p>
          <div className="space-y-3">
            <ScoreBar label="Keyword Match" score={scores.keyword_match} />
            <ScoreBar
              label="Keyword Frequency"
              score={scores.keyword_frequency}
            />
            <ScoreBar
              label="Skills Alignment"
              score={scores.skills_alignment}
            />
            <ScoreBar
              label="Experience Relevance"
              score={scores.experience_relevance}
            />
            <ScoreBar
              label="Quantifiable Impact"
              score={scores.quantifiable_impact}
            />
            <ScoreBar label="Bullet Quality" score={scores.bullet_quality} />
            <ScoreBar label="Format Score" score={scores.format_score} />
            <ScoreBar
              label="Section Completeness"
              score={scores.section_completeness}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20 p-5">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
            ATS Scanner Scores
          </p>
          <div className="space-y-3">
            {scores.scanners &&
              Object.entries(scores.scanners).map(([n, s]) => (
                <ScoreBar
                  key={n}
                  label={n.charAt(0).toUpperCase() + n.slice(1)}
                  score={s}
                />
              ))}
          </div>
        </div>
      </div>
      {scores.ai_screener && (
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20 p-5">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
            AI Screener Analysis
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ScoreBar
              label="Overall"
              score={scores.ai_screener.overall}
              color="bg-violet-500"
            />
            <ScoreBar
              label="Relevance"
              score={scores.ai_screener.relevance}
              color="bg-violet-500"
            />
            <ScoreBar
              label="Seniority Fit"
              score={scores.ai_screener.seniority_fit}
              color="bg-violet-500"
            />
            <ScoreBar
              label="Culture Fit"
              score={scores.ai_screener.culture_fit}
              color="bg-violet-500"
            />
          </div>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {scores.strengths?.length > 0 && (
          <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20 p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-400">
                Strengths
              </p>
            </div>
            <ul className="space-y-2">
              {scores.strengths.map((s, i) => (
                <li
                  key={i}
                  className="text-xs text-gray-600 dark:text-gray-400 flex gap-2 leading-relaxed"
                >
                  <span className="text-emerald-500 mt-0.5 shrink-0">+</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {scores.suggestions?.length > 0 && (
          <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ExclamationIcon className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-semibold text-amber-400">
                Suggestions
              </p>
            </div>
            <ul className="space-y-2">
              {scores.suggestions.map((s, i) => (
                <li
                  key={i}
                  className="text-xs text-gray-600 dark:text-gray-400 flex gap-2 leading-relaxed"
                >
                  <span className="text-amber-500 mt-0.5 shrink-0">!</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {scores.missing_keywords?.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <XCircleIcon className="w-4 h-4 text-red-400" />
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Missing Keywords
              </p>
            </div>
            {onAddKeyword && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                Click to add to your skills
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {scores.missing_keywords.map((kw) => {
              const added = addedKeywords?.has(kw);
              if (!onAddKeyword) {
                return (
                  <span
                    key={kw}
                    className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20"
                  >
                    {kw}
                  </span>
                );
              }
              return (
                <button
                  key={kw}
                  type="button"
                  onClick={() => !added && onAddKeyword(kw)}
                  disabled={added}
                  className={`group inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all duration-200 ${
                    added
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 cursor-default"
                      : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-purple-500/15 hover:text-purple-400 hover:border-purple-500/40 hover:-translate-y-px"
                  }`}
                >
                  {added ? (
                    <svg
                      className="w-3 h-3"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span className="text-base leading-none -mt-0.5 opacity-60 group-hover:opacity-100">
                      +
                    </span>
                  )}
                  {kw}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Resume preview ─────────────────────────────────────────────────────────
function CopySectionButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(getText());
        setCopied(true);
        toast.success("Section copied to clipboard");
        setTimeout(() => setCopied(false), 1500);
      }}
      className={`opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${
        copied
          ? "text-emerald-500 bg-emerald-500/10"
          : "text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10"
      }`}
      aria-label="Copy section to clipboard"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
            />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

function ResumePreview({ resume }: { resume: TailoredFullResume }) {
  const ST = ({
    title,
    copyText,
  }: {
    title: string;
    copyText?: () => string;
  }) => (
    <div className="flex items-center gap-3 mb-3 group">
      <h3 className="text-xs font-bold uppercase tracking-widest text-purple-500 dark:text-purple-400/80">
        {title}
      </h3>
      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
      {copyText && <CopySectionButton getText={copyText} />}
    </div>
  );
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-purple-50 via-white to-purple-50 dark:from-purple-500/10 dark:via-gray-900 dark:to-purple-500/10 px-6 py-5 border-b border-gray-200 dark:border-gray-800 group relative">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
          {resume.contact?.name}
        </h2>
        <p className="text-[12px] text-gray-600 dark:text-gray-300 mt-1">
          {[
            resume.contact?.phone,
            resume.contact?.email,
            resume.contact?.linkedin,
            resume.contact?.github,
          ]
            .filter(Boolean)
            .join("  ·  ")}
        </p>
        <div className="absolute top-4 right-4">
          <CopySectionButton
            getText={() =>
              [
                resume.contact?.name,
                [
                  resume.contact?.phone,
                  resume.contact?.email,
                  resume.contact?.linkedin,
                  resume.contact?.github,
                ]
                  .filter(Boolean)
                  .join(" · "),
              ]
                .filter(Boolean)
                .join("\n")
            }
          />
        </div>
      </div>
      <div className="px-6 py-5 space-y-5">
        {resume.summary && (
          <div className="group">
            <ST title="Summary" copyText={() => resume.summary || ""} />
            <p className="text-[13.5px] text-gray-800 dark:text-gray-100 leading-[1.7]">
              {resume.summary}
            </p>
          </div>
        )}
        {resume.experience?.length > 0 && (
          <div className="group">
            <ST
              title="Experience"
              copyText={() =>
                (resume.experience || [])
                  .map(
                    (e) =>
                      `${e.company}${e.location ? `, ${e.location}` : ""}${e.title ? ` — ${e.title}` : ""}${e.dates ? ` (${e.dates})` : ""}\n${(e.bullets || []).map((b) => `  • ${b}`).join("\n")}`,
                  )
                  .join("\n\n")
              }
            />
            <div className="space-y-4">
              {resume.experience.map((exp, i) => (
                <div key={i}>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="text-[13.5px] font-semibold text-gray-900 dark:text-white">
                        {exp.company}
                        {exp.location ? `, ${exp.location}` : ""}
                      </p>
                      {exp.title && (
                        <p className="text-[12px] text-gray-600 dark:text-gray-300 italic mt-0.5">
                          {exp.title}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0">
                      {exp.dates}
                    </span>
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {exp.bullets?.map((b, j) => (
                      <li
                        key={j}
                        className="text-[12.5px] text-gray-700 dark:text-gray-200 flex gap-2 leading-[1.65]"
                      >
                        <span className="text-purple-500 dark:text-purple-400 shrink-0 mt-0.5">
                          &bull;
                        </span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
        {resume.projects?.length > 0 && (
          <div className="group">
            <ST
              title="Projects"
              copyText={() =>
                (resume.projects || [])
                  .map(
                    (p) =>
                      `${p.name}\n${(p.bullets || []).map((b) => `  • ${b}`).join("\n")}`,
                  )
                  .join("\n\n")
              }
            />
            <div className="space-y-3">
              {resume.projects.map((p, i) => (
                <div key={i}>
                  <p className="text-[13.5px] font-semibold text-gray-900 dark:text-white">
                    {p.name}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {p.bullets?.map((b, j) => (
                      <li
                        key={j}
                        className="text-[12.5px] text-gray-700 dark:text-gray-200 flex gap-2 leading-[1.65]"
                      >
                        <span className="text-purple-500 dark:text-purple-400 shrink-0 mt-0.5">
                          &bull;
                        </span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
        {resume.skills && Object.keys(resume.skills).length > 0 && (
          <div className="group">
            <ST
              title="Technical Skills"
              copyText={() =>
                Object.entries(resume.skills || {})
                  .map(
                    ([c, s]) =>
                      `${c}: ${Array.isArray(s) ? s.join(", ") : String(s)}`,
                  )
                  .join("\n")
              }
            />
            <div className="space-y-2">
              {Object.entries(resume.skills).map(([c, s]) => (
                <div key={c} className="text-[12.5px] leading-[1.65]">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {c}:{" "}
                  </span>
                  <span className="text-gray-700 dark:text-gray-200">
                    {Array.isArray(s) ? s.join(", ") : String(s)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {resume.education?.length > 0 && (
          <div className="group">
            <ST
              title="Education"
              copyText={() =>
                (resume.education || [])
                  .map(
                    (e) =>
                      `${e.institution}${e.degree ? ` — ${e.degree}` : ""}${e.dates ? ` (${e.dates})` : ""}`,
                  )
                  .join("\n")
              }
            />
            <div className="space-y-2">
              {resume.education.map((edu, i) => {
                const d = edu.degree
                  ? [
                      ...new Set(
                        edu.degree
                          .split("|")
                          .map((s) => s.trim())
                          .filter(
                            (s) =>
                              !/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})/i.test(
                                s,
                              ),
                          )
                          .filter(Boolean),
                      ),
                    ].join(" | ")
                  : "";
                return (
                  <div
                    key={i}
                    className="flex justify-between items-start gap-2"
                  >
                    <p className="text-[12.5px] text-gray-800 dark:text-gray-100">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {edu.institution}
                      </span>
                      {d ? `  — ${d}` : ""}
                    </p>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0">
                      {edu.dates}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {resume.certifications?.length > 0 && (
          <div className="group">
            <ST
              title="Certifications"
              copyText={() => (resume.certifications || []).join("\n")}
            />
            <div className="flex flex-wrap gap-2">
              {resume.certifications.map((c, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/20"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Resume diff view ──────────────────────────────────────────────────────
// Bullet-level diff between previous and current tailored versions.
// Categorizes bullets as added (in current only), removed (in previous only),
// or unchanged. For a simple, readable document-style diff without a heavy
// diff library dependency.
function ResumeDiffView({
  prev,
  curr,
}: {
  prev: TailoredFullResume;
  curr: TailoredFullResume;
}) {
  const ST = ({ title, n }: { title: string; n?: number }) => (
    <div className="flex items-center gap-3 mb-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-purple-500 dark:text-purple-400/80">
        {title}
      </h3>
      {n !== undefined && n > 0 && (
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-500">
          {n} change{n === 1 ? "" : "s"}
        </span>
      )}
      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
    </div>
  );

  // Build sets of bullets per section for comparison
  const prevExpBullets = new Set<string>();
  const currExpBullets = new Set<string>();
  (prev.experience || []).forEach((e) =>
    (e.bullets || []).forEach((b) => prevExpBullets.add(b.trim())),
  );
  (curr.experience || []).forEach((e) =>
    (e.bullets || []).forEach((b) => currExpBullets.add(b.trim())),
  );
  const prevProjBullets = new Set<string>();
  const currProjBullets = new Set<string>();
  (prev.projects || []).forEach((p) =>
    (p.bullets || []).forEach((b) => prevProjBullets.add(b.trim())),
  );
  (curr.projects || []).forEach((p) =>
    (p.bullets || []).forEach((b) => currProjBullets.add(b.trim())),
  );

  const DiffBullet = ({
    text,
    type,
  }: {
    text: string;
    type: "added" | "removed" | "same";
  }) => {
    const cls =
      type === "added"
        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : type === "removed"
          ? "border-red-500 bg-red-500/10 text-red-500 dark:text-red-300 line-through opacity-75"
          : "border-transparent";
    const marker = type === "added" ? "+" : type === "removed" ? "−" : "·";
    const markerCls =
      type === "added"
        ? "text-emerald-500"
        : type === "removed"
          ? "text-red-500"
          : "text-gray-400";
    return (
      <li
        className={`text-[12.5px] flex gap-2 leading-[1.65] pl-2 border-l-2 rounded-r ${cls}`}
      >
        <span className={`font-bold shrink-0 ${markerCls}`}>{marker}</span>
        <span>{text}</span>
      </li>
    );
  };

  const summaryChanged =
    (prev.summary || "").trim() !== (curr.summary || "").trim();
  const addedSkills = new Set<string>();
  const removedSkills = new Set<string>();
  const prevSkillFlat = new Set<string>();
  const currSkillFlat = new Set<string>();
  for (const v of Object.values(prev.skills || {}))
    if (Array.isArray(v)) v.forEach((s) => prevSkillFlat.add(s));
  for (const v of Object.values(curr.skills || {}))
    if (Array.isArray(v)) v.forEach((s) => currSkillFlat.add(s));
  currSkillFlat.forEach((s) => {
    if (!prevSkillFlat.has(s)) addedSkills.add(s);
  });
  prevSkillFlat.forEach((s) => {
    if (!currSkillFlat.has(s)) removedSkills.add(s);
  });

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-amber-50 via-white to-purple-50 dark:from-amber-500/10 dark:via-gray-900 dark:to-purple-500/10 px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">
          Diff view
        </h2>
        <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
          Changes between the previous and current tailored version
        </p>
        <div className="flex items-center gap-4 mt-2 text-[10px]">
          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-sm bg-emerald-500" />
            Added
          </span>
          <span className="inline-flex items-center gap-1.5 text-red-500 dark:text-red-400">
            <span className="w-2 h-2 rounded-sm bg-red-500" />
            Removed
          </span>
          <span className="inline-flex items-center gap-1.5 text-gray-500">
            <span className="w-2 h-2 rounded-sm bg-gray-400" />
            Unchanged
          </span>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Summary */}
        {summaryChanged && (
          <div>
            <ST title="Summary" n={1} />
            {prev.summary && (
              <p className="text-[13px] leading-[1.7] text-red-500 dark:text-red-300 line-through opacity-75 bg-red-500/10 border-l-2 border-red-500 pl-2 rounded-r mb-1">
                {prev.summary}
              </p>
            )}
            {curr.summary && (
              <p className="text-[13px] leading-[1.7] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-l-2 border-emerald-500 pl-2 rounded-r">
                {curr.summary}
              </p>
            )}
          </div>
        )}

        {/* Experience bullets — merged union, each tagged */}
        {(prevExpBullets.size > 0 || currExpBullets.size > 0) &&
          (() => {
            const addedExp = [...currExpBullets].filter(
              (b) => !prevExpBullets.has(b),
            );
            const removedExp = [...prevExpBullets].filter(
              (b) => !currExpBullets.has(b),
            );
            const changed = addedExp.length + removedExp.length;
            if (changed === 0) return null;
            return (
              <div>
                <ST title="Experience" n={changed} />
                <ul className="space-y-1.5">
                  {removedExp.map((b, i) => (
                    <DiffBullet key={`r-${i}`} text={b} type="removed" />
                  ))}
                  {addedExp.map((b, i) => (
                    <DiffBullet key={`a-${i}`} text={b} type="added" />
                  ))}
                </ul>
              </div>
            );
          })()}

        {/* Project bullets */}
        {(prevProjBullets.size > 0 || currProjBullets.size > 0) &&
          (() => {
            const addedProj = [...currProjBullets].filter(
              (b) => !prevProjBullets.has(b),
            );
            const removedProj = [...prevProjBullets].filter(
              (b) => !currProjBullets.has(b),
            );
            const changed = addedProj.length + removedProj.length;
            if (changed === 0) return null;
            return (
              <div>
                <ST title="Projects" n={changed} />
                <ul className="space-y-1.5">
                  {removedProj.map((b, i) => (
                    <DiffBullet key={`r-${i}`} text={b} type="removed" />
                  ))}
                  {addedProj.map((b, i) => (
                    <DiffBullet key={`a-${i}`} text={b} type="added" />
                  ))}
                </ul>
              </div>
            );
          })()}

        {/* Skills — chip diff */}
        {(addedSkills.size > 0 || removedSkills.size > 0) && (
          <div>
            <ST title="Skills" n={addedSkills.size + removedSkills.size} />
            <div className="flex flex-wrap gap-1.5">
              {[...removedSkills].map((s) => (
                <span
                  key={`r-${s}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-500 dark:text-red-300 border border-red-500/25 line-through opacity-75"
                >
                  <span className="font-bold">−</span>
                  {s}
                </span>
              ))}
              {[...addedSkills].map((s) => (
                <span
                  key={`a-${s}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/25"
                >
                  <span className="font-bold">+</span>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!summaryChanged &&
          prevExpBullets.size === currExpBullets.size &&
          [...prevExpBullets].every((b) => currExpBullets.has(b)) &&
          prevProjBullets.size === currProjBullets.size &&
          [...prevProjBullets].every((b) => currProjBullets.has(b)) &&
          addedSkills.size === 0 &&
          removedSkills.size === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No detectable changes between versions.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}

// ─── Phase / Progress ───────────────────────────────────────────────────────
const PROGRESS_STEPS: { key: string; label: string; hint: string }[] = [
  {
    key: "analyze",
    label: "Extract job requirements",
    hint: "Pulling skills, responsibilities, and ATS keywords",
  },
  {
    key: "tailor",
    label: "Tailor resume content",
    hint: "Rewriting bullets and summary to match the role",
  },
  {
    key: "augment",
    label: "Optimize keywords & impact",
    hint: "Injecting metrics, filling gaps, hardening for ATS",
  },
  {
    key: "render",
    label: "Finalize and format",
    hint: "Preparing PDF and DOCX output",
  },
];

function getCurrentStep(
  analyzing: boolean,
  tailoring: boolean,
  elapsed: number,
): number {
  if (analyzing) return 0;
  if (!tailoring) return -1;
  if (elapsed < 15) return 1;
  if (elapsed < 40) return 2;
  return 3;
}

function ProgressCard({
  analyzing,
  tailoring,
  elapsed,
  onCancel,
}: {
  analyzing?: boolean;
  tailoring: boolean;
  elapsed: number;
  onCancel: () => void;
}) {
  const current = getCurrentStep(!!analyzing, tailoring, elapsed);
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9">
            <div className="absolute inset-0 rounded-full border-2 border-gray-300 dark:border-gray-700" />
            <div className="absolute inset-0 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Tailoring your resume
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {elapsed >= 90
                ? "Taking longer than expected — you can wait or cancel"
                : "Usually takes 30–60 seconds"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {elapsed > 0 && (
            <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
              {elapsed}s
            </span>
          )}
          {elapsed >= 90 && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded-md hover:border-red-400/60 hover:text-red-400 transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      <ol className="space-y-2.5">
        {PROGRESS_STEPS.map((step, i) => {
          const status =
            i < current ? "done" : i === current ? "active" : "pending";
          return (
            <li key={step.key} className="flex items-start gap-3">
              <div
                className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
                  status === "done"
                    ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                    : status === "active"
                      ? "bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/40"
                      : "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 ring-1 ring-gray-300 dark:ring-gray-700"
                }`}
              >
                {status === "done" ? (
                  <svg
                    className="w-3 h-3"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : status === "active" ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                ) : (
                  <span className="w-1 h-1 rounded-full bg-current" />
                )}
              </div>
              <div className="min-w-0">
                <p
                  className={`text-[13px] font-medium transition-colors ${
                    status === "done"
                      ? "text-emerald-500 dark:text-emerald-400"
                      : status === "active"
                        ? "text-gray-900 dark:text-gray-100"
                        : "text-gray-500 dark:text-gray-500"
                  }`}
                >
                  {step.label}
                </p>
                {status === "active" && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {step.hint}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Onboarding hero ────────────────────────────────────────────────────────
function OnboardingHero({ onUploaded }: { onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const handleUpload = useCallback(
    async (file: File) => {
      const fname = file.name.toLowerCase();
      if (!fname.endsWith(".pdf") && !fname.endsWith(".docx")) {
        setUploadError("Only PDF and DOCX files are accepted");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError("File too large (max 5 MB)");
        return;
      }
      setUploading(true);
      setUploadError("");
      const resp = await apiService.uploadResumeForParser(file);
      setUploading(false);
      if (resp.error) {
        setUploadError(resp.error);
        return;
      }
      onUploaded();
    },
    [onUploaded],
  );
  return (
    <div className="space-y-6 sm:space-y-7">
      <div className="text-center pt-2 pb-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-3">
          <SparklesIcon className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-medium text-purple-500 dark:text-purple-300">
            AI-Powered Resume Tailoring
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3 leading-tight">
          Land more interviews with a<br />
          <span className="bg-gradient-to-r from-purple-500 to-indigo-500 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
            perfectly tailored resume
          </span>
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-lg mx-auto leading-relaxed">
          Upload your resume once, paste any job description, and get an
          ATS-optimized version tailored to that specific role in seconds.
        </p>
      </div>
      <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20 p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-center mb-4 sm:mb-5">
          How it works
        </p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-start justify-center gap-4 sm:gap-6">
          {[
            {
              n: 1,
              icon: <UploadCloudIcon className="w-5 h-5" />,
              l: "Upload",
              d: "Upload your existing resume",
              active: true,
            },
            {
              n: 2,
              icon: <ClipboardIcon className="w-5 h-5" />,
              l: "Paste JD",
              d: "Paste the job description you're targeting",
            },
            {
              n: 3,
              icon: <DocumentArrowDownIcon className="w-5 h-5" />,
              l: "Download",
              d: "Get your ATS-optimized resume",
            },
          ].map((s, i) => (
            <div
              key={s.n}
              className="flex items-start sm:items-start gap-4 sm:gap-6 sm:flex-row"
            >
              {i > 0 && (
                <div className="hidden sm:flex items-center pt-5 shrink-0">
                  <div className="w-6 sm:w-10 h-px bg-gray-300 dark:bg-gray-700" />
                  <svg
                    className="w-3 h-3 text-gray-400 dark:text-gray-500 -ml-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </div>
              )}
              <div className="flex sm:flex-col items-center sm:text-center flex-1 min-w-0 gap-3 sm:gap-0">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center sm:mb-2.5 shrink-0 ${s.active ? "bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/25 text-white" : "bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400"}`}
                >
                  {s.icon}
                </div>
                <div className="text-left sm:text-center min-w-0">
                  <p
                    className={`text-xs font-semibold mb-0.5 ${s.active ? "text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300"}`}
                  >
                    Step {s.n}: {s.l}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug sm:max-w-[160px]">
                    {s.d}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleUpload(f);
        }}
        className={`rounded-xl border-2 border-dashed transition-all duration-200 ${dragOver ? "border-purple-500/50 bg-purple-500/5" : "border-gray-300 dark:border-gray-700/60 bg-gray-50/40 dark:bg-gray-900/40 hover:border-gray-400 dark:hover:border-gray-600/60"}`}
      >
        <div className="flex flex-col items-center text-center py-12 px-6">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4">
            <UploadCloudIcon className="w-8 h-8 text-purple-400" />
          </div>
          <p className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
            Get started — upload your resume
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-sm">
            Drop your PDF or DOCX here or click below. We'll parse it and
            prepare it for tailoring.
          </p>
          {uploading ? (
            <div className="w-full max-w-xs space-y-2">
              <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full animate-pulse"
                  style={{ width: "60%" }}
                />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Parsing your resume...
              </p>
            </div>
          ) : (
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-200">
                <UploadCloudIcon className="w-4 h-4" />
                Choose File
              </span>
              <input
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
            </label>
          )}
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-3">
            PDF or DOCX, max 5 MB
          </p>
          {uploadError && (
            <p className="text-sm text-red-400 mt-2">{uploadError}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          {
            icon: <MagnifyingGlassIcon className="w-4 h-4 text-blue-400" />,
            l: "ATS Keyword Matching",
            d: "Scanned against 6+ ATS systems",
          },
          {
            icon: <SparklesIcon className="w-4 h-4 text-violet-400" />,
            l: "AI-Powered Tailoring",
            d: "Optimizes content for the role",
          },
          {
            icon: (
              <DocumentArrowDownIcon className="w-4 h-4 text-emerald-400" />
            ),
            l: "PDF & DOCX Export",
            d: "Download in any format",
          },
        ].map((f) => (
          <div
            key={f.l}
            className="rounded-lg border border-gray-200 dark:border-gray-800/60 bg-gray-50/40 dark:bg-gray-900/40 p-4 text-center"
          >
            <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-800 flex items-center justify-center mx-auto mb-2">
              {f.icon}
            </div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-0.5">
              {f.l}
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              {f.d}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── My Resumes tab ─────────────────────────────────────────────────────────
function MyResumesTab() {
  const [resumes, setResumes] = useState<BaseResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [settingActive, setSettingActive] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    const resp = await apiService.listBaseResumes();
    if (resp.data) setResumes(resp.data.versions || []);
    else if (resp.error) setError(resp.error);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleUpload = useCallback(
    async (file: File) => {
      const fname = file.name.toLowerCase();
      if (!fname.endsWith(".pdf") && !fname.endsWith(".docx")) {
        setError("Only PDF and DOCX files accepted");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Max 5 MB");
        return;
      }
      setUploading(true);
      setError("");
      const resp = await apiService.uploadResumeForParser(file);
      setUploading(false);
      if (resp.error) {
        setError(resp.error);
        return;
      }
      await fetch();
    },
    [fetch],
  );

  if (loading)
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-16 rounded-xl bg-gray-100/40 dark:bg-gray-800/40" />
        <div className="h-16 rounded-xl bg-gray-800/30" />
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            My Resumes
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Uploaded resumes used as the base for tailoring
          </p>
        </div>
        <label className="cursor-pointer">
          <span
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${uploading ? "bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-wait" : "text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25"}`}
          >
            {uploading ? (
              <>
                <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />{" "}
                Uploading...
              </>
            ) : (
              <>
                <UploadCloudIcon className="w-4 h-4" /> Upload Resume
              </>
            )}
          </span>
          <input
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
          />
        </label>
      </div>
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-900/20 border border-red-500/30">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
      {resumes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-900/40 p-10 text-center">
          <FileIcon className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No resumes uploaded yet
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Upload a PDF or DOCX to get started
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20 divide-y divide-gray-200 dark:divide-white/[0.07] overflow-hidden">
          {resumes.map((r) => (
            <div
              key={r.s3_key}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-100/60 dark:hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${r.is_active ? "bg-emerald-400" : "bg-gray-600"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                      {r.filename}
                    </p>
                    {r.is_active && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(r.uploaded_at)}
                    {r.size ? ` &middot; ${formatBytes(r.size)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-3">
                {!r.is_active && (
                  <button
                    onClick={async () => {
                      setSettingActive(r.s3_key);
                      await apiService.setActiveResume(r.s3_key);
                      setSettingActive(null);
                      await fetch();
                    }}
                    disabled={settingActive === r.s3_key}
                    className="px-2.5 py-1.5 text-xs font-medium text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-md transition-colors disabled:opacity-50"
                  >
                    {settingActive === r.s3_key
                      ? "Setting..."
                      : "Use for Tailoring"}
                  </button>
                )}
                <button
                  onClick={async () => {
                    setDeleting(r.s3_key);
                    await apiService.deleteResume(r.s3_key);
                    setDeleting(null);
                    await fetch();
                  }}
                  disabled={deleting === r.s3_key}
                  className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tailored Resumes tab ───────────────────────────────────────────────────
function TailoredResumesTab() {
  const [records, setRecords] = useState<any[]>([]);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [recordsResp, filesResp] = await Promise.all([
      apiService.listTailoringRecords(),
      apiService.listGeneratedResumes(),
    ]);
    if (recordsResp.data) setRecords(recordsResp.data.records || []);
    if (filesResp.data) setGeneratedFiles(filesResp.data.generated || []);
    if (recordsResp.error && filesResp.error)
      setError(recordsResp.error || filesResp.error);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDownloadRecord = useCallback(
    async (tailoredResume: any, jdAnalysis: any, fmt: "pdf" | "docx") => {
      const key = `${jdAnalysis?.job_title}-${fmt}`;
      setDownloading(key);
      const r = await apiService.downloadTailoredResume(
        tailoredResume,
        jdAnalysis,
        fmt,
      );
      setDownloading(null);
      if (r.error) {
        toast.error("Download failed");
        return;
      }
      if (r.data) {
        const u = URL.createObjectURL(r.data);
        const a = document.createElement("a");
        a.href = u;
        a.download = r.filename || `resume.${fmt}`;
        a.click();
        URL.revokeObjectURL(u);
        toast.success(`Downloaded as ${fmt.toUpperCase()}`);
      }
    },
    [],
  );

  const handleDownloadFile = useCallback(
    async (s3Key: string, filename?: string) => {
      setDownloading(s3Key);
      try {
        const blob = await apiService.downloadResumeFile(s3Key);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename || "resume.pdf";
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        toast.error("Download failed");
      }
      setDownloading(null);
    },
    [],
  );

  if (loading)
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-16 rounded-xl bg-gray-100/40 dark:bg-gray-800/40" />
        <div className="h-16 rounded-xl bg-gray-100/20 dark:bg-gray-800/30" />
      </div>
    );

  const hasContent = records.length > 0 || generatedFiles.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Tailoring History
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          All your tailored resumes with JD details and ATS scores
        </p>
      </div>
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-900/20 border border-red-500/30">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
      {!hasContent ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-900/40 p-10 text-center">
          <SparklesIcon className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No tailored resumes yet
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Go to the Tailor tab and paste a job description to create one
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Tailoring records with full data */}
          {records.map((r, idx) => {
            const title = r.jd_analysis?.job_title || "Untitled Role";
            const company = r.jd_analysis?.company;
            const atsScore = r.ats_scores?.overall;
            const isExpanded = expandedRecord === r.record_id;
            return (
              <div
                key={r.record_id || idx}
                className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedRecord(isExpanded ? null : r.record_id)
                  }
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-purple-400" />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {title}
                        {company && company !== "Not specified"
                          ? ` at ${company}`
                          : ""}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(r.created_at || "")}
                        {atsScore !== undefined && (
                          <span
                            className={`ml-2 font-semibold ${atsScore >= 80 ? "text-emerald-500" : atsScore >= 60 ? "text-amber-500" : "text-red-500"}`}
                          >
                            ATS: {atsScore}/100
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <ChevronIcon
                    open={isExpanded}
                    className="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0"
                  />
                </button>
                {isExpanded && r.tailored_resume && (
                  <div className="border-t border-gray-200 dark:border-gray-800/60 px-5 py-4 space-y-4">
                    {/* Quick actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() =>
                          handleDownloadRecord(
                            r.tailored_resume,
                            r.jd_analysis,
                            "pdf",
                          )
                        }
                        disabled={downloading !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 transition-all"
                      >
                        <DocumentArrowDownIcon className="w-3.5 h-3.5" />
                        PDF
                      </button>
                      <button
                        onClick={() =>
                          handleDownloadRecord(
                            r.tailored_resume,
                            r.jd_analysis,
                            "docx",
                          )
                        }
                        disabled={downloading !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 disabled:opacity-50 transition-all"
                      >
                        <DocumentArrowDownIcon className="w-3.5 h-3.5" />
                        DOCX
                      </button>
                      {r.jd_analysis?.required_skills?.length > 0 && (
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 ml-2">
                          {r.jd_analysis.required_skills.length} required skills
                        </span>
                      )}
                    </div>
                    {/* Summary preview */}
                    {r.tailored_resume?.summary && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                          Summary
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">
                          {r.tailored_resume.summary}
                        </p>
                      </div>
                    )}
                    {/* Skills preview */}
                    {r.tailored_resume?.skills &&
                      Object.keys(r.tailored_resume.skills).length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                            Skills
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {Object.values(r.tailored_resume.skills)
                              .flat()
                              .slice(0, 15)
                              .map((s: any, si: number) => (
                                <span
                                  key={si}
                                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/15"
                                >
                                  {s}
                                </span>
                              ))}
                            {Object.values(r.tailored_resume.skills).flat()
                              .length > 15 && (
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 self-center">
                                +
                                {Object.values(r.tailored_resume.skills).flat()
                                  .length - 15}{" "}
                                more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Legacy generated files (no tailoring record) */}
          {generatedFiles.length > 0 && records.length > 0 && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 pt-2">
              Downloaded Files
            </p>
          )}
          {generatedFiles.map((r) => (
            <div
              key={r.s3_key}
              className="flex items-center justify-between px-5 py-3.5 rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20 hover:bg-gray-100 dark:hover:bg-gray-800/20 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-gray-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                    {r.job_title || r.filename || "Tailored Resume"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(r.generated_at || r.created_at || "")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDownloadFile(r.s3_key, r.filename)}
                disabled={downloading === r.s3_key}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-purple-300 hover:bg-purple-500/10 rounded-md transition-colors disabled:opacity-50"
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                {downloading === r.s3_key ? "..." : "Download"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Profile tab ────────────────────────────────────────────────────────────
function ProfileTab() {
  const { user, updateProfile, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [role, setRole] = useState(user?.role || "");
  const [sector, setSector] = useState(user?.sector || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    const result = await updateProfile({
      name: name.trim() || undefined,
      role: role || undefined,
      sector: sector || undefined,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const inputCls =
    "w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/60 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 transition-all";
  const selectCls =
    "w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/60 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 transition-all appearance-none cursor-pointer";
  const labelCls =
    "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Profile Settings
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Update your personal information
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20 p-6 space-y-5">
        {/* Email (read-only) */}
        <div>
          <label className={labelCls}>Email</label>
          <div className="px-4 py-2.5 rounded-lg bg-gray-100/40 dark:bg-gray-800/40 border border-gray-300 dark:border-gray-700/40 text-sm text-gray-600 dark:text-gray-400">
            {user?.email}
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
            Email cannot be changed
          </p>
        </div>

        <div>
          <label htmlFor="profile-name" className={labelCls}>
            Full Name
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="profile-role" className={labelCls}>
            Role
          </label>
          <div className="relative">
            <select
              id="profile-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={selectCls}
            >
              <option value="">Select a role</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <ChevronIcon
                open={false}
                className="w-4 h-4 text-gray-500 dark:text-gray-400"
              />
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="profile-sector" className={labelCls}>
            Industry
          </label>
          <div className="relative">
            <select
              id="profile-sector"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className={selectCls}
            >
              <option value="">Select an industry</option>
              {SECTOR_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <ChevronIcon
                open={false}
                className="w-4 h-4 text-gray-500 dark:text-gray-400"
              />
            </span>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {saved && (
          <p className="text-sm text-emerald-400 flex items-center gap-1.5">
            <CheckCircleIcon className="w-4 h-4" /> Profile updated
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-300 disabled:to-gray-300 dark:disabled:from-gray-700 dark:disabled:to-gray-700 disabled:text-gray-500 dark:text-gray-400 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 disabled:shadow-none transition-all duration-200"
        >
          {saving ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />{" "}
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20 p-6">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Account
        </p>
        <button
          onClick={() => {
            logout();
            window.location.href = "/home";
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ─── Tailor tab (main flow) ─────────────────────────────────────────────────
function TailorTab() {
  const [hasResumes, setHasResumes] = useState<boolean | null>(null);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [jdText, setJdText] = useState("");
  const [analyzingJD, setAnalyzingJD] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [tailorError, setTailorError] = useState("");
  const [result, setResult] = useState<TailorPipelineResult | null>(null);
  const [atsLoading, setAtsLoading] = useState(false);
  const [tailorElapsed, setTailorElapsed] = useState(0);
  const tailorAbortRef = useRef<AbortController | null>(null);
  const atsAbortRef = useRef<AbortController | null>(null);
  const tailorTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordIdRef = useRef<string | null>(null);
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);
  const [resumeLoadError, setResumeLoadError] = useState("");
  const [editing, setEditing] = useState(false);

  // Lock page scroll while the full-screen editor overlay is mounted.
  // Without this, wheel/touch gestures chain through to the TailorTab
  // behind it (overscroll-contain only helps when the overlay itself can
  // scroll), and the disappearing scrollbar causes a layout shift that
  // briefly reveals the page underneath.
  useEffect(() => {
    if (!editing) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [editing]);

  const [regenFeedback, setRegenFeedback] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState("");
  const [previousResume, setPreviousResume] =
    useState<TailoredFullResume | null>(null);
  const [regenView, setRegenView] = useState<
    "regenerated" | "previous" | "diff"
  >("regenerated");
  const regenAbortRef = useRef<AbortController | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const coverLetterAbortRef = useRef<AbortController | null>(null);
  const coverLetterInFlightRef = useRef(false);
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set());
  const [coverLetterDownloading, setCoverLetterDownloading] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<
    "jd" | "ats" | "regenerate" | "cover"
  >("jd");
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<
    {
      id: string;
      resume: TailoredFullResume;
      label: string;
      timestamp: number;
    }[]
  >([]);
  const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(
    new Set(),
  );
  const progressRef = useRef<HTMLDivElement>(null);

  const handleAddKeyword = useCallback((kw: string) => {
    setResult((prev) => {
      if (!prev) return prev;
      const next = { ...prev.tailored_resume };
      const skills = { ...(next.skills || {}) };
      const cats = Object.keys(skills);
      const targetCat = cats.includes("Technical Skills")
        ? "Technical Skills"
        : cats.includes("Skills")
          ? "Skills"
          : cats[0] || "Skills";
      const existing = Array.isArray(skills[targetCat])
        ? [...(skills[targetCat] as string[])]
        : [];
      if (!existing.some((s) => s.toLowerCase() === kw.toLowerCase()))
        existing.push(kw);
      skills[targetCat] = existing;
      next.skills = skills;
      return { ...prev, tailored_resume: next };
    });
    setAddedKeywords((prev) => {
      const s = new Set(prev);
      s.add(kw);
      return s;
    });
    toast.success(`Added "${kw}" to your skills`);
  }, []);

  // Fetch active resume info for record storage
  const activeResumeRef = useRef<{ filename: string; s3_key: string } | null>(
    null,
  );

  const checkResumes = useCallback(async () => {
    setLoadingCheck(true);
    setResumeLoadError("");
    const resp = await apiService.listBaseResumes();
    if (resp.data) {
      const versions = resp.data.versions || [];
      const active = versions.find((v: any) => v.is_active);
      if (active)
        activeResumeRef.current = {
          filename: active.filename,
          s3_key: active.s3_key,
        };

      if (versions.length > 0) {
        // Base files exist — also check /status to ensure a parsed resume
        // doc exists. If it's missing (parse job failed/never completed),
        // the /status endpoint triggers an S3 re-parse automatically.
        const statusResp = await apiService.getResumeStatus();
        if (statusResp.data?.has_resume) {
          setHasResumes(true);
        } else {
          // Status says no parsed resume — still show the tailor UI
          // (ensure_structured_resume in the tailor endpoint will retry)
          setHasResumes(true);
        }
      } else {
        setHasResumes(false);
      }
    } else {
      const isAuthError =
        (resp.error || "").toLowerCase().includes("session expired") ||
        (resp.error || "").includes("401");
      if (isAuthError) {
        setResumeLoadError("Your session expired. Please log in again.");
      } else {
        const s = await apiService.getResumeStatus();
        if (s.data)
          setHasResumes(
            s.data.has_resume === true || s.data.has_base_file === true,
          );
        else
          setResumeLoadError(
            s.error || resp.error || "Unable to load your resumes right now.",
          );
      }
    }
    setLoadingCheck(false);
  }, []);
  useEffect(() => {
    checkResumes();
  }, [checkResumes]);
  useEffect(
    () => () => {
      tailorAbortRef.current?.abort();
      atsAbortRef.current?.abort();
      regenAbortRef.current?.abort();
      coverLetterAbortRef.current?.abort();
      if (tailorTimerRef.current) clearInterval(tailorTimerRef.current);
    },
    [],
  );

  // Lock body scroll while the full-screen editor overlay is open so scrolling
  // inside the split editor panes doesn't chain to the page behind it.
  useEffect(() => {
    if (!editing) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [editing]);

  // Save tailoring record to backend (fire-and-forget)
  const saveRecord = useCallback(
    async (
      jdAnalysisData: JDAnalysis,
      tailoredResume: TailoredFullResume,
      jdRawText: string,
      atsScores?: ATSScores,
    ) => {
      try {
        const resp = await apiService.saveTailoringRecord({
          jd_text: jdRawText,
          jd_analysis: jdAnalysisData,
          tailored_resume: tailoredResume,
          ats_scores: atsScores || undefined,
          base_resume_filename: activeResumeRef.current?.filename || "",
          base_resume_s3_key: activeResumeRef.current?.s3_key || "",
        });
        if (resp.data?.record_id) recordIdRef.current = resp.data.record_id;
      } catch {
        /* silent — analytics only */
      }
    },
    [],
  );

  // Update existing record with ATS scores
  const updateRecordATS = useCallback(async (atsScores: ATSScores) => {
    if (!recordIdRef.current) return;
    try {
      await apiService.saveTailoringRecord({
        record_id: recordIdRef.current,
        ats_scores: atsScores,
      });
    } catch {
      /* silent */
    }
  }, []);

  // Auto-start ATS scoring when tailoring completes
  const atsAutoTriggered = useRef(false);
  useEffect(() => {
    if (
      result &&
      !result.ats_scores &&
      !atsLoading &&
      !atsAutoTriggered.current
    ) {
      atsAutoTriggered.current = true;
      const t = setTimeout(() => {
        const ctrl = new AbortController();
        atsAbortRef.current = ctrl;
        setAtsLoading(true);
        apiService
          .fetchATSScores(
            result.tailored_resume,
            result.jd_analysis,
            ctrl.signal,
          )
          .then((r) => {
            if (ctrl.signal.aborted) return;
            setAtsLoading(false);
            if (r.data?.ats_scores) {
              setResult((p) =>
                p ? { ...p, ats_scores: r.data!.ats_scores } : p,
              );
              updateRecordATS(r.data.ats_scores);
              // Auto-switch to ATS tab so user sees the score
              setInspectorTab("ats");
            }
          })
          .catch(() => setAtsLoading(false));
      }, 500);
      return () => clearTimeout(t);
    }
  }, [result, atsLoading, updateRecordATS]);

  // Combined analyze + tailor in one action (like Jobscan / Teal)
  const handleTailoring = useCallback(async () => {
    if (!jdText.trim()) return;
    tailorAbortRef.current?.abort();
    const ctrl = new AbortController();
    tailorAbortRef.current = ctrl;

    // Phase 1: Analyze JD
    setAnalyzingJD(true);
    setTailorError("");
    setResult(null);
    setTailorElapsed(0);
    tailorTimerRef.current = setInterval(
      () => setTailorElapsed((p) => p + 1),
      1000,
    );

    // Scroll the progress card into view so user sees what's happening
    setTimeout(
      () =>
        progressRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }),
      80,
    );

    const jdResp = await apiService.extractJD(jdText.trim());
    if (ctrl.signal.aborted) {
      cleanup();
      return;
    }
    if (jdResp.error) {
      cleanup();
      setTailorError(jdResp.error);
      return;
    }
    if (!jdResp.data?.jd_analysis) {
      cleanup();
      setTailorError("Failed to analyze job description.");
      return;
    }

    const analysis = jdResp.data.jd_analysis;
    setAnalyzingJD(false);

    // Phase 2: Tailor resume
    setTailoring(true);
    const tailorResp = await apiService.tailorResumeForParser(
      analysis,
      ctrl.signal,
    );
    if (ctrl.signal.aborted) {
      cleanup();
      return;
    }

    cleanup();
    if (tailorResp.error) {
      setTailorError(tailorResp.error);
      return;
    }
    if (tailorResp.data) {
      setResult({
        jd_analysis: analysis,
        tailored_resume: tailorResp.data.tailored_resume,
      });
      setVersions([
        {
          id: `v1-${Date.now()}`,
          resume: tailorResp.data.tailored_resume,
          label: "Initial tailoring",
          timestamp: Date.now(),
        },
      ]);
      saveRecord(analysis, tailorResp.data.tailored_resume, jdText);
      apiService
        .downloadTailoredResume(
          tailorResp.data.tailored_resume,
          analysis,
          "pdf",
        )
        .catch(() => {});
    }

    function cleanup() {
      if (tailorTimerRef.current) clearInterval(tailorTimerRef.current);
      tailorTimerRef.current = null;
      setAnalyzingJD(false);
      setTailoring(false);
      setTailorElapsed(0);
    }
  }, [jdText, saveRecord]);

  const handleCancel = useCallback(() => {
    tailorAbortRef.current?.abort();
    if (tailorTimerRef.current) clearInterval(tailorTimerRef.current);
    tailorTimerRef.current = null;
    setTailoring(false);
    setTailorElapsed(0);
  }, []);

  const handleDownload = useCallback(
    async (fmt: "pdf" | "docx") => {
      if (!result) return;
      setDownloading(fmt);
      const r = await apiService.downloadTailoredResume(
        result.tailored_resume,
        result.jd_analysis,
        fmt,
      );
      setDownloading(null);
      if (r.error) {
        toast.error("Download failed", { description: r.error });
        return;
      }
      if (r.data) {
        const u = URL.createObjectURL(r.data);
        const a = document.createElement("a");
        a.href = u;
        a.download = r.filename || `resume.${fmt}`;
        a.click();
        URL.revokeObjectURL(u);
        toast.success(`Resume downloaded as ${fmt.toUpperCase()}`);
      }
    },
    [result],
  );

  const handleRegenerate = useCallback(async () => {
    if (!result || !regenFeedback.trim()) return;
    regenAbortRef.current?.abort();
    const ctrl = new AbortController();
    regenAbortRef.current = ctrl;
    setRegenerating(true);
    setRegenError("");

    const resp = await apiService.regenerateResume(
      result.tailored_resume,
      result.jd_analysis,
      regenFeedback.trim(),
      ctrl.signal,
    );

    if (ctrl.signal.aborted) {
      setRegenerating(false);
      return;
    }
    setRegenerating(false);

    if (resp.error) {
      setRegenError(resp.error);
      toast.error("Regeneration failed", { description: resp.error });
      return;
    }
    if (resp.data?.tailored_resume) {
      // Save current version before replacing
      if (result?.tailored_resume) {
        setPreviousResume(result.tailored_resume);
      }
      setResult((prev) =>
        prev
          ? {
              ...prev,
              tailored_resume: resp.data!.tailored_resume,
              ats_scores: undefined,
            }
          : prev,
      );
      const feedbackSnippet = regenFeedback.trim().slice(0, 60);
      setVersions((v) => [
        {
          id: `v${v.length + 1}-${Date.now()}`,
          resume: resp.data!.tailored_resume,
          label: feedbackSnippet || `Regeneration ${v.length + 1}`,
          timestamp: Date.now(),
        },
        ...v,
      ]);
      setRegenFeedback("");
      setRegenView("regenerated");
      setInspectorTab("ats");
      toast.success(
        "Resume regenerated — previous version kept for comparison",
      );
      // Re-trigger ATS scoring for the new version
      atsAutoTriggered.current = false;
    }
  }, [result, regenFeedback]);

  const handleCoverLetter = useCallback(async () => {
    // Guard via ref so the in-flight check is stable across re-renders and
    // the callback identity doesn't change mid-generation. A re-invocation
    // while generating must NOT abort the existing request — it's a no-op.
    if (!result || coverLetterInFlightRef.current) return;
    coverLetterInFlightRef.current = true;
    const ctrl = new AbortController();
    coverLetterAbortRef.current = ctrl;
    setCoverLetterLoading(true);
    try {
      const resp = await apiService.generateCoverLetter(
        result.tailored_resume,
        result.jd_analysis,
        ctrl.signal,
      );
      if (ctrl.signal.aborted) return;
      if (resp.error) {
        toast.error("Cover letter generation failed", {
          description: resp.error,
        });
        return;
      }
      if (resp.data?.cover_letter) {
        setCoverLetter(resp.data.cover_letter);
        toast.success("Cover letter generated");
      }
    } finally {
      coverLetterInFlightRef.current = false;
      setCoverLetterLoading(false);
    }
  }, [result]);

  const handleStartNew = useCallback(() => {
    setJdText("");
    setResult(null);
    setTailorError("");
    setAtsLoading(false);
    setEditing(false);
    setRegenFeedback("");
    setRegenerating(false);
    setRegenError("");
    setPreviousResume(null);
    setRegenView("regenerated");
    setCoverLetter(null);
    setCoverLetterLoading(false);
    coverLetterInFlightRef.current = false;
    coverLetterAbortRef.current?.abort();
    setAddedKeywords(new Set());
    setInspectorTab("jd");
    setDownloadMenuOpen(false);
    setHistoryOpen(false);
    setVersions([]);
    setDismissedNudges(new Set());
    recordIdRef.current = null;
    atsAutoTriggered.current = false;
  }, []);

  const handleRestoreVersion = useCallback(
    (version: { resume: TailoredFullResume; label: string }) => {
      setResult((prev) =>
        prev
          ? { ...prev, tailored_resume: version.resume, ats_scores: undefined }
          : prev,
      );
      setPreviousResume(null);
      setRegenView("regenerated");
      setHistoryOpen(false);
      atsAutoTriggered.current = false;
      toast.success(`Restored "${version.label}"`);
    },
    [],
  );

  const handleDownloadCoverLetter = useCallback(async () => {
    if (!coverLetter || !result) return;
    setCoverLetterDownloading(true);
    const r = await apiService.downloadCoverLetterPDF(
      coverLetter,
      result.tailored_resume.contact?.name || "",
      result.jd_analysis.job_title || "",
      result.jd_analysis.company &&
        result.jd_analysis.company !== "Not specified"
        ? result.jd_analysis.company
        : "",
    );
    setCoverLetterDownloading(false);
    if (r.error) {
      toast.error("Download failed", { description: r.error });
      return;
    }
    if (r.data) {
      const u = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = u;
      a.download = r.filename || "cover_letter.pdf";
      a.click();
      URL.revokeObjectURL(u);
      toast.success("Cover letter downloaded");
    }
  }, [coverLetter, result]);

  if (loadingCheck)
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-28 rounded-xl bg-gray-100/40 dark:bg-gray-800/40" />
        <div className="h-48 rounded-xl bg-gray-100/20 dark:bg-gray-800/20" />
      </div>
    );
  if (resumeLoadError) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 space-y-3">
        <p className="text-sm text-red-300">{resumeLoadError}</p>
        <button
          type="button"
          onClick={checkResumes}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-200 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-all duration-200"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }
  if (hasResumes === false)
    return <OnboardingHero onUploaded={() => setHasResumes(true)} />;

  // Derive progress stepper state — 1: upload done, 2: JD entered, 3: tailored result
  const currentStep: 1 | 2 | 3 = result ? 3 : jdText.trim().length > 20 ? 2 : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Horizontal progress stepper */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm px-4 sm:px-8 py-4 shadow-sm">
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {[
            { n: 1 as const, label: "Upload Resume" },
            { n: 2 as const, label: "Add Job Description" },
            { n: 3 as const, label: "Review & Download" },
          ].map((s, i, arr) => {
            const status =
              currentStep > s.n
                ? "done"
                : currentStep === s.n
                  ? "active"
                  : "upcoming";
            return (
              <Fragment key={s.n}>
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${
                      status === "done"
                        ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/30"
                        : status === "active"
                          ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white ring-4 ring-purple-500/20 shadow-lg shadow-purple-500/30"
                          : "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {status === "done" ? (
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      s.n
                    )}
                  </div>
                  <span
                    className={`text-xs sm:text-sm font-medium hidden sm:inline transition-colors ${
                      status === "active"
                        ? "text-gray-900 dark:text-white"
                        : status === "done"
                          ? "text-purple-600 dark:text-purple-300"
                          : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <div
                    className={`h-[2px] flex-1 max-w-[80px] rounded-full transition-colors duration-500 ${currentStep > s.n ? "bg-gradient-to-r from-purple-500 to-indigo-500" : "bg-gray-200 dark:bg-gray-800"}`}
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* Error banner */}
      {tailorError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-red-500/30 bg-red-500/5 backdrop-blur-sm px-5 py-4 flex items-start gap-3"
        >
          <XCircleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{tailorError}</p>
        </motion.div>
      )}

      {/* Smart nudge bar — contextual suggestions based on current state.
          Rules fire in priority order; first match wins, user can dismiss each. */}
      {result &&
        (() => {
          type Nudge = {
            id: string;
            icon: string;
            text: React.ReactNode;
            actionLabel?: string;
            onAction?: () => void;
          };
          const nudges: Nudge[] = [];

          // Score improvement after regen
          if (versions.length >= 2 && result.ats_scores) {
            nudges.push({
              id: `improved-${versions[0].id}`,
              icon: "✨",
              text: (
                <>
                  Resume regenerated —{" "}
                  <strong className="text-gray-900 dark:text-white">
                    ATS score is now {result.ats_scores.overall}/100
                  </strong>
                  . Download your updated version when ready.
                </>
              ),
              actionLabel: "Download PDF",
              onAction: () => handleDownload("pdf"),
            });
          }

          // Low skills alignment or weak scores
          if (
            result.ats_scores &&
            result.ats_scores.skills_alignment < 70 &&
            result.ats_scores.missing_keywords &&
            result.ats_scores.missing_keywords.length > 0
          ) {
            const top = result.ats_scores.missing_keywords.slice(0, 2);
            nudges.push({
              id: `skills-${result.ats_scores.overall}`,
              icon: "💡",
              text: (
                <>
                  Your Skills Alignment is{" "}
                  <strong className="text-amber-500 dark:text-amber-400">
                    {result.ats_scores.skills_alignment}
                  </strong>{" "}
                  — try adding{" "}
                  <strong className="text-gray-900 dark:text-white">
                    "{top.join('"')}"
                  </strong>
                  {top.length > 1 ? " and " : ""}
                  <strong className="text-gray-900 dark:text-white">
                    "{top[top.length - 1]}"
                  </strong>{" "}
                  to bump it.
                </>
              ),
              actionLabel: "Review in ATS",
              onAction: () => setInspectorTab("ats"),
            });
          }

          // Cover letter not yet generated
          if (!coverLetter && !coverLetterLoading) {
            nudges.push({
              id: "cover-letter",
              icon: "📝",
              text: (
                <>
                  You haven't generated a cover letter yet. It takes about{" "}
                  <strong className="text-gray-900 dark:text-white">
                    15 seconds
                  </strong>
                  .
                </>
              ),
              actionLabel: "Generate",
              onAction: () => {
                setInspectorTab("cover");
                setTimeout(handleCoverLetter, 300);
              },
            });
          }

          // Pick first undismissed nudge
          const active = nudges.find((n) => !dismissedNudges.has(n.id));
          if (!active) return null;

          return (
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="relative rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-purple-500/10 border border-purple-500/20 px-4 py-3 flex items-center justify-between gap-3 overflow-hidden"
            >
              {/* Subtle gradient shine */}
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent"
                aria-hidden="true"
              />
              <div className="relative flex items-center gap-2.5 text-sm min-w-0">
                <span
                  className="text-lg leading-none shrink-0"
                  aria-hidden="true"
                >
                  {active.icon}
                </span>
                <p className="text-gray-700 dark:text-gray-300 leading-snug min-w-0">
                  {active.text}
                </p>
              </div>
              <div className="relative flex items-center gap-2 shrink-0">
                {active.actionLabel && active.onAction && (
                  <button
                    onClick={active.onAction}
                    className="text-xs font-semibold text-purple-600 dark:text-purple-300 hover:text-purple-700 dark:hover:text-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-500/10 transition-all whitespace-nowrap"
                  >
                    {active.actionLabel} →
                  </button>
                )}
                <button
                  onClick={() =>
                    setDismissedNudges((d) => new Set(d).add(active.id))
                  }
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-all p-1 rounded"
                  aria-label="Dismiss"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </motion.div>
          );
        })()}

      {/* ─── SPLIT-VIEW ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-5 items-start">
        {/* ═══ LEFT COLUMN — Resume preview / empty state.
             No local scroll — the main body handles all scrolling, so there's
             a single scroll context and the sticky navbar can't be clipped. ═══ */}
        <section
          className="min-w-0 lg:sticky lg:top-24 lg:self-start"
          aria-label="Resume preview"
        >
          <div className="relative rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-gray-50/40 dark:bg-gray-900/40 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/30 overflow-hidden flex flex-col lg:max-h-[calc(100vh-140px)]">
            {/* Resume strength meter — vertical gradient bar on the left edge,
                driven by ATS overall score. Always present while a result is loaded. */}
            {result?.ats_scores &&
              (() => {
                const s = result.ats_scores.overall;
                const color =
                  s >= 80
                    ? "from-emerald-500 to-emerald-400"
                    : s >= 60
                      ? "from-amber-500 to-amber-400"
                      : "from-red-500 to-red-400";
                return (
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 overflow-hidden z-10"
                    aria-hidden="true"
                  >
                    <div
                      className={`absolute left-0 right-0 bottom-0 bg-gradient-to-t ${color} transition-all duration-1000 ease-out`}
                      style={{ height: `${s}%` }}
                      title={`Resume strength ${s}%`}
                    />
                  </div>
                );
              })()}
            {/* Frame header — status label + Tailored/Original segmented control + Revert.
                "New Tailor" lives in the bottom toolbar to avoid duplication. */}
            <div className="shrink-0 px-5 py-3.5 border-b border-gray-200 dark:border-white/[0.07] flex items-center justify-between gap-3 bg-white/50 dark:bg-gray-900/60 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {result
                    ? "Tailored Resume"
                    : analyzingJD || tailoring
                      ? "Tailoring…"
                      : "Resume Preview"}
                </p>
                {previousResume && (
                  <div
                    role="tablist"
                    aria-label="Resume version"
                    className="inline-flex rounded-lg bg-gray-200/70 dark:bg-gray-800/70 p-0.5 border border-gray-300 dark:border-white/10"
                  >
                    {[
                      {
                        key: "regenerated" as const,
                        label: "Tailored",
                        active:
                          "bg-purple-500/20 text-purple-600 dark:text-purple-300 ring-1 ring-purple-500/30 shadow-sm",
                      },
                      {
                        key: "previous" as const,
                        label: "Original",
                        active:
                          "bg-white dark:bg-white/10 text-gray-900 dark:text-white ring-1 ring-gray-300 dark:ring-white/20 shadow-sm",
                      },
                      {
                        key: "diff" as const,
                        label: "Diff",
                        active:
                          "bg-amber-500/15 text-amber-600 dark:text-amber-300 ring-1 ring-amber-500/30 shadow-sm",
                      },
                    ].map((t) => (
                      <button
                        key={t.key}
                        role="tab"
                        aria-selected={regenView === t.key}
                        onClick={() => setRegenView(t.key)}
                        className={`relative px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                          regenView === t.key
                            ? t.active
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {result && versions.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => setHistoryOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 hover:border-purple-500/40 hover:text-purple-600 dark:hover:text-purple-300 transition-all"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.8}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      History
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/25">
                        {versions.length}
                      </span>
                    </button>
                    {historyOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setHistoryOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-full right-0 mt-2 w-72 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-2xl shadow-black/20 p-1.5 z-20 overflow-hidden"
                        >
                          <div className="px-3 py-2 border-b border-gray-200 dark:border-white/[0.07] mb-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                              Version History
                            </p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                              Click any version to restore it
                            </p>
                          </div>
                          <div className="max-h-80 overflow-y-auto">
                            {versions.map((v, idx) => {
                              const isCurrent = idx === 0;
                              const ageMin = Math.max(
                                1,
                                Math.floor((Date.now() - v.timestamp) / 60000),
                              );
                              return (
                                <button
                                  key={v.id}
                                  onClick={() => handleRestoreVersion(v)}
                                  disabled={isCurrent}
                                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                                    isCurrent
                                      ? "bg-purple-500/10 cursor-default"
                                      : "hover:bg-gray-100 dark:hover:bg-white/[0.05]"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <span
                                      className={`text-xs font-semibold ${isCurrent ? "text-purple-600 dark:text-purple-300" : "text-gray-900 dark:text-white"}`}
                                    >
                                      v{versions.length - idx}
                                      {isCurrent && " · current"}
                                    </span>
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                                      {idx === versions.length - 1
                                        ? "uploaded"
                                        : `${ageMin}m ago`}
                                    </span>
                                  </div>
                                  <p
                                    className={`text-[11px] leading-snug truncate ${isCurrent ? "text-purple-600/80 dark:text-purple-300/80" : "text-gray-600 dark:text-gray-400"}`}
                                  >
                                    {v.label}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </div>
                )}
                {result && previousResume && (
                  <button
                    onClick={() => {
                      if (previousResume) {
                        setResult((prev) =>
                          prev
                            ? {
                                ...prev,
                                tailored_resume: previousResume,
                                ats_scores: undefined,
                              }
                            : prev,
                        );
                        setPreviousResume(null);
                        setRegenView("regenerated");
                        toast.success("Reverted to previous version");
                        atsAutoTriggered.current = false;
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 hover:border-purple-500/40 hover:text-purple-600 dark:hover:text-purple-300 transition-all"
                  >
                    <ArrowPathIcon className="w-3.5 h-3.5" />
                    Revert
                  </button>
                )}
              </div>
            </div>

            {/* Body — scrolls independently so the left preview stays pinned
                 and matches the inspector column height on large screens. */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {result ? (
                <div className="p-3 sm:p-5 bg-gray-100/60 dark:bg-gray-950/80 space-y-3">
                  {/* "What Changed" stats — only shown when a previous version exists
                    (i.e., the user regenerated at least once). Builds instant confidence
                    that the regeneration actually did something. */}
                  {previousResume &&
                    (() => {
                      const prev = previousResume;
                      const curr = result.tailored_resume;
                      const prevBullets = new Set<string>();
                      const currBullets = new Set<string>();
                      for (const e of prev.experience || [])
                        for (const b of e.bullets || [])
                          prevBullets.add(b.trim());
                      for (const p of prev.projects || [])
                        for (const b of p.bullets || [])
                          prevBullets.add(b.trim());
                      for (const e of curr.experience || [])
                        for (const b of e.bullets || [])
                          currBullets.add(b.trim());
                      for (const p of curr.projects || [])
                        for (const b of p.bullets || [])
                          currBullets.add(b.trim());
                      const added = [...currBullets].filter(
                        (b) => !prevBullets.has(b),
                      ).length;
                      const removed = [...prevBullets].filter(
                        (b) => !currBullets.has(b),
                      ).length;
                      const edited = Math.min(added, removed); // best-effort heuristic
                      const prevSkills = new Set<string>();
                      const currSkills = new Set<string>();
                      for (const v of Object.values(prev.skills || {}))
                        if (Array.isArray(v))
                          v.forEach((s) => prevSkills.add(s.toLowerCase()));
                      for (const v of Object.values(curr.skills || {}))
                        if (Array.isArray(v))
                          v.forEach((s) => currSkills.add(s.toLowerCase()));
                      const keywordsAdded = [...currSkills].filter(
                        (s) => !prevSkills.has(s),
                      ).length;
                      return (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-xl bg-gradient-to-br from-purple-500/5 via-transparent to-indigo-500/5 border border-purple-500/20 p-4"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-md bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                              <SparklesIcon className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                            </div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                              What Changed
                            </p>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              vs previous version
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              {
                                n: added,
                                label: "bullets added",
                                cls: "text-emerald-600 dark:text-emerald-400",
                                sign: "+",
                              },
                              {
                                n: removed,
                                label: "bullets removed",
                                cls: "text-red-500 dark:text-red-400",
                                sign: "−",
                              },
                              {
                                n: edited,
                                label: "bullets edited",
                                cls: "text-amber-500 dark:text-amber-400",
                                sign: "~",
                              },
                              {
                                n: keywordsAdded,
                                label: "keywords added",
                                cls: "text-purple-600 dark:text-purple-300",
                                sign: "+",
                              },
                            ].map((stat, i) => (
                              <div
                                key={i}
                                className="rounded-lg bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.07] p-2.5"
                              >
                                <p
                                  className={`text-lg font-bold tabular-nums leading-none ${stat.cls}`}
                                >
                                  {stat.sign}
                                  {stat.n}
                                </p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                                  {stat.label}
                                </p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      );
                    })()}

                  <motion.div
                    key={`loaded-${regenView}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-white text-gray-900 rounded-xl shadow-inner shadow-black/10"
                  >
                    {previousResume && regenView === "diff" ? (
                      <ResumeDiffView
                        prev={previousResume}
                        curr={result.tailored_resume}
                      />
                    ) : previousResume && regenView === "previous" ? (
                      <ResumePreview resume={previousResume} />
                    ) : (
                      <ResumePreview resume={result.tailored_resume} />
                    )}
                  </motion.div>
                </div>
              ) : analyzingJD || tailoring ? (
                <motion.div
                  key="progress"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  ref={progressRef}
                  className="px-6 sm:px-8 py-8 sm:py-10 min-h-[480px] flex flex-col"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10">
                        <div className="absolute inset-0 rounded-full border-2 border-gray-300 dark:border-gray-700" />
                        <div className="absolute inset-0 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-gray-900 dark:text-white">
                          Tailoring your resume
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          {tailorElapsed >= 90
                            ? "Taking longer than expected"
                            : "Usually takes 30–60 seconds"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tailorElapsed > 0 && (
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums font-medium">
                          {tailorElapsed}s
                        </span>
                      )}
                      {tailorElapsed >= 90 && (
                        <button
                          onClick={handleCancel}
                          className="px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-white/10 rounded-md hover:border-red-400/60 hover:text-red-400 transition-all"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  <ol className="space-y-3 flex-1">
                    {[
                      {
                        key: "analyze",
                        label: "Extract job requirements",
                        hint: "Pulling skills, responsibilities, and ATS keywords",
                      },
                      {
                        key: "tailor",
                        label: "Tailor resume content",
                        hint: "Rewriting bullets and summary to match the role",
                      },
                      {
                        key: "augment",
                        label: "Optimize keywords & impact",
                        hint: "Injecting metrics, filling gaps, hardening for ATS",
                      },
                      {
                        key: "render",
                        label: "Finalize and format",
                        hint: "Preparing PDF and DOCX output",
                      },
                    ].map((step, i) => {
                      const current = analyzingJD
                        ? 0
                        : !tailoring
                          ? -1
                          : tailorElapsed < 15
                            ? 1
                            : tailorElapsed < 40
                              ? 2
                              : 3;
                      const status =
                        i < current
                          ? "done"
                          : i === current
                            ? "active"
                            : "pending";
                      return (
                        <li key={step.key} className="flex items-start gap-3">
                          <div
                            className={`shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                              status === "done"
                                ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/40"
                                : status === "active"
                                  ? "bg-purple-500/15 text-purple-400 ring-2 ring-purple-500/40 animate-pulse"
                                  : "bg-gray-200 dark:bg-gray-800/60 text-gray-400 dark:text-gray-600 ring-1 ring-gray-300 dark:ring-white/10"
                            }`}
                          >
                            {status === "done" ? (
                              <svg
                                className="w-3.5 h-3.5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            ) : status === "active" ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                            ) : (
                              <span className="w-1 h-1 rounded-full bg-current" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p
                              className={`text-[14px] font-medium transition-colors ${
                                status === "done"
                                  ? "text-emerald-500 dark:text-emerald-400"
                                  : status === "active"
                                    ? "text-gray-900 dark:text-white"
                                    : "text-gray-500 dark:text-gray-500"
                              }`}
                            >
                              {step.label}
                            </p>
                            {status === "active" && (
                              <>
                                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                                  {step.hint}
                                </p>
                                <div className="mt-2 h-1 rounded-full bg-gray-200 dark:bg-white/5 overflow-hidden">
                                  <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 animate-pulse" />
                                </div>
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center justify-center py-20 px-6 text-center min-h-[480px]"
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center mb-4 ring-1 ring-purple-500/30">
                    <FileIcon className="w-7 h-7 text-purple-500 dark:text-purple-400" />
                  </div>
                  <p className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                    Ready to tailor
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs leading-relaxed">
                    Paste a job description in the{" "}
                    <span className="text-purple-600 dark:text-purple-400 font-medium">
                      Job Description
                    </span>{" "}
                    panel on the right and click{" "}
                    <span className="text-purple-600 dark:text-purple-400 font-medium">
                      Tailor My Resume
                    </span>{" "}
                    to begin.
                  </p>
                  <div className="mt-6 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-500">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                    Resume uploaded — ready to go
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </section>

        {/* ═══ RIGHT COLUMN — Tabbed inspector.
             Flows with the main page scroll (no nested overflow). ═══ */}
        <section className="min-w-0 flex flex-col" aria-label="Inspector">
          {/* Tab bar */}
          <div
            role="tablist"
            className="flex gap-1 bg-gray-100/80 dark:bg-gray-900/60 backdrop-blur-sm rounded-2xl p-1.5 border border-gray-200 dark:border-white/[0.07] mb-4 overflow-x-auto hide-scrollbar"
          >
            {[
              {
                key: "jd" as const,
                label: "Job Description",
                icon: <ClipboardIcon className="w-4 h-4" />,
                disabled: false,
              },
              {
                key: "ats" as const,
                label: "ATS Score",
                icon: <MagnifyingGlassIcon className="w-4 h-4" />,
                disabled: !result,
              },
              {
                key: "regenerate" as const,
                label: "Regenerate",
                icon: <ArrowPathIcon className="w-4 h-4" />,
                disabled: !result,
              },
              {
                key: "cover" as const,
                label: "Cover Letter",
                icon: <SparklesIcon className="w-4 h-4" />,
                disabled: !result,
              },
            ].map((t) => {
              const active = inspectorTab === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={active}
                  aria-controls={`panel-${t.key}`}
                  disabled={t.disabled}
                  onClick={() => setInspectorTab(t.key)}
                  className={`relative flex-1 inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 rounded-xl text-[12px] sm:text-[13px] font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 ${
                    active
                      ? "text-purple-600 dark:text-purple-300"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="inspector-tab-pill"
                      className="absolute inset-0 rounded-xl bg-purple-500/15 ring-1 ring-purple-500/30"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                  <span className="relative shrink-0">{t.icon}</span>
                  <span className="relative hidden sm:inline">{t.label}</span>
                  {t.key === "ats" && result?.ats_scores && (
                    <span
                      className={`relative ml-0.5 text-[10px] font-bold tabular-nums ${result.ats_scores.overall >= 80 ? "text-emerald-500 dark:text-emerald-400" : result.ats_scores.overall >= 60 ? "text-amber-500 dark:text-amber-400" : "text-red-500 dark:text-red-400"}`}
                    >
                      {result.ats_scores.overall}
                    </span>
                  )}
                  {t.key === "ats" && atsLoading && (
                    <span className="relative w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  )}
                  {t.key === "cover" && coverLetter && !coverLetterLoading && (
                    <span className="relative flex w-1.5 h-1.5">
                      <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-60 animate-ping" />
                      <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </span>
                  )}
                  {t.key === "cover" && coverLetterLoading && (
                    <span className="relative w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab panels */}
          <AnimatePresence mode="wait">
            <motion.div
              key={inspectorTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              role="tabpanel"
              id={`panel-${inspectorTab}`}
              className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20"
            >
              {/* ── TAB 1: Job Description ── */}
              {inspectorTab === "jd" && (
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Job Description
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Paste the complete job posting — we'll extract
                        requirements automatically
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={async () => {
                          try {
                            const t = await navigator.clipboard.readText();
                            if (t) setJdText(t.slice(0, 10000));
                          } catch {
                            toast.error("Clipboard access denied");
                          }
                        }}
                        disabled={analyzingJD || tailoring}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-600 dark:text-gray-400 hover:text-purple-500 dark:hover:text-purple-300 hover:bg-purple-500/10 transition-all disabled:opacity-50"
                      >
                        <ClipboardIcon className="w-3.5 h-3.5" />
                        Paste
                      </button>
                      {jdText && (
                        <button
                          onClick={() => setJdText("")}
                          disabled={analyzingJD || tailoring}
                          className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-red-400 transition-colors px-2 py-1.5 disabled:opacity-50"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      placeholder="Paste the job description here — we'll extract key requirements and tailor your resume automatically..."
                      value={jdText}
                      onChange={(e) => setJdText(e.target.value)}
                      rows={10}
                      maxLength={10000}
                      disabled={analyzingJD || tailoring}
                      className="w-full min-h-[280px] px-4 py-3 rounded-xl bg-white dark:bg-gray-900/60 border border-gray-300 dark:border-white/10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/40 transition-all disabled:opacity-50"
                    />
                    <span className="absolute bottom-3 right-3 text-[10px] text-gray-400 dark:text-gray-500 tabular-nums pointer-events-none">
                      {jdText.length.toLocaleString()} / 10,000
                    </span>
                  </div>

                  {/* Extracted requirements preview (after analysis) —
                      chips are color-coded: green = found in resume, amber = missing. */}
                  {result?.jd_analysis &&
                    (() => {
                      // Build a normalized set of words present in the tailored resume
                      // (skills + summary + all experience bullets + project bullets) so we can
                      // match JD skills against what the candidate actually has.
                      const resumeHaystack = (() => {
                        const r = result.tailored_resume;
                        const parts: string[] = [];
                        const sk = r.skills || {};
                        for (const v of Object.values(sk)) {
                          if (Array.isArray(v)) parts.push(...v);
                        }
                        parts.push(r.summary || "");
                        for (const exp of r.experience || []) {
                          parts.push(exp.title || "", ...(exp.bullets || []));
                        }
                        for (const p of r.projects || []) {
                          parts.push(p.name || "", ...(p.bullets || []));
                        }
                        return parts.join(" ").toLowerCase();
                      })();
                      const isMatched = (skill: string) => {
                        const s = skill.toLowerCase().trim();
                        if (!s) return false;
                        return resumeHaystack.includes(s);
                      };

                      return (
                        <div className="relative pt-3 mt-1">
                          {/* Connector line from the textarea above */}
                          <div className="absolute -top-0 left-8 w-px h-3 bg-purple-500/30" />
                          <div className="rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.07] p-4 space-y-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <SparklesIcon className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                              <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-600 dark:text-gray-300">
                                Extracted Requirements
                              </span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                — auto-detected from job posting
                              </span>
                            </div>

                            <div>
                              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-500 mb-1">
                                Role
                              </p>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {result.jd_analysis.job_title}
                                {result.jd_analysis.company &&
                                  result.jd_analysis.company !==
                                    "Not specified" && (
                                    <>
                                      {" "}
                                      at{" "}
                                      <span className="text-gray-700 dark:text-gray-300">
                                        {result.jd_analysis.company}
                                      </span>
                                    </>
                                  )}
                              </p>
                            </div>

                            {result.jd_analysis.required_skills?.length > 0 &&
                              (() => {
                                const skills =
                                  result.jd_analysis.required_skills.slice(
                                    0,
                                    14,
                                  );
                                const matchedCount =
                                  skills.filter(isMatched).length;
                                return (
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-500">
                                        Required skills
                                      </p>
                                      <span className="text-[10px] font-semibold tabular-nums text-gray-500 dark:text-gray-400">
                                        {matchedCount}/{skills.length} matched
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {skills.map((s) => {
                                        const matched = isMatched(s);
                                        return (
                                          <span
                                            key={s}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                                              matched
                                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/25"
                                                : "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/25"
                                            }`}
                                          >
                                            {matched ? (
                                              <svg
                                                className="w-3 h-3"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                              >
                                                <path
                                                  fillRule="evenodd"
                                                  d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
                                                  clipRule="evenodd"
                                                />
                                              </svg>
                                            ) : (
                                              <span className="text-[11px] leading-none">
                                                +
                                              </span>
                                            )}
                                            {s}
                                          </span>
                                        );
                                      })}
                                      {result.jd_analysis.required_skills
                                        .length > 14 && (
                                        <span className="text-[10px] text-gray-500 dark:text-gray-500 self-center">
                                          +
                                          {result.jd_analysis.required_skills
                                            .length - 14}{" "}
                                          more
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}

                            {result.jd_analysis.preferred_skills?.length >
                              0 && (
                              <div>
                                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-500 mb-2">
                                  Preferred skills
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {result.jd_analysis.preferred_skills
                                    .slice(0, 10)
                                    .map((s) => {
                                      const matched = isMatched(s);
                                      return (
                                        <span
                                          key={s}
                                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                                            matched
                                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/25"
                                              : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10"
                                          }`}
                                        >
                                          {matched && (
                                            <svg
                                              className="w-2.5 h-2.5"
                                              viewBox="0 0 20 20"
                                              fill="currentColor"
                                            >
                                              <path
                                                fillRule="evenodd"
                                                d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                              />
                                            </svg>
                                          )}
                                          {s}
                                        </span>
                                      );
                                    })}
                                </div>
                              </div>
                            )}

                            {/* Legend */}
                            <div className="flex gap-4 text-[10px] text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-white/[0.05]">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                Found in your resume
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                Missing — consider adding
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                  <button
                    onClick={handleTailoring}
                    disabled={!jdText.trim() || analyzingJD || tailoring}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-[0.98] transition-all duration-200"
                  >
                    {analyzingJD || tailoring ? (
                      <>
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Tailoring…
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="w-4 h-4" />
                        {result ? "Re-tailor with new JD" : "Tailor My Resume"}
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* ── TAB 2: ATS Score ── */}
              {inspectorTab === "ats" && result && (
                <div className="p-5 sm:p-6 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto overscroll-contain">
                  {result.ats_scores ? (
                    <ATSPanel
                      scores={result.ats_scores}
                      onAddKeyword={handleAddKeyword}
                      addedKeywords={addedKeywords}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="relative w-14 h-14 mb-4">
                        <div className="absolute inset-0 rounded-full border-2 border-gray-300 dark:border-gray-700" />
                        <div className="absolute inset-0 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                      </div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                        Analyzing ATS compatibility…
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                        Checking against Workday, Greenhouse, Lever, and more
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 3: Regenerate ── */}
              {inspectorTab === "regenerate" && result && (
                <div className="p-5 sm:p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25 shrink-0">
                      <ArrowPathIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Regenerate Resume
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Refine with feedback — your current version is kept for
                        comparison
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const SUGGESTIONS: {
                      tier: "high" | "style" | "extra";
                      label: string;
                    }[] = [
                      { tier: "high", label: "Quantify impact with numbers" },
                      { tier: "high", label: "Add more metrics to bullets" },
                      {
                        tier: "high",
                        label: "Highlight cloud / AWS experience",
                      },
                      { tier: "style", label: "Make the summary more concise" },
                      { tier: "style", label: "Use stronger action verbs" },
                      { tier: "style", label: "Make it more technical" },
                      {
                        tier: "extra",
                        label: "Emphasize leadership experience",
                      },
                      {
                        tier: "extra",
                        label: "Add team / collaboration keywords",
                      },
                    ];
                    const selected = SUGGESTIONS.filter((s) =>
                      regenFeedback
                        .toLowerCase()
                        .includes(s.label.toLowerCase().slice(0, 20)),
                    );

                    const chipCls = (
                      tier: "high" | "style" | "extra",
                      already: boolean,
                    ) => {
                      if (already) {
                        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 ring-1 ring-emerald-500/20 cursor-default";
                      }
                      if (tier === "high")
                        return "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30 font-semibold hover:bg-purple-500/20 hover:border-purple-500/50 hover:-translate-y-px";
                      if (tier === "style")
                        return "bg-gray-100 dark:bg-white/[0.05] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-purple-500/40 hover:text-purple-600 dark:hover:text-purple-300 hover:-translate-y-px";
                      return "bg-gray-50 dark:bg-white/[0.03] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/[0.07] hover:border-purple-500/30 hover:text-gray-700 dark:hover:text-gray-200";
                    };

                    const Chip = ({
                      hint,
                    }: {
                      hint: { tier: "high" | "style" | "extra"; label: string };
                    }) => {
                      const already = regenFeedback
                        .toLowerCase()
                        .includes(hint.label.toLowerCase().slice(0, 20));
                      return (
                        <button
                          type="button"
                          disabled={already || regenerating}
                          onClick={() =>
                            setRegenFeedback((f) => {
                              if (!f.trim()) return hint.label + ".";
                              if (
                                f
                                  .toLowerCase()
                                  .includes(
                                    hint.label.toLowerCase().slice(0, 20),
                                  )
                              )
                                return f;
                              return (
                                f.trim().replace(/\.?$/, ".") +
                                " " +
                                hint.label +
                                "."
                              );
                            })
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border transition-all ${chipCls(hint.tier, already)}`}
                        >
                          {already ? (
                            <svg
                              className="w-3 h-3"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : hint.tier === "high" ? (
                            <svg
                              className="w-3 h-3"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                            </svg>
                          ) : (
                            <span className="text-[11px] leading-none">+</span>
                          )}
                          {hint.label}
                        </button>
                      );
                    };

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Quick suggestions
                          </p>
                          {selected.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-500 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              {selected.length} selected
                            </span>
                          )}
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-purple-500 dark:text-purple-400 mb-1.5 flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                            </svg>
                            High impact
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {SUGGESTIONS.filter((s) => s.tier === "high").map(
                              (s) => (
                                <Chip key={s.label} hint={s} />
                              ),
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
                            Style
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {SUGGESTIONS.filter((s) => s.tier === "style").map(
                              (s) => (
                                <Chip key={s.label} hint={s} />
                              ),
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500 mb-1.5">
                            Extras
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {SUGGESTIONS.filter((s) => s.tier === "extra").map(
                              (s) => (
                                <Chip key={s.label} hint={s} />
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">
                      Custom instructions
                    </label>
                    <textarea
                      placeholder="Or write your own — e.g., 'Remove the summary and add a highlights section with top 3 achievements'"
                      value={regenFeedback}
                      onChange={(e) => setRegenFeedback(e.target.value)}
                      rows={5}
                      maxLength={2000}
                      disabled={regenerating}
                      className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-900/60 border border-gray-300 dark:border-white/10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/40 transition-all disabled:opacity-50"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                        {regenFeedback.length} / 2,000
                      </span>
                      {regenError && (
                        <span className="text-xs text-red-400">
                          {regenError}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleRegenerate}
                    disabled={!regenFeedback.trim() || regenerating}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-[0.98] transition-all duration-200"
                  >
                    {regenerating ? (
                      <>
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Regenerating…
                      </>
                    ) : (
                      <>
                        <ArrowPathIcon className="w-4 h-4" />
                        Regenerate Resume
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* ── TAB 4: Cover Letter ── */}
              {inspectorTab === "cover" && result && (
                <div className="p-5 sm:p-6 space-y-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25 shrink-0">
                        <SparklesIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                          Cover Letter
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Personalized to the role and your resume
                        </p>
                      </div>
                    </div>
                    {!coverLetter && (
                      <button
                        onClick={handleCoverLetter}
                        disabled={coverLetterLoading}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 shadow-lg shadow-purple-500/25 active:scale-[0.98] transition-all"
                      >
                        {coverLetterLoading ? (
                          <>
                            <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            Generating…
                          </>
                        ) : (
                          <>
                            <SparklesIcon className="w-4 h-4" />
                            Generate
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {coverLetter ? (
                    <>
                      <div className="rounded-xl bg-white dark:bg-gray-950/80 border border-gray-200 dark:border-white/[0.07] p-5 sm:p-6 max-h-[480px] overflow-y-auto shadow-inner shadow-black/5">
                        <div className="text-[14px] text-gray-800 dark:text-gray-100 leading-[1.75] whitespace-pre-line font-serif">
                          {coverLetter}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={handleDownloadCoverLetter}
                          disabled={coverLetterDownloading}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 shadow-lg shadow-purple-500/25 active:scale-[0.98] transition-all"
                        >
                          <DocumentArrowDownIcon className="w-4 h-4" />
                          {coverLetterDownloading
                            ? "Preparing…"
                            : "Download PDF"}
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(coverLetter);
                            toast.success("Copied to clipboard");
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 bg-white/80 dark:bg-white/10 border border-gray-300 dark:border-white/10 hover:bg-white dark:hover:bg-white/15 transition-all"
                        >
                          <ClipboardIcon className="w-4 h-4" />
                          Copy text
                        </button>
                        <button
                          onClick={() => setCoverLetter(null)}
                          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                        >
                          <ArrowPathIcon className="w-4 h-4" />
                          Regenerate
                        </button>
                      </div>
                    </>
                  ) : coverLetterLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="relative w-14 h-14 mb-4">
                        <div className="absolute inset-0 rounded-full border-2 border-gray-300 dark:border-gray-700" />
                        <div className="absolute inset-0 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                      </div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                        Writing your cover letter…
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                        Matching your experience to the role. Usually takes
                        15–30 seconds.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 py-4">
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                        <SparklesIcon className="w-4 h-4 text-purple-500 dark:text-purple-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                          We'll generate a personalized 3-4 paragraph cover
                          letter tailored to{" "}
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {result.jd_analysis.job_title}
                          </span>
                          {result.jd_analysis.company &&
                          result.jd_analysis.company !== "Not specified" ? (
                            <>
                              {" "}
                              at{" "}
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {result.jd_analysis.company}
                              </span>
                            </>
                          ) : null}{" "}
                          using your tailored resume.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>

      {/* ═══ STICKY BOTTOM TOOLBAR ═══
          Contextual identity (icon + filename + "Tailored for X at Y") on the left,
          ATS match badge in the center, ghost actions + primary Download Resume
          dropdown on the right. The dropdown disambiguates PDF vs DOCX under
          a single clear CTA ("Download Resume") instead of two competing buttons. */}
      {result && !editing && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-gray-950/95 backdrop-blur-xl border-t border-gray-200 dark:border-white/[0.07] shadow-2xl shadow-black/10"
        >
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
            {/* LEFT — humanized resume identity */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0">
                <FileIcon className="w-5 h-5 text-purple-500 dark:text-purple-400" />
              </div>
              <div className="min-w-0 hidden sm:block">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  Your Tailored Resume
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  Tailored for{" "}
                  <span className="text-purple-600 dark:text-purple-400 font-medium">
                    {result.jd_analysis.job_title}
                  </span>
                  {result.jd_analysis.company &&
                    result.jd_analysis.company !== "Not specified" && (
                      <>
                        {" "}
                        at{" "}
                        <span className="text-gray-700 dark:text-gray-300">
                          {result.jd_analysis.company}
                        </span>
                      </>
                    )}
                  <span className="text-gray-400 dark:text-gray-600 mx-1.5">
                    ·
                  </span>
                  <span className="text-gray-400 dark:text-gray-500">
                    just now
                  </span>
                </p>
              </div>
              {/* Mobile-only compact context */}
              <div className="min-w-0 sm:hidden">
                <p className="text-[11px] font-semibold text-gray-900 dark:text-white truncate">
                  Your Tailored Resume
                </p>
                <p className="text-[11px] text-purple-600 dark:text-purple-400 truncate">
                  {result.jd_analysis.job_title}
                </p>
              </div>
            </div>

            {/* CENTER — ATS match badge (lg+) */}
            {result.ats_scores && (
              <div
                className={`hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl border shrink-0 ${
                  result.ats_scores.overall >= 80
                    ? "bg-emerald-500/10 border-emerald-500/25"
                    : result.ats_scores.overall >= 60
                      ? "bg-amber-500/10 border-amber-500/25"
                      : "bg-red-500/10 border-red-500/25"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full animate-pulse ${result.ats_scores.overall >= 80 ? "bg-emerald-400" : result.ats_scores.overall >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                />
                <span
                  className={`text-xs font-semibold tabular-nums ${result.ats_scores.overall >= 80 ? "text-emerald-600 dark:text-emerald-400" : result.ats_scores.overall >= 60 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}
                >
                  {result.ats_scores.overall}% ATS Match
                </span>
              </div>
            )}
            {atsLoading && !result.ats_scores && (
              <div className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Scoring…
                </span>
              </div>
            )}

            {/* RIGHT — escape hatch, ghost actions, primary dropdown */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleStartNew}
                title="Start a new tailor with a different job"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-500/10 transition-all"
              >
                <SparklesIcon className="w-4 h-4" />
                <span className="hidden md:inline">New Tailor</span>
              </button>

              <button
                onClick={() => setEditing(true)}
                title="Edit the tailored resume"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-500/10 transition-all"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                  />
                </svg>
                <span className="hidden md:inline">Edit</span>
              </button>

              <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-0.5" />

              {/* Primary CTA — Download Resume with format dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDownloadMenuOpen((v) => !v)}
                  disabled={downloading !== null}
                  aria-haspopup="menu"
                  aria-expanded={downloadMenuOpen}
                  className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-[0.98] transition-all"
                >
                  {downloading !== null ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      <span className="hidden sm:inline">Preparing…</span>
                    </>
                  ) : (
                    <>
                      <DocumentArrowDownIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">Download Resume</span>
                      <span className="sm:hidden">Download</span>
                      <svg
                        className={`w-3.5 h-3.5 opacity-70 transition-transform ${downloadMenuOpen ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                        />
                      </svg>
                    </>
                  )}
                </button>
                {downloadMenuOpen && (
                  <>
                    {/* Click-outside catcher */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setDownloadMenuOpen(false)}
                    />
                    {/* Dropdown menu — pops up above the bar */}
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      role="menu"
                      className="absolute bottom-full right-0 mb-2 w-64 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-2xl shadow-black/20 p-1.5 z-20 overflow-hidden"
                    >
                      <button
                        role="menuitem"
                        onClick={() => {
                          setDownloadMenuOpen(false);
                          handleDownload("pdf");
                        }}
                        disabled={downloading !== null}
                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-purple-500/10 flex items-center gap-3 transition-colors disabled:opacity-50 group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                          <DocumentArrowDownIcon className="w-4 h-4 text-red-500 dark:text-red-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            Download as PDF
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Best for job applications
                          </p>
                        </div>
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => {
                          setDownloadMenuOpen(false);
                          handleDownload("docx");
                        }}
                        disabled={downloading !== null}
                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-purple-500/10 flex items-center gap-3 transition-colors disabled:opacity-50 group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                          <DocumentArrowDownIcon className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            Download as DOCX
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Best for further editing
                          </p>
                        </div>
                      </button>
                    </motion.div>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Editor mode — full-screen overlay */}
      {result && editing && (
        <div className="fixed inset-0 z-[60] bg-gray-100 dark:bg-gray-950 overflow-y-auto overscroll-contain">
          <div className="max-w-7xl mx-auto px-0 sm:px-0 lg:px-0">
            <Suspense
              fallback={
                <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-gray-900/40 p-8 text-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Loading editor...
                  </span>
                </div>
              }
            >
              <ResumeEditor
                resume={result.tailored_resume}
                jdAnalysis={result.jd_analysis}
                onBack={() => setEditing(false)}
              />
            </Suspense>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Page export ────────────────────────────────────────────────────────────
const NAV_ITEMS: { key: NavTab; label: string; icon: React.ReactNode }[] = [
  {
    key: "tailor",
    label: "Tailor",
    icon: <SparklesIcon className="w-4 h-4" />,
  },
  {
    key: "batch",
    label: "Batch Tailor",
    icon: <ClipboardIcon className="w-4 h-4" />,
  },
  {
    key: "my-resumes",
    label: "My Resumes",
    icon: <FileIcon className="w-4 h-4" />,
  },
  {
    key: "tailored",
    label: "Tailored Resumes",
    icon: <DocumentArrowDownIcon className="w-4 h-4" />,
  },
  {
    key: "profile",
    label: "Profile",
    icon: <UserCircleIcon className="w-4 h-4" />,
  },
];

export default function ResumeParser() {
  const { user } = useAuth();
  const [activeNav, setActiveNav] = useState<NavTab>("tailor");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  useVisitorTracking("resume-parser");

  return (
    <AuthGate
      title="AI Resume Tailor"
      description="Upload your resume, tailor it to any job description, and get ATS compatibility scores powered by AI."
    >
      <div
        className="min-h-screen bg-white dark:bg-gray-950 antialiased pb-24"
        style={{
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        {/* Frosted glass navbar — highest z-index (z-50), near-opaque background so
            scrolled content doesn't bleed through, no siblings with matching z. */}
        <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-white/10 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="h-14 flex items-center gap-4">
              {/* Logo */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <SparklesIcon className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent hidden sm:block">
                  Resume Tailor
                </h1>
              </div>

              {/* Nav pills — center-ish */}
              <nav
                className="flex-1 flex items-center gap-1 overflow-x-auto hide-scrollbar"
                aria-label="Resume tailor sections"
              >
                {NAV_ITEMS.map((item) => {
                  const active = activeNav === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActiveNav(item.key)}
                      aria-current={active ? "page" : undefined}
                      className={`relative inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 ${
                        active
                          ? "bg-purple-500/15 text-purple-600 dark:text-purple-300 ring-1 ring-purple-500/30"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                      }`}
                    >
                      <span
                        className={
                          active
                            ? "text-purple-500 dark:text-purple-300"
                            : "text-gray-400 dark:text-gray-500"
                        }
                      >
                        {item.icon}
                      </span>
                      <span className="hidden md:inline">{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Right actions */}
              <div className="flex items-center gap-1 shrink-0">
                <ThemeToggle />
                <button
                  onClick={() => (window.location.href = "/home")}
                  aria-label="Home"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                >
                  <HomeIcon className="w-4 h-4" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white text-xs font-bold ring-2 ring-purple-500/40 hover:ring-purple-500/60 hover:scale-105 transition-all"
                  >
                    {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
                  </button>
                  {userMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-2xl shadow-black/20 backdrop-blur-xl overflow-hidden z-20">
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {user?.name || user?.email?.split("@")[0]}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {user?.email}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setActiveNav("profile");
                            setUserMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        >
                          Profile settings
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className={activeNav === "tailor" ? "" : "hidden"}>
            <TailorTab />
          </div>
          {activeNav === "batch" && (
            <Suspense
              fallback={
                <div className="animate-pulse h-48 rounded-2xl bg-gray-100 dark:bg-gray-800/40" />
              }
            >
              <BatchTailor />
            </Suspense>
          )}
          {activeNav === "my-resumes" && <MyResumesTab />}
          {activeNav === "tailored" && <TailoredResumesTab />}
          {activeNav === "profile" && <ProfileTab />}
        </main>

        <style>{`
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          @media (prefers-reduced-motion: reduce) {
            .motion-safe\\:animate-in { animation: none !important; }
          }
        `}</style>
      </div>
    </AuthGate>
  );
}

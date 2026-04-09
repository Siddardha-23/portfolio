import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '@/lib/api';
import AuthGate from '@/components/AuthGate';
import { useAuth } from '@/contexts/AuthContext';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';
import { ThemeToggle } from '@/components/theme-toggle';
import { lazy, Suspense } from 'react';
import { toast } from 'sonner';
import ResumeDashboard, {
  type BaseResume, type GeneratedResume,
  formatDate, formatBytes,
  DownloadIcon, TrashIcon,
} from '@/components/resume/ResumeDashboard';
import type {
  TailorPipelineResult,
  TailoredFullResume,
  JDAnalysis,
  ATSScores,
} from '@/types/resume';

const ResumeEditor = lazy(() => import('@/components/resume/ResumeEditor'));
const BatchTailor = lazy(() => import('@/components/resume/BatchTailor'));

// ─── Shared Icons ───────────────────────────────────────────────────────────

function SparklesIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}
function UploadCloudIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>);
}
function DocumentArrowDownIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>);
}
function MagnifyingGlassIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>);
}
function ClipboardIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>);
}
function BriefcaseIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>);
}
function CheckCircleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
}
function ExclamationIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>);
}
function XCircleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
}
function HomeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>);
}
function ArrowPathIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.016 4.656v4.992" /></svg>);
}
function UserCircleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
}
function FileIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>);
}
function ChevronIcon({ open, className = 'w-4 h-4' }: { open: boolean; className?: string }) {
  return (<svg className={`${className} transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>);
}

type NavTab = 'tailor' | 'batch' | 'my-resumes' | 'tailored' | 'profile';

const ROLE_OPTIONS = ['Software Engineer', 'Data Scientist', 'Product Manager', 'Designer', 'DevOps Engineer', 'Student', 'Other'];
const SECTOR_OPTIONS = ['Technology', 'Finance', 'Healthcare', 'Education', 'Government', 'Consulting', 'Other'];

// ─── Score bar ──────────────────────────────────────────────────────────────
function ScoreBar({ label, score, color }: { label: string; score: number; color?: string }) {
  const bg = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-gray-400 dark:text-gray-400">{label}</span>
        <span className={`text-xs font-semibold tabular-nums ${score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{score}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-800overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${color || bg}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
    </div>
  );
}

// ─── Score ring ─────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r, o = c - (score / 100) * c;
  const col = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} stroke="rgb(31,41,55)" strokeWidth="5" fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke={col} strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={o} className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold tabular-nums" style={{ color: col }}>{score}</span>
      </div>
    </div>
  );
}

// ─── ATS Panel ──────────────────────────────────────────────────────────────
function ATSPanel({ scores }: { scores: ATSScores }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 p-6">
        <div className="flex items-center gap-6">
          <ScoreRing score={scores.overall} />
          <div className="flex-1">
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Overall ATS Score</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Weighted score across all dimensions</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 p-5">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">Score Breakdown</p>
          <div className="space-y-3">
            <ScoreBar label="Keyword Match" score={scores.keyword_match} />
            <ScoreBar label="Keyword Frequency" score={scores.keyword_frequency} />
            <ScoreBar label="Skills Alignment" score={scores.skills_alignment} />
            <ScoreBar label="Experience Relevance" score={scores.experience_relevance} />
            <ScoreBar label="Quantifiable Impact" score={scores.quantifiable_impact} />
            <ScoreBar label="Bullet Quality" score={scores.bullet_quality} />
            <ScoreBar label="Format Score" score={scores.format_score} />
            <ScoreBar label="Section Completeness" score={scores.section_completeness} />
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 p-5">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">ATS Scanner Scores</p>
          <div className="space-y-3">
            {scores.scanners && Object.entries(scores.scanners).map(([n, s]) => (
              <ScoreBar key={n} label={n.charAt(0).toUpperCase() + n.slice(1)} score={s} />
            ))}
          </div>
        </div>
      </div>
      {scores.ai_screener && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 p-5">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">AI Screener Analysis</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ScoreBar label="Overall" score={scores.ai_screener.overall} color="bg-violet-500" />
            <ScoreBar label="Relevance" score={scores.ai_screener.relevance} color="bg-violet-500" />
            <ScoreBar label="Seniority Fit" score={scores.ai_screener.seniority_fit} color="bg-violet-500" />
            <ScoreBar label="Culture Fit" score={scores.ai_screener.culture_fit} color="bg-violet-500" />
          </div>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {scores.strengths?.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 p-5">
            <div className="flex items-center gap-2 mb-3"><CheckCircleIcon className="w-4 h-4 text-emerald-400" /><p className="text-sm font-semibold text-emerald-400">Strengths</p></div>
            <ul className="space-y-2">{scores.strengths.map((s, i) => (<li key={i} className="text-xs text-gray-400 dark:text-gray-400 flex gap-2 leading-relaxed"><span className="text-emerald-500 mt-0.5 shrink-0">+</span><span>{s}</span></li>))}</ul>
          </div>
        )}
        {scores.suggestions?.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 p-5">
            <div className="flex items-center gap-2 mb-3"><ExclamationIcon className="w-4 h-4 text-amber-400" /><p className="text-sm font-semibold text-amber-400">Suggestions</p></div>
            <ul className="space-y-2">{scores.suggestions.map((s, i) => (<li key={i} className="text-xs text-gray-400 dark:text-gray-400 flex gap-2 leading-relaxed"><span className="text-amber-500 mt-0.5 shrink-0">!</span><span>{s}</span></li>))}</ul>
          </div>
        )}
      </div>
      {scores.missing_keywords?.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 p-5">
          <div className="flex items-center gap-2 mb-3"><XCircleIcon className="w-4 h-4 text-red-400" /><p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Missing Keywords</p></div>
          <div className="flex flex-wrap gap-1.5">{scores.missing_keywords.map(kw => (<span key={kw} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">{kw}</span>))}</div>
        </div>
      )}
    </div>
  );
}

// ─── Resume preview ─────────────────────────────────────────────────────────
function ResumePreview({ resume }: { resume: TailoredFullResume }) {
  const ST = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-3 mb-3"><h3 className="text-xs font-bold uppercase tracking-widest text-pink-400/80">{children}</h3><div className="flex-1 h-px bg-gray-800" /></div>
  );
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 overflow-hidden">
      <div className="bg-gradient-to-r from-gray-800/80 to-gray-900 px-6 py-5 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{resume.contact?.name}</h2>
        <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">{[resume.contact?.phone, resume.contact?.email, resume.contact?.linkedin, resume.contact?.github].filter(Boolean).join('  &middot;  ')}</p>
      </div>
      <div className="px-6 py-5 space-y-5">
        {resume.summary && <div><ST>Summary</ST><p className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">{resume.summary}</p></div>}
        {resume.experience?.length > 0 && <div><ST>Experience</ST><div className="space-y-4">{resume.experience.map((exp, i) => (<div key={i}><div className="flex justify-between items-start gap-2"><div><p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{exp.company}{exp.location ? `, ${exp.location}` : ''}</p>{exp.title && <p className="text-xs text-gray-400 dark:text-gray-400 italic mt-0.5">{exp.title}</p>}</div><span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">{exp.dates}</span></div><ul className="mt-1.5 space-y-1">{exp.bullets?.map((b, j) => (<li key={j} className="text-[12px] text-gray-400 dark:text-gray-400 flex gap-2 leading-relaxed"><span className="text-pink-500/40 shrink-0 mt-0.5">&bull;</span><span>{b}</span></li>))}</ul></div>))}</div></div>}
        {resume.projects?.length > 0 && <div><ST>Projects</ST><div className="space-y-3">{resume.projects.map((p, i) => (<div key={i}><p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{p.name}</p><ul className="mt-1 space-y-1">{p.bullets?.map((b, j) => (<li key={j} className="text-[12px] text-gray-400 dark:text-gray-400 flex gap-2 leading-relaxed"><span className="text-pink-500/40 shrink-0 mt-0.5">&bull;</span><span>{b}</span></li>))}</ul></div>))}</div></div>}
        {resume.skills && Object.keys(resume.skills).length > 0 && <div><ST>Technical Skills</ST><div className="space-y-2">{Object.entries(resume.skills).map(([c, s]) => (<div key={c} className="text-[12.5px]"><span className="font-semibold text-gray-700 dark:text-gray-300">{c}: </span><span className="text-gray-400 dark:text-gray-400">{Array.isArray(s) ? s.join(', ') : String(s)}</span></div>))}</div></div>}
        {resume.education?.length > 0 && <div><ST>Education</ST><div className="space-y-2">{resume.education.map((edu, i) => { const d = edu.degree ? [...new Set(edu.degree.split('|').map(s=>s.trim()).filter(s=>!/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})/i.test(s)).filter(Boolean))].join(' | ') : ''; return (<div key={i} className="flex justify-between items-start gap-2"><p className="text-[12.5px] text-gray-700 dark:text-gray-300"><span className="font-semibold">{edu.institution}</span>{d ? `  — ${d}` : ''}</p><span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">{edu.dates}</span></div>);})}</div></div>}
        {resume.certifications?.length > 0 && <div><ST>Certifications</ST><div className="flex flex-wrap gap-2">{resume.certifications.map((c, i) => (<span key={i} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-sky-500/10 text-sky-300 border border-sky-500/15">{c}</span>))}</div></div>}
      </div>
    </div>
  );
}

// ─── JD Analysis (collapsible) ──────────────────────────────────────────────
function JDAnalysisCard({ jd, defaultOpen = true }: { jd: JDAnalysis; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800/20 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0"><BriefcaseIcon className="w-4 h-4 text-violet-400" /></div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Extracted Job Requirements</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
              {jd.job_title}{jd.company && jd.company !== 'Not specified' ? ` at ${jd.company}` : ''}
              {!open && <span className="text-gray-400 dark:text-gray-600"> &middot; {jd.required_skills?.length || 0} required, {jd.preferred_skills?.length || 0} preferred skills</span>}
            </p>
          </div>
        </div>
        <ChevronIcon open={open} className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-gray-200 dark:border-gray-800/60 pt-4">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">Required Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {jd.required_skills?.map(s => (<span key={s} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/15">{s}</span>))}
                {(!jd.required_skills || jd.required_skills.length === 0) && <span className="text-xs text-gray-400 dark:text-gray-600">None extracted</span>}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">Preferred Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {jd.preferred_skills?.map(s => (<span key={s} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-teal-500/10 text-teal-300 border border-teal-500/15">{s}</span>))}
                {(!jd.preferred_skills || jd.preferred_skills.length === 0) && <span className="text-xs text-gray-400 dark:text-gray-600">None extracted</span>}
              </div>
            </div>
          </div>
          {jd.responsibilities?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">Key Responsibilities</p>
              <ul className="space-y-1.5">{jd.responsibilities.slice(0, 5).map((r, i) => (<li key={i} className="text-xs text-gray-400 dark:text-gray-400 flex gap-2 leading-relaxed"><span className="text-gray-400 dark:text-gray-600 shrink-0 mt-0.5">&bull;</span><span>{r}</span></li>))}</ul>
            </div>
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs pt-1 border-t border-gray-200 dark:border-gray-800/60">
            {jd.experience_years && <span className="text-gray-400 dark:text-gray-500"><span className="text-gray-400 dark:text-gray-400 font-medium">Experience:</span> {jd.experience_years}</span>}
            {jd.employment_type && <span className="text-gray-400 dark:text-gray-500"><span className="text-gray-400 dark:text-gray-400 font-medium">Type:</span> {jd.employment_type}</span>}
            {jd.industry && <span className="text-gray-400 dark:text-gray-500"><span className="text-gray-400 dark:text-gray-400 font-medium">Industry:</span> {jd.industry}</span>}
          </div>
          {jd.keywords?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">ATS Keywords</p>
              <div className="flex flex-wrap gap-1.5">{jd.keywords.map(kw => (<span key={kw} className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-200 dark:bg-gray-800text-gray-400 dark:text-gray-400 border border-gray-300 dark:border-gray-700/60">{kw}</span>))}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Phase / Progress ───────────────────────────────────────────────────────
function getPhaseInfo(analyzing: boolean, tailoring: boolean, elapsed: number): { text: string; step: number; total: number } {
  if (analyzing) return { text: 'Extracting job requirements...', step: 1, total: 4 };
  if (!tailoring) return { text: 'Processing...', step: 0, total: 4 };
  if (elapsed < 15) return { text: 'Tailoring your resume...', step: 2, total: 4 };
  if (elapsed < 40) return { text: 'Optimizing keywords and skills...', step: 3, total: 4 };
  return { text: 'Finalizing tailored resume...', step: 4, total: 4 };
}

function ProgressCard({ analyzing, tailoring, elapsed, onCancel }: { analyzing?: boolean; tailoring: boolean; elapsed: number; onCancel: () => void }) {
  const phase = getPhaseInfo(!!analyzing, tailoring, elapsed);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 p-8">
      <div className="flex flex-col items-center justify-center space-y-5">
        <div className="relative"><div className="w-12 h-12 rounded-full border-2 border-gray-300 dark:border-gray-700" /><div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" /></div>
        <div className="text-center space-y-1.5">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{phase.text}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{elapsed >= 90 ? 'Taking longer than expected  — you can wait or cancel.' : 'This may take 30–60 seconds'}</p>
          {elapsed > 0 && <p className="text-xs text-gray-400 dark:text-gray-600 tabular-nums">{elapsed}s elapsed</p>}
        </div>
        {tailoring && <div className="flex items-center gap-2">{[1,2,3,4].map(s => (<div key={s} className={`w-2 h-2 rounded-full transition-all duration-500 ${s <= phase.step ? 'bg-pink-400 scale-110' : 'bg-gray-300 dark:bg-gray-700'}`} />))}</div>}
        {elapsed >= 90 && <button type="button" onClick={onCancel} className="px-4 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded-lg hover:border-gray-400 dark:hover:border-gray-600 hover:text-gray-900 dark:hover:text-gray-300 transition-all">Cancel</button>}
      </div>
    </div>
  );
}

// ─── Onboarding hero ────────────────────────────────────────────────────────
function OnboardingHero({ onUploaded }: { onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const handleUpload = useCallback(async (file: File) => {
    const fname = file.name.toLowerCase();
    if (!fname.endsWith('.pdf') && !fname.endsWith('.docx')) { setUploadError('Only PDF and DOCX files are accepted'); return; }
    if (file.size > 5 * 1024 * 1024) { setUploadError('File too large (max 5 MB)'); return; }
    setUploading(true); setUploadError('');
    const resp = await apiService.uploadResumeForParser(file);
    setUploading(false);
    if (resp.error) { setUploadError(resp.error); return; }
    onUploaded();
  }, [onUploaded]);
  return (
    <div className="space-y-8">
      <div className="text-center pt-4 pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 mb-4"><SparklesIcon className="w-3.5 h-3.5 text-pink-400" /><span className="text-xs font-medium text-pink-300">AI-Powered Resume Tailoring</span></div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">Land more interviews with a<br /><span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">perfectly tailored resume</span></h2>
        <p className="text-sm text-gray-400 dark:text-gray-400 max-w-lg mx-auto leading-relaxed">Upload your resume once, paste any job description, and get an ATS-optimized version tailored to that specific role in seconds.</p>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60 p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 text-center mb-5">How it works</p>
        <div className="flex items-start justify-center gap-3 sm:gap-6">
          {[
            { n: 1, icon: <UploadCloudIcon className="w-5 h-5" />, l: 'Upload', d: 'Upload your existing resume', active: true },
            { n: 2, icon: <ClipboardIcon className="w-5 h-5" />, l: 'Paste JD', d: 'Paste the job description you\'re targeting' },
            { n: 3, icon: <DocumentArrowDownIcon className="w-5 h-5" />, l: 'Download', d: 'Get your ATS-optimized resume' },
          ].map((s, i) => (
            <div key={s.n} className="flex items-start gap-3 sm:gap-6">
              {i > 0 && <div className="flex items-center pt-5 shrink-0"><div className="w-6 sm:w-10 h-px bg-gray-300 dark:bg-gray-700" /><svg className="w-3 h-3 text-gray-400 dark:text-gray-600 -ml-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg></div>}
              <div className="flex flex-col items-center text-center flex-1 min-w-0">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-2.5 ${s.active ? 'bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg shadow-pink-500/20 text-white' : 'bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500'}`}>{s.icon}</div>
                <p className={`text-xs font-semibold mb-0.5 ${s.active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-400'}`}>Step {s.n}: {s.l}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug max-w-[160px]">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
        className={`rounded-xl border-2 border-dashed transition-all duration-200 ${dragOver ? 'border-pink-500/50 bg-pink-500/5' : 'border-gray-300 dark:border-gray-700/60 bg-gray-50/40 dark:bg-gray-900/40 hover:border-gray-400 dark:hover:border-gray-600/60'}`}>
        <div className="flex flex-col items-center text-center py-12 px-6">
          <div className="w-16 h-16 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-4"><UploadCloudIcon className="w-8 h-8 text-pink-400" /></div>
          <p className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">Get started — upload your resume</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-5 max-w-sm">Drop your PDF or DOCX here or click below. We'll parse it and prepare it for tailoring.</p>
          {uploading ? (
            <div className="w-full max-w-xs space-y-2"><div className="h-1.5 bg-gray-200 dark:bg-gray-800rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full animate-pulse" style={{ width: '60%' }} /></div><p className="text-xs text-gray-400 dark:text-gray-400">Parsing your resume...</p></div>
          ) : (
            <label className="cursor-pointer"><span className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 shadow-lg shadow-pink-500/15 hover:shadow-pink-500/25 transition-all duration-200"><UploadCloudIcon className="w-4 h-4" />Choose File</span><input type="file" accept=".pdf,.docx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} /></label>
          )}
          <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-3">PDF or DOCX, max 5 MB</p>
          {uploadError && <p className="text-sm text-red-400 mt-2">{uploadError}</p>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: <MagnifyingGlassIcon className="w-4 h-4 text-blue-400" />, l: 'ATS Keyword Matching', d: 'Scanned against 6+ ATS systems' },
          { icon: <SparklesIcon className="w-4 h-4 text-violet-400" />, l: 'AI-Powered Tailoring', d: 'Optimizes content for the role' },
          { icon: <DocumentArrowDownIcon className="w-4 h-4 text-emerald-400" />, l: 'PDF & DOCX Export', d: 'Download in any format' },
        ].map(f => (
          <div key={f.l} className="rounded-lg border border-gray-200 dark:border-gray-800/60 bg-gray-50/40 dark:bg-gray-900/40 p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-800flex items-center justify-center mx-auto mb-2">{f.icon}</div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-0.5">{f.l}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">{f.d}</p>
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
  const [error, setError] = useState('');
  const [settingActive, setSettingActive] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    const resp = await apiService.listBaseResumes();
    if (resp.data) setResumes(resp.data.versions || []);
    else if (resp.error) setError(resp.error);
    setLoading(false);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const handleUpload = useCallback(async (file: File) => {
    const fname = file.name.toLowerCase();
    if (!fname.endsWith('.pdf') && !fname.endsWith('.docx')) { setError('Only PDF and DOCX files accepted'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Max 5 MB'); return; }
    setUploading(true); setError('');
    const resp = await apiService.uploadResumeForParser(file);
    setUploading(false);
    if (resp.error) { setError(resp.error); return; }
    await fetch();
  }, [fetch]);

  if (loading) return <div className="animate-pulse space-y-3"><div className="h-16 rounded-xl bg-gray-100/40 dark:bg-gray-800/40" /><div className="h-16 rounded-xl bg-gray-800/30" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">My Resumes</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Uploaded resumes used as the base for tailoring</p>
        </div>
        <label className="cursor-pointer">
          <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${uploading ? 'bg-gray-300 dark:bg-gray-700 text-gray-400 dark:text-gray-400 cursor-wait' : 'text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 shadow-lg shadow-pink-500/15'}`}>
            {uploading ? <><span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" /> Uploading...</> : <><UploadCloudIcon className="w-4 h-4" /> Upload Resume</>}
          </span>
          <input type="file" accept=".pdf,.docx" className="hidden" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
        </label>
      </div>
      {error && <div className="px-4 py-3 rounded-lg bg-red-900/20 border border-red-500/30"><p className="text-sm text-red-300">{error}</p></div>}
      {resumes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-900/40 p-10 text-center">
          <FileIcon className="w-8 h-8 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 dark:text-gray-400">No resumes uploaded yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Upload a PDF or DOCX to get started</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-900/50 divide-y divide-gray-800/60">
          {resumes.map(r => (
            <div key={r.s3_key} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-100 dark:hover:bg-gray-800/20 transition-colors">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${r.is_active ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{r.filename}</p>
                    {r.is_active && <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Active</span>}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(r.uploaded_at)}{r.size ? ` &middot; ${formatBytes(r.size)}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-3">
                {!r.is_active && (
                  <button onClick={async () => { setSettingActive(r.s3_key); await apiService.setActiveResume(r.s3_key); setSettingActive(null); await fetch(); }}
                    disabled={settingActive === r.s3_key}
                    className="px-2.5 py-1.5 text-xs font-medium text-pink-400 hover:text-pink-300 hover:bg-pink-500/10 rounded-md transition-colors disabled:opacity-50">
                    {settingActive === r.s3_key ? 'Setting...' : 'Use for Tailoring'}
                  </button>
                )}
                <button onClick={async () => { setDeleting(r.s3_key); await apiService.deleteResume(r.s3_key); setDeleting(null); await fetch(); }}
                  disabled={deleting === r.s3_key}
                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50" title="Delete">
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
  const [error, setError] = useState('');
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [recordsResp, filesResp] = await Promise.all([
      apiService.listTailoringRecords(),
      apiService.listGeneratedResumes(),
    ]);
    if (recordsResp.data) setRecords(recordsResp.data.records || []);
    if (filesResp.data) setGeneratedFiles(filesResp.data.generated || []);
    if (recordsResp.error && filesResp.error) setError(recordsResp.error || filesResp.error);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDownloadRecord = useCallback(async (tailoredResume: any, jdAnalysis: any, fmt: 'pdf' | 'docx') => {
    const key = `${jdAnalysis?.job_title}-${fmt}`;
    setDownloading(key);
    const r = await apiService.downloadTailoredResume(tailoredResume, jdAnalysis, fmt);
    setDownloading(null);
    if (r.error) { toast.error('Download failed'); return; }
    if (r.data) {
      const u = URL.createObjectURL(r.data);
      const a = document.createElement('a'); a.href = u; a.download = r.filename || `resume.${fmt}`; a.click(); URL.revokeObjectURL(u);
      toast.success(`Downloaded as ${fmt.toUpperCase()}`);
    }
  }, []);

  const handleDownloadFile = useCallback(async (s3Key: string, filename?: string) => {
    setDownloading(s3Key);
    try {
      const blob = await apiService.downloadResumeFile(s3Key);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename || 'resume.pdf'; a.click(); URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
    setDownloading(null);
  }, []);

  if (loading) return <div className="animate-pulse space-y-3"><div className="h-16 rounded-xl bg-gray-100/40 dark:bg-gray-800/40" /><div className="h-16 rounded-xl bg-gray-100/20 dark:bg-gray-800/30" /></div>;

  const hasContent = records.length > 0 || generatedFiles.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Tailoring History</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">All your tailored resumes with JD details and ATS scores</p>
      </div>
      {error && <div className="px-4 py-3 rounded-lg bg-red-900/20 border border-red-500/30"><p className="text-sm text-red-300">{error}</p></div>}
      {!hasContent ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-900/40 p-10 text-center">
          <SparklesIcon className="w-8 h-8 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 dark:text-gray-400">No tailored resumes yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Go to the Tailor tab and paste a job description to create one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Tailoring records with full data */}
          {records.map((r, idx) => {
            const title = r.jd_analysis?.job_title || 'Untitled Role';
            const company = r.jd_analysis?.company;
            const atsScore = r.ats_scores?.overall;
            const isExpanded = expandedRecord === r.record_id;
            return (
              <div key={r.record_id || idx} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 overflow-hidden">
                <button type="button" onClick={() => setExpandedRecord(isExpanded ? null : r.record_id)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800/20 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-purple-400" />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {title}{company && company !== 'Not specified' ? ` at ${company}` : ''}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDate(r.created_at || '')}
                        {atsScore !== undefined && <span className={`ml-2 font-semibold ${atsScore >= 80 ? 'text-emerald-500' : atsScore >= 60 ? 'text-amber-500' : 'text-red-500'}`}>ATS: {atsScore}/100</span>}
                      </p>
                    </div>
                  </div>
                  <ChevronIcon open={isExpanded} className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                </button>
                {isExpanded && r.tailored_resume && (
                  <div className="border-t border-gray-200 dark:border-gray-800/60 px-5 py-4 space-y-4">
                    {/* Quick actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => handleDownloadRecord(r.tailored_resume, r.jd_analysis, 'pdf')}
                        disabled={downloading !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 disabled:opacity-50 transition-all">
                        <DocumentArrowDownIcon className="w-3.5 h-3.5" />PDF
                      </button>
                      <button onClick={() => handleDownloadRecord(r.tailored_resume, r.jd_analysis, 'docx')}
                        disabled={downloading !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 disabled:opacity-50 transition-all">
                        <DocumentArrowDownIcon className="w-3.5 h-3.5" />DOCX
                      </button>
                      {r.jd_analysis?.required_skills?.length > 0 && (
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-2">
                          {r.jd_analysis.required_skills.length} required skills
                        </span>
                      )}
                    </div>
                    {/* Summary preview */}
                    {r.tailored_resume?.summary && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Summary</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">{r.tailored_resume.summary}</p>
                      </div>
                    )}
                    {/* Skills preview */}
                    {r.tailored_resume?.skills && Object.keys(r.tailored_resume.skills).length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.values(r.tailored_resume.skills).flat().slice(0, 15).map((s: any, si: number) => (
                            <span key={si} className="px-2 py-0.5 rounded text-[10px] font-medium bg-pink-500/10 text-pink-600 dark:text-pink-300 border border-pink-500/15">{s}</span>
                          ))}
                          {Object.values(r.tailored_resume.skills).flat().length > 15 && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 self-center">+{Object.values(r.tailored_resume.skills).flat().length - 15} more</span>
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
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 pt-2">Downloaded Files</p>
          )}
          {generatedFiles.map(r => (
            <div key={r.s3_key} className="flex items-center justify-between px-5 py-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 hover:bg-gray-100 dark:hover:bg-gray-800/20 transition-colors">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-gray-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{r.job_title || r.filename || 'Tailored Resume'}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(r.generated_at || r.created_at || '')}</p>
                </div>
              </div>
              <button onClick={() => handleDownloadFile(r.s3_key, r.filename)} disabled={downloading === r.s3_key}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-pink-300 hover:bg-pink-500/10 rounded-md transition-colors disabled:opacity-50">
                <DownloadIcon className="w-3.5 h-3.5" />{downloading === r.s3_key ? '...' : 'Download'}
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
  const [name, setName] = useState(user?.name || '');
  const [role, setRole] = useState(user?.role || '');
  const [sector, setSector] = useState(user?.sector || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    const result = await updateProfile({ name: name.trim() || undefined, role: role || undefined, sector: sector || undefined });
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const inputCls = 'w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/60 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500/30 transition-all';
  const selectCls = 'w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/60 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500/30 transition-all appearance-none cursor-pointer';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Profile Settings</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Update your personal information</p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 p-6 space-y-5">
        {/* Email (read-only) */}
        <div>
          <label className={labelCls}>Email</label>
          <div className="px-4 py-2.5 rounded-lg bg-gray-100/40 dark:bg-gray-800/40 border border-gray-300 dark:border-gray-700/40 text-sm text-gray-400 dark:text-gray-400">{user?.email}</div>
          <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">Email cannot be changed</p>
        </div>

        <div>
          <label htmlFor="profile-name" className={labelCls}>Full Name</label>
          <input id="profile-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" className={inputCls} />
        </div>

        <div>
          <label htmlFor="profile-role" className={labelCls}>Role</label>
          <div className="relative">
            <select id="profile-role" value={role} onChange={e => setRole(e.target.value)} className={selectCls}>
              <option value="">Select a role</option>
              {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"><ChevronIcon open={false} className="w-4 h-4 text-gray-400 dark:text-gray-500" /></span>
          </div>
        </div>

        <div>
          <label htmlFor="profile-sector" className={labelCls}>Industry</label>
          <div className="relative">
            <select id="profile-sector" value={sector} onChange={e => setSector(e.target.value)} className={selectCls}>
              <option value="">Select an industry</option>
              {SECTOR_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"><ChevronIcon open={false} className="w-4 h-4 text-gray-400 dark:text-gray-500" /></span>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {saved && <p className="text-sm text-emerald-400 flex items-center gap-1.5"><CheckCircleIcon className="w-4 h-4" /> Profile updated</p>}

        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-400 dark:text-gray-500 disabled:cursor-not-allowed shadow-lg shadow-pink-500/15 hover:shadow-pink-500/25 disabled:shadow-none transition-all duration-200">
          {saving ? <><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Saving...</> : 'Save Changes'}
        </button>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 p-6">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Account</p>
        <button onClick={() => { logout(); window.location.href = '/home'; }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all">
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
  const [jdText, setJdText] = useState('');
  const [analyzingJD, setAnalyzingJD] = useState(false);
  const [jdAnalysis, setJdAnalysis] = useState<JDAnalysis | null>(null);
  const [tailoring, setTailoring] = useState(false);
  const [tailorError, setTailorError] = useState('');
  const [result, setResult] = useState<TailorPipelineResult | null>(null);
  const [atsLoading, setAtsLoading] = useState(false);
  const [tailorElapsed, setTailorElapsed] = useState(0);
  const tailorAbortRef = useRef<AbortController | null>(null);
  const atsAbortRef = useRef<AbortController | null>(null);
  const tailorTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jdRef = useRef<HTMLDivElement>(null);
  const recordIdRef = useRef<string | null>(null);
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'ats'>('preview');
  const [resumeLoadError, setResumeLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [regenFeedback, setRegenFeedback] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState('');
  const [regenJustCompleted, setRegenJustCompleted] = useState(false);
  const regenAbortRef = useRef<AbortController | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const coverLetterAbortRef = useRef<AbortController | null>(null);

  // Fetch active resume info for record storage
  const activeResumeRef = useRef<{ filename: string; s3_key: string } | null>(null);

  const checkResumes = useCallback(async () => {
    setLoadingCheck(true);
    setResumeLoadError('');
    const resp = await apiService.listBaseResumes();
    if (resp.data) {
      const versions = resp.data.versions || [];
      setHasResumes(versions.length > 0);
      const active = versions.find((v: any) => v.is_active);
      if (active) activeResumeRef.current = { filename: active.filename, s3_key: active.s3_key };
    } else {
      const isAuthError = (resp.error || '').toLowerCase().includes('session expired') || (resp.error || '').includes('401');
      if (isAuthError) {
        setResumeLoadError('Your session expired. Please log in again.');
      } else {
        const s = await apiService.getResumeStatus();
        if (s.data) setHasResumes(s.data.has_resume === true);
        else setResumeLoadError(s.error || resp.error || 'Unable to load your resumes right now.');
      }
    }
    setLoadingCheck(false);
  }, []);
  useEffect(() => { checkResumes(); }, [checkResumes]);
  useEffect(() => () => { tailorAbortRef.current?.abort(); atsAbortRef.current?.abort(); regenAbortRef.current?.abort(); coverLetterAbortRef.current?.abort(); if (tailorTimerRef.current) clearInterval(tailorTimerRef.current); }, []);

  // Save tailoring record to backend (fire-and-forget)
  const saveRecord = useCallback(async (
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
        base_resume_filename: activeResumeRef.current?.filename || '',
        base_resume_s3_key: activeResumeRef.current?.s3_key || '',
      });
      if (resp.data?.record_id) recordIdRef.current = resp.data.record_id;
    } catch { /* silent — analytics only */ }
  }, []);

  // Update existing record with ATS scores
  const updateRecordATS = useCallback(async (atsScores: ATSScores) => {
    if (!recordIdRef.current) return;
    try {
      await apiService.saveTailoringRecord({
        record_id: recordIdRef.current,
        ats_scores: atsScores,
      });
    } catch { /* silent */ }
  }, []);

  // Auto-start ATS scoring when tailoring completes
  const atsAutoTriggered = useRef(false);
  useEffect(() => {
    if (result && !result.ats_scores && !atsLoading && !atsAutoTriggered.current) {
      atsAutoTriggered.current = true;
      const t = setTimeout(() => {
        const ctrl = new AbortController();
        atsAbortRef.current = ctrl;
        setAtsLoading(true);
        apiService.fetchATSScores(result.tailored_resume, result.jd_analysis, ctrl.signal)
          .then(r => {
            if (ctrl.signal.aborted) return;
            setAtsLoading(false);
            if (r.data?.ats_scores) {
              setResult(p => p ? { ...p, ats_scores: r.data!.ats_scores } : p);
              updateRecordATS(r.data.ats_scores);
              // Auto-switch to ATS tab so user sees the score
              setActiveTab('ats');
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
    const ctrl = new AbortController(); tailorAbortRef.current = ctrl;

    // Phase 1: Analyze JD
    setAnalyzingJD(true); setTailorError(''); setJdAnalysis(null); setResult(null);
    setTailorElapsed(0);
    tailorTimerRef.current = setInterval(() => setTailorElapsed(p => p + 1), 1000);

    const jdResp = await apiService.extractJD(jdText.trim());
    if (ctrl.signal.aborted) { cleanup(); return; }
    if (jdResp.error) { cleanup(); setTailorError(jdResp.error); return; }
    if (!jdResp.data?.jd_analysis) { cleanup(); setTailorError('Failed to analyze job description.'); return; }

    const analysis = jdResp.data.jd_analysis;
    setJdAnalysis(analysis);
    setAnalyzingJD(false);

    // Phase 2: Tailor resume
    setTailoring(true);
    const tailorResp = await apiService.tailorResumeForParser(analysis, ctrl.signal);
    if (ctrl.signal.aborted) { cleanup(); return; }

    cleanup();
    if (tailorResp.error) { setTailorError(tailorResp.error); return; }
    if (tailorResp.data) {
      setResult({ jd_analysis: analysis, tailored_resume: tailorResp.data.tailored_resume });
      saveRecord(analysis, tailorResp.data.tailored_resume, jdText);
      apiService.downloadTailoredResume(tailorResp.data.tailored_resume, analysis, 'pdf').catch(() => {});
    }

    function cleanup() {
      if (tailorTimerRef.current) clearInterval(tailorTimerRef.current);
      tailorTimerRef.current = null;
      setAnalyzingJD(false); setTailoring(false); setTailorElapsed(0);
    }
  }, [jdText, saveRecord]);

  const handleCancel = useCallback(() => { tailorAbortRef.current?.abort(); if (tailorTimerRef.current) clearInterval(tailorTimerRef.current); tailorTimerRef.current = null; setTailoring(false); setTailorElapsed(0); }, []);

  const handleDownload = useCallback(async (fmt: 'pdf' | 'docx') => {
    if (!result) return; setDownloading(fmt);
    const r = await apiService.downloadTailoredResume(result.tailored_resume, result.jd_analysis, fmt);
    setDownloading(null);
    if (r.error) { toast.error('Download failed', { description: r.error }); return; }
    if (r.data) { const u = URL.createObjectURL(r.data); const a = document.createElement('a'); a.href = u; a.download = r.filename || `resume.${fmt}`; a.click(); URL.revokeObjectURL(u); toast.success(`Resume downloaded as ${fmt.toUpperCase()}`); }
  }, [result]);

  const handleRegenerate = useCallback(async () => {
    if (!result || !regenFeedback.trim()) return;
    regenAbortRef.current?.abort();
    const ctrl = new AbortController(); regenAbortRef.current = ctrl;
    setRegenerating(true); setRegenError('');

    const resp = await apiService.regenerateResume(
      result.tailored_resume, result.jd_analysis, regenFeedback.trim(), ctrl.signal
    );

    if (ctrl.signal.aborted) { setRegenerating(false); return; }
    setRegenerating(false);

    if (resp.error) { setRegenError(resp.error); toast.error('Regeneration failed', { description: resp.error }); return; }
    if (resp.data?.tailored_resume) {
      setResult(prev => prev ? { ...prev, tailored_resume: resp.data!.tailored_resume, ats_scores: undefined } : prev);
      setRegenFeedback('');
      setActiveTab('preview');
      setRegenJustCompleted(true);
      setTimeout(() => setRegenJustCompleted(false), 5000);
      toast.success('Resume regenerated successfully');
      // Re-trigger ATS scoring for the new version
      atsAutoTriggered.current = false;
    }
  }, [result, regenFeedback]);

  const handleCoverLetter = useCallback(async () => {
    if (!result || coverLetterLoading) return;
    coverLetterAbortRef.current?.abort();
    const ctrl = new AbortController(); coverLetterAbortRef.current = ctrl;
    setCoverLetterLoading(true);
    const resp = await apiService.generateCoverLetter(result.tailored_resume, result.jd_analysis, ctrl.signal);
    if (ctrl.signal.aborted) { setCoverLetterLoading(false); return; }
    setCoverLetterLoading(false);
    if (resp.error) { toast.error('Cover letter generation failed', { description: resp.error }); return; }
    if (resp.data?.cover_letter) {
      setCoverLetter(resp.data.cover_letter);
      toast.success('Cover letter generated');
    }
  }, [result, coverLetterLoading]);

  const handleStartNew = useCallback(() => {
    setJdText(''); setJdAnalysis(null); setResult(null); setTailorError(''); setActiveTab('preview'); setAtsLoading(false); setEditing(false);
    setRegenFeedback(''); setRegenerating(false); setRegenError('');
    setCoverLetter(null); setCoverLetterLoading(false);
    recordIdRef.current = null;
    atsAutoTriggered.current = false;
    setTimeout(() => jdRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }, []);

  if (loadingCheck) return <div className="space-y-4 animate-pulse"><div className="h-28 rounded-xl bg-gray-100/40 dark:bg-gray-800/40" /><div className="h-48 rounded-xl bg-gray-100/20 dark:bg-gray-800/20" /></div>;
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
  if (hasResumes === false) return <OnboardingHero onUploaded={() => setHasResumes(true)} />;

  return (
    <div className="space-y-6">
      <ResumeDashboard onStartTailoring={() => jdRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />

      {/* Step 2: Paste JD + Tailor (single action) */}
      <div ref={jdRef} className="scroll-mt-20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-white">2</span></div>
          <div><p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Paste a Job Description</p><p className="text-xs text-gray-400 dark:text-gray-500">We'll analyze requirements and tailor your resume automatically</p></div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 overflow-hidden">
          <div className="p-5 space-y-4">
            <div className="relative">
              <textarea placeholder="Paste the complete job description here..." value={jdText} onChange={e => setJdText(e.target.value)} rows={8} maxLength={10000} disabled={analyzingJD || tailoring || !!result}
                className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/60 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-600 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500/30 transition-all disabled:opacity-50" />
              <span className="absolute bottom-3 right-3 text-[10px] text-gray-400 dark:text-gray-600 tabular-nums pointer-events-none">{jdText.length.toLocaleString()} / 10,000</span>
            </div>
            <div className="flex items-center gap-3">
              {!result && !analyzingJD && !tailoring ? (
                <button onClick={handleTailoring} disabled={!jdText.trim()}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-400 dark:text-gray-500 disabled:cursor-not-allowed shadow-lg shadow-pink-500/15 hover:shadow-pink-500/25 disabled:shadow-none transition-all duration-200">
                  <SparklesIcon className="w-4 h-4" />Tailor My Resume
                </button>
              ) : result ? (
                <button onClick={handleStartNew} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:text-gray-800 dark:text-gray-200 transition-all duration-200">
                  <ArrowPathIcon className="w-4 h-4" />Tailor for a Different Job
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Progress — analyzing + tailoring combined */}
      {(analyzingJD || tailoring) && (
        <ProgressCard analyzing={analyzingJD} tailoring={tailoring} elapsed={tailorElapsed} onCancel={handleCancel} />
      )}

      {tailorError && <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4"><div className="flex items-start gap-3"><XCircleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" /><p className="text-sm text-red-300">{tailorError}</p></div></div>}

      {/* Results */}
      {result && !editing && (
        <div className="space-y-5">
          {/* Success banner */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0"><CheckCircleIcon className="w-5 h-5 text-emerald-400" /></div>
                  <div className="min-w-0"><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Resume tailored successfully!</p><p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">{result.jd_analysis.job_title}{result.jd_analysis.company && result.jd_analysis.company !== 'Not specified' ? ` at ${result.jd_analysis.company}` : ''}</p></div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-200 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-pink-500/30 hover:text-pink-300 transition-all duration-200">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                    Edit &amp; Preview
                  </button>
                  <button onClick={handleCoverLetter} disabled={coverLetterLoading || !!coverLetter}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-200 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-purple-500/30 hover:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
                    <ClipboardIcon className="w-4 h-4" />
                    {coverLetterLoading ? 'Generating...' : coverLetter ? 'Generated' : 'Cover Letter'}
                  </button>
                  <button onClick={() => handleDownload('pdf')} disabled={downloading !== null} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-400 dark:text-gray-500 disabled:cursor-not-allowed shadow-lg shadow-pink-500/15 disabled:shadow-none transition-all duration-200">
                    <DocumentArrowDownIcon className="w-4 h-4" />{downloading === 'pdf' ? 'Generating...' : 'Download PDF'}
                  </button>
                  <button onClick={() => handleDownload('docx')} disabled={downloading !== null} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:text-gray-800 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
                    <DocumentArrowDownIcon className="w-4 h-4" />{downloading === 'docx' ? 'Generating...' : 'Download DOCX'}
                  </button>
                </div>
              </div>
            </div>
            <div className="border-t border-emerald-500/10 bg-gray-50/40 dark:bg-gray-900/40 px-5 py-3 flex items-center gap-4 flex-wrap">
              <button onClick={handleStartNew} className="inline-flex items-center gap-1.5 text-xs font-medium text-pink-400 hover:text-pink-300 transition-colors"><ArrowPathIcon className="w-3.5 h-3.5" />Tailor for another job</button>
              {result.ats_scores && <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircleIcon className="w-3.5 h-3.5" />ATS Score: {result.ats_scores.overall}/100</span>}
              {atsLoading && <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-400"><span className="w-3 h-3 rounded-full border-2 border-pink-400 border-t-transparent animate-spin" />Computing ATS scores...</span>}
            </div>
          </div>

          <JDAnalysisCard jd={result.jd_analysis} defaultOpen={false} />

          {/* Tabs */}
          <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800/60 p-1 border border-gray-200 dark:border-gray-800">
            <button onClick={() => setActiveTab('preview')} className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'preview' ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/20' : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 border border-transparent'}`}>Your Tailored Resume</button>
            <button onClick={() => setActiveTab('ats')} className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${activeTab === 'ats' ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/20' : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 border border-transparent'}`}>
              ATS Score{atsLoading && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}{result.ats_scores && <span className={`ml-1 text-[10px] font-bold tabular-nums ${result.ats_scores.overall >= 80 ? 'text-emerald-400' : result.ats_scores.overall >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{result.ats_scores.overall}/100</span>}
            </button>
          </div>

          {regenJustCompleted && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-pink-500/10 border border-pink-500/20 text-sm text-pink-600 dark:text-pink-300">
              <ArrowPathIcon className="w-4 h-4 shrink-0" />
              Resume updated based on your feedback
              <button onClick={() => setRegenJustCompleted(false)} className="ml-auto text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">&times;</button>
            </div>
          )}

          {activeTab === 'preview' ? <ResumePreview resume={result.tailored_resume} /> : result.ats_scores ? <ATSPanel scores={result.ats_scores} /> : (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 p-8">
              <div className="flex flex-col items-center justify-center space-y-5">
                <div className="relative"><div className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-gray-700" /><div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" /></div>
                <div className="text-center space-y-1.5">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Analyzing ATS compatibility...</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Checking against Workday, Greenhouse, Lever, and more. Your resume is ready for download above.</p>
                </div>
              </div>
            </div>
          )}

          {/* Regenerate section */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-2.5 border-b border-gray-200 dark:border-gray-800/60">
              <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center shrink-0">
                <ArrowPathIcon className="w-4 h-4 text-pink-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Not satisfied?</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Tell us what to change and we'll regenerate your resume</p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <textarea
                placeholder="e.g., Make the summary more concise, emphasize cloud skills more, add more metrics to experience bullets..."
                value={regenFeedback}
                onChange={e => setRegenFeedback(e.target.value)}
                rows={3}
                maxLength={2000}
                disabled={regenerating}
                className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/60 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-600 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500/30 transition-all disabled:opacity-50"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400 dark:text-gray-600 tabular-nums">{regenFeedback.length} / 2,000</span>
                <div className="flex items-center gap-3">
                  {regenError && <span className="text-xs text-red-400">{regenError}</span>}
                  <button
                    onClick={handleRegenerate}
                    disabled={!regenFeedback.trim() || regenerating}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed shadow-lg shadow-pink-500/15 hover:shadow-pink-500/25 disabled:shadow-none transition-all duration-200"
                  >
                    {regenerating ? (
                      <><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Regenerating...</>
                    ) : (
                      <><ArrowPathIcon className="w-4 h-4" />Regenerate Resume</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Cover Letter */}
          {coverLetter && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                    <ClipboardIcon className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Cover Letter</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Tailored to {result.jd_analysis.job_title}{result.jd_analysis.company && result.jd_analysis.company !== 'Not specified' ? ` at ${result.jd_analysis.company}` : ''}</p>
                  </div>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(coverLetter); toast.success('Copied to clipboard'); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-all">
                  <ClipboardIcon className="w-3.5 h-3.5" />Copy
                </button>
              </div>
              <div className="px-6 py-5">
                <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{coverLetter}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Editor mode */}
      {result && editing && (
        <Suspense fallback={<div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 p-8 text-center"><span className="text-sm text-gray-400 dark:text-gray-400">Loading editor...</span></div>}>
          <ResumeEditor
            resume={result.tailored_resume}
            jdAnalysis={result.jd_analysis}
            onBack={() => setEditing(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

// ─── Page export ────────────────────────────────────────────────────────────
const NAV_ITEMS: { key: NavTab; label: string; icon: React.ReactNode }[] = [
  { key: 'tailor', label: 'Tailor', icon: <SparklesIcon className="w-4 h-4" /> },
  { key: 'batch', label: 'Batch Tailor', icon: <ClipboardIcon className="w-4 h-4" /> },
  { key: 'my-resumes', label: 'My Resumes', icon: <FileIcon className="w-4 h-4" /> },
  { key: 'tailored', label: 'Tailored Resumes', icon: <DocumentArrowDownIcon className="w-4 h-4" /> },
  { key: 'profile', label: 'Profile', icon: <UserCircleIcon className="w-4 h-4" /> },
];

export default function ResumeParser() {
  const { user } = useAuth();
  const [activeNav, setActiveNav] = useState<NavTab>('tailor');
  useVisitorTracking('resume-parser');

  return (
    <AuthGate
      title="AI Resume Tailor"
      description="Upload your resume, tailor it to any job description, and get ATS compatibility scores powered by AI."
    >
      <div className="min-h-screen bg-white dark:bg-gray-950">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-gray-200 dark:border-gray-200 dark:border-gray-800/60 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-500/40 to-transparent" />
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            {/* Top bar */}
            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                  <SparklesIcon className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Resume Tailor</h1>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <button onClick={() => window.location.href = '/home'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-all">
                  <HomeIcon className="w-4 h-4" />Home
                </button>
                <button onClick={() => setActiveNav('profile')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-all">
                  <UserCircleIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">{user?.name || user?.email?.split('@')[0] || 'Profile'}</span>
                </button>
              </div>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 -mb-px overflow-x-auto hide-scrollbar">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.key}
                  onClick={() => setActiveNav(item.key)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200 ${
                    activeNav === item.key
                      ? 'border-pink-500 text-pink-400'
                      : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 hover:border-gray-300 dark:border-gray-700'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {/* TailorTab stays mounted (hidden via CSS) so in-flight API calls survive tab switches */}
          <div className={activeNav === 'tailor' ? '' : 'hidden'}>
            <TailorTab />
          </div>
          {activeNav === 'batch' && <Suspense fallback={<div className="animate-pulse h-48 rounded-xl bg-gray-100 dark:bg-gray-800/40" />}><BatchTailor /></Suspense>}
          {activeNav === 'my-resumes' && <MyResumesTab />}
          {activeNav === 'tailored' && <TailoredResumesTab />}
          {activeNav === 'profile' && <ProfileTab />}
        </main>

        <style>{`
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
      </div>
    </AuthGate>
  );
}

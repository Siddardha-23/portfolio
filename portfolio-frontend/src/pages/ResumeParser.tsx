import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '@/lib/api';
import AuthGate from '@/components/AuthGate';
import { useAuth } from '@/contexts/AuthContext';
import ResumeDashboard from '@/components/resume/ResumeDashboard';
import type {
  TailorPipelineResult,
  TailoredFullResume,
  JDAnalysis,
  ATSScores,
} from '@/types/resume';

// ─── Icons ──────────────────────────────────────────────────────────────────

function SparklesIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function UploadCloudIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );
}

function DocumentArrowDownIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function MagnifyingGlassIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function ClipboardIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  );
}

function BriefcaseIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function CheckCircleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ExclamationIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function XCircleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function HomeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function ArrowRightOnRectIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}

// ─── Score bar component ────────────────────────────────────────────────────

function ScoreBar({ label, score, color }: { label: string; score: number; color?: string }) {
  const bg = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-gray-400">{label}</span>
        <span className={`text-xs font-semibold tabular-nums ${
          score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400'
        }`}>{score}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color || bg}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Overall score ring ─────────────────────────────────────────────────────

function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius}
          stroke="rgb(31,41,55)" strokeWidth="5" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth="5" fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

// ─── ATS Panel ──────────────────────────────────────────────────────────────

function ATSPanel({ scores }: { scores: ATSScores }) {
  return (
    <div className="space-y-5">
      {/* Overall score */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-6">
        <div className="flex items-center gap-6">
          <ScoreRing score={scores.overall} />
          <div className="flex-1">
            <p className="text-base font-semibold text-gray-100">Overall ATS Score</p>
            <p className="text-xs text-gray-500 mt-0.5">Weighted score across all dimensions</p>
            <div className="mt-3 h-2 rounded-full bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  scores.overall >= 80 ? 'bg-emerald-500' : scores.overall >= 60 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${scores.overall}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Score breakdown + Scanner scores */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-5">
          <p className="text-sm font-semibold text-gray-200 mb-4">Score Breakdown</p>
          <div className="space-y-3">
            <ScoreBar label="Keyword Match" score={scores.keyword_match} />
            <ScoreBar label="Skills Alignment" score={scores.skills_alignment} />
            <ScoreBar label="Experience Relevance" score={scores.experience_relevance} />
            <ScoreBar label="Quantifiable Impact" score={scores.quantifiable_impact} />
            <ScoreBar label="Format Score" score={scores.format_score} />
            <ScoreBar label="Section Completeness" score={scores.section_completeness} />
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-5">
          <p className="text-sm font-semibold text-gray-200 mb-4">ATS Scanner Scores</p>
          <div className="space-y-3">
            {scores.scanners && Object.entries(scores.scanners).map(([name, score]) => (
              <ScoreBar key={name} label={name.charAt(0).toUpperCase() + name.slice(1)} score={score} />
            ))}
          </div>
        </div>
      </div>

      {/* AI Screener */}
      {scores.ai_screener && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-5">
          <p className="text-sm font-semibold text-gray-200 mb-4">AI Screener Analysis</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ScoreBar label="Overall" score={scores.ai_screener.overall} color="bg-violet-500" />
            <ScoreBar label="Relevance" score={scores.ai_screener.relevance} color="bg-violet-500" />
            <ScoreBar label="Seniority Fit" score={scores.ai_screener.seniority_fit} color="bg-violet-500" />
            <ScoreBar label="Culture Fit" score={scores.ai_screener.culture_fit} color="bg-violet-500" />
          </div>
        </div>
      )}

      {/* Strengths & Suggestions */}
      <div className="grid gap-4 md:grid-cols-2">
        {scores.strengths?.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-400">Strengths</p>
            </div>
            <ul className="space-y-2">
              {scores.strengths.map((s, i) => (
                <li key={i} className="text-xs text-gray-400 flex gap-2 leading-relaxed">
                  <span className="text-emerald-500 mt-0.5 shrink-0">+</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {scores.suggestions?.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ExclamationIcon className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-semibold text-amber-400">Suggestions</p>
            </div>
            <ul className="space-y-2">
              {scores.suggestions.map((s, i) => (
                <li key={i} className="text-xs text-gray-400 flex gap-2 leading-relaxed">
                  <span className="text-amber-500 mt-0.5 shrink-0">!</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Missing keywords */}
      {scores.missing_keywords?.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-5">
          <div className="flex items-center gap-2 mb-3">
            <XCircleIcon className="w-4 h-4 text-red-400" />
            <p className="text-sm font-semibold text-gray-200">Missing Keywords</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {scores.missing_keywords.map(kw => (
              <span key={kw} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Resume preview ─────────────────────────────────────────────────────────

function ResumePreview({ resume }: { resume: TailoredFullResume }) {
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-3 mb-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-pink-400/80">{children}</h3>
      <div className="flex-1 h-px bg-gray-800" />
    </div>
  );

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 overflow-hidden">
      {/* Contact header */}
      <div className="bg-gradient-to-r from-gray-800/80 to-gray-900 px-6 py-5 border-b border-gray-800">
        <h2 className="text-lg font-bold text-gray-100">{resume.contact?.name}</h2>
        <p className="text-xs text-gray-400 mt-1">
          {[resume.contact?.phone, resume.contact?.email, resume.contact?.linkedin, resume.contact?.github]
            .filter(Boolean)
            .join('  \u00B7  ')}
        </p>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Summary */}
        {resume.summary && (
          <div>
            <SectionTitle>Summary</SectionTitle>
            <p className="text-[13px] text-gray-300 leading-relaxed">{resume.summary}</p>
          </div>
        )}

        {/* Experience */}
        {resume.experience?.length > 0 && (
          <div>
            <SectionTitle>Experience</SectionTitle>
            <div className="space-y-4">
              {resume.experience.map((exp, i) => (
                <div key={i}>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-200">
                        {exp.company}{exp.location ? `, ${exp.location}` : ''}
                      </p>
                      {exp.title && (
                        <p className="text-xs text-gray-400 italic mt-0.5">{exp.title}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-500 whitespace-nowrap shrink-0">{exp.dates}</span>
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {exp.bullets?.map((b, j) => (
                      <li key={j} className="text-[12px] text-gray-400 flex gap-2 leading-relaxed">
                        <span className="text-pink-500/40 shrink-0 mt-0.5">&bull;</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects */}
        {resume.projects?.length > 0 && (
          <div>
            <SectionTitle>Projects</SectionTitle>
            <div className="space-y-3">
              {resume.projects.map((proj, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold text-gray-200">{proj.name}</p>
                  <ul className="mt-1 space-y-1">
                    {proj.bullets?.map((b, j) => (
                      <li key={j} className="text-[12px] text-gray-400 flex gap-2 leading-relaxed">
                        <span className="text-pink-500/40 shrink-0 mt-0.5">&bull;</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Technical Skills */}
        {resume.skills && Object.keys(resume.skills).length > 0 && (
          <div>
            <SectionTitle>Technical Skills</SectionTitle>
            <div className="space-y-2">
              {Object.entries(resume.skills).map(([cat, skills]) => (
                <div key={cat} className="text-[12.5px]">
                  <span className="font-semibold text-gray-300">{cat}: </span>
                  <span className="text-gray-400">
                    {Array.isArray(skills) ? skills.join(', ') : String(skills)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {resume.education?.length > 0 && (
          <div>
            <SectionTitle>Education</SectionTitle>
            <div className="space-y-2">
              {resume.education.map((edu, i) => {
                const cleanDegree = (d: string) => {
                  if (!d) return '';
                  const parts = d.split('|').map(s => s.trim())
                    .filter(s => !/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}|\d{1,2}\/\d{4})/i.test(s));
                  return [...new Set(parts.filter(Boolean))].join(' | ').trim();
                };
                const degree = cleanDegree(edu.degree);
                return (
                  <div key={i} className="flex justify-between items-start gap-2">
                    <p className="text-[12.5px] text-gray-300">
                      <span className="font-semibold">{edu.institution}</span>
                      {degree ? ` \u2014 ${degree}` : ''}
                    </p>
                    <span className="text-[11px] text-gray-500 whitespace-nowrap shrink-0">{edu.dates}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Certifications */}
        {resume.certifications?.length > 0 && (
          <div>
            <SectionTitle>Certifications</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {resume.certifications.map((cert, i) => (
                <span key={i} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-sky-500/10 text-sky-300 border border-sky-500/15">
                  {cert}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── JD Analysis card ───────────────────────────────────────────────────────

function JDAnalysisCard({ jd }: { jd: JDAnalysis }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
            <BriefcaseIcon className="w-4 h-4 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-100">Extracted Job Requirements</p>
            <p className="text-xs text-gray-500 truncate">
              {jd.job_title}{jd.company && jd.company !== 'Not specified' ? ` at ${jd.company}` : ''}
              {jd.location && jd.location !== 'Not specified' ? ` \u2014 ${jd.location}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Skills */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2.5">Required Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {jd.required_skills?.map(s => (
                <span key={s} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/15">
                  {s}
                </span>
              ))}
              {(!jd.required_skills || jd.required_skills.length === 0) && (
                <span className="text-xs text-gray-600">None extracted</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2.5">Preferred Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {jd.preferred_skills?.map(s => (
                <span key={s} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-teal-500/10 text-teal-300 border border-teal-500/15">
                  {s}
                </span>
              ))}
              {(!jd.preferred_skills || jd.preferred_skills.length === 0) && (
                <span className="text-xs text-gray-600">None extracted</span>
              )}
            </div>
          </div>
        </div>

        {/* Responsibilities */}
        {jd.responsibilities?.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2.5">Key Responsibilities</p>
            <ul className="space-y-1.5">
              {jd.responsibilities.slice(0, 5).map((r, i) => (
                <li key={i} className="text-xs text-gray-400 flex gap-2 leading-relaxed">
                  <span className="text-gray-600 shrink-0 mt-0.5">&bull;</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Metadata */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs pt-1 border-t border-gray-800/60">
          {jd.experience_years && (
            <span className="text-gray-500">
              <span className="text-gray-400 font-medium">Experience:</span> {jd.experience_years}
            </span>
          )}
          {jd.employment_type && (
            <span className="text-gray-500">
              <span className="text-gray-400 font-medium">Type:</span> {jd.employment_type}
            </span>
          )}
          {jd.industry && (
            <span className="text-gray-500">
              <span className="text-gray-400 font-medium">Industry:</span> {jd.industry}
            </span>
          )}
        </div>

        {/* ATS Keywords */}
        {jd.keywords?.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2.5">ATS Keywords</p>
            <div className="flex flex-wrap gap-1.5">
              {jd.keywords.map(kw => (
                <span key={kw} className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-800 text-gray-400 border border-gray-700/60">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Phase helper ───────────────────────────────────────────────────────────

function getTailorPhase(secs: number): { text: string; step: number } {
  if (secs < 10) return { text: 'Analyzing job requirements...', step: 1 };
  if (secs < 30) return { text: 'Tailoring your resume...', step: 2 };
  if (secs < 60) return { text: 'Optimizing keywords...', step: 3 };
  return { text: 'Almost done, finalizing...', step: 4 };
}

// ─── Progress card ──────────────────────────────────────────────────────────

function ProgressCard({ analyzing, tailoring, elapsed, onCancel }: {
  analyzing: boolean;
  tailoring: boolean;
  elapsed: number;
  onCancel: () => void;
}) {
  const phase = tailoring ? getTailorPhase(elapsed) : { text: 'Analyzing job description...', step: 0 };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-8">
      <div className="flex flex-col items-center justify-center space-y-5">
        {/* Spinner */}
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-gray-700" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" />
        </div>

        {/* Text */}
        <div className="text-center space-y-1.5">
          <p className="text-sm font-semibold text-gray-200">{phase.text}</p>
          <p className="text-xs text-gray-500">
            {tailoring && elapsed >= 90
              ? 'Taking longer than expected \u2014 you can wait or cancel.'
              : 'This may take 30\u201360 seconds'}
          </p>
          {tailoring && elapsed > 0 && (
            <p className="text-xs text-gray-600 tabular-nums">{elapsed}s elapsed</p>
          )}
        </div>

        {/* Phase dots */}
        {tailoring && (
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`w-2 h-2 rounded-full transition-all duration-500 ${
                s <= phase.step ? 'bg-pink-400 scale-110' : 'bg-gray-700'
              }`} />
            ))}
          </div>
        )}

        {/* Cancel */}
        {tailoring && elapsed >= 90 && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 text-xs font-medium text-gray-400 border border-gray-700 rounded-lg hover:border-gray-600 hover:text-gray-300 transition-all"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step icon for onboarding ───────────────────────────────────────────────

function StepCircle({ num, icon, label, desc, active = false }: {
  num: number; icon: React.ReactNode; label: string; desc: string; active?: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center flex-1 min-w-0">
      <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-2.5 transition-all ${
        active
          ? 'bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg shadow-pink-500/20'
          : 'bg-gray-800 border border-gray-700'
      }`}>
        <span className={active ? 'text-white' : 'text-gray-500'}>{icon}</span>
      </div>
      <p className={`text-xs font-semibold mb-0.5 ${active ? 'text-gray-100' : 'text-gray-400'}`}>
        Step {num}: {label}
      </p>
      <p className="text-[11px] text-gray-500 leading-snug max-w-[160px]">{desc}</p>
    </div>
  );
}

// ─── Onboarding hero (no resumes yet) ───────────────────────────────────────

function OnboardingHero({ onUploaded }: { onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Only PDF files are accepted');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File too large (max 5 MB)');
      return;
    }
    setUploading(true);
    setUploadError('');
    const resp = await apiService.uploadResumeForParser(file);
    setUploading(false);
    if (resp.error) { setUploadError(resp.error); return; }
    onUploaded();
  }, [onUploaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center pt-4 pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 mb-4">
          <SparklesIcon className="w-3.5 h-3.5 text-pink-400" />
          <span className="text-xs font-medium text-pink-300">AI-Powered Resume Tailoring</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-3">
          Land more interviews with a<br />
          <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
            perfectly tailored resume
          </span>
        </h2>
        <p className="text-sm text-gray-400 max-w-lg mx-auto leading-relaxed">
          Upload your resume once, paste any job description, and get an
          ATS-optimized version tailored to that specific role in seconds.
        </p>
      </div>

      {/* How it works — 3 steps */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 text-center mb-5">How it works</p>
        <div className="flex items-start gap-3 sm:gap-6">
          <StepCircle num={1} active
            icon={<UploadCloudIcon className="w-5 h-5" />}
            label="Upload"
            desc="Upload your existing resume PDF"
          />
          <div className="flex items-center pt-5 shrink-0">
            <div className="w-6 sm:w-10 h-px bg-gray-700" />
            <svg className="w-3 h-3 text-gray-600 -ml-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
          <StepCircle num={2}
            icon={<ClipboardIcon className="w-5 h-5" />}
            label="Paste JD"
            desc="Paste the job description you're targeting"
          />
          <div className="flex items-center pt-5 shrink-0">
            <div className="w-6 sm:w-10 h-px bg-gray-700" />
            <svg className="w-3 h-3 text-gray-600 -ml-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
          <StepCircle num={3}
            icon={<DocumentArrowDownIcon className="w-5 h-5" />}
            label="Download"
            desc="Get your ATS-optimized resume instantly"
          />
        </div>
      </div>

      {/* Upload area */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed transition-all duration-200 ${
          dragOver
            ? 'border-pink-500/50 bg-pink-500/5'
            : 'border-gray-700/60 bg-gray-900/40 hover:border-gray-600/60'
        }`}
      >
        <div className="flex flex-col items-center text-center py-12 px-6">
          <div className="w-16 h-16 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-4">
            <UploadCloudIcon className="w-8 h-8 text-pink-400" />
          </div>
          <p className="text-base font-semibold text-gray-200 mb-1">
            Get started — upload your resume
          </p>
          <p className="text-sm text-gray-500 mb-5 max-w-sm">
            Drop your PDF here or click below. We'll parse it and prepare it for tailoring.
          </p>
          {uploading ? (
            <div className="w-full max-w-xs space-y-2">
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
              <p className="text-xs text-gray-400">Parsing your resume...</p>
            </div>
          ) : (
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 shadow-lg shadow-pink-500/15 hover:shadow-pink-500/25 transition-all duration-200">
                <UploadCloudIcon className="w-4 h-4" />
                Choose PDF File
              </span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
              />
            </label>
          )}
          <p className="text-[10px] text-gray-600 mt-3">PDF only, max 5 MB</p>
          {uploadError && <p className="text-sm text-red-400 mt-2">{uploadError}</p>}
        </div>
      </div>

      {/* Social proof / features */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: <MagnifyingGlassIcon className="w-4 h-4 text-blue-400" />, label: 'ATS Keyword Matching', desc: 'Scanned against 6+ ATS systems' },
          { icon: <SparklesIcon className="w-4 h-4 text-violet-400" />, label: 'AI-Powered Tailoring', desc: 'Optimizes content for the role' },
          { icon: <DocumentArrowDownIcon className="w-4 h-4 text-emerald-400" />, label: 'PDF & DOCX Export', desc: 'Download in any format' },
        ].map(f => (
          <div key={f.label} className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center mx-auto mb-2">
              {f.icon}
            </div>
            <p className="text-xs font-semibold text-gray-300 mb-0.5">{f.label}</p>
            <p className="text-[10px] text-gray-500">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Restart arrow icon ─────────────────────────────────────────────────────

function ArrowPathIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.016 4.656v4.992" />
    </svg>
  );
}

// ─── Dashboard (main tailoring flow) ────────────────────────────────────────

function Dashboard() {
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
  const jdSectionRef = useRef<HTMLDivElement>(null);

  const [downloading, setDownloading] = useState<'pdf' | 'docx' | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'ats'>('preview');

  const checkResumes = useCallback(async () => {
    setLoadingCheck(true);
    const resp = await apiService.listBaseResumes();
    if (resp.data) {
      setHasResumes((resp.data.versions || []).length > 0);
    } else {
      const statusResp = await apiService.getResumeStatus();
      if (statusResp.data) {
        setHasResumes(statusResp.data.has_resume === true);
      } else {
        setHasResumes(false);
      }
    }
    setLoadingCheck(false);
  }, []);

  useEffect(() => { checkResumes(); }, [checkResumes]);

  useEffect(() => {
    return () => {
      tailorAbortRef.current?.abort();
      atsAbortRef.current?.abort();
      if (tailorTimerRef.current) clearInterval(tailorTimerRef.current);
    };
  }, []);

  const handleAnalyzeJD = useCallback(async () => {
    if (!jdText.trim()) return;
    setAnalyzingJD(true);
    setTailorError('');
    setJdAnalysis(null);
    setResult(null);

    const jdResp = await apiService.extractJD(jdText.trim());
    setAnalyzingJD(false);

    if (jdResp.error) { setTailorError(jdResp.error); return; }
    const analysis = jdResp.data?.jd_analysis;
    if (!analysis) { setTailorError('Failed to analyze job description.'); return; }
    setJdAnalysis(analysis);
  }, [jdText]);

  const handleTailorResume = useCallback(async () => {
    if (!jdAnalysis) return;
    tailorAbortRef.current?.abort();
    const controller = new AbortController();
    tailorAbortRef.current = controller;

    setTailoring(true);
    setTailorElapsed(0);
    setTailorError('');

    tailorTimerRef.current = setInterval(() => {
      setTailorElapsed(prev => prev + 1);
    }, 1000);

    const tailorResp = await apiService.tailorResumeForParser(jdAnalysis, controller.signal);

    if (tailorTimerRef.current) clearInterval(tailorTimerRef.current);
    tailorTimerRef.current = null;

    if (controller.signal.aborted) {
      setTailoring(false);
      setTailorElapsed(0);
      return;
    }

    setTailoring(false);
    setTailorElapsed(0);
    if (tailorResp.error) { setTailorError(tailorResp.error); return; }
    if (tailorResp.data) {
      setResult({
        jd_analysis: jdAnalysis,
        tailored_resume: tailorResp.data.tailored_resume,
      });
    }
  }, [jdAnalysis]);

  const handleCancelTailor = useCallback(() => {
    tailorAbortRef.current?.abort();
    if (tailorTimerRef.current) clearInterval(tailorTimerRef.current);
    tailorTimerRef.current = null;
    setTailoring(false);
    setTailorElapsed(0);
  }, []);

  const handleFetchATS = useCallback(async () => {
    if (!result?.tailored_resume || !result?.jd_analysis) return;
    atsAbortRef.current?.abort();
    const controller = new AbortController();
    atsAbortRef.current = controller;

    setAtsLoading(true);
    setTailorError('');

    const resp = await apiService.fetchATSScores(
      result.tailored_resume, result.jd_analysis, controller.signal,
    );

    if (controller.signal.aborted) return;
    setAtsLoading(false);

    if (resp.error) {
      setTailorError('ATS scoring failed. Resume is still available for download.');
      return;
    }
    if (resp.data?.ats_scores) {
      setResult(prev => prev ? { ...prev, ats_scores: resp.data!.ats_scores } : prev);
    }
  }, [result]);

  const handleDownload = useCallback(async (format: 'pdf' | 'docx') => {
    if (!result) return;
    setDownloading(format);
    const resp = await apiService.downloadTailoredResume(
      result.tailored_resume, result.jd_analysis, format,
    );
    setDownloading(null);
    if (resp.error) { setTailorError(resp.error); return; }
    if (resp.data) {
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = resp.filename || `resume.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [result]);

  // Reset for new tailoring
  const handleStartNew = useCallback(() => {
    setJdText('');
    setJdAnalysis(null);
    setResult(null);
    setTailorError('');
    setActiveTab('preview');
    setAtsLoading(false);
    setTimeout(() => {
      jdSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  // Loading skeleton
  if (loadingCheck) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-28 rounded-xl bg-gray-800/40" />
        <div className="h-16 rounded-xl bg-gray-800/30" />
        <div className="h-48 rounded-xl bg-gray-800/20" />
      </div>
    );
  }

  if (!hasResumes) {
    return <OnboardingHero onUploaded={() => { setHasResumes(true); }} />;
  }

  return (
    <div className="space-y-6">
      {/* Resume Dashboard (active resume card + resume lists) */}
      <ResumeDashboard onStartTailoring={() => {
        jdSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }} />

      {/* ── Step 2: Job Description Input (always visible) ── */}
      <div ref={jdSectionRef} className="scroll-mt-20">
        {/* Section header with step indicator */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">2</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-200">Paste a Job Description</p>
            <p className="text-xs text-gray-500">We'll extract the requirements and tailor your resume to match</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/80 overflow-hidden">
          <div className="p-5 space-y-4">
            <div className="relative">
              <textarea
                placeholder="Paste the complete job description here...&#10;&#10;Example: We are looking for a Senior Software Engineer with 5+ years of experience in distributed systems, cloud infrastructure (AWS/GCP), and Python..."
                value={jdText}
                onChange={e => setJdText(e.target.value)}
                rows={8}
                maxLength={10000}
                disabled={tailoring || !!result}
                className="w-full px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/60 text-sm text-gray-200 placeholder-gray-600 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500/30 transition-all disabled:opacity-50"
              />
              <span className="absolute bottom-3 right-3 text-[10px] text-gray-600 tabular-nums pointer-events-none">
                {jdText.length.toLocaleString()} / 10,000
              </span>
            </div>
            <div className="flex items-center gap-3">
              {!result ? (
                <button
                  onClick={handleAnalyzeJD}
                  disabled={!jdText.trim() || analyzingJD || tailoring}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed shadow-lg shadow-pink-500/15 hover:shadow-pink-500/25 disabled:shadow-none transition-all duration-200"
                >
                  <MagnifyingGlassIcon className="w-4 h-4" />
                  {analyzingJD ? 'Analyzing...' : 'Analyze & Extract Requirements'}
                </button>
              ) : (
                <button
                  onClick={handleStartNew}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 hover:border-gray-600 hover:text-gray-200 transition-all duration-200"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Tailor for a Different Job
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      {(analyzingJD || tailoring) && (
        <ProgressCard
          analyzing={analyzingJD}
          tailoring={tailoring}
          elapsed={tailorElapsed}
          onCancel={handleCancelTailor}
        />
      )}

      {/* Error */}
      {tailorError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4">
          <div className="flex items-start gap-3">
            <XCircleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{tailorError}</p>
          </div>
        </div>
      )}

      {/* JD Analysis + Tailor button */}
      {jdAnalysis && !result && (
        <>
          <JDAnalysisCard jd={jdAnalysis} />

          {/* Step 3: Tailor */}
          <div className="flex items-center gap-3 mb-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">3</span>
            </div>
            <p className="text-sm font-semibold text-gray-200">Ready to tailor</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-5">
            <div className="flex items-center gap-4">
              <button
                onClick={handleTailorResume}
                disabled={tailoring}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed shadow-lg shadow-pink-500/15 hover:shadow-pink-500/25 disabled:shadow-none transition-all duration-200"
              >
                <SparklesIcon className="w-4 h-4" />
                {tailoring ? 'Tailoring...' : 'Tailor My Resume'}
              </button>
              <span className="text-xs text-gray-500">
                AI will rewrite your resume to match this job description
              </span>
            </div>
          </div>
        </>
      )}

      {/* ── Results ── */}
      {result && (
        <div className="space-y-5">
          {/* Success banner with download + actions */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-100">Resume tailored successfully!</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {result.jd_analysis.job_title}
                      {result.jd_analysis.company && result.jd_analysis.company !== 'Not specified'
                        ? ` at ${result.jd_analysis.company}` : ''}
                    </p>
                  </div>
                </div>

                {/* Download buttons */}
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleDownload('pdf')}
                    disabled={downloading !== null}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed shadow-lg shadow-pink-500/15 hover:shadow-pink-500/25 disabled:shadow-none transition-all duration-200"
                  >
                    <DocumentArrowDownIcon className="w-4 h-4" />
                    {downloading === 'pdf' ? 'Generating...' : 'Download PDF'}
                  </button>
                  <button
                    onClick={() => handleDownload('docx')}
                    disabled={downloading !== null}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 hover:border-gray-600 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    <DocumentArrowDownIcon className="w-4 h-4" />
                    {downloading === 'docx' ? 'Generating...' : 'Download DOCX'}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick actions bar */}
            <div className="border-t border-emerald-500/10 bg-gray-900/40 px-5 py-3 flex items-center gap-3">
              <button
                onClick={handleStartNew}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-pink-400 hover:text-pink-300 transition-colors"
              >
                <ArrowPathIcon className="w-3.5 h-3.5" />
                Tailor for another job
              </button>
              <span className="text-gray-700">|</span>
              {!result.ats_scores && !atsLoading && (
                <button
                  onClick={handleFetchATS}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
                >
                  <SparklesIcon className="w-3.5 h-3.5" />
                  Run ATS compatibility check
                </button>
              )}
              {result.ats_scores && (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  ATS Score: {result.ats_scores.overall}/100
                </span>
              )}
              {atsLoading && (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-3 h-3 rounded-full border-2 border-pink-400 border-t-transparent animate-spin" />
                  Computing ATS scores...
                </span>
              )}
            </div>
          </div>

          {/* JD Analysis (context) */}
          <JDAnalysisCard jd={result.jd_analysis} />

          {/* Tab toggle */}
          <div className="inline-flex rounded-xl bg-gray-800/60 p-1 border border-gray-800">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                activeTab === 'preview'
                  ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/20'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              Resume Preview
            </button>
            <button
              onClick={() => setActiveTab('ats')}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'ats'
                  ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/20'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              ATS Analysis
              {atsLoading && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
              {result.ats_scores && (
                <span className={`text-[10px] font-bold tabular-nums ${
                  result.ats_scores.overall >= 80 ? 'text-emerald-400' :
                  result.ats_scores.overall >= 60 ? 'text-amber-400' : 'text-red-400'
                }`}>{result.ats_scores.overall}</span>
              )}
            </button>
          </div>

          {/* Tab content */}
          {activeTab === 'preview' ? (
            <ResumePreview resume={result.tailored_resume} />
          ) : result.ats_scores ? (
            <ATSPanel scores={result.ats_scores} />
          ) : (
            <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-8">
              <div className="flex flex-col items-center justify-center space-y-5">
                {atsLoading ? (
                  <>
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full border-2 border-gray-700" />
                      <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" />
                    </div>
                    <div className="text-center space-y-1.5">
                      <p className="text-sm font-semibold text-gray-200">Computing ATS scores...</p>
                      <p className="text-xs text-gray-500">
                        This takes 10\u201315 seconds. Your resume is ready for download above.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center">
                      <SparklesIcon className="w-6 h-6 text-violet-400" />
                    </div>
                    <div className="text-center space-y-1.5">
                      <p className="text-sm font-semibold text-gray-200">Check ATS Compatibility</p>
                      <p className="text-xs text-gray-500 max-w-sm">
                        See how your tailored resume scores against Workday, Greenhouse, Lever, and other major ATS systems.
                      </p>
                    </div>
                    <button
                      onClick={handleFetchATS}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 shadow-lg shadow-pink-500/15 hover:shadow-pink-500/25 transition-all duration-200"
                    >
                      <SparklesIcon className="w-4 h-4" />
                      Get ATS Scores
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page export ────────────────────────────────────────────────────────────

export default function ResumeParser() {
  const { logout } = useAuth();
  return (
    <AuthGate
      title="AI Resume Tailor"
      description="Upload your resume, tailor it to any job description, and get ATS compatibility scores powered by AI."
    >
      <div className="min-h-screen bg-gray-950">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-gray-800/60 bg-gray-950/90 backdrop-blur-md">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-500/40 to-transparent" />
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                <SparklesIcon className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-bold text-gray-100">Resume Tailor</h1>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => window.location.href = '/home'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 transition-all"
              >
                <HomeIcon className="w-4 h-4" />
                Home
              </button>
              <button
                onClick={() => { logout(); window.location.href = '/home'; }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 transition-all"
              >
                <ArrowRightOnRectIcon className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <Dashboard />
        </main>
      </div>
    </AuthGate>
  );
}

import { useState } from 'react';
import {
  MapPin, Building2, Clock, DollarSign, Briefcase, ExternalLink,
  BookmarkPlus, BookmarkCheck, Sparkles, Target, FileText, Wand2, ChevronDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { JobAnalysisModal } from './JobAnalysisModal';
import { ResumeTailorModal } from './ResumeTailorModal';
import type { Job } from '@/types/jobs';

interface JobCardProps {
  job: Job;
  saved: boolean;
  jobStatus: string | null;
  onSave: () => void;
  onUnsave: () => void;
  onQuickApply: () => void;
}

function MatchScoreRing({ score }: { score: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? 'hsl(150 65% 45%)' : score >= 40 ? 'hsl(38 90% 55%)' : 'hsl(var(--destructive))';
  return (
    <div className="relative h-12 w-12 flex-shrink-0">
      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
        <circle
          cx="24" cy="24" r={radius} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums">
        {score}
      </span>
    </div>
  );
}

function buildApplyUrl(job: Job): { url: string; fallback: boolean } {
  if (job.apply_link) return { url: job.apply_link, fallback: false };
  const q = encodeURIComponent(`${job.title} ${job.company} apply`);
  return { url: `https://www.google.com/search?q=${q}`, fallback: true };
}

export function JobCard({ job, saved, jobStatus, onSave, onUnsave, onQuickApply }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisAction, setAnalysisAction] = useState<'summarize' | 'missing_skills' | 'cover_letter'>('summarize');
  const [tailorOpen, setTailorOpen] = useState(false);

  const openAnalysis = (action: typeof analysisAction) => {
    setAnalysisAction(action);
    setAnalysisOpen(true);
  };

  const apply = buildApplyUrl(job);

  return (
    <>
      <Card className="group relative flex flex-col overflow-hidden rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10">
        <CardContent className="flex flex-1 flex-col gap-3 p-5">
          {/* Header row */}
          <div className="flex items-start gap-3">
            {job.logo ? (
              <img
                src={job.logo}
                alt=""
                className="h-11 w-11 flex-shrink-0 rounded-lg border border-border/40 bg-background object-contain p-0.5"
              />
            ) : (
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/15 to-indigo-500/15 text-sm font-semibold text-purple-600 dark:text-purple-300">
                {job.company.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold leading-tight" title={job.title}>
                {job.title}
              </h3>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <Building2 className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{job.company}</span>
              </p>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{job.location}</span>
              </p>
            </div>
            <MatchScoreRing score={job.match_score} />
          </div>

          {/* Meta row (salary / type / posted / source) */}
          <div className="flex flex-wrap gap-1.5 text-[10.5px]">
            {job.tailor_feasibility && (
              <Badge
                variant="outline"
                title={job.feasibility_reason}
                className={`px-1.5 py-0 ${
                  job.tailor_feasibility === 'strong'
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : job.tailor_feasibility === 'possible'
                      ? 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                      : job.tailor_feasibility === 'stretch'
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
                }`}
              >
                {job.tailor_feasibility === 'strong' ? 'Strong fit'
                  : job.tailor_feasibility === 'possible' ? 'Tailorable'
                    : job.tailor_feasibility === 'stretch' ? 'Stretch'
                      : 'Off-target'}
              </Badge>
            )}
            {jobStatus === 'applied' && (
              <Badge className="gap-1 border border-amber-500/30 bg-amber-500/15 px-1.5 py-0 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300">
                <BookmarkCheck className="h-2.5 w-2.5" /> Applied
              </Badge>
            )}
            {jobStatus === 'interview' && (
              <Badge className="border border-blue-500/30 bg-blue-500/15 px-1.5 py-0 text-blue-700 hover:bg-blue-500/20 dark:text-blue-300">Interview</Badge>
            )}
            {job.h1b_sponsor && (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-emerald-700 dark:text-emerald-300">
                H1B
              </Badge>
            )}
            {job.contract_friendly && (
              <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 px-1.5 py-0 text-blue-700 dark:text-blue-300">
                Contract
              </Badge>
            )}
            {job.is_remote && (
              <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 px-1.5 py-0 text-sky-700 dark:text-sky-300">
                Remote
              </Badge>
            )}
            {job.salary && (
              <Badge variant="outline" className="gap-0.5 border-border/60 px-1.5 py-0 text-muted-foreground">
                <DollarSign className="h-2.5 w-2.5" /> {job.salary}
              </Badge>
            )}
            {job.employment_type && (
              <Badge variant="outline" className="gap-0.5 border-border/60 px-1.5 py-0 text-muted-foreground">
                <Briefcase className="h-2.5 w-2.5" /> {job.employment_type}
              </Badge>
            )}
            {job.posted_text && (
              <Badge variant="outline" className="gap-0.5 border-border/60 px-1.5 py-0 text-muted-foreground">
                <Clock className="h-2.5 w-2.5" /> {job.posted_text}
              </Badge>
            )}
            {job.source && (
              <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 px-1.5 py-0 text-purple-600 dark:text-purple-300">
                {job.source}
              </Badge>
            )}
          </div>

          {/* Matched skills */}
          {job.matched_skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {job.matched_skills.slice(0, 8).map(skill => (
                <span
                  key={skill}
                  className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
                >
                  {skill}
                </span>
              ))}
              {job.matched_skills.length > 8 && (
                <span className="text-[10px] text-muted-foreground">
                  +{job.matched_skills.length - 8} more
                </span>
              )}
            </div>
          )}

          {/* Expandable description */}
          {expanded && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border/40 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
              <p className="whitespace-pre-line">
                {job.description.slice(0, 1400)}
                {job.description.length > 1400 && '…'}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-fit items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-300 hover:underline"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? 'Hide description' : 'Show description'}
          </button>

          {/* Actions */}
          <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-3">
            <Button
              size="sm"
              onClick={onQuickApply}
              asChild={!job.apply_link}
              title={apply.fallback ? 'Apply link missing — opens Google search' : 'Opens career page and marks as applied'}
              className="h-8 gap-1 bg-gradient-to-r from-purple-600 to-indigo-600 px-3 text-xs text-white shadow-sm shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500 hover:shadow-purple-500/30"
            >
              {job.apply_link ? (
                <>
                  <ExternalLink className="h-3 w-3" />
                  {jobStatus === 'applied' ? 'Reopen' : 'Quick Apply'}
                </>
              ) : (
                <a href={apply.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Find Posting
                </a>
              )}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={saved ? onUnsave : onSave}
              className={`h-8 gap-1 px-2.5 text-xs ${
                saved
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
                  : 'border-border/60'
              }`}
            >
              {saved ? <BookmarkCheck className="h-3 w-3" /> : <BookmarkPlus className="h-3 w-3" />}
              {saved ? 'Saved' : 'Save'}
            </Button>

            <div className="ml-auto flex gap-0.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 px-2 text-[11px] text-muted-foreground hover:text-purple-600 dark:hover:text-purple-300"
                onClick={() => openAnalysis('summarize')}
                title="AI summary"
              >
                <Sparkles className="h-3 w-3" />
                Summary
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 px-2 text-[11px] text-muted-foreground hover:text-purple-600 dark:hover:text-purple-300"
                onClick={() => openAnalysis('missing_skills')}
                title="Skill-gap analysis"
              >
                <Target className="h-3 w-3" />
                Gaps
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 px-2 text-[11px] text-muted-foreground hover:text-purple-600 dark:hover:text-purple-300"
                onClick={() => openAnalysis('cover_letter')}
                title="Generate cover letter"
              >
                <FileText className="h-3 w-3" />
                Cover
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 px-2 text-[11px] text-muted-foreground hover:text-purple-600 dark:hover:text-purple-300"
                onClick={() => setTailorOpen(true)}
                title="Tailor resume to this role"
              >
                <Wand2 className="h-3 w-3" />
                Tailor
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <JobAnalysisModal
        open={analysisOpen}
        onOpenChange={setAnalysisOpen}
        job={job}
        action={analysisAction}
      />

      <ResumeTailorModal
        open={tailorOpen}
        onOpenChange={setTailorOpen}
        job={job}
      />
    </>
  );
}

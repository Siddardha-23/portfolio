import { useState } from 'react';
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
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? '#059669' : score >= 40 ? '#d97706' : '#dc2626';

  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/20" />
        <circle cx="22" cy="22" r={radius} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{score}</span>
    </div>
  );
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

  return (
    <>
      <Card className="overflow-hidden border-gray-200 dark:border-white/[0.07] bg-white dark:bg-gray-900/40 shadow-sm">
        <CardContent className="p-4 space-y-3">
          {/* Header row */}
          <div className="flex gap-3 items-start">
            {job.logo ? (
              <img src={job.logo} alt="" className="w-10 h-10 rounded object-contain flex-shrink-0 bg-muted" />
            ) : (
              <div className="w-10 h-10 rounded bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-200 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {job.company.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-tight truncate">{job.title}</h3>
              <p className="text-xs text-muted-foreground truncate">{job.company}</p>
              <p className="text-xs text-muted-foreground">{job.location}</p>
            </div>
            <MatchScoreRing score={job.match_score} />
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            {jobStatus === 'applied' && (
              <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 hover:bg-amber-500/15">Applied</Badge>
            )}
            {jobStatus === 'interview' && (
              <Badge className="text-[10px] px-1.5 py-0 bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25 hover:bg-blue-500/15">Interview</Badge>
            )}
            {job.h1b_sponsor && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25">H1B</Badge>}
            {job.contract_friendly && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25">Contract</Badge>}
            {job.is_remote && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25">Remote</Badge>}
            {job.salary && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-gray-200 dark:border-white/[0.1]">{job.salary}</Badge>}
            {job.employment_type && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-gray-200 dark:border-white/[0.1]">{job.employment_type}</Badge>}
            {job.source && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{job.source}</Badge>}
            {job.posted_text && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{job.posted_text}</Badge>}
          </div>

          {/* Matched skills */}
          {job.matched_skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {job.matched_skills.slice(0, 8).map(skill => (
                <span key={skill} className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                  {skill}
                </span>
              ))}
              {job.matched_skills.length > 8 && (
                <span className="text-[10px] text-muted-foreground">+{job.matched_skills.length - 8}</span>
              )}
            </div>
          )}

          {/* Expandable description */}
          {expanded && (
            <p className="text-xs text-muted-foreground whitespace-pre-line max-h-40 overflow-y-auto">
              {job.description.slice(0, 1000)}
              {job.description.length > 1000 && '...'}
            </p>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-700 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white hover:underline"
          >
            {expanded ? 'Show less' : 'Show description'}
          </button>

          {/* Actions */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Button size="sm" variant="outline" className={`h-7 text-xs ${saved ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25' : 'border-gray-200 dark:border-white/[0.1]'}`}
              onClick={saved ? onUnsave : onSave}>
              {saved ? 'Saved' : 'Save'}
            </Button>
            {job.apply_link && jobStatus !== 'applied' && (
              <Button size="sm" className="h-7 text-xs bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white"
                onClick={onQuickApply}
                title="Opens career page and marks as applied">
                Quick Apply
              </Button>
            )}
            {job.apply_link && jobStatus === 'applied' && (
              <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                <a href={job.apply_link} target="_blank" rel="noopener noreferrer">View Posting</a>
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openAnalysis('summarize')}>
              Summary
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openAnalysis('missing_skills')}>
              Gap Analysis
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openAnalysis('cover_letter')}>
              Cover Letter
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setTailorOpen(true)}>
              Tailor Resume
            </Button>
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

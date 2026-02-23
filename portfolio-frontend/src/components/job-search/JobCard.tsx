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
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444';

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
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-3">
          {/* Header row */}
          <div className="flex gap-3 items-start">
            {job.logo ? (
              <img src={job.logo} alt="" className="w-10 h-10 rounded object-contain flex-shrink-0 bg-muted" />
            ) : (
              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
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
              <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500/80 text-white hover:bg-yellow-500/80">Applied</Badge>
            )}
            {jobStatus === 'interview' && (
              <Badge className="text-[10px] px-1.5 py-0 bg-purple-500/80 text-white hover:bg-purple-500/80">Interview</Badge>
            )}
            {job.h1b_sponsor && <Badge variant="default" className="text-[10px] px-1.5 py-0">H1B</Badge>}
            {job.is_remote && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Remote</Badge>}
            {job.salary && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{job.salary}</Badge>}
            {job.employment_type && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{job.employment_type}</Badge>}
          </div>

          {/* Matched skills */}
          {job.matched_skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {job.matched_skills.slice(0, 8).map(skill => (
                <span key={skill} className="text-[10px] bg-green-500/10 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded">
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
            className="text-xs text-primary hover:underline"
          >
            {expanded ? 'Show less' : 'Show description'}
          </button>

          {/* Actions */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Button size="sm" variant={saved ? 'secondary' : 'outline'} className="h-7 text-xs"
              onClick={saved ? onUnsave : onSave}>
              {saved ? 'Saved' : 'Save'}
            </Button>
            {job.apply_link && jobStatus !== 'applied' && (
              <Button size="sm" variant="default" className="h-7 text-xs"
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

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiService } from '@/lib/api';
import type { Job } from '@/types/jobs';

interface JobAnalysisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
  action: 'summarize' | 'missing_skills' | 'cover_letter';
}

const ACTION_TITLES: Record<string, string> = {
  summarize: 'Job Summary',
  missing_skills: 'Skills Gap Analysis',
  cover_letter: 'Cover Letter',
};

export function JobAnalysisModal({ open, onOpenChange, job, action }: JobAnalysisModalProps) {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setResult('');
    setError('');
    setLoading(true);
    setCopied(false);

    apiService.analyzeJob(job, action).then(resp => {
      setLoading(false);
      if (resp.error) {
        setError(resp.error);
        return;
      }
      setResult(resp.data?.result || '');
    });
  }, [open, job.job_id, action]);

  const handleCopy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{ACTION_TITLES[action]}</DialogTitle>
          <p className="text-xs text-muted-foreground">{job.title} at {job.company}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-3">
          {loading && (
            <div className="space-y-2 p-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}

          {error && <p className="text-sm text-destructive p-2">{error}</p>}

          {result && (
            <div className="prose prose-sm dark:prose-invert max-w-none p-2 whitespace-pre-wrap text-sm">
              {result}
            </div>
          )}
        </div>

        {result && (
          <div className="flex justify-end pt-2 border-t">
            <Button size="sm" variant="outline" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

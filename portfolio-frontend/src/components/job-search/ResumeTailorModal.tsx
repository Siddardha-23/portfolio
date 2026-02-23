import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiService } from '@/lib/api';
import type { Job, TailoredResume } from '@/types/jobs';

interface ResumeTailorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
}

function formatTailoredText(t: TailoredResume): string {
  const lines: string[] = [];
  lines.push('PROFESSIONAL SUMMARY', t.summary, '');
  lines.push('SKILLS', t.skills.join(', '), '');
  lines.push('EXPERIENCE');
  t.experience_bullets.forEach(b => lines.push(`- ${b}`));
  lines.push('');
  if (t.keywords_to_add.length > 0) {
    lines.push('SUGGESTED KEYWORDS', t.keywords_to_add.join(', '));
  }
  return lines.join('\n');
}

function downloadTailoredResume(t: TailoredResume, jobTitle: string) {
  const text = formatTailoredText(t);
  // Try to extract name from localStorage visitorInfo
  let firstName = 'resume';
  let lastName = '';
  try {
    const info = JSON.parse(localStorage.getItem('visitorInfo') || '{}');
    if (info.firstName) firstName = info.firstName.toLowerCase();
    if (info.lastName) lastName = info.lastName.toLowerCase();
  } catch { /* ignore */ }

  const cleanTitle = jobTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().slice(0, 30);
  const date = new Date().toISOString().split('T')[0];
  const parts = [firstName, lastName, cleanTitle, date].filter(Boolean);
  const filename = `${parts.join('_')}.txt`;

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResumeTailorModal({ open, onOpenChange, job }: ResumeTailorModalProps) {
  const [result, setResult] = useState<TailoredResume | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError('');
    setLoading(true);
    setCopied(false);

    apiService.tailorResume(job.description).then(resp => {
      setLoading(false);
      if (resp.error) {
        setError(resp.error);
        return;
      }
      if (resp.data?.tailored) setResult(resp.data.tailored);
    });
  }, [open, job.job_id]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(formatTailoredText(result)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Tailored Resume</DialogTitle>
          <p className="text-xs text-muted-foreground">{job.title} at {job.company}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-3">
          {loading && (
            <div className="space-y-3 p-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}

          {error && <p className="text-sm text-destructive p-2">{error}</p>}

          {result && (
            <div className="space-y-3 p-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Tailored Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{result.summary}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Skills (reordered for relevance)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {result.skills.map(skill => (
                      <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Experience Bullets</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {result.experience_bullets.map((bullet, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                        <span className="text-primary mt-0.5">-</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {result.keywords_to_add.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Suggested Keywords</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {result.keywords_to_add.map(kw => (
                        <Badge key={kw} variant="outline" className="text-xs">{kw}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {result && (
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button size="sm" variant="outline" onClick={() => downloadTailoredResume(result, job.title)}>
              Download
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy All'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { SavedJob } from '@/types/jobs';

const STATUS_COLORS: Record<string, string> = {
  interested: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  applied: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  interview: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  offer: 'bg-green-500/10 text-green-700 dark:text-green-400',
  rejected: 'bg-red-500/10 text-red-700 dark:text-red-400',
  withdrawn: 'bg-muted text-muted-foreground',
};

interface SavedJobsPanelProps {
  savedJobs: SavedJob[];
  updateJobStatus: (jobId: string, status: string, notes?: string) => Promise<any>;
  unsaveJob: (jobId: string) => Promise<any>;
}

function SavedJobCard({ saved, updateJobStatus, unsaveJob }: {
  saved: SavedJob;
  updateJobStatus: SavedJobsPanelProps['updateJobStatus'];
  unsaveJob: SavedJobsPanelProps['unsaveJob'];
}) {
  const [notes, setNotes] = useState(saved.notes || '');
  const [showNotes, setShowNotes] = useState(false);
  const job = saved.job_data;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{job.title}</h3>
            <p className="text-xs text-muted-foreground">{job.company} - {job.location}</p>
          </div>
          <Badge className={`text-[10px] flex-shrink-0 ${STATUS_COLORS[saved.status] || ''}`}>
            {saved.status}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Select
            value={saved.status}
            onValueChange={v => updateJobStatus(saved.job_id, v)}
          >
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="interested">Interested</SelectItem>
              <SelectItem value="applied">Applied</SelectItem>
              <SelectItem value="interview">Interview</SelectItem>
              <SelectItem value="offer">Offer</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="withdrawn">Withdrawn</SelectItem>
            </SelectContent>
          </Select>

          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowNotes(!showNotes)}>
            {showNotes ? 'Hide Notes' : 'Notes'}
          </Button>

          {job.apply_link && (
            <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
              <a href={job.apply_link} target="_blank" rel="noopener noreferrer">Apply</a>
            </Button>
          )}

          <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive"
            onClick={() => unsaveJob(saved.job_id)}>
            Remove
          </Button>
        </div>

        {showNotes && (
          <div className="space-y-2">
            <Textarea
              placeholder="Add notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="text-xs min-h-[60px]"
            />
            <Button size="sm" className="h-7 text-xs"
              onClick={() => updateJobStatus(saved.job_id, saved.status, notes)}>
              Save Notes
            </Button>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          Saved {new Date(saved.saved_at).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
}

export function SavedJobsPanel({ savedJobs, updateJobStatus, unsaveJob }: SavedJobsPanelProps) {
  if (savedJobs.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">
        No saved jobs yet. Search and save jobs to track them here.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {savedJobs.map(saved => (
        <SavedJobCard
          key={saved.job_id}
          saved={saved}
          updateJobStatus={updateJobStatus}
          unsaveJob={unsaveJob}
        />
      ))}
    </div>
  );
}

import { useState } from 'react';
import {
  Bookmark, MapPin, Building2, ExternalLink, Trash2, StickyNote,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { SavedJob } from '@/types/jobs';

const STATUS_STYLES: Record<string, string> = {
  interested: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  applied: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  interview: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  offer: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  rejected: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400',
  withdrawn: 'border-border bg-muted text-muted-foreground',
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
    <Card className="group overflow-hidden rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm transition-all hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold" title={job.title}>
              {job.title}
            </h3>
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <Building2 className="h-3 w-3 flex-shrink-0" /> {job.company}
            </p>
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 flex-shrink-0" /> {job.location}
            </p>
          </div>
          <Badge
            variant="outline"
            className={`flex-shrink-0 text-[10px] capitalize ${STATUS_STYLES[saved.status] || ''}`}
          >
            {saved.status}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Select value={saved.status} onValueChange={v => updateJobStatus(saved.job_id, v)}>
            <SelectTrigger className="h-8 w-32 text-xs">
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

          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-xs"
            onClick={() => setShowNotes(!showNotes)}
          >
            <StickyNote className="h-3 w-3" />
            {showNotes ? 'Hide' : 'Notes'}
          </Button>

          {job.apply_link && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 border-purple-500/30 text-xs text-purple-600 hover:bg-purple-500/10 hover:text-purple-700 dark:text-purple-300 dark:hover:text-purple-200"
              asChild
            >
              <a href={job.apply_link} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                Open
              </a>
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => unsaveJob(saved.job_id)}
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </Button>
        </div>

        {showNotes && (
          <div className="space-y-2">
            <Textarea
              placeholder="Notes, interviewer names, follow-up dates…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="min-h-[70px] text-xs"
            />
            <Button
              size="sm"
              className="h-8 bg-gradient-to-r from-purple-600 to-indigo-600 text-xs text-white shadow-sm shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500"
              onClick={() => updateJobStatus(saved.job_id, saved.status, notes)}
            >
              Save notes
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
      <div className="rounded-2xl border border-dashed border-purple-500/30 bg-gradient-to-b from-purple-500/5 to-transparent py-14 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30">
          <Bookmark className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-medium">No saved jobs yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Save listings from the Listings tab to track applications here.
        </p>
      </div>
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

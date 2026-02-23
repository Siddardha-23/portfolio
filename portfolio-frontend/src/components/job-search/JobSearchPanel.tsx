import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { JobCard } from './JobCard';
import { COMPANY_CHIPS } from '@/hooks/useJobSearch';
import type { Job, SavedJob, JobSearchFilters } from '@/types/jobs';
import type { BatchMeta } from '@/hooks/useJobSearch';

interface JobSearchPanelProps {
  jobs: Job[];
  savedJobs: SavedJob[];
  filters: JobSearchFilters;
  setFilters: (f: JobSearchFilters) => void;
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
  loading: boolean;
  error: string | null;
  searchJobs: (filters?: JobSearchFilters, page?: number) => Promise<void>;
  batchSearch: (queries?: string[], overrides?: Partial<JobSearchFilters>) => Promise<void>;
  saveJob: (job: Job) => Promise<any>;
  unsaveJob: (jobId: string) => Promise<any>;
  isJobSaved: (jobId: string) => boolean;
  quickApply: (job: Job) => Promise<void>;
  getJobStatus: (jobId: string) => string | null;
  batchMeta: BatchMeta | null;
  autoSearchDone: boolean;
}

export function JobSearchPanel({
  jobs, filters, setFilters, page, totalPages,
  loading, error, searchJobs, batchSearch, saveJob, unsaveJob, isJobSaved,
  quickApply, getJobStatus, batchMeta, autoSearchDone,
}: JobSearchPanelProps) {
  const [localQuery, setLocalQuery] = useState(filters.query);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const newFilters = { ...filters, query: localQuery };
    setFilters(newFilters);
    searchJobs(newFilters, 1);
  };

  const handleCompanyChip = (company: string) => {
    const query = `${company} entry level`;
    setLocalQuery(query);
    const newFilters = { ...filters, query };
    setFilters(newFilters);
    searchJobs(newFilters, 1);
  };

  const handleRefresh = () => {
    batchSearch();
  };

  const handleTryExpanded = (datePeriod: 'today' | '3days' | 'week') => {
    const newFilters = { ...filters, date_posted: datePeriod } as JobSearchFilters;
    setFilters(newFilters);
    batchSearch(undefined, { date_posted: datePeriod });
  };

  const handlePageChange = (newPage: number) => {
    searchJobs(filters, newPage);
  };

  return (
    <div className="space-y-4">
      {/* Today's Jobs header */}
      {autoSearchDone && !loading && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              {filters.date_posted === 'today' ? "Today's Jobs" : `Jobs (${filters.date_posted})`}
            </h2>
            {jobs.length > 0 && (
              <Badge variant="secondary" className="text-xs">{jobs.length}</Badge>
            )}
            {batchMeta && batchMeta.cache_hits > 0 && (
              <span
                className="text-[10px] text-muted-foreground cursor-help"
                title={`${batchMeta.cache_hits}/${batchMeta.queries_executed} queries served from cache`}
              >
                ({batchMeta.cache_hits} cached)
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            Refresh
          </Button>
        </div>
      )}

      {/* Company chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {COMPANY_CHIPS.map(company => (
          <Button
            key={company}
            variant="outline"
            size="sm"
            className="h-7 text-xs whitespace-nowrap flex-shrink-0"
            onClick={() => handleCompanyChip(company)}
            disabled={loading}
          >
            {company}
          </Button>
        ))}
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="e.g. cloud engineer entry level"
          value={localQuery}
          onChange={e => setLocalQuery(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !localQuery.trim()}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </form>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Location</Label>
          <Input
            placeholder="e.g. United States"
            value={filters.location}
            onChange={e => setFilters({ ...filters, location: e.target.value })}
            className="w-40 h-9"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Date Posted</Label>
          <Select
            value={filters.date_posted}
            onValueChange={v => setFilters({ ...filters, date_posted: v as JobSearchFilters['date_posted'] })}
          >
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="3days">3 days</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select
            value={filters.employment_type || 'any'}
            onValueChange={v => setFilters({ ...filters, employment_type: v === 'any' ? '' : v as JobSearchFilters['employment_type'] })}
          >
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="FULLTIME">Full-time</SelectItem>
              <SelectItem value="PARTTIME">Part-time</SelectItem>
              <SelectItem value="INTERN">Intern</SelectItem>
              <SelectItem value="CONTRACTOR">Contract</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 pb-0.5">
          <Switch
            checked={filters.remote_only}
            onCheckedChange={v => setFilters({ ...filters, remote_only: v })}
            id="remote"
          />
          <Label htmlFor="remote" className="text-xs">Remote</Label>
        </div>

        <div className="flex items-center gap-2 pb-0.5">
          <Switch
            checked={filters.h1b_only}
            onCheckedChange={v => setFilters({ ...filters, h1b_only: v })}
            id="h1b"
          />
          <Label htmlFor="h1b" className="text-xs">H1B Sponsors</Label>
        </div>
      </div>

      {/* Batch errors warning */}
      {batchMeta && batchMeta.errors.length > 0 && (
        <p className="text-xs text-yellow-600 dark:text-yellow-400">
          Some queries had issues: {batchMeta.errors.length} failed
        </p>
      )}

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && jobs.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">{jobs.length} results</p>
          <div className="grid gap-4 md:grid-cols-2">
            {jobs.map(job => (
              <JobCard
                key={job.job_id}
                job={job}
                saved={isJobSaved(job.job_id)}
                jobStatus={getJobStatus(job.job_id)}
                onSave={() => saveJob(job)}
                onUnsave={() => unsaveJob(job.job_id)}
                onQuickApply={() => quickApply(job)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center text-sm text-muted-foreground px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && jobs.length === 0 && autoSearchDone && (
        <div className="text-center py-12 space-y-3">
          <p className="text-muted-foreground">
            {filters.date_posted === 'today'
              ? "No jobs posted today. Try expanding the date range."
              : "No jobs found. Try adjusting your search."}
          </p>
          {filters.date_posted === 'today' && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleTryExpanded('3days')}>
                Try 3 days
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleTryExpanded('week')}>
                Try Week
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

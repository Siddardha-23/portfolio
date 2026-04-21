import { useEffect, useState } from 'react';
import { toast } from 'sonner';
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

const SOURCE_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  google: 'Google',
  jobright: 'Jobright',
  company: 'Company',
  jsearch: 'JSearch',
};

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
  hasSearched: boolean;
  filtersLoaded: boolean;
  savingFilters: boolean;
  saveFilters: (filters?: JobSearchFilters) => Promise<any>;
}

export function JobSearchPanel({
  jobs, filters, setFilters, page, totalPages,
  loading, error, searchJobs, batchSearch, saveJob, unsaveJob, isJobSaved,
  quickApply, getJobStatus, batchMeta, hasSearched, filtersLoaded, savingFilters, saveFilters,
}: JobSearchPanelProps) {
  const [localQuery, setLocalQuery] = useState(filters.query);

  useEffect(() => {
    setLocalQuery(filters.query);
  }, [filters.query]);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const newFilters = { ...filters, query: localQuery };
    setFilters(newFilters);
    searchJobs(newFilters, 1);
  };

  const handleCompanyChip = (company: string) => {
    const query = `${company} entry level new grad h1b sponsor`;
    setLocalQuery(query);
    setFilters({ ...filters, query });
  };

  const handleRefresh = () => {
    batchSearch();
  };

  const handleSaveFilters = async () => {
    const nextFilters = { ...filters, query: localQuery };
    setFilters(nextFilters);
    const resp = await saveFilters(nextFilters);
    if (resp.error) {
      toast.error(resp.error);
      return;
    }
    toast.success('Filters saved');
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
    <div className="space-y-5">
      {/* Fresh jobs header */}
      {hasSearched && !loading && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {filters.date_posted === 'today' ? 'Fresh Job Opportunities' : `Job Opportunities (${filters.date_posted})`}
            </h2>
            {jobs.length > 0 && (
              <Badge variant="outline" className="text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-white/[0.1]">{jobs.length}</Badge>
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

      <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-gray-900/40 p-4 space-y-4 shadow-sm">
        {/* Company chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {COMPANY_CHIPS.map(company => (
            <Button
              key={company}
              variant="outline"
              size="sm"
              className="h-7 text-xs whitespace-nowrap flex-shrink-0 rounded-full border-gray-200 bg-gray-50 text-gray-700 hover:bg-white hover:text-gray-900 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
              onClick={() => handleCompanyChip(company)}
              disabled={loading}
            >
              {company}
            </Button>
          ))}
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="e.g. software engineer new grad h1b sponsor"
            value={localQuery}
            onChange={e => setLocalQuery(e.target.value)}
            className="flex-1"
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white"
              disabled={loading || !localQuery.trim() || !filtersLoaded}
            >
              {loading ? 'Searching...' : 'Search'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-gray-200 dark:border-white/[0.1]"
              disabled={loading || savingFilters || !filtersLoaded}
              onClick={handleSaveFilters}
            >
              {savingFilters ? 'Saving...' : 'Save Filters'}
            </Button>
          </div>
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
                <SelectItem value="today">Last 24 hours</SelectItem>
                <SelectItem value="3days">3 days</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Source</Label>
            <Select
              value={filters.source}
              onValueChange={v => setFilters({ ...filters, source: v as JobSearchFilters['source'] })}
            >
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="indeed">Indeed</SelectItem>
                <SelectItem value="google">Google Jobs</SelectItem>
                <SelectItem value="jobright">Jobright</SelectItem>
                <SelectItem value="jsearch">JSearch (RapidAPI)</SelectItem>
                <SelectItem value="company">Company sites</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Experience</Label>
            <Select
              value={filters.experience_level || 'any'}
              onValueChange={v => setFilters({ ...filters, experience_level: v === 'any' ? '' : v as JobSearchFilters['experience_level'] })}
            >
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="entry">New grad / entry</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
                <SelectItem value="associate">Associate</SelectItem>
                <SelectItem value="mid">Mid-level</SelectItem>
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

          <div className="flex items-center gap-2 pb-0.5">
            <Switch
              checked={filters.visa_or_contract}
              onCheckedChange={v => setFilters({ ...filters, visa_or_contract: v })}
              id="visa-contract"
            />
            <Label htmlFor="visa-contract" className="text-xs">H1B or Contract</Label>
          </div>

          <div className="flex items-center gap-2 pb-0.5">
            <Switch
              checked={filters.use_resume_recommendations}
              onCheckedChange={v => setFilters({ ...filters, use_resume_recommendations: v })}
              id="resume-match"
            />
            <Label htmlFor="resume-match" className="text-xs">Resume Match</Label>
          </div>

          <div className="flex items-center gap-2 pb-0.5">
            <Switch
              checked={filters.include_company_careers}
              onCheckedChange={v => setFilters({ ...filters, include_company_careers: v })}
              id="company-sites"
            />
            <Label htmlFor="company-sites" className="text-xs">Company Sites</Label>
          </div>
        </div>
      </div>

      {/* Per-source counts */}
      {batchMeta && batchMeta.sources && Object.keys(batchMeta.sources).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(batchMeta.sources)
            .sort((a, b) => b[1] - a[1])
            .map(([src, count]) => (
              <Badge
                key={src}
                variant="outline"
                className="text-[10px] font-normal bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08]"
              >
                {SOURCE_LABELS[src] || src} · {count}
              </Badge>
            ))}
        </div>
      )}

      {/* Batch errors warning */}
      {batchMeta && batchMeta.errors.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300" title={batchMeta.errors.join('\n')}>
          Some sources had issues: {batchMeta.errors.length} failed
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
      {!loading && jobs.length === 0 && hasSearched && (
        <div className="text-center py-12 space-y-3">
          <p className="text-muted-foreground">
            {batchMeta && batchMeta.errors.length > 0
              ? "No displayable jobs after the selected filters. Some sources also returned errors."
              : filters.date_posted === 'today'
              ? "No jobs found in the last 24 hours. Try expanding the date range."
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

      {!loading && jobs.length === 0 && !hasSearched && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-white/[0.12] bg-gray-50/80 dark:bg-gray-900/30 text-center py-12 px-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No search has been run yet.
          </p>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Search, Sparkles, MapPin, CalendarDays, SlidersHorizontal,
  Briefcase, Filter, RotateCcw, Save, Globe, AlertCircle,
} from 'lucide-react';
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
  workday: 'Workday',
  indeed: 'Indeed',
  google: 'Google Jobs',
  jobright: 'Jobright',
  company: 'Company Sites',
  jsearch: 'JSearch (RapidAPI)',
};

const INPUT_ACCENT = 'focus-visible:border-purple-500/40 focus-visible:ring-purple-500/40';
const SELECT_ACCENT = 'focus:border-purple-500/40 focus:ring-purple-500/40';

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
  const [showFilters, setShowFilters] = useState(true);

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

  const totalFromSources = batchMeta?.sources
    ? Object.values(batchMeta.sources).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-5">
      {/* Results header */}
      {hasSearched && !loading && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/15 to-indigo-500/15 text-purple-600 dark:text-purple-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold leading-tight">
                {filters.date_posted === 'today' ? 'Fresh — last 24 hours' : `Last ${filters.date_posted === 'all' ? 'any time' : filters.date_posted}`}
              </h3>
              <p className="text-xs text-muted-foreground">
                {jobs.length > 0 ? `${jobs.length} ranked matches` : 'No matches yet'}
                {batchMeta && batchMeta.cache_hits > 0 && (
                  <span className="ml-1 text-purple-500/80 dark:text-purple-400/80">· {batchMeta.cache_hits} cached</span>
                )}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="gap-1.5 border-purple-500/30 text-purple-600 hover:bg-purple-500/10 hover:text-purple-700 dark:text-purple-300 dark:hover:text-purple-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Refresh all sources
          </Button>
        </div>
      )}

      {/* Search panel */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm backdrop-blur-sm">
        <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-purple-500/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" aria-hidden />
        <div className="relative space-y-4">
          {/* Company chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {COMPANY_CHIPS.map(company => (
              <button
                key={company}
                type="button"
                onClick={() => handleCompanyChip(company)}
                disabled={loading}
                className="flex h-7 flex-shrink-0 items-center rounded-full border border-border/60 bg-background/80 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-300 disabled:opacity-50 whitespace-nowrap"
              >
                {company}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="e.g. software engineer new grad h1b sponsor"
                value={localQuery}
                onChange={e => setLocalQuery(e.target.value)}
                className={`h-10 pl-9 ${INPUT_ACCENT}`}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                className="h-10 gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 px-5 text-white shadow-sm shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500 hover:shadow-purple-500/30"
                disabled={loading || !localQuery.trim() || !filtersLoaded}
              >
                <Search className="h-3.5 w-3.5" />
                {loading ? 'Searching…' : 'Search'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => setShowFilters(!showFilters)}
                title={showFilters ? 'Hide filters' : 'Show filters'}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-1.5"
                disabled={loading || savingFilters || !filtersLoaded}
                onClick={handleSaveFilters}
              >
                <Save className="h-3.5 w-3.5" />
                {savingFilters ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>

          {/* Filters */}
          {showFilters && (
            <div className="grid gap-3 border-t border-border/60 pt-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <MapPin className="h-3 w-3" /> Location
                </Label>
                <Input
                  placeholder="United States"
                  value={filters.location}
                  onChange={e => setFilters({ ...filters, location: e.target.value })}
                  className={`h-9 ${INPUT_ACCENT}`}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <CalendarDays className="h-3 w-3" /> Date Posted
                </Label>
                <Select
                  value={filters.date_posted}
                  onValueChange={v => setFilters({ ...filters, date_posted: v as JobSearchFilters['date_posted'] })}
                >
                  <SelectTrigger className={`h-9 ${SELECT_ACCENT}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Last 24 hours</SelectItem>
                    <SelectItem value="3days">3 days</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Globe className="h-3 w-3" /> Source
                </Label>
                <Select
                  value={filters.source}
                  onValueChange={v => setFilters({ ...filters, source: v as JobSearchFilters['source'] })}
                >
                  <SelectTrigger className={`h-9 ${SELECT_ACCENT}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="workday">Workday</SelectItem>
                    <SelectItem value="indeed">Indeed</SelectItem>
                    <SelectItem value="google">Google Jobs</SelectItem>
                    <SelectItem value="jsearch">JSearch (RapidAPI)</SelectItem>
                    <SelectItem value="jobright">Jobright</SelectItem>
                    <SelectItem value="company">Company sites</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Briefcase className="h-3 w-3" /> Experience
                </Label>
                <Select
                  value={filters.experience_level || 'any'}
                  onValueChange={v => setFilters({ ...filters, experience_level: v === 'any' ? '' : v as JobSearchFilters['experience_level'] })}
                >
                  <SelectTrigger className={`h-9 ${SELECT_ACCENT}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="entry">New grad / entry</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                    <SelectItem value="associate">Associate</SelectItem>
                    <SelectItem value="mid">Mid-level</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Filter className="h-3 w-3" /> Type
                </Label>
                <Select
                  value={filters.employment_type || 'any'}
                  onValueChange={v => setFilters({ ...filters, employment_type: v === 'any' ? '' : v as JobSearchFilters['employment_type'] })}
                >
                  <SelectTrigger className={`h-9 ${SELECT_ACCENT}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="FULLTIME">Full-time</SelectItem>
                    <SelectItem value="PARTTIME">Part-time</SelectItem>
                    <SelectItem value="INTERN">Intern</SelectItem>
                    <SelectItem value="CONTRACTOR">Contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:col-span-3 flex flex-wrap items-center gap-x-5 gap-y-2 pt-2">
                <ToggleRow
                  id="remote"
                  label="Remote only"
                  checked={filters.remote_only}
                  onChange={v => setFilters({ ...filters, remote_only: v })}
                />
                <ToggleRow
                  id="h1b"
                  label="H1B sponsors"
                  checked={filters.h1b_only}
                  onChange={v => setFilters({ ...filters, h1b_only: v })}
                />
                <ToggleRow
                  id="visa-contract"
                  label="H1B or contract"
                  checked={filters.visa_or_contract}
                  onChange={v => setFilters({ ...filters, visa_or_contract: v })}
                />
                <ToggleRow
                  id="resume-match"
                  label="Resume match"
                  checked={filters.use_resume_recommendations}
                  onChange={v => setFilters({ ...filters, use_resume_recommendations: v })}
                />
                <ToggleRow
                  id="company-sites"
                  label="Workday/company sites"
                  checked={filters.include_company_careers}
                  onChange={v => setFilters({ ...filters, include_company_careers: v })}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Per-source breakdown */}
      {batchMeta && (batchMeta.sources || batchMeta.pending?.length) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-1">Sources</span>
          {batchMeta.sources && Object.entries(batchMeta.sources)
            .sort((a, b) => b[1] - a[1])
            .map(([src, count]) => (
              <Badge
                key={src}
                variant="outline"
                className={`gap-1 text-[10px] font-normal ${count > 0 ? 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300' : 'border-border text-muted-foreground'}`}
              >
                <span className="font-medium">{SOURCE_LABELS[src] || src}</span>
                <span className="opacity-70">·</span>
                <span>{count}</span>
              </Badge>
            ))}
          {batchMeta.pending?.map(src => (
            <Badge
              key={`pending-${src}`}
              variant="outline"
              className="gap-1 border-dashed border-purple-400/40 bg-purple-500/5 text-[10px] font-normal text-purple-500 dark:text-purple-300"
            >
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-purple-500" />
              <span className="font-medium">{SOURCE_LABELS[src] || src}</span>
              <span className="opacity-70">· loading</span>
            </Badge>
          ))}
          {totalFromSources > jobs.length && (
            <span className="text-[10px] text-muted-foreground">
              ({totalFromSources - jobs.length} duplicates merged)
            </span>
          )}
        </div>
      )}

      {/* Batch errors warning */}
      {batchMeta && batchMeta.errors.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200"
          title={batchMeta.errors.join('\n')}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <div>
            <p className="font-medium">{batchMeta.errors.length} source{batchMeta.errors.length === 1 ? '' : 's'} had issues</p>
            <p className="text-[11px] opacity-80">Results from other sources are still shown. Hover to see details.</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && jobs.length > 0 && (
        <>
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

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center px-3 text-sm text-muted-foreground">
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
        <div className="rounded-2xl border border-dashed border-purple-500/30 bg-gradient-to-b from-purple-500/5 to-transparent py-14 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/15 to-indigo-500/15 text-purple-600 dark:text-purple-300">
            <Search className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            {batchMeta && batchMeta.errors.length > 0
              ? 'No listings made it past your filters. Some sources also errored.'
              : filters.date_posted === 'today'
              ? 'Nothing posted in the last 24 hours for this query.'
              : 'No jobs match this query. Try loosening the filters.'}
          </p>
          {filters.date_posted === 'today' && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleTryExpanded('3days')}>Try 3 days</Button>
              <Button variant="outline" size="sm" onClick={() => handleTryExpanded('week')}>Try week</Button>
            </div>
          )}
        </div>
      )}

      {!loading && jobs.length === 0 && !hasSearched && (
        <div className="rounded-2xl border border-dashed border-purple-500/30 bg-gradient-to-b from-purple-500/5 to-transparent py-14 text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium">Ready when you are</p>
          <p className="text-xs text-muted-foreground">
            Run a search or click <span className="text-purple-600 dark:text-purple-300 font-medium">Refresh all sources</span> after searching once to pull fresh listings.
          </p>
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  id, label, checked, onChange,
}: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-600 data-[state=checked]:to-indigo-600"
      />
      <Label htmlFor={id} className="cursor-pointer text-xs text-foreground/80">{label}</Label>
    </div>
  );
}

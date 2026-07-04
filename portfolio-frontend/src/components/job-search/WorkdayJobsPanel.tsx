import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2, Factory, Loader2, MapPin, RefreshCw, Rocket, Search,
  Sparkles, Wand2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { ChipsInput } from '@/components/job-search/ChipsInput';
import { JobCard } from '@/components/job-search/JobCard';
import { apiService } from '@/lib/api';
import type {
  Job, WorkdayCatalog, WorkdayJob, WorkdayJobsProgress, WorkdayJobsResult,
  WorkdayRecency,
} from '@/types/jobs';

// Workday reports posting age at day granularity ("Posted Today" /
// "Posted N Days Ago"), so windows are calendar-day based: "1 day" =
// today + yesterday. Top matches carry the exact posting date from the
// job-detail API. "custom" lets the user pick any 0-30 day window.
const RECENCY_OPTIONS: Array<{ key: WorkdayRecency; label: string; maxDays: number }> = [
  { key: 'today', label: 'Today', maxDays: 0 },
  { key: '24h', label: '1 day', maxDays: 1 },
  { key: '3d', label: '3 days', maxDays: 3 },
  { key: '7d', label: '7 days', maxDays: 7 },
  { key: '30d', label: '30 days', maxDays: 30 },
];

type RecencyChoice = WorkdayRecency | 'custom';

const INDUSTRY_LABELS: Record<string, string> = {
  fintech: 'Fintech',
  healthtech: 'Healthtech',
  banking: 'Banking',
  ecommerce_retail: 'Ecommerce / Retail',
  insurance: 'Insurance',
  tech: 'Tech',
  manufacturing_automotive: 'Manufacturing / Auto',
  pharma: 'Pharma',
  telecom: 'Telecom',
  consulting: 'Consulting',
  energy: 'Energy',
};

interface WorkdayJobsPanelProps {
  isJobSaved: (jobId: string) => boolean;
  getJobStatus: (jobId: string) => string | null;
  saveJob: (job: Job) => void;
  unsaveJob: (jobId: string) => void;
  quickApply: (job: Job) => void;
}

export function WorkdayJobsPanel({
  isJobSaved, getJobStatus, saveJob, unsaveJob, quickApply,
}: WorkdayJobsPanelProps) {
  // ── Controls ────────────────────────────────────────────────────────────
  const [titles, setTitles] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [recency, setRecency] = useState<RecencyChoice>('3d');
  const [customDays, setCustomDays] = useState(2);
  const [groupByCompany, setGroupByCompany] = useState(false);
  // The backend returns up to 1500 scored roles — render incrementally so
  // wide windows don't mount a thousand JobCards at once.
  const PAGE_SIZE = 90;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // ── Data ────────────────────────────────────────────────────────────────
  const [catalog, setCatalog] = useState<WorkdayCatalog | null>(null);
  const [result, setResult] = useState<WorkdayJobsResult | null>(null);
  const [progress, setProgress] = useState<WorkdayJobsProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeTitles, setResumeTitles] = useState<string[]>([]);

  // Catalog metadata (industry chips) + resume titles prefill, once on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [cat, resume] = await Promise.all([
        apiService.getWorkdayCatalog(),
        apiService.getResume(),
      ]);
      if (cancelled) return;
      if (cat.data) setCatalog(cat.data);
      const fromResume = resume.data?.resume?.job_titles ?? [];
      if (fromResume.length) {
        setResumeTitles(fromResume);
        setTitles((prev) => (prev.length ? prev : fromResume.slice(0, 8)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearch = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    setProgress(null);
    const resp = await apiService.searchWorkdayJobs(
      {
        titles,
        industries,
        location,
        remote_only: remoteOnly,
        force_refresh: forceRefresh,
      },
      (partial) => {
        if (partial?.progress) setProgress(partial.progress);
        // Matches stream in company-by-company — render them immediately
        // while the scan keeps running (final payload replaces this slice).
        if (partial?.jobs?.length) {
          setResult((prev) => ({
            ok: true,
            generated_at: prev?.generated_at ?? '',
            jobs: partial.jobs,
            total: partial.total ?? partial.jobs.length,
            window_counts: prev?.window_counts ?? { today: 0, d1: 0, d3: 0, d7: 0, d30: 0 },
            query_terms: partial.query_terms ?? prev?.query_terms ?? [],
            tenants_total: partial.progress?.tenants_total ?? prev?.tenants_total ?? 0,
            tenants_done: partial.progress?.tenants_done ?? 0,
            tenants_with_results: prev?.tenants_with_results ?? 0,
            industries_available: prev?.industries_available ?? [],
            cache_hit: false,
            errors: [],
            streaming: true,
          }));
        }
      },
    );
    setLoading(false);
    setProgress(null);
    if (resp.error) {
      setError(resp.error);
      return;
    }
    if (resp.data) setResult(resp.data);
  }, [titles, industries, location, remoteOnly]);

  // Smart-suggest resume-derived titles (same LLM synthesizer the Daily
  // Pipeline's Smart Filters use).
  const smartSuggest = useCallback(async () => {
    setSuggesting(true);
    const resp = await apiService.suggestPipelineFilters();
    setSuggesting(false);
    const suggested = resp.data?.suggestions?.workday_titles ?? [];
    if (suggested.length) {
      setTitles((prev) => {
        const seen = new Set(prev.map((t) => t.toLowerCase()));
        return [...prev, ...suggested.filter((t) => !seen.has(t.toLowerCase()))].slice(0, 20);
      });
    }
  }, []);

  const toggleIndustry = (key: string) => {
    setIndustries((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  // ── Client-side recency filtering (the backend always returns the full
  //    30-day window, so switching Today ↔ 30d never refetches). ───────────
  const maxDays = recency === 'custom'
    ? Math.min(30, Math.max(0, customDays))
    : (RECENCY_OPTIONS.find((o) => o.key === recency)?.maxDays ?? 3);
  const visibleJobs = useMemo(() => {
    const all = result?.jobs ?? [];
    return all.filter((j) => j.days_ago != null && j.days_ago <= maxDays);
  }, [result, maxDays]);

  // Reset incremental rendering whenever the visible set changes shape.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [recency, customDays, groupByCompany, result]);
  const renderedJobs = useMemo(
    () => visibleJobs.slice(0, visibleCount),
    [visibleJobs, visibleCount],
  );
  const hasMore = visibleJobs.length > renderedJobs.length;

  const recencyCounts = useMemo(() => {
    const all = result?.jobs ?? [];
    const counts: Record<WorkdayRecency, number> = { today: 0, '24h': 0, '3d': 0, '7d': 0, '30d': 0 };
    for (const j of all) {
      if (j.days_ago == null) continue;
      for (const opt of RECENCY_OPTIONS) {
        if (j.days_ago <= opt.maxDays) counts[opt.key] += 1;
      }
    }
    return counts;
  }, [result]);

  const grouped = useMemo(() => {
    if (!groupByCompany) return null;
    const map = new Map<string, WorkdayJob[]>();
    for (const j of renderedJobs) {
      const list = map.get(j.company) ?? [];
      list.push(j);
      map.set(j.company, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [groupByCompany, renderedJobs]);

  const catalogTotal = catalog?.total ?? 0;
  const selectedTenantCount = useMemo(() => {
    if (!catalog) return 0;
    if (!industries.length) return catalog.total;
    return catalog.industries
      .filter((i) => industries.includes(i.key))
      .reduce((n, i) => n + i.count, 0);
  }, [catalog, industries]);

  return (
    <div className="space-y-6">
      {/* ── Controls card ── */}
      <Card className="rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm">
        <CardContent className="space-y-5 p-5">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Search className="h-3.5 w-3.5" />
              Role titles
              <span className="font-normal">— prefilled from your resume</span>
            </p>
            <ChipsInput
              values={titles}
              onChange={setTitles}
              maxItems={20}
              placeholder="e.g. Backend Engineer, Data Engineer…"
              defaultValues={resumeTitles.length ? resumeTitles.slice(0, 8) : undefined}
              helperText="The first 3 core title families drive the Workday search; every title participates in ranking."
              emptyState="Add a role title, or upload a resume to prefill."
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={smartSuggest}
              disabled={suggesting}
              className="mt-1 gap-1 px-2 text-[11px] text-purple-600 dark:text-purple-300"
            >
              {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              {suggesting ? 'Analyzing resume…' : 'Smart-suggest titles from resume'}
            </Button>
          </div>

          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Factory className="h-3.5 w-3.5" />
              Industries
              <span className="font-normal">
                — {industries.length ? `${selectedTenantCount} companies selected` : `all ${catalogTotal} companies`}
              </span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(catalog?.industries ?? []).map((ind) => {
                const active = industries.includes(ind.key);
                return (
                  <button
                    key={ind.key}
                    type="button"
                    onClick={() => toggleIndustry(ind.key)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      active
                        ? 'border-purple-500/50 bg-purple-500/15 text-purple-700 dark:text-purple-300'
                        : 'border-border/60 text-muted-foreground hover:border-purple-500/30 hover:text-purple-600 dark:hover:text-purple-300'
                    }`}
                  >
                    {INDUSTRY_LABELS[ind.key] ?? ind.key}
                    <span className="ml-1 opacity-60">{ind.count}</span>
                  </button>
                );
              })}
              {!catalog && (
                <span className="text-xs italic text-muted-foreground">Loading catalog…</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px] flex-1">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                Location
              </p>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Anywhere in the US — e.g. Texas, Austin, Remote"
                className="border-gray-200 bg-white/80 dark:border-white/10 dark:bg-gray-950/60"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs font-medium text-muted-foreground">
              <Switch checked={remoteOnly} onCheckedChange={setRemoteOnly} />
              Remote only
            </label>
            <div className="flex gap-2 pb-0.5">
              <Button
                onClick={() => void runSearch(false)}
                disabled={loading}
                className="gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {loading ? 'Scanning…' : 'Search Workday'}
              </Button>
              {result && (
                <Button
                  variant="outline"
                  onClick={() => void runSearch(true)}
                  disabled={loading}
                  title="Bypass the cached result and re-scan every company"
                  className="gap-1.5 border-border/60"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              )}
            </div>
          </div>

          {loading && (
            <div className="space-y-1.5 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-purple-500" />
                  {progress?.phase === 'details'
                    ? 'Fetching full descriptions for top matches — refining skill scores…'
                    : progress
                      ? `Scanned ${progress.tenants_done} of ${progress.tenants_total} companies — ${progress.jobs_found} postings so far (matches stream in below)`
                      : 'Querying Workday career sites directly (no scraping, no credits)…'}
                </span>
              </div>
              <Progress
                value={progress ? (progress.tenants_done / Math.max(1, progress.tenants_total)) * 100 : 8}
                className="h-1.5"
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Results ── */}
      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Recency segmented control — filters the cached 30-day set
                client-side, so switching windows is instant. */}
            <div className="flex items-center gap-1.5">
              <div className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5">
                {RECENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setRecency(opt.key)}
                    className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
                      recency === opt.key
                        ? 'bg-background text-purple-600 shadow-sm dark:text-purple-300'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                    <span className="ml-1 tabular-nums opacity-60">{recencyCounts[opt.key]}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRecency('custom')}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    recency === 'custom'
                      ? 'bg-background text-purple-600 shadow-sm dark:text-purple-300'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Custom
                </button>
              </div>
              {recency === 'custom' && (
                <label className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    value={customDays}
                    onChange={(e) => setCustomDays(Number(e.target.value))}
                    className="h-8 w-16 border-gray-200 bg-white/80 text-xs dark:border-white/10 dark:bg-gray-950/60"
                  />
                  days
                </label>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Switch checked={groupByCompany} onCheckedChange={setGroupByCompany} />
                Group by company
              </label>
              <Badge variant="outline" className="gap-1 border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300">
                <Sparkles className="h-3 w-3" />
                {visibleJobs.length} roles
              </Badge>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {result.streaming
              ? `Streaming — ${result.tenants_done} of ${result.tenants_total} companies scanned, best matches so far below`
              : <>Matched {result.tenants_with_results} of {result.tenants_total} companies
                {result.cache_hit ? ' · served from cache — Refresh to re-scan' : ''}
                {result.query_terms.length ? ` · searched: ${result.query_terms.join(', ')}` : ''}
                {result.errors.length > 0 ? ` · ${result.errors.length} source warnings` : ''}</>}
          </p>

          {visibleJobs.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-border/60">
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                <Building2 className="mx-auto mb-3 h-8 w-8 opacity-40" />
                No postings in this window.
                {maxDays < 30
                  ? ' Try widening the recency filter — the full 30-day set is already loaded.'
                  : ' Try adding broader titles or clearing the industry filter.'}
              </CardContent>
            </Card>
          ) : grouped ? (
            <div className="space-y-6">
              {grouped.map(([company, jobs]) => (
                <div key={company} className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Building2 className="h-4 w-4 text-purple-500" />
                    {company}
                    <Badge variant="outline" className="text-[10px]">{jobs.length}</Badge>
                    {jobs[0]?.industry && (
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {INDUSTRY_LABELS[jobs[0].industry] ?? jobs[0].industry}
                      </span>
                    )}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {jobs.map((job) => (
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
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {renderedJobs.map((job) => (
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
          )}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="gap-1.5 border-border/60"
              >
                Show more ({visibleJobs.length - renderedJobs.length} remaining)
              </Button>
            </div>
          )}
        </div>
      )}

      {!result && !loading && (
        <Card className="rounded-2xl border-dashed border-border/60">
          <CardContent className="p-10 text-center">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-purple-500/40" />
            <p className="text-sm font-medium">
              Search {catalogTotal ? `${catalogTotal} ` : ''}Workday career sites directly
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              70%+ of large enterprises hire through Workday. This tab queries each
              company&apos;s public careers API directly — fast, free, and fresh. Defaults
              to roles posted in the last 3 days; the full 30-day window loads in one scan.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

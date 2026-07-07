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

const SENIORITY_OPTIONS = [
  { key: 'any', label: 'Any seniority' },
  { key: 'intern', label: 'Intern' },
  { key: 'entry', label: 'Entry / Junior' },
  { key: 'mid', label: 'Mid-level' },
  { key: 'senior', label: 'Senior+' },
] as const;

const MIN_SCORE_OPTIONS = [0, 40, 60, 80] as const;

const STATE_CODES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]);
const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX',
  utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  'washington, d.c.': 'DC', 'district of columbia': 'DC',
};

/** Title-based seniority, mirroring the backend classifier — used as a
 *  fallback for streamed provisional rows that don't carry the field yet,
 *  so the seniority filter works mid-scan too. */
function seniorityOf(j: WorkdayJob): string {
  if (j.seniority) return j.seniority;
  const t = (j.title || '').toLowerCase();
  if (/\b(intern|internship|co-?op)\b/.test(t)) return 'intern';
  if (/\b(senior|sr\.?|staff|principal|lead|architect|director|manager|head|vp|iii|iv)\b/.test(t)) return 'senior';
  if (/\b(junior|jr\.?|associate|entry|new grad|graduate|early career|i|1)\b/.test(t)) return 'entry';
  return 'mid';
}

/** Bucket a posted location string into a dropdown key (state code,
 *  Remote, Multiple, US-wide, Other). */
function locationKeyOf(job: WorkdayJob): string {
  const loc = (job.location || '').trim();
  if (job.is_remote || /remote/i.test(loc)) return 'Remote';
  if (/location/i.test(loc)) return 'Multiple';
  const codeMatch = loc.toUpperCase().match(/(?:^|[\s,\-(])([A-Z]{2})(?:$|[\s,\-.)])/);
  if (codeMatch && STATE_CODES.has(codeMatch[1])) return codeMatch[1];
  const lower = loc.toLowerCase();
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (lower.includes(name)) return code;
  }
  if (lower.includes('united states') || lower.includes('usa')) return 'US-wide';
  return loc ? 'Other' : 'US-wide';
}

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
  media: 'Media',
  aerospace_defense: 'Aerospace / Defense',
  gaming: 'Gaming',
  other: 'Other',
};

// Panel setup persists per browser so reopening the tab restores titles and
// filters instantly — the resume fetch only refreshes the Reset defaults.
// The Workday and Career Pages tabs each keep their own saved setup.
const PREFS_KEYS = {
  workday: 'workday_jobs_prefs_v1',
  careers: 'career_pages_prefs_v1',
} as const;

export type DirectScanVariant = keyof typeof PREFS_KEYS;

interface WorkdayPrefs {
  titles?: string[];
  industries?: string[];
  location?: string;
  remoteOnly?: boolean;
  recency?: RecencyChoice;
  customDays?: number;
  seniorityFilter?: string;
  minScore?: number;
  hideUnrealistic?: boolean;
  sortBy?: 'score' | 'newest';
  groupByCompany?: boolean;
  sponsorFilter?: 'all' | 'friendly' | 'proven';
}

function loadPrefs(key: string): WorkdayPrefs {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as WorkdayPrefs) : {};
  } catch {
    return {};
  }
}

interface WorkdayJobsPanelProps {
  isJobSaved: (jobId: string) => boolean;
  getJobStatus: (jobId: string) => string | null;
  saveJob: (job: Job) => void;
  unsaveJob: (jobId: string) => void;
  quickApply: (job: Job) => void;
  /** 'workday' (default) scans the Workday tenant catalog; 'careers' scans
   *  companies' own career sites (Greenhouse/Lever/Ashby/…). Same engine,
   *  filters and scoring — different catalog, endpoints and saved setup. */
  variant?: DirectScanVariant;
}

export function WorkdayJobsPanel({
  isJobSaved, getJobStatus, saveJob, unsaveJob, quickApply,
  variant = 'workday',
}: WorkdayJobsPanelProps) {
  const isCareers = variant === 'careers';
  const prefsKey = PREFS_KEYS[variant];
  // ── Controls (hydrated from saved prefs so nothing reloads every visit) ──
  const [prefs] = useState<WorkdayPrefs>(() => loadPrefs(prefsKey));
  const [titles, setTitles] = useState<string[]>(prefs.titles ?? []);
  const [industries, setIndustries] = useState<string[]>(prefs.industries ?? []);
  const [location, setLocation] = useState(prefs.location ?? '');
  const [remoteOnly, setRemoteOnly] = useState(prefs.remoteOnly ?? false);
  const [recency, setRecency] = useState<RecencyChoice>(prefs.recency ?? '3d');
  const [customDays, setCustomDays] = useState(prefs.customDays ?? 2);
  const [groupByCompany, setGroupByCompany] = useState(prefs.groupByCompany ?? false);
  const [seniorityFilter, setSeniorityFilter] = useState<string>(prefs.seniorityFilter ?? 'any');
  const [minScore, setMinScore] = useState<number>(prefs.minScore ?? 0);
  const [locationFilter, setLocationFilter] = useState<string>('all');
  // Frank mode: rows the feasibility engine marks "skip" (core-stack
  // mismatch, big experience gap, clearance) are hidden by default.
  const [hideUnrealistic, setHideUnrealistic] = useState(prefs.hideUnrealistic ?? true);
  const [sortBy, setSortBy] = useState<'score' | 'newest'>(prefs.sortBy ?? 'score');
  // International default: hide JDs that explicitly decline sponsorship.
  // 'proven' additionally requires the company to have a real H-1B filing
  // record; 'unknown' companies stay visible in 'friendly' (no evidence
  // either way is not a refusal).
  const [sponsorFilter, setSponsorFilter] =
    useState<'all' | 'friendly' | 'proven'>(prefs.sponsorFilter ?? 'friendly');

  // Persist the setup on every change.
  useEffect(() => {
    try {
      window.localStorage.setItem(prefsKey, JSON.stringify({
        titles, industries, location, remoteOnly, recency, customDays,
        seniorityFilter, minScore, hideUnrealistic, sortBy, groupByCompany,
        sponsorFilter,
      } satisfies WorkdayPrefs));
    } catch {
      /* storage full/unavailable — non-fatal */
    }
  }, [titles, industries, location, remoteOnly, recency, customDays,
      seniorityFilter, minScore, hideUnrealistic, sortBy, groupByCompany,
      sponsorFilter]);
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
  const [needsAutoSuggest, setNeedsAutoSuggest] = useState(false);

  // Catalog metadata (industry chips) + resume titles prefill, once on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [cat, resume] = await Promise.all([
        isCareers ? apiService.getCareerPagesCatalog() : apiService.getWorkdayCatalog(),
        apiService.getResume(),
      ]);
      if (cancelled) return;
      if (cat.data) setCatalog(cat.data);
      const fromResume = resume.data?.resume?.job_titles ?? [];
      if (fromResume.length) {
        setResumeTitles(fromResume);
        // Prefill with ALL resume titles — but never clobber a saved or
        // user-edited set (saved prefs make prev non-empty on revisit).
        setTitles((prev) => (prev.length ? prev : fromResume.slice(0, 40)));
      }
      // Parsed resumes often carry only 1-2 (messy) past titles — a weak
      // search seed. Auto-run the smart synthesizer ONCE to build a proper
      // title set; the result persists via saved prefs afterwards.
      if (!prefs.titles?.length && fromResume.length < 4) {
        setNeedsAutoSuggest(true);
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
    const search = isCareers
      ? apiService.searchCareerPagesJobs.bind(apiService)
      : apiService.searchWorkdayJobs.bind(apiService);
    const resp = await search(
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
  }, [titles, industries, location, remoteOnly, isCareers]);

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
        return [...prev, ...suggested.filter((t) => !seen.has(t.toLowerCase()))].slice(0, 40);
      });
    }
  }, []);

  // Fires once when the parsed resume's own titles were too thin to search.
  useEffect(() => {
    if (needsAutoSuggest && !suggesting) {
      setNeedsAutoSuggest(false);
      void smartSuggest();
    }
  }, [needsAutoSuggest, suggesting, smartSuggest]);

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

  const recencyJobs = useMemo(() => {
    const all = result?.jobs ?? [];
    return all.filter((j) => j.days_ago != null && j.days_ago <= maxDays);
  }, [result, maxDays]);

  // Location dropdown options derived from the recency window's postings.
  const locationOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const j of recencyJobs) {
      const k = locationKeyOf(j);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [recencyJobs]);

  const skippedCount = useMemo(
    () => recencyJobs.filter((j) => j.tailor_feasibility === 'skip').length,
    [recencyJobs],
  );
  const hasFeasibility = useMemo(
    () => recencyJobs.some((j) => j.tailor_feasibility),
    [recencyJobs],
  );

  const refusedCount = useMemo(
    () => recencyJobs.filter((j) => j.sponsorship === 'refused').length,
    [recencyJobs],
  );

  const visibleJobs = useMemo(() => {
    let out = recencyJobs;
    if (seniorityFilter !== 'any') out = out.filter((j) => seniorityOf(j) === seniorityFilter);
    if (minScore > 0) out = out.filter((j) => (j.match_score ?? 0) >= minScore);
    if (locationFilter !== 'all') out = out.filter((j) => locationKeyOf(j) === locationFilter);
    if (hideUnrealistic && hasFeasibility) out = out.filter((j) => j.tailor_feasibility !== 'skip');
    if (sponsorFilter === 'friendly') out = out.filter((j) => j.sponsorship !== 'refused');
    else if (sponsorFilter === 'proven') out = out.filter((j) => j.sponsorship === 'likely');
    if (sortBy === 'newest') {
      out = [...out].sort((a, b) =>
        (a.days_ago ?? 99) - (b.days_ago ?? 99) || (b.match_score ?? 0) - (a.match_score ?? 0));
    }
    return out;
  }, [recencyJobs, seniorityFilter, minScore, locationFilter, hideUnrealistic, hasFeasibility, sortBy, sponsorFilter]);

  // Reset incremental rendering whenever the visible set changes shape.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [recency, customDays, groupByCompany, result, seniorityFilter, minScore, locationFilter, hideUnrealistic, sortBy, sponsorFilter]);
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
              maxItems={40}
              placeholder="e.g. Backend Engineer, Data Engineer…"
              defaultValues={resumeTitles.length ? resumeTitles.slice(0, 40) : undefined}
              helperText={`The first 4 core title families drive the ${isCareers ? 'career-site scan' : 'Workday search'}; every title participates in ranking. Your set is saved automatically.`}
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
                {loading ? 'Scanning…' : isCareers ? 'Search Career Sites' : 'Search Workday'}
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
                      : isCareers
                        ? 'Querying company career pages directly — Greenhouse, Lever, Ashby & more (no scraping, no credits)…'
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

          {/* Second filter row: seniority / min score / location / realism / sort */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={seniorityFilter}
              onChange={(e) => setSeniorityFilter(e.target.value)}
              className="h-8 rounded-md border border-border/60 bg-background px-2 text-[11px] font-medium text-foreground"
              aria-label="Seniority filter"
            >
              {SENIORITY_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>

            <div className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5">
              {MIN_SCORE_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMinScore(n)}
                  className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${
                    minScore === n
                      ? 'bg-background text-purple-600 shadow-sm dark:text-purple-300'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {n === 0 ? 'Any score' : `${n}+`}
                </button>
              ))}
            </div>

            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="h-8 max-w-[190px] rounded-md border border-border/60 bg-background px-2 text-[11px] font-medium text-foreground"
              aria-label="Location filter"
            >
              <option value="all">All locations</option>
              {locationOptions.map(([key, count]) => (
                <option key={key} value={key}>{key} ({count})</option>
              ))}
            </select>

            {hasFeasibility && (
              <label
                className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
                title="Hides roles the feasibility check marks as not honestly tailorable — off-stack JDs (e.g. .NET for a Python resume), 5+ year experience gaps, clearance requirements."
              >
                <Switch checked={hideUnrealistic} onCheckedChange={setHideUnrealistic} />
                Hide off-target ({skippedCount})
              </label>
            )}

            <div
              className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5"
              title={`Sponsorship filter for international candidates. "Sponsor-friendly" hides JDs that explicitly decline visa sponsorship (${refusedCount} here); "Proven sponsors" additionally keeps only companies with a real recent H-1B filing record.`}
            >
              {([['all', 'All'], ['friendly', 'Sponsor-friendly'], ['proven', 'Proven sponsors']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSponsorFilter(key)}
                  className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${
                    sponsorFilter === key
                      ? 'bg-background text-purple-600 shadow-sm dark:text-purple-300'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="ml-auto inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5">
              {(['score', 'newest'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSortBy(s)}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    sortBy === s
                      ? 'bg-background text-purple-600 shadow-sm dark:text-purple-300'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s === 'score' ? 'Best match' : 'Newest'}
                </button>
              ))}
            </div>
          </div>

          {result.resume_skill_count === 0 && !result.streaming && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              No parsed resume found for this account — match scores, skill
              overlap and tailor-feasibility need one. Upload your resume in
              the Tailor tab (or log in with the account that has it), then
              re-run the search.
            </div>
          )}

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
              Search {catalogTotal ? `${catalogTotal} ` : ''}{isCareers ? 'company career pages' : 'Workday career sites'} directly
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              {isCareers
                ? 'Covers the non-Workday universe — companies hosting jobs on their own career pages via Greenhouse, Lever, Ashby, SmartRecruiters, Workable and Recruitee. Public JSON APIs, no scraping, no credits.'
                : "70%+ of large enterprises hire through Workday. This tab queries each company's public careers API directly — fast, free, and fresh."}{' '}
              Defaults to roles posted in the last 3 days; the full 30-day window loads in one scan.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

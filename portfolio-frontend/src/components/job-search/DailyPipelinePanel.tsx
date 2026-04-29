import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Zap, Building2, MapPin, ExternalLink, Sparkles, AlertCircle,
  Trophy, Medal, Award, Calendar, RotateCcw, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiService } from '@/lib/api';
import type {
  DailyPipelineParams,
  DailyPipelineResult,
  DailyPipelineRecord,
} from '@/types/jobs';

const DEFAULT_LINKEDIN_KEYWORDS = [
  'Cloud Engineer DevOps',
  'Site Reliability Platform Engineer',
  'full stack engineer AI',
  'backend engineer Python AWS',
  'agentic AI engineer new grad',
];

const DEFAULT_WORKDAY_TITLES = [
  'Cloud Engineer', 'DevOps Engineer', 'Site Reliability Engineer',
  'Platform Engineer', 'Infrastructure Engineer', 'Backend Engineer',
  'Backend Software Engineer', 'API Engineer', 'Full Stack Engineer',
  'Full Stack Software Engineer', 'Frontend Engineer', 'AI Engineer',
  'ML Engineer', 'Machine Learning Engineer', 'Agentic AI Engineer',
  'Software Engineer', 'Software Developer', 'Software Engineer I',
  'Associate Software Engineer', 'Junior Software Engineer',
  'New Grad Software Engineer', 'Entry Level Software Engineer',
  'Graduate Software Engineer', 'Early Career Software Engineer',
];

const TIER_STYLES: Record<string, { label: string; ring: string; chip: string; icon: JSX.Element }> = {
  'Tier 1': {
    label: 'Tier 1',
    ring: 'border-yellow-400/60 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-500/10 dark:to-amber-500/10',
    chip: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
    icon: <Trophy className="h-3.5 w-3.5" />,
  },
  'Tier 2': {
    label: 'Tier 2',
    ring: 'border-slate-400/60 bg-gradient-to-br from-slate-50 to-zinc-50 dark:from-slate-500/10 dark:to-zinc-500/10',
    chip: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
    icon: <Medal className="h-3.5 w-3.5" />,
  },
  'Tier 3': {
    label: 'Tier 3',
    ring: 'border-orange-400/60 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-500/10 dark:to-amber-500/10',
    chip: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
    icon: <Award className="h-3.5 w-3.5" />,
  },
};

const linesToList = (s: string) =>
  s.split(/[\n,]/).map((p) => p.trim()).filter(Boolean);

const listToLines = (xs: string[]) => xs.join('\n');

const STORAGE_KEY = 'daily_pipeline_state_v1';
const RESULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface PersistedState {
  linkedinText: string;
  workdayText: string;
  customRoles: string;
  pastDays: number;
  showAdvanced: boolean;
  result: DailyPipelineResult | null;
  resultAt: number | null;
}

function readPersisted(): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.result && parsed.resultAt && Date.now() - parsed.resultAt > RESULT_TTL_MS) {
      // Result is stale — keep inputs, drop result.
      parsed.result = null;
      parsed.resultAt = null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(state: PersistedState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / disabled */
  }
}

function PipelineRow({ rec }: { rec: DailyPipelineRecord }) {
  const tierStyle = TIER_STYLES[rec.tier || ''];
  const flagList = (rec.flags || '')
    .split(',')
    .map((f) => f.trim())
    .filter((f) => f && f !== '—');

  return (
    <Card className={`group rounded-xl border ${tierStyle?.ring || 'border-border/60'} backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-md`}>
      <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex flex-shrink-0 flex-col items-center gap-1.5 sm:w-20">
          {tierStyle && (
            <Badge className={`gap-1 border ${tierStyle.chip} font-semibold`} variant="outline">
              {tierStyle.icon}
              {tierStyle.label}
            </Badge>
          )}
          <span className="text-2xl font-bold tabular-nums leading-none">{rec.score ?? 0}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">score</span>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h4 className="text-sm font-semibold leading-tight">{rec.title}</h4>
            <Badge variant="outline" className="border-border/60 text-[10px] uppercase tracking-wider">
              {rec.source}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {rec.company}
            </span>
            {rec.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {rec.location}
              </span>
            )}
            {rec.posted && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {rec.posted}
              </span>
            )}
            {rec.salary && rec.salary !== '—' && <span>{rec.salary}</span>}
          </div>

          {flagList.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {flagList.map((f) => (
                <Badge
                  key={f}
                  variant="secondary"
                  className="bg-purple-500/10 text-[10px] text-purple-700 dark:text-purple-300"
                >
                  {f}
                </Badge>
              ))}
            </div>
          )}

          {rec.opt && rec.opt !== 'FTE OK' && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">{rec.opt}</p>
          )}
        </div>

        <div className="flex flex-shrink-0 items-start">
          {rec.url ? (
            <Button
              size="sm"
              asChild
              className="gap-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90"
            >
              <a href={rec.url} target="_blank" rel="noopener noreferrer">
                Apply
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function TierGroup({ title, items, accent }: { title: string; items: DailyPipelineRecord[]; accent: string }) {
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
        <Badge variant="outline" className={accent}>{items.length}</Badge>
      </div>
      <div className="space-y-2">
        {items.map((rec, i) => (
          <PipelineRow key={`${rec.url}-${i}`} rec={rec} />
        ))}
      </div>
    </div>
  );
}

export function DailyPipelinePanel() {
  const persisted = typeof window !== 'undefined' ? readPersisted() : null;

  const [linkedinText, setLinkedinText] = useState(
    persisted?.linkedinText ?? listToLines(DEFAULT_LINKEDIN_KEYWORDS),
  );
  const [workdayText, setWorkdayText] = useState(
    persisted?.workdayText ?? listToLines(DEFAULT_WORKDAY_TITLES),
  );
  const [customRoles, setCustomRoles] = useState(persisted?.customRoles ?? '');
  const [pastDays, setPastDays] = useState(persisted?.pastDays ?? 1);
  const [showAdvanced, setShowAdvanced] = useState(persisted?.showAdvanced ?? false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DailyPipelineResult | null>(persisted?.result ?? null);
  const [resultAt, setResultAt] = useState<number | null>(persisted?.resultAt ?? null);

  // Persist to sessionStorage on any change.
  useEffect(() => {
    writePersisted({
      linkedinText,
      workdayText,
      customRoles,
      pastDays,
      showAdvanced,
      result,
      resultAt,
    });
  }, [linkedinText, workdayText, customRoles, pastDays, showAdvanced, result, resultAt]);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setResultAt(null);

    const params: DailyPipelineParams = {
      linkedin_keywords: linesToList(linkedinText),
      workday_titles: linesToList(workdayText),
      custom_role_terms: linesToList(customRoles),
      past_days: pastDays,
    };

    const resp = await apiService.runDailyPipeline(params);
    setLoading(false);

    if (resp.error) {
      setError(resp.error);
      toast.error(resp.error);
      return;
    }
    if (!resp.data) {
      setError('Pipeline returned no data');
      return;
    }
    setResult(resp.data);
    setResultAt(Date.now());
    toast.success(
      `Pipeline complete: ${resp.data.totals.apply_now} jobs to apply` +
        (resp.data.totals.verify_dates ? `, ${resp.data.totals.verify_dates} to verify` : '')
    );
  };

  const handleReset = () => {
    setLinkedinText(listToLines(DEFAULT_LINKEDIN_KEYWORDS));
    setWorkdayText(listToLines(DEFAULT_WORKDAY_TITLES));
    setCustomRoles('');
    setPastDays(1);
    setResult(null);
    setResultAt(null);
  };

  // Group apply_now by tier
  const tier1 = (result?.apply_now || []).filter((r) => r.tier === 'Tier 1');
  const tier2 = (result?.apply_now || []).filter((r) => r.tier === 'Tier 2');
  const tier3 = (result?.apply_now || []).filter((r) => r.tier === 'Tier 3');

  return (
    <div className="space-y-6">
      {/* Hero / config */}
      <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-transparent to-indigo-500/5">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-500" />
                <h3 className="text-lg font-semibold">Daily Apify Pipeline</h3>
                <Badge variant="outline" className="border-purple-500/40 text-purple-600 dark:text-purple-300">
                  LinkedIn + Workday
                </Badge>
              </div>
              <p className="max-w-2xl text-xs text-muted-foreground">
                One click → scrapes both actors in parallel, scores against an entry-level / cloud / backend / AI profile,
                and groups results by Tier. Defaults are pre-filled — tweak the keywords or add custom roles for any other
                domain.
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <Button
                onClick={handleReset}
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={loading}
              >
                <RotateCcw className="h-3 w-3" />
                Reset defaults
              </Button>
              <Button
                onClick={handleRun}
                disabled={loading}
                className="gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90"
              >
                <Sparkles className="h-4 w-4" />
                {loading ? 'Running pipeline…' : 'Run pipeline'}
              </Button>
            </div>
          </div>

          {/* Quick controls — always visible */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <Calendar className="mr-1 inline h-3 w-3" />
                Past days
              </Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={pastDays}
                onChange={(e) => setPastDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                className="focus-visible:border-purple-500/40 focus-visible:ring-purple-500/40"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Custom role keywords (optional)
              </Label>
              <Input
                placeholder="e.g. data engineer, security, mobile"
                value={customRoles}
                onChange={(e) => setCustomRoles(e.target.value)}
                className="focus-visible:border-purple-500/40 focus-visible:ring-purple-500/40"
              />
              <p className="text-[10px] text-muted-foreground">
                Comma-separated. Roles outside the built-in families (Cloud, Backend, Full-Stack, AI/ML, Frontend, SWE)
                won't be scored otherwise.
              </p>
            </div>
          </div>

          {/* Advanced toggle */}
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced((v) => !v)}
              className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {showAdvanced ? '▾' : '▸'} Advanced — edit LinkedIn searches & Workday titles
            </Button>
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  LinkedIn keyword searches (one per line, max 10)
                </Label>
                <Textarea
                  rows={6}
                  value={linkedinText}
                  onChange={(e) => setLinkedinText(e.target.value)}
                  className="font-mono text-xs focus-visible:border-purple-500/40 focus-visible:ring-purple-500/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Workday titles (one per line)
                </Label>
                <Textarea
                  rows={6}
                  value={workdayText}
                  onChange={(e) => setWorkdayText(e.target.value)}
                  className="font-mono text-xs focus-visible:border-purple-500/40 focus-visible:ring-purple-500/40"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Running both Apify actors in parallel — this typically takes 1-3 minutes…
          </p>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <Card className="border-red-500/40 bg-red-500/5">
          <CardContent className="flex items-start gap-2 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <div className="text-sm">
              <p className="font-semibold text-red-700 dark:text-red-300">Pipeline failed</p>
              <p className="text-xs text-red-700/80 dark:text-red-300/80">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6">
          {resultAt && Date.now() - resultAt > 30_000 && (
            <p className="text-[11px] italic text-muted-foreground">
              Showing cached result from{' '}
              {new Date(resultAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' '}· Run pipeline to refresh.
            </p>
          )}
          {/* Summary strip */}
          <Card className="border-border/60 bg-card/60">
            <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
              <SummaryBlock label="LinkedIn" value={result.raw_counts.linkedin} />
              <SummaryBlock label="Workday" value={result.raw_counts.workday} />
              <SummaryBlock label="Apply now" value={result.totals.apply_now} accent="text-emerald-600 dark:text-emerald-400" />
              <SummaryBlock label="Verify dates" value={result.totals.verify_dates} accent="text-amber-600 dark:text-amber-400" />
              <SummaryBlock label="Excluded" value={result.excluded_total} accent="text-muted-foreground" />
            </CardContent>
          </Card>

          {result.errors.length > 0 && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="flex items-start gap-2 p-3 text-xs">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 text-amber-500" />
                <div>
                  <p className="font-semibold text-amber-700 dark:text-amber-300">Partial results</p>
                  <ul className="mt-1 space-y-0.5 text-amber-700/80 dark:text-amber-300/80">
                    {result.errors.map((e, i) => <li key={i}>· {e}</li>)}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          <TierGroup
            title={`🥇 Tier 1 — apply first (${tier1.length})`}
            items={tier1}
            accent="border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
          />
          <TierGroup
            title={`🥈 Tier 2 (${tier2.length})`}
            items={tier2}
            accent="border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300"
          />
          <TierGroup
            title={`🥉 Tier 3 (${tier3.length})`}
            items={tier3}
            accent="border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300"
          />

          {result.verify_dates.length > 0 && (
            <TierGroup
              title={`⚠️ Verify dates (interns / co-ops) — ${result.verify_dates.length}`}
              items={result.verify_dates}
              accent="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            />
          )}

          {result.phoenix.length > 0 && (
            <TierGroup
              title={`📍 Phoenix-area highlights (${result.phoenix.length})`}
              items={result.phoenix}
              accent="border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
            />
          )}

          {result.totals.apply_now === 0 && result.totals.verify_dates === 0 && (
            <Card className="border-border/60">
              <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
                <p className="text-sm font-medium">No matches in the past {result.past_days} day(s).</p>
                <p className="text-xs text-muted-foreground">
                  Try widening the window or adding custom role keywords.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryBlock({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent || ''}`}>{value}</p>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Zap, Building2, MapPin, ExternalLink, Sparkles, AlertCircle,
  Trophy, Medal, Award, Calendar, RotateCcw, Clock, Globe, Briefcase,
  Tag, CheckCircle2, Eye, EyeOff, Cloud, Server, Layers, Brain, Code2,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChipsInput } from './ChipsInput';
import { ApifyKeyCard } from './ApifyKeyCard';
import { apiService } from '@/lib/api';
import type {
  DailyPipelineParams,
  DailyPipelineResult,
  DailyPipelineRecord,
  SmartFilterSuggestions,
} from '@/types/jobs';

// --------------------------------------------------------------------------
// Defaults & presets
// --------------------------------------------------------------------------
const DEFAULT_LINKEDIN_KEYWORDS = [
  'Cloud Engineer DevOps',
  'Site Reliability Platform Engineer',
  'full stack engineer AI',
  'backend engineer Python AWS',
  'agentic AI engineer new grad',
  'software engineer new grad entry level',
  'associate software engineer h1b sponsor',
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

interface Preset {
  id: string;
  label: string;
  icon: JSX.Element;
  gradient: string;
  linkedin: string[];
  workday: string[];
  customRoles: string[];
}

const PRESETS: Preset[] = [
  {
    id: 'cloud-devops',
    label: 'Cloud / DevOps',
    icon: <Cloud className="h-3.5 w-3.5" />,
    gradient: 'from-sky-500 to-cyan-500',
    linkedin: [
      'Cloud Engineer AWS',
      'DevOps Engineer Kubernetes',
      'Site Reliability Engineer',
      'Platform Engineer Terraform',
    ],
    workday: [
      'Cloud Engineer', 'DevOps Engineer', 'Site Reliability Engineer',
      'Platform Engineer', 'Infrastructure Engineer', 'Cloud Software Engineer',
      'AWS Engineer', 'Kubernetes Engineer', 'Junior SRE', 'New Grad SRE',
    ],
    customRoles: ['terraform', 'kubernetes', 'aws'],
  },
  {
    id: 'backend',
    label: 'Backend',
    icon: <Server className="h-3.5 w-3.5" />,
    gradient: 'from-emerald-500 to-teal-500',
    linkedin: [
      'Backend Engineer Python',
      'Backend Engineer Java new grad',
      'API Engineer',
      'distributed systems engineer entry level',
    ],
    workday: [
      'Backend Engineer', 'Backend Software Engineer', 'API Engineer',
      'Server Engineer', 'Junior Backend Engineer', 'Associate Backend Engineer',
      'New Grad Backend Engineer',
    ],
    customRoles: ['python', 'java', 'go', 'distributed'],
  },
  {
    id: 'fullstack',
    label: 'Full-Stack',
    icon: <Layers className="h-3.5 w-3.5" />,
    gradient: 'from-violet-500 to-indigo-500',
    linkedin: [
      'Full Stack Engineer React',
      'Full Stack Developer Node',
      'Full Stack Engineer new grad',
    ],
    workday: [
      'Full Stack Engineer', 'Full Stack Software Engineer', 'Full Stack Developer',
      'Junior Full Stack Engineer', 'Associate Full Stack Engineer',
      'New Grad Full Stack Engineer',
    ],
    customRoles: ['react', 'node', 'typescript'],
  },
  {
    id: 'ai-ml',
    label: 'AI / ML',
    icon: <Brain className="h-3.5 w-3.5" />,
    gradient: 'from-fuchsia-500 to-purple-500',
    linkedin: [
      'AI Engineer agentic',
      'Machine Learning Engineer entry level',
      'GenAI Engineer LLM',
      'Applied AI Engineer new grad',
    ],
    workday: [
      'AI Engineer', 'ML Engineer', 'Machine Learning Engineer',
      'Applied AI Engineer', 'Agentic AI Engineer', 'GenAI Engineer',
      'LLM Engineer', 'Junior ML Engineer', 'New Grad AI Engineer',
    ],
    customRoles: ['agentic', 'llm', 'rag', 'pytorch'],
  },
  {
    id: 'frontend',
    label: 'Frontend',
    icon: <Code2 className="h-3.5 w-3.5" />,
    gradient: 'from-orange-500 to-pink-500',
    linkedin: [
      'Frontend Engineer React',
      'Frontend Developer entry level',
      'UI Engineer new grad',
    ],
    workday: [
      'Frontend Engineer', 'Frontend Software Engineer', 'Frontend Developer',
      'UI Engineer', 'Web Engineer', 'Junior Frontend Engineer',
      'New Grad Frontend Engineer',
    ],
    customRoles: ['react', 'typescript', 'nextjs', 'tailwind'],
  },
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

// --------------------------------------------------------------------------
// Persistence
// --------------------------------------------------------------------------
const STORAGE_KEY = 'daily_pipeline_state_v2';
const RESULT_TTL_MS = 30 * 60 * 1000;

interface PersistedState {
  linkedinKws: string[];
  workdayTitles: string[];
  customRoles: string[];
  pastDays: number;
  showAdvanced: boolean;
  result: DailyPipelineResult | null;
  resultAt: number | null;
  appliedIds: string[];
  showApplied: boolean;
}

let _memoryCache: PersistedState | null = null;

function _recordId(rec: DailyPipelineRecord) {
  return rec.url || `${rec.source}-${rec.company}-${rec.title}`;
}

function _slimForStorage(state: PersistedState): PersistedState {
  if (!state.result) return state;
  const slim = (r: DailyPipelineRecord) => ({ ...r, description: undefined });
  return {
    ...state,
    result: {
      ...state.result,
      apply_now: state.result.apply_now.map(slim),
      verify_dates: state.result.verify_dates.map(slim),
      phoenix: state.result.phoenix.map(slim),
      excluded_sample: state.result.excluded_sample.map(slim),
    },
  };
}

function readPersisted(): PersistedState | null {
  if (_memoryCache) {
    if (_memoryCache.result && _memoryCache.resultAt && Date.now() - _memoryCache.resultAt > RESULT_TTL_MS) {
      _memoryCache = { ..._memoryCache, result: null, resultAt: null };
    }
    return _memoryCache;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.result && parsed.resultAt && Date.now() - parsed.resultAt > RESULT_TTL_MS) {
      parsed.result = null;
      parsed.resultAt = null;
    }
    _memoryCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(state: PersistedState) {
  _memoryCache = state;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(_slimForStorage(state)));
  } catch {
    /* quota / disabled */
  }
}

// --------------------------------------------------------------------------
// Job row
// --------------------------------------------------------------------------
function PipelineRow({
  rec,
  applied,
  onApply,
  onTailor,
}: {
  rec: DailyPipelineRecord;
  applied: boolean;
  onApply: () => void;
  onTailor: () => void;
}) {
  const tierStyle = TIER_STYLES[rec.tier || ''];
  const flagList = (rec.flags || '')
    .split(',')
    .map((f) => f.trim())
    .filter((f) => f && f !== '—');

  return (
    <Card
      className={`group relative rounded-xl border ${
        applied
          ? 'border-emerald-500/40 bg-emerald-500/5 opacity-60'
          : tierStyle?.ring || 'border-border/60'
      } backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-md`}
    >
      {applied && (
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          Applied · in Saved
        </div>
      )}
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

        <div className="flex flex-shrink-0 flex-col items-stretch gap-1.5 sm:w-28">
          {rec.url ? (
            <Button
              size="sm"
              onClick={onApply}
              disabled={applied}
              className={`gap-1 ${
                applied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90'
              }`}
            >
              {applied ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Applied
                </>
              ) : (
                <>
                  Apply
                  <ExternalLink className="h-3 w-3" />
                </>
              )}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={onTailor}
            disabled={applied}
            className="gap-1 border-purple-500/30 text-[11px] text-purple-700 hover:bg-purple-500/10 dark:text-purple-300"
            title="Open this job in Tailor — auto-marks Applied once tailoring saves"
          >
            <Wand2 className="h-3 w-3" />
            Tailor
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TierGroup({
  title,
  items,
  accent,
  appliedIds,
  showApplied,
  onApply,
  onTailor,
}: {
  title: string;
  items: DailyPipelineRecord[];
  accent: string;
  appliedIds: Set<string>;
  showApplied: boolean;
  onApply: (rec: DailyPipelineRecord) => void;
  onTailor: (rec: DailyPipelineRecord) => void;
}) {
  const visible = showApplied ? items : items.filter((r) => !appliedIds.has(_recordId(r)));
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
        <Badge variant="outline" className={accent}>
          {visible.length}{visible.length !== items.length ? ` / ${items.length}` : ''}
        </Badge>
      </div>
      <div className="space-y-2">
        {visible.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs italic text-muted-foreground">
            All applied! Toggle "Show applied" to see them again.
          </p>
        ) : (
          visible.map((rec) => (
            <PipelineRow
              key={_recordId(rec)}
              rec={rec}
              applied={appliedIds.has(_recordId(rec))}
              onApply={() => onApply(rec)}
              onTailor={() => onTailor(rec)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Main panel
// --------------------------------------------------------------------------
export interface DailyPipelinePanelProps {
  /** Pending suggestions handed in from SmartFiltersPanel — consumed once. */
  pendingSuggestions?: SmartFilterSuggestions | null;
  onSuggestionsConsumed?: () => void;
  /** Optional refresh of saved-jobs in parent after Apply. */
  onJobApplied?: () => void;
}

export function DailyPipelinePanel({
  pendingSuggestions,
  onSuggestionsConsumed,
  onJobApplied,
}: DailyPipelinePanelProps) {
  const persisted = typeof window !== 'undefined' ? readPersisted() : null;

  const [linkedinKws, setLinkedinKws] = useState<string[]>(persisted?.linkedinKws ?? DEFAULT_LINKEDIN_KEYWORDS);
  const [workdayTitles, setWorkdayTitles] = useState<string[]>(persisted?.workdayTitles ?? DEFAULT_WORKDAY_TITLES);
  const [customRoles, setCustomRoles] = useState<string[]>(persisted?.customRoles ?? []);
  const [pastDays, setPastDays] = useState(persisted?.pastDays ?? 1);
  const [showAdvanced, setShowAdvanced] = useState(persisted?.showAdvanced ?? false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DailyPipelineResult | null>(persisted?.result ?? null);
  const [resultAt, setResultAt] = useState<number | null>(persisted?.resultAt ?? null);
  const [appliedIds, setAppliedIds] = useState<string[]>(persisted?.appliedIds ?? []);
  const [showApplied, setShowApplied] = useState<boolean>(persisted?.showApplied ?? true);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Persist
  useEffect(() => {
    writePersisted({
      linkedinKws,
      workdayTitles,
      customRoles,
      pastDays,
      showAdvanced,
      result,
      resultAt,
      appliedIds,
      showApplied,
    });
  }, [linkedinKws, workdayTitles, customRoles, pastDays, showAdvanced, result, resultAt, appliedIds, showApplied]);

  // Consume incoming smart-filter suggestions
  useEffect(() => {
    if (!pendingSuggestions) return;
    setLinkedinKws(pendingSuggestions.linkedin_keyword_sets);
    setWorkdayTitles(pendingSuggestions.workday_titles);
    setCustomRoles(pendingSuggestions.custom_role_terms);
    setPastDays(pendingSuggestions.past_days);
    setShowAdvanced(true);
    setActivePreset(null);
    onSuggestionsConsumed?.();
  }, [pendingSuggestions, onSuggestionsConsumed]);

  const appliedSet = useMemo(() => new Set(appliedIds), [appliedIds]);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setResultAt(null);

    const params: DailyPipelineParams = {
      linkedin_keywords: linkedinKws,
      workday_titles: workdayTitles,
      custom_role_terms: customRoles,
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
        (resp.data.totals.verify_dates ? `, ${resp.data.totals.verify_dates} to verify` : ''),
    );
  };

  const handleReset = () => {
    setLinkedinKws(DEFAULT_LINKEDIN_KEYWORDS);
    setWorkdayTitles(DEFAULT_WORKDAY_TITLES);
    setCustomRoles([]);
    setPastDays(1);
    setActivePreset(null);
    setResult(null);
    setResultAt(null);
  };

  const applyPreset = (p: Preset) => {
    setLinkedinKws(p.linkedin);
    setWorkdayTitles(p.workday);
    setCustomRoles(p.customRoles);
    setActivePreset(p.id);
    toast.success(`Loaded preset: ${p.label}`);
  };

  const handleTailor = async (rec: DailyPipelineRecord) => {
    const id = _recordId(rec);
    const job = {
      job_id: id,
      title: rec.title,
      company: rec.company,
      logo: '',
      location: rec.location || '',
      apply_link: rec.url || '',
      description: rec.description || '',
      salary: rec.salary || '',
      employment_type: 'FULLTIME',
      posted_date: rec.posted || '',
      h1b_sponsor: (rec.flags || '').toLowerCase().includes('h1b'),
      remote: /remote/i.test(rec.location || ''),
      match_score: rec.score ?? 0,
      matching_skills: [],
      missing_skills: [],
      source: rec.source || 'LinkedIn',
    };
    // Save (or no-op if already saved) so the application tracker picks it up.
    try { await apiService.saveJob(job as any); } catch { /* duplicate-ok */ }

    const jdSeed = rec.description?.trim() ||
      `${rec.title} at ${rec.company}\n${rec.location || ''}\n${rec.url || ''}\n\n` +
      `(Paste the full job description here to tailor — applied status will be auto-set once tailoring is saved.)`;

    try {
      sessionStorage.setItem('pending_tailor_job', JSON.stringify({
        job_id: id,
        jd_text: jdSeed,
        title: rec.title,
        company: rec.company,
        url: rec.url || '',
      }));
    } catch { /* quota */ }

    window.dispatchEvent(new CustomEvent('portfolio:navigate-to-tailor'));
    toast.success('Opening Tailor — applied status will be set when tailoring saves.');
  };

  const handleApply = async (rec: DailyPipelineRecord) => {
    const id = _recordId(rec);
    if (rec.url) window.open(rec.url, '_blank', 'noopener,noreferrer');

    const job = {
      job_id: id,
      title: rec.title,
      company: rec.company,
      logo: '',
      location: rec.location || '',
      apply_link: rec.url || '',
      description: rec.description || '',
      salary: rec.salary || '',
      employment_type: 'FULLTIME',
      posted_date: rec.posted || '',
      h1b_sponsor: (rec.flags || '').toLowerCase().includes('h1b'),
      remote: /remote/i.test(rec.location || ''),
      match_score: rec.score ?? 0,
      matching_skills: [],
      missing_skills: [],
      source: rec.source || 'LinkedIn',
    };

    try {
      await apiService.saveJob(job as any);
    } catch {
      /* tolerate duplicate save */
    }
    await apiService.updateSavedJob(id, { status: 'applied' });

    setAppliedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    onJobApplied?.();
    toast.success('Saved as Applied — see the Saved tab.');
  };

  const tier1 = (result?.apply_now || []).filter((r) => r.tier === 'Tier 1');
  const tier2 = (result?.apply_now || []).filter((r) => r.tier === 'Tier 2');
  const tier3 = (result?.apply_now || []).filter((r) => r.tier === 'Tier 3');
  const allApplyNow = result?.apply_now || [];
  const remainingApply = allApplyNow.filter((r) => !appliedSet.has(_recordId(r))).length;

  return (
    <div className="space-y-6">
      {/* BYO Apify key */}
      <ApifyKeyCard />

      {/* Hero / config */}
      <Card className="overflow-hidden border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-transparent to-indigo-500/10">
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
                One click runs both Apify actors in parallel, scores results against your profile,
                and groups them into Tier 1/2/3. Tweak the chips below or pick a preset — every change
                persists per session. Smart Filters tab can auto-fill these from your resume.
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
                Reset
              </Button>
              <Button
                onClick={handleRun}
                disabled={loading}
                className="gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20 hover:opacity-90"
              >
                <Sparkles className="h-4 w-4" />
                {loading ? 'Running…' : 'Run pipeline'}
              </Button>
            </div>
          </div>

          {/* Preset persona chips */}
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <Tag className="mr-1 inline h-3 w-3" />
              Quick presets
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const active = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                      active
                        ? `border-transparent bg-gradient-to-r ${p.gradient} text-white shadow-sm`
                        : 'border-border/60 bg-card hover:border-purple-500/40 hover:bg-purple-500/5'
                    }`}
                  >
                    <span className={active ? 'text-white' : 'text-muted-foreground group-hover:text-foreground'}>
                      {p.icon}
                    </span>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick controls */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <Calendar className="mr-1 inline h-3 w-3" />
                Past days
              </label>
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
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Custom role keywords (used to keep adjacent roles)
              </label>
              <ChipsInput
                values={customRoles}
                onChange={setCustomRoles}
                placeholder="e.g. data engineer, security, mobile"
                maxItems={20}
                accentClass="border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                emptyState="Optional — only needed if you want roles outside the built-in families."
              />
            </div>
          </div>

          {/* Advanced toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced((v) => !v)}
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showAdvanced ? '▾' : '▸'} Advanced — edit LinkedIn searches & Workday titles
          </Button>

          {showAdvanced && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Globe className="mr-1 inline h-3 w-3" />
                  LinkedIn keyword phrases
                </p>
                <ChipsInput
                  values={linkedinKws}
                  onChange={setLinkedinKws}
                  placeholder="Add a search phrase…"
                  maxItems={10}
                  defaultValues={DEFAULT_LINKEDIN_KEYWORDS}
                  accentClass="border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                  helperText="Each phrase is sent as one LinkedIn search URL. Be specific (3-6 words)."
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Briefcase className="mr-1 inline h-3 w-3" />
                  Workday job titles
                </p>
                <ChipsInput
                  values={workdayTitles}
                  onChange={setWorkdayTitles}
                  placeholder="Add a title… or paste a comma-separated list"
                  maxItems={120}
                  defaultValues={DEFAULT_WORKDAY_TITLES}
                  accentClass="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  helperText="Anchor each title to a software domain word so 'New Grad' doesn't pull non-tech roles."
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
              <SummaryBlock
                label="LinkedIn (kept / raw)"
                value={
                  result.source_breakdown
                    ? `${result.source_breakdown.linkedin.apply_now + result.source_breakdown.linkedin.verify} / ${result.source_breakdown.linkedin.raw}`
                    : result.raw_counts.linkedin
                }
              />
              <SummaryBlock
                label="Workday (kept / raw)"
                value={
                  result.source_breakdown
                    ? `${result.source_breakdown.workday.apply_now + result.source_breakdown.workday.verify} / ${result.source_breakdown.workday.raw}`
                    : result.raw_counts.workday
                }
              />
              {result.source_breakdown?.indeed && result.source_breakdown.indeed.raw > 0 && (
                <SummaryBlock
                  label="Indeed (kept / raw)"
                  value={`${result.source_breakdown.indeed.apply_now + result.source_breakdown.indeed.verify} / ${result.source_breakdown.indeed.raw}`}
                />
              )}
              {result.source_breakdown?.ats_direct && result.source_breakdown.ats_direct.raw > 0 && (
                <SummaryBlock
                  label="ATS direct (kept / raw)"
                  value={`${result.source_breakdown.ats_direct.apply_now + result.source_breakdown.ats_direct.verify} / ${result.source_breakdown.ats_direct.raw}`}
                />
              )}
              <SummaryBlock
                label="Remaining to apply"
                value={remainingApply}
                accent="text-emerald-600 dark:text-emerald-400"
              />
              <SummaryBlock
                label="Verify dates"
                value={result.totals.verify_dates}
                accent="text-amber-600 dark:text-amber-400"
              />
              <SummaryBlock label="Excluded" value={result.excluded_total} accent="text-muted-foreground" />
            </CardContent>
          </Card>

          {/* Heads-up if Workday returned 0 raw */}
          {result.source_breakdown && result.source_breakdown.workday.raw === 0 && (
            <p className="text-[11px] italic text-amber-600 dark:text-amber-400">
              Workday returned 0 results this run. Check Apify actor status or token rental.
            </p>
          )}

          {/* Show applied toggle */}
          {appliedIds.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {appliedIds.length} applied this session
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-[11px]"
                onClick={() => setShowApplied((v) => !v)}
              >
                {showApplied ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showApplied ? 'Hide applied' : 'Show applied'}
              </Button>
            </div>
          )}

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
            appliedIds={appliedSet}
            showApplied={showApplied}
            onApply={handleApply}
            onTailor={handleTailor}
          />
          <TierGroup
            title={`🥈 Tier 2 (${tier2.length})`}
            items={tier2}
            accent="border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300"
            appliedIds={appliedSet}
            showApplied={showApplied}
            onApply={handleApply}
            onTailor={handleTailor}
          />
          <TierGroup
            title={`🥉 Tier 3 (${tier3.length})`}
            items={tier3}
            accent="border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300"
            appliedIds={appliedSet}
            showApplied={showApplied}
            onApply={handleApply}
            onTailor={handleTailor}
          />

          {result.verify_dates.length > 0 && (
            <TierGroup
              title={`⚠️ Verify dates (interns / co-ops) — ${result.verify_dates.length}`}
              items={result.verify_dates}
              accent="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              appliedIds={appliedSet}
              showApplied={showApplied}
              onApply={handleApply}
              onTailor={handleTailor}
            />
          )}

          {result.phoenix.length > 0 && (
            <TierGroup
              title={`📍 Phoenix-area highlights (${result.phoenix.length})`}
              items={result.phoenix}
              accent="border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
              appliedIds={appliedSet}
              showApplied={showApplied}
              onApply={handleApply}
              onTailor={handleTailor}
            />
          )}

          {result.totals.apply_now === 0 && result.totals.verify_dates === 0 && (
            <Card className="border-border/60">
              <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
                <p className="text-sm font-medium">No matches in the past {result.past_days} day(s).</p>
                <p className="text-xs text-muted-foreground">
                  Try widening the window, adding custom role keywords, or pick a preset above.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryBlock({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent || ''}`}>{value}</p>
    </div>
  );
}

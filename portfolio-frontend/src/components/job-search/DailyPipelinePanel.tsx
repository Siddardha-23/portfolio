import { useEffect, useMemo, useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  Zap, Building2, MapPin, ExternalLink, Sparkles, AlertCircle,
  Trophy, Medal, Award, Calendar, RotateCcw, Clock, Globe, Briefcase,
  Tag, CheckCircle2, Eye, EyeOff, Cloud, Server, Layers, Brain, Code2,
  Wand2, Save, Trash2, Check, ChevronDown, BookmarkPlus, Filter, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  PipelinePreset,
  PipelineExperienceLevel,
  PipelineEmploymentType,
  PipelineWorkArrangement,
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
  // Cloud / DevOps / SRE / Platform
  'Cloud Engineer', 'DevOps Engineer', 'Site Reliability Engineer', 'SRE',
  'Platform Engineer', 'Infrastructure Engineer',
  'AWS Engineer', 'Kubernetes Engineer',
  // Backend / Full-Stack / Frontend
  'Backend Engineer', 'Backend Developer',
  'Full Stack Engineer', 'Full Stack Developer',
  'Frontend Engineer', 'Frontend Developer',
  'API Engineer', 'Software Developer',
  // AI / ML
  'AI Engineer', 'Machine Learning Engineer', 'ML Engineer',
  'LLM Engineer', 'GenAI Engineer', 'Applied Scientist',
  // General SWE early-career
  'Software Engineer', 'Software Engineer I',
  'Associate Software Engineer', 'Junior Software Engineer',
  'New Grad Software Engineer', 'Entry Level Software Engineer',
  'Software Development Engineer', 'SDE I',
  'Member of Technical Staff', 'Graduate Software Engineer',
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
  workdayLimit?: number;
  linkedinCount?: number;
  includeIndeed?: boolean;
  // New optional filter knobs — undefined preserves the original
  // hardcoded defaults (entry-level, full-time, US-only, any arrangement).
  location?: string;
  experienceLevel?: PipelineExperienceLevel;
  employmentType?: PipelineEmploymentType;
  workArrangement?: PipelineWorkArrangement;
  domainStrict?: boolean;
  /** F-1 / H-1B opt-ins. Both default off so non-visa users keep the original flow. */
  h1bOnly?: boolean;
  excludeNoSponsorship?: boolean;
  /** Tracks IDs the user has clicked "Open" on but not yet marked applied. */
  openedIds?: string[];
  /** Has the user been auto-prefilled from /suggest-filters at least once? */
  prefilledFromResume?: boolean;
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
function VisaBadge({ status }: { status?: string }) {
  // Render a compact, color-coded badge so an F-1 / H-1B candidate can tell
  // at a glance whether a posting will accept their visa status. We
  // deliberately don't render anything for "unknown" — too noisy when most
  // postings carry no signal.
  if (status === 'sponsor_verified') {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300"
        title="Verified H-1B sponsor — company is on the curated sponsor list or the JD says they sponsor."
      >
        <ShieldCheck className="h-2.5 w-2.5" />
        Sponsors
      </Badge>
    );
  }
  if (status === 'no_sponsorship') {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-red-500/40 bg-red-500/10 text-[9px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-300"
        title="JD explicitly states no visa sponsorship is offered. Skip if you're on F-1 / H-1B."
      >
        <AlertCircle className="h-2.5 w-2.5" />
        No sponsor
      </Badge>
    );
  }
  return null;
}

function PipelineRow({
  rec,
  applied,
  opened,
  focused,
  onOpen,
  onMarkApplied,
  onDismissOpened,
  onTailor,
}: {
  rec: DailyPipelineRecord;
  applied: boolean;
  /** True when the user clicked "Open posting" but hasn't confirmed applied yet. */
  opened: boolean;
  /** True when the keyboard cursor (j/k) is on this row. */
  focused: boolean;
  onOpen: () => void;
  onMarkApplied: () => void;
  onDismissOpened: () => void;
  onTailor: () => void;
}) {
  const tierStyle = TIER_STYLES[rec.tier || ''];
  const cardRef = useRef<HTMLDivElement | null>(null);
  // Auto-scroll the focused row into view when it changes — keeps j/k
  // navigation usable on long tier lists.
  useEffect(() => {
    if (focused && cardRef.current) {
      cardRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focused]);
  const flagList = (rec.flags || '')
    .split(',')
    .map((f) => f.trim())
    .filter((f) => f && f !== '—');

  // Surface "previously applied X days ago" so a row that's been in the
  // funnel for a week doesn't get re-opened by mistake. We render different
  // labels per status so a rejected role doesn't say "Already applied" and
  // a withdrawn one doesn't pretend it's still in flight.
  const prevStatus = rec.previously_applied_status;
  const prevAt = rec.previously_applied_at;
  const prevAgo = (() => {
    if (!prevAt) return '';
    try {
      const days = Math.max(0, Math.floor((Date.now() - new Date(prevAt).getTime()) / 86400000));
      if (days === 0) return 'today';
      if (days === 1) return '1d ago';
      return `${days}d ago`;
    } catch { return ''; }
  })();
  const showPrevApplied = !!prevStatus && prevStatus !== 'interested' && !applied;
  const prevPalette = (() => {
    // Active in funnel → amber (still relevant). Closed-loop → muted gray
    // (rejected/withdrawn — user can still re-apply but signal is weaker).
    switch (prevStatus) {
      case 'applied':
      case 'interview':
      case 'offer':
        return {
          ring: 'border-amber-500/40 bg-amber-500/5',
          chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
          label:
            prevStatus === 'offer' ? 'Offer'
            : prevStatus === 'interview' ? 'In interview'
            : 'Already applied',
        };
      case 'rejected':
        return {
          ring: 'border-rose-500/30 bg-rose-500/5',
          chip: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
          label: 'Rejected previously',
        };
      case 'withdrawn':
        return {
          ring: 'border-gray-400/40 bg-gray-500/5',
          chip: 'bg-gray-500/15 text-gray-600 dark:text-gray-300',
          label: 'Withdrawn',
        };
      default:
        return {
          ring: 'border-amber-500/40 bg-amber-500/5',
          chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
          label: 'Already applied',
        };
    }
  })();

  return (
    <Card
      ref={cardRef}
      className={`group relative rounded-xl border ${
        applied
          ? 'border-emerald-500/40 bg-emerald-500/5 opacity-60'
          : showPrevApplied
          ? prevPalette.ring
          : tierStyle?.ring || 'border-gray-200/80 dark:border-white/[0.08]'
      } bg-white/90 dark:bg-gray-900/50 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
        focused ? 'ring-2 ring-purple-500/60 ring-offset-1 ring-offset-background' : ''
      }`}
    >
      {applied && (
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          Applied · in Saved
        </div>
      )}
      {showPrevApplied && (
        <div
          className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${prevPalette.chip}`}
          title={`Status: ${prevStatus}${prevAt ? ` · last touched ${prevAt.slice(0, 10)}` : ''}`}
        >
          <CheckCircle2 className="h-3 w-3" />
          {prevPalette.label}
          {prevAgo ? ` · ${prevAgo}` : ''}
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
            <VisaBadge status={rec.visa_status} />
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

        <div className="flex flex-shrink-0 flex-col items-stretch gap-1.5 sm:w-32">
          {applied ? (
            <Button
              size="sm"
              disabled
              className="gap-1 bg-emerald-600 text-white"
            >
              <CheckCircle2 className="h-3 w-3" />
              Applied
            </Button>
          ) : opened ? (
            // Two-stage flow — user clicked "Open posting", now confirm.
            <>
              <Button
                size="sm"
                onClick={onMarkApplied}
                className="gap-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90"
                title="Confirm you submitted the application"
              >
                <Check className="h-3 w-3" />
                I applied
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismissOpened}
                className="h-7 gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                title="Didn't apply — dismiss this prompt"
              >
                Not yet
              </Button>
            </>
          ) : rec.url ? (
            <Button
              size="sm"
              onClick={onOpen}
              className="gap-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90"
              title="Open the posting in a new tab — saves it as Interested"
            >
              Open posting
              <ExternalLink className="h-3 w-3" />
            </Button>
          ) : null}
          {!applied && (
            <Button
              size="sm"
              variant="outline"
              onClick={onTailor}
              className="gap-1 border-purple-500/30 text-[11px] text-purple-700 hover:bg-purple-500/10 dark:text-purple-300"
              title="Open this job in Tailor — auto-marks Applied once tailoring saves"
            >
              <Wand2 className="h-3 w-3" />
              Tailor
            </Button>
          )}
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
  openedIds,
  focusedId,
  showApplied,
  onOpen,
  onMarkApplied,
  onDismissOpened,
  onTailor,
}: {
  title: string;
  items: DailyPipelineRecord[];
  accent: string;
  appliedIds: Set<string>;
  openedIds: Set<string>;
  focusedId: string | null;
  showApplied: boolean;
  onOpen: (rec: DailyPipelineRecord) => void;
  onMarkApplied: (rec: DailyPipelineRecord) => void;
  onDismissOpened: (rec: DailyPipelineRecord) => void;
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
          visible.map((rec) => {
            const id = _recordId(rec);
            return (
              <PipelineRow
                key={id}
                rec={rec}
                applied={appliedIds.has(id)}
                opened={openedIds.has(id)}
                focused={focusedId === id}
                onOpen={() => onOpen(rec)}
                onMarkApplied={() => onMarkApplied(rec)}
                onDismissOpened={() => onDismissOpened(rec)}
                onTailor={() => onTailor(rec)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Main panel
// --------------------------------------------------------------------------
export interface PendingPipelinePayload {
  data: SmartFilterSuggestions;
  /**
   * 'replace' — overwrite the form (big "Apply to pipeline" button).
   * 'append'  — merge into existing chips so the user can stack groups.
   */
  mode: 'replace' | 'append';
}

export interface DailyPipelinePanelProps {
  /**
   * Pending suggestions handed in from SmartFiltersPanel — consumed once.
   * Accepts both the legacy bare-SmartFilterSuggestions shape (treated as
   * replace) AND the new {data, mode} envelope so the parent can opt into
   * append-mode for per-group stacking.
   */
  pendingSuggestions?: SmartFilterSuggestions | PendingPipelinePayload | null;
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
  const [workdayLimit, setWorkdayLimit] = useState<number>(persisted?.workdayLimit ?? 300);
  const [linkedinCount, setLinkedinCount] = useState<number>(persisted?.linkedinCount ?? 80);
  const [includeIndeed, setIncludeIndeed] = useState<boolean>(persisted?.includeIndeed ?? false);

  // New filter knobs — defaults match the previous hardcoded behavior so a
  // first-time visitor or a user who never opens the Filters drawer gets the
  // exact same scrape they got before this change.
  const [location, setLocation] = useState<string>(persisted?.location ?? 'United States');
  const [experienceLevel, setExperienceLevel] = useState<PipelineExperienceLevel>(persisted?.experienceLevel ?? 'entry');
  const [employmentType, setEmploymentType] = useState<PipelineEmploymentType>(persisted?.employmentType ?? 'FULLTIME');
  const [workArrangement, setWorkArrangement] = useState<PipelineWorkArrangement>(persisted?.workArrangement ?? 'any');
  const [domainStrict, setDomainStrict] = useState<boolean>(persisted?.domainStrict ?? false);
  const [h1bOnly, setH1bOnly] = useState<boolean>(persisted?.h1bOnly ?? false);
  const [excludeNoSponsorship, setExcludeNoSponsorship] = useState<boolean>(persisted?.excludeNoSponsorship ?? false);

  // Named presets — server-backed so they survive across browsers/devices.
  const [presets, setPresets] = useState<PipelinePreset[]>([]);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  const presetMenuRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DailyPipelineResult | null>(persisted?.result ?? null);
  const [resultAt, setResultAt] = useState<number | null>(persisted?.resultAt ?? null);
  const [appliedIds, setAppliedIds] = useState<string[]>(persisted?.appliedIds ?? []);
  const [openedIds, setOpenedIds] = useState<string[]>(persisted?.openedIds ?? []);
  const [showApplied, setShowApplied] = useState<boolean>(persisted?.showApplied ?? true);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  // Bumped each time we want to pop the Apify key card open (e.g. after a
  // credit-exhausted run). The card only reacts when this value changes.
  const [apifyForceOpen, setApifyForceOpen] = useState<number | undefined>(undefined);
  const prefilledRef = useRef<boolean>(persisted?.prefilledFromResume ?? false);

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
      workdayLimit,
      linkedinCount,
      includeIndeed,
      location,
      experienceLevel,
      employmentType,
      workArrangement,
      domainStrict,
      h1bOnly,
      excludeNoSponsorship,
      openedIds,
      prefilledFromResume: prefilledRef.current,
    });
  }, [
    linkedinKws, workdayTitles, customRoles, pastDays, showAdvanced,
    result, resultAt, appliedIds, showApplied, workdayLimit, linkedinCount, includeIndeed,
    location, experienceLevel, employmentType, workArrangement, domainStrict,
    h1bOnly, excludeNoSponsorship, openedIds,
  ]);

  // Auto-prefill from /pipeline/suggest-filters on first ever mount when the
  // user has a parsed resume but has never explicitly edited the form. We
  // never overwrite a user's saved state — once they touch a chip, they own
  // the form. Silent on failure (e.g. no resume uploaded yet).
  useEffect(() => {
    if (prefilledRef.current) return;
    if (persisted) return; // user has a saved state already
    let cancelled = false;
    apiService.suggestPipelineFilters().then((resp) => {
      if (cancelled || !resp.data?.suggestions) return;
      const s = resp.data.suggestions;
      if (s.linkedin_keyword_sets?.length) setLinkedinKws(s.linkedin_keyword_sets);
      if (s.workday_titles?.length) setWorkdayTitles(s.workday_titles);
      if (s.custom_role_terms?.length) setCustomRoles(s.custom_role_terms);
      if (typeof s.past_days === 'number') setPastDays(s.past_days);
      prefilledRef.current = true;
      toast.success('Pipeline pre-filled from your resume — adjust before running.', {
        duration: 3500,
      });
    }).catch(() => { /* no resume — user fills in manually */ });
    return () => { cancelled = true; };
  }, [persisted]);

  // Load saved presets on mount.
  useEffect(() => {
    apiService.listPipelinePresets().then((resp) => {
      if (resp.data?.presets) setPresets(resp.data.presets);
    }).catch(() => { /* presets are best-effort */ });
  }, []);

  // Click-outside to close presets menu.
  useEffect(() => {
    if (!presetMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (presetMenuRef.current && !presetMenuRef.current.contains(e.target as Node)) {
        setPresetMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [presetMenuOpen]);

  // Consume incoming smart-filter suggestions
  useEffect(() => {
    if (!pendingSuggestions) return;
    // Detect envelope vs bare-suggestions for backwards compat.
    const isEnvelope = (val: any): val is PendingPipelinePayload =>
      val && typeof val === 'object' && 'data' in val && 'mode' in val;
    const data: SmartFilterSuggestions = isEnvelope(pendingSuggestions)
      ? pendingSuggestions.data
      : pendingSuggestions;
    const mode: 'replace' | 'append' = isEnvelope(pendingSuggestions)
      ? pendingSuggestions.mode
      : 'replace';

    if (mode === 'append') {
      // Stack onto existing chips, dedup case-insensitively.
      const merge = (current: string[], incoming: string[]) => {
        const seen = new Set(current.map((s) => s.toLowerCase()));
        const next = [...current];
        for (const item of incoming || []) {
          const trimmed = (item || '').trim();
          if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
          seen.add(trimmed.toLowerCase());
          next.push(trimmed);
        }
        return next;
      };
      setLinkedinKws((prev) => merge(prev, data.linkedin_keyword_sets || []));
      setWorkdayTitles((prev) => merge(prev, data.workday_titles || []));
      setCustomRoles((prev) => merge(prev, data.custom_role_terms || []));
      // past_days is a single value; keep whatever the user already has.
    } else {
      setLinkedinKws(data.linkedin_keyword_sets);
      setWorkdayTitles(data.workday_titles);
      setCustomRoles(data.custom_role_terms);
      if (typeof data.past_days === 'number') setPastDays(data.past_days);
    }
    setShowAdvanced(true);
    setActivePreset(null);
    prefilledRef.current = true;
    onSuggestionsConsumed?.();
  }, [pendingSuggestions, onSuggestionsConsumed]);

  const appliedSet = useMemo(() => new Set(appliedIds), [appliedIds]);
  const openedSet = useMemo(() => new Set(openedIds), [openedIds]);

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
      workday_limit: workdayLimit,
      linkedin_count: linkedinCount,
      include_indeed: includeIndeed,
      // Only forward the new knobs when they differ from the original
      // hardcoded behavior. Sending the defaults explicitly is fine — the
      // backend treats "entry"/"FULLTIME"/"any"/"United States" as the
      // pre-existing baseline. We always send so the request is explicit.
      location,
      experience_level: experienceLevel,
      employment_type: employmentType,
      work_arrangement: workArrangement,
      domain_strict: domainStrict,
      h1b_only: h1bOnly,
      exclude_no_sponsorship: excludeNoSponsorship,
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
    if (resp.data.credits_exhausted) {
      setApifyForceOpen(Date.now());
      toast.error(
        'Apify credits are exhausted. Update your API key to keep running the pipeline.',
        { duration: 8000 },
      );
    } else {
      toast.success(
        `Pipeline complete: ${resp.data.totals.apply_now} jobs to apply` +
          (resp.data.totals.verify_dates ? `, ${resp.data.totals.verify_dates} to verify` : ''),
      );
    }
  };

  const handleReset = () => {
    setLinkedinKws(DEFAULT_LINKEDIN_KEYWORDS);
    setWorkdayTitles(DEFAULT_WORKDAY_TITLES);
    setCustomRoles([]);
    setPastDays(1);
    setLocation('United States');
    setExperienceLevel('entry');
    setEmploymentType('FULLTIME');
    setWorkArrangement('any');
    setDomainStrict(false);
    setH1bOnly(false);
    setExcludeNoSponsorship(false);
    setActivePreset(null);
    setResult(null);
    setResultAt(null);
  };

  // ----- Preset save / load / delete handlers ------------------------
  const handleSavePreset = async () => {
    const name = presetNameInput.trim();
    if (!name) return;
    const filters: DailyPipelineParams = {
      linkedin_keywords: linkedinKws,
      workday_titles: workdayTitles,
      custom_role_terms: customRoles,
      past_days: pastDays,
      linkedin_count: linkedinCount,
      workday_limit: workdayLimit,
      include_indeed: includeIndeed,
      location,
      experience_level: experienceLevel,
      employment_type: employmentType,
      work_arrangement: workArrangement,
      domain_strict: domainStrict,
      h1b_only: h1bOnly,
      exclude_no_sponsorship: excludeNoSponsorship,
    };
    const resp = await apiService.savePipelinePreset(name, filters);
    if (resp.error) {
      toast.error(resp.error);
      return;
    }
    if (resp.data?.presets) setPresets(resp.data.presets);
    setSavePresetOpen(false);
    setPresetNameInput('');
    toast.success(`Preset "${name}" saved`);
  };

  const handleLoadPreset = (preset: PipelinePreset) => {
    const f = preset.filters || {};
    if (Array.isArray(f.linkedin_keywords)) setLinkedinKws(f.linkedin_keywords);
    if (Array.isArray(f.workday_titles)) setWorkdayTitles(f.workday_titles);
    if (Array.isArray(f.custom_role_terms)) setCustomRoles(f.custom_role_terms);
    if (typeof f.past_days === 'number') setPastDays(f.past_days);
    if (typeof f.linkedin_count === 'number') setLinkedinCount(f.linkedin_count);
    if (typeof f.workday_limit === 'number') setWorkdayLimit(f.workday_limit);
    if (typeof f.include_indeed === 'boolean') setIncludeIndeed(f.include_indeed);
    if (typeof f.location === 'string') setLocation(f.location);
    if (f.experience_level) setExperienceLevel(f.experience_level);
    if (f.employment_type) setEmploymentType(f.employment_type);
    if (f.work_arrangement) setWorkArrangement(f.work_arrangement);
    if (typeof f.domain_strict === 'boolean') setDomainStrict(f.domain_strict);
    if (typeof f.h1b_only === 'boolean') setH1bOnly(f.h1b_only);
    if (typeof f.exclude_no_sponsorship === 'boolean') setExcludeNoSponsorship(f.exclude_no_sponsorship);
    setActivePreset(null);
    setPresetMenuOpen(false);
    toast.success(`Loaded preset "${preset.name}"`);
  };

  const handleDeletePreset = async (preset: PipelinePreset, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete preset "${preset.name}"?`)) return;
    const resp = await apiService.deletePipelinePreset(preset.name);
    if (resp.error) {
      toast.error(resp.error);
      return;
    }
    if (resp.data?.presets) setPresets(resp.data.presets);
    toast.success(`Deleted "${preset.name}"`);
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

  // Build the Job payload we save / update — shared between the open and
  // mark-applied paths.
  const _jobPayload = (rec: DailyPipelineRecord) => ({
    job_id: _recordId(rec),
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
  });

  // Open the posting in a new tab AND save it as "interested" (not applied).
  // Tracks the click so the row can later prompt "Did you apply?". This is
  // the new primary action — the previous "Apply" button silently marked the
  // job applied even if the user didn't actually submit, which polluted the
  // funnel analytics.
  const handleOpenPosting = async (rec: DailyPipelineRecord) => {
    const id = _recordId(rec);
    if (rec.url) window.open(rec.url, '_blank', 'noopener,noreferrer');
    setOpenedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    try {
      await apiService.saveJob(_jobPayload(rec) as any);
    } catch {
      /* tolerate duplicate save */
    }
    // Best-effort activity event so the resume profiler picks up the click
    // as a feedback signal toward this role family.
    try {
      await apiService.recordMomentumActivity('job_click', {
        record_id: id,
        job_title: rec.title,
        company: rec.company,
      });
    } catch { /* best effort */ }
    onJobApplied?.();
  };

  // Confirm the user actually submitted the application — flips the saved
  // job's status from "interested" to "applied" and adds it to the local
  // appliedIds. This is the only path that increments the funnel.
  const handleMarkApplied = async (rec: DailyPipelineRecord) => {
    const id = _recordId(rec);
    try {
      await apiService.saveJob(_jobPayload(rec) as any);
    } catch {
      /* duplicate-ok */
    }
    await apiService.updateSavedJob(id, { status: 'applied' });
    setAppliedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setOpenedIds((prev) => prev.filter((x) => x !== id));
    try {
      await apiService.recordMomentumActivity('job_applied', {
        record_id: id,
        job_title: rec.title,
        company: rec.company,
      });
    } catch { /* best effort */ }
    onJobApplied?.();
    toast.success('Marked as applied — funnel updated.');
  };

  // User clicked "Open" but hasn't yet hit "Mark applied" — they can dismiss
  // the prompt to remove the row from the "did-you-apply?" reminder list.
  const handleDismissOpened = (rec: DailyPipelineRecord) => {
    const id = _recordId(rec);
    setOpenedIds((prev) => prev.filter((x) => x !== id));
  };

  const tier1 = (result?.apply_now || []).filter((r) => r.tier === 'Tier 1');
  const tier2 = (result?.apply_now || []).filter((r) => r.tier === 'Tier 2');
  const tier3 = (result?.apply_now || []).filter((r) => r.tier === 'Tier 3');
  const allApplyNow = result?.apply_now || [];
  const remainingApply = allApplyNow.filter((r) => !appliedSet.has(_recordId(r))).length;

  // Daily-digest stats — surfaced at the top so an F-1 student can see in one
  // glance how many fresh sponsors / on-domain matches / Phoenix rows are
  // waiting today, instead of scrolling through three tier groups to count.
  const todayIso = new Date().toISOString().slice(0, 10);
  const _isFresh = (r: DailyPipelineRecord) => (r.posted || '').slice(0, 10) === todayIso;
  // "Already applied" for digest purposes = active funnel state. Closed-loop
  // statuses (rejected/withdrawn) and pre-confirm "interested" don't count
  // because the user might still want to re-engage.
  const _alreadyApplied = (r: DailyPipelineRecord) =>
    r.previously_applied_status === 'applied' ||
    r.previously_applied_status === 'interview' ||
    r.previously_applied_status === 'offer';
  const digest = useMemo(() => {
    if (!result) return null;
    const all = [...(result.apply_now || []), ...(result.verify_dates || [])];
    const eligible = all.filter((r) => !appliedSet.has(_recordId(r)) && !_alreadyApplied(r));
    return {
      total: eligible.length,
      fresh: eligible.filter(_isFresh).length,
      sponsors: eligible.filter((r) => r.visa_status === 'sponsor_verified').length,
      noSponsor: all.filter((r) => r.visa_status === 'no_sponsorship').length,
      phoenix: (result.phoenix || []).filter((r) => !appliedSet.has(_recordId(r))).length,
      tier1Open: tier1.filter((r) => !appliedSet.has(_recordId(r)) && !_alreadyApplied(r)).length,
      alreadyApplied: all.filter(_alreadyApplied).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, appliedSet]);

  // Bulk-open Tier 1 — opens the top N postings in new tabs and saves each as
  // Interested. Browsers throttle multi-window.open, but every modern
  // browser allows it within a single user-gesture handler. Skips any row
  // already applied or marked previously-applied.
  const handleBulkOpen = async (rows: DailyPipelineRecord[], n: number) => {
    const candidates = rows.filter(
      (r) => !!r.url && !appliedSet.has(_recordId(r)) && !_alreadyApplied(r),
    ).slice(0, n);
    if (!candidates.length) {
      toast.info('Nothing fresh to open in this batch.');
      return;
    }
    for (const rec of candidates) {
      window.open(rec.url, '_blank', 'noopener,noreferrer');
    }
    // Background: save as Interested + log click for each. Don't await — we
    // want the tabs to open immediately within the user-gesture window.
    candidates.forEach((rec) => {
      const id = _recordId(rec);
      setOpenedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      apiService.saveJob(_jobPayload(rec) as any).catch(() => { /* dup-ok */ });
      apiService.recordMomentumActivity('job_click', {
        record_id: id,
        job_title: rec.title,
        company: rec.company,
        bulk: true,
      }).catch(() => { /* best-effort */ });
    });
    toast.success(`Opened ${candidates.length} postings — confirm "I applied" on each row after submitting.`);
  };

  // Keyboard shortcuts — j/k navigate, o open, a mark applied, t tailor.
  // Only active when the pipeline tab is mounted with results AND no input/
  // textarea is focused (so chip/preset typing isn't intercepted).
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  useEffect(() => {
    const visibleRows = (showApplied
      ? allApplyNow
      : allApplyNow.filter((r) => !appliedSet.has(_recordId(r)))
    );
    if (!visibleRows.length) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (t && t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const ids = visibleRows.map(_recordId);
      const idx = focusedRowId ? ids.indexOf(focusedRowId) : -1;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = ids[Math.min(ids.length - 1, idx + 1)] ?? ids[0];
        setFocusedRowId(next);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = ids[Math.max(0, idx - 1)] ?? ids[0];
        setFocusedRowId(next);
      } else if (e.key === 'o' && idx >= 0) {
        e.preventDefault();
        const rec = visibleRows[idx];
        if (rec) handleOpenPosting(rec);
      } else if (e.key === 'a' && idx >= 0) {
        e.preventDefault();
        const rec = visibleRows[idx];
        if (rec) handleMarkApplied(rec);
      } else if (e.key === 't' && idx >= 0) {
        e.preventDefault();
        const rec = visibleRows[idx];
        if (rec) handleTailor(rec);
      } else if (e.key === '?') {
        e.preventDefault();
        toast.info('Shortcuts: j/k navigate · o open · a mark applied · t tailor', { duration: 4000 });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allApplyNow, appliedSet, showApplied, focusedRowId]);

  return (
    <div className="space-y-6">
      {/* BYO Apify key */}
      <ApifyKeyCard forceOpenSignal={apifyForceOpen} />

      {/* Hero / config */}
      <Card className="overflow-hidden border-gray-200/80 dark:border-white/[0.08] bg-white/90 dark:bg-gray-900/50 bg-gradient-to-br from-purple-500/5 via-transparent to-indigo-500/5 dark:from-transparent dark:via-transparent dark:to-transparent">
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
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-300 hover:border-purple-500/30"
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

          {/* Preset persona chips + Saved presets bar */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <Tag className="mr-1 inline h-3 w-3" />
                Quick presets
              </p>
              <div className="relative flex items-center gap-1.5" ref={presetMenuRef}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSavePresetOpen((v) => !v)}
                  className="h-7 gap-1 text-[11px]"
                  title="Save the current pipeline form as a named preset"
                >
                  <BookmarkPlus className="h-3 w-3" />
                  Save preset
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPresetMenuOpen((v) => !v)}
                  disabled={presets.length === 0}
                  className="h-7 gap-1 text-[11px]"
                  title={presets.length === 0 ? 'No saved presets yet' : 'Load a saved preset'}
                >
                  My presets {presets.length > 0 ? `(${presets.length})` : ''}
                  <ChevronDown className="h-3 w-3" />
                </Button>
                {presetMenuOpen && presets.length > 0 && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-72 max-h-80 overflow-auto rounded-lg border border-border/80 bg-white shadow-lg dark:bg-gray-900">
                    <ul className="py-1 text-xs">
                      {presets.map((p) => (
                        <li key={p.name}>
                          <button
                            type="button"
                            onClick={() => handleLoadPreset(p)}
                            className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left hover:bg-purple-500/10"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">{p.name}</p>
                              <p className="truncate text-[10px] text-muted-foreground">
                                {p.filters?.experience_level || 'entry'} · {p.filters?.employment_type || 'FULLTIME'}
                                {p.filters?.location ? ` · ${p.filters.location}` : ''}
                                {p.filters?.domain_strict ? ' · strict' : ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleDeletePreset(p, e)}
                              className="flex-shrink-0 rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-600"
                              title="Delete preset"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {savePresetOpen && (
              <div className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/5 p-2">
                <Input
                  value={presetNameInput}
                  onChange={(e) => setPresetNameInput(e.target.value)}
                  placeholder="Preset name (e.g. ML strict, Cloud broad)"
                  maxLength={60}
                  className="h-8 text-xs"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); }}
                />
                <Button size="sm" onClick={handleSavePreset} disabled={!presetNameInput.trim()} className="gap-1 bg-purple-600 text-white hover:bg-purple-700">
                  <Save className="h-3 w-3" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setSavePresetOpen(false); setPresetNameInput(''); }} className="text-[11px]">
                  Cancel
                </Button>
              </div>
            )}

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
                        : 'border-gray-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/40 hover:border-purple-500/40 hover:bg-purple-500/5'
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

          {/* Filter drawer — actor-supported filters. Defaults reproduce
              the previous hardcoded behavior so leaving these untouched
              gives the same scrape as before. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <MapPin className="mr-1 inline h-3 w-3" />
                Location
              </label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="United States"
                className="h-8 text-xs"
                maxLength={80}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Experience
              </label>
              <Select value={experienceLevel} onValueChange={(v) => setExperienceLevel(v as PipelineExperienceLevel)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any level</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                  <SelectItem value="entry">Entry · 0-2y</SelectItem>
                  <SelectItem value="associate">Associate · 0-5y</SelectItem>
                  <SelectItem value="mid">Mid · 3-5y</SelectItem>
                  <SelectItem value="senior">Senior · 5-10y</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Employment
              </label>
              <Select value={employmentType} onValueChange={(v) => setEmploymentType(v as PipelineEmploymentType)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANY">Any</SelectItem>
                  <SelectItem value="FULLTIME">Full-time</SelectItem>
                  <SelectItem value="PARTTIME">Part-time</SelectItem>
                  <SelectItem value="INTERN">Internship</SelectItem>
                  <SelectItem value="CONTRACTOR">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Work mode
              </label>
              <Select value={workArrangement} onValueChange={(v) => setWorkArrangement(v as PipelineWorkArrangement)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="onsite">On-site</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex flex-col justify-between gap-1 rounded-lg border border-border/60 bg-muted/20 p-2 cursor-pointer hover:border-purple-500/40 sm:col-span-2 lg:col-span-1">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                Domain strict
              </span>
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={domainStrict}
                  onChange={(e) => setDomainStrict(e.target.checked)}
                  className="h-3.5 w-3.5 accent-purple-600"
                />
                <span className="text-[11px] leading-tight text-muted-foreground">
                  Drop off-domain titles entirely
                </span>
              </span>
            </label>
          </div>

          {/* F-1 / H-1B mode — opt-in for international students. Compact panel
              that surfaces the two visa toggles together with a one-click
              "F-1 friendly" combo and a short explainer. Off by default; the
              entire panel collapses when both toggles are off (keeps non-visa
              users from seeing visa-specific UI clutter). */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-0.5">
                <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  <ShieldCheck className="h-3 w-3" />
                  F-1 / H-1B mode
                </p>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Optional — for visa candidates. Drops postings that explicitly
                  say "no sponsorship" or restrict to US citizens.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setExcludeNoSponsorship(true);
                  setH1bOnly(false);
                  toast.success('F-1 friendly mode on — postings that say "no sponsorship" will be dropped.');
                }}
                className="h-7 gap-1 text-[11px] border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
              >
                <Sparkles className="h-3 w-3" />
                F-1 friendly
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex items-start gap-2 rounded-md border border-border/60 bg-background/60 p-2 cursor-pointer hover:border-amber-500/40">
                <input
                  type="checkbox"
                  checked={excludeNoSponsorship}
                  onChange={(e) => setExcludeNoSponsorship(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-amber-600"
                />
                <div className="space-y-0.5">
                  <p className="text-[11px] font-medium leading-tight">Hide "no sponsorship" postings</p>
                  <p className="text-[10px] leading-tight text-muted-foreground">
                    Scans the JD for "must be authorized to work without sponsorship", "GC required", etc.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-2 rounded-md border border-border/60 bg-background/60 p-2 cursor-pointer hover:border-amber-500/40">
                <input
                  type="checkbox"
                  checked={h1bOnly}
                  onChange={(e) => setH1bOnly(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-amber-600"
                />
                <div className="space-y-0.5">
                  <p className="text-[11px] font-medium leading-tight">Verified sponsors only (strict)</p>
                  <p className="text-[10px] leading-tight text-muted-foreground">
                    Show only known H-1B sponsors or postings that affirmatively say "we sponsor".
                    Trims recall — leave off for first pass.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Quick controls */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <Calendar className="mr-1 inline h-3 w-3" />
                Past days
              </label>
              <Select
                value={String(pastDays)}
                onValueChange={(v) => setPastDays(Math.max(0, Math.min(30, Number(v) || 0)))}
              >
                <SelectTrigger className="focus:border-purple-500/40 focus:ring-purple-500/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Today only</SelectItem>
                  <SelectItem value="1">Past 1 day</SelectItem>
                  <SelectItem value="3">Past 3 days</SelectItem>
                  <SelectItem value="7">Past week</SelectItem>
                  <SelectItem value="14">Past 2 weeks</SelectItem>
                  <SelectItem value="30">Past month</SelectItem>
                </SelectContent>
              </Select>
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
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced((v) => !v)}
            className="gap-1 text-xs border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-300 hover:border-purple-500/30"
          >
            {showAdvanced ? '▾' : '▸'} Advanced — edit LinkedIn searches & Workday titles
          </Button>

          {showAdvanced && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Per-source recall caps (raise for slow days, lower to save Apify credits)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">LinkedIn jobs / phrase</label>
                    <Select value={String(linkedinCount)} onValueChange={(v) => setLinkedinCount(Number(v))}>
                      <SelectTrigger className="focus:border-purple-500/40 focus:ring-purple-500/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="40">40 (fast)</SelectItem>
                        <SelectItem value="80">80 (default)</SelectItem>
                        <SelectItem value="120">120</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                        <SelectItem value="250">250 (max)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Workday total limit</label>
                    <Select value={String(workdayLimit)} onValueChange={(v) => setWorkdayLimit(Number(v))}>
                      <SelectTrigger className="focus:border-purple-500/40 focus:ring-purple-500/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">100 (fast)</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                        <SelectItem value="300">300 (default)</SelectItem>
                        <SelectItem value="500">500</SelectItem>
                        <SelectItem value="800">800 (max)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Higher caps return more raw rows. Filtering accuracy stays the same — only recall changes.
                </p>
                <label className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 p-2 cursor-pointer hover:border-purple-500/40">
                  <input
                    type="checkbox"
                    checked={includeIndeed}
                    onChange={(e) => setIncludeIndeed(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 accent-purple-600"
                  />
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-medium leading-tight">Include Indeed (extra Apify cost)</p>
                    <p className="text-[10px] leading-tight text-muted-foreground">
                      ~$0.75 / run. Off by default — Indeed dates are unreliable and listings are dominated by body-shop reposts. Turn on for slow days when you've exhausted LinkedIn / Workday / ATS direct.
                    </p>
                  </div>
                </label>
              </div>
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
        <Card className="border-red-500/40 bg-red-500/5 dark:bg-red-500/10">
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
          {result.credits_exhausted && (
            <Card className="border-red-500/40 bg-red-500/5">
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                  <div>
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                      Apify credits exhausted
                    </p>
                    <p className="text-[11px] text-red-700/80 dark:text-red-300/80">
                      The Apify token used for this run hit its monthly limit. Add or update your own
                      Apify API key above to keep running the daily pipeline — your free Apify account
                      includes ~$5 monthly credit.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setApifyForceOpen(Date.now())}
                  className="gap-1.5 bg-gradient-to-r from-red-500 to-rose-500 text-white hover:opacity-90"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Update API key
                </Button>
              </CardContent>
            </Card>
          )}
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

          {/* Daily digest — sticky one-liner so the user sees today's volume,
              sponsor count, freshness, and already-applied dedup count
              without scrolling through three tier groups to count by hand. */}
          {digest && digest.total > 0 && (
            <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-indigo-500/5">
              <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                    {digest.total} fresh to triage
                  </span>
                  {digest.fresh > 0 && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Clock className="h-3 w-3" />
                      {digest.fresh} posted today
                    </span>
                  )}
                  {digest.sponsors > 0 && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-3 w-3" />
                      {digest.sponsors} sponsor-verified
                    </span>
                  )}
                  {digest.alreadyApplied > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <CheckCircle2 className="h-3 w-3" />
                      {digest.alreadyApplied} you already applied to
                    </span>
                  )}
                  {digest.noSponsor > 0 && (
                    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                      <AlertCircle className="h-3 w-3" />
                      {digest.noSponsor} no-sponsor (demoted)
                    </span>
                  )}
                  {digest.phoenix > 0 && (
                    <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400">
                      <MapPin className="h-3 w-3" />
                      {digest.phoenix} Phoenix-area
                    </span>
                  )}
                </div>
                {digest.tier1Open > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleBulkOpen(tier1, Math.min(5, digest.tier1Open))}
                      className="h-7 gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-[11px] text-white hover:opacity-90"
                      title="Open the top 5 Tier-1 postings in new tabs at once"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open top {Math.min(5, digest.tier1Open)} in tabs
                    </Button>
                    <span
                      className="hidden text-[10px] text-muted-foreground sm:inline"
                      title="Press ? on this page for keyboard shortcuts"
                    >
                      ⌨ <kbd className="rounded border border-border/60 px-1 font-mono text-[9px]">?</kbd>
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <TierGroup
            title={`🥇 Tier 1 — apply first (${tier1.length})`}
            items={tier1}
            accent="border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
            appliedIds={appliedSet}
            openedIds={openedSet}
            focusedId={focusedRowId}
            showApplied={showApplied}
            onOpen={handleOpenPosting}
            onMarkApplied={handleMarkApplied}
            onDismissOpened={handleDismissOpened}
            onTailor={handleTailor}
          />
          <TierGroup
            title={`🥈 Tier 2 (${tier2.length})`}
            items={tier2}
            accent="border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300"
            appliedIds={appliedSet}
            openedIds={openedSet}
            focusedId={focusedRowId}
            showApplied={showApplied}
            onOpen={handleOpenPosting}
            onMarkApplied={handleMarkApplied}
            onDismissOpened={handleDismissOpened}
            onTailor={handleTailor}
          />
          <TierGroup
            title={`🥉 Tier 3 (${tier3.length})`}
            items={tier3}
            accent="border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300"
            appliedIds={appliedSet}
            openedIds={openedSet}
            focusedId={focusedRowId}
            showApplied={showApplied}
            onOpen={handleOpenPosting}
            onMarkApplied={handleMarkApplied}
            onDismissOpened={handleDismissOpened}
            onTailor={handleTailor}
          />

          {result.verify_dates.length > 0 && (
            <TierGroup
              title={`⚠️ Verify dates (interns / co-ops) — ${result.verify_dates.length}`}
              items={result.verify_dates}
              accent="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              appliedIds={appliedSet}
              openedIds={openedSet}
              focusedId={focusedRowId}
              showApplied={showApplied}
              onOpen={handleOpenPosting}
              onMarkApplied={handleMarkApplied}
              onDismissOpened={handleDismissOpened}
              onTailor={handleTailor}
            />
          )}

          {result.phoenix.length > 0 && (
            <TierGroup
              title={`📍 Phoenix-area highlights (${result.phoenix.length})`}
              items={result.phoenix}
              accent="border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
              appliedIds={appliedSet}
              openedIds={openedSet}
              focusedId={focusedRowId}
              showApplied={showApplied}
              onOpen={handleOpenPosting}
              onMarkApplied={handleMarkApplied}
              onDismissOpened={handleDismissOpened}
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

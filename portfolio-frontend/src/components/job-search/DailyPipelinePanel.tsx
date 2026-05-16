import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  Zap, Building2, MapPin, ExternalLink, Sparkles, AlertCircle,
  Trophy, Medal, Award, Calendar, RotateCcw, Clock, Globe, Briefcase,
  Tag, CheckCircle2, Eye, EyeOff, Cloud, Server, Layers, Brain, Code2,
  Wand2, Save, Trash2, Check, ChevronDown, BookmarkPlus, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChipsInput } from './ChipsInput';
import { ApifyKeyCard } from './ApifyKeyCard';
import { ReachOutModal } from './ReachOutModal';
import { useAuth } from '@/contexts/AuthContext';
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
// DOMAIN-NEUTRAL defaults — used ONLY when:
//   · the user hasn't uploaded a resume yet, OR
//   · the resume-driven suggester returned an error
// These intentionally avoid biasing toward any single role family
// (cloud / backend / frontend / AI). Once the suggester runs against the
// user's resume, these get replaced with personalized titles.
const DEFAULT_LINKEDIN_KEYWORDS = [
  'software engineer new grad',
  'software engineer entry level',
  'software developer entry level',
  'software engineer h1b sponsor',
  'graduate software engineer',
];

const DEFAULT_WORKDAY_TITLES = [
  // Generic early-career SWE titles only — no domain anchors.
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
// Storage key is user-scoped: every entry lives under
// `daily_pipeline_state_v2:<user_email>` so two users on the same browser
// never read each other's filters / snoozes / mutes / applied IDs.
// Anonymous fallback keeps the panel usable before login.
const STORAGE_KEY_PREFIX = 'daily_pipeline_state_v2';
function storageKey(userEmail: string | null | undefined): string {
  const slug = (userEmail || '').trim().toLowerCase() || 'anonymous';
  return `${STORAGE_KEY_PREFIX}:${slug}`;
}
// Legacy global key — read once on first mount to migrate the old blob into
// the user-scoped key so nobody loses their snoozes / mutes during the rollout.
const LEGACY_STORAGE_KEY = 'daily_pipeline_state_v2';

// Bump when the resume-driven filter-suggester taxonomy changes so we drop
// stale linkedinKws / workdayTitles / customRoles that were derived from an
// older profiler. We preserve everything else (snoozes, mutes, counters,
// applied ids) — only the resume-derived filters get invalidated.
// v3: new resume-driven title synthesizer (Gemini Pro reads actual resume
// content) replaces the static per-intent seed lists.
// v4 (May 2026): force re-fetch after defaults were made domain-neutral
// and the silent-catch failure mode was replaced with a loud CTA. Existing
// users whose persisted state still has cloud-flavored defaults from the
// pre-personalization era will get a fresh synth call on their next mount.
const FILTERS_DERIVED_VERSION = 4;
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
  /**
   * IDs the user has acknowledged seeing — anything in the current result
   * that is NOT in this set gets a "NEW" badge. Capped at 1500 entries to
   * keep localStorage payload tiny. Updated on "Mark all seen" or after the
   * result has been on-screen for a while.
   */
  seenIds?: string[];
  /**
   * Per-row snooze map: id → ISO date string until which the row is hidden.
   * Anything in the past is implicitly cleared at next result render.
   */
  snoozedUntil?: Record<string, string>;
  /** Daily application quota goal — student-tunable, defaults to 5. */
  dailyGoal?: number;
  /** Per-day application counter — { date: 'YYYY-MM-DD', count: N }. */
  dailyApplied?: { date: string; count: number };
  /**
   * Rows the user has checked for the "Run batch tailor" flow. Purely
   * additive — single-row Tailor still works exactly as before. Persisted
   * so a refresh during selection doesn't lose progress.
   */
  batchSelectedIds?: string[];
  /**
   * Companies the user dismissed (e.g. repeated Stripe rows that don't
   * sponsor). Dropped entirely from the next pipeline run.
   */
  hideCompanies?: string[];
  /** Title substrings the user wants suppressed (e.g. "Senior", "Lead",
   *  "Staff") without blocking the whole company. */
  hideTitlePatterns?: string[];
  /** Max apply_now rows per company before extras get demoted to verify. */
  maxPerCompany?: number;
  /** Version of the filter-suggester taxonomy that produced linkedinKws /
   *  workdayTitles / customRoles. When this lags FILTERS_DERIVED_VERSION we
   *  drop those fields so the next mount re-fetches from /suggest-filters. */
  filtersDerivedVersion?: number;
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
      excluded_sample: state.result.excluded_sample.map(slim),
    },
  };
}

// Tracks which user the in-memory cache belongs to, so a logout / login on
// the same tab doesn't bleed state across users via _memoryCache.
let _memoryCacheOwner: string | null = null;

function readPersisted(userEmail: string | null | undefined): PersistedState | null {
  const key = storageKey(userEmail);
  // Invalidate the in-memory cache if the owning user changed (cross-account
  // switch on the same browser without a refresh).
  if (_memoryCache && _memoryCacheOwner !== key) {
    _memoryCache = null;
    _memoryCacheOwner = null;
  }
  if (_memoryCache) {
    if (_memoryCache.result && _memoryCache.resultAt && Date.now() - _memoryCache.resultAt > RESULT_TTL_MS) {
      _memoryCache = { ..._memoryCache, result: null, resultAt: null };
    }
    return _memoryCache;
  }
  try {
    let raw = sessionStorage.getItem(key);
    // One-time migration: if no user-scoped entry exists yet but a legacy
    // global one does, adopt it as this user's starting state and DROP the
    // global key so the next user on this browser starts fresh.
    if (!raw) {
      const legacy = sessionStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy && key !== LEGACY_STORAGE_KEY) {
        try {
          sessionStorage.setItem(key, legacy);
          sessionStorage.removeItem(LEGACY_STORAGE_KEY);
          raw = legacy;
        } catch { /* quota */ }
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.result && parsed.resultAt && Date.now() - parsed.resultAt > RESULT_TTL_MS) {
      parsed.result = null;
      parsed.resultAt = null;
    }
    // Surgical cache-bust: when the profiler taxonomy bumps, drop stale
    // resume-derived filters and the prefilled flag so the next mount
    // re-fetches accurate titles. Everything else (snoozes, mutes, counters)
    // is preserved.
    if ((parsed.filtersDerivedVersion ?? 0) < FILTERS_DERIVED_VERSION) {
      parsed.linkedinKws = undefined as unknown as string[];
      parsed.workdayTitles = undefined as unknown as string[];
      parsed.customRoles = undefined as unknown as string[];
      parsed.prefilledFromResume = false;
      parsed.filtersDerivedVersion = FILTERS_DERIVED_VERSION;
    }
    _memoryCache = parsed;
    _memoryCacheOwner = key;
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(state: PersistedState, userEmail: string | null | undefined) {
  const key = storageKey(userEmail);
  _memoryCache = state;
  _memoryCacheOwner = key;
  try {
    sessionStorage.setItem(key, JSON.stringify(_slimForStorage(state)));
  } catch {
    /* quota / disabled */
  }
}

// --------------------------------------------------------------------------
// Job row
// --------------------------------------------------------------------------
function VisaBadge({ status, confidence }: { status?: string; confidence?: number }) {
  // Render a compact, color-coded badge so an F-1 / H-1B candidate can tell
  // at a glance whether a posting will accept their visa status. The
  // optional `confidence` (0..1) layers a calibrated percent on top of the
  // discrete status — "Sponsors 95%" reads stronger than just "Sponsors",
  // and "Likely sponsor 62%" surfaces the soft positive bucket that used
  // to be hidden inside "unknown".
  const pct = typeof confidence === 'number' && confidence > 0
    ? `${Math.round(confidence * 100)}%`
    : null;
  if (status === 'sponsor_verified') {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300"
        title="Verified H-1B sponsor — company is on the curated sponsor list or the JD says they sponsor."
      >
        <ShieldCheck className="h-2.5 w-2.5" />
        Sponsors{pct ? ` ${pct}` : ''}
      </Badge>
    );
  }
  if (status === 'likely_sponsor') {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-500/40 bg-amber-500/10 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300"
        title="Looks like a tech employer that historically sponsors, but the JD doesn't say so explicitly. Worth verifying before applying."
      >
        <ShieldCheck className="h-2.5 w-2.5" />
        Likely sponsor{pct ? ` ${pct}` : ''}
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
  isNew,
  tailorLoading,
  batchChecked,
  matchScore,
  onOpen,
  onMarkApplied,
  onDismissOpened,
  onTailor,
  onSnooze,
  onToggleBatch,
  onHideCompany,
  onHideTitlePattern,
  onReachOut,
}: {
  rec: DailyPipelineRecord;
  applied: boolean;
  /** True when the user clicked "Open posting" but hasn't confirmed applied yet. */
  opened: boolean;
  /** True when the keyboard cursor (j/k) is on this row. */
  focused: boolean;
  /** True when this posting wasn't in the user's last "seen" snapshot. */
  isNew: boolean;
  /** True while the JD prefetch for this row is in flight. */
  tailorLoading: boolean;
  /** True when this row is ticked for the batch-tailor handoff. */
  batchChecked: boolean;
  /** Resume-vs-JD overlap score (deterministic), or undefined while loading. */
  matchScore?: { match_score: number; matched_skills: string[]; missing_top: string[]; explain: string };
  onOpen: () => void;
  onMarkApplied: () => void;
  onDismissOpened: () => void;
  onTailor: () => void;
  onSnooze: (days: number) => void;
  onToggleBatch: () => void;
  /** Drop this row's company from future pipeline runs. */
  onHideCompany: () => void;
  /** Open the title-pattern prompt prefilled with this row's title stem. */
  onHideTitlePattern: () => void;
  /** Open the Reach-Out modal for this row. */
  onReachOut: () => void;
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
  // Effective applied state — true when EITHER the user marked applied in
  // this session OR the saved_job already shows an active-funnel status
  // (applied / interview / offer). This unifies the "I just applied"
  // flow with the "Batch Tailor confirmed applied" flow and the "synced
  // from Daily Pipeline → tailoring_record" flow: same visual outcome
  // (greyed-out card, no "Open posting" button, Applied pill).
  const effectivelyApplied =
    applied ||
    prevStatus === 'applied' ||
    prevStatus === 'interview' ||
    prevStatus === 'offer';
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
        effectivelyApplied
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
      {isNew && !applied && !showPrevApplied && (
        <span
          className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm"
          title="New since your last visit"
        >
          NEW
        </span>
      )}
      <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-4">
        {!applied && (
          <label
            className="-m-2 flex flex-shrink-0 items-center self-start p-2 sm:self-center cursor-pointer select-none"
            title={batchChecked ? 'Remove from batch tailor' : 'Add to batch tailor'}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={batchChecked}
              onChange={onToggleBatch}
              className="h-4 w-4 cursor-pointer rounded border-border accent-purple-600"
              aria-label="Add to batch tailor"
            />
          </label>
        )}
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
            <VisaBadge status={rec.visa_status} confidence={rec.visa_confidence} />
            {matchScore && (
              <span
                className={
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-tight ' +
                  (matchScore.match_score >= 70
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : matchScore.match_score >= 40
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      : 'bg-slate-500/15 text-slate-600 dark:text-slate-300')
                }
                title={
                  `Resume match ${matchScore.match_score}% (${matchScore.explain} skills matched)\n` +
                  (matchScore.matched_skills.length
                    ? `\nMatched: ${matchScore.matched_skills.slice(0, 8).join(', ')}`
                    : '') +
                  (matchScore.missing_top.length
                    ? `\nMissing: ${matchScore.missing_top.slice(0, 6).join(', ')}`
                    : '')
                }
              >
                🎯 {matchScore.match_score}% match
              </span>
            )}
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
          {effectivelyApplied ? (
            <Button
              size="sm"
              disabled
              className="gap-1 bg-emerald-600 text-white"
              title={
                applied
                  ? 'You marked this applied in this session'
                  : `Already in your funnel — status: ${prevStatus || 'applied'}`
              }
            >
              <CheckCircle2 className="h-3 w-3" />
              {prevStatus === 'interview' ? 'In Interview' : prevStatus === 'offer' ? 'Offer' : 'Applied'}
            </Button>
          ) : opened ? (
            // Two-stage flow — user clicked "Open posting" in this run. Now
            // confirm whether they actually submitted, or dismiss to go back.
            // This only triggers AFTER an explicit click; openedIds is GC'd
            // against every fresh result so it never lingers across runs.
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
                title="Didn't apply — dismiss this prompt and restore the Open button"
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
          {!effectivelyApplied && (
            <Button
              size="sm"
              variant="outline"
              onClick={onTailor}
              disabled={tailorLoading}
              className="gap-1 border-purple-500/30 text-[11px] text-purple-700 hover:bg-purple-500/10 dark:text-purple-300 disabled:opacity-70"
              title={tailorLoading ? 'Fetching JD — opening Tailor in a moment…' : 'Open this job in Tailor — auto-marks Applied once tailoring saves'}
            >
              {tailorLoading ? (
                <span className="inline-block h-3 w-3 rounded-full border border-purple-500/60 border-t-transparent animate-spin" />
              ) : (
                <Wand2 className="h-3 w-3" />
              )}
              {tailorLoading ? 'Fetching JD…' : 'Tailor'}
            </Button>
          )}
          {!effectivelyApplied && rec.company && (
            <Button
              size="sm"
              variant="outline"
              onClick={onReachOut}
              className="gap-1 border-indigo-500/30 text-[11px] text-indigo-700 hover:bg-indigo-500/10 dark:text-indigo-300"
              title="Draft a cold-outreach email to a recruiter / hiring manager at this company"
            >
              ✉ Reach out
            </Button>
          )}
          {!applied && (
            <button
              type="button"
              onClick={() => onSnooze(2)}
              className="rounded px-2 py-1 text-[11px] text-muted-foreground/80 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-300 transition-colors self-end opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
              title="Hide for 2 days — re-surfaces on its own"
            >
              💤 Snooze 2d
            </button>
          )}
          {!applied && rec.company && (
            <button
              type="button"
              onClick={onHideCompany}
              className="rounded px-2 py-1 text-[11px] text-muted-foreground/70 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors self-end opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
              title={`Stop showing ${rec.company} rows in future runs`}
            >
              🚫 Hide {rec.company.slice(0, 14)}{rec.company.length > 14 ? '…' : ''}
            </button>
          )}
          {!applied && rec.title && (
            <button
              type="button"
              onClick={onHideTitlePattern}
              className="rounded px-2 py-1 text-[11px] text-muted-foreground/70 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors self-end opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
              title="Hide future postings whose title contains a substring (e.g. Senior, Lead, Staff)"
            >
              🚫 Hide title…
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type MatchScoreEntry = {
  match_score: number;
  matched_skills: string[];
  missing_top: string[];
  explain: string;
};

function TierGroup({
  title,
  items,
  accent,
  appliedIds,
  openedIds,
  newIds,
  batchSelectedIds,
  tailorLoadingId,
  focusedId,
  showApplied,
  matchScores,
  onOpen,
  onMarkApplied,
  onDismissOpened,
  onTailor,
  onSnooze,
  onToggleBatch,
  onHideCompany,
  onHideTitlePattern,
  onReachOut,
}: {
  title: string;
  items: DailyPipelineRecord[];
  accent: string;
  appliedIds: Set<string>;
  openedIds: Set<string>;
  newIds: Set<string>;
  batchSelectedIds: Set<string>;
  tailorLoadingId: string | null;
  focusedId: string | null;
  showApplied: boolean;
  matchScores?: Record<string, MatchScoreEntry>;
  onOpen: (rec: DailyPipelineRecord) => void;
  onMarkApplied: (rec: DailyPipelineRecord) => void;
  onDismissOpened: (rec: DailyPipelineRecord) => void;
  onTailor: (rec: DailyPipelineRecord) => void;
  onSnooze: (rec: DailyPipelineRecord, days: number) => void;
  onToggleBatch: (rec: DailyPipelineRecord) => void;
  onHideCompany: (rec: DailyPipelineRecord) => void;
  onHideTitlePattern: (rec: DailyPipelineRecord) => void;
  onReachOut: (rec: DailyPipelineRecord) => void;
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
                isNew={newIds.has(id)}
                tailorLoading={tailorLoadingId === id}
                batchChecked={batchSelectedIds.has(id)}
                matchScore={matchScores?.[id]}
                onOpen={() => onOpen(rec)}
                onMarkApplied={() => onMarkApplied(rec)}
                onDismissOpened={() => onDismissOpened(rec)}
                onTailor={() => onTailor(rec)}
                onSnooze={(days) => onSnooze(rec, days)}
                onToggleBatch={() => onToggleBatch(rec)}
                onHideCompany={() => onHideCompany(rec)}
                onHideTitlePattern={() => onHideTitlePattern(rec)}
                onReachOut={() => onReachOut(rec)}
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
  const { user } = useAuth();
  const userEmail = user?.email || null;
  const persisted = typeof window !== 'undefined' ? readPersisted(userEmail) : null;

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
  // Default ON: an F-1 student has zero use for "US citizens only / GC required"
  // postings. Tagging alone wasn't enough — they still cluttered Tier 2/3 rows.
  // Users can disable via the F-1 panel if they're on a different visa path.
  const [excludeNoSponsorship, setExcludeNoSponsorship] = useState<boolean>(persisted?.excludeNoSponsorship ?? true);

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
  // Tracks which row is currently in JD-prefetch — only one at a time. Used
  // so the row's Tailor button shows a spinner + disables itself instead of
  // looking idle while a 12s fetch is in flight.
  const [tailorLoadingId, setTailorLoadingId] = useState<string | null>(null);
  // Batch-tailor selection — multiple rows the user wants to send to the
  // Batch Tailor tab in one shot. Persisted so a refresh mid-pick doesn't
  // lose the selection. Single-row Tailor is untouched.
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>(persisted?.batchSelectedIds ?? []);
  // Companies the user dismissed — anything in this list is dropped on the
  // server side before scoring on the NEXT pipeline run. Persists across
  // sessions so Stripe-flood etc. stays muted until the user un-hides.
  const [hideCompanies, setHideCompanies] = useState<string[]>(persisted?.hideCompanies ?? []);
  const [hideTitlePatterns, setHideTitlePatterns] = useState<string[]>(persisted?.hideTitlePatterns ?? []);
  const [maxPerCompany, setMaxPerCompany] = useState<number>(persisted?.maxPerCompany ?? 4);
  // Tracks whether the user is mid-batch-run so we can disable the Run
  // button + show a spinner while we pre-fetch all the JDs in parallel.
  const [batchRunning, setBatchRunning] = useState(false);
  // Reach-out modal state — single modal instance, swapped target row.
  const [reachOutRec, setReachOutRec] = useState<DailyPipelineRecord | null>(null);
  const [seenIds, setSeenIds] = useState<string[]>(persisted?.seenIds ?? []);
  const [snoozedUntil, setSnoozedUntil] = useState<Record<string, string>>(persisted?.snoozedUntil ?? {});
  const [dailyGoal, setDailyGoal] = useState<number>(persisted?.dailyGoal ?? 5);
  // Per-day applied counter — reset to 0 whenever the local date rolls over
  // so a fresh morning shows "0/5" instead of last night's tally.
  const _todayDate = new Date().toISOString().slice(0, 10);
  const [dailyApplied, setDailyApplied] = useState<{ date: string; count: number }>(() => {
    const p = persisted?.dailyApplied;
    if (p && p.date === _todayDate) return p;
    return { date: _todayDate, count: 0 };
  });
  const [activePreset, setActivePreset] = useState<string | null>(null);
  // Per-source overrides — user can mute a board (enabled=false) or set a
  // tighter/looser past_days / experience_level just for that source. All
  // boards default to "enabled with global filters", which reproduces the
  // pre-feature behavior exactly.
  // Per-source filter overrides have been removed. Every source now fetches
  // at the widest sensible window and the global filters above apply once
  // on the merged result. The actor-side experience filter was the exact
  // reason Yahoo's Workday postings were being hidden, so even when the user
  // selects "entry" we send the wide payload and de-rank instead of dropping.
  // Post-run date slicer — pure client-side filter over the existing
  // `result.apply_now` / `verify_dates` lists. Doesn't re-fetch from the
  // server. Ephemeral on purpose: a refresh restores results but resets the
  // slicer to "all" so the user sees the full set first.
  type PostRunDateFilter = 'all' | 'today' | 'yesterday' | '3d' | '7d';
  const [dateFilter, setDateFilter] = useState<PostRunDateFilter>('all');
  // Source filter — narrows the visible rows to one origin (LinkedIn /
  // Workday Apify / Workday Direct / Indeed / ATS direct). Lets the user
  // chew through one board at a time before moving to the next so they
  // don't lose context-switching to "where was that LinkedIn job again?"
  type PostRunSourceFilter = 'all' | 'linkedin' | 'workday' | 'workday_direct' | 'indeed' | 'ats_direct';
  const [sourceFilter, setSourceFilter] = useState<PostRunSourceFilter>('all');
  // record.source is one of: "LinkedIn", "Workday", "Workday Direct",
  // "Indeed", "Greenhouse", "Lever", "Ashby". Map them onto the filter
  // buckets the chip set offers.
  const _ATS_SOURCE_LABELS = new Set(['Greenhouse', 'Lever', 'Ashby']);
  const _sourceMatches = useCallback(
    (r: DailyPipelineRecord) => {
      if (sourceFilter === 'all') return true;
      const s = r.source || '';
      if (sourceFilter === 'linkedin') return s === 'LinkedIn';
      if (sourceFilter === 'workday') return s === 'Workday';
      if (sourceFilter === 'workday_direct') return s === 'Workday Direct';
      if (sourceFilter === 'indeed') return s === 'Indeed';
      if (sourceFilter === 'ats_direct') return _ATS_SOURCE_LABELS.has(s);
      return true;
    },
    [sourceFilter],
  );
  // JD-vs-resume match scores — populated after each pipeline run by an async
  // batch call to /pipeline/match-scores. Deterministic (regex against resume
  // skills) so it's safe to overlay on every row without burning LLM quota.
  type MatchScore = {
    match_score: number;
    matched_skills: string[];
    missing_top: string[];
    explain: string;
  };
  const [matchScores, setMatchScores] = useState<Record<string, MatchScore>>({});
  const [matchScoresLoading, setMatchScoresLoading] = useState(false);
  const [matchScoresHasResume, setMatchScoresHasResume] = useState<boolean>(true);
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
      seenIds: seenIds.slice(-1500),
      snoozedUntil,
      dailyGoal,
      dailyApplied,
      batchSelectedIds,
      hideCompanies,
      hideTitlePatterns,
      maxPerCompany,
      filtersDerivedVersion: FILTERS_DERIVED_VERSION,
    }, userEmail);
  }, [
    linkedinKws, workdayTitles, customRoles, pastDays, showAdvanced,
    result, resultAt, appliedIds, showApplied, workdayLimit, linkedinCount, includeIndeed,
    location, experienceLevel, employmentType, workArrangement, domainStrict,
    h1bOnly, excludeNoSponsorship, openedIds, seenIds, snoozedUntil, dailyGoal, dailyApplied,
    batchSelectedIds, hideCompanies, hideTitlePatterns, maxPerCompany,
    userEmail,
  ]);

  // Manual "↻ Re-suggest from resume" trigger — bypasses prefilledRef so the
  // user can force a fresh suggestion run any time (after updating their
  // resume, after a profiler upgrade, etc). Replaces linkedinKws / titles /
  // customRoles wholesale; everything else (snoozes, mutes) is preserved.
  const [refreshingFilters, setRefreshingFilters] = useState(false);
  // Persistent debug panel showing what the synth detected — surfaces the
  // information that was previously only in transient toasts so any user
  // (or friend testing the system) can see at a glance whether their
  // filters are personalized to THEIR resume or fell back to defaults.
  const [detectedSummary, setDetectedSummary] = useState<{
    headline: string;
    rationale: string;
    firstTitle: string;
    usedSynth: boolean;
  } | null>(null);
  const handleRefreshFromResume = useCallback(async () => {
    if (refreshingFilters) return;
    setRefreshingFilters(true);
    try {
      const resp = await apiService.suggestPipelineFilters();
      // Backend wraps the payload as { suggestions: { ... } }. Accept both
      // shapes so the handler is resilient to future endpoint changes.
      const raw = resp.data as any;
      const s = (raw && (raw.suggestions ?? raw)) || null;
      // Distinguish "no resume" from other failures — the action is different.
      if (resp.error && /no resume/i.test(resp.error)) {
        toast.warning('Upload your resume first', {
          description: 'The current filters are GENERIC SWE defaults. Head to My Resumes / Profile and upload your resume, then click ↻ Re-suggest again to get titles tailored to your stack.',
          duration: 9000,
        });
        return;
      }
      if (!s) {
        toast.error("Couldn't fetch resume-based filters", {
          description: resp.error || 'Try again in a moment, or upload a resume if you haven\'t yet.',
        });
        return;
      }
      if (s.linkedin_keyword_sets?.length) setLinkedinKws(s.linkedin_keyword_sets);
      if (s.workday_titles?.length) setWorkdayTitles(s.workday_titles);
      if (s.custom_role_terms?.length) setCustomRoles(s.custom_role_terms);
      if (typeof s.past_days === 'number') setPastDays(s.past_days);
      prefilledRef.current = true;
      // Show what the backend actually detected so the user can verify the
      // suggestion is grounded in their resume — not generic.
      const headline = s.headline || s.intent?.primary_label || 'your resume';
      const rationale = s.rationale || '';
      const firstTitle = s.workday_titles?.[0] || '(no titles)';
      const usedSynth = (s as { synth_meta?: { used_synth?: boolean } }).synth_meta?.used_synth;
      setDetectedSummary({
        headline,
        rationale,
        firstTitle,
        usedSynth: usedSynth ?? false,
      });
      toast.success(`Detected: ${headline}`, {
        description: rationale
          ? `${rationale}\nFirst Workday title: "${firstTitle}". Synth: ${usedSynth ? 'YES' : 'fallback'}.`
          : `First Workday title: "${firstTitle}". Synth: ${usedSynth ? 'YES' : 'fallback'}.`,
        duration: 9000,
      });
    } catch {
      toast.error('Filter refresh failed.');
    } finally {
      setRefreshingFilters(false);
    }
  }, [refreshingFilters]);

  // Auto-prefill from /pipeline/suggest-filters when the user has a parsed
  // resume but no resume-derived filters yet. Triggers in three cases:
  //   1. First-ever mount (no persisted state)
  //   2. After a FILTERS_DERIVED_VERSION migration wiped the stale filter
  //      fields (persisted exists but linkedinKws fell back to defaults)
  //   3. Never — once prefilledRef is true (auto-prefill succeeded once, or
  //      the user applied Smart Filters / Refresh), we don't re-run
  //
  // Previously this bailed on `if (persisted) return` which blocked case 2,
  // leaving existing users stuck on DEFAULT_LINKEDIN_KEYWORDS after a
  // version bump until they manually clicked Re-suggest.
  useEffect(() => {
    if (prefilledRef.current) return;
    // Reference-equality check: state was initialized from the constant
    // array, so === holds until the user (or a fetch) replaces it.
    const isDefaultLinkedin = linkedinKws === DEFAULT_LINKEDIN_KEYWORDS;
    const isDefaultTitles = workdayTitles === DEFAULT_WORKDAY_TITLES;
    if (!isDefaultLinkedin && !isDefaultTitles) return; // user has edits
    let cancelled = false;
    apiService.suggestPipelineFilters().then((resp) => {
      if (cancelled) return;
      // Loud "upload your resume" CTA when the backend says no resume is on
      // file. Previously this was a silent catch, so a brand-new user just
      // saw the cloud-flavored defaults and assumed those were "for them" —
      // never realizing personalization was waiting one upload away.
      if (resp.error && /no resume/i.test(resp.error)) {
        toast.warning('No resume on file', {
          description:
            'These default filters are GENERIC SWE titles. Upload your resume in My Resumes / Profile to get titles personalized to your actual stack — then click ↻ Re-suggest.',
          duration: 9000,
        });
        return;
      }
      if (!resp.data?.suggestions) return;
      const s = resp.data.suggestions;
      if (s.linkedin_keyword_sets?.length) setLinkedinKws(s.linkedin_keyword_sets);
      if (s.workday_titles?.length) setWorkdayTitles(s.workday_titles);
      if (s.custom_role_terms?.length) setCustomRoles(s.custom_role_terms);
      if (typeof s.past_days === 'number') setPastDays(s.past_days);
      prefilledRef.current = true;
      const sx = s as {
        headline?: string;
        rationale?: string;
        synth_meta?: { used_synth?: boolean };
        workday_titles?: string[];
      };
      const headline = sx.headline || 'your resume';
      setDetectedSummary({
        headline,
        rationale: sx.rationale || '',
        firstTitle: sx.workday_titles?.[0] || '',
        usedSynth: sx.synth_meta?.used_synth ?? false,
      });
      toast.success(`Filters refreshed from ${headline}`, {
        description: 'Personalized to your resume — adjust before running.',
        duration: 4500,
      });
    }).catch(() => {
      // Network error — defaults stay in place; user can retry via ↻ button.
      // Not toasting because this can fire pre-auth on slow loads.
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      hide_companies: hideCompanies,
      hide_title_patterns: hideTitlePatterns,
      max_per_company: maxPerCompany,
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
    // GC openedIds against the new result: anything you opened in a previous
    // run that isn't in the fresh result is dropped. Without this, openedIds
    // accumulated across runs and every row eventually showed the legacy
    // "have you applied?" prompt instead of Open Posting.
    try {
      const liveIds = new Set<string>();
      [...(resp.data.apply_now || []), ...(resp.data.verify_dates || [])].forEach((r) => {
        liveIds.add(_recordId(r));
      });
      setOpenedIds((prev) => prev.filter((id) => liveIds.has(id)));
    } catch { /* best effort */ }
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
      hide_companies: hideCompanies,
      hide_title_patterns: hideTitlePatterns,
      max_per_company: maxPerCompany,
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
    // Prevent double-click during the up-to-12s JD prefetch. Cleared in the
    // finally-equivalent at the bottom (we navigate away immediately after,
    // so it's set-then-clear on error too via the catch path).
    if (tailorLoadingId) return;
    setTailorLoadingId(id);
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

    // Best-effort JD pre-fill. The pipeline scrape sometimes returns an
    // empty description (LinkedIn snippet only, Workday actor missed it,
    // ATS scrape pre-fix, etc.). When that happens AND we have a URL, hit
    // /jobs/fetch-jd which classifies the URL by source (LinkedIn guest
    // API, Greenhouse / Lever / Ashby APIs, or generic HTML strip / Apify
    // browser fallback) and returns the rendered JD text. Bounded ~45s
    // (Apify fallback can take ~30s); we show a toast while it works.
    //
    // Cache layer: if the user clicked Tailor on this URL earlier in the
    // same session, use the cached JD instantly. The Tailor receiver also
    // writes the result to the cache, so re-clicks are free.
    let jdText = (rec.description || '').trim();
    let fetchedKind: string | undefined;
    if (!jdText && rec.url) {
      try {
        const cached = sessionStorage.getItem(`jd_cache:${rec.url}`);
        if (cached) {
          const obj = JSON.parse(cached) as { text: string; at: number };
          if (obj.text && Date.now() - obj.at < 60 * 60 * 1000) {
            jdText = obj.text;
            fetchedKind = 'session_cache';
          }
        }
      } catch { /* ignore */ }
    }
    if (!jdText && rec.url) {
      const fetching = toast.loading('Fetching job description…', { duration: 50000 });
      try {
        const resp = await apiService.fetchJobDescription(rec.url);
        toast.dismiss(fetching);
        if (resp.data?.ok && resp.data.jd_text) {
          jdText = resp.data.jd_text;
          fetchedKind = resp.data.source_kind;
          // Cache for the rest of the session — re-clicks on the same row
          // (or pasting the same URL into another flow) are instant.
          try {
            sessionStorage.setItem(
              `jd_cache:${rec.url}`,
              JSON.stringify({ text: resp.data.jd_text, at: Date.now() }),
            );
          } catch { /* quota */ }
        } else if (resp.data?.error) {
          // Soft-fail — fall through to the placeholder so user can paste manually.
          toast.message(resp.data.error);
        }
      } catch {
        toast.dismiss(fetching);
        /* ignore — fall through to placeholder */
      }
    }
    // When fetch fails, hand off an EMPTY jd_text and a fail flag so the
    // Tailor view can render a clean empty textarea + a prominent paste
    // prompt instead of stuffing instructions into the textarea body.
    const fetchFailed = !jdText && !!rec.url;
    const jdSeed = jdText ||
      `${rec.title} at ${rec.company}\n${rec.location || ''}\n${rec.url || ''}`;

    try {
      sessionStorage.setItem('pending_tailor_job', JSON.stringify({
        job_id: id,
        jd_text: fetchFailed ? '' : jdSeed,
        jd_fetch_failed: fetchFailed,
        title: rec.title,
        company: rec.company,
        url: rec.url || '',
      }));
    } catch { /* quota */ }

    window.dispatchEvent(new CustomEvent('portfolio:navigate-to-tailor'));
    if (jdText) {
      toast.success(
        `Opening Tailor — JD pre-filled${fetchedKind ? ` (${fetchedKind.replace('_', ' ')})` : ''}.`,
      );
    } else if (fetchFailed) {
      toast.warning("Couldn't auto-fetch the JD — please copy-paste it from the posting.", {
        duration: 6000,
      });
    } else {
      toast.message('Opening Tailor — paste the JD to begin.');
    }
    setTailorLoadingId(null);
  };

  // Batch handoff: pre-fetch JDs (parallel, capped) for every selected row
  // and hand them to the Batch Tailor tab via sessionStorage. Single-row
  // Tailor is unchanged — this is a separate code path.
  const handleRunBatch = async () => {
    if (batchRunning) return;
    const recs = batchSelectedIds
      .map((id) => allRowsById.get(id))
      .filter((r): r is DailyPipelineRecord => !!r);
    if (recs.length === 0) {
      toast.info('Nothing in the batch yet — tick rows to add them.');
      return;
    }
    setBatchRunning(true);
    const fetching = toast.loading(`Pre-fetching ${recs.length} job descriptions…`, {
      duration: 60000,
    });

    // Save each selected job up-front so the application tracker picks them
    // up (mirrors single-row Tailor behavior). Duplicate-saves are tolerated.
    await Promise.all(
      recs.map((rec) =>
        apiService
          .saveJob(_jobPayload(rec) as any)
          .catch(() => { /* duplicate-ok */ }),
      ),
    );

    // Parallel JD prefetch — capped concurrency so we don't hammer the
    // backend rate limiter (20/min on /jobs/fetch-jd). 3 in flight covers
    // ~20 jobs in ~25–40s typical; the per-call timeout is server-side ~60s.
    type Prefetched = {
      rec: DailyPipelineRecord;
      jdText: string;
      fetchFailed: boolean;
    };
    const out: Prefetched[] = [];
    const concurrency = 3;
    let cursor = 0;
    const worker = async () => {
      while (cursor < recs.length) {
        const i = cursor++;
        const rec = recs[i];
        let jdText = (rec.description || '').trim();
        if (!jdText && rec.url) {
          try {
            const resp = await apiService.fetchJobDescription(rec.url);
            if (resp.data?.ok && resp.data.jd_text) jdText = resp.data.jd_text;
          } catch { /* fall through to fail flag */ }
        }
        out.push({
          rec,
          jdText,
          fetchFailed: !jdText,
        });
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, recs.length) }, worker));
    toast.dismiss(fetching);

    // Hand off to BatchTailor — entries marked fetchFailed render an inline
    // "paste JD" prompt. The BatchTailor mount-effect reads this key.
    const handoff = out.map(({ rec, jdText, fetchFailed }) => ({
      job_id: _recordId(rec),
      title: rec.title,
      company: rec.company,
      url: rec.url || '',
      jd_text: jdText,
      jd_fetch_failed: fetchFailed,
    }));
    try {
      sessionStorage.setItem('pending_batch_tailor_jobs', JSON.stringify(handoff));
    } catch (e) {
      toast.error('Browser storage full — try clearing some history.');
      setBatchRunning(false);
      return;
    }

    const failedCount = handoff.filter((h) => h.jd_fetch_failed).length;
    if (failedCount > 0) {
      toast.warning(
        `Sent ${handoff.length} to Batch Tailor — ${failedCount} need a manual JD paste before they'll run.`,
        { duration: 8000 },
      );
    } else {
      toast.success(`Sent ${handoff.length} to Batch Tailor — opening now.`);
    }

    // Clear selection so the user can keep browsing fresh rows after the
    // handoff. The Batch Tailor tab owns the run from here.
    setBatchSelectedIds([]);
    setBatchRunning(false);
    window.dispatchEvent(new CustomEvent('portfolio:navigate-to-batch-tailor'));
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
    setDailyApplied((prev) => {
      const today = new Date().toISOString().slice(0, 10);
      return prev.date === today
        ? { date: today, count: prev.count + 1 }
        : { date: today, count: 1 };
    });
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

  // Snooze: drop rows whose snoozedUntil is in the future. We don't garbage-
  // collect the map here — entries naturally fall off when filtered out, and
  // localStorage stays small (<1500 entries via persist slice).
  const _nowIso = new Date().toISOString();
  const snoozedSet = useMemo(
    () => new Set(Object.entries(snoozedUntil).filter(([, until]) => until > _nowIso).map(([id]) => id)),
    [snoozedUntil, _nowIso],
  );
  const _notSnoozed = (r: DailyPipelineRecord) => !snoozedSet.has(_recordId(r));

  // Date-filter chip ("Today" / "Yesterday" / "Last 3d" / "Last 7d" / "All").
  // Bucketed by HOURS-AGO from now rather than UTC date string equality —
  // strict equality dropped local-today posts whose UTC date was yesterday
  // (and vice versa) for any timezone offset from UTC. The 30h "today"
  // window matches the backend's 36h recency grace and absorbs most of
  // the local-vs-UTC boundary mismatches.
  const _hoursAgo = (postedYMD: string): number => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(postedYMD);
    if (!m) return Number.POSITIVE_INFINITY;
    // Anchor each posted date at 12:00 UTC to minimise timezone-edge
    // misclassification — a row stamped 2026-05-14 is treated as ~mid-day
    // May 14 UTC, so it sits ~12-36h before any local "now" on May 15.
    const ts = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    return Math.max(0, (Date.now() - ts) / 3_600_000);
  };
  const _matchesFilter = (postedYMD: string, filt: PostRunDateFilter): boolean => {
    if (filt === 'all') return true;
    const h = _hoursAgo(postedYMD);
    if (filt === 'today') return h < 30;
    if (filt === 'yesterday') return h >= 30 && h < 54;
    if (filt === '3d') return h < 84;
    if (filt === '7d') return h < 192;
    return true;
  };
  const _dateMatches = useCallback(
    (r: DailyPipelineRecord) => _matchesFilter((r.posted || '').slice(0, 10), dateFilter),
    [dateFilter],
  );

  const tier1 = (result?.apply_now || []).filter((r) => r.tier === 'Tier 1' && _notSnoozed(r) && _dateMatches(r) && _sourceMatches(r));
  const tier2 = (result?.apply_now || []).filter((r) => r.tier === 'Tier 2' && _notSnoozed(r) && _dateMatches(r) && _sourceMatches(r));
  const tier3 = (result?.apply_now || []).filter((r) => r.tier === 'Tier 3' && _notSnoozed(r) && _dateMatches(r) && _sourceMatches(r));
  const allApplyNow = (result?.apply_now || []).filter(_notSnoozed);
  // Verify-dates list also respects the chip — interns from 5 days ago
  // shouldn't surface under "Today".
  const filteredVerifyDates = (result?.verify_dates || []).filter((r) => _dateMatches(r) && _sourceMatches(r));
  const remainingApply = allApplyNow.filter((r) => !appliedSet.has(_recordId(r))).length;

  // "New since last check" — anything in the current result that the user
  // hasn't acknowledged with "Mark all seen". We derive it once here and pass
  // a Set down to PipelineRow as a prop so badges render consistently.
  const seenSet = useMemo(() => new Set(seenIds), [seenIds]);
  const currentRowIds = useMemo(() => {
    const ids = new Set<string>();
    [...(result?.apply_now || []), ...(result?.verify_dates || [])].forEach((r) => ids.add(_recordId(r)));
    return ids;
  }, [result]);
  const newIds = useMemo(() => {
    const out = new Set<string>();
    currentRowIds.forEach((id) => { if (!seenSet.has(id)) out.add(id); });
    return out;
  }, [currentRowIds, seenSet]);
  const handleMarkAllSeen = useCallback(() => {
    setSeenIds(Array.from(currentRowIds));
    toast.success('Caught up — all visible postings marked seen.');
  }, [currentRowIds]);
  const handleSnooze = useCallback((rec: DailyPipelineRecord, days: number) => {
    const id = _recordId(rec);
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    setSnoozedUntil((prev) => ({ ...prev, [id]: until }));
    toast.success(`Snoozed for ${days} day${days === 1 ? '' : 's'} — back on ${until.slice(0, 10)}.`);
  }, []);

  const handleHideCompany = useCallback((rec: DailyPipelineRecord) => {
    const name = (rec.company || '').trim();
    if (!name) return;
    setHideCompanies((prev) => (prev.includes(name) ? prev : [...prev, name].slice(-50)));
    toast.success(`${name} muted — won't appear in future pipeline runs. Manage in Advanced.`);
  }, []);
  const handleUnhideCompany = useCallback((name: string) => {
    setHideCompanies((prev) => prev.filter((c) => c !== name));
  }, []);

  // Title pattern hide — small prompt to pick the keyword the user wants to
  // mute. Prefills with the row's title-stem (first 2 words) so a "Senior
  // Software Engineer" row makes "Senior" a one-tap pick.
  const handleHideTitlePattern = useCallback((rec: DailyPipelineRecord) => {
    const t = (rec.title || '').trim();
    const default_ = t.split(/\s+/).slice(0, 2).join(' ');
    const raw = window.prompt(
      'Hide future postings whose title contains (case-insensitive substring):',
      default_,
    );
    if (!raw) return;
    const pattern = raw.trim();
    if (pattern.length < 2) {
      toast.error('Pattern must be at least 2 characters.');
      return;
    }
    setHideTitlePatterns((prev) => (prev.includes(pattern) ? prev : [...prev, pattern].slice(-30)));
    toast.success(`Title pattern "${pattern}" muted. Manage in Advanced.`);
  }, []);
  const handleUnhideTitlePattern = useCallback((pattern: string) => {
    setHideTitlePatterns((prev) => prev.filter((p) => p !== pattern));
  }, []);

  const handleReachOut = useCallback((rec: DailyPipelineRecord) => {
    setReachOutRec(rec);
  }, []);

  const batchSelectedSet = useMemo(() => new Set(batchSelectedIds), [batchSelectedIds]);
  const handleToggleBatch = useCallback((rec: DailyPipelineRecord) => {
    const id = _recordId(rec);
    setBatchSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);
  const handleClearBatch = useCallback(() => setBatchSelectedIds([]), []);

  // Index from id → full record across every tier + verify list so the Run
  // handler can resolve a selected id to its full payload without re-walking.
  const allRowsById = useMemo(() => {
    const map = new Map<string, DailyPipelineRecord>();
    [...(result?.apply_now || []), ...(result?.verify_dates || [])].forEach((r) => {
      map.set(_recordId(r), r);
    });
    return map;
  }, [result]);

  // Daily-digest stats — surfaced at the top so an F-1 student can see in one
  // glance how many fresh sponsors / on-domain matches are waiting today,
  // instead of scrolling through three tier groups to count.
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
    const all = [...(result.apply_now || []), ...(result.verify_dates || [])].filter(_notSnoozed);
    const eligible = all.filter((r) => !appliedSet.has(_recordId(r)) && !_alreadyApplied(r));
    return {
      total: eligible.length,
      fresh: eligible.filter(_isFresh).length,
      newSinceLastCheck: eligible.filter((r) => newIds.has(_recordId(r))).length,
      sponsors: eligible.filter((r) => r.visa_status === 'sponsor_verified').length,
      noSponsor: all.filter((r) => r.visa_status === 'no_sponsorship').length,
      tier1Open: tier1.filter((r) => !appliedSet.has(_recordId(r)) && !_alreadyApplied(r)).length,
      alreadyApplied: all.filter(_alreadyApplied).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, appliedSet, newIds, snoozedSet]);

  // Fire a single batch match-scores call after each pipeline run lands.
  // Reuses the JD text already scraped — no extra fetches. The state map
  // is keyed by record_id so PipelineRow can look up its own score O(1).
  // We dedupe by resultAt so flipping date-filter chips doesn't re-fire.
  const lastScoredAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (!result || !resultAt) return;
    if (lastScoredAtRef.current === resultAt) return;
    const all = [...(result.apply_now || []), ...(result.verify_dates || [])];
    if (all.length === 0) return;
    lastScoredAtRef.current = resultAt;
    setMatchScoresLoading(true);
    const items = all.slice(0, 200).map((r) => ({
      id: _recordId(r),
      title: r.title || '',
      description: r.description || '',
    }));
    apiService.pipelineMatchScores(items)
      .then((resp) => {
        if (resp.ok && resp.data) {
          setMatchScores(resp.data.scores || {});
          setMatchScoresHasResume(!!resp.data.meta?.has_resume);
        }
      })
      .catch(() => { /* silent — badges just don't render */ })
      .finally(() => setMatchScoresLoading(false));
  }, [result, resultAt]);

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

          {/* Advanced toggle + manual resume-refresh */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced((v) => !v)}
              className="gap-1 text-xs border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-300 hover:border-purple-500/30"
            >
              {showAdvanced ? '▾' : '▸'} Advanced — edit LinkedIn searches & Workday titles
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshFromResume}
              disabled={refreshingFilters}
              className="gap-1 text-xs text-purple-600 dark:text-purple-300 hover:bg-purple-500/10"
              title="Re-run the filter suggester against your latest resume — replaces LinkedIn keywords + Workday titles"
            >
              {refreshingFilters ? (
                <>
                  <span className="inline-block h-3 w-3 rounded-full border-2 border-purple-500/60 border-t-transparent animate-spin" />
                  Refreshing…
                </>
              ) : (
                <>↻ Re-suggest from resume</>
              )}
            </Button>
          </div>

          {detectedSummary && (
            <div className={`flex flex-wrap items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
              detectedSummary.usedSynth
                ? 'border-emerald-500/30 bg-emerald-500/[0.05]'
                : 'border-amber-500/30 bg-amber-500/[0.05]'
            }`}>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                detectedSummary.usedSynth
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
              }`}>
                {detectedSummary.usedSynth ? 'AI synth ✓' : 'Fallback'}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-medium text-foreground/90">
                  Detected: {detectedSummary.headline}
                </p>
                {detectedSummary.rationale && (
                  <p className="text-muted-foreground leading-relaxed">
                    {detectedSummary.rationale}
                  </p>
                )}
                {!detectedSummary.usedSynth && (
                  <p className="text-amber-700/90 dark:text-amber-300/90">
                    The resume classifier ran fine; the AI title generator hit
                    a transient error (rate limit / timeout) and fell back to
                    the curated default set for {detectedSummary.headline}.
                    Click ↻ Re-suggest in 10-20 seconds — it usually succeeds
                    on the second try.
                  </p>
                )}
              </div>
            </div>
          )}

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
              {/* Per-source filter overrides were removed by design: every
                  source now fetches the widest sensible window and your
                  filters above apply once on the merged result set, so
                  changing them is instant and consistent across boards. */}
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
            <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-6">
              <SummaryBlock
                label="LinkedIn (kept / raw)"
                value={
                  result.source_breakdown
                    ? `${result.source_breakdown.linkedin.apply_now + result.source_breakdown.linkedin.verify} / ${result.source_breakdown.linkedin.raw}`
                    : result.raw_counts.linkedin
                }
              />
              <SummaryBlock
                label="Workday Apify (kept / raw)"
                value={
                  result.source_breakdown
                    ? `${result.source_breakdown.workday.apply_now + result.source_breakdown.workday.verify} / ${result.source_breakdown.workday.raw}`
                    : result.raw_counts.workday
                }
              />
              {result.source_breakdown?.workday_direct && result.source_breakdown.workday_direct.raw > 0 && (
                <SummaryBlock
                  label="Workday Direct (kept / raw)"
                  value={`${result.source_breakdown.workday_direct.apply_now + result.source_breakdown.workday_direct.verify} / ${result.source_breakdown.workday_direct.raw}`}
                />
              )}
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

          {/* Per-actor zero-result diagnostics. We render this whenever
              an actor came back silently empty (no items + no error) so
              the user can tell whether their filters were too tight or
              the actor itself is misbehaving. The LinkedIn URL we sent
              is exposed inline so the user can click and verify in
              LinkedIn's own UI. */}
          {(result.actor_diagnostics?.linkedin_silent_zero ||
            result.actor_diagnostics?.workday_silent_zero ||
            (result.source_breakdown && result.source_breakdown.linkedin.raw === 0) ||
            (result.source_breakdown && result.source_breakdown.workday.raw === 0)) && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="space-y-2 p-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="font-semibold text-amber-700 dark:text-amber-300">
                    A source returned 0 — here's what we sent
                  </span>
                </div>
                {result.source_breakdown && result.source_breakdown.linkedin.raw === 0 && (
                  <div className="space-y-1">
                    <p className="text-amber-700/80 dark:text-amber-300/80">
                      <strong>LinkedIn (0/{linkedinCount}):</strong>{' '}
                      {result.actor_diagnostics?.linkedin_silent_zero
                        ? 'actor responded successfully but returned no rows. Most common cause: filters too narrow. Try widening past_days, switching experience to "any", or removing very specific keyword phrases.'
                        : 'actor errored — see the Partial Results panel above for the cause.'}
                    </p>
                    {result.actor_diagnostics?.linkedin_urls && result.actor_diagnostics.linkedin_urls.length > 0 && (
                      <details className="ml-2 cursor-pointer">
                        <summary className="select-none text-[10px] text-muted-foreground hover:text-foreground">
                          Show {result.actor_diagnostics.linkedin_urls.length} LinkedIn URL{result.actor_diagnostics.linkedin_urls.length === 1 ? '' : 's'} we sent — click to verify in LinkedIn directly
                        </summary>
                        <ul className="mt-1 space-y-0.5">
                          {result.actor_diagnostics.linkedin_urls.slice(0, 8).map((u, i) => (
                            <li key={i}>
                              <a
                                href={u}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="break-all text-[10px] text-blue-600 hover:underline dark:text-blue-300"
                              >
                                {u}
                              </a>
                            </li>
                          ))}
                          {result.actor_diagnostics.linkedin_urls.length > 8 && (
                            <li className="text-[10px] italic text-muted-foreground">
                              + {result.actor_diagnostics.linkedin_urls.length - 8} more
                            </li>
                          )}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
                {result.source_breakdown && result.source_breakdown.workday.raw === 0 && (
                  <p className="text-amber-700/80 dark:text-amber-300/80">
                    <strong>Workday (0/{workdayLimit}):</strong>{' '}
                    {result.actor_diagnostics?.workday_silent_zero
                      ? `actor responded but returned no rows. Sent ${result.actor_diagnostics?.workday_input_summary?.titles ?? '?'} titles. Try fewer / broader title chips, "any" experience, or check the Partial Results panel for actor errors.`
                      : 'actor errored — see the Partial Results panel above for the cause.'}
                  </p>
                )}
              </CardContent>
            </Card>
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

          {/* Hidden-companies bar — surfaces what's currently muted so the
              user can un-mute easily. Quiet by default; only renders when
              there's at least one hidden company. */}
          {hideCompanies.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border/40 bg-muted/30 px-2.5 py-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Muted companies
              </span>
              {hideCompanies.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleUnhideCompany(c)}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-700 hover:bg-rose-500/20 dark:text-rose-300 transition-colors"
                  title={`Click to un-mute ${c}`}
                >
                  {c} <span className="text-rose-500/60">×</span>
                </button>
              ))}
            </div>
          )}

          {hideTitlePatterns.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border/40 bg-muted/30 px-2.5 py-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Muted title patterns
              </span>
              {hideTitlePatterns.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleUnhideTitlePattern(p)}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 transition-colors"
                  title={`Click to un-mute titles containing "${p}"`}
                >
                  contains "{p}" <span className="text-amber-500/60">×</span>
                </button>
              ))}
            </div>
          )}

          {/* Daily quota strip — student motivation lever. Shows today's
              applied count vs goal as a thin progress bar. The goal is
              user-tunable (click to edit). Hides when there's no result yet. */}
          {result && (
            <div className="rounded-lg border border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.04] to-teal-500/[0.04] px-3 py-2">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-medium text-foreground/90">
                  Today's goal
                  <span className="ml-2 tabular-nums text-emerald-700 dark:text-emerald-400">
                    {dailyApplied.count}/{dailyGoal}
                  </span>
                  {dailyApplied.count >= dailyGoal && (
                    <span className="ml-2 text-emerald-600 dark:text-emerald-400">✓ hit</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = window.prompt('Daily application goal (1–50):', String(dailyGoal));
                    if (!next) return;
                    const n = Math.max(1, Math.min(50, Number(next)));
                    if (Number.isFinite(n)) setDailyGoal(n);
                  }}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  title="Change your daily application goal"
                >
                  edit
                </button>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (dailyApplied.count / Math.max(1, dailyGoal)) * 100)}%` }}
                />
              </div>
            </div>
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
                  {digest.newSinceLastCheck > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllSeen}
                      className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-purple-700 transition-colors hover:bg-purple-500/20 dark:text-purple-300"
                      title="Click to mark all visible postings as seen"
                    >
                      <Sparkles className="h-3 w-3" />
                      {digest.newSinceLastCheck} new since last visit
                    </button>
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
                  {matchScoresLoading && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Sparkles className="h-3 w-3 animate-pulse" />
                      Scoring resume match…
                    </span>
                  )}
                  {!matchScoresLoading && !matchScoresHasResume && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground" title="Upload a resume to see per-job match scores">
                      <AlertCircle className="h-3 w-3" />
                      No resume → match scores hidden
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

          {/* Post-run date slicer — narrows the visible tier lists without
              re-running the pipeline. The chip set is intentionally small:
              Today / Yesterday cover the daily-check use case; 3d/7d catch
              up after a weekend. Always-visible counts on each chip preview
              how many rows survive the filter so the user can pick wisely. */}
          {result && (allApplyNow.length > 0 || result.verify_dates.length > 0) && (() => {
            const _all = [...(result.apply_now || []), ...(result.verify_dates || [])].filter(_notSnoozed);
            const _count = (filt: PostRunDateFilter) =>
              filt === 'all'
                ? _all.length
                : _all.filter((r) => _matchesFilter((r.posted || '').slice(0, 10), filt)).length;
            const chips: { id: PostRunDateFilter; label: string }[] = [
              { id: 'all', label: 'All' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '3d', label: 'Last 3 days' },
              { id: '7d', label: 'Last 7 days' },
            ];
            return (
              <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border/40 bg-muted/30 px-2 py-1.5 text-xs">
                <span className="mr-1 text-muted-foreground">Posted:</span>
                {chips.map((c) => {
                  const active = dateFilter === c.id;
                  const n = _count(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setDateFilter(c.id)}
                      className={
                        'rounded-full px-2.5 py-0.5 text-[11px] transition-colors ' +
                        (active
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'border border-border/60 bg-background/70 text-foreground/80 hover:border-indigo-500/40 hover:bg-indigo-500/10')
                      }
                      title={`${c.label} — ${n} posting${n === 1 ? '' : 's'}`}
                    >
                      {c.label}
                      <span className={'ml-1 ' + (active ? 'opacity-90' : 'opacity-60')}>· {n}</span>
                    </button>
                  );
                })}
                {dateFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setDateFilter('all')}
                    className="ml-auto text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            );
          })()}

          {/* Source filter — quieter strip than the date one (smaller chips,
              no border) so it reads as a secondary slicer. Lets the user
              chew through one board at a time. */}
          {result && (allApplyNow.length > 0 || result.verify_dates.length > 0) && (() => {
            const _all = [...(result.apply_now || []), ...(result.verify_dates || [])].filter(_notSnoozed);
            const _ATS_SOURCES_LOCAL = new Set(['Greenhouse', 'Lever', 'Ashby']);
            const _sourceCount = (id: PostRunSourceFilter) => {
              if (id === 'all') return _all.length;
              return _all.filter((r) => {
                const s = r.source || '';
                if (id === 'linkedin') return s === 'LinkedIn';
                if (id === 'workday') return s === 'Workday';
                if (id === 'workday_direct') return s === 'Workday Direct';
                if (id === 'indeed') return s === 'Indeed';
                if (id === 'ats_direct') return _ATS_SOURCES_LOCAL.has(s);
                return false;
              }).length;
            };
            const allChips: { id: PostRunSourceFilter; label: string }[] = [
              { id: 'all', label: 'All' },
              { id: 'linkedin', label: 'LinkedIn' },
              { id: 'workday', label: 'Workday Apify' },
              { id: 'workday_direct', label: 'Workday Direct' },
              { id: 'indeed', label: 'Indeed' },
              { id: 'ats_direct', label: 'ATS' },
            ];
            const chips = allChips.filter((c) => c.id === 'all' || _sourceCount(c.id) > 0);
            if (chips.length <= 1) return null;
            return (
              <div className="flex flex-wrap items-center gap-1 px-1 text-[10px] text-muted-foreground">
                <span className="mr-1">Source:</span>
                {chips.map((c) => {
                  const active = sourceFilter === c.id;
                  const n = _sourceCount(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSourceFilter(c.id)}
                      className={
                        'rounded-full px-2 py-0.5 transition-colors ' +
                        (active
                          ? 'bg-purple-600/90 text-white'
                          : 'text-foreground/70 hover:bg-muted/60 hover:text-foreground')
                      }
                      title={`${c.label} — ${n} posting${n === 1 ? '' : 's'}`}
                    >
                      {c.label}
                      <span className={'ml-1 ' + (active ? 'opacity-90' : 'opacity-50')}>· {n}</span>
                    </button>
                  );
                })}
                {sourceFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSourceFilter('all')}
                    className="ml-auto underline-offset-2 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            );
          })()}

          <TierGroup
            title={`🥇 Tier 1 — apply first (${tier1.length})`}
            items={tier1}
            accent="border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
            appliedIds={appliedSet}
            openedIds={openedSet}
            newIds={newIds}
            batchSelectedIds={batchSelectedSet}
            tailorLoadingId={tailorLoadingId}
            focusedId={focusedRowId}
            showApplied={showApplied}
            matchScores={matchScores}
            onOpen={handleOpenPosting}
            onMarkApplied={handleMarkApplied}
            onDismissOpened={handleDismissOpened}
            onTailor={handleTailor}
            onSnooze={handleSnooze}
            onToggleBatch={handleToggleBatch}
            onHideCompany={handleHideCompany}
            onHideTitlePattern={handleHideTitlePattern}
            onReachOut={handleReachOut}
          />
          <TierGroup
            title={`🥈 Tier 2 (${tier2.length})`}
            items={tier2}
            accent="border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300"
            appliedIds={appliedSet}
            openedIds={openedSet}
            newIds={newIds}
            batchSelectedIds={batchSelectedSet}
            tailorLoadingId={tailorLoadingId}
            focusedId={focusedRowId}
            showApplied={showApplied}
            matchScores={matchScores}
            onOpen={handleOpenPosting}
            onMarkApplied={handleMarkApplied}
            onDismissOpened={handleDismissOpened}
            onTailor={handleTailor}
            onSnooze={handleSnooze}
            onToggleBatch={handleToggleBatch}
            onHideCompany={handleHideCompany}
            onHideTitlePattern={handleHideTitlePattern}
            onReachOut={handleReachOut}
          />
          <TierGroup
            title={`🥉 Tier 3 (${tier3.length})`}
            items={tier3}
            accent="border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300"
            appliedIds={appliedSet}
            openedIds={openedSet}
            newIds={newIds}
            batchSelectedIds={batchSelectedSet}
            tailorLoadingId={tailorLoadingId}
            focusedId={focusedRowId}
            showApplied={showApplied}
            matchScores={matchScores}
            onOpen={handleOpenPosting}
            onMarkApplied={handleMarkApplied}
            onDismissOpened={handleDismissOpened}
            onTailor={handleTailor}
            onSnooze={handleSnooze}
            onToggleBatch={handleToggleBatch}
            onHideCompany={handleHideCompany}
            onHideTitlePattern={handleHideTitlePattern}
            onReachOut={handleReachOut}
          />

          {filteredVerifyDates.length > 0 && (
            <TierGroup
              title={`⚠️ Verify dates (interns / co-ops) — ${filteredVerifyDates.length}`}
              items={filteredVerifyDates}
              accent="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              appliedIds={appliedSet}
              openedIds={openedSet}
              newIds={newIds}
              batchSelectedIds={batchSelectedSet}
              tailorLoadingId={tailorLoadingId}
              focusedId={focusedRowId}
              showApplied={showApplied}
              matchScores={matchScores}
              onOpen={handleOpenPosting}
              onMarkApplied={handleMarkApplied}
              onDismissOpened={handleDismissOpened}
              onTailor={handleTailor}
              onSnooze={handleSnooze}
              onToggleBatch={handleToggleBatch}
              onHideCompany={handleHideCompany}
              onHideTitlePattern={handleHideTitlePattern}
              onReachOut={handleReachOut}
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

      <ReachOutModal
        open={!!reachOutRec}
        rec={reachOutRec}
        onClose={() => setReachOutRec(null)}
      />

      {/* Sticky batch bar — appears only when the user has ticked ≥1 row.
          Fixed to viewport bottom so it survives scrolling through long tier
          lists. Single-row Tailor / Open / Apply are untouched. */}
      {batchSelectedIds.length > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 pointer-events-none"
          role="region"
          aria-label="Batch tailor selection"
        >
          <div className="pointer-events-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-600/95 to-indigo-600/95 px-4 py-2.5 shadow-2xl shadow-purple-900/40 backdrop-blur-md">
            <div className="flex min-w-0 items-center gap-2 text-white">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold tabular-nums">
                {batchSelectedIds.length}
              </span>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-semibold">
                  selected
                  <span className="hidden sm:inline"> for batch tailor</span>
                </span>
                <span className="hidden text-[10px] text-white/80 sm:inline">
                  Pre-fetches each JD, then hands off to Batch Tailor
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearBatch}
                disabled={batchRunning}
                className="h-8 px-2 text-white hover:bg-white/15 hover:text-white"
                title="Clear all selected"
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={handleRunBatch}
                disabled={batchRunning}
                className="h-8 gap-1.5 bg-white text-purple-700 hover:bg-white/90 disabled:opacity-70"
                title="Pre-fetch every JD and open in Batch Tailor"
              >
                {batchRunning ? (
                  <>
                    <span className="inline-block h-3 w-3 rounded-full border-2 border-purple-600/60 border-t-transparent animate-spin" />
                    Prefetching…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3.5 w-3.5" />
                    Run batch ({batchSelectedIds.length})
                  </>
                )}
              </Button>
            </div>
          </div>
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

import { useEffect, useState } from 'react';
import { Wand2, ArrowRight, RefreshCw, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiService } from '@/lib/api';
import { clearSuggestionsCache } from './SmartFiltersPanel';
import type { SmartFilterSuggestions } from '@/types/jobs';

// Reuse the same module-level cache key as SmartFiltersPanel — both surfaces
// share one cached set of suggestions. Cache logic is duplicated here as a
// dependency-free read so this file doesn't need to import the storage helpers.
const SUGGEST_STORAGE_KEY = 'smart_filters_suggestions_v1';
const SUGGEST_TTL_MS = 24 * 60 * 60 * 1000;

function readCached(): SmartFilterSuggestions | null {
  try {
    const raw = sessionStorage.getItem(SUGGEST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: SmartFilterSuggestions; cachedAt: number };
    if (Date.now() - parsed.cachedAt > SUGGEST_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCached(data: SmartFilterSuggestions) {
  try {
    sessionStorage.setItem(SUGGEST_STORAGE_KEY, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {
    /* quota */
  }
}

const PENDING_KEY = 'pending_smart_filters';

// Discovery-state lifecycle for the inline teaser. Stored in localStorage so
// the choice persists across browser restarts. Three states:
//   - 'new'       → never seen; show the card
//   - 'used'      → user clicked "Apply to Daily Pipeline"; never re-show
//   - 'dismissed' → user X'd the card; never re-show
// The Smart Filters tab in Job Opportunities is the canonical home for repeat
// use, so we don't need to nag in the Tailor view ever again.
const STATE_KEY = 'smart_filters_inline_state_v1';
type InlineState = 'new' | 'used' | 'dismissed';

function readState(): InlineState {
  try {
    const v = localStorage.getItem(STATE_KEY);
    if (v === 'used' || v === 'dismissed') return v;
    // One-time migration: respect any prior session-scoped dismissal
    // so users who already X'd it don't see the card again.
    const legacy = sessionStorage.getItem('smart_filters_inline_dismissed');
    if (legacy === '1') {
      localStorage.setItem(STATE_KEY, 'dismissed');
      return 'dismissed';
    }
  } catch {
    /* storage disabled */
  }
  return 'new';
}

function writeState(s: InlineState) {
  try { localStorage.setItem(STATE_KEY, s); } catch { /* */ }
}

const PRESET_GRADIENTS: Record<string, string> = {
  'cloud-devops': 'from-sky-500 to-cyan-500',
  'ai-ml': 'from-fuchsia-500 to-purple-500',
  backend: 'from-emerald-500 to-teal-500',
  frontend: 'from-orange-500 to-pink-500',
  fullstack: 'from-violet-500 to-indigo-500',
};

/**
 * Compact resume-aware filter teaser shown on the Tailor view.
 * Apply → writes suggestions to sessionStorage and dispatches a navigation event;
 * the parent ResumeParser page listens and switches to the "jobs" section,
 * where DailyPipelinePanel consumes the pending suggestions on next mount.
 */
export function SmartFiltersInline() {
  const initialState = typeof window !== 'undefined' ? readState() : 'new';
  // Compute alive *before* anything else — when the card has been used or
  // dismissed previously, we render nothing and never make the suggester call.
  const [state, setState] = useState<InlineState>(initialState);
  const alive = state === 'new';

  const cached = alive && typeof window !== 'undefined' ? readCached() : null;
  const [loading, setLoading] = useState(alive && !cached);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SmartFilterSuggestions | null>(cached);
  const [expanded, setExpanded] = useState(false);

  const load = async (force = false) => {
    if (!force) {
      const c = readCached();
      if (c) {
        setSuggestions(c);
        setLoading(false);
        return;
      }
    } else {
      clearSuggestionsCache();
    }
    setLoading(true);
    setError(null);
    const resp = await apiService.suggestPipelineFilters();
    setLoading(false);
    if (resp.error) {
      setError(resp.error);
      return;
    }
    if (resp.data?.suggestions) {
      setSuggestions(resp.data.suggestions);
      writeCached(resp.data.suggestions);
    }
  };

  useEffect(() => {
    if (!alive || suggestions) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alive]);

  if (!alive) return null;

  const dismiss = () => {
    writeState('dismissed');
    setState('dismissed');
  };

  const handleApply = () => {
    if (!suggestions) return;
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(suggestions));
    } catch {
      /* ignore quota */
    }
    // Mark used so the teaser never re-appears on this browser.
    writeState('used');
    setState('used');
    window.dispatchEvent(new CustomEvent('portfolio:navigate-to-jobs'));
  };

  if (loading) {
    return (
      <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-indigo-500/5">
        <CardContent className="flex items-center gap-3 p-4">
          <Wand2 className="h-4 w-4 animate-pulse text-purple-500" />
          <Skeleton className="h-4 w-1/3" />
        </CardContent>
      </Card>
    );
  }

  if (error || !suggestions) {
    return null; // Silent on tailor view — surfaced fully on the dedicated tab.
  }

  return (
    <Card className="overflow-hidden border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-transparent to-indigo-500/10">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Wand2 className="h-3.5 w-3.5 text-purple-500" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-300">
                Smart Filters from your resume
              </p>
              {suggestions.preset_tags.slice(0, 2).map((tag) => {
                const grad = PRESET_GRADIENTS[tag.toLowerCase()] || 'from-purple-500 to-indigo-500';
                return (
                  <span
                    key={tag}
                    className={`inline-flex items-center rounded-full bg-gradient-to-r ${grad} px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white`}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
            <p className="text-sm font-semibold leading-tight">{suggestions.headline}</p>
            {suggestions.rationale && !expanded && (
              <p className="line-clamp-1 text-[11px] text-muted-foreground">{suggestions.rationale}</p>
            )}
            {expanded && suggestions.rationale && (
              <p className="text-[11px] text-muted-foreground">{suggestions.rationale}</p>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setExpanded((v) => !v)}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={dismiss}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="border-sky-500/30 text-[10px] text-sky-700 dark:text-sky-300">
                {suggestions.linkedin_keyword_sets.length} LinkedIn searches
              </Badge>
              <Badge variant="outline" className="border-emerald-500/30 text-[10px] text-emerald-700 dark:text-emerald-300">
                {suggestions.workday_titles.length} Workday titles
              </Badge>
              <Badge variant="outline" className="border-purple-500/30 text-[10px] text-purple-700 dark:text-purple-300">
                {suggestions.custom_role_terms.length} role keywords
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                Window: {suggestions.past_days}d
              </Badge>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleApply}
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90"
          >
            Apply to Daily Pipeline
            <ArrowRight className="h-3 w-3" />
          </Button>
          <Button
            onClick={() => load(true)}
            size="sm"
            variant="ghost"
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            Regenerate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

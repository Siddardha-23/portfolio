import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Wand2, Sparkles, RefreshCw, ArrowRight, AlertCircle, Brain, Calendar,
  Briefcase, Globe, Tag,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiService } from '@/lib/api';
import type { SmartFilterSuggestions } from '@/types/jobs';

interface SmartFiltersPanelProps {
  /** Called when user clicks "Apply to pipeline" — switches to Daily Pipeline tab with these filters preloaded. */
  onApply: (s: SmartFilterSuggestions) => void;
  /** Optional: render in compact mode for embedding inside other dashboards. */
  compact?: boolean;
}

const PRESET_GRADIENTS: Record<string, string> = {
  'cloud-devops': 'from-sky-500 to-cyan-500',
  'ai-ml': 'from-fuchsia-500 to-purple-500',
  backend: 'from-emerald-500 to-teal-500',
  frontend: 'from-orange-500 to-pink-500',
  fullstack: 'from-violet-500 to-indigo-500',
  data: 'from-blue-500 to-indigo-500',
  security: 'from-red-500 to-rose-500',
};

export function SmartFiltersPanel({ onApply, compact = false }: SmartFiltersPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SmartFilterSuggestions | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const resp = await apiService.suggestPipelineFilters();
    setLoading(false);
    if (resp.error) {
      setError(resp.error);
      return;
    }
    setSuggestions(resp.data?.suggestions || null);
  };

  useEffect(() => {
    load();
  }, []);

  const handleApply = () => {
    if (!suggestions) return;
    onApply(suggestions);
    toast.success('Smart filters applied to Daily Pipeline');
  };

  if (loading) {
    return (
      <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-indigo-500/5">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 animate-pulse text-purple-500" />
            <p className="text-sm font-medium">Reading your resume to suggest filters…</p>
          </div>
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/40 bg-red-500/5">
        <CardContent className="flex items-start gap-3 p-5">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              Couldn't generate filters
            </p>
            <p className="text-xs text-red-700/80 dark:text-red-300/80">{error}</p>
            <div className="flex gap-2">
              <Button onClick={load} size="sm" variant="outline" className="gap-1.5">
                <RefreshCw className="h-3 w-3" />
                Retry
              </Button>
              {error.toLowerCase().includes('no resume') && (
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a href="/resume-parser">Upload resume</a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!suggestions) return null;

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <Card className="overflow-hidden border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-transparent to-indigo-500/10">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-purple-500" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-300">
                  Resume-aware suggestions
                </p>
              </div>
              <h3 className="text-lg font-semibold leading-tight">{suggestions.headline}</h3>
              {suggestions.rationale && (
                <p className="max-w-2xl text-xs text-muted-foreground">
                  {suggestions.rationale}
                </p>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <Button
                onClick={load}
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
              >
                <RefreshCw className="h-3 w-3" />
                Regenerate
              </Button>
              <Button
                onClick={handleApply}
                className="gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Apply to pipeline
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Preset persona badges */}
          {suggestions.preset_tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag className="h-3 w-3 text-muted-foreground" />
              {suggestions.preset_tags.map((tag) => {
                const grad = PRESET_GRADIENTS[tag.toLowerCase()] || 'from-purple-500 to-indigo-500';
                return (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r ${grad} px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm`}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {!compact && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SuggestionGroup
            icon={<Globe className="h-3.5 w-3.5" />}
            title="LinkedIn keyword phrases"
            subtitle="Used to build LinkedIn search URLs"
            items={suggestions.linkedin_keyword_sets}
            accent="border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
          />
          <SuggestionGroup
            icon={<Briefcase className="h-3.5 w-3.5" />}
            title="Workday job titles"
            subtitle="Used as titleSearch[] for the Workday actor"
            items={suggestions.workday_titles}
            accent="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            collapsible
          />
          <SuggestionGroup
            icon={<Tag className="h-3.5 w-3.5" />}
            title="Custom role keywords"
            subtitle="Used to keep adjacent matches that aren't in the built-in role families"
            items={suggestions.custom_role_terms}
            accent="border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
          />
          <Card className="border-border/60">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Recommended window
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums">{suggestions.past_days}</span>
                <span className="text-sm text-muted-foreground">
                  day{suggestions.past_days === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {suggestions.past_days === 1
                  ? 'Daily flow — surface the freshest postings only.'
                  : 'Slightly wider window — niche roles have lower daily volume.'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function SuggestionGroup({
  icon,
  title,
  subtitle,
  items,
  accent,
  collapsible,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  items: string[];
  accent: string;
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(!collapsible);
  const visible = expanded ? items : items.slice(0, 8);

  return (
    <Card className="border-border/60 bg-card/60">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {icon}
              {title}
            </div>
            {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <Badge variant="outline">{items.length}</Badge>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {visible.length === 0 ? (
            <p className="text-[11px] italic text-muted-foreground">No suggestions</p>
          ) : (
            visible.map((s) => (
              <span
                key={s}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${accent}`}
              >
                {s}
              </span>
            ))
          )}
        </div>
        {collapsible && items.length > 8 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="h-6 text-[11px] text-muted-foreground"
          >
            {expanded ? 'Show less' : `Show all ${items.length}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

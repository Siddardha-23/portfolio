/**
 * BetaLabTab — Beta features that aren't yet promoted to the main flow.
 *
 * Layout: card grid. Each card is either a working "functional" feature
 * (load on click, render output inline) or a "coming soon" stub with a
 * description and a non-blocking "Notify me" button.
 *
 * Design principle: nothing here disrupts the main app. All cards are
 * opt-in clicks; none of them auto-fetch on mount.
 */
import { useState, useCallback } from 'react';
import { apiService } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Beaker, Wand2, Sparkles, ListChecks, Compass,
  BellRing, BookOpen, Bot, Globe, ChevronRight,
} from 'lucide-react';

type BriefingState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; headline: string; lines: string[]; counts: Record<string, number> }
  | { kind: 'error'; message: string };

type SimilarState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; tokens: string[]; results: Array<{ title: string; company: string; url?: string; score_overlap: number; status?: string }> }
  | { kind: 'error'; message: string };

type AbState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; total: number; hasTagged: boolean; insight?: string; variants: Array<{ variant: string; total: number; callback_rate: number; offers: number; interviewed: number }> }
  | { kind: 'error'; message: string };

export default function BetaLabTab() {
  const [brief, setBrief] = useState<BriefingState>({ kind: 'idle' });
  const [similar, setSimilar] = useState<SimilarState>({ kind: 'idle' });
  const [similarJd, setSimilarJd] = useState('');
  const [ab, setAb] = useState<AbState>({ kind: 'idle' });

  const runBrief = useCallback(async () => {
    setBrief({ kind: 'loading' });
    const resp = await apiService.getMorningBrief();
    if (resp.error || !resp.data?.ok) {
      setBrief({ kind: 'error', message: resp.error || 'Failed to build briefing.' });
      return;
    }
    setBrief({
      kind: 'done',
      headline: resp.data.briefing.headline,
      lines: resp.data.briefing.lines,
      counts: resp.data.briefing.counts,
    });
  }, []);

  const runSimilar = useCallback(async () => {
    if (similarJd.trim().length < 80) {
      toast.error('Paste at least a paragraph of the JD.');
      return;
    }
    setSimilar({ kind: 'loading' });
    const resp = await apiService.findSimilarRoles(similarJd.trim());
    if (resp.error || !resp.data?.ok) {
      setSimilar({ kind: 'error', message: resp.error || resp.data?.error || 'Failed.' });
      return;
    }
    setSimilar({
      kind: 'done',
      tokens: resp.data.seed_tokens || [],
      results: resp.data.results || [],
    });
  }, [similarJd]);

  const runAb = useCallback(async () => {
    setAb({ kind: 'loading' });
    const resp = await apiService.getAbTelemetry();
    if (resp.error || !resp.data?.ok) {
      setAb({ kind: 'error', message: resp.error || 'Failed to load telemetry.' });
      return;
    }
    setAb({
      kind: 'done',
      total: resp.data.total_apps,
      hasTagged: resp.data.has_tagged_data,
      insight: resp.data.insight || '',
      variants: resp.data.variants,
    });
  }, []);

  const notify = (label: string) => {
    toast.success(`Got it — we'll ping you when ${label} ships.`);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-500">
          Experimental
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-fuchsia-600 to-violet-600 bg-clip-text text-transparent inline-flex items-center gap-2">
              <Beaker className="h-6 w-6" /> Beta Lab
            </span>
          </h2>
          <span className="rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-600 dark:text-fuchsia-300">
            All in beta
          </span>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Experiments that aren't ready for the main flow. Working ones run on
          click; "Coming soon" cards are scoped and ranked, just not built yet.
          Send feedback — these decisions reshape the roadmap.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* ─── #8 Morning Agent ──────────────────────────────────────── */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] to-teal-500/[0.04]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                Morning Agent
              </CardTitle>
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-300">
                Working
              </Badge>
            </div>
            <CardDescription className="text-xs">
              One-screen briefing of what to do today — synthesizes follow-ups,
              interviews, saved roles, daily cadence.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {brief.kind === 'idle' && (
              <Button size="sm" onClick={runBrief} className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500">
                <ListChecks className="h-3.5 w-3.5" />
                Generate today's brief
              </Button>
            )}
            {brief.kind === 'loading' && (
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Synthesizing your agenda…
              </p>
            )}
            {brief.kind === 'done' && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  {brief.headline}
                </p>
                <ul className="space-y-1.5 text-xs">
                  {brief.lines.map((l, i) => (
                    <li key={i} className="leading-relaxed">{l}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(brief.counts).map(([k, v]) => (
                    <span key={k} className="rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground tabular-nums">
                      {k.replace(/_/g, ' ')}: <b>{v}</b>
                    </span>
                  ))}
                </div>
                <Button size="sm" variant="ghost" onClick={runBrief} className="h-7 gap-1 text-[11px]">
                  ↻ Regenerate
                </Button>
              </div>
            )}
            {brief.kind === 'error' && (
              <div className="space-y-2">
                <p className="text-xs text-rose-600">{brief.message}</p>
                <Button size="sm" variant="outline" onClick={runBrief}>Retry</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── #12 JD reverse-search ─────────────────────────────────── */}
        <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.04] to-violet-500/[0.04]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base inline-flex items-center gap-2">
                <Compass className="h-4 w-4 text-indigo-500" />
                JD → Similar Roles
              </CardTitle>
              <Badge variant="outline" className="border-indigo-500/40 bg-indigo-500/10 text-[10px] text-indigo-600 dark:text-indigo-300">
                Working
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Paste a JD you like — surfaces matching saved/recent roles by
              skill-token overlap.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <textarea
              value={similarJd}
              onChange={(e) => setSimilarJd(e.target.value)}
              rows={4}
              maxLength={15000}
              placeholder="Paste the JD you'd like to find more like…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <Button
              size="sm"
              onClick={runSimilar}
              disabled={similar.kind === 'loading'}
              className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-500"
            >
              {similar.kind === 'loading' ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Searching…</>
              ) : (
                <><Wand2 className="h-3.5 w-3.5" />Find similar</>
              )}
            </Button>
            {similar.kind === 'done' && (
              <div className="space-y-2 pt-1">
                {similar.tokens.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {similar.tokens.slice(0, 12).map((t) => (
                      <span key={t} className="rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-700 dark:text-indigo-300">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {similar.results.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No matches in your saved roles. Save more jobs from the pipeline
                    to seed the index.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {similar.results.map((r, i) => (
                      <li key={`${r.url || r.title}-${i}`} className="rounded-md border border-border/50 bg-background px-2.5 py-1.5">
                        <a
                          href={r.url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 text-xs hover:text-indigo-600 dark:hover:text-indigo-300"
                        >
                          <span className="truncate">
                            <b>{r.title}</b>
                            {r.company ? <span className="text-muted-foreground"> · {r.company}</span> : null}
                          </span>
                          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            {r.score_overlap} match{r.score_overlap === 1 ? '' : 'es'}
                            <ChevronRight className="h-3 w-3" />
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {similar.kind === 'error' && (
              <p className="text-xs text-rose-600">{similar.message}</p>
            )}
          </CardContent>
        </Card>

        {/* ─── #6 A/B Telemetry ──────────────────────────────────────── */}
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/[0.04] to-orange-500/[0.04]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base inline-flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-500" />
                Resume A/B Telemetry
              </CardTitle>
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-300">
                Working
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Callback rates by resume variant. Tag your tailored submissions to
              see which framing converts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {ab.kind === 'idle' && (
              <Button size="sm" onClick={runAb} className="gap-1.5 bg-amber-600 text-white hover:bg-amber-500">
                <BookOpen className="h-3.5 w-3.5" />
                Load my stats
              </Button>
            )}
            {ab.kind === 'loading' && (
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Crunching tailoring records…
              </p>
            )}
            {ab.kind === 'done' && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  Across <b className="tabular-nums">{ab.total}</b> tailored submission{ab.total === 1 ? '' : 's'}.
                  {!ab.hasTagged && (
                    <span className="ml-1 text-amber-600 dark:text-amber-300">
                      No variants tagged yet — when you save a tailored resume, set
                      a <code className="font-mono">variant</code> tag (e.g. "A" or "B") to start comparing.
                    </span>
                  )}
                </p>
                {ab.insight && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">AI insight</span>
                    <p className="mt-0.5 text-amber-700/90 dark:text-amber-200/90 leading-relaxed">{ab.insight}</p>
                  </div>
                )}
                {ab.variants.length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40 text-left text-[10px] uppercase text-muted-foreground">
                        <th className="py-1.5">Variant</th>
                        <th className="py-1.5 tabular-nums">Sent</th>
                        <th className="py-1.5 tabular-nums">Interviews</th>
                        <th className="py-1.5 tabular-nums">Offers</th>
                        <th className="py-1.5 tabular-nums">Callback %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ab.variants.map((v) => (
                        <tr key={v.variant} className="border-b border-border/20">
                          <td className="py-1.5 font-medium">{v.variant}</td>
                          <td className="py-1.5 tabular-nums">{v.total}</td>
                          <td className="py-1.5 tabular-nums">{v.interviewed}</td>
                          <td className="py-1.5 tabular-nums">{v.offers}</td>
                          <td className="py-1.5 tabular-nums font-semibold">{v.callback_rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
            {ab.kind === 'error' && <p className="text-xs text-rose-600">{ab.message}</p>}
          </CardContent>
        </Card>

        {/* ─── #7 Recruiter scrape (stub) ────────────────────────────── */}
        <StubCard
          icon={<Globe className="h-4 w-4 text-rose-500" />}
          title="LinkedIn Recruiter Auto-Discover"
          description="Phase 2 of Reach Out. Apify-scrapes 3 recruiters / hiring managers per Tier 1 row so you don't have to find them manually."
          eta="2 weeks"
          onNotify={() => notify('LinkedIn auto-discover')}
        />

        {/* ─── #9 Co-applicant (stub) ────────────────────────────────── */}
        <StubCard
          icon={<Bot className="h-4 w-4 text-violet-500" />}
          title="AI Co-Applicant Agent"
          description="The agent loop: scrape → rank → tailor → reach out → fill apply form → flash-prep → thank-you. You show up to interviews."
          eta="6+ weeks"
          onNotify={() => notify('AI Co-Applicant')}
        />

        {/* ─── #10 Chrome extension (stub) ───────────────────────────── */}
        <StubCard
          icon={<Compass className="h-4 w-4 text-sky-500" />}
          title="Apply Autopilot (Chrome ext.)"
          description="Watches Workday/Greenhouse/Lever forms, auto-fills your info, EEO, visa answers, and uploads the matching tailored resume."
          eta="4 weeks"
          onNotify={() => notify('Apply Autopilot')}
        />

        {/* ─── #11 Brand engine (stub) ───────────────────────────────── */}
        <StubCard
          icon={<BellRing className="h-4 w-4 text-pink-500" />}
          title="Personal Brand Auto-Engine"
          description="Weekly LinkedIn post + blog draft + GitHub README updates from your commits. Flips you from applying to being recruited."
          eta="8 weeks"
          onNotify={() => notify('Brand Engine')}
        />
      </div>

      <p className="text-[11px] text-muted-foreground border-t border-border/40 pt-3">
        Beta features may be unstable or change behavior. Disable them by simply
        not opening this tab — the rest of the app is unaffected.
      </p>
    </div>
  );
}

function StubCard({
  icon,
  title,
  description,
  eta,
  onNotify,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  eta: string;
  onNotify: () => void;
}) {
  return (
    <Card className="border-dashed border-border/60 bg-card/40">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base inline-flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <Badge variant="outline" className="border-border/60 text-[10px] text-muted-foreground">
            Coming soon · ~{eta}
          </Badge>
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          size="sm"
          onClick={onNotify}
          className="gap-1.5 text-xs"
        >
          <BellRing className="h-3 w-3" />
          Notify me when live
        </Button>
      </CardContent>
    </Card>
  );
}

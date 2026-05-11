/**
 * VisaTimelineTab — F-1 / OPT / STEM / H-1B clock dashboard.
 *
 * Two halves:
 *   1. Profile form (small — visa status, key dates, STEM flag, H-1B year)
 *   2. Computed milestone cards ordered by upcoming cliff date, color-coded
 *      by severity. Auto-refreshes when the profile changes.
 *
 * The profile lives in MongoDB (visa_profiles collection). Empty state shows
 * a CTA explaining what the dashboard will give them.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { apiService } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CalendarClock, ShieldCheck, Save, Info } from 'lucide-react';
import type { VisaProfile, VisaMilestone, VisaStatusCode } from '@/types/visa';

const STATUS_LABELS: Record<VisaStatusCode, string> = {
  F1: 'F-1 student (pre-OPT)',
  'F1-CPT': 'F-1 on CPT',
  'F1-OPT': 'F-1 on post-completion OPT',
  'F1-STEM-OPT': 'F-1 on STEM 24-month extension',
  H1B: 'H-1B holder',
  Other: 'Other / not applicable',
};

const EMPTY_PROFILE: VisaProfile = {
  visa_status: 'F1',
  stem_degree: false,
  stem_extension_filed: false,
  h1b_lottery_filed: false,
  current_employer_e_verified: false,
  country_of_birth: '',
  opt_ead_arrival_date: '',
  opt_start_date: '',
  opt_end_date: '',
  stem_extension_end_date: '',
  cpt_end_date: '',
  h1b_lottery_year: null,
  notes: '',
};

function severityClasses(sev: VisaMilestone['severity']) {
  switch (sev) {
    case 'critical':
      return {
        ring: 'border-rose-500/40 bg-rose-500/[0.06]',
        text: 'text-rose-700 dark:text-rose-300',
        badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
      };
    case 'warning':
      return {
        ring: 'border-amber-500/40 bg-amber-500/[0.06]',
        text: 'text-amber-700 dark:text-amber-300',
        badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      };
    default:
      return {
        ring: 'border-border/60 bg-card/40',
        text: 'text-foreground',
        badge: 'bg-muted text-muted-foreground border-border/60',
      };
  }
}

function relativeLabel(days: number | null): string {
  if (days === null || days === undefined) return '—';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 0) return `in ${days} day${days === 1 ? '' : 's'}`;
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
}

export default function VisaTimelineTab() {
  const [profile, setProfile] = useState<VisaProfile>(EMPTY_PROFILE);
  const [milestones, setMilestones] = useState<VisaMilestone[]>([]);
  const [recommendation, setRecommendation] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadTimeline = useCallback(async () => {
    const resp = await apiService.getVisaTimeline();
    if (resp.data) {
      setProfile({ ...EMPTY_PROFILE, ...resp.data.profile });
      setMilestones(resp.data.milestones || []);
      setRecommendation(resp.data.recommendation || '');
      setDirty(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const resp = await apiService.saveVisaProfile(profile);
    setSaving(false);
    if (resp.error) {
      toast.error('Could not save profile', { description: resp.error });
      return;
    }
    toast.success('Visa profile saved — timeline refreshing.');
    // Re-fetch so the milestones reflect the new profile
    await loadTimeline();
  }, [profile, loadTimeline]);

  const update = useCallback(<K extends keyof VisaProfile>(key: K, val: VisaProfile[K]) => {
    setProfile((p) => ({ ...p, [key]: val }));
    setDirty(true);
  }, []);

  const upcoming = useMemo(() => milestones.filter((m) => (m.days_remaining ?? 0) >= 0), [milestones]);
  const past = useMemo(() => milestones.filter((m) => (m.days_remaining ?? 0) < 0), [milestones]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading your visa timeline…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-500">
          F-1 / OPT / H-1B
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Visa Timeline Copilot
            </span>
          </h2>
          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
            Beta
          </span>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Single source of truth for visa cliffs: OPT 90-day unemployment, STEM
          extension filing window, H-1B lottery deadlines. Your profile stays in
          your account — nothing is shared.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Your visa profile
          </CardTitle>
          <CardDescription className="text-xs">
            Update these whenever your status changes. We never share this data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Current visa status</Label>
              <Select
                value={profile.visa_status}
                onValueChange={(v) => update('visa_status', v as VisaStatusCode)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as VisaStatusCode[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Country of birth</Label>
              <Input
                value={profile.country_of_birth || ''}
                onChange={(e) => update('country_of_birth', e.target.value)}
                placeholder="e.g. India, China, Nigeria"
                className="h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">OPT EAD arrival date</Label>
              <Input
                type="date"
                value={profile.opt_ead_arrival_date || ''}
                onChange={(e) => update('opt_ead_arrival_date', e.target.value || null)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">OPT start date</Label>
              <Input
                type="date"
                value={profile.opt_start_date || ''}
                onChange={(e) => update('opt_start_date', e.target.value || null)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">OPT end date</Label>
              <Input
                type="date"
                value={profile.opt_end_date || ''}
                onChange={(e) => update('opt_end_date', e.target.value || null)}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">CPT end date (if on CPT)</Label>
              <Input
                type="date"
                value={profile.cpt_end_date || ''}
                onChange={(e) => update('cpt_end_date', e.target.value || null)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">STEM extension end</Label>
              <Input
                type="date"
                value={profile.stem_extension_end_date || ''}
                onChange={(e) => update('stem_extension_end_date', e.target.value || null)}
                className="h-9"
                disabled={!profile.stem_extension_filed}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">H-1B lottery FY</Label>
              <Input
                type="number"
                min={2024}
                max={2035}
                value={profile.h1b_lottery_year || ''}
                onChange={(e) =>
                  update('h1b_lottery_year', e.target.value ? Number(e.target.value) : null)
                }
                placeholder="2026"
                className="h-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.stem_degree}
                onChange={(e) => update('stem_degree', e.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-600"
              />
              STEM degree
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.stem_extension_filed}
                onChange={(e) => update('stem_extension_filed', e.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-600"
              />
              STEM extension filed
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.h1b_lottery_filed}
                onChange={(e) => update('h1b_lottery_filed', e.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-600"
              />
              H-1B registered this FY
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.current_employer_e_verified}
                onChange={(e) => update('current_employer_e_verified', e.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-600"
              />
              Current employer is E-Verified
            </label>
          </div>

          <div className="flex items-center justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={saving || !dirty}
              size="sm"
              className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving…
                </>
              ) : dirty ? (
                <>
                  <Save className="h-3 w-3" />
                  Save & refresh
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3 w-3" />
                  Saved
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {recommendation && (
        <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.05] to-teal-500/[0.05]">
          <CardContent className="p-4 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              AI recommendation
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">{recommendation}</p>
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" />
          Upcoming cliffs ({upcoming.length})
        </h3>
        {upcoming.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
              <Info className="h-4 w-4" />
              No active cliffs in your timeline yet. Fill out your profile above
              to populate.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {upcoming.map((m) => {
              const c = severityClasses(m.severity);
              return (
                <Card key={m.id} className={`border ${c.ring}`}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className={`text-sm font-semibold leading-tight ${c.text}`}>
                        {m.label}
                      </h4>
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${c.badge}`}>
                        {relativeLabel(m.days_remaining)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {m.description}
                    </p>
                    {m.date && (
                      <p className="text-[11px] tabular-nums text-muted-foreground/80 inline-flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        {m.date}
                      </p>
                    )}
                    {m.severity === 'critical' && (
                      <p className="text-[11px] text-rose-700 dark:text-rose-300 inline-flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Critical — act soon.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <details className="rounded-lg border border-border/60 px-3 py-2 text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
            Past milestones ({past.length})
          </summary>
          <div className="mt-3 space-y-2">
            {past.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-3 py-1.5 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground">{m.date}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground/80">
                  {relativeLabel(m.days_remaining)}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

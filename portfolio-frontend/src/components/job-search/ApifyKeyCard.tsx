import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Key, Plus, Pencil, Trash2, ExternalLink, ChevronDown, ChevronUp,
  AlertCircle, Check, X, Eye, EyeOff,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiService } from '@/lib/api';
import type { ApifyKeyStatus } from '@/types/jobs';

interface ApifyKeyCardProps {
  /** Optional callback when the key status changes — lets the parent
   *  refresh the pipeline UI affordances. */
  onChange?: (status: ApifyKeyStatus) => void;
  /** Force the card open in edit mode (e.g. after credit exhaustion). */
  forceOpenSignal?: number;
}

export function ApifyKeyCard({ onChange, forceOpenSignal }: ApifyKeyCardProps) {
  const [status, setStatus] = useState<ApifyKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const resp = await apiService.getApifyKey();
    setLoading(false);
    if (resp.error) {
      setError(resp.error);
      return;
    }
    setStatus(resp.data || { has_key: false });
    onChange?.(resp.data || { has_key: false });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parent can yank the card open in edit mode after a credit-exhausted run.
  useEffect(() => {
    if (forceOpenSignal !== undefined) {
      setEditing(true);
      setDraft('');
      setError(null);
    }
  }, [forceOpenSignal]);

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError('Key cannot be empty');
      return;
    }
    if (!/^apify_api_[A-Za-z0-9]{20,}$/.test(trimmed)) {
      setError('Invalid format. Apify keys start with "apify_api_" and are 40+ chars.');
      return;
    }
    setSaving(true);
    setError(null);
    const resp = await apiService.setApifyKey(trimmed);
    setSaving(false);
    if (resp.error) {
      setError(resp.error);
      return;
    }
    const next: ApifyKeyStatus = {
      has_key: true,
      masked: resp.data?.masked,
      updated_at: resp.data?.updated_at,
    };
    setStatus(next);
    setEditing(false);
    setDraft('');
    setShowKey(false);
    onChange?.(next);
    toast.success('Apify key saved — next pipeline run will use your key.');
  };

  const handleDelete = async () => {
    if (!confirm('Remove your Apify key? Future pipeline runs will fall back to the shared key.')) {
      return;
    }
    setSaving(true);
    const resp = await apiService.deleteApifyKey();
    setSaving(false);
    if (resp.error) {
      toast.error(resp.error);
      return;
    }
    setStatus({ has_key: false });
    onChange?.({ has_key: false });
    toast.success('Your Apify key has been removed.');
  };

  // Collapsed pill: render once a key is set and the user isn't editing.
  // The full guide / actions still live one click away.
  if (status?.has_key && !editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Key className="h-3 w-3 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium text-emerald-700 dark:text-emerald-300">
            Your Apify key
          </span>
          <span className="font-mono text-muted-foreground">{status.masked}</span>
          {status.updated_at && (
            <span className="text-[10px] text-muted-foreground">
              · updated {new Date(status.updated_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setEditing(true); setDraft(''); setError(null); }}
            disabled={saving}
            className="h-7 gap-1 text-[11px]"
          >
            <Pencil className="h-3 w-3" />
            Update
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={saving}
            className="h-7 gap-1 text-[11px] text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-300"
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-border/60 bg-card/60">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <Key className="h-3.5 w-3.5 text-purple-500" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Apify API key
              </p>
              {!loading && status && (
                <Badge
                  variant="outline"
                  className={status.has_key
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300'
                    : 'border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300'
                  }
                >
                  {status.has_key ? 'Your key' : 'Shared key fallback'}
                </Badge>
              )}
            </div>
            {loading ? (
              <p className="text-xs text-muted-foreground">Checking…</p>
            ) : status?.has_key ? (
              <p className="text-xs text-muted-foreground">
                Using <span className="font-mono">{status.masked}</span>
                {status.updated_at && (
                  <span className="opacity-60">
                    {' · '}updated {new Date(status.updated_at).toLocaleDateString()}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Pipeline runs use the shared platform key (limited capacity).
                Add your own key for unlimited daily runs.
              </p>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {!editing && status?.has_key && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setEditing(true); setDraft(''); setError(null); }}
                  className="gap-1 text-xs"
                  disabled={saving}
                >
                  <Pencil className="h-3 w-3" />
                  Update
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={saving}
                  className="gap-1 text-xs text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </Button>
              </>
            )}
            {!editing && !status?.has_key && !loading && (
              <Button
                size="sm"
                onClick={() => { setEditing(true); setDraft(''); setError(null); }}
                className="gap-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                Add your key
              </Button>
            )}
          </div>
        </div>

        {/* Edit / add form */}
        {editing && (
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Paste your Apify API token
            </label>
            <div className="flex flex-wrap items-stretch gap-2">
              <div className="relative flex-1 min-w-[260px]">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="apify_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  autoComplete="off"
                  spellCheck={false}
                  className="pr-9 font-mono text-xs focus-visible:border-purple-500/40 focus-visible:ring-purple-500/40"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !draft.trim()}
                className="gap-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90"
              >
                <Check className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setEditing(false); setDraft(''); setError(null); }}
                disabled={saving}
                className="gap-1"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            </div>
            {error && (
              <p className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Your key is stored in your account only and never shown to other users.
              Pipeline runs charge it directly to your Apify account.
            </p>
          </div>
        )}

        {/* How to get a key */}
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setHelpOpen((v) => !v)}
            className="gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {helpOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            How do I get an Apify key?
          </Button>
          {helpOpen && (
            <ol className="mt-2 space-y-1.5 rounded-lg border border-border/40 bg-muted/20 p-3 text-[12px] leading-snug text-muted-foreground">
              <li>
                <span className="font-semibold text-foreground">1.</span> Sign up free at{' '}
                <a
                  href="https://apify.com/sign-up"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-purple-600 underline hover:text-purple-700 dark:text-purple-300"
                >
                  apify.com/sign-up
                  <ExternalLink className="h-3 w-3" />
                </a>
                . The free plan includes ~$5 of monthly credit — enough for daily pipeline runs.
              </li>
              <li>
                <span className="font-semibold text-foreground">2.</span> Open{' '}
                <a
                  href="https://console.apify.com/settings/integrations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-purple-600 underline hover:text-purple-700 dark:text-purple-300"
                >
                  Settings → Integrations
                  <ExternalLink className="h-3 w-3" />
                </a>
                {' '}from the left sidebar.
              </li>
              <li>
                <span className="font-semibold text-foreground">3.</span> Copy the{' '}
                <span className="font-mono text-foreground">Personal API token</span>{' '}
                (starts with <span className="font-mono">apify_api_</span>).
              </li>
              <li>
                <span className="font-semibold text-foreground">4.</span> Paste it above and click{' '}
                <span className="font-semibold text-foreground">Save</span>. Your next pipeline run will charge
                your account instead of the shared one.
              </li>
              <li className="pt-1 text-[10px] italic">
                Note: this site only uses two free Apify actors (LinkedIn + Workday scrapers) —
                each daily run typically costs a few cents.
              </li>
            </ol>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ReachOutModal — drafts and opens a short cold-outreach email for a
 * specific posting. Reads the candidate's resume on the backend so the
 * generated message references real bullets, not generic platitudes.
 *
 * UX flow:
 *   1. Modal opens with a "Drafting…" state while /jobs/draft-outreach runs.
 *   2. Subject + body land in editable inputs. User can tweak.
 *   3. Three actions: Copy (clipboard), Open in Gmail (compose URL), Regenerate.
 *   4. User searches for the recruiter on LinkedIn separately and pastes the
 *      target email. Phase 2 will auto-discover via Apify.
 */
import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, Copy, ExternalLink, RefreshCw, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/lib/api';
import type { DailyPipelineRecord } from '@/types/jobs';

interface ReachOutModalProps {
  open: boolean;
  onClose: () => void;
  rec: DailyPipelineRecord | null;
}

type ToneOption = 'warm' | 'direct';

export function ReachOutModal({ open, onClose, rec }: ReachOutModalProps) {
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipient, setRecipient] = useState('');
  const [tone, setTone] = useState<ToneOption>('warm');
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (recArg: DailyPipelineRecord, toneArg: ToneOption) => {
      setLoading(true);
      setError(null);
      try {
        const resp = await apiService.draftOutreach({
          company: recArg.company,
          title: recArg.title,
          location: recArg.location,
          jd_text: recArg.description || '',
          tone: toneArg,
        });
        if (resp.error || !resp.data) {
          setError(resp.error || 'Draft failed');
          setLoading(false);
          return;
        }
        setSubject(resp.data.subject);
        setBody(resp.data.body);
      } catch {
        setError('Draft failed — try Regenerate.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Trigger initial generation on each open (and when the row changes).
  useEffect(() => {
    if (!open || !rec) return;
    setSubject('');
    setBody('');
    setRecipient('');
    setError(null);
    generate(rec, tone);
    // tone change handled via the explicit regenerate button so we don't
    // burn a Gemini call every time the user toggles the chip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rec?.url, rec?.title, rec?.company]);

  const handleCopy = useCallback(() => {
    const combined = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard
      .writeText(combined)
      .then(() => toast.success('Outreach copied — paste into your email client'))
      .catch(() => toast.error('Clipboard blocked'));
  }, [subject, body]);

  const handleOpenGmail = useCallback(() => {
    // Gmail compose URL pre-fills the new tab without needing OAuth. If the
    // user has a recipient typed in we drop it into the `to=` field; otherwise
    // they fill it in once Gmail opens. `body=` requires URL-encoded line
    // breaks (Gmail respects %0A).
    const params = new URLSearchParams();
    params.set('view', 'cm');
    params.set('fs', '1');
    if (recipient.trim()) params.set('to', recipient.trim());
    if (subject.trim()) params.set('su', subject.trim());
    if (body.trim()) params.set('body', body.trim());
    const url = `https://mail.google.com/mail/?${params.toString()}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [recipient, subject, body]);

  const handleRegenerate = useCallback(() => {
    if (!rec) return;
    generate(rec, tone);
  }, [rec, tone, generate]);

  if (!rec) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-purple-500" />
            Reach out — {rec.company}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {rec.title}{rec.location ? ` · ${rec.location}` : ''}. Drafted from your resume + the JD.
          </DialogDescription>
        </DialogHeader>

        {/* Tone selector */}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">Tone:</span>
          {(['warm', 'direct'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTone(t)}
              className={`rounded-full border px-2.5 py-0.5 transition-colors ${
                tone === t
                  ? 'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300'
                  : 'border-border/60 text-muted-foreground hover:border-border'
              }`}
            >
              {t}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-muted-foreground">
            Edit any field below before sending.
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            <p className="mt-2">Drafting outreach…</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recipient (optional)
              </label>
              <input
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="recruiter@company.com (find on LinkedIn / company site)"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                maxLength={120}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                maxLength={1800}
              />
              <p className="text-[10px] text-muted-foreground text-right">
                {body.length} / 1800
              </p>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRegenerate}
            disabled={loading}
            className="gap-1 text-xs"
            title="Re-run with the same tone"
          >
            <RefreshCw className="h-3 w-3" />
            Regenerate
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={loading || !body}
            className="gap-1 text-xs"
          >
            <Copy className="h-3 w-3" />
            Copy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleOpenGmail}
            disabled={loading || !body}
            className="gap-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90 text-xs"
            title="Open Gmail compose in a new tab with subject + body pre-filled"
          >
            <ExternalLink className="h-3 w-3" />
            Open in Gmail
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="gap-1 text-xs text-muted-foreground"
          >
            <X className="h-3 w-3" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

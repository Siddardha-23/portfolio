import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '@/lib/api';
import { toast } from 'sonner';

interface FeedbackItem {
  id: string;
  email: string;
  message: string;
  type: string;
  status: string;
  admin_response: string | null;
  created_at: string | null;
  responded_at: string | null;
}

type StatusFilter = 'all' | 'open' | 'responded' | 'resolved';

const TYPE_LABELS: Record<string, string> = {
  general: 'General',
  idea: 'Idea',
  bug: 'Bug',
  quota_bump: 'Quota bump',
};

const TYPE_TONE: Record<string, string> = {
  general: 'border-gray-400/30 bg-gray-400/10 text-gray-300',
  idea: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  bug: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  quota_bump: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
};

const STATUS_TONE: Record<string, string> = {
  open: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  responded: 'border-sky-400/40 bg-sky-400/10 text-sky-300',
  resolved: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
};

function formatTs(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function FeedbackPanel() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [draftResponse, setDraftResponse] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const resp = await apiService.getAdminFeedback(
      filter === 'all' ? undefined : (filter as 'open' | 'responded' | 'resolved'),
    );
    setLoading(false);
    if (resp.error) {
      toast.error('Failed to load feedback', { description: resp.error });
      return;
    }
    setItems(resp.data?.feedback || []);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { open: 0, responded: 0, resolved: 0 };
    for (const it of items) {
      if (it.status === 'open') c.open++;
      else if (it.status === 'responded') c.responded++;
      else if (it.status === 'resolved') c.resolved++;
    }
    return c;
  }, [items]);

  const startReply = (id: string, existing: string | null) => {
    setRespondingId(id);
    setDraftResponse(existing || '');
  };

  const cancelReply = () => {
    setRespondingId(null);
    setDraftResponse('');
  };

  const saveReply = async (id: string) => {
    if (!draftResponse.trim()) {
      toast.error('Write a response first.');
      return;
    }
    setSavingId(id);
    const resp = await apiService.updateAdminFeedback(id, {
      admin_response: draftResponse.trim(),
      status: 'responded',
    });
    setSavingId(null);
    if (resp.error || !resp.data) {
      toast.error('Failed to send response', { description: resp.error });
      return;
    }
    setItems((prev) => prev.map((it) => (it.id === id ? resp.data! : it)));
    toast.success('Response saved.');
    cancelReply();
  };

  const setStatus = async (id: string, status: 'open' | 'resolved') => {
    setSavingId(id);
    const resp = await apiService.updateAdminFeedback(id, { status });
    setSavingId(null);
    if (resp.error || !resp.data) {
      toast.error('Failed to update', { description: resp.error });
      return;
    }
    setItems((prev) => prev.map((it) => (it.id === id ? resp.data! : it)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'open', 'responded', 'resolved'] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === f
                ? 'border-purple-400/60 bg-purple-500/15 text-purple-200'
                : 'border-white/[0.08] bg-white/[0.02] text-gray-400 hover:text-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'open' && counts.open ? <span className="ml-1.5 text-amber-300">·{counts.open}</span> : null}
            {f === 'responded' && counts.responded ? (
              <span className="ml-1.5 text-sky-300">·{counts.responded}</span>
            ) : null}
            {f === 'resolved' && counts.resolved ? (
              <span className="ml-1.5 text-emerald-300">·{counts.resolved}</span>
            ) : null}
          </button>
        ))}
      </div>

      {loading && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-sm text-gray-500">
          Loading feedback…
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-sm text-gray-500">
          No feedback in this view.
        </div>
      )}

      <div className="space-y-3">
        {items.map((it) => {
          const isReplying = respondingId === it.id;
          return (
            <div key={it.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${TYPE_TONE[it.type] || TYPE_TONE.general}`}>
                    {TYPE_LABELS[it.type] || it.type}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[it.status] || STATUS_TONE.open}`}>
                    {it.status}
                  </span>
                  <span className="font-mono text-xs text-gray-400">{it.email}</span>
                </div>
                <span className="text-[11px] text-gray-500">{formatTs(it.created_at)}</span>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-200">{it.message}</p>

              {it.admin_response && !isReplying && (
                <div className="mt-3 rounded-lg border border-indigo-400/20 bg-indigo-500/[0.06] p-3">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-indigo-300/80">Your response · {formatTs(it.responded_at)}</div>
                  <p className="whitespace-pre-wrap text-sm text-gray-200">{it.admin_response}</p>
                </div>
              )}

              {isReplying ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={draftResponse}
                    onChange={(e) => setDraftResponse(e.target.value)}
                    rows={4}
                    maxLength={4000}
                    placeholder="Write a response — the user can read this in their feedback history."
                    className="w-full resize-none rounded-md border border-white/[0.08] bg-white/[0.03] p-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-purple-400/60 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={cancelReply}
                      className="rounded-md border border-white/10 px-3 py-1 text-xs text-gray-400 hover:text-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveReply(it.id)}
                      disabled={savingId === it.id}
                      className="rounded-md border border-purple-400/50 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-200 hover:bg-purple-500/20 disabled:opacity-50"
                    >
                      {savingId === it.id ? 'Saving…' : 'Send response'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  <button
                    onClick={() => startReply(it.id, it.admin_response)}
                    className="rounded-md border border-white/[0.08] px-3 py-1 text-xs text-gray-300 hover:bg-white/[0.04]"
                  >
                    {it.admin_response ? 'Edit response' : 'Reply'}
                  </button>
                  {it.status !== 'resolved' && (
                    <button
                      onClick={() => setStatus(it.id, 'resolved')}
                      disabled={savingId === it.id}
                      className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-50"
                    >
                      Mark resolved
                    </button>
                  )}
                  {it.status === 'resolved' && (
                    <button
                      onClick={() => setStatus(it.id, 'open')}
                      disabled={savingId === it.id}
                      className="rounded-md border border-white/[0.08] px-3 py-1 text-xs text-gray-400 hover:bg-white/[0.04] disabled:opacity-50"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

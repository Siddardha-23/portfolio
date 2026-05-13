/**
 * Ephemeral Preview Environments — admin dashboard tab.
 *
 * Lists active per-PR preview envs, exposes Open + Teardown.
 * Source data: /api/admin/environments (DynamoDB-backed; ?fresh=true reconciles
 * with AWS resource tags).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '../../lib/api';

type EnvRow = {
  branch_slug: string;
  pr_number?: number | string;
  head_ref?: string;
  actor?: string;
  status?: string;
  frontend_url?: string;
  api_url?: string;
  mongo_db?: string;
  created_at?: string;
  last_seen_at?: string;
  gh_run_id?: string;
  resource_arns?: string[];
};

const STATUS_STYLES: Record<string, string> = {
  ready:           'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  provisioning:    'bg-amber-500/15 text-amber-300 border-amber-500/30',
  destroying:      'bg-orange-500/15 text-orange-300 border-orange-500/30',
  destroyed:       'bg-gray-500/10 text-gray-400 border-gray-500/30',
  failed:          'bg-red-500/15 text-red-300 border-red-500/30',
  'orphaned-aws':  'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
  'orphaned-ddb':  'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

function ageOf(iso?: string): string {
  if (!iso) return '—';
  // Backend writes naive UTC for older rows — JS would otherwise read those
  // as local time. Treat undated ISO strings as UTC so age math is honest.
  let s = iso;
  if (/T\d/.test(s) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s = s + 'Z';
  const t = Date.parse(s);
  if (Number.isNaN(t)) return '—';
  const secs = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function absoluteOf(iso?: string): string | undefined {
  if (!iso) return undefined;
  let s = iso;
  if (/T\d/.test(s) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s = s + 'Z';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  const date = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  return `${date} · ${time}`;
}

function StatusBadge({ status }: { status?: string }) {
  const cls = STATUS_STYLES[status || ''] || 'bg-white/[0.04] text-gray-400 border-white/10';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status || 'unknown'}
    </span>
  );
}

function ConfirmModal({
  slug, onCancel, onConfirm, busy,
}: { slug: string; onCancel: () => void; onConfirm: () => void; busy: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        className="max-w-md w-full rounded-2xl bg-[#11111a] border border-white/[0.08] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-white">Tear down preview env?</h3>
        <p className="mt-2 text-sm text-gray-400">
          This destroys the AWS resources tagged with{' '}
          <code className="text-indigo-300">EphemeralBranch={slug}</code> and drops the
          associated Mongo DB. The PR (if open) will need a new push to re-create the env.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/[0.04] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-sm font-bold text-white bg-gradient-to-br from-rose-500 to-red-600 hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Triggering…' : 'Tear down'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function EnvironmentsPanel() {
  const [rows, setRows] = useState<EnvRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchEnvs = useCallback(async (fresh = false) => {
    setLoading(true);
    setError('');
    const res = await apiService.listAdminEnvironments({ fresh });
    if (res.data?.environments) setRows(res.data.environments);
    else if (res.error) setError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEnvs(false);
  }, [fetchEnvs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => fetchEnvs(false), 15_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchEnvs]);

  const onTeardown = useCallback(async (slug: string) => {
    setBusySlug(slug);
    const res = await apiService.teardownAdminEnvironment(slug);
    setBusySlug(null);
    setConfirmFor(null);
    if (res.error) {
      setError(res.error);
    } else {
      // Optimistic local status flip; backend already wrote 'destroying'.
      setRows((prev) => prev.map(r => r.branch_slug === slug ? { ...r, status: 'destroying' } : r));
    }
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.status || 'unknown'] = (c[r.status || 'unknown'] || 0) + 1;
    return c;
  }, [rows]);

  return (
    <div className="space-y-5">
      {/* Header — matches the toolbar pattern other tabs use so admins
          don't lose their visual bearing when switching between sections. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-2">
          {Object.entries(counts).map(([s, n]) => (
            <span key={s} className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.04] text-gray-300 border border-white/10 inline-flex items-center gap-1.5">
              <StatusBadge status={s} /> <span className="tabular-nums font-bold text-white">{n}</span>
            </span>
          ))}
          {Object.keys(counts).length === 0 && (
            <span className="text-[11px] text-gray-500">No environments running.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-gray-400 select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-indigo-500"
            />
            auto-refresh
          </label>
          <button
            onClick={() => fetchEnvs(true)}
            disabled={loading}
            className="h-9 px-3 rounded-xl text-xs font-medium text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 disabled:opacity-40"
            title="Reconcile against AWS resource tags"
          >
            Reconcile
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">{error}</div>
      )}

      {/* Card grid */}
      {rows.length === 0 && !loading ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <p className="text-sm text-gray-400">No preview environments active.</p>
          <p className="text-xs text-gray-600 mt-1">Open a PR to spin one up automatically.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((r) => (
            <div
              key={r.branch_slug}
              className="group rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.02] to-transparent p-4 hover:border-indigo-400/30 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{r.head_ref || r.branch_slug}</p>
                  <p className="text-[11px] text-gray-500 truncate font-mono">{r.branch_slug}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px]">
                <dt className="text-gray-600">PR</dt>
                <dd className="text-gray-300 tabular-nums">#{r.pr_number ?? '—'}</dd>
                <dt className="text-gray-600">Owner</dt>
                <dd className="text-gray-300 truncate">{r.actor || '—'}</dd>
                <dt className="text-gray-600">Age</dt>
                <dd className="text-gray-300 tabular-nums" title={absoluteOf(r.created_at)}>{ageOf(r.created_at)}</dd>
                <dt className="text-gray-600">Idle</dt>
                <dd className="text-gray-300 tabular-nums" title={absoluteOf(r.last_seen_at)}>{ageOf(r.last_seen_at)}</dd>
                <dt className="text-gray-600">DB</dt>
                <dd className="text-indigo-300 truncate font-mono">{r.mongo_db || '—'}</dd>
              </dl>

              <div className="mt-4 flex items-center gap-2">
                {r.frontend_url ? (
                  <a
                    href={r.frontend_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 text-center px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 transition"
                  >
                    Open
                  </a>
                ) : (
                  <span className="flex-1 text-center px-3 py-1.5 rounded-lg text-xs text-gray-600 border border-white/[0.06]">
                    No URL
                  </span>
                )}
                <button
                  onClick={() => setConfirmFor(r.branch_slug)}
                  disabled={busySlug === r.branch_slug || r.status === 'destroying'}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition disabled:opacity-40"
                >
                  Teardown
                </button>
              </div>

              {r.pr_number && (
                <p className="mt-2 text-[10px] text-gray-600">
                  Run: <code>{r.gh_run_id || '—'}</code>
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {confirmFor && (
          <ConfirmModal
            slug={confirmFor}
            busy={busySlug === confirmFor}
            onCancel={() => setConfirmFor(null)}
            onConfirm={() => onTeardown(confirmFor)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default EnvironmentsPanel;

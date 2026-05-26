import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '@/lib/api';
import { toast } from 'sonner';

interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  daily_tailor_limit_custom: number | null;
  daily_tailor_limit_effective: number;
  tailored_today: number;
  tailoring_sessions: number;
  last_login: string | null;
}

export function QuotasPanel() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [defaultLimit, setDefaultLimit] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [savingEmail, setSavingEmail] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const resp = await apiService.getAdminUsers();
    setLoading(false);
    if (resp.error) {
      toast.error('Failed to load users', { description: resp.error });
      return;
    }
    if (!resp.data) return;
    setDefaultLimit(resp.data.default_daily_limit ?? 5);
    setRows(
      (resp.data.users || []).map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        daily_tailor_limit_custom: u.daily_tailor_limit_custom,
        daily_tailor_limit_effective: u.daily_tailor_limit_effective,
        tailored_today: u.tailored_today ?? 0,
        tailoring_sessions: u.tailoring_sessions ?? 0,
        last_login: u.last_login,
      })),
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => r.email.toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q));
  }, [rows, query]);

  const setLimit = async (email: string, newLimit: number | null) => {
    setSavingEmail(email);
    const resp = await apiService.updateAdminUserQuota(email, newLimit);
    setSavingEmail(null);
    if (resp.error) {
      toast.error('Could not update quota', { description: resp.error });
      return;
    }
    if (!resp.data) return;
    setRows((prev) =>
      prev.map((r) =>
        r.email === email
          ? {
              ...r,
              daily_tailor_limit_custom: resp.data!.daily_tailor_limit_custom,
              daily_tailor_limit_effective: resp.data!.daily_tailor_limit_effective,
            }
          : r,
      ),
    );
    toast.success(
      newLimit === null
        ? `Reset ${email} to the default limit (${defaultLimit})`
        : `${email} can now tailor ${newLimit} resumes per day`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-200">Daily tailor quotas</p>
            <p className="mt-1 text-xs text-gray-500">
              Default limit is{' '}
              <span className="font-medium text-gray-300">{defaultLimit}</span> tailors per UTC day.
              Override per user as needed. Set to <span className="font-mono">0</span> to disable.
            </p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search email or name…"
            className="rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-gray-200 placeholder:text-gray-600 focus:border-purple-400/60 focus:outline-none"
          />
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Today</th>
              <th className="px-4 py-2">Limit</th>
              <th className="px-4 py-2">Override</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-500">
                  Loading users…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-500">
                  No users match.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <QuotaRow
                key={r.id}
                row={r}
                defaultLimit={defaultLimit}
                saving={savingEmail === r.email}
                onSave={(val) => setLimit(r.email, val)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuotaRow({
  row,
  defaultLimit,
  saving,
  onSave,
}: {
  row: AdminUserRow;
  defaultLimit: number;
  saving: boolean;
  onSave: (val: number | null) => void;
}) {
  const [draft, setDraft] = useState<string>(
    row.daily_tailor_limit_custom === null ? '' : String(row.daily_tailor_limit_custom),
  );

  useEffect(() => {
    setDraft(row.daily_tailor_limit_custom === null ? '' : String(row.daily_tailor_limit_custom));
  }, [row.daily_tailor_limit_custom]);

  const ratio = `${row.tailored_today} / ${row.daily_tailor_limit_effective}`;
  const overflowing = row.tailored_today >= row.daily_tailor_limit_effective;

  const apply = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      onSave(null);
      return;
    }
    const n = parseInt(trimmed, 10);
    if (Number.isNaN(n) || n < 0 || n > 1000) {
      toast.error('Limit must be 0–1000');
      return;
    }
    onSave(n);
  };

  return (
    <tr className="hover:bg-white/[0.02]">
      <td className="px-4 py-3 align-middle">
        <div className="text-gray-200">{row.name || row.email.split('@')[0]}</div>
        <div className="font-mono text-xs text-gray-500">{row.email}</div>
      </td>
      <td className="px-4 py-3 align-middle">
        <span className={`text-sm font-medium ${overflowing ? 'text-rose-300' : 'text-gray-200'}`}>{ratio}</span>
      </td>
      <td className="px-4 py-3 align-middle text-sm">
        {row.daily_tailor_limit_custom !== null ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/40 bg-indigo-400/10 px-2 py-0.5 text-xs text-indigo-300">
            Custom · {row.daily_tailor_limit_effective}
          </span>
        ) : (
          <span className="text-xs text-gray-500">Default ({defaultLimit})</span>
        )}
      </td>
      <td className="px-4 py-3 align-middle">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
          inputMode="numeric"
          placeholder={`default (${defaultLimit})`}
          className="w-32 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-sm text-gray-200 placeholder:text-gray-600 focus:border-purple-400/60 focus:outline-none"
        />
      </td>
      <td className="px-4 py-3 align-middle text-right">
        <button
          type="button"
          onClick={apply}
          disabled={saving}
          className="rounded-md border border-purple-400/50 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-200 hover:bg-purple-500/20 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {row.daily_tailor_limit_custom !== null && (
          <button
            type="button"
            onClick={() => onSave(null)}
            disabled={saving}
            className="ml-2 rounded-md border border-white/10 px-3 py-1 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-50"
          >
            Reset
          </button>
        )}
      </td>
    </tr>
  );
}

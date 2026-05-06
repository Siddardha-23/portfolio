import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiService } from "@/lib/api";

type Suggestion = {
  suggestion_id: string;
  record_id: string;
  company?: string;
  title?: string;
  from_name?: string;
  from_address?: string;
  subject?: string;
  snippet?: string;
  current_status: string;
  suggested_status: string;
  confidence: number;
  reason?: string;
  applied: boolean;
  dismissed: boolean;
  auto_applied?: boolean;
  created_at?: string;
};

type GmailStatus = {
  configured: boolean;
  connected: boolean;
  gmail_address?: string | null;
  last_synced_at?: string | null;
  pending_suggestions: number;
};

const STATUS_CHIP: Record<string, string> = {
  draft: "bg-gray-500/15 text-gray-600 dark:text-gray-300",
  applied: "bg-purple-500/15 text-purple-600 dark:text-purple-300",
  interviewing: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  offer: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  rejected: "bg-red-500/15 text-red-600 dark:text-red-300",
  ghosted: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  withdrawn: "bg-gray-400/15 text-gray-500 dark:text-gray-400",
};

function formatRelative(iso?: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "never";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function GmailIntegration({ onSyncComplete }: { onSyncComplete?: () => void }) {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const resp = await apiService.getGmailStatus();
    if (resp.data) setStatus(resp.data);
    setLoading(false);
  }, []);

  const loadSuggestions = useCallback(async () => {
    const resp = await apiService.listGmailSuggestions(false);
    if (resp.data) setSuggestions(resp.data.suggestions || []);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (status?.connected) loadSuggestions();
  }, [status?.connected, loadSuggestions]);

  // If we land here via the OAuth callback, refresh once the user arrives.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("gmail") === "linked") {
      toast.success("Gmail linked. Click Sync to scan recent emails.");
      url.searchParams.delete("gmail");
      window.history.replaceState({}, "", url.toString());
      loadStatus();
    }
  }, [loadStatus]);

  const handleConnect = useCallback(async () => {
    setLinking(true);
    const resp = await apiService.getGmailAuthUrl();
    setLinking(false);
    if (resp.error || !resp.data?.auth_url) {
      toast.error(resp.error || "Failed to start Gmail link");
      return;
    }
    window.location.href = resp.data.auth_url;
  }, []);

  // Track the in-flight sync so we can keep polling across remounts (e.g.
  // user switches tabs) and clean up on unmount without leaking timers.
  const syncPollRef = useRef<{ jobId: string; cancelled: boolean } | null>(null);

  // Progressive backoff: short waits up front (most syncs finish in <30s),
  // longer waits as it drags on (avoids hammering the API for slow inboxes).
  // Total horizon at index 60 ≈ 7 minutes, which covers the worst-case first
  // sync after a 60-day backfill with per-record LLM calls.
  const pollDelayMs = (attempt: number): number => {
    if (attempt < 3) return 2000;        // 0–6s
    if (attempt < 8) return 3000;        // 6–21s
    if (attempt < 16) return 5000;       // 21–61s
    if (attempt < 30) return 8000;       // 61–173s
    return 12000;                        // 173s+
  };

  const handleSync = useCallback(async () => {
    setSyncing(true);
    const resp = await apiService.syncGmail();
    if (resp.error || !resp.data?.job_id) {
      setSyncing(false);
      toast.error(resp.error || "Failed to start sync");
      return;
    }

    const jobId = resp.data.job_id;
    syncPollRef.current = { jobId, cancelled: false };
    const toastId = toast.loading("Scanning your inbox… this can take ~30–90s");

    // Poll loop: progressive backoff, no fixed deadline. We keep going until
    // the job either completes or fails — a slow first-time scan can take
    // several minutes, and asking the user to refresh felt broken. To avoid
    // lying to ourselves, we cap at attempt=80 (~12 minutes wall clock at the
    // settled cadence) which is well past any legitimate sync time.
    let final: { messages_scanned: number; auto_applied: number; suggested: number; ignored: number } | null = null;
    let lastError: string | null = null;
    let stalledToastShown = false;

    for (let attempt = 0; attempt < 80; attempt++) {
      // Bail early if a newer sync started or the component unmounted —
      // syncPollRef.current is reset to null on unmount.
      if (!syncPollRef.current || syncPollRef.current.cancelled || syncPollRef.current.jobId !== jobId) {
        return;
      }
      await new Promise(r => setTimeout(r, pollDelayMs(attempt)));
      if (!syncPollRef.current || syncPollRef.current.cancelled || syncPollRef.current.jobId !== jobId) {
        return;
      }
      const poll = await apiService.pollGmailSyncJob(jobId);
      if (poll.error) {
        // Transient errors (network blip, brief 5xx) are common during long
        // jobs — don't break the loop, just remember the latest and continue.
        lastError = poll.error;
        continue;
      }
      lastError = null;
      const status = poll.data?.status;
      if (status === "completed") {
        final = poll.data!.result || null;
        break;
      }
      if (status === "failed") {
        lastError = poll.data?.error || "Sync failed";
        break;
      }
      // Update the toast text once we cross the "this is taking a while"
      // threshold so the user sees we're still on it instead of stuck.
      if (!stalledToastShown && attempt >= 16) {
        toast.loading("Still scanning — large inboxes can take a couple of minutes…", { id: toastId });
        stalledToastShown = true;
      }
    }

    syncPollRef.current = null;
    setSyncing(false);

    if (final) {
      toast.success(
        `Scanned ${final.messages_scanned} email${final.messages_scanned === 1 ? "" : "s"} · ${final.auto_applied} auto-applied · ${final.suggested} to review`,
        { id: toastId },
      );
      await Promise.all([loadStatus(), loadSuggestions()]);
      onSyncComplete?.();
      return;
    }

    if (lastError) {
      toast.error(lastError, { id: toastId });
      return;
    }

    // We ran out of attempts without a terminal status. Refresh the data
    // anyway — the job is almost certainly done; we just stopped polling.
    toast.success("Sync is taking longer than usual. Showing what's ready so far.", { id: toastId });
    await Promise.all([loadStatus(), loadSuggestions()]);
    onSyncComplete?.();
  }, [loadStatus, loadSuggestions, onSyncComplete]);

  // Cancel any in-flight poll loop on unmount so we don't keep hitting the
  // API after the user has navigated away.
  useEffect(() => () => {
    if (syncPollRef.current) syncPollRef.current.cancelled = true;
    syncPollRef.current = null;
  }, []);

  const handleApply = useCallback(async (id: string) => {
    setBusyId(id);
    const resp = await apiService.applyGmailSuggestion(id);
    setBusyId(null);
    if (resp.error) { toast.error(resp.error); return; }
    setSuggestions(prev => prev.filter(s => s.suggestion_id !== id));
    onSyncComplete?.();
  }, [onSyncComplete]);

  const handleDismiss = useCallback(async (id: string) => {
    setBusyId(id);
    const resp = await apiService.dismissGmailSuggestion(id);
    setBusyId(null);
    if (resp.error) { toast.error(resp.error); return; }
    setSuggestions(prev => prev.filter(s => s.suggestion_id !== id));
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (!window.confirm("Disconnect Gmail? Pending suggestions will be discarded.")) return;
    const resp = await apiService.disconnectGmail();
    if (resp.error) { toast.error(resp.error); return; }
    setSuggestions([]);
    await loadStatus();
    toast.success("Gmail disconnected.");
  }, [loadStatus]);

  const pendingCount = useMemo(() => suggestions.length, [suggestions]);

  if (loading || !status) return null;
  if (!status.configured) return null; // server has no Google creds — hide silently

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm p-3.5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 via-amber-500 to-emerald-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
            ✉
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-gray-900 dark:text-gray-100">
              {status.connected ? "Gmail linked" : "Auto-update from Gmail"}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              {status.connected
                ? <>{status.gmail_address || "—"} · last sync {formatRelative(status.last_synced_at)}</>
                : "Link your inbox so confirmations, interviews, and rejections move cards automatically."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!status.connected ? (
              <button
                onClick={handleConnect}
                disabled={linking}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-sm disabled:opacity-60"
              >
                {linking ? "Opening Google…" : "Connect Gmail"}
              </button>
            ) : (
              <>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-60"
                >
                  {syncing ? "Syncing…" : "Sync now"}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60"
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {status.connected && pendingCount > 0 && (
        <div className="rounded-2xl border border-purple-500/25 bg-purple-500/[0.05] p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
              Suggested updates · {pendingCount}
            </p>
            <button
              onClick={() => setShowSuggestions(s => !s)}
              className="text-[10px] text-purple-600 dark:text-purple-300 hover:underline"
            >
              {showSuggestions ? "Hide" : "Show"}
            </button>
          </div>
          {showSuggestions && (
            <div className="space-y-2">
              {suggestions.map(s => {
                const fromChip = STATUS_CHIP[s.current_status] || STATUS_CHIP.draft;
                const toChip = STATUS_CHIP[s.suggested_status] || STATUS_CHIP.draft;
                const conf = Math.round((s.confidence || 0) * 100);
                return (
                  <div key={s.suggestion_id} className="rounded-lg border border-purple-500/15 bg-white/80 dark:bg-gray-900/50 p-2.5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[12px] font-semibold text-gray-900 dark:text-white truncate">
                            {s.title || "Untitled role"}
                            {s.company ? <span className="text-gray-500 dark:text-gray-400 font-normal"> · {s.company}</span> : null}
                          </p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${fromChip}`}>{s.current_status}</span>
                          <span className="text-[10px] text-gray-400">→</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${toChip}`}>{s.suggested_status}</span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">{conf}% confident</span>
                        </div>
                        {s.subject && (
                          <p className="mt-1 text-[11px] text-gray-700 dark:text-gray-300 truncate">
                            <span className="text-gray-500 dark:text-gray-500">Subject:</span> {s.subject}
                          </p>
                        )}
                        {s.from_address && (
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                            From: {s.from_name ? `${s.from_name} ` : ""}&lt;{s.from_address}&gt;
                          </p>
                        )}
                        {s.reason && (
                          <p className="mt-1 text-[11px] italic text-gray-600 dark:text-gray-400">"{s.reason}"</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleApply(s.suggestion_id)}
                          disabled={busyId === s.suggestion_id}
                          className="text-[10px] font-semibold px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => handleDismiss(s.suggestion_id)}
                          disabled={busyId === s.suggestion_id}
                          className="text-[10px] font-medium px-2.5 py-1 rounded border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60 disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

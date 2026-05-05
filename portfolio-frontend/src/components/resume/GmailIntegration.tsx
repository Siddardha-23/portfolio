import { useCallback, useEffect, useMemo, useState } from "react";
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

  const handleSync = useCallback(async () => {
    setSyncing(true);
    const resp = await apiService.syncGmail();
    if (resp.error || !resp.data?.job_id) {
      setSyncing(false);
      toast.error(resp.error || "Failed to start sync");
      return;
    }

    const jobId = resp.data.job_id;
    const toastId = toast.loading("Scanning your inbox… this can take ~30–90s");

    // Poll up to ~3 minutes; first sync after a 60-day initial lookback
    // can run long because of per-match classifier calls.
    const deadline = Date.now() + 180_000;
    let final: { messages_scanned: number; auto_applied: number; suggested: number; ignored: number } | null = null;
    let lastError: string | null = null;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 4000));
      const poll = await apiService.pollGmailSyncJob(jobId);
      if (poll.error) { lastError = poll.error; continue; }
      const status = poll.data?.status;
      if (status === "completed") {
        final = poll.data!.result || null;
        break;
      }
      if (status === "failed") {
        lastError = poll.data?.error || "Sync failed";
        break;
      }
    }

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
    } else {
      toast.message("Still working in the background — refresh in a minute to see updates.", { id: toastId });
    }
  }, [loadStatus, loadSuggestions, onSyncComplete]);

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

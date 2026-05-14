import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiService } from "@/lib/api";
import type { ApplicationStatus, TailoringRecord } from "@/types/resume";
import { formatDate } from "@/components/resume/ResumeDashboard";
import GmailIntegration from "@/components/resume/GmailIntegration";

// ─── Column config ────────────────────────────────────────────────────────
const COLUMNS: {
  key: ApplicationStatus;
  label: string;
  dot: string;      // accent color class for the vertical rail
  chip: string;     // pill colour used on cards
  icon: string;
}[] = [
  { key: "draft",         label: "Draft",        dot: "bg-gray-400",     chip: "bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-500/25",             icon: "✎" },
  { key: "applied",       label: "Applied",      dot: "bg-purple-400",   chip: "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/25",     icon: "✉" },
  { key: "interviewing",  label: "Interviewing", dot: "bg-blue-400",     chip: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/25",             icon: "💬" },
  { key: "offer",         label: "Offer",        dot: "bg-emerald-400",  chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/25", icon: "🎉" },
  { key: "rejected",      label: "Rejected",     dot: "bg-red-400",      chip: "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/25",                 icon: "✕" },
  { key: "ghosted",       label: "Ghosted",      dot: "bg-amber-400",    chip: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/25",         icon: "👻" },
  { key: "withdrawn",     label: "Withdrawn",    dot: "bg-gray-300",     chip: "bg-gray-400/15 text-gray-500 dark:text-gray-400 border-gray-400/25",             icon: "⏻" },
];

const STATUS_LOOKUP: Record<string, typeof COLUMNS[number]> = COLUMNS.reduce(
  (acc, c) => ({ ...acc, [c.key]: c }),
  {} as Record<string, typeof COLUMNS[number]>,
);

// ─── Helpers ──────────────────────────────────────────────────────────────
function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.round(ms / 86400000);
}
function relDate(iso?: string | null): string {
  const d = daysUntil(iso);
  if (d === null) return "—";
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d <= 7) return `In ${d}d`;
  if (d <= 30) return `In ~${Math.round(d / 7)}w`;
  return `In ${Math.round(d / 30)}mo`;
}
function initials(name?: string): string {
  if (!name || name === "Not specified") return "·";
  return name.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}
function companyTint(name?: string): string {
  // Deterministic subtle gradient based on company name so every logo is unique
  const palettes = [
    "from-purple-500/80 to-indigo-500/80",
    "from-blue-500/80 to-cyan-500/80",
    "from-emerald-500/80 to-teal-500/80",
    "from-amber-500/80 to-orange-500/80",
    "from-rose-500/80 to-pink-500/80",
    "from-fuchsia-500/80 to-purple-500/80",
    "from-sky-500/80 to-blue-500/80",
    "from-lime-500/80 to-emerald-500/80",
  ];
  if (!name) return palettes[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return palettes[Math.abs(h) % palettes.length];
}

// ─── Metric card ──────────────────────────────────────────────────────────
function Metric({ label, value, accent, icon }: { label: string; value: number | string; accent: string; icon?: React.ReactNode }) {
  return (
    <div className="relative rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm px-4 py-3 overflow-hidden">
      <div className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
        {icon && <span className="text-sm opacity-60">{icon}</span>}
      </div>
      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-1 tabular-nums">{value}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────
export default function ApplicationsTab() {
  const [records, setRecords] = useState<TailoringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [editing, setEditing] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [funnel, setFunnel] = useState<{ counts: Record<string, number>; conversions: Record<string, number>; insight?: { headline: string; insight: string; action_items: string[] } } | null>(null);
  const [staleApps, setStaleApps] = useState<Array<{ record_id: string; job_title: string; company: string; days_stale: number }>>([]);
  const [followups, setFollowups] = useState<Record<string, { subject: string; message: string }>>({});
  const [reframe, setReframe] = useState<{ acknowledgement: string; what_went_right: string; next_actions: string[]; silver_lining: string } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ApplicationStatus | null>(null);
  // Show-all toggle for stale-apps list (defaults to top 4).
  const [staleShowAll, setStaleShowAll] = useState(false);

  // Track auxiliary loads separately from the primary records load so we can
  // paint the kanban as soon as `listTailoringRecords` resolves and let the
  // funnel/stale panels stream in once they're ready. Previously the whole
  // tab waited on the slowest of three serial-blocking endpoints.
  const [funnelLoading, setFunnelLoading] = useState(true);

  // Silent mode: post-action refreshes (e.g. applying a Gmail suggestion)
  // re-fetch in place without toggling the page-wide skeleton, so the user
  // doesn't see a 1–2s blank flash. Only the very first load shows the
  // skeleton.
  const fetch = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    if (!silent) setFunnelLoading(true);

    // Records are the only thing the kanban needs to render — fire it first
    // and clear the page-level loading flag the moment it resolves.
    const recordsPromise = apiService.listTailoringRecords().then((resp) => {
      if (resp.data) setRecords((resp.data.records || []) as TailoringRecord[]);
      if (!silent) setLoading(false);
    });

    // Funnel + stale-apps are auxiliary panels — let them resolve in the
    // background; kanban is already visible.
    const auxPromise = Promise.all([
      apiService.getFunnelAnalytics(),
      apiService.getStaleApplications(5),
    ]).then(([funnelResp, staleResp]) => {
      if (funnelResp.data?.ok) {
        setFunnel({
          counts: funnelResp.data.counts || {},
          conversions: funnelResp.data.conversions || {},
          insight: funnelResp.data.insight,
        });
      }
      if (staleResp.data?.stale_applications) {
        setStaleApps(staleResp.data.stale_applications as Array<{ record_id: string; job_title: string; company: string; days_stale: number }>);
      }
      if (!silent) setFunnelLoading(false);
    });

    await Promise.all([recordsPromise, auxPromise]);
  }, []);
  const fetchSilent = useCallback(() => fetch({ silent: true }), [fetch]);
  useEffect(() => { fetch(); }, [fetch]);

  const updateRecord = useCallback((id: string, patcher: (r: TailoringRecord) => TailoringRecord) => {
    setRecords(prev => prev.map(r => r.record_id === id ? patcher(r) : r));
  }, []);

  // Refresh the funnel counts after a status change so the column counts
  // (from local `grouped`) and the summary chips (from server `funnel`)
  // stay in lockstep. Cheap fire-and-forget — no toast on failure.
  const refreshFunnel = useCallback(async () => {
    try {
      const r = await apiService.getFunnelAnalytics();
      if (r.data) {
        setFunnel({
          counts: r.data.counts || {},
          conversions: r.data.conversions || {},
          insight: r.data.insight,
        });
      }
    } catch { /* best effort */ }
  }, []);

  const handleStatusChange = useCallback(async (id: string, status: ApplicationStatus) => {
    setSavingId(id);
    const resp = await apiService.updateApplication(id, { status });
    setSavingId(null);
    if (resp.error) { toast.error("Failed to update status"); return; }
    updateRecord(id, r => ({ ...r, application: { ...(r.application || {}), ...resp.data!.application } }));
    refreshFunnel();
    if (status === "rejected") {
      const refr = await apiService.reframeRejection(id);
      if (refr.data?.reframe) setReframe(refr.data.reframe);
    }
  }, [updateRecord, refreshFunnel]);

  // Drag & drop handlers — optimistic update, then persist via the
  // existing updateApplication endpoint. Rollback on failure.
  const handleDrop = useCallback(async (status: ApplicationStatus) => {
    const id = draggingId;
    setDraggingId(null);
    setDragOverCol(null);
    if (!id) return;
    const current = records.find((r) => r.record_id === id);
    if (!current) return;
    const prev = (current.application?.status || 'draft') as ApplicationStatus;
    if (prev === status) return;
    // Optimistic
    updateRecord(id, (r) => ({
      ...r,
      application: { ...(r.application || {}), status },
    }));
    setSavingId(id);
    const resp = await apiService.updateApplication(id, { status });
    setSavingId(null);
    if (resp.error) {
      // Rollback
      updateRecord(id, (r) => ({
        ...r,
        application: { ...(r.application || {}), status: prev },
      }));
      toast.error('Failed to move card — reverted.');
      return;
    }
    updateRecord(id, (r) => ({
      ...r,
      application: { ...(r.application || {}), ...resp.data!.application },
    }));
    refreshFunnel();
    if (status === 'rejected') {
      const refr = await apiService.reframeRejection(id);
      if (refr.data?.reframe) setReframe(refr.data.reframe);
    }
  }, [draggingId, records, updateRecord, refreshFunnel]);

  const handlePatch = useCallback(async (id: string, patch: Parameters<typeof apiService.updateApplication>[1]) => {
    setSavingId(id);
    const resp = await apiService.updateApplication(id, patch);
    setSavingId(null);
    if (resp.error) { toast.error("Failed to save"); return; }
    updateRecord(id, r => ({ ...r, application: { ...(r.application || {}), ...resp.data!.application } }));
    toast.success("Saved");
  }, [updateRecord]);

  // Quick search across role + company + recruiter
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r => {
      const hay = `${r.jd_analysis?.job_title || ""} ${r.jd_analysis?.company || ""} ${r.application?.recruiter_name || ""} ${r.application?.recruiter_company || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [records, search]);

  const grouped = useMemo(() => {
    const g: Record<ApplicationStatus, TailoringRecord[]> = {
      draft: [], applied: [], interviewing: [], offer: [], rejected: [], withdrawn: [], ghosted: [],
    };
    for (const r of searched) {
      const s = (r.application?.status || "draft") as ApplicationStatus;
      (g[s] || g.draft).push(r);
    }
    for (const k of Object.keys(g) as ApplicationStatus[]) {
      g[k].sort((a, b) => {
        const aDate = a.application?.next_action_date ? new Date(a.application.next_action_date).getTime() : Infinity;
        const bDate = b.application?.next_action_date ? new Date(b.application.next_action_date).getTime() : Infinity;
        if (aDate !== bDate) return aDate - bDate;
        const ac = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bc = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bc - ac;
      });
    }
    return g;
  }, [searched]);

  // Dashboard metrics (whole set, not filtered)
  const metrics = useMemo(() => {
    const active = records.filter(r => {
      const s = r.application?.status || "draft";
      return s !== "rejected" && s !== "withdrawn" && s !== "ghosted";
    });
    const upcomingList = records
      .filter(r => r.application?.next_action_date)
      .map(r => ({ r, d: daysUntil(r.application?.next_action_date) }))
      .filter(x => x.d !== null && x.d <= 14)
      .sort((a, b) => a.d! - b.d!);
    const offers = records.filter(r => r.application?.status === "offer");
    const interviewing = records.filter(r => r.application?.status === "interviewing");
    const applied = records.filter(r => r.application?.status === "applied").length;
    // Response rate = (interviewing + offer + rejected) / applied+interviewing+offer+rejected
    const resp = records.filter(r => ["interviewing", "offer", "rejected"].includes(r.application?.status || "")).length;
    const total = applied + resp;
    const respRate = total > 0 ? Math.round((resp / total) * 100) : null;
    return {
      total: records.length,
      active: active.length,
      interviewing: interviewing.length,
      offers: offers.length,
      upcoming: upcomingList,
      respRate,
    };
  }, [records]);

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Active loading indicator — spinner + descriptive text so users
            understand the tab is working rather than frozen. */}
        <div className="flex items-center gap-3 rounded-xl border border-purple-500/20 bg-gradient-to-r from-purple-500/[0.06] to-indigo-500/[0.04] px-4 py-3">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent"
            role="status"
            aria-label="Loading"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">Loading your applications…</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Pulling tailored records, funnel analytics, and follow-up nudges.</p>
          </div>
        </div>
        {/* Skeleton placeholders — sized to roughly match the real layout so
            the layout doesn't jump when the data arrives. */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[68px] rounded-xl bg-gray-100/50 dark:bg-gray-800/40 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-56 rounded-xl bg-gray-100/40 dark:bg-gray-800/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gradient-to-b from-purple-500/5 to-transparent p-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 text-white flex items-center justify-center mx-auto mb-3 text-2xl shadow-lg shadow-purple-500/30">
          📋
        </div>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">No applications yet</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
          Tailor a resume and every session lands here as a draft. Track it to offer — no more guessing which company you're in which stage with.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Applications</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Your pipeline — every role from first tailor to offer, tracked in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search role, company, recruiter…"
              className="pl-8 pr-3 py-1.5 w-[260px] rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-300 dark:border-gray-700/60 text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>
          <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800/60 p-0.5 border border-gray-200 dark:border-gray-800">
            {([
              { key: "kanban" as const, label: "Kanban", icon: "▤" },
              { key: "list" as const, label: "List", icon: "☰" },
            ]).map(v => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md flex items-center gap-1 transition-all ${view === v.key ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}
              >
                <span>{v.icon}</span>{v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <GmailIntegration onSyncComplete={fetchSilent} />

      {/* Metric row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <Metric label="Total" value={metrics.total} accent="bg-gradient-to-b from-purple-500 to-indigo-500" icon="📊" />
        <Metric label="Active" value={metrics.active} accent="bg-gradient-to-b from-purple-400 to-purple-600" icon="🔵" />
        <Metric label="Interviewing" value={metrics.interviewing} accent="bg-gradient-to-b from-blue-500 to-cyan-500" icon="💬" />
        <Metric label="Offers" value={metrics.offers} accent="bg-gradient-to-b from-emerald-500 to-teal-500" icon="🎉" />
        <Metric
          label="Response rate"
          value={metrics.respRate !== null ? `${metrics.respRate}%` : "—"}
          accent="bg-gradient-to-b from-amber-500 to-orange-500"
          icon="📈"
        />
      </div>

      {funnelLoading && !funnel && (
        <div className="flex items-center gap-2 rounded-2xl border border-indigo-500/15 bg-indigo-500/[0.03] px-3 py-2 text-[11px] text-indigo-700 dark:text-indigo-300">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" aria-hidden />
          <span>Crunching funnel intelligence and stale-application nudges…</span>
        </div>
      )}

      {funnel && (
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-2">Funnel intelligence</p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6 text-xs">
            {["draft", "applied", "interviewing", "offer", "rejected", "ghosted"].map((k) => (
              <div key={k} className="rounded-lg border border-indigo-500/15 bg-white/70 px-2 py-1.5 dark:bg-gray-900/50">
                <p className="text-gray-500 dark:text-gray-400 capitalize">{k}</p>
                <p className="font-semibold text-gray-900 dark:text-white">{funnel.counts[k] ?? 0}</p>
              </div>
            ))}
          </div>
          {funnel.insight && <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{funnel.insight.insight}</p>}
        </div>
      )}

      {/* Upcoming banner */}
      {metrics.upcoming.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center">⚡</div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
              Next actions · {metrics.upcoming.length}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {metrics.upcoming.map(({ r, d }) => (
              <div key={r.record_id} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/70 dark:bg-gray-900/50 border border-amber-500/25 text-[11px]">
                <span className={`w-1.5 h-1.5 rounded-full ${d! < 0 ? "bg-red-500" : d! <= 2 ? "bg-amber-500" : "bg-gray-400"}`} />
                <span className="font-medium text-gray-800 dark:text-gray-200">{r.jd_analysis?.job_title || "Untitled"}</span>
                {r.jd_analysis?.company && r.jd_analysis.company !== "Not specified" && (
                  <span className="text-gray-500 dark:text-gray-400">· {r.jd_analysis.company}</span>
                )}
                <span className={`font-semibold ${d! < 0 ? "text-red-500" : d! <= 2 ? "text-amber-600 dark:text-amber-400" : "text-gray-500"}`}>
                  {relDate(r.application?.next_action_date)}
                </span>
                {r.application?.next_action_note && <span className="text-gray-500 dark:text-gray-400 italic">· {r.application.next_action_note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {staleApps.length > 0 && (
        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.04] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              Needs follow-up · {staleApps.length}
            </p>
            {staleApps.length > 4 && (
              <button
                type="button"
                onClick={() => setStaleShowAll((v) => !v)}
                className="text-[11px] text-rose-700 dark:text-rose-300 underline-offset-2 hover:underline"
              >
                {staleShowAll ? 'Show fewer' : `Show all ${staleApps.length}`}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {(staleShowAll ? staleApps : staleApps.slice(0, 4)).map((s) => (
              <div key={s.record_id} className="rounded-lg border border-rose-500/15 bg-white/70 p-2 dark:bg-gray-900/50">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">
                    {s.job_title} {s.company ? `· ${s.company}` : ""}
                    <span className="ml-2 inline-flex items-center rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300">
                      {s.days_stale}d silent
                    </span>
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        const r = await apiService.generateIntelligenceFollowup({ record_id: s.record_id, channel: "email" });
                        if (r.data?.followup) {
                          setFollowups((prev) => ({ ...prev, [s.record_id]: { subject: r.data!.followup.subject, message: r.data!.followup.message } }));
                        }
                      }}
                      className="rounded bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300"
                    >
                      Draft follow-up
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const r = await apiService.dismissIntelligenceFollowup(s.record_id);
                        if (r.error) { toast.error(r.error); return; }
                        // Optimistic local removal — server will already not return it next time.
                        setStaleApps(prev => prev.filter(x => x.record_id !== s.record_id));
                        setFollowups(prev => {
                          const next = { ...prev };
                          delete next[s.record_id];
                          return next;
                        });
                      }}
                      className="rounded border border-rose-500/20 px-2 py-1 text-[11px] font-medium text-rose-700/80 dark:text-rose-300/80 hover:bg-rose-500/5"
                      title="Hide this follow-up nudge until the application status changes again"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                {followups[s.record_id] && (
                  <div className="mt-2 space-y-2 rounded border border-gray-200/80 p-2 text-xs dark:border-white/10">
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{followups[s.record_id].subject}</p>
                    <p className="whitespace-pre-wrap text-gray-600 dark:text-gray-300">{followups[s.record_id].message}</p>
                    <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-gray-200/60 dark:border-white/[0.06] pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const f = followups[s.record_id];
                          navigator.clipboard
                            .writeText(`Subject: ${f.subject}\n\n${f.message}`)
                            .then(() => toast.success('Copied — paste into your email'))
                            .catch(() => toast.error('Clipboard blocked'));
                        }}
                        className="rounded border border-gray-300 dark:border-white/15 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] text-gray-700 dark:text-gray-200 hover:border-gray-400 transition-colors"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const f = followups[s.record_id];
                          const params = new URLSearchParams();
                          params.set('view', 'cm');
                          params.set('fs', '1');
                          params.set('su', f.subject);
                          params.set('body', f.message);
                          window.open(`https://mail.google.com/mail/?${params.toString()}`, '_blank', 'noopener,noreferrer');
                        }}
                        className="rounded bg-gradient-to-r from-rose-600 to-pink-600 px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
                      >
                        Open in Gmail ↗
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {reframe && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{reframe.acknowledgement}</p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{reframe.what_went_right}</p>
          <ul className="mt-2 list-disc ml-5 text-xs text-gray-600 dark:text-gray-300">
            {reframe.next_actions?.map((a, idx) => <li key={idx}>{a}</li>)}
          </ul>
          <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">{reframe.silver_lining}</p>
        </div>
      )}

      {/* Pipeline */}
      {view === "kanban" ? (
        <>
          <p className="text-[11px] italic text-gray-500 dark:text-gray-400">
            Tip: drag a card between columns to update its status.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {COLUMNS.map(col => {
            const list = grouped[col.key];
            const isDragOver = dragOverCol === col.key;
            return (
              <div
                key={col.key}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
                onDragLeave={(e) => {
                  if (e.currentTarget === e.target) setDragOverCol((c) => (c === col.key ? null : c));
                }}
                onDrop={(e) => { e.preventDefault(); handleDrop(col.key); }}
                className={`relative rounded-xl border overflow-hidden backdrop-blur-sm transition-all ${
                  isDragOver
                    ? 'border-purple-500/60 bg-purple-500/10 ring-2 ring-purple-500/40 scale-[1.01]'
                    : 'border-gray-200 dark:border-white/[0.07] bg-white/40 dark:bg-gray-900/30'
                }`}
              >
                <div className={`absolute inset-y-0 left-0 w-0.5 ${col.dot}`} />
                <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{col.icon}</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">{col.label}</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 tabular-nums">
                    {list.length}
                  </span>
                </div>
                <div className="p-2 space-y-2 min-h-[80px] max-h-[68vh] overflow-y-auto">
                  {list.map(r => (
                    <div
                      key={r.record_id}
                      draggable
                      onDragStart={(e) => {
                        setDraggingId(r.record_id);
                        e.dataTransfer.effectAllowed = 'move';
                        try { e.dataTransfer.setData('text/plain', r.record_id); } catch { /* */ }
                      }}
                      onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                      className={`cursor-grab active:cursor-grabbing transition-opacity ${
                        draggingId === r.record_id ? 'opacity-40' : ''
                      }`}
                    >
                      <ApplicationCard
                        record={r}
                        saving={savingId === r.record_id}
                        isEditing={editing === r.record_id}
                        onToggleEdit={() => setEditing(editing === r.record_id ? null : r.record_id)}
                        onStatusChange={(s) => handleStatusChange(r.record_id, s)}
                        onPatch={(patch) => handlePatch(r.record_id, patch)}
                      />
                    </div>
                  ))}
                  {list.length === 0 && (
                    <div className="py-6 text-center">
                      <p className="text-[10px] text-gray-400 dark:text-gray-600 italic">
                        {isDragOver ? 'Drop here' : 'Nothing here'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Company / Role</th>
                <th className="text-left px-3 py-3 font-semibold">Status</th>
                <th className="text-left px-3 py-3 font-semibold">Applied</th>
                <th className="text-left px-3 py-3 font-semibold">Next action</th>
                <th className="text-left px-3 py-3 font-semibold">Recruiter</th>
                <th className="text-left px-3 py-3 font-semibold">ATS</th>
              </tr>
            </thead>
            <tbody>
              {searched.map(r => {
                const co = r.jd_analysis?.company && r.jd_analysis.company !== "Not specified" ? r.jd_analysis.company : "";
                const st = r.application?.status || "draft";
                const meta = STATUS_LOOKUP[st];
                const ats = r.ats_scores?.overall;
                const d = daysUntil(r.application?.next_action_date);
                return (
                  <tr key={r.record_id} className="border-t border-gray-200 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br ${companyTint(co)} text-white text-[11px] font-bold flex items-center justify-center shadow-sm`}>
                          {initials(co) || initials(r.jd_analysis?.job_title)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-gray-800 dark:text-gray-200 truncate">{r.jd_analysis?.job_title || "—"}</p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{co || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={st}
                        onChange={e => handleStatusChange(r.record_id, e.target.value as ApplicationStatus)}
                        disabled={savingId === r.record_id}
                        className={`text-[10px] px-2 py-1 rounded-full font-semibold border ${meta.chip}`}
                      >
                        {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400 text-[11px]">{r.application?.applied_at ? formatDate(r.application.applied_at) : "—"}</td>
                    <td className="px-3 py-2.5 text-[11px]">
                      {r.application?.next_action_date ? (
                        <span className={`${d! < 0 ? "text-red-500 font-semibold" : d !== null && d <= 2 ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-gray-600 dark:text-gray-400"}`}>
                          {relDate(r.application.next_action_date)}
                          {r.application.next_action_note && <span className="text-gray-500 dark:text-gray-500"> · {r.application.next_action_note}</span>}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400 text-[11px] truncate max-w-[160px]">
                      {r.application?.recruiter_name || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[11px]">
                      {ats !== undefined ? (
                        <span className={`tabular-nums font-semibold ${ats >= 80 ? "text-emerald-500" : ats >= 60 ? "text-amber-500" : "text-red-500"}`}>
                          {ats}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────
function ApplicationCard({
  record, saving, isEditing, onToggleEdit, onStatusChange, onPatch,
}: {
  record: TailoringRecord;
  saving: boolean;
  isEditing: boolean;
  onToggleEdit: () => void;
  onStatusChange: (s: ApplicationStatus) => void;
  onPatch: (p: Parameters<typeof apiService.updateApplication>[1]) => void;
}) {
  const app = record.application || {};
  const [recruiterName, setRecruiterName] = useState(app.recruiter_name || "");
  const [recruiterEmail, setRecruiterEmail] = useState(app.recruiter_email || "");
  const [nextDate, setNextDate] = useState(app.next_action_date ? app.next_action_date.slice(0, 10) : "");
  const [nextNote, setNextNote] = useState(app.next_action_note || "");
  const [notes, setNotes] = useState(app.notes || "");
  const [jobUrl, setJobUrl] = useState(app.job_url || "");

  const d = daysUntil(app.next_action_date);
  const urgent = d !== null && d <= 2;
  const overdue = d !== null && d < 0;
  const title = record.jd_analysis?.job_title || "Untitled";
  const company = record.jd_analysis?.company && record.jd_analysis.company !== "Not specified" ? record.jd_analysis.company : null;
  const ats = record.ats_scores?.overall;
  const meta = STATUS_LOOKUP[app.status || "draft"];

  const save = () => {
    onPatch({
      recruiter_name: recruiterName,
      recruiter_email: recruiterEmail,
      next_action_date: nextDate ? new Date(nextDate).toISOString() : null,
      next_action_note: nextNote,
      notes,
      job_url: jobUrl,
    });
    onToggleEdit();
  };

  return (
    <div
      className={`group relative rounded-lg border bg-white dark:bg-gray-900/60 transition-all overflow-hidden ${
        overdue
          ? "border-red-500/40 shadow-sm shadow-red-500/10"
          : urgent
          ? "border-amber-500/40 shadow-sm shadow-amber-500/10"
          : "border-gray-200 dark:border-gray-800/60 hover:border-purple-500/30 hover:shadow-sm"
      }`}
    >
      {/* Left accent rail */}
      <div className={`absolute inset-y-0 left-0 w-0.5 ${meta.dot}`} />

      <div className="pl-2.5 pr-2 py-2 space-y-1.5">
        {/* Top row: company avatar + title */}
        <div className="flex items-start gap-2">
          <div className={`w-7 h-7 shrink-0 rounded-md bg-gradient-to-br ${companyTint(company || title)} text-white text-[10px] font-bold flex items-center justify-center shadow-sm`}>
            {initials(company || title)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate leading-snug">{title}</p>
            {company && <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{company}</p>}
          </div>
          <button
            onClick={onToggleEdit}
            className="shrink-0 w-5 h-5 rounded text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-[11px] leading-none"
            title={isEditing ? "Close" : "Edit"}
          >{isEditing ? "×" : "✎"}</button>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          {ats !== undefined && (
            <span className={`text-[10px] font-semibold tabular-nums ${ats >= 80 ? "text-emerald-500" : ats >= 60 ? "text-amber-500" : "text-red-500"}`}>
              ATS {ats}
            </span>
          )}
          {d !== null && (
            <span className={`text-[10px] font-medium ${overdue ? "text-red-500 font-bold" : urgent ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"}`}>
              {overdue && "⚠ "}{relDate(app.next_action_date)}
            </span>
          )}
          {app.next_action_note && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400 italic truncate max-w-[120px]">· {app.next_action_note}</span>
          )}
        </div>

        {/* Status select */}
        <select
          value={app.status || "draft"}
          onChange={e => onStatusChange(e.target.value as ApplicationStatus)}
          disabled={saving}
          className={`w-full text-[10px] px-2 py-1 rounded-md border font-semibold capitalize ${meta.chip}`}
        >
          {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>

        {/* Expanded editor */}
        {isEditing && (
          <div className="pt-2 mt-1 space-y-1.5 border-t border-gray-200 dark:border-gray-800/60">
            <div className="grid grid-cols-1 gap-1.5">
              <input placeholder="Recruiter name" value={recruiterName} onChange={e => setRecruiterName(e.target.value)}
                     className="w-full text-[10px] px-2 py-1.5 rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500/30" />
              <input placeholder="Recruiter email" value={recruiterEmail} onChange={e => setRecruiterEmail(e.target.value)}
                     className="w-full text-[10px] px-2 py-1.5 rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500/30" />
              <input placeholder="Job URL" value={jobUrl} onChange={e => setJobUrl(e.target.value)}
                     className="w-full text-[10px] px-2 py-1.5 rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500/30" />
              <div className="grid grid-cols-2 gap-1.5">
                <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)}
                       className="text-[10px] px-2 py-1.5 rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700" />
                <input placeholder="Action" value={nextNote} onChange={e => setNextNote(e.target.value)}
                       className="text-[10px] px-2 py-1.5 rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700" />
              </div>
              <textarea placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                     className="w-full text-[10px] px-2 py-1.5 rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500/30" />
            </div>
            <div className="flex gap-1.5 justify-end pt-1">
              <button onClick={onToggleEdit}
                      className="text-[10px] px-2 py-0.5 rounded text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">Cancel</button>
              <button onClick={save} disabled={saving}
                      className="text-[10px] px-2.5 py-0.5 rounded bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium disabled:opacity-50 shadow-sm">
                {saving ? "…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

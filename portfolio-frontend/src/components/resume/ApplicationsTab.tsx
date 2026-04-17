import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiService } from "@/lib/api";
import type { ApplicationStatus, TailoringRecord } from "@/types/resume";
import { formatDate } from "@/components/resume/ResumeDashboard";

const COLUMNS: { key: ApplicationStatus; label: string; accent: string }[] = [
  { key: "draft",         label: "Draft",        accent: "from-gray-500/20 to-gray-500/5" },
  { key: "applied",       label: "Applied",      accent: "from-purple-500/20 to-purple-500/5" },
  { key: "interviewing",  label: "Interviewing", accent: "from-blue-500/20 to-blue-500/5" },
  { key: "offer",         label: "Offer",        accent: "from-emerald-500/20 to-emerald-500/5" },
  { key: "rejected",      label: "Rejected",     accent: "from-red-500/20 to-red-500/5" },
  { key: "ghosted",       label: "Ghosted",      accent: "from-amber-500/20 to-amber-500/5" },
  { key: "withdrawn",     label: "Withdrawn",    accent: "from-gray-400/20 to-gray-400/5" },
];

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.round(ms / 86400000);
}

export default function ApplicationsTab() {
  const [records, setRecords] = useState<TailoringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [editing, setEditing] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const resp = await apiService.listTailoringRecords();
    if (resp.data) setRecords((resp.data.records || []) as TailoringRecord[]);
    setLoading(false);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const updateRecord = useCallback((id: string, patcher: (r: TailoringRecord) => TailoringRecord) => {
    setRecords(prev => prev.map(r => r.record_id === id ? patcher(r) : r));
  }, []);

  const handleStatusChange = useCallback(async (id: string, status: ApplicationStatus) => {
    setSavingId(id);
    const resp = await apiService.updateApplication(id, { status });
    setSavingId(null);
    if (resp.error) { toast.error("Failed to update status"); return; }
    updateRecord(id, r => ({ ...r, application: { ...(r.application || {}), ...resp.data!.application } }));
  }, [updateRecord]);

  const handlePatch = useCallback(async (id: string, patch: Parameters<typeof apiService.updateApplication>[1]) => {
    setSavingId(id);
    const resp = await apiService.updateApplication(id, patch);
    setSavingId(null);
    if (resp.error) { toast.error("Failed to save"); return; }
    updateRecord(id, r => ({ ...r, application: { ...(r.application || {}), ...resp.data!.application } }));
    toast.success("Saved");
  }, [updateRecord]);

  const grouped = useMemo(() => {
    const g: Record<ApplicationStatus, TailoringRecord[]> = {
      draft: [], applied: [], interviewing: [], offer: [], rejected: [], withdrawn: [], ghosted: [],
    };
    for (const r of records) {
      const s = (r.application?.status || "draft") as ApplicationStatus;
      (g[s] || g.draft).push(r);
    }
    // Sort each column by next_action_date ascending (urgent first), fallback to created_at desc
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
  }, [records]);

  // Upcoming next actions (across all records), sorted
  const upcoming = useMemo(() => {
    return records
      .filter(r => r.application?.next_action_date)
      .map(r => ({ r, days: daysUntil(r.application?.next_action_date) }))
      .filter(x => x.days !== null && x.days <= 14)
      .sort((a, b) => (a.days! - b.days!));
  }, [records]);

  if (loading) {
    return <div className="animate-pulse h-24 rounded-xl bg-gray-100/40 dark:bg-gray-800/40" />;
  }
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-900/40 p-10 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">No applications yet</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Tailor a resume first — every tailoring session shows up here as a draft.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Applications</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Track every role from draft to offer. Every tailoring session starts here.
          </p>
        </div>
        <div className="inline-flex rounded-lg bg-gray-200 dark:bg-gray-800/60 p-0.5 border border-gray-200 dark:border-gray-800">
          {(["kanban", "list"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-[11px] font-medium rounded-md capitalize ${view === v ? "bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200" : "text-gray-500 dark:text-gray-400"}`}
            >{v}</button>
          ))}
        </div>
      </div>

      {/* Upcoming strip */}
      {upcoming.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
            Next actions ({upcoming.length})
          </p>
          <div className="flex gap-2 flex-wrap">
            {upcoming.map(({ r, days }) => (
              <span key={r.record_id} className="text-[11px] px-2 py-1 rounded-md bg-white/60 dark:bg-gray-900/40 border border-amber-500/20">
                <b>{r.jd_analysis?.job_title || "Untitled"}</b>
                {r.jd_analysis?.company && r.jd_analysis.company !== "Not specified" ? ` · ${r.jd_analysis.company}` : ""}
                <span className={`ml-1.5 ${days! < 0 ? "text-red-500 font-bold" : days! <= 2 ? "text-amber-500 font-bold" : "text-gray-500"}`}>
                  {days! < 0 ? `${Math.abs(days!)}d overdue` : days === 0 ? "today" : `in ${days}d`}
                </span>
                {r.application?.next_action_note && <span className="text-gray-500 dark:text-gray-400"> — {r.application.next_action_note}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {view === "kanban" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {COLUMNS.map(col => {
            const list = grouped[col.key];
            return (
              <div key={col.key} className="rounded-xl border border-gray-200 dark:border-gray-800/60 bg-white/40 dark:bg-gray-900/30 overflow-hidden">
                <div className={`bg-gradient-to-b ${col.accent} px-3 py-2 border-b border-gray-200 dark:border-gray-800/60 flex items-center justify-between`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">{col.label}</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">{list.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[60px] max-h-[70vh] overflow-y-auto">
                  {list.map(r => (
                    <ApplicationCard
                      key={r.record_id}
                      record={r}
                      statuses={COLUMNS.map(c => c.key)}
                      saving={savingId === r.record_id}
                      isEditing={editing === r.record_id}
                      onToggleEdit={() => setEditing(editing === r.record_id ? null : r.record_id)}
                      onStatusChange={(s) => handleStatusChange(r.record_id, s)}
                      onPatch={(patch) => handlePatch(r.record_id, patch)}
                    />
                  ))}
                  {list.length === 0 && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-600 italic text-center py-2">empty</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800/60 bg-white/40 dark:bg-gray-900/30 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-100/60 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Role</th>
                <th className="text-left px-3 py-2">Company</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Applied</th>
                <th className="text-left px-3 py-2">Next action</th>
                <th className="text-left px-3 py-2">Recruiter</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.record_id} className="border-t border-gray-200 dark:border-gray-800/60">
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{r.jd_analysis?.job_title || "—"}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{r.jd_analysis?.company && r.jd_analysis.company !== "Not specified" ? r.jd_analysis.company : "—"}</td>
                  <td className="px-3 py-2">
                    <select
                      value={r.application?.status || "draft"}
                      onChange={e => handleStatusChange(r.record_id, e.target.value as ApplicationStatus)}
                      disabled={savingId === r.record_id}
                      className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
                    >
                      {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{r.application?.applied_at ? formatDate(r.application.applied_at) : "—"}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                    {r.application?.next_action_date ? `${formatDate(r.application.next_action_date)}${r.application.next_action_note ? " · " + r.application.next_action_note : ""}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                    {r.application?.recruiter_name || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Single card ───────────────────────────────────────────────────────────

function ApplicationCard({
  record, statuses, saving, isEditing, onToggleEdit, onStatusChange, onPatch,
}: {
  record: TailoringRecord;
  statuses: ApplicationStatus[];
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

  const days = daysUntil(app.next_action_date);
  const title = record.jd_analysis?.job_title || "Untitled";
  const company = record.jd_analysis?.company && record.jd_analysis.company !== "Not specified" ? record.jd_analysis.company : null;

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
    <div className="rounded-lg border border-gray-200 dark:border-gray-800/60 bg-white/80 dark:bg-gray-900/50 p-2 space-y-1">
      <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate">{title}</p>
      {company && <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{company}</p>}
      {days !== null && (
        <p className={`text-[10px] ${days < 0 ? "text-red-500 font-bold" : days <= 2 ? "text-amber-500 font-semibold" : "text-gray-500 dark:text-gray-400"}`}>
          {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `in ${days}d`}
          {app.next_action_note ? ` · ${app.next_action_note}` : ""}
        </p>
      )}
      <div className="flex items-center gap-1 pt-1">
        <select
          value={app.status || "draft"}
          onChange={e => onStatusChange(e.target.value as ApplicationStatus)}
          disabled={saving}
          className="flex-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700"
        >
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={onToggleEdit}
          className="text-[10px] px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >{isEditing ? "×" : "✎"}</button>
      </div>

      {isEditing && (
        <div className="pt-1.5 space-y-1 border-t border-gray-200 dark:border-gray-800/40">
          <input placeholder="Recruiter name" value={recruiterName} onChange={e => setRecruiterName(e.target.value)}
                 className="w-full text-[10px] px-1.5 py-1 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700" />
          <input placeholder="Recruiter email" value={recruiterEmail} onChange={e => setRecruiterEmail(e.target.value)}
                 className="w-full text-[10px] px-1.5 py-1 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700" />
          <input placeholder="Job URL" value={jobUrl} onChange={e => setJobUrl(e.target.value)}
                 className="w-full text-[10px] px-1.5 py-1 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700" />
          <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)}
                 className="w-full text-[10px] px-1.5 py-1 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700" />
          <input placeholder="Next action" value={nextNote} onChange={e => setNextNote(e.target.value)}
                 className="w-full text-[10px] px-1.5 py-1 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700" />
          <textarea placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                 className="w-full text-[10px] px-1.5 py-1 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 resize-none" />
          <div className="flex gap-1 justify-end">
            <button onClick={onToggleEdit} className="text-[10px] px-2 py-0.5 rounded text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">Cancel</button>
            <button onClick={save} disabled={saving} className="text-[10px] px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50">Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

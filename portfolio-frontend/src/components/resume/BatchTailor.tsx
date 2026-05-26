import { useState, useCallback, useRef, useEffect } from 'react';
import { apiService } from '@/lib/api';
import { toast } from 'sonner';
import type { TailoredFullResume, JDAnalysis, ATSScores } from '@/types/resume';
import { useAuth } from '@/contexts/AuthContext';
import { useDailyUsage, DailyUsage } from '@/hooks/useDailyUsage';
import { DailyUsageBadge } from '@/components/quota/DailyUsageBadge';
import { QuotaLimitDialog } from '@/components/quota/QuotaLimitDialog';
import { useFeedback } from '@/components/feedback/FeedbackWidget';
import { buildCoverLetterFilename } from '@/lib/filename';

interface JDEntry {
  id: string;
  title: string;
  text: string;
  /** Set when handed off from Daily Pipeline with a failed JD scrape so the
   * UI can render a clear "paste below" prompt instead of a generic empty
   * textarea. Purely informational — submission validation is text-length. */
  fetchFailed?: boolean;
  /** Original posting URL when handed off from the pipeline — surfaced so
   * the user can click through and copy the JD from the source. */
  sourceUrl?: string;
  /** Daily-pipeline record id. When present the backend wires the resulting
   * tailoring_record back to the saved_job (status → applied, streak++) so
   * the batch flow shows up in Applications / Tailored / My Resumes the same
   * way a single-row Tailor does. */
  sourceJobId?: string;
}

const BATCH_TAILOR_MAX = 25;

type ExtraStatus = 'idle' | 'generating' | 'done' | 'failed';

interface BatchJob {
  id: string;
  jobId: string;
  title: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result?: {
    tailored_resume: TailoredFullResume;
    jd_analysis: JDAnalysis;
    record_id?: string;
    source_job_id?: string;
  };
  error?: string;
  /** Original posting URL when handed off from the Daily Pipeline. */
  sourceUrl?: string;
  /** Daily Pipeline saved_job id linked to this batch entry (passed through
   *  from the handoff). Server-side sync flips this saved_job's status when
   *  the user confirms applied via the batch prompt. */
  sourceJobId?: string;
  /** Lazy-generated cover letter — only kicks off on user click. */
  coverLetter?: { status: ExtraStatus; text?: string; error?: string };
  /** Lazy-generated ATS scores — same pattern. */
  atsScores?: { status: ExtraStatus; data?: ATSScores; error?: string };
  /** Local mirror of application.status — toggled by the I applied / Not
   *  yet / Dismiss prompt. Starts undefined until the user picks one. */
  applicationStatus?: 'interested' | 'applied' | 'dismissed';
  /** True while a PATCH is in flight from one of the three buttons. */
  confirming?: boolean;
}

function PlusIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>);
}
function TrashIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>);
}
function CheckIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
}
function XIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
}
function DownloadIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>);
}

let idCounter = 0;
const nextId = () => `jd-${++idCounter}`;

// Persistence — keyed per user so two accounts on the same browser never
// see each other's in-flight batch. The legacy global key is migrated
// to the current user on first read so nobody loses a running batch
// during the rollout.
const BATCH_STORAGE_PREFIX = 'batch_tailor_jobs_v1';
const LEGACY_BATCH_KEY = 'batch_tailor_jobs_v1';
const BATCH_TTL_MS = 6 * 60 * 60 * 1000; // 6h — after that, results are stale
function batchStorageKey(userEmail: string | null | undefined): string {
  const slug = (userEmail || '').trim().toLowerCase() || 'anonymous';
  return `${BATCH_STORAGE_PREFIX}:${slug}`;
}

function readPersistedBatch(userEmail: string | null | undefined): BatchJob[] | null {
  const key = batchStorageKey(userEmail);
  try {
    let raw = localStorage.getItem(key);
    // One-time migration of the legacy global key to the current user.
    if (!raw && key !== LEGACY_BATCH_KEY) {
      const legacy = localStorage.getItem(LEGACY_BATCH_KEY);
      if (legacy) {
        try {
          localStorage.setItem(key, legacy);
          localStorage.removeItem(LEGACY_BATCH_KEY);
          raw = legacy;
        } catch { /* quota */ }
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { jobs: BatchJob[]; savedAt: number };
    if (!parsed?.jobs || !Array.isArray(parsed.jobs)) return null;
    if (Date.now() - (parsed.savedAt || 0) > BATCH_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.jobs;
  } catch {
    return null;
  }
}

function writePersistedBatch(jobs: BatchJob[], userEmail: string | null | undefined): void {
  const key = batchStorageKey(userEmail);
  try {
    if (!jobs.length) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(
      key,
      JSON.stringify({ jobs, savedAt: Date.now() }),
    );
  } catch {
    /* quota / private mode — ignore */
  }
}

export default function BatchTailor() {
  const { user } = useAuth();
  const userEmail = user?.email || null;
  const [jdEntries, setJdEntries] = useState<JDEntry[]>([{ id: nextId(), title: '', text: '' }]);
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>(() => readPersistedBatch(userEmail) ?? []);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { usage: dailyUsage, loading: usageLoading, refresh: refreshUsage, applyUsage } = useDailyUsage();
  const [quotaDialog, setQuotaDialog] = useState<(DailyUsage & { requested?: number }) | null>(null);
  const feedback = useFeedback();

  // Persist on every batchJobs change so refresh / tab close survive.
  useEffect(() => {
    writePersistedBatch(batchJobs, userEmail);
  }, [batchJobs, userEmail]);

  // If the user switches accounts on the same tab (rare but real), reset
  // local state and re-hydrate from THAT user's key. Without this, the
  // previously-mounted state would persist into the new user's session.
  useEffect(() => {
    const fresh = readPersistedBatch(userEmail) ?? [];
    setBatchJobs(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  const addEntry = useCallback(() => {
    if (jdEntries.length >= BATCH_TAILOR_MAX) return;
    setJdEntries(prev => [...prev, { id: nextId(), title: '', text: '' }]);
  }, [jdEntries.length]);

  // Receive a batch handoff from the Daily Pipeline. The pipeline pre-fetches
  // every selected job's JD (parallel, capped) and writes the result here.
  // Entries with fetchFailed=true land empty so the user can paste manually
  // before submitting the whole batch.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('pending_batch_tailor_jobs');
      if (!raw) return;
      sessionStorage.removeItem('pending_batch_tailor_jobs');
      const parsed = JSON.parse(raw) as Array<{
        job_id: string;
        title: string;
        company: string;
        url: string;
        jd_text: string;
        jd_fetch_failed?: boolean;
      }>;
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const incoming: JDEntry[] = parsed.slice(0, BATCH_TAILOR_MAX).map((j) => ({
        id: nextId(),
        title: [j.title, j.company].filter(Boolean).join(' @ ') || 'Job from pipeline',
        text: j.jd_text || '',
        fetchFailed: !!j.jd_fetch_failed,
        sourceUrl: j.url || undefined,
        sourceJobId: j.job_id || undefined,
      }));
      setJdEntries(incoming);
      const failedN = incoming.filter((e) => e.fetchFailed).length;
      if (failedN > 0) {
        toast.warning(
          `${incoming.length} jobs loaded — ${failedN} JD${failedN > 1 ? 's' : ''} need a manual paste before "Submit" enables them.`,
          { duration: 8000 },
        );
      } else {
        toast.success(`${incoming.length} jobs loaded from Daily Pipeline — click Submit to tailor all.`);
      }
    } catch (e) {
      // Bad JSON or storage error — ignore, the empty default form still works.
    }
  }, []);

  const removeEntry = useCallback((id: string) => {
    setJdEntries(prev => prev.length > 1 ? prev.filter(e => e.id !== id) : prev);
  }, []);

  const updateEntry = useCallback((id: string, field: 'title' | 'text', value: string) => {
    setJdEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  }, []);

  const canSubmit = jdEntries.some(e => e.text.trim().length > 50);

  const handleSubmit = useCallback(async () => {
    const validEntries = jdEntries.filter(e => e.text.trim().length > 50);
    if (validEntries.length === 0) return;

    setSubmitting(true);
    const resp = await apiService.batchTailor(
      validEntries.map(e => ({
        text: e.text.trim(),
        title: e.title.trim() || `Job ${jdEntries.indexOf(e) + 1}`,
        source_job_id: e.sourceJobId,
      }))
    );
    setSubmitting(false);

    if (resp.error) {
      if (resp.status === 429 && (resp.errorPayload as any)?.error === 'daily_quota_exceeded') {
        const u = (resp.errorPayload as any).usage as DailyUsage & { requested?: number };
        applyUsage(u);
        setQuotaDialog({ ...u, requested: validEntries.length });
        return;
      }
      toast.error('Batch submission failed', { description: resp.error });
      return;
    }
    if (!resp.data?.jobs) return;
    refreshUsage();

    const jobs: BatchJob[] = resp.data.jobs.map((j, i) => ({
      id: validEntries[i].id,
      jobId: j.job_id,
      title: j.title || validEntries[i].title || `Job ${i + 1}`,
      status: 'processing' as const,
      sourceUrl: validEntries[i].sourceUrl,
      sourceJobId: validEntries[i].sourceJobId,
    }));
    setBatchJobs(jobs);
    toast.success(`${jobs.length} job${jobs.length > 1 ? 's' : ''} submitted`);
  }, [jdEntries]);

  const handleGenerateCoverLetter = useCallback(async (job: BatchJob) => {
    if (!job.result || job.coverLetter?.status === 'generating') return;
    setBatchJobs(prev => prev.map(j =>
      j.jobId === job.jobId ? { ...j, coverLetter: { status: 'generating' } } : j,
    ));
    const resp = await apiService.generateCoverLetter(
      job.result.tailored_resume,
      job.result.jd_analysis,
    );
    if (resp.error || !resp.data?.cover_letter) {
      setBatchJobs(prev => prev.map(j =>
        j.jobId === job.jobId
          ? { ...j, coverLetter: { status: 'failed', error: resp.error || 'Generation failed' } }
          : j,
      ));
      toast.error(`Cover letter failed for "${job.title}"`);
      return;
    }
    setBatchJobs(prev => prev.map(j =>
      j.jobId === job.jobId
        ? { ...j, coverLetter: { status: 'done', text: resp.data!.cover_letter } }
        : j,
    ));
    toast.success(`Cover letter ready for "${job.title}"`);
  }, []);

  const handleDownloadCoverLetter = useCallback((job: BatchJob) => {
    const txt = job.coverLetter?.text;
    if (!txt) return;
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = buildCoverLetterFilename(
      job.result?.tailored_resume?.contact?.name || '',
      job.result?.jd_analysis?.job_title || job.title || '',
      'txt',
    );
    a.click();
    URL.revokeObjectURL(u);
  }, []);

  // "Did you apply?" prompt — sets the tailoring_record's application
  // status to applied (or clears the prompt without changing it) AND
  // syncs the linked Daily Pipeline saved_job via the backend sync
  // helper. Single source of truth: PATCH on the record, backend handles
  // the saved_job propagation.
  const handleConfirmApplied = useCallback(async (job: BatchJob) => {
    const recordId = job.result?.record_id;
    if (!recordId || job.confirming) return;
    setBatchJobs((prev) => prev.map((j) =>
      j.jobId === job.jobId ? { ...j, confirming: true } : j,
    ));
    const r = await apiService.updateApplication(recordId, {
      status: 'applied',
      batch_confirmation_pending: false,
    });
    if (r.error) {
      toast.error(`Couldn't mark applied for "${job.title}"`);
      setBatchJobs((prev) => prev.map((j) =>
        j.jobId === job.jobId ? { ...j, confirming: false } : j,
      ));
      return;
    }
    setBatchJobs((prev) => prev.map((j) =>
      j.jobId === job.jobId
        ? { ...j, confirming: false, applicationStatus: 'applied' }
        : j,
    ));
    toast.success(`"${job.title}" marked as applied — synced to Daily Pipeline.`);
  }, []);

  const handleConfirmNotYet = useCallback(async (job: BatchJob, label = 'Not yet') => {
    const recordId = job.result?.record_id;
    if (!recordId || job.confirming) return;
    setBatchJobs((prev) => prev.map((j) =>
      j.jobId === job.jobId ? { ...j, confirming: true } : j,
    ));
    const r = await apiService.updateApplication(recordId, {
      batch_confirmation_pending: false,
    });
    if (r.error) {
      toast.error(`Couldn't update "${job.title}"`);
      setBatchJobs((prev) => prev.map((j) =>
        j.jobId === job.jobId ? { ...j, confirming: false } : j,
      ));
      return;
    }
    setBatchJobs((prev) => prev.map((j) =>
      j.jobId === job.jobId
        ? { ...j, confirming: false, applicationStatus: 'dismissed' }
        : j,
    ));
    toast.message(`"${job.title}" — kept as Interested. ${label === 'Dismiss' ? 'Prompt dismissed.' : 'Confirm later from the kanban.'}`);
  }, []);

  const handleOpenInEditor = useCallback((job: BatchJob) => {
    if (!job.result) return;
    // Cross-tab handoff via localStorage (sessionStorage is per-tab so we
    // can't read it from the new window). Key is the batch job_id so a user
    // can open multiple results in parallel windows without collisions.
    try {
      localStorage.setItem(
        `batch_handoff_${job.jobId}`,
        JSON.stringify({
          tailored_resume: job.result.tailored_resume,
          jd_analysis: job.result.jd_analysis,
          title: job.title,
          source_url: job.sourceUrl || '',
          saved_at: Date.now(),
        }),
      );
    } catch {
      toast.error('Browser storage full — close some tabs and try again.');
      return;
    }
    const url = `${window.location.origin}/?tab=tailor&load_batch=${encodeURIComponent(job.jobId)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const handleGenerateAts = useCallback(async (job: BatchJob) => {
    if (!job.result || job.atsScores?.status === 'generating') return;
    setBatchJobs(prev => prev.map(j =>
      j.jobId === job.jobId ? { ...j, atsScores: { status: 'generating' } } : j,
    ));
    const resp = await apiService.fetchATSScores(
      job.result.tailored_resume,
      job.result.jd_analysis,
    );
    if (resp.error || !resp.data?.ats_scores) {
      setBatchJobs(prev => prev.map(j =>
        j.jobId === job.jobId
          ? { ...j, atsScores: { status: 'failed', error: resp.error || 'Scoring failed' } }
          : j,
      ));
      toast.error(`ATS score failed for "${job.title}"`);
      return;
    }
    setBatchJobs(prev => prev.map(j =>
      j.jobId === job.jobId
        ? { ...j, atsScores: { status: 'done', data: resp.data!.ats_scores } }
        : j,
    ));
  }, []);

  // Poll all active jobs
  useEffect(() => {
    const activeJobs = batchJobs.filter(j => j.status === 'processing' || j.status === 'queued');
    if (activeJobs.length === 0) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    const poll = async () => {
      for (const job of activeJobs) {
        try {
          const resp = await apiService.pollJobStatus<any>(job.jobId);
          if (!resp.data) continue;
          const { status } = resp.data;
          if (status === 'completed' && resp.data.result) {
            setBatchJobs(prev => prev.map(j =>
              j.jobId === job.jobId ? { ...j, status: 'completed', result: resp.data!.result } : j
            ));
            toast.success(`"${job.title}" completed`);
          } else if (status === 'failed') {
            setBatchJobs(prev => prev.map(j =>
              j.jobId === job.jobId ? { ...j, status: 'failed', error: resp.data!.error || 'Failed' } : j
            ));
          }
        } catch { /* ignore individual poll errors */ }
      }
    };

    pollRef.current = setInterval(poll, 3000);
    poll(); // immediate first poll
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [batchJobs]);

  const handleDownload = useCallback(async (job: BatchJob, fmt: 'pdf' | 'docx') => {
    if (!job.result) return;
    const r = await apiService.downloadTailoredResume(job.result.tailored_resume, job.result.jd_analysis, fmt);
    if (r.error) { toast.error('Download failed'); return; }
    if (r.data) {
      const u = URL.createObjectURL(r.data);
      const a = document.createElement('a'); a.href = u; a.download = r.filename || `resume.${fmt}`; a.click(); URL.revokeObjectURL(u);
      toast.success(`Downloaded ${fmt.toUpperCase()}`);
    }
  }, []);

  const completedCount = batchJobs.filter(j => j.status === 'completed').length;
  const totalCount = batchJobs.length;
  const isRunning = batchJobs.some(j => j.status === 'processing' || j.status === 'queued');

  return (
    <div className="space-y-5">
      {/* Input phase */}
      {batchJobs.length === 0 && (
        <>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">{jdEntries.length}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Batch Tailor</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Add up to {BATCH_TAILOR_MAX} job descriptions and tailor your resume to all of them at once. You can also tick rows on the Daily Pipeline and send them here in one shot.</p>
            </div>
          </div>

          <div className="space-y-3">
            {jdEntries.map((entry, i) => (
              <div
                key={entry.id}
                className={`rounded-xl border overflow-hidden ${
                  entry.fetchFailed && !entry.text.trim()
                    ? 'border-amber-400/60 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/[0.06]'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80'
                }`}
              >
                <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-200 dark:border-gray-800/60">
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">Job Description {i + 1}</span>
                  <div className="flex items-center gap-2">
                    {entry.fetchFailed && !entry.text.trim() && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        ⚠ JD not auto-fetched — paste below
                      </span>
                    )}
                    {entry.sourceUrl && (
                      <a
                        href={entry.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 underline"
                        title="Open the source posting in a new tab"
                      >
                        open posting ↗
                      </a>
                    )}
                    {jdEntries.length > 1 && (
                      <button type="button" onClick={() => removeEntry(entry.id)}
                        className="p-1 text-gray-400 dark:text-gray-600 hover:text-red-400 rounded transition-colors">
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <input
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/60 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
                    placeholder="Job title (optional, e.g. Senior Cloud Engineer at AWS)"
                    value={entry.title}
                    onChange={e => updateEntry(entry.id, 'title', e.target.value)}
                  />
                  <textarea
                    className={`w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800/60 border text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all ${
                      entry.fetchFailed && !entry.text.trim()
                        ? 'border-amber-400/70 dark:border-amber-500/50'
                        : 'border-gray-300 dark:border-gray-700/60'
                    }`}
                    rows={4}
                    placeholder={
                      entry.fetchFailed && !entry.text.trim()
                        ? "Couldn't auto-fetch this posting — open the source link above, copy the full JD, and paste it here."
                        : 'Paste the complete job description here...'
                    }
                    maxLength={15000}
                    value={entry.text}
                    onChange={e => updateEntry(entry.id, 'text', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {jdEntries.length < BATCH_TAILOR_MAX && (
              <button type="button" onClick={addEntry}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-purple-600 dark:text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 hover:text-purple-700 hover:border-purple-400 dark:hover:bg-purple-500/20 dark:hover:text-purple-300 dark:hover:border-purple-400/50 transition-all duration-200">
                <PlusIcon className="w-4 h-4" />Add Job Description
              </button>
            )}
            <button type="button" onClick={handleSubmit} disabled={!canSubmit || submitting || (dailyUsage?.remaining === 0)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 dark:disabled:from-gray-800 dark:disabled:to-gray-800 dark:disabled:text-gray-600 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 disabled:shadow-none transition-all duration-200">
              {submitting ? (
                <><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Submitting...</>
              ) : (
                <>Tailor All ({jdEntries.filter(e => e.text.trim().length > 50).length})</>
              )}
            </button>
            <DailyUsageBadge usage={dailyUsage} loading={usageLoading} className="ml-auto" />
          </div>
        </>
      )}

      {/* Results phase — live progress cards */}
      {batchJobs.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Batch Results {isRunning && <span className="text-xs font-normal text-gray-400 dark:text-gray-500">({completedCount} of {totalCount} complete)</span>}
              </p>
              {isRunning && (
                <div className="mt-2 h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden w-48">
                  <div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 transition-all duration-500" style={{ width: `${totalCount ? (completedCount / totalCount) * 100 : 0}%` }} />
                </div>
              )}
            </div>
            {!isRunning && (
              <button type="button" onClick={() => { setBatchJobs([]); setJdEntries([{ id: nextId(), title: '', text: '' }]); }}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                Start New Batch
              </button>
            )}
          </div>

          <div className="space-y-2">
            {batchJobs.map(job => (
              <div key={job.jobId} className={`rounded-xl border px-5 py-4 transition-all ${
                job.status === 'completed' ? 'border-emerald-500/20 bg-emerald-500/5' :
                job.status === 'failed' ? 'border-red-500/20 bg-red-500/5' :
                'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {job.status === 'completed' && <CheckIcon className="w-5 h-5 text-emerald-400 shrink-0" />}
                    {job.status === 'failed' && <XIcon className="w-5 h-5 text-red-400 shrink-0" />}
                    {(job.status === 'processing' || job.status === 'queued') && (
                      <span className="w-5 h-5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{job.title}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {job.status === 'completed' ? 'Ready' :
                         job.status === 'failed' ? (job.error || 'Failed') :
                         job.status === 'processing' ? 'Tailoring...' : 'Queued'}
                      </p>
                    </div>
                  </div>
                  {job.status === 'completed' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {job.sourceUrl && (
                        <a
                          href={job.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all"
                          title="Open the original posting to apply"
                        >
                          Apply ↗
                        </a>
                      )}
                      <button onClick={() => handleDownload(job, 'pdf')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all">
                        <DownloadIcon className="w-3.5 h-3.5" />PDF
                      </button>
                      <button onClick={() => handleDownload(job, 'docx')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-all">
                        <DownloadIcon className="w-3.5 h-3.5" />DOCX
                      </button>
                      <button
                        onClick={() => handleOpenInEditor(job)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-all"
                        title="Open the tailored resume in a new tab — edit / regenerate without leaving this batch"
                      >
                        Edit ↗
                      </button>
                    </div>
                  )}
                </div>

                {/* Secondary actions: cover letter + ATS score (lazy — Gemini
                    calls are expensive, so we only generate on click). Each
                    button stays compact until clicked, then expands inline. */}
                {job.status === 'completed' && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-emerald-500/15 pt-2.5">
                    {/* Cover letter */}
                    {(!job.coverLetter || job.coverLetter.status === 'idle') && (
                      <button
                        onClick={() => handleGenerateCoverLetter(job)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 transition-all"
                      >
                        ✍ Cover letter
                      </button>
                    )}
                    {job.coverLetter?.status === 'generating' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-500/5 border border-indigo-500/20">
                        <span className="inline-block h-3 w-3 rounded-full border-2 border-indigo-500/60 border-t-transparent animate-spin" />
                        Writing cover letter…
                      </span>
                    )}
                    {job.coverLetter?.status === 'done' && (
                      <button
                        onClick={() => handleDownloadCoverLetter(job)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all"
                        title="Download cover letter as .txt"
                      >
                        <DownloadIcon className="w-3 h-3" /> Cover letter ready
                      </button>
                    )}
                    {job.coverLetter?.status === 'failed' && (
                      <button
                        onClick={() => handleGenerateCoverLetter(job)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition-all"
                      >
                        ✗ Retry cover letter
                      </button>
                    )}

                    {/* ATS score */}
                    {(!job.atsScores || job.atsScores.status === 'idle') && (
                      <button
                        onClick={() => handleGenerateAts(job)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-all"
                      >
                        ⓘ ATS score
                      </button>
                    )}
                    {job.atsScores?.status === 'generating' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-purple-500/5 border border-purple-500/20">
                        <span className="inline-block h-3 w-3 rounded-full border-2 border-purple-500/60 border-t-transparent animate-spin" />
                        Scoring…
                      </span>
                    )}
                    {job.atsScores?.status === 'done' && job.atsScores.data && (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                          (job.atsScores.data.overall ?? 0) >= 80
                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
                            : (job.atsScores.data.overall ?? 0) >= 60
                            ? 'text-amber-700 dark:text-amber-300 bg-amber-500/15 border-amber-500/30'
                            : 'text-rose-700 dark:text-rose-300 bg-rose-500/15 border-rose-500/30'
                        }`}
                        title={`ATS overall · keyword ${job.atsScores.data.keyword_match ?? '?'}% · format ${job.atsScores.data.format_score ?? '?'}%`}
                      >
                        ATS {Math.round(job.atsScores.data.overall ?? 0)}%
                      </span>
                    )}
                    {job.atsScores?.status === 'failed' && (
                      <button
                        onClick={() => handleGenerateAts(job)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition-all"
                      >
                        ✗ Retry ATS
                      </button>
                    )}
                  </div>
                )}

                {job.status === 'completed' && job.result?.tailored_resume?.ats_keyword_audit?.required_missing?.length ? (
                  <p className="mt-2 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
                    ⚠ {job.result.tailored_resume.ats_keyword_audit.required_missing.length} required JD keyword
                    {job.result.tailored_resume.ats_keyword_audit.required_missing.length === 1 ? '' : 's'} not in resume:{' '}
                    <span className="font-mono text-[10.5px]">
                      {job.result.tailored_resume.ats_keyword_audit.required_missing.slice(0, 6).join(', ')}
                      {job.result.tailored_resume.ats_keyword_audit.required_missing.length > 6 ? '…' : ''}
                    </span>
                  </p>
                ) : null}

                {/* Did-you-apply prompt — shown only while the batch row is
                    still pending confirmation. Three exits: applied (syncs
                    Daily Pipeline saved_job → applied + ticks streak), Not
                    yet (keeps as Interested for later confirm from kanban),
                    Dismiss (same as Not yet, just clears the prompt). */}
                {job.status === 'completed'
                  && job.result?.record_id
                  && !job.applicationStatus
                  && (
                  <div className="mt-3 rounded-lg border border-emerald-500/30 bg-gradient-to-r from-emerald-500/[0.04] to-teal-500/[0.04] px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        Did you actually apply to <b>{job.title}</b>?
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleConfirmApplied(job)}
                          disabled={job.confirming}
                          className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
                        >
                          ✓ I applied
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmNotYet(job, 'Not yet')}
                          disabled={job.confirming}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-white/15 bg-white dark:bg-gray-800 px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-200 hover:border-gray-400 disabled:opacity-60"
                        >
                          Not yet
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmNotYet(job, 'Dismiss')}
                          disabled={job.confirming}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-60"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-[10px] text-emerald-700/70 dark:text-emerald-300/70">
                      "I applied" syncs to Daily Pipeline + Applications board + ticks today's streak.
                    </p>
                  </div>
                )}
                {job.applicationStatus === 'applied' && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    ✓ Marked applied — synced everywhere
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <QuotaLimitDialog
        open={!!quotaDialog}
        onOpenChange={(o) => !o && setQuotaDialog(null)}
        usage={quotaDialog}
        onRequestMore={() =>
          feedback.open({
            type: 'quota_bump',
            prefill:
              "Hi — I tried to run a batch of " +
              `${quotaDialog?.requested ?? ''} tailors and hit my daily limit. ` +
              "Could you bump it? Quick context:\n\n",
          })
        }
      />
    </div>
  );
}

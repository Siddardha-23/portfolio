import { useState, useCallback, useRef, useEffect } from 'react';
import { apiService } from '@/lib/api';
import { toast } from 'sonner';
import type { TailoredFullResume, JDAnalysis } from '@/types/resume';

interface JDEntry {
  id: string;
  title: string;
  text: string;
}

interface BatchJob {
  id: string;
  jobId: string;
  title: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result?: { tailored_resume: TailoredFullResume; jd_analysis: JDAnalysis };
  error?: string;
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

export default function BatchTailor() {
  const [jdEntries, setJdEntries] = useState<JDEntry[]>([{ id: nextId(), title: '', text: '' }]);
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addEntry = useCallback(() => {
    if (jdEntries.length >= 5) return;
    setJdEntries(prev => [...prev, { id: nextId(), title: '', text: '' }]);
  }, [jdEntries.length]);

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
      validEntries.map(e => ({ text: e.text.trim(), title: e.title.trim() || `Job ${jdEntries.indexOf(e) + 1}` }))
    );
    setSubmitting(false);

    if (resp.error) { toast.error('Batch submission failed', { description: resp.error }); return; }
    if (!resp.data?.jobs) return;

    const jobs: BatchJob[] = resp.data.jobs.map((j, i) => ({
      id: validEntries[i].id,
      jobId: j.job_id,
      title: j.title || validEntries[i].title || `Job ${i + 1}`,
      status: 'processing' as const,
    }));
    setBatchJobs(jobs);
    toast.success(`${jobs.length} job${jobs.length > 1 ? 's' : ''} submitted`);
  }, [jdEntries]);

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
              <p className="text-xs text-gray-400 dark:text-gray-500">Add up to 5 job descriptions and tailor your resume to all of them at once</p>
            </div>
          </div>

          <div className="space-y-3">
            {jdEntries.map((entry, i) => (
              <div key={entry.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 overflow-hidden">
                <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-200 dark:border-gray-800/60">
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">Job Description {i + 1}</span>
                  {jdEntries.length > 1 && (
                    <button type="button" onClick={() => removeEntry(entry.id)}
                      className="p-1 text-gray-400 dark:text-gray-600 hover:text-red-400 rounded transition-colors">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <input
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/60 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
                    placeholder="Job title (optional, e.g. Senior Cloud Engineer at AWS)"
                    value={entry.title}
                    onChange={e => updateEntry(entry.id, 'title', e.target.value)}
                  />
                  <textarea
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/60 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
                    rows={4}
                    placeholder="Paste the complete job description here..."
                    maxLength={15000}
                    value={entry.text}
                    onChange={e => updateEntry(entry.id, 'text', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {jdEntries.length < 5 && (
              <button type="button" onClick={addEntry}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-purple-600 dark:text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 hover:text-purple-700 hover:border-purple-400 dark:hover:bg-purple-500/20 dark:hover:text-purple-300 dark:hover:border-purple-400/50 transition-all duration-200">
                <PlusIcon className="w-4 h-4" />Add Job Description
              </button>
            )}
            <button type="button" onClick={handleSubmit} disabled={!canSubmit || submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 dark:disabled:from-gray-800 dark:disabled:to-gray-800 dark:disabled:text-gray-600 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 disabled:shadow-none transition-all duration-200">
              {submitting ? (
                <><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Submitting...</>
              ) : (
                <>Tailor All ({jdEntries.filter(e => e.text.trim().length > 50).length})</>
              )}
            </button>
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
                <div className="flex items-center justify-between gap-3">
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
                      <button onClick={() => handleDownload(job, 'pdf')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all">
                        <DownloadIcon className="w-3.5 h-3.5" />PDF
                      </button>
                      <button onClick={() => handleDownload(job, 'docx')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-all">
                        <DownloadIcon className="w-3.5 h-3.5" />DOCX
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

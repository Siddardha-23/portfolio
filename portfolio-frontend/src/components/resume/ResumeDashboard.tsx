import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '@/lib/api';
import StreakWidget from './StreakWidget';

export interface BaseResume {
  s3_key: string;
  filename: string;
  uploaded_at: string;
  size?: number;
  is_active?: boolean;
}

export interface GeneratedResume {
  s3_key: string;
  job_title?: string;
  filename?: string;
  created_at?: string;
  generated_at?: string;
}

interface ResumeDashboardProps {
  onStartTailoring: () => void;
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// SVG icons
function FileIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function SparklesIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function UploadIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

export function DownloadIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

export function TrashIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

/**
 * Active resume card shown at the top of the Tailor tab.
 * Shows current resume with tailor + upload actions.
 */
export default function ResumeDashboard({ onStartTailoring }: ResumeDashboardProps) {
  const [activeResume, setActiveResume] = useState<BaseResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchActive = useCallback(async () => {
    setError('');
    const resp = await apiService.listBaseResumes();
    if (resp.error) { setError(resp.error); }
    else if (resp.data) {
      const resumes: BaseResume[] = resp.data.versions || [];
      setActiveResume(resumes.find(r => r.is_active) || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchActive(); }, [fetchActive]);

  const handleUpload = useCallback(async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.pdf') && !name.endsWith('.docx')) {
      setUploadError('Only PDF and DOCX files are accepted');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File too large (max 5 MB)');
      return;
    }
    setUploading(true);
    setUploadError('');
    const resp = await apiService.uploadResumeForParser(file);
    setUploading(false);
    if (resp.error) { setUploadError(resp.error); return; }
    await fetchActive();
  }, [fetchActive]);

  if (loading) {
    return (
      <div className="space-y-5">
        <StreakWidget />
        <div className="animate-pulse">
          <div className="h-24 rounded-xl bg-gray-800/40" />
        </div>
      </div>
    );
  }

  if (error && !activeResume) {
    return (
      <div className="space-y-5">
        <StreakWidget />
        <div className="px-4 py-3 rounded-lg bg-red-900/20 border border-red-500/30">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  // No active resume — prompt upload
  if (!activeResume) {
    return (
      <div className="space-y-5">
        <StreakWidget />
        <div className="relative overflow-hidden rounded-xl border border-dashed border-purple-500/30 bg-gradient-to-br from-gray-900 to-gray-950 p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(236,72,153,0.06),transparent_60%)]" />
        <div className="relative text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center">
            <UploadIcon className="w-7 h-7 text-purple-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-200">Upload Your Resume</p>
            <p className="text-sm text-gray-400 mt-1">Upload a PDF or DOCX to start tailoring</p>
          </div>
          <label className="inline-block cursor-pointer">
            <span className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm text-white transition-all duration-200 ${
              uploading
                ? 'bg-purple-700 cursor-wait'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40'
            }`}>
              {uploading ? (
                <><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Uploading...</>
              ) : (
                <><UploadIcon className="w-4 h-4" /> Choose File</>
              )}
            </span>
            <input
              type="file" accept=".pdf,.docx" className="hidden" disabled={uploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
            />
          </label>
          <p className="text-xs text-gray-500">PDF or DOCX, max 5 MB</p>
          {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}
        </div>
        </div>
      </div>
    );
  }

  // Active resume card
  return (
    <div className="space-y-5">
      <StreakWidget />

      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-white">1</span>
        </div>
        <p className="text-sm font-semibold text-gray-200">Your Resume</p>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-purple-500/20 bg-gradient-to-br from-gray-900 via-gray-900 to-purple-950/20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="relative p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <div className="shrink-0 w-11 h-11 rounded-lg bg-purple-500/10 flex items-center justify-center mt-0.5">
                <FileIcon className="w-5 h-5 text-purple-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-100 truncate">{activeResume.filename}</p>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Uploaded {formatDate(activeResume.uploaded_at)}
                  {activeResume.size ? ` \u00B7 ${formatBytes(activeResume.size)}` : ''}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={onStartTailoring}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-200"
              >
                <SparklesIcon className="w-4 h-4" />
                Tailor Resume
              </button>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 hover:border-gray-600 hover:text-gray-200 transition-all duration-200">
                  <UploadIcon className="w-3.5 h-3.5" />
                  Replace
                </span>
                <input
                  ref={fileInputRef}
                  type="file" accept=".pdf,.docx" className="hidden" disabled={uploading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                />
              </label>
            </div>
          </div>
          {uploading && (
            <div className="mt-3">
              <div className="h-1 rounded-full bg-gray-800 overflow-hidden">
                <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 animate-pulse" />
              </div>
              <p className="text-xs text-gray-400 mt-1">Uploading and parsing...</p>
            </div>
          )}
          {uploadError && <p className="text-sm text-red-400 mt-2">{uploadError}</p>}
        </div>
      </div>
    </div>
  );
}

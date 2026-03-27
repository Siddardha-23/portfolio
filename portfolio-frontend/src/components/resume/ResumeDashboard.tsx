import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '@/lib/api';

interface ResumeDashboardProps {
  onStartTailoring: () => void;
}

interface BaseResume {
  s3_key: string;
  filename: string;
  uploaded_at: string;
  size?: number;
  is_active?: boolean;
}

interface GeneratedResume {
  s3_key: string;
  job_title?: string;
  filename?: string;
  created_at: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
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

function DownloadIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function TrashIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function ChevronIcon({ open, className = 'w-4 h-4' }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`${className} transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

export default function ResumeDashboard({ onStartTailoring }: ResumeDashboardProps) {
  const [baseResumes, setBaseResumes] = useState<BaseResume[]>([]);
  const [generatedResumes, setGeneratedResumes] = useState<GeneratedResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [settingActive, setSettingActive] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showBaseResumes, setShowBaseResumes] = useState(false);
  const [showGenerated, setShowGenerated] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchResumes = useCallback(async () => {
    setError('');
    const [baseResp, genResp] = await Promise.all([
      apiService.listBaseResumes(),
      apiService.listGeneratedResumes(),
    ]);
    if (baseResp.error) setError(baseResp.error);
    else if (baseResp.data) setBaseResumes(baseResp.data.versions || []);
    if (genResp.data) setGeneratedResumes(genResp.data.generated || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchResumes(); }, [fetchResumes]);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Only PDF files are accepted');
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
    await fetchResumes();
  }, [fetchResumes]);

  const handleSetActive = useCallback(async (s3Key: string) => {
    setSettingActive(s3Key);
    const resp = await apiService.setActiveResume(s3Key);
    setSettingActive(null);
    if (resp.error) { setError(resp.error); return; }
    await fetchResumes();
  }, [fetchResumes]);

  const handleDelete = useCallback(async (s3Key: string) => {
    setDeleting(s3Key);
    const resp = await apiService.deleteResume(s3Key);
    setDeleting(null);
    if (resp.error) { setError(resp.error); return; }
    await fetchResumes();
  }, [fetchResumes]);

  const handleDownload = useCallback(async (s3Key: string, filename?: string) => {
    setDownloading(s3Key);
    try {
      const blob = await apiService.downloadResumeFile(s3Key);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || s3Key.split('/').pop() || 'resume.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch { setError('Download failed'); }
    setDownloading(null);
  }, []);

  const activeResume = baseResumes.find(r => r.is_active);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-36 rounded-xl bg-gray-800/50" />
        <div className="h-16 rounded-xl bg-gray-800/30" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-900/20 border border-red-500/30">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* ── No Active Resume: Upload Prompt ── */}
      {!activeResume && (
        <div className="relative overflow-hidden rounded-xl border border-dashed border-pink-500/30 bg-gradient-to-br from-gray-900 to-gray-950 p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(236,72,153,0.06),transparent_60%)]" />
          <div className="relative text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-pink-500/10 flex items-center justify-center">
              <UploadIcon className="w-7 h-7 text-pink-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-200">Upload Your Resume</p>
              <p className="text-sm text-gray-400 mt-1">Upload a PDF to get started with AI-powered tailoring</p>
            </div>
            <label className="inline-block cursor-pointer">
              <span className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm text-white transition-all duration-200 ${
                uploading
                  ? 'bg-pink-800 cursor-wait'
                  : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30'
              }`}>
                {uploading ? (
                  <><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Uploading...</>
                ) : (
                  <><UploadIcon className="w-4 h-4" /> Choose PDF File</>
                )}
              </span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                disabled={uploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
              />
            </label>
            <p className="text-xs text-gray-500">PDF only, max 5 MB</p>
            {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}
          </div>
        </div>
      )}

      {/* ── Active Resume Card ── */}
      {activeResume && (
        <div className="relative overflow-hidden rounded-xl border border-pink-500/20 bg-gradient-to-br from-gray-900 via-gray-900 to-pink-950/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          <div className="relative p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <div className="shrink-0 w-11 h-11 rounded-lg bg-pink-500/10 flex items-center justify-center mt-0.5">
                  <FileIcon className="w-5 h-5 text-pink-400" />
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 shadow-lg shadow-pink-500/15 hover:shadow-pink-500/25 transition-all duration-200"
                >
                  <SparklesIcon className="w-4 h-4" />
                  Tailor Resume
                </button>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 hover:border-gray-600 hover:text-gray-200 transition-all duration-200">
                    <UploadIcon className="w-3.5 h-3.5" />
                    Upload New
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    disabled={uploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                  />
                </label>
              </div>
            </div>
            {uploading && (
              <div className="mt-3">
                <div className="h-1 rounded-full bg-gray-800 overflow-hidden">
                  <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 animate-pulse" />
                </div>
                <p className="text-xs text-gray-400 mt-1">Uploading and parsing...</p>
              </div>
            )}
            {uploadError && <p className="text-sm text-red-400 mt-2">{uploadError}</p>}
          </div>
        </div>
      )}

      {/* ── Base Resumes (collapsible) ── */}
      {baseResumes.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBaseResumes(!showBaseResumes)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-800/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <FileIcon className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-200">Base Resumes</span>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{baseResumes.length}</span>
            </div>
            <ChevronIcon open={showBaseResumes} className="w-4 h-4 text-gray-500" />
          </button>
          {showBaseResumes && (
            <div className="border-t border-gray-800 divide-y divide-gray-800/60">
              {baseResumes.map(resume => (
                <div key={resume.s3_key} className="flex items-center justify-between px-5 py-3 hover:bg-gray-800/20 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${resume.is_active ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-200 truncate">{resume.filename}</p>
                        {resume.is_active && (
                          <span className="text-[10px] text-emerald-400 font-medium">Active</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatDate(resume.uploaded_at)}
                        {resume.size ? ` \u00B7 ${formatBytes(resume.size)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    {!resume.is_active && (
                      <button
                        onClick={() => handleSetActive(resume.s3_key)}
                        disabled={settingActive === resume.s3_key}
                        className="px-2.5 py-1.5 text-xs font-medium text-pink-400 hover:text-pink-300 hover:bg-pink-500/10 rounded-md transition-colors disabled:opacity-50"
                      >
                        {settingActive === resume.s3_key ? 'Setting...' : 'Set Active'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(resume.s3_key)}
                      disabled={deleting === resume.s3_key}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Generated Resumes (collapsible) ── */}
      {generatedResumes.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowGenerated(!showGenerated)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-800/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <SparklesIcon className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-gray-200">AI-Tailored Resumes</span>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{generatedResumes.length}</span>
            </div>
            <ChevronIcon open={showGenerated} className="w-4 h-4 text-gray-500" />
          </button>
          {showGenerated && (
            <div className="border-t border-gray-800 divide-y divide-gray-800/60">
              {generatedResumes.map(resume => (
                <div key={resume.s3_key} className="flex items-center justify-between px-5 py-3 hover:bg-gray-800/20 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-2 h-2 rounded-full shrink-0 bg-purple-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-200 truncate">
                        {resume.job_title || resume.filename || 'Tailored Resume'}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(resume.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <button
                      onClick={() => handleDownload(resume.s3_key, resume.filename)}
                      disabled={downloading === resume.s3_key}
                      className="p-1.5 text-gray-400 hover:text-pink-400 hover:bg-pink-500/10 rounded-md transition-colors disabled:opacity-50"
                      title="Download"
                    >
                      <DownloadIcon />
                    </button>
                    <button
                      onClick={() => handleDelete(resume.s3_key)}
                      disabled={deleting === resume.s3_key}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

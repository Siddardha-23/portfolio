import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

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

export default function ResumeDashboard({ onStartTailoring }: ResumeDashboardProps) {
  const [baseResumes, setBaseResumes] = useState<BaseResume[]>([]);
  const [generatedResumes, setGeneratedResumes] = useState<GeneratedResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [settingActive, setSettingActive] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const [showBaseResumes, setShowBaseResumes] = useState(false);
  const [showGenerated, setShowGenerated] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAreaRef = useRef<HTMLInputElement>(null);

  const fetchResumes = useCallback(async () => {
    setError('');
    const [baseResp, genResp] = await Promise.all([
      apiService.listBaseResumes(),
      apiService.listGeneratedResumes(),
    ]);

    if (baseResp.error) {
      setError(baseResp.error);
    } else if (baseResp.data) {
      setBaseResumes(baseResp.data.versions || []);
    }

    if (genResp.data) {
      setGeneratedResumes(genResp.data.generated || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

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
    if (resp.error) {
      setUploadError(resp.error);
      return;
    }
    await fetchResumes();
  }, [fetchResumes]);

  const handleSetActive = useCallback(async (s3Key: string) => {
    setSettingActive(s3Key);
    const resp = await apiService.setActiveResume(s3Key);
    setSettingActive(null);
    if (resp.error) {
      setError(resp.error);
      return;
    }
    await fetchResumes();
  }, [fetchResumes]);

  const handleDelete = useCallback(async (s3Key: string) => {
    setDeleting(s3Key);
    const resp = await apiService.deleteResume(s3Key);
    setDeleting(null);
    if (resp.error) {
      setError(resp.error);
      return;
    }
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
    } catch {
      setError('Download failed');
    }
    setDownloading(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const activeResume = baseResumes.find(r => r.is_active);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Active Resume Card */}
      {activeResume && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">Active Resume</CardTitle>
              <Badge variant="default" className="text-[10px] bg-green-600">Active</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{activeResume.filename}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Uploaded {formatDate(activeResume.uploaded_at)}
                  {activeResume.size ? ` - ${formatBytes(activeResume.size)}` : ''}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" onClick={onStartTailoring}>
                  Tailor This Resume
                </Button>
                <label>
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                    <span>{uploading ? 'Uploading...' : 'Upload New'}</span>
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                    }}
                  />
                </label>
              </div>
            </div>
            {uploadError && <p className="text-sm text-destructive mt-2">{uploadError}</p>}
          </CardContent>
        </Card>
      )}

      {/* Base Resumes (expandable) */}
      {baseResumes.length > 0 && (
        <Card>
          <CardHeader className="pb-0 cursor-pointer" onClick={() => setShowBaseResumes(!showBaseResumes)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                Base Resumes ({baseResumes.length})
              </CardTitle>
              <span className="text-muted-foreground text-xs">
                {showBaseResumes ? 'Hide' : 'Show'}
              </span>
            </div>
          </CardHeader>
          {showBaseResumes && (
            <CardContent className="pt-3">
              <div className="space-y-2">
                {baseResumes.map(resume => (
                  <div
                    key={resume.s3_key}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium truncate">{resume.filename}</p>
                        {resume.is_active && (
                          <Badge variant="default" className="text-[9px] bg-green-600 shrink-0">Active</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(resume.uploaded_at)}
                        {resume.size ? ` - ${formatBytes(resume.size)}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {!resume.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] h-7 px-2"
                          onClick={() => handleSetActive(resume.s3_key)}
                          disabled={settingActive === resume.s3_key}
                        >
                          {settingActive === resume.s3_key ? '...' : 'Set Active'}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[10px] h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(resume.s3_key)}
                        disabled={deleting === resume.s3_key}
                      >
                        {deleting === resume.s3_key ? '...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Generated Resumes (expandable) */}
      {generatedResumes.length > 0 && (
        <Card>
          <CardHeader className="pb-0 cursor-pointer" onClick={() => setShowGenerated(!showGenerated)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                Generated Resumes ({generatedResumes.length})
              </CardTitle>
              <span className="text-muted-foreground text-xs">
                {showGenerated ? 'Hide' : 'Show'}
              </span>
            </div>
          </CardHeader>
          {showGenerated && (
            <CardContent className="pt-3">
              <div className="space-y-2">
                {generatedResumes.map(resume => (
                  <div
                    key={resume.s3_key}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">
                        {resume.job_title || resume.filename || 'Tailored Resume'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(resume.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-7 px-2"
                        onClick={() => handleDownload(resume.s3_key, resume.filename)}
                        disabled={downloading === resume.s3_key}
                      >
                        {downloading === resume.s3_key ? '...' : 'Download'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[10px] h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(resume.s3_key)}
                        disabled={deleting === resume.s3_key}
                      >
                        {deleting === resume.s3_key ? '...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Upload area (drag-and-drop) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Upload Resume</CardTitle>
          <p className="text-xs text-muted-foreground">Upload a new base resume (PDF, max 5 MB)</p>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
          >
            <p className="text-sm text-muted-foreground mb-2">
              {uploading ? 'Uploading and parsing resume...' : 'Drag & drop your resume PDF here'}
            </p>
            {uploading && (
              <div className="w-full max-w-xs mx-auto mt-2">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            )}
            {!uploading && (
              <label>
                <Button variant="outline" size="sm" asChild>
                  <span>Or click to browse</span>
                </Button>
                <input
                  ref={uploadAreaRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                />
              </label>
            )}
            {uploadError && <p className="text-sm text-destructive mt-2">{uploadError}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

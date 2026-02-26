import { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  TailorPipelineResult,
  TailoredFullResume,
  JDAnalysis,
  ATSScores,
  ResumeStatus,
} from '@/types/resume';

// ---------------------------------------------------------------------------
// Password gate (same mechanism as job-search)
// ---------------------------------------------------------------------------

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    const resp = await apiService.jobSearchAuth(password);
    setLoading(false);
    if (resp.error) { setError(resp.error); return; }
    onAuth();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Resume Tailor</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Enter password to access</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Verifying...' : 'Access'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score bar component
// ---------------------------------------------------------------------------

function ScoreBar({ label, score, color }: { label: string; score: number; color?: string }) {
  const bg =
    score >= 80 ? 'bg-green-500' :
    score >= 60 ? 'bg-yellow-500' :
    'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color || bg}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ATS Scores panel
// ---------------------------------------------------------------------------

function ATSPanel({ scores }: { scores: ATSScores }) {
  return (
    <div className="space-y-6">
      {/* Overall score */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium">Overall ATS Score</p>
              <p className="text-xs text-muted-foreground">Weighted across all dimensions</p>
            </div>
            <div className={`text-4xl font-bold ${
              scores.overall >= 80 ? 'text-green-500' :
              scores.overall >= 60 ? 'text-yellow-500' :
              'text-red-500'
            }`}>
              {scores.overall}
            </div>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                scores.overall >= 80 ? 'bg-green-500' :
                scores.overall >= 60 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${scores.overall}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dimension scores */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScoreBar label="Keyword Match" score={scores.keyword_match} />
            <ScoreBar label="Skills Alignment" score={scores.skills_alignment} />
            <ScoreBar label="Experience Relevance" score={scores.experience_relevance} />
            <ScoreBar label="Quantifiable Impact" score={scores.quantifiable_impact} />
            <ScoreBar label="Format Score" score={scores.format_score} />
            <ScoreBar label="Section Completeness" score={scores.section_completeness} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">ATS Scanner Scores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scores.scanners && Object.entries(scores.scanners).map(([name, score]) => (
              <ScoreBar key={name} label={name.charAt(0).toUpperCase() + name.slice(1)} score={score} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* AI Screener */}
      {scores.ai_screener && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">AI Screener Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScoreBar label="Overall" score={scores.ai_screener.overall} color="bg-purple-500" />
            <ScoreBar label="Relevance" score={scores.ai_screener.relevance} color="bg-purple-500" />
            <ScoreBar label="Seniority Fit" score={scores.ai_screener.seniority_fit} color="bg-purple-500" />
            <ScoreBar label="Culture Fit" score={scores.ai_screener.culture_fit} color="bg-purple-500" />
          </CardContent>
        </Card>
      )}

      {/* Strengths & Suggestions */}
      <div className="grid gap-4 md:grid-cols-2">
        {scores.strengths?.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-green-600 dark:text-green-400">Strengths</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {scores.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-green-500 mt-0.5 shrink-0">+</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {scores.suggestions?.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {scores.suggestions.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-yellow-500 mt-0.5 shrink-0">!</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Missing keywords */}
      {scores.missing_keywords?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Missing Keywords</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {scores.missing_keywords.map(kw => (
                <Badge key={kw} variant="destructive" className="text-[10px]">{kw}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tailored resume preview
// ---------------------------------------------------------------------------

function ResumePreview({ resume }: { resume: TailoredFullResume }) {
  return (
    <div className="space-y-4">
      {/* Contact */}
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold">{resume.contact?.name}</h2>
        <p className="text-xs text-muted-foreground">
          {[resume.contact?.phone, resume.contact?.email, resume.contact?.linkedin, resume.contact?.github]
            .filter(Boolean)
            .join(' | ')}
        </p>
      </div>

      {/* Summary */}
      {resume.summary && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase tracking-wider">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground leading-relaxed">{resume.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Experience */}
      {resume.experience?.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase tracking-wider">Experience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resume.experience.map((exp, i) => (
              <div key={i}>
                <div className="flex justify-between items-start">
                  <p className="text-xs font-bold">
                    {exp.company}{exp.location ? `, ${exp.location}` : ''}
                  </p>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                    {exp.dates}
                  </span>
                </div>
                {exp.title && (
                  <p className="text-xs italic text-muted-foreground">{exp.title}</p>
                )}
                <ul className="mt-1 space-y-0.5">
                  {exp.bullets?.map((b, j) => (
                    <li key={j} className="text-[11px] text-muted-foreground flex gap-1.5">
                      <span className="shrink-0 mt-0.5">-</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Projects */}
      {resume.projects?.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase tracking-wider">Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resume.projects.map((proj, i) => (
              <div key={i}>
                <p className="text-xs font-bold">{proj.name}</p>
                <ul className="mt-1 space-y-0.5">
                  {proj.bullets?.map((b, j) => (
                    <li key={j} className="text-[11px] text-muted-foreground flex gap-1.5">
                      <span className="shrink-0 mt-0.5">-</span><span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Technical Skills */}
      {resume.skills && Object.keys(resume.skills).length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase tracking-wider">Technical Skills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {Object.entries(resume.skills).map(([cat, skills]) => (
              <div key={cat} className="text-xs">
                <span className="font-medium">{cat}: </span>
                <span className="text-muted-foreground">
                  {Array.isArray(skills) ? skills.join(', ') : String(skills)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Education */}
      {resume.education?.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase tracking-wider">Education</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resume.education.map((edu, i) => (
              <div key={i} className="flex justify-between items-start">
                <p className="text-xs font-medium">
                  {edu.institution}{edu.degree ? ` | ${edu.degree}` : ''}
                </p>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">{edu.dates}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// JD Analysis card
// ---------------------------------------------------------------------------

function JDAnalysisCard({ jd }: { jd: JDAnalysis }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Extracted Job Requirements</CardTitle>
        <p className="text-xs text-muted-foreground">
          {jd.job_title}{jd.company && jd.company !== 'Not specified' ? ` at ${jd.company}` : ''}
          {jd.location && jd.location !== 'Not specified' ? ` - ${jd.location}` : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Required Skills</p>
            <div className="flex flex-wrap gap-1">
              {jd.required_skills?.map(s => (
                <Badge key={s} variant="default" className="text-[10px]">{s}</Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Preferred Skills</p>
            <div className="flex flex-wrap gap-1">
              {jd.preferred_skills?.map(s => (
                <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
              ))}
            </div>
          </div>
        </div>

        {jd.responsibilities?.length > 0 && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Key Responsibilities</p>
            <ul className="space-y-0.5">
              {jd.responsibilities.slice(0, 5).map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="shrink-0">-</span><span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {jd.experience_years && <span>Exp: {jd.experience_years}</span>}
          {jd.employment_type && <span>Type: {jd.employment_type}</span>}
          {jd.industry && <span>Industry: {jd.industry}</span>}
        </div>

        {jd.keywords?.length > 0 && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">ATS Keywords</p>
            <div className="flex flex-wrap gap-1">
              {jd.keywords.map(kw => (
                <Badge key={kw} variant="outline" className="text-[10px]">{kw}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

function Dashboard({ onSessionExpired }: { onSessionExpired?: () => void }) {
  const [resumeStatus, setResumeStatus] = useState<ResumeStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const [jdText, setJdText] = useState('');
  const [tailoring, setTailoring] = useState(false);
  const [tailorStep, setTailorStep] = useState<'jd' | 'resume'>('jd');
  const [tailorError, setTailorError] = useState('');
  const [result, setResult] = useState<TailorPipelineResult | null>(null);
  const [atsLoading, setAtsLoading] = useState(false);

  const [downloading, setDownloading] = useState<'pdf' | 'docx' | null>(null);

  const [activeTab, setActiveTab] = useState<'preview' | 'ats'>('preview');

  // Load resume status
  useEffect(() => {
    apiService.getResumeStatus().then(resp => {
      if (resp.data) setResumeStatus(resp.data);
      setLoadingStatus(false);
    });
  }, []);

  // Upload handler
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
      if (resp.error.includes('Session expired') && onSessionExpired) onSessionExpired();
      return;
    }
    // Set status from upload response so UI updates even if getResumeStatus fails (e.g. deployed env)
    if (resp.data?.resume) {
      const r = resp.data.resume;
      setResumeStatus({
        has_resume: true,
        skills: r.skills,
        experience_years: r.experience_years,
        job_titles: r.job_titles,
        summary: r.summary,
        parsed_at: r.parsed_at,
      });
    }
    // Also refresh from server in case parsed_at etc. differ
    const statusResp = await apiService.getResumeStatus();
    if (statusResp.data) setResumeStatus(statusResp.data);
  }, [onSessionExpired]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  // Tailor handler — two sequential calls, one Gemini call each
  const handleTailor = useCallback(async () => {
    if (!jdText.trim()) return;
    setTailoring(true);
    setTailorStep('jd');
    setTailorError('');
    setResult(null);

    // Step 1: Extract JD
    const jdResp = await apiService.extractJD(jdText.trim());
    if (jdResp.error) { setTailoring(false); setTailorError(jdResp.error); return; }
    const jdAnalysis = jdResp.data?.jd_analysis;
    if (!jdAnalysis) { setTailoring(false); setTailorError('Failed to analyze job description.'); return; }

    // Step 2: Tailor resume
    setTailorStep('resume');
    const tailorResp = await apiService.tailorResume(jdAnalysis);
    setTailoring(false);

    if (tailorResp.error) { setTailorError(tailorResp.error); return; }
    if (tailorResp.data) {
      setResult({
        jd_analysis: jdAnalysis,
        tailored_resume: tailorResp.data.tailored_resume,
      });
    }
  }, [jdText]);

  // Fetch ATS scores on demand — separate synchronous call
  const handleFetchATS = useCallback(async () => {
    if (!result?.tailored_resume || !result?.jd_analysis) return;
    setAtsLoading(true);
    setTailorError('');

    const resp = await apiService.fetchATSScores(result.tailored_resume, result.jd_analysis);
    setAtsLoading(false);

    if (resp.error) {
      setTailorError('ATS scoring failed. Resume is still available for download.');
      return;
    }
    if (resp.data?.ats_scores) {
      setResult(prev => prev ? { ...prev, ats_scores: resp.data!.ats_scores } : prev);
    }
  }, [result]);

  // Download handler
  const handleDownload = useCallback(async (format: 'pdf' | 'docx') => {
    if (!result) return;
    setDownloading(format);
    const resp = await apiService.downloadTailoredResume(
      result.tailored_resume,
      result.jd_analysis,
      format,
    );
    setDownloading(null);
    if (resp.error) {
      setTailorError(resp.error);
      return;
    }
    if (resp.data) {
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = resp.filename || `resume.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [result]);

  const handleLogout = () => {
    localStorage.removeItem('job_search_token');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">Resume Tailor</h1>
            {resumeStatus?.has_resume && (
              <span className="text-xs text-muted-foreground">Resume loaded</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/job-search'}>
              Job Search
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Resume status / upload */}
        {loadingStatus ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : !resumeStatus?.has_resume ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Upload Your Resume</CardTitle>
              <p className="text-xs text-muted-foreground">Upload your base resume PDF to get started</p>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
              >
                <p className="text-sm text-muted-foreground mb-2">
                  {uploading ? 'Parsing resume...' : 'Drag & drop your resume PDF here'}
                </p>
                {!uploading && (
                  <label>
                    <Button variant="outline" size="sm" asChild>
                      <span>Or click to browse</span>
                    </Button>
                    <input type="file" accept=".pdf" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                    }} />
                  </label>
                )}
                {uploadError && <p className="text-sm text-destructive mt-2">{uploadError}</p>}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Resume Ready</p>
                    <Badge variant="secondary" className="text-[10px]">
                      {resumeStatus.experience_years || '?'} yrs exp
                    </Badge>
                  </div>
                  {resumeStatus.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{resumeStatus.summary}</p>
                  )}
                  {resumeStatus.skills && resumeStatus.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {resumeStatus.skills.slice(0, 12).map(s => (
                        <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                      ))}
                      {resumeStatus.skills.length > 12 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{resumeStatus.skills.length - 12} more
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <label className="shrink-0 ml-4">
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                    <span>{uploading ? 'Uploading...' : 'Upload New'}</span>
                  </Button>
                  <input type="file" accept=".pdf" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }} />
                </label>
              </div>
              {uploadError && <p className="text-sm text-destructive mt-2">{uploadError}</p>}
            </CardContent>
          </Card>
        )}

        {/* JD input */}
        {resumeStatus?.has_resume && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Paste Job Description</CardTitle>
              <p className="text-xs text-muted-foreground">
                Paste the full job description to tailor your resume and get ATS scores
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Paste the complete job description here..."
                value={jdText}
                onChange={e => setJdText(e.target.value)}
                rows={6}
                className="text-xs resize-none"
                maxLength={10000}
                disabled={tailoring}
              />
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={handleTailor}
                  disabled={!jdText.trim() || tailoring}
                >
                  {tailoring ? 'Tailoring...' : 'Analyze & Tailor'}
                </Button>
                <span className="text-[10px] text-muted-foreground">
                  {jdText.length.toLocaleString()}/10,000
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tailoring spinner with step indicator */}
        {tailoring && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-6 space-y-4">
                <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">
                    {tailorStep === 'jd' ? 'Analyzing job description...' : 'Tailoring your resume...'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Step {tailorStep === 'jd' ? '1' : '2'} of 2
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {tailorError && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{tailorError}</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <>
            {/* JD Analysis */}
            <JDAnalysisCard jd={result.jd_analysis} />

            {/* Download bar */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm font-medium">Download Tailored Resume</p>
                  <div className="flex gap-2 ml-auto">
                    <Button
                      size="sm"
                      onClick={() => handleDownload('pdf')}
                      disabled={downloading !== null}
                    >
                      {downloading === 'pdf' ? 'Generating...' : 'Download PDF'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload('docx')}
                      disabled={downloading !== null}
                    >
                      {downloading === 'docx' ? 'Generating...' : 'Download DOCX'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tab toggle */}
            <div className="flex gap-1 border rounded-lg p-1 w-fit">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === 'preview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Resume Preview
              </button>
              <button
                onClick={() => setActiveTab('ats')}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                  activeTab === 'ats' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                ATS Analysis
                {atsLoading && (
                  <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                )}
              </button>
            </div>

            {/* Tabbed content */}
            {activeTab === 'preview' ? (
              <ResumePreview resume={result.tailored_resume} />
            ) : result.ats_scores ? (
              <ATSPanel scores={result.ats_scores} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    {atsLoading ? (
                      <>
                        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        <div className="text-center space-y-1">
                          <p className="text-sm font-medium">Computing ATS scores</p>
                          <p className="text-xs text-muted-foreground">
                            This takes 10-15 seconds. Your resume is ready for download in the meantime.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-center space-y-2">
                          <p className="text-sm font-medium">ATS scores not yet loaded</p>
                          <p className="text-xs text-muted-foreground">
                            Click below to analyze your tailored resume against ATS systems.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={handleFetchATS}
                        >
                          Get ATS Scores
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export with auth check
// ---------------------------------------------------------------------------

export default function ResumeParser() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('job_search_token');
    if (token) {
      apiService.getResumeStatus().then(resp => {
        const isUnauthorized = resp.error && (resp.error.includes('401') || resp.error.includes('Session expired'));
        if (isUnauthorized) {
          localStorage.removeItem('job_search_token');
          setAuthed(false);
        } else {
          setAuthed(true);
        }
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!authed) {
    return <PasswordGate onAuth={() => setAuthed(true)} />;
  }

  return <Dashboard onSessionExpired={() => setAuthed(false)} />;
}

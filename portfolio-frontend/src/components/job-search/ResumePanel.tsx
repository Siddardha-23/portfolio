import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { apiService } from '@/lib/api';
import type { ParsedResume, TailoredResume } from '@/types/jobs';

export function ResumePanel() {
  const [resume, setResume] = useState<ParsedResume | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [jdText, setJdText] = useState('');
  const [tailoring, setTailoring] = useState(false);
  const [tailored, setTailored] = useState<TailoredResume | null>(null);
  const [tailorError, setTailorError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiService.getResume().then(resp => {
      if (resp.data?.resume) setResume(resp.data.resume);
      setLoading(false);
    });
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.pdf') && !name.endsWith('.docx')) {
      setError('Only PDF and DOCX files are accepted');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large (max 5 MB)');
      return;
    }
    setUploading(true);
    setError(null);
    const resp = await apiService.uploadResume(file);
    setUploading(false);
    if (resp.error) {
      setError(resp.error);
      return;
    }
    if (resp.data?.resume) setResume(resp.data.resume);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleTailor = useCallback(async () => {
    if (!jdText.trim()) return;
    setTailoring(true);
    setTailored(null);
    setTailorError('');
    setCopied(false);
    const resp = await apiService.tailorResume(jdText.trim());
    setTailoring(false);
    if (resp.error) {
      setTailorError(resp.error);
      return;
    }
    if (resp.data?.tailored) setTailored(resp.data.tailored);
  }, [jdText]);

  const formatTailoredText = (t: TailoredResume): string => {
    const lines: string[] = [];
    lines.push('PROFESSIONAL SUMMARY', t.summary, '');
    lines.push('SKILLS', t.skills.join(', '), '');
    lines.push('EXPERIENCE');
    t.experience_bullets.forEach(b => lines.push(`- ${b}`));
    lines.push('');
    if (t.keywords_to_add.length > 0) {
      lines.push('SUGGESTED KEYWORDS', t.keywords_to_add.join(', '));
    }
    return lines.join('\n');
  };

  const handleCopyTailored = useCallback(() => {
    if (!tailored) return;
    navigator.clipboard.writeText(formatTailoredText(tailored)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [tailored]);

  const handleDownload = useCallback(() => {
    if (!tailored) return;
    const text = formatTailoredText(tailored);
    let firstName = 'resume';
    let lastName = '';
    try {
      const info = JSON.parse(localStorage.getItem('visitorInfo') || '{}');
      if (info.firstName) firstName = info.firstName;
      if (info.lastName) lastName = info.lastName;
    } catch { /* ignore */ }
    const cleanPart = (s: string) => s.replace(/[^a-zA-Z0-9 ]+/g, ' ').trim().replace(/\s+/g, '_');
    const parts = [cleanPart(firstName), cleanPart(lastName), 'Tailored'].filter(Boolean);
    const filename = `${parts.join('_')}.txt`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [tailored]);

  if (loading) {
    return <p className="text-center text-muted-foreground py-12">Loading resume...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
      >
        <p className="text-sm text-muted-foreground mb-2">
          {uploading ? 'Parsing resume...' : 'Drag & drop your resume PDF or DOCX here'}
        </p>
        {!uploading && (
          <label>
            <Button variant="outline" size="sm" asChild>
              <span>Or click to browse</span>
            </Button>
            <input type="file" accept=".pdf,.docx" className="hidden" onChange={onFileSelect} />
          </label>
        )}
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      </div>

      {/* Parsed resume display */}
      {resume && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {resume.skills.map(skill => (
                  <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Experience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-sm">{resume.experience_years} years</p>
              {resume.job_titles.map((title, i) => (
                <p key={i} className="text-xs text-muted-foreground">{title}</p>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Education</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {resume.education.map((edu, i) => (
                <p key={i} className="text-xs">
                  <span className="font-medium">{edu.degree}</span> - {edu.institution} ({edu.year})
                </p>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Certifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {resume.certifications.length > 0 ? (
                resume.certifications.map((cert, i) => (
                  <p key={i} className="text-xs">{cert}</p>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">None listed</p>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{resume.summary}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tailor Resume Section */}
      {resume && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tailor Resume to Job Description</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Paste a job description here to tailor your resume..."
              value={jdText}
              onChange={e => setJdText(e.target.value)}
              rows={5}
              className="text-xs resize-none"
              maxLength={6000}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleTailor}
                disabled={!jdText.trim() || tailoring}
              >
                {tailoring ? 'Tailoring...' : 'Tailor My Resume'}
              </Button>
              <span className="text-[10px] text-muted-foreground">
                {jdText.length}/6000
              </span>
            </div>

            {tailoring && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}

            {tailorError && <p className="text-sm text-destructive">{tailorError}</p>}

            {tailored && (
              <div className="space-y-3 pt-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs">Tailored Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{tailored.summary}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs">Skills (reordered)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {tailored.skills.map(skill => (
                        <Badge key={skill} variant="secondary" className="text-[10px]">{skill}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs">Experience Bullets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {tailored.experience_bullets.map((bullet, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                          <span className="text-primary mt-0.5">-</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {tailored.keywords_to_add.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs">Suggested Keywords</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1.5">
                        {tailored.keywords_to_add.map(kw => (
                          <Badge key={kw} variant="outline" className="text-[10px]">{kw}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleDownload}>
                    Download
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCopyTailored}>
                    {copied ? 'Copied!' : 'Copy All'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Filename helpers — mirror the backend's `ResumeRenderer.build_filename` and
 * `build_cover_letter_filename` so anything we download client-side uses the
 * same ATS-friendly convention as anything the backend renders for us.
 *
 *   Resume:        Firstname_Lastname_JobTitle.{ext}
 *   Cover letter:  Firstname_Lastname_JobTitle_Cover_Letter.{ext}
 */

function clean(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildResumeFilename(name: string, jobTitle: string, ext = 'pdf'): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  const first = parts[0] || 'Resume';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const segments = [clean(first), clean(last), clean(jobTitle || '')].filter(Boolean);
  return segments.join('_') + '.' + ext;
}

export function buildCoverLetterFilename(name: string, jobTitle: string, ext = 'pdf'): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  const first = parts[0] || 'Applicant';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const segments = [clean(first), clean(last), clean(jobTitle || ''), 'Cover_Letter'].filter(Boolean);
  return segments.join('_') + '.' + ext;
}

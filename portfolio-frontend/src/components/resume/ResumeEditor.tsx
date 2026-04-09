import { useState, useCallback, useMemo, useEffect } from 'react';
import type { TailoredFullResume, ResumeExperience, ResumeEducation, ResumeProject, JDAnalysis } from '@/types/resume';
import { apiService } from '@/lib/api';
import { toast } from 'sonner';

// ─── Icons ─────────────────────────────────────────────────────────────────
function PencilIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>);
}
function PlusIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>);
}
function TrashIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>);
}
function ChevronUpIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>);
}
function ChevronDownIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>);
}
function DocumentArrowDownIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>);
}
function ArrowLeftIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>);
}
function EyeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
}

// ─── Shared input styling ──────────────────────────────────────────────────
const inputCls = "w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-200 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/60 text-sm text-gray-800 dark:text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500/30 transition-all";
const textareaCls = `${inputCls} resize-none leading-relaxed`;
const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1.5";
const sectionHeaderCls = "flex items-center gap-3 mb-3";
const sectionTitleCls = "text-xs font-bold uppercase tracking-widest text-pink-400/80";
const addBtnCls = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-pink-400 border border-pink-500/20 hover:bg-pink-500/10 transition-all";
const removeBtnCls = "p-1 rounded-md text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all";

// ─── Section Header ────────────────────────────────────────────────────────
function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className={sectionHeaderCls}>
      <h3 className={sectionTitleCls}>{title}</h3>
      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
      {children}
    </div>
  );
}

// ─── Collapsible section wrapper ───────────────────────────────────────────
function CollapsibleSection({ title, defaultOpen = true, children, actions }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode; actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800/60 bg-gray-50 dark:bg-gray-900/40">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-200 dark:bg-gray-800/20 transition-colors rounded-t-lg">
        <span className={sectionTitleCls}>{title}</span>
        <div className="flex items-center gap-2">
          {actions && <div onClick={e => e.stopPropagation()}>{actions}</div>}
          {open ? <ChevronUpIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" /> : <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />}
        </div>
      </button>
      {open && <div className="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-800/40 pt-3">{children}</div>}
    </div>
  );
}

// ─── Live Preview (right pane) ─────────────────────────────────────────────
function LivePreview({ resume }: { resume: TailoredFullResume }) {
  const ST = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-2 mb-2"><h3 className="text-xs font-bold uppercase tracking-widest text-pink-400/70">{children}</h3><div className="flex-1 h-px bg-gray-200 dark:bg-gray-800/60" /></div>
  );
  return (
    <div className="text-xs leading-relaxed">
      {/* Contact header */}
      <div className="text-center mb-3 pb-2 border-b border-gray-200 dark:border-gray-800/60">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">{resume.contact?.name || 'Your Name'}</h2>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">
          {[resume.contact?.phone, resume.contact?.email, resume.contact?.linkedin, resume.contact?.github]
            .filter(Boolean).join('  |  ')}
        </p>
      </div>

      <div className="space-y-2.5">
        {resume.summary && (
          <div><ST>Summary</ST><p className="text-gray-700 dark:text-gray-300">{resume.summary}</p></div>
        )}

        {resume.experience?.length > 0 && (
          <div><ST>Experience</ST>
            <div className="space-y-2">
              {resume.experience.map((exp, i) => (
                <div key={i}>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{exp.company}</span>
                      {exp.location ? <span className="text-gray-400 dark:text-gray-500">, {exp.location}</span> : null}
                      {exp.title && <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 italic"> &mdash; {exp.title}</span>}
                    </div>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">{exp.dates}</span>
                  </div>
                  <ul className="mt-1 space-y-0.5 ml-3">
                    {exp.bullets?.map((b, j) => (
                      <li key={j} className="text-gray-400 dark:text-gray-500 dark:text-gray-400 flex gap-1.5">
                        <span className="text-pink-500/40 shrink-0">&bull;</span><span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {resume.projects?.length > 0 && (
          <div><ST>Projects</ST>
            <div className="space-y-2">
              {resume.projects.map((p, i) => (
                <div key={i}>
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{p.name}</span>
                    {p.dates && <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">{p.dates}</span>}
                  </div>
                  {p.tech && <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">{p.tech}</p>}
                  <ul className="mt-0.5 space-y-0.5 ml-3">
                    {p.bullets?.map((b, j) => (
                      <li key={j} className="text-gray-400 dark:text-gray-500 dark:text-gray-400 flex gap-1.5">
                        <span className="text-pink-500/40 shrink-0">&bull;</span><span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {resume.skills && Object.keys(resume.skills).length > 0 && (
          <div><ST>Technical Skills</ST>
            <div className="space-y-1">
              {Object.entries(resume.skills).map(([c, s]) => (
                <div key={c}>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{c}: </span>
                  <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400">{Array.isArray(s) ? s.join(', ') : String(s)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {resume.education?.length > 0 && (
          <div><ST>Education</ST>
            <div className="space-y-1.5">
              {resume.education.map((edu, i) => (
                <div key={i} className="flex justify-between items-start gap-2">
                  <div>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{edu.institution}</span>
                    {edu.degree && <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400"> &mdash; {edu.degree}</span>}
                    {edu.gpa && <span className="text-gray-400 dark:text-gray-500"> (GPA: {edu.gpa})</span>}
                  </div>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">{edu.dates}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Editor Component ─────────────────────────────────────────────────
interface ResumeEditorProps {
  resume: TailoredFullResume;
  jdAnalysis?: JDAnalysis;
  onBack: () => void;
}

export default function ResumeEditor({ resume: initialResume, jdAnalysis, onBack }: ResumeEditorProps) {
  const [resume, setResume] = useState<TailoredFullResume>(() => JSON.parse(JSON.stringify(initialResume)));
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | null>(null);
  const [view, setView] = useState<'split' | 'edit' | 'preview'>('split');
  const [rewritingBullet, setRewritingBullet] = useState<string | null>(null); // "exp-0-1" format

  // Auto-switch to edit mode on mobile
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    if (mq.matches && view === 'split') setView('edit');
  }, []);

  // Check if modified
  const isModified = useMemo(() => {
    return JSON.stringify(resume) !== JSON.stringify(initialResume);
  }, [resume, initialResume]);

  // Unsaved changes warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isModified) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isModified]);

  const handleBack = useCallback(() => {
    if (isModified && !window.confirm('You have unsaved changes. Leave anyway?')) return;
    onBack();
  }, [isModified, onBack]);

  // ─── Update helpers ────────────────────────────────────────────────────
  const updateContact = useCallback((field: string, value: string) => {
    setResume(prev => ({ ...prev, contact: { ...prev.contact, [field]: value } }));
  }, []);

  const updateSummary = useCallback((value: string) => {
    setResume(prev => ({ ...prev, summary: value }));
  }, []);

  const updateExperience = useCallback((index: number, field: keyof ResumeExperience, value: any) => {
    setResume(prev => {
      const exp = [...prev.experience];
      exp[index] = { ...exp[index], [field]: value };
      return { ...prev, experience: exp };
    });
  }, []);

  const updateBullet = useCallback((section: 'experience' | 'projects', index: number, bulletIdx: number, value: string) => {
    setResume(prev => {
      const items = [...(prev[section] as any[])];
      const item = { ...items[index] };
      const bullets = [...item.bullets];
      bullets[bulletIdx] = value;
      item.bullets = bullets;
      items[index] = item;
      return { ...prev, [section]: items };
    });
  }, []);

  const addBullet = useCallback((section: 'experience' | 'projects', index: number) => {
    setResume(prev => {
      const items = [...(prev[section] as any[])];
      const item = { ...items[index] };
      item.bullets = [...item.bullets, ''];
      items[index] = item;
      return { ...prev, [section]: items };
    });
  }, []);

  const removeBullet = useCallback((section: 'experience' | 'projects', index: number, bulletIdx: number) => {
    setResume(prev => {
      const items = [...(prev[section] as any[])];
      const item = { ...items[index] };
      item.bullets = item.bullets.filter((_: any, i: number) => i !== bulletIdx);
      items[index] = item;
      return { ...prev, [section]: items };
    });
  }, []);

  const addExperience = useCallback(() => {
    setResume(prev => ({
      ...prev,
      experience: [...prev.experience, { title: '', company: '', location: '', dates: '', type: '', bullets: [''] }],
    }));
  }, []);

  const removeExperience = useCallback((index: number) => {
    setResume(prev => ({ ...prev, experience: prev.experience.filter((_, i) => i !== index) }));
  }, []);

  const updateProject = useCallback((index: number, field: keyof ResumeProject, value: any) => {
    setResume(prev => {
      const projects = [...prev.projects];
      projects[index] = { ...projects[index], [field]: value };
      return { ...prev, projects };
    });
  }, []);

  const addProject = useCallback(() => {
    setResume(prev => ({
      ...prev,
      projects: [...prev.projects, { name: '', dates: '', bullets: [''], tech: '' }],
    }));
  }, []);

  const removeProject = useCallback((index: number) => {
    setResume(prev => ({ ...prev, projects: prev.projects.filter((_, i) => i !== index) }));
  }, []);

  const updateEducation = useCallback((index: number, field: keyof ResumeEducation, value: string) => {
    setResume(prev => {
      const edu = [...prev.education];
      edu[index] = { ...edu[index], [field]: value };
      return { ...prev, education: edu };
    });
  }, []);

  const addEducation = useCallback(() => {
    setResume(prev => ({
      ...prev,
      education: [...prev.education, { degree: '', institution: '', location: '', dates: '', gpa: '', coursework: '' }],
    }));
  }, []);

  const removeEducation = useCallback((index: number) => {
    setResume(prev => ({ ...prev, education: prev.education.filter((_, i) => i !== index) }));
  }, []);

  // Reorder items (move up/down)
  const moveItem = useCallback((section: 'experience' | 'projects' | 'education', from: number, to: number) => {
    setResume(prev => {
      const items = [...(prev[section] as any[])];
      const [item] = items.splice(from, 1);
      items.splice(to, 0, item);
      return { ...prev, [section]: items };
    });
  }, []);

  // Rewrite a single bullet via AI
  const handleRewriteBullet = useCallback(async (section: 'experience' | 'projects', index: number, bulletIdx: number) => {
    const key = `${section}-${index}-${bulletIdx}`;
    const items = resume[section] as any[];
    const bullet = items[index]?.bullets?.[bulletIdx];
    if (!bullet || rewritingBullet) return;

    setRewritingBullet(key);
    const resp = await apiService.rewriteBullet(
      bullet,
      jdAnalysis?.job_title,
      jdAnalysis?.company,
      [...(jdAnalysis?.required_skills || []), ...(jdAnalysis?.keywords || [])].slice(0, 20),
    );
    setRewritingBullet(null);

    if (resp.data?.rewritten) {
      updateBullet(section, index, bulletIdx, resp.data.rewritten);
      toast.success('Bullet rewritten');
    } else {
      toast.error('Rewrite failed', { description: resp.error || 'Please try again' });
    }
  }, [resume, rewritingBullet, jdAnalysis, updateBullet]);

  // Skills editing
  const updateSkillCategory = useCallback((oldKey: string, newKey: string) => {
    setResume(prev => {
      const skills = { ...prev.skills };
      if (oldKey !== newKey) {
        const entries = Object.entries(skills);
        const newSkills: Record<string, string[]> = {};
        for (const [k, v] of entries) {
          newSkills[k === oldKey ? newKey : k] = v;
        }
        return { ...prev, skills: newSkills };
      }
      return prev;
    });
  }, []);

  const updateSkills = useCallback((category: string, skills: string[]) => {
    setResume(prev => ({ ...prev, skills: { ...prev.skills, [category]: skills } }));
  }, []);

  const addSkillCategory = useCallback(() => {
    setResume(prev => ({ ...prev, skills: { ...prev.skills, 'New Category': [] } }));
  }, []);

  const removeSkillCategory = useCallback((category: string) => {
    setResume(prev => {
      const skills = { ...prev.skills };
      delete skills[category];
      return { ...prev, skills };
    });
  }, []);

  // Download
  const handleDownload = useCallback(async (fmt: 'pdf' | 'docx') => {
    setDownloading(fmt);
    const r = await apiService.downloadTailoredResume(resume, jdAnalysis || {} as JDAnalysis, fmt);
    setDownloading(null);
    if (r.error) { toast.error('Download failed', { description: r.error }); return; }
    if (r.data) {
      const u = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = u;
      a.download = r.filename || `resume.${fmt}`;
      a.click();
      URL.revokeObjectURL(u);
      toast.success(`Resume downloaded as ${fmt.toUpperCase()}`);
    }
  }, [resume, jdAnalysis]);

  // Reset to original
  const handleReset = useCallback(() => {
    setResume(JSON.parse(JSON.stringify(initialResume)));
  }, [initialResume]);

  // ─── Editor form ───────────────────────────────────────────────────────
  const editorPanel = (
    <div className="space-y-4 p-4 overflow-y-auto h-full">
      {/* Contact */}
      <CollapsibleSection title="Contact">
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Full Name</label><input className={inputCls} value={resume.contact?.name || ''} onChange={e => updateContact('name', e.target.value)} placeholder="John Doe" /></div>
          <div><label className={labelCls}>Email</label><input className={inputCls} value={resume.contact?.email || ''} onChange={e => updateContact('email', e.target.value)} placeholder="john@email.com" /></div>
          <div><label className={labelCls}>Phone</label><input className={inputCls} value={resume.contact?.phone || ''} onChange={e => updateContact('phone', e.target.value)} placeholder="(123) 456-7890" /></div>
          <div><label className={labelCls}>LinkedIn</label><input className={inputCls} value={resume.contact?.linkedin || ''} onChange={e => updateContact('linkedin', e.target.value)} placeholder="linkedin.com/in/..." /></div>
          <div className="col-span-2"><label className={labelCls}>GitHub</label><input className={inputCls} value={resume.contact?.github || ''} onChange={e => updateContact('github', e.target.value)} placeholder="github.com/..." /></div>
        </div>
      </CollapsibleSection>

      {/* Summary */}
      <CollapsibleSection title="Summary">
        <textarea className={textareaCls} rows={3} value={resume.summary || ''} onChange={e => updateSummary(e.target.value)} placeholder="Professional summary..." />
      </CollapsibleSection>

      {/* Experience */}
      <CollapsibleSection title="Experience" actions={<button type="button" className={addBtnCls} onClick={addExperience}><PlusIcon className="w-3 h-3" />Add</button>}>
        {resume.experience?.map((exp, i) => (
          <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-800/40 bg-gray-50/50 dark:bg-gray-900/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{exp.company || exp.title || `Experience ${i + 1}`}</span>
              <div className="flex items-center gap-0.5">
                <button type="button" className={removeBtnCls} disabled={i === 0} onClick={() => moveItem('experience', i, i - 1)}><ChevronUpIcon className="w-3.5 h-3.5" /></button>
                <button type="button" className={removeBtnCls} disabled={i === resume.experience.length - 1} onClick={() => moveItem('experience', i, i + 1)}><ChevronDownIcon className="w-3.5 h-3.5" /></button>
                <button type="button" className={removeBtnCls} onClick={() => removeExperience(i)}><TrashIcon className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>Job Title</label><input className={inputCls} value={exp.title} onChange={e => updateExperience(i, 'title', e.target.value)} /></div>
              <div><label className={labelCls}>Company</label><input className={inputCls} value={exp.company} onChange={e => updateExperience(i, 'company', e.target.value)} /></div>
              <div><label className={labelCls}>Location</label><input className={inputCls} value={exp.location} onChange={e => updateExperience(i, 'location', e.target.value)} /></div>
              <div><label className={labelCls}>Dates</label><input className={inputCls} value={exp.dates} onChange={e => updateExperience(i, 'dates', e.target.value)} /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelCls}>Bullets</label>
                <button type="button" className="text-[11px] text-pink-400 hover:text-pink-300" onClick={() => addBullet('experience', i)}>+ Add bullet</button>
              </div>
              <div className="space-y-1.5">
                {exp.bullets?.map((bullet, j) => (
                  <div key={j} className="flex gap-1.5 items-start">
                    <span className="text-pink-500/40 mt-2.5 shrink-0 text-xs">&bull;</span>
                    <textarea className={`${textareaCls} text-xs`} rows={2} value={bullet} onChange={e => updateBullet('experience', i, j, e.target.value)} />
                    <button type="button" title="AI Rewrite" disabled={rewritingBullet !== null}
                      className={`${removeBtnCls} mt-1.5 ${rewritingBullet === `experience-${i}-${j}` ? 'animate-spin' : ''} hover:!text-pink-400`}
                      onClick={() => handleRewriteBullet('experience', i, j)}>
                      {rewritingBullet === `experience-${i}-${j}` ? <span className="w-3 h-3 rounded-full border-2 border-pink-400 border-t-transparent animate-spin" /> : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>}
                    </button>
                    <button type="button" className={`${removeBtnCls} mt-1.5`} onClick={() => removeBullet('experience', i, j)}><TrashIcon className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </CollapsibleSection>

      {/* Projects */}
      <CollapsibleSection title="Projects" actions={<button type="button" className={addBtnCls} onClick={addProject}><PlusIcon className="w-3 h-3" />Add</button>}>
        {resume.projects?.map((proj, i) => (
          <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-800/40 bg-gray-50/50 dark:bg-gray-900/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{proj.name || `Project ${i + 1}`}</span>
              <div className="flex items-center gap-0.5">
                <button type="button" className={removeBtnCls} disabled={i === 0} onClick={() => moveItem('projects', i, i - 1)}><ChevronUpIcon className="w-3.5 h-3.5" /></button>
                <button type="button" className={removeBtnCls} disabled={i === resume.projects.length - 1} onClick={() => moveItem('projects', i, i + 1)}><ChevronDownIcon className="w-3.5 h-3.5" /></button>
                <button type="button" className={removeBtnCls} onClick={() => removeProject(i)}><TrashIcon className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>Name</label><input className={inputCls} value={proj.name} onChange={e => updateProject(i, 'name', e.target.value)} /></div>
              <div><label className={labelCls}>Dates</label><input className={inputCls} value={proj.dates} onChange={e => updateProject(i, 'dates', e.target.value)} /></div>
              <div className="col-span-2"><label className={labelCls}>Technologies</label><input className={inputCls} value={proj.tech} onChange={e => updateProject(i, 'tech', e.target.value)} /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelCls}>Bullets</label>
                <button type="button" className="text-[11px] text-pink-400 hover:text-pink-300" onClick={() => addBullet('projects', i)}>+ Add bullet</button>
              </div>
              <div className="space-y-1.5">
                {proj.bullets?.map((bullet, j) => (
                  <div key={j} className="flex gap-1.5 items-start">
                    <span className="text-pink-500/40 mt-2.5 shrink-0 text-xs">&bull;</span>
                    <textarea className={`${textareaCls} text-xs`} rows={2} value={bullet} onChange={e => updateBullet('projects', i, j, e.target.value)} />
                    <button type="button" title="AI Rewrite" disabled={rewritingBullet !== null}
                      className={`${removeBtnCls} mt-1.5 hover:!text-pink-400`}
                      onClick={() => handleRewriteBullet('projects', i, j)}>
                      {rewritingBullet === `projects-${i}-${j}` ? <span className="w-3 h-3 rounded-full border-2 border-pink-400 border-t-transparent animate-spin" /> : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>}
                    </button>
                    <button type="button" className={`${removeBtnCls} mt-1.5`} onClick={() => removeBullet('projects', i, j)}><TrashIcon className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </CollapsibleSection>

      {/* Skills */}
      <CollapsibleSection title="Skills" actions={<button type="button" className={addBtnCls} onClick={addSkillCategory}><PlusIcon className="w-3 h-3" />Add Category</button>}>
        {Object.entries(resume.skills || {}).map(([category, skills]) => (
          <div key={category} className="rounded-lg border border-gray-200 dark:border-gray-800/40 bg-gray-50/50 dark:bg-gray-900/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input className={`${inputCls} text-xs font-semibold`} defaultValue={category}
                onBlur={e => { if (e.target.value && e.target.value !== category) updateSkillCategory(category, e.target.value); }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
              <button type="button" className={removeBtnCls} onClick={() => removeSkillCategory(category)}><TrashIcon className="w-3.5 h-3.5" /></button>
            </div>
            <div>
              <textarea className={`${textareaCls} text-xs`} rows={2}
                value={Array.isArray(skills) ? skills.join(', ') : ''}
                onChange={e => updateSkills(category, e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="Skill1, Skill2, Skill3..."
              />
              <p className="text-[11px] text-gray-600 mt-1">Comma-separated skills</p>
            </div>
          </div>
        ))}
      </CollapsibleSection>

      {/* Education */}
      <CollapsibleSection title="Education" actions={<button type="button" className={addBtnCls} onClick={addEducation}><PlusIcon className="w-3 h-3" />Add</button>}>
        {resume.education?.map((edu, i) => (
          <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-800/40 bg-gray-50/50 dark:bg-gray-900/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{edu.institution || `Education ${i + 1}`}</span>
              <div className="flex items-center gap-0.5">
                <button type="button" className={removeBtnCls} disabled={i === 0} onClick={() => moveItem('education', i, i - 1)}><ChevronUpIcon className="w-3.5 h-3.5" /></button>
                <button type="button" className={removeBtnCls} disabled={i === resume.education.length - 1} onClick={() => moveItem('education', i, i + 1)}><ChevronDownIcon className="w-3.5 h-3.5" /></button>
                <button type="button" className={removeBtnCls} onClick={() => removeEducation(i)}><TrashIcon className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>Institution</label><input className={inputCls} value={edu.institution} onChange={e => updateEducation(i, 'institution', e.target.value)} /></div>
              <div><label className={labelCls}>Degree</label><input className={inputCls} value={edu.degree} onChange={e => updateEducation(i, 'degree', e.target.value)} /></div>
              <div><label className={labelCls}>Location</label><input className={inputCls} value={edu.location} onChange={e => updateEducation(i, 'location', e.target.value)} /></div>
              <div><label className={labelCls}>Dates</label><input className={inputCls} value={edu.dates} onChange={e => updateEducation(i, 'dates', e.target.value)} /></div>
              <div><label className={labelCls}>GPA</label><input className={inputCls} value={edu.gpa} onChange={e => updateEducation(i, 'gpa', e.target.value)} /></div>
              <div><label className={labelCls}>Coursework</label><input className={inputCls} value={edu.coursework} onChange={e => updateEducation(i, 'coursework', e.target.value)} /></div>
            </div>
          </div>
        ))}
      </CollapsibleSection>
    </div>
  );

  const previewPanel = (
    <div className="p-4 overflow-y-auto h-full">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.02] p-5">
        <LivePreview resume={resume} />
      </div>
    </div>
  );

  return (
    <div className="space-y-0">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800/60 px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:bg-gray-800/60 transition-all">
              <ArrowLeftIcon className="w-4 h-4" />Back
            </button>
            <div className="h-5 w-px bg-gray-200 dark:bg-gray-800" />
            <div className="flex items-center gap-2">
              <PencilIcon className="w-4 h-4 text-pink-400" />
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Resume Editor</span>
            </div>
            {isModified && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Modified</span>}
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="inline-flex rounded-lg bg-gray-200 dark:bg-gray-800/60 p-0.5 border border-gray-200 dark:border-gray-800">
              {[
                { key: 'split' as const, label: 'Split' },
                { key: 'edit' as const, label: 'Edit' },
                { key: 'preview' as const, label: 'Preview' },
              ].map(v => (
                <button key={v.key} type="button" onClick={() => setView(v.key)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${v.key === 'split' ? 'hidden md:inline-block' : ''} ${view === v.key ? 'bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}>
                  {v.label}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-gray-200 dark:bg-gray-800" />

            {isModified && (
              <button type="button" onClick={handleReset}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 dark:text-gray-500 dark:text-gray-400 border border-gray-700 hover:border-gray-600 hover:text-gray-700 dark:text-gray-300 transition-all">
                Reset
              </button>
            )}

            <button type="button" onClick={() => handleDownload('pdf')} disabled={downloading !== null}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-400 dark:text-gray-500 disabled:cursor-not-allowed shadow-lg shadow-pink-500/15 disabled:shadow-none transition-all duration-200">
              <DocumentArrowDownIcon className="w-4 h-4" />
              {downloading === 'pdf' ? 'Generating...' : 'Download PDF'}
            </button>
            <button type="button" onClick={() => handleDownload('docx')} disabled={downloading !== null}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 border border-gray-700 hover:border-gray-600 hover:text-gray-800 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
              <DocumentArrowDownIcon className="w-3.5 h-3.5" />
              {downloading === 'docx' ? '...' : 'DOCX'}
            </button>
          </div>
        </div>
      </div>

      {/* Split / Edit / Preview */}
      <div className="h-[calc(100vh-10rem)]">
        {view === 'split' && (
          <div className="flex flex-col md:flex-row h-full">
            <div className="w-full md:w-1/2 h-1/2 md:h-full border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800/60 overflow-y-auto">
              {editorPanel}
            </div>
            <div className="w-full md:w-1/2 h-1/2 md:h-full overflow-y-auto">
              {previewPanel}
            </div>
          </div>
        )}
        {view === 'edit' && (
          <div className="h-full overflow-y-auto">
            {editorPanel}
          </div>
        )}
        {view === 'preview' && (
          <div className="h-full overflow-y-auto">
            {previewPanel}
          </div>
        )}
      </div>
    </div>
  );
}

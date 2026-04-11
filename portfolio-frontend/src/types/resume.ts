export interface ResumeContact {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
}

export interface ResumeExperience {
  title: string;
  company: string;
  location: string;
  dates: string;
  type: string;
  bullets: string[];
}

export interface ResumeEducation {
  degree: string;
  institution: string;
  location: string;
  dates: string;
  gpa: string;
  coursework: string;
}

export interface ResumeProject {
  name: string;
  dates: string;
  bullets: string[];
  tech: string;
}

export interface TailoredFullResume {
  contact: ResumeContact;
  summary: string;
  skills: Record<string, string[]>;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  certifications: string[];
  projects: ResumeProject[];
}

export interface JDAnalysis {
  job_title: string;
  company: string;
  location: string;
  employment_type: string;
  required_skills: string[];
  preferred_skills: string[];
  responsibilities: string[];
  qualifications: string[];
  experience_years: string;
  industry: string;
  keywords: string[];
}

export interface ATSScannerScores {
  workday: number;
  greenhouse: number;
  lever: number;
  icims: number;
  taleo: number;
  smartrecruiters: number;
}

export interface AIScreenerScores {
  overall: number;
  relevance: number;
  seniority_fit: number;
  culture_fit: number;
}

export interface ATSScores {
  overall: number;
  keyword_match: number;
  keyword_frequency: number;
  skills_alignment: number;
  experience_relevance: number;
  quantifiable_impact: number;
  bullet_quality: number;
  format_score: number;
  section_completeness: number;
  scanners: ATSScannerScores;
  ai_screener: AIScreenerScores;
  suggestions: string[];
  missing_keywords: string[];
  strengths: string[];
}

export interface TailorPipelineResult {
  jd_analysis: JDAnalysis;
  tailored_resume: TailoredFullResume;
  ats_scores?: ATSScores;
}

export interface ResumeStatus {
  has_resume: boolean;
  has_base_file?: boolean;
  skills?: string[];
  experience_years?: number;
  job_titles?: string[];
  summary?: string;
  parsed_at?: string;
}

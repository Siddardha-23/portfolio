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

export interface ATSKeywordAudit {
  matched: string[];
  missing: string[];
  partial: string[];
  coverage_percentage: number;
  required_missing: string[];
  required_coverage: number;
}

export interface TailoredFullResume {
  contact: ResumeContact;
  summary: string;
  skills: Record<string, string[]>;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  certifications: string[];
  projects: ResumeProject[];
  target_role?: string;
  ats_keyword_audit?: ATSKeywordAudit;
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

// ─── Tailoring record + versioning types ──────────────────────────────────
export type VersionSource = "initial" | "regenerated" | "edited";

export interface TailoringVersion {
  version_id: string;
  version_number: number;
  source: VersionSource;
  parent_version_id?: string | null;
  content_hash: string;
  created_at: string;
  ats_scores?: { overall?: number } | null;
  user_feedback?: string | null;
  tailored_resume?: TailoredFullResume;
  files?: Record<
    string,
    {
      s3_key?: string;
      filename?: string;
      size_bytes?: number;
      rendered_at?: string;
      content_hash?: string;
    } | null
  >;
}

export type ApplicationStatus =
  | "draft"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn"
  | "ghosted";

export interface ApplicationInfo {
  status?: ApplicationStatus;
  applied_at?: string | null;
  next_action_date?: string | null;
  next_action_note?: string;
  notes?: string;
  recruiter_name?: string;
  recruiter_email?: string;
  recruiter_company?: string;
  job_url?: string;
  interview_dates?: string[];
  updated_at?: string;
}

export type QDifficulty = "easy" | "medium" | "hard";
export type RoleType =
  | "coding"
  | "data"
  | "devops"
  | "design"
  | "pm"
  | "business"
  | "research"
  | "generic";

export interface InterviewPrepQuestion {
  question: string;
  why_asked?: string;
  answer_outline?: string;
  difficulty?: QDifficulty;
}

export interface RedFlagItem {
  question: string;
  answer_outline?: string;
  defense?: string;
  difficulty?: QDifficulty;
}

export interface CodingProblem {
  title: string;
  difficulty?: QDifficulty;
  problem_statement: string;
  constraints?: string[];
  examples?: { input: string; output: string; explanation?: string }[];
  hints?: string[];
  approach?: string;
  complexity?: string;
  skill_tags?: string[];
}

export interface CaseStudy {
  title: string;
  difficulty?: QDifficulty;
  scenario: string;
  subtasks?: string[];
  evaluation_criteria?: string[];
  hints?: string[];
}

export interface SystemDesignPrompt {
  title: string;
  difficulty?: QDifficulty;
  scope: string;
  requirements?: string[];
  suggested_components?: string[];
  discussion_points?: string[];
}

export interface DataChallenge {
  title: string;
  difficulty?: QDifficulty;
  scenario: string;
  deliverable?: string;
  hints?: string[];
}

export interface InterviewPrepContent {
  role_type?: RoleType;
  elevator_pitch?: string;
  talking_points?: string[];
  behavioral_questions?: InterviewPrepQuestion[];
  technical_questions?: InterviewPrepQuestion[];
  company_specific?: InterviewPrepQuestion[];
  coding_problems?: CodingProblem[];
  case_studies?: CaseStudy[];
  system_design_prompts?: SystemDesignPrompt[];
  data_challenges?: DataChallenge[];
  gaps_to_address?: string[];
  questions_to_ask_them?: string[];
  red_flags?: (RedFlagItem | string)[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  at?: string;
}

export interface MockEvaluation {
  score: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
  missing_points: string[];
  model_answer: string;
}

export interface InterviewPrepPack {
  content?: InterviewPrepContent;
  generated_at?: string;
  grounded_version_id?: string;
}

export interface TailoringRecord {
  record_id: string;
  user_email: string;
  jd_text?: string;
  jd_analysis?: {
    job_title?: string;
    company?: string;
    required_skills?: string[];
    keywords?: string[];
    location?: string;
    seniority?: string;
  };
  base_resume_filename?: string;
  base_resume_s3_key?: string;
  ats_scores?: { overall?: number } | null;
  created_at: string;
  updated_at?: string;
  current_version_id?: string;
  versions?: TailoringVersion[];
  application?: ApplicationInfo;
  interview_prep?: InterviewPrepPack;
}

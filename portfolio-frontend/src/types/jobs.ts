export interface Job {
  job_id: string;
  title: string;
  company: string;
  logo: string;
  location: string;
  apply_link: string;
  description: string;
  salary: string;
  employment_type: string;
  date_posted: string;
  is_remote: boolean;
  h1b_sponsor: boolean;
  contract_friendly?: boolean;
  source?: string;
  posted_text?: string;
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
}

export interface SavedJob {
  _id: string;
  job_id: string;
  job_data: Job;
  status: 'interested' | 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn';
  notes: string;
  saved_at: string;
}

export interface ParsedResume {
  skills: string[];
  experience_years: number;
  education: Array<{ degree: string; institution: string; year: string }>;
  certifications: string[];
  job_titles: string[];
  summary: string;
  parsed_at: string;
}

export interface TailoredResume {
  summary: string;
  skills: string[];
  experience_bullets: string[];
  keywords_to_add: string[];
}

export interface JobSearchFilters {
  query: string;
  location: string;
  date_posted: 'all' | 'today' | '3days' | 'week' | 'month';
  remote_only: boolean;
  employment_type: '' | 'FULLTIME' | 'PARTTIME' | 'INTERN' | 'CONTRACTOR';
  h1b_only: boolean;
  visa_or_contract: boolean;
  experience_level: '' | 'entry' | 'internship' | 'associate' | 'mid';
  source: 'all' | 'linkedin' | 'indeed' | 'google' | 'company' | 'jobright';
  include_company_careers: boolean;
  use_resume_recommendations: boolean;
}

export interface SavedJobFilters {
  filters: JobSearchFilters | null;
  updated_at?: string;
}

export interface JobSearchResponse {
  jobs: Job[];
  total: number;
  page: number;
  errors?: string[];
  fallback_source?: string;
}

export interface BatchSearchParams {
  queries: string[];
  location?: string;
  date_posted?: string;
  remote?: boolean;
  type?: string;
  h1b_only?: boolean;
  visa_or_contract?: boolean;
  experience_level?: string;
  source?: string;
  include_company_careers?: boolean;
  use_resume_recommendations?: boolean;
}

export interface BatchSearchResponse {
  jobs: Job[];
  total: number;
  queries_executed: number;
  cache_hits: number;
  errors: string[];
}

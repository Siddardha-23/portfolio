export type VisaStatus = 'sponsor_verified' | 'likely_sponsor' | 'no_sponsorship' | 'unknown';

export interface DailyPipelineRecord {
  source: string;
  company: string;
  title: string;
  location: string;
  posted: string;
  salary: string;
  applicants?: string | number;
  url: string;
  description?: string;
  score?: number;
  tier?: 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Skip';
  flags?: string;
  roles?: string;
  opt?: string;
  reason?: string;
  /** Visa-sponsorship signal. Useful for F-1 / H-1B candidates. */
  visa_status?: VisaStatus;
  /** Calibrated sponsorship probability (0.0–1.0). Backend layers this on
   *  top of visa_status so the badge can show "Likely sponsor 62%" instead
   *  of a binary verdict. Older payloads may omit this — UI falls back to
   *  the discrete status label. */
  visa_confidence?: number;
  /**
   * Set when the user already engaged with this exact (company, title) via
   * the saved-jobs flow. `interested` = clicked Open but didn't confirm
   * Applied. `applied` / `interview` / `offer` = actively in funnel.
   * `rejected` / `withdrawn` = closed loop. UI uses this to render an
   * "Already applied" badge and to demote in the bulk-open shortlist.
   */
  previously_applied_status?: 'interested' | 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn';
  previously_applied_at?: string;
}

export type PipelineExperienceLevel = 'any' | 'internship' | 'entry' | 'associate' | 'mid' | 'senior';
export type PipelineEmploymentType = 'ANY' | 'FULLTIME' | 'PARTTIME' | 'INTERN' | 'CONTRACTOR';
export type PipelineWorkArrangement = 'any' | 'remote' | 'hybrid' | 'onsite';

export interface DailyPipelineParams {
  linkedin_keywords?: string[];
  workday_titles?: string[];
  past_days?: number;
  custom_role_terms?: string[];
  linkedin_count?: number;
  workday_limit?: number;
  include_indeed?: boolean;
  // Optional, actor-supported filters. Omit / leave default to keep the
  // original pipeline behavior (entry-level, full-time, US, any arrangement).
  location?: string;
  experience_level?: PipelineExperienceLevel;
  employment_type?: PipelineEmploymentType;
  work_arrangement?: PipelineWorkArrangement;
  domain_strict?: boolean;
  // F-1 / H-1B opt-ins (default false → no behavior change).
  h1b_only?: boolean;
  exclude_no_sponsorship?: boolean;
  // Hide companies + title patterns / company-cap (legacy fields that the
  // backend already accepts).
  hide_companies?: string[];
  hide_title_patterns?: string[];
  max_per_company?: number;
}

export interface PipelinePreset {
  _id?: string;
  name: string;
  filters: DailyPipelineParams;
  created_at?: string;
  updated_at?: string;
}

export interface ApifyKeyStatus {
  has_key: boolean;
  masked?: string;
  updated_at?: string | null;
}

export interface SmartFilterIntent {
  primary: string;
  primary_label: string;
  secondary?: string | null;
  secondary_label?: string | null;
  confidence: number;
  is_generalist: boolean;
}

export interface SmartFilterGroup {
  intent: string;
  label: string;
  /** "primary" | "secondary" | "adjacent" — visual styling hint. */
  kind: 'primary' | 'secondary' | 'adjacent';
  score: number;
  tag: string;
  workday_titles: string[];
  linkedin_phrases: string[];
  custom_role_terms: string[];
}

export interface SmartFilterSuggestions {
  headline: string;
  rationale: string;
  linkedin_keyword_sets: string[];
  workday_titles: string[];
  custom_role_terms: string[];
  past_days: number;
  preset_tags: string[];
  intent?: SmartFilterIntent;
  groups?: SmartFilterGroup[];
}

export interface DailyPipelineSourceCounts {
  raw: number;
  apply_now: number;
  verify: number;
  excluded: number;
}

export interface DailyPipelineResult {
  ok: boolean;
  generated_at: string;
  past_days: number;
  cutoff: string;
  credits_exhausted?: boolean;
  used_user_apify_key?: boolean;
  raw_counts: {
    linkedin: number;
    workday: number;
    workday_direct?: number;
    indeed?: number;
    ats_direct?: number;
    total: number;
    duplicates_dropped?: number;
  };
  tier_counts: { tier_1: number; tier_2: number; tier_3: number };
  source_breakdown?: {
    linkedin: DailyPipelineSourceCounts;
    workday: DailyPipelineSourceCounts;
    workday_direct?: DailyPipelineSourceCounts;
    indeed?: DailyPipelineSourceCounts;
    ats_direct?: DailyPipelineSourceCounts;
  };
  totals: { apply_now: number; verify_dates: number; excluded: number };
  apply_now: DailyPipelineRecord[];
  verify_dates: DailyPipelineRecord[];
  excluded_sample: DailyPipelineRecord[];
  excluded_total: number;
  errors: string[];
  inputs: {
    linkedin_keywords: string[];
    workday_titles: string[];
    custom_role_terms: string[];
  };
  /**
   * Per-actor debug info. Helps differentiate "actor returned empty for valid
   * reasons" (narrow filters) from "actor errored / rate-limited" cases.
   */
  actor_diagnostics?: {
    linkedin_urls: string[];
    linkedin_silent_zero: boolean;
    workday_silent_zero: boolean;
    linkedin_input_summary?: { urls?: number; count_per_url?: number };
    workday_input_summary?: {
      titles?: number;
      limit?: number;
      experience?: string[];
      employment?: string[];
      arrangement?: string[];
    };
  };
}

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

// ── Workday Jobs tab (direct CXS fan-out across the validated tenant catalog) ──

export type WorkdayRecency = 'today' | '24h' | '3d' | '7d' | '30d';

/** Job shape returned by /api/jobs/workday/search — superset of Job with
 *  catalog metadata so the tab can filter recency/industry client-side. */
export interface WorkdayJob extends Job {
  tenant: string;
  industry: string;
  /** Whole days since posting (0 = today). null/undefined = unknown. */
  days_ago?: number | null;
  /** True when the job title covers all core tokens of one of the user's
   *  search titles — drives the ranking boost. */
  title_matched?: boolean;
}

export interface WorkdayJobsParams {
  titles?: string[];
  industries?: string[];
  companies?: string[];
  /** Optional narrowing WITHIN the US (state/city/"Remote"). */
  location?: string;
  remote_only?: boolean;
  /** Server-side US country facet on every tenant. Defaults to true. */
  us_only?: boolean;
  force_refresh?: boolean;
}

export interface WorkdayJobsProgress {
  tenants_done: number;
  tenants_total: number;
  jobs_found: number;
}

export interface WorkdayJobsResult {
  ok: boolean;
  generated_at: string;
  jobs: WorkdayJob[];
  total: number;
  window_counts: { today: number; d1: number; d3: number; d7: number; d30: number };
  query_terms: string[];
  tenants_total: number;
  tenants_done: number;
  tenants_with_results: number;
  industries_available: string[];
  cache_hit: boolean;
  us_only?: boolean;
  diagnostics?: { facet_fallbacks: number; task_errors: number };
  errors: string[];
  /** Present only on streaming partials while the fan-out is running. */
  progress?: WorkdayJobsProgress;
}

export interface WorkdayCatalogIndustry {
  key: string;
  count: number;
  companies: Array<{ display_name: string; tenant: string }>;
}

export interface WorkdayCatalog {
  total: number;
  industries: WorkdayCatalogIndustry[];
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
  source: 'all' | 'linkedin' | 'workday' | 'indeed' | 'google' | 'company' | 'jobright' | 'jsearch' | 'workday_direct' | 'ats_direct';
  include_company_careers: boolean;
  use_resume_recommendations: boolean;
}

export interface JobSearchOptions {
  forceRefresh?: boolean;
}

export interface SavedJobFilters {
  filters: JobSearchFilters | null;
  updated_at?: string;
}

export interface JobSearchResponse {
  jobs: Job[];
  total: number;
  total_pages?: number;
  page: number;
  errors?: string[];
  fallback_source?: string;
  sources?: Record<string, number>;
  raw_sources?: Record<string, number>;
  filtered_reasons?: Record<string, number>;
  selected_sources?: string[];
  skipped_sources?: Record<string, string>;
  cache_hits?: number;
  cache_bypassed?: boolean;
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
  force_refresh?: boolean;
}

export interface BatchSearchResponse {
  jobs: Job[];
  total: number;
  queries_executed: number;
  cache_hits: number;
  errors: string[];
  sources?: Record<string, number>;
  raw_sources?: Record<string, number>;
  filtered_reasons?: Record<string, number>;
  selected_sources?: string[];
  skipped_sources?: Record<string, string>;
  cache_bypassed?: boolean;
}


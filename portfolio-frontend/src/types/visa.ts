export type VisaStatusCode =
  | 'F1'
  | 'F1-CPT'
  | 'F1-OPT'
  | 'F1-STEM-OPT'
  | 'H1B'
  | 'Other';

export interface VisaProfile {
  visa_status: VisaStatusCode;
  country_of_birth?: string | null;
  stem_degree: boolean;
  opt_ead_arrival_date?: string | null;
  opt_start_date?: string | null;
  opt_end_date?: string | null;
  stem_extension_filed: boolean;
  stem_extension_end_date?: string | null;
  cpt_end_date?: string | null;
  h1b_lottery_year?: number | null;
  h1b_lottery_filed: boolean;
  current_employer_e_verified: boolean;
  notes?: string;
}

export type MilestoneSeverity = 'info' | 'warning' | 'critical';

export interface VisaMilestone {
  id: string;
  label: string;
  description: string;
  date: string | null;
  days_remaining: number | null;
  severity: MilestoneSeverity;
}

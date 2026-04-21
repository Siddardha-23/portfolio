import { useState, useCallback, useEffect } from 'react';
import { apiService } from '@/lib/api';
import type { Job, SavedJob, JobSearchFilters, BatchSearchResponse } from '@/types/jobs';

const DEFAULT_QUERIES = [
  'software engineer new grad entry level h1b sponsor',
  'cloud engineer entry level contract h1b sponsor',
  'devops engineer entry level new grad',
  'SRE entry level new grad',
  'platform engineer entry level contract',
  'full stack developer entry level h1b sponsor',
];

export const COMPANY_CHIPS = [
  'Amazon', 'Google', 'Meta', 'Apple', 'Netflix', 'Microsoft',
  'Walmart', 'TikTok', 'Lucid', 'Qualcomm', 'Thermo Fisher', 'PayPal',
  'State Farm', 'Deloitte', 'TCS', 'Infosys',
];

export const DEFAULT_FILTERS: JobSearchFilters = {
  query: 'software engineer new grad entry level h1b sponsor',
  location: 'United States',
  date_posted: 'today',
  remote_only: false,
  employment_type: '',
  h1b_only: false,
  visa_or_contract: true,
  experience_level: 'entry',
  source: 'all',
  include_company_careers: true,
  use_resume_recommendations: true,
};

export interface BatchMeta {
  queries_executed: number;
  cache_hits: number;
  errors: string[];
  sources?: Record<string, number>;
  pending?: string[];
  streaming?: boolean;
}

export function useJobSearch() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [filters, setFilters] = useState<JobSearchFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchMeta, setBatchMeta] = useState<BatchMeta | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [savingFilters, setSavingFilters] = useState(false);

  // --- Single-query search (manual) ---
  const searchJobs = useCallback(async (searchFilters?: JobSearchFilters, searchPage?: number) => {
    const f = searchFilters || filters;
    if (!f.query.trim()) return;

    setLoading(true);
    setError(null);
    setBatchMeta(null);
    setHasSearched(true);
    const p = searchPage || 1;

    const resp = await apiService.searchJobs(
      {
        q: f.query,
        page: p,
        location: f.location,
        date_posted: f.date_posted,
        remote: f.remote_only,
        type: f.employment_type,
        h1b_only: f.h1b_only,
        visa_or_contract: f.visa_or_contract,
        experience_level: f.experience_level,
        source: f.source,
        include_company_careers: f.include_company_careers,
        use_resume_recommendations: f.use_resume_recommendations,
      },
      (partial) => {
        let streamed = partial.jobs || [];
        if (f.h1b_only) streamed = streamed.filter(j => j.h1b_sponsor);
        setJobs(streamed);
        setLoading(false);
        setBatchMeta({
          queries_executed: 1,
          cache_hits: 0,
          errors: partial.errors || [],
          sources: partial.sources,
          pending: (partial as any).pending,
          streaming: true,
        });
      },
    );

    if (resp.error) {
      setError(resp.error);
      setLoading(false);
      return;
    }

    let results = resp.data?.jobs || [];
    if (f.h1b_only) {
      results = results.filter(j => j.h1b_sponsor);
    }

    setJobs(results);
    setPage(resp.data?.page || 1);
    setTotalPages(Math.max(1, resp.data?.total_pages || 1));
    const hasMeta = (resp.data?.errors?.length ?? 0) > 0 || !!resp.data?.sources;
    setBatchMeta(hasMeta ? {
      queries_executed: 1,
      cache_hits: 0,
      errors: resp.data?.errors || [],
      sources: resp.data?.sources,
    } : null);
    setLoading(false);
  }, [filters]);

  // --- Batch search (multi-query) ---
  const batchSearch = useCallback(async (
    queries: string[] = DEFAULT_QUERIES,
    overrides?: Partial<JobSearchFilters>,
  ) => {
    setLoading(true);
    setError(null);
    setBatchMeta(null);
    setHasSearched(true);

    const f = { ...filters, ...overrides };
    const resp = await apiService.batchSearchJobs(
      {
        queries,
        location: f.location,
        date_posted: f.date_posted,
        remote: f.remote_only,
        type: f.employment_type,
        h1b_only: f.h1b_only,
        visa_or_contract: f.visa_or_contract,
        experience_level: f.experience_level,
        source: f.source,
        include_company_careers: f.include_company_careers,
        use_resume_recommendations: f.use_resume_recommendations,
      },
      (partial) => {
        let streamed = partial.jobs || [];
        if (f.h1b_only) streamed = streamed.filter(j => j.h1b_sponsor);
        setJobs(streamed);
        setLoading(false);
        setBatchMeta({
          queries_executed: partial.queries_executed ?? queries.length,
          cache_hits: partial.cache_hits ?? 0,
          errors: partial.errors || [],
          sources: partial.sources,
          pending: (partial as any).pending,
          streaming: true,
        });
      },
    );

    if (resp.error) {
      setError(resp.error);
      setLoading(false);
      return;
    }

    const data = resp.data as BatchSearchResponse;
    let results = data.jobs || [];
    if (f.h1b_only) {
      results = results.filter(j => j.h1b_sponsor);
    }

    setJobs(results);
    setTotalPages(1);
    setPage(1);
    setBatchMeta({
      queries_executed: data.queries_executed,
      cache_hits: data.cache_hits,
      errors: data.errors || [],
      sources: data.sources,
    });
    setLoading(false);
  }, [filters]);

  // --- Saved filters ---
  const loadSavedFilters = useCallback(async () => {
    const resp = await apiService.getJobFilters();
    if (resp.data?.filters) {
      setFilters({ ...DEFAULT_FILTERS, ...resp.data.filters });
    }
    setFiltersLoaded(true);
    return resp;
  }, []);

  const saveFilters = useCallback(async (nextFilters?: JobSearchFilters) => {
    setSavingFilters(true);
    const resp = await apiService.saveJobFilters(nextFilters || filters);
    setSavingFilters(false);
    if (resp.data?.filters) {
      setFilters({ ...DEFAULT_FILTERS, ...resp.data.filters });
    }
    return resp;
  }, [filters]);

  // --- Saved jobs ---
  const loadSavedJobs = useCallback(async () => {
    const resp = await apiService.getSavedJobs();
    if (resp.data) {
      setSavedJobs(resp.data.jobs);
    }
  }, []);

  const saveJob = useCallback(async (job: Job) => {
    const resp = await apiService.saveJob(job);
    if (resp.data) {
      setSavedJobs(prev => [resp.data!.job, ...prev.filter(j => j.job_id !== job.job_id)]);
    }
    return resp;
  }, []);

  const unsaveJob = useCallback(async (jobId: string) => {
    const resp = await apiService.deleteSavedJob(jobId);
    if (!resp.error) {
      setSavedJobs(prev => prev.filter(j => j.job_id !== jobId));
    }
    return resp;
  }, []);

  const updateJobStatus = useCallback(async (jobId: string, status: string, notes?: string) => {
    const resp = await apiService.updateSavedJob(jobId, { status, notes });
    if (resp.data) {
      setSavedJobs(prev => prev.map(j => j.job_id === jobId ? resp.data!.job : j));
    }
    return resp;
  }, []);

  const isJobSaved = useCallback((jobId: string) => {
    return savedJobs.some(j => j.job_id === jobId);
  }, [savedJobs]);

  // --- Quick Apply: open link + save + mark applied ---
  const quickApply = useCallback(async (job: Job) => {
    if (job.apply_link) {
      window.open(job.apply_link, '_blank', 'noopener,noreferrer');
    }
    // Save if not already saved
    if (!savedJobs.some(j => j.job_id === job.job_id)) {
      await apiService.saveJob(job);
    }
    // Mark as applied
    const resp = await apiService.updateSavedJob(job.job_id, { status: 'applied' });
    if (resp.data) {
      setSavedJobs(prev => {
        const exists = prev.some(j => j.job_id === job.job_id);
        if (exists) {
          return prev.map(j => j.job_id === job.job_id ? resp.data!.job : j);
        }
        return [resp.data!.job, ...prev];
      });
    }
  }, [savedJobs]);

  // --- Get saved status for a job ---
  const getJobStatus = useCallback((jobId: string): string | null => {
    const saved = savedJobs.find(j => j.job_id === jobId);
    return saved?.status || null;
  }, [savedJobs]);

  // Load saved jobs on mount
  useEffect(() => {
    loadSavedJobs();
    loadSavedFilters();
  }, [loadSavedJobs, loadSavedFilters]);

  return {
    jobs,
    savedJobs,
    filters,
    setFilters,
    page,
    totalPages,
    setPage,
    loading,
    error,
    filtersLoaded,
    savingFilters,
    searchJobs,
    batchSearch,
    saveFilters,
    loadSavedJobs,
    loadSavedFilters,
    saveJob,
    unsaveJob,
    updateJobStatus,
    isJobSaved,
    quickApply,
    getJobStatus,
    batchMeta,
    hasSearched,
  };
}

/**
 * API service layer for backend communication
 * 
 * This service provides a clean interface to all backend API endpoints.
 * The backend is organized in a microservice-like architecture with:
 * - /api/auth - Authentication
 * - /api/info - Visitor tracking
 * - /api/contact - Contact form
 * - /api/session - Session management
 * - /api/geo - IP geolocation
 */

// In browser on production (non-localhost), always use same origin so /api hits CloudFront regardless of build env.
// This avoids API URL mismatch after infra changes (e.g. Lambda URL, domain).
function getApiBaseUrl(): string {
  const build = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('localhost'))
    return `${window.location.origin}/api`;
  return build;
}
const API_BASE_URL = getApiBaseUrl();

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiService {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // Load token from localStorage on initialization
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token && typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
  }

  private static readonly REQUEST_TIMEOUT_MS = 15000;

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs?: number
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs || ApiService.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));

      if (response.status === 401 && token) {
        this.logout();
        return { error: 'Session expired. Please sign in again.' };
      }

      if (!response.ok) {
        return {
          error: data.error || data.message || data.msg || `HTTP ${response.status}`,
        };
      }

      return { data };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        return { error: 'Request timed out. Please try again.' };
      }
      return {
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // ============================================
  // Auth endpoints (/api/auth)
  // ============================================

  async register(
    email: string,
    password: string,
    role?: string,
    sector?: string,
    session_id?: string,
    fingerprint_hash?: string
  ) {
    const response = await this.request<{ access_token: string; email: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, role, sector, session_id, fingerprint_hash }),
    });

    if (response.data?.access_token) {
      this.setToken(response.data.access_token);
    }

    return response;
  }

  async login(
    email: string,
    password: string,
    session_id?: string,
    fingerprint_hash?: string
  ) {
    const response = await this.request<{
      access_token: string;
      email: string;
      role?: string;
      sector?: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, session_id, fingerprint_hash }),
    });

    if (response.data?.access_token) {
      this.setToken(response.data.access_token);
    }

    return response;
  }

  async logout() {
    this.setToken(null);
  }

  async getProfile() {
    return this.request<{
      email: string;
      role?: string;
      sector?: string;
      created_at?: string;
    }>('/auth/profile', {
      method: 'GET',
    });
  }

  async verifyToken() {
    return this.request<{ email: string; valid: boolean }>('/auth/verify', {
      method: 'GET',
    });
  }

  async checkUser(fingerprint_hash: string) {
    return this.request<{ exists: boolean; email?: string }>('/auth/check-user', {
      method: 'POST',
      body: JSON.stringify({ fingerprint_hash }),
    });
  }

  // ============================================
  // Visitor info endpoints (/api/info)
  // ============================================

  async storeVisitorInfo(data: Record<string, any>) {
    return this.request<{
      message: string;
      ip: string;
      status: 'new' | 'existing';
      session_id: string;
      location?: {
        city: string;
        country: string;
      };
    }>('/info', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getVisitorStats() {
    return this.request<{
      total_visitors: number;
      unique_ips: number;
      visitors_24h: number;
      visitors_7d: number;
      visitors_30d: number;
      top_countries: Array<{ country: string; count: number }>;
      top_cities: Array<{ city: string; count: number }>;
      top_pages: Array<{ page: string; count: number }>;
      top_browsers: Array<{ browser: string; count: number }>;
      sessions: {
        total_sessions: number;
        active_sessions_1h: number;
        tracked_sessions: number;
      };
    }>('/info/stats', {
      method: 'GET',
    });
  }

  async registerVisitor(data: {
    firstName: string;
    middleName?: string;
    lastName: string;
    email: string;
    linkedinUrl?: string;
    fingerprint?: Record<string, any>;
    sessionId?: string;
  }) {
    return this.request<{
      success: boolean;
      message: string;
      linkedin: { found: boolean; url?: string; headline?: string };
      organization: string | null;
      location?: {
        city: string;
        country: string;
      };
    }>('/info/register-visitor', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getOrgStats(queryParams?: string) {
    return this.request<{
      total_visitors: number;
      organizations: Array<{
        name: string;
        visitors: number;
        latest_visit: string | null;
      }>;
      total_registered: number;
      linkedin_profiles_found: number;
      notable_linkedin?: Array<{ name: string; count: number }>;
      top_countries?: Array<{ country: string; count: number }>;
      map_locations?: Array<{
        country: string;
        city?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        count: number;
      }>;
    }>(`/info/org-stats${queryParams || ''}`, {
      method: 'GET',
    });
  }

  // ============================================
  // Session endpoints (/api/session)
  // ============================================

  async validateSession(sessionId: string) {
    return this.request<{
      valid: boolean;
      session_id: string;
      is_new: boolean;
      page_views: number;
      is_tracked: boolean;
    }>('/session/validate', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  }

  async trackPageView(sessionId: string, page: string) {
    return this.request<{
      success: boolean;
      message: string;
    }>('/session/track-page', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, page }),
    });
  }

  async getSessionStats() {
    return this.request<{
      total_sessions: number;
      active_sessions_1h: number;
      tracked_sessions: number;
    }>('/session/stats', {
      method: 'GET',
    });
  }

  async trackSectionTime(data: {
    session_id: string;
    page: string;
    totalTimeMs: number;
    sections: { [key: string]: { timeMs: number; visits: number } };
    timestamp: string;
  }) {
    return this.request<{
      success: boolean;
      message: string;
    }>('/session/track-time', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSectionAnalytics() {
    return this.request<{
      total_sessions: number;
      sections: Array<{
        id: string;
        label: string;
        avg_time_ms: number;
        avg_time_sec: number;
        total_time_ms: number;
        total_visits: number;
        session_count: number;
        max_time_ms: number;
        min_time_ms: number;
        engagement_pct: number;
      }>;
      avg_total_time_ms: number;
      avg_total_time_sec: number;
      engagement_over_time: Array<{
        date: string;
        sessions: number;
        avg_time_sec: number;
      }>;
      top_section: string;
      total_engagement_ms: number;
    }>('/session/section-analytics', {
      method: 'GET',
    });
  }

  // ============================================
  // Geolocation endpoints (/api/geo)
  // ============================================

  async lookupIP(ip?: string) {
    return this.request<{
      ip: string;
      city: string;
      region: string;
      country: string;
      country_name: string;
      timezone: string;
      org: string;
      latitude?: number;
      longitude?: number;
    }>('/geo/lookup', {
      method: 'POST',
      body: JSON.stringify({ ip }),
    });
  }

  async getMyIP() {
    return this.request<{
      ip: string;
      location: {
        city: string;
        region: string;
        country: string;
        timezone: string;
      };
    }>('/geo/my-ip', {
      method: 'GET',
    });
  }

  async getIPStats() {
    return this.request<{
      total_cached_ips: number;
      top_countries: Array<{ country: string; count: number }>;
      top_cities: Array<{ city: string; count: number }>;
    }>('/geo/stats', {
      method: 'GET',
    });
  }

  // ============================================
  // Contact endpoints (/api/contact)
  // ============================================

  async submitContact(name: string, email: string, subject: string, message: string) {
    return this.request<{ message: string; success: boolean }>('/contact', {
      method: 'POST',
      body: JSON.stringify({ name, email, subject, message }),
    });
  }

  async getContactMessages() {
    return this.request<{
      messages: Array<{
        id: number;
        name: string;
        email: string;
        subject: string;
        message: string;
        created_at: string;
        ip_address: string;
      }>;
    }>('/contact/messages', {
      method: 'GET',
    });
  }

  // ============================================
  // Chat endpoints (/api/chat)
  // ============================================

  async sendChatMessage(message: string, history?: Array<{ role: string; content: string }>) {
    return this.request<{ response: string; success: boolean }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    });
  }

  // ============================================
  // Health check
  // ============================================

  async healthCheck() {
    return this.request<{
      status: string;
      service: string;
      version: string;
    }>('/health', {
      method: 'GET',
    });
  }

  // ============================================
  // Job Search endpoints (/api/jobs)
  // ============================================

  async searchJobs(params: {
    q: string;
    page?: number;
    location?: string;
    date_posted?: string;
    remote?: boolean;
    type?: string;
  }) {
    const searchParams = new URLSearchParams();
    searchParams.set('q', params.q);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.location) searchParams.set('location', params.location);
    if (params.date_posted) searchParams.set('date_posted', params.date_posted);
    if (params.remote) searchParams.set('remote', 'true');
    if (params.type) searchParams.set('type', params.type);
    return this.request<{ jobs: import('../types/jobs').Job[]; total: number; page: number }>(
      `/jobs/search?${searchParams.toString()}`
    );
  }

  async batchSearchJobs(params: import('../types/jobs').BatchSearchParams) {
    return this.request<import('../types/jobs').BatchSearchResponse>('/jobs/batch-search', {
      method: 'POST',
      body: JSON.stringify(params),
    }, 30000);
  }

  async analyzeJob(job: import('../types/jobs').Job, action: 'summarize' | 'missing_skills' | 'cover_letter') {
    return this.request<{ result: string; action: string }>('/jobs/analyze', {
      method: 'POST',
      body: JSON.stringify({ job, action }),
    });
  }

  async uploadResume(file: File): Promise<ApiResponse<{ resume: import('../types/jobs').ParsedResume }>> {
    const formData = new FormData();
    formData.append('file', file);
    const token = this.getToken();
    const url = `${this.baseURL}/jobs/resume`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return { error: data.error || `HTTP ${response.status}` };
      return { data } as ApiResponse<{ resume: import('../types/jobs').ParsedResume }>;
    } catch (error) {
      clearTimeout(timeoutId);
      return { error: error instanceof Error ? error.message : 'Upload failed' };
    }
  }

  async getResume() {
    return this.request<{ resume: import('../types/jobs').ParsedResume }>('/jobs/resume');
  }

  async tailorResume(jobDescription: string) {
    return this.request<{ tailored: import('../types/jobs').TailoredResume }>('/jobs/tailor-resume', {
      method: 'POST',
      body: JSON.stringify({ job_description: jobDescription }),
    }, 30000);
  }

  async getSavedJobs() {
    return this.request<{ jobs: import('../types/jobs').SavedJob[] }>('/jobs/saved');
  }

  async saveJob(job: import('../types/jobs').Job) {
    return this.request<{ job: import('../types/jobs').SavedJob }>('/jobs/saved', {
      method: 'POST',
      body: JSON.stringify({ job }),
    });
  }

  async updateSavedJob(jobId: string, data: { status?: string; notes?: string }) {
    return this.request<{ job: import('../types/jobs').SavedJob }>(`/jobs/saved/${jobId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSavedJob(jobId: string) {
    return this.request<{ message: string }>(`/jobs/saved/${jobId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // Resume Parser endpoints (/api/resume)
  // - Async job pattern: submit -> poll -> result
  // ============================================

  async getResumeStatus() {
    return this.request<import('../types/resume').ResumeStatus>('/resume/status');
  }

  async uploadResumeForParser(file: File): Promise<ApiResponse<{ resume: import('../types/jobs').ParsedResume }>> {
    const formData = new FormData();
    formData.append('file', file);
    const token = this.getToken();
    const url = `${this.baseURL}/resume/upload`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        return { error: 'Session expired. Please sign in again.' };
      }
      if (!response.ok) return { error: data.error || `HTTP ${response.status}` };

      // Backend returns { job_id } with 202 — poll for the parsed result
      if (data.job_id) {
        const pollResult = await this.pollJob<{ parsed_resume: any }>(data.job_id, 120000);
        return pollResult;
      }

      // Fallback: if backend returns the resume directly (shouldn't happen, but safe)
      return { data } as ApiResponse<{ parsed_resume: any }>;
    } catch (error) {
      clearTimeout(timeoutId);
      return { error: error instanceof Error ? error.message : 'Upload failed' };
    }
  }

  /**
   * Poll a resume job until it completes or fails.
   * - 30s timeout per individual poll request (handles cold Lambda starts)
   * - Retries up to 3 consecutive transient errors before bailing
   * - 120s hard limit total
   * - Respects AbortSignal for cancellation
   */
  private async pollJob<T>(
    jobId: string,
    maxWaitMs = 120000,
    signal?: AbortSignal,
  ): Promise<ApiResponse<T>> {
    const pollInterval = 2000;
    const startTime = Date.now();
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;

    while (Date.now() - startTime < maxWaitMs) {
      if (signal?.aborted) return { error: 'Cancelled' };

      const resp = await this.request<{
        status: string;
        result?: T;
        error?: string;
      }>(`/resume/job/${jobId}`, {}, 30000);

      if (resp.error) {
        consecutiveErrors++;
        if (consecutiveErrors >= maxConsecutiveErrors) {
          return { error: resp.error };
        }
        // Transient error (cold start / brief timeout) — wait and retry
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }

      consecutiveErrors = 0;
      const job = resp.data;
      if (!job) return { error: 'Job not found' };

      if (job.status === 'completed' && job.result) {
        return { data: job.result as unknown as T };
      }

      if (job.status === 'failed') {
        return { error: job.error || 'Job failed. Please try again.' };
      }

      // Still processing - wait and poll again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return { error: 'Request timed out. Please try again.' };
  }

  async extractJD(
    jobDescription: string,
  ): Promise<ApiResponse<{ jd_analysis: import('../types/resume').JDAnalysis }>> {
    const submitResp = await this.request<{ job_id: string }>(
      '/resume/extract-jd',
      { method: 'POST', body: JSON.stringify({ job_description: jobDescription }) },
      30000,
    );
    if (submitResp.error) return { error: submitResp.error };
    if (!submitResp.data?.job_id) return { error: 'Failed to submit job' };

    return this.pollJob<{ jd_analysis: import('../types/resume').JDAnalysis }>(submitResp.data.job_id);
  }

  async tailorResumeForParser(
    jdAnalysis: import('../types/resume').JDAnalysis,
    signal?: AbortSignal,
  ): Promise<ApiResponse<{ tailored_resume: import('../types/resume').TailoredFullResume }>> {
    const submitResp = await this.request<{ job_id: string }>(
      '/resume/tailor',
      { method: 'POST', body: JSON.stringify({ jd_analysis: jdAnalysis }) },
      30000,
    );
    if (submitResp.error) return { error: submitResp.error };
    if (!submitResp.data?.job_id) return { error: 'Failed to submit job' };

    return this.pollJob<{ tailored_resume: import('../types/resume').TailoredFullResume }>(
      submitResp.data.job_id, 120000, signal,
    );
  }

  async fetchATSScores(
    tailoredResume: import('../types/resume').TailoredFullResume,
    jdAnalysis: import('../types/resume').JDAnalysis,
    signal?: AbortSignal,
  ): Promise<ApiResponse<{ ats_scores: import('../types/resume').ATSScores }>> {
    const submitResp = await this.request<{ job_id: string }>(
      '/resume/ats-scores',
      { method: 'POST', body: JSON.stringify({ tailored_resume: tailoredResume, jd_analysis: jdAnalysis }) },
      30000,
    );
    if (submitResp.error) return { error: submitResp.error };
    if (!submitResp.data?.job_id) return { error: 'Failed to submit job' };

    return this.pollJob<{ ats_scores: import('../types/resume').ATSScores }>(
      submitResp.data.job_id, 120000, signal,
    );
  }

  // ============================================
  // Resume management endpoints
  // ============================================

  async listBaseResumes(): Promise<ApiResponse<{versions: any[]}>> {
    return this.request('/resume/versions');
  }

  async listGeneratedResumes(): Promise<ApiResponse<{generated: any[]}>> {
    return this.request('/resume/generated');
  }

  async setActiveResume(s3Key: string): Promise<ApiResponse<any>> {
    return this.request('/resume/active', {
      method: 'PUT',
      body: JSON.stringify({ s3_key: s3Key })
    });
  }

  async deleteResume(s3Key: string): Promise<ApiResponse<any>> {
    return this.request(`/resume/file/${encodeURIComponent(s3Key)}`, {
      method: 'DELETE'
    });
  }

  async downloadResumeFile(s3Key: string): Promise<Blob> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${this.baseURL}/resume/download-file/${encodeURIComponent(s3Key)}`, {
      headers,
    });
    if (!response.ok) throw new Error('Download failed');
    return response.blob();
  }

  async downloadTailoredResume(
    tailoredResume: import('../types/resume').TailoredFullResume,
    jdAnalysis: import('../types/resume').JDAnalysis,
    format: 'pdf' | 'docx'
  ): Promise<{ data?: Blob; error?: string; filename?: string }> {
    const token = this.getToken();
    const url = `${this.baseURL}/resume/download`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tailored_resume: tailoredResume,
          jd_analysis: jdAnalysis,
          format,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return { error: errData.error || `HTTP ${response.status}` };
      }
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `resume.${format}`;
      return { data: blob, filename };
    } catch (error) {
      clearTimeout(timeoutId);
      return { error: error instanceof Error ? error.message : 'Download failed' };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  REQUEST TRACING - distributed tracing waterfall
  // ═══════════════════════════════════════════════════════════════

  async traceRequest(): Promise<ApiResponse<TraceResult>> {
    // baseURL already ends with /api (e.g. http://localhost:5000/api)
    const url = `${this.baseURL}/trace`;

    // Clear any stale Resource Timing entries for this URL
    performance.clearResourceTimings();

    try {
      const fetchStart = performance.now();
      const response = await fetch(url, { cache: 'no-store' });
      const fetchEnd = performance.now();

      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }

      const serverData = await response.json();
      const totalMs = Math.round((fetchEnd - fetchStart) * 100) / 100;

      // Get Resource Timing entry for this specific request
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const entry = entries.find(e => e.name.includes('/trace'));

      // Helper: safely compute duration from Resource Timing (handles cross-origin zeroes)
      const safeDelta = (a: number, b: number, max: number) => {
        if (!a || !b || a <= 0 || b <= 0) return 0;
        const d = Math.round((a - b) * 100) / 100;
        return d > 0 && d < max ? d : 0;
      };

      const client = {
        total_ms: totalMs,
        dns_ms: entry ? safeDelta(entry.domainLookupEnd, entry.domainLookupStart, totalMs) : 0,
        tcp_tls_ms: entry ? safeDelta(entry.connectEnd, entry.connectStart, totalMs) : 0,
        ttfb_ms: entry ? safeDelta(entry.responseStart, entry.requestStart, totalMs) : 0,
        download_ms: entry ? safeDelta(entry.responseEnd, entry.responseStart, totalMs) : 0,
      };

      return {
        data: {
          ...serverData,
          client,
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Trace request failed',
      };
    }
  }

  async traceDeepRequest(): Promise<ApiResponse<DeepTraceResult>> {
    const url = `${this.baseURL}/trace/deep`;

    performance.clearResourceTimings();

    try {
      const fetchStart = performance.now();
      const response = await fetch(url, { cache: 'no-store' });
      const fetchEnd = performance.now();

      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }

      const serverData = await response.json();
      const totalMs = Math.round((fetchEnd - fetchStart) * 100) / 100;

      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const entry = entries.find(e => e.name.includes('/trace/deep'));

      const safeDelta = (a: number, b: number, max: number) => {
        if (!a || !b || a <= 0 || b <= 0) return 0;
        const d = Math.round((a - b) * 100) / 100;
        return d > 0 && d < max ? d : 0;
      };

      const client = {
        total_ms: totalMs,
        dns_ms: entry ? safeDelta(entry.domainLookupEnd, entry.domainLookupStart, totalMs) : 0,
        tcp_tls_ms: entry ? safeDelta(entry.connectEnd, entry.connectStart, totalMs) : 0,
        ttfb_ms: entry ? safeDelta(entry.responseStart, entry.requestStart, totalMs) : 0,
        download_ms: entry ? safeDelta(entry.responseEnd, entry.responseStart, totalMs) : 0,
      };

      return {
        data: {
          ...serverData,
          client,
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Deep trace request failed',
      };
    }
  }

  async tracePageLoad(): Promise<ApiResponse<PageLoadTraceResult>> {
    const url = `${this.baseURL}/trace/pageload`;

    try {
      // 1. Collect Navigation Timing (the actual page load)
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const nav = navEntries[0];

      const navigation = nav ? {
        dns_ms: Math.round((nav.domainLookupEnd - nav.domainLookupStart) * 100) / 100,
        tcp_ms: Math.round((nav.connectEnd - nav.connectStart) * 100) / 100,
        tls_ms: nav.secureConnectionStart > 0
          ? Math.round((nav.connectEnd - nav.secureConnectionStart) * 100) / 100
          : 0,
        ttfb_ms: Math.round((nav.responseStart - nav.requestStart) * 100) / 100,
        document_download_ms: Math.round((nav.responseEnd - nav.responseStart) * 100) / 100,
        dom_parse_ms: Math.round((nav.domInteractive - nav.responseEnd) * 100) / 100,
        dom_interactive_ms: Math.round(nav.domInteractive * 100) / 100,
        page_load_ms: Math.round((nav.loadEventEnd > 0 ? nav.loadEventEnd : performance.now()) * 100) / 100,
        redirect_ms: Math.round((nav.redirectEnd - nav.redirectStart) * 100) / 100,
        transfer_size: nav.transferSize || 0,
      } : {
        dns_ms: 0, tcp_ms: 0, tls_ms: 0, ttfb_ms: 0,
        document_download_ms: 0, dom_parse_ms: 0, dom_interactive_ms: 0,
        page_load_ms: Math.round(performance.now() * 100) / 100,
        redirect_ms: 0, transfer_size: 0,
      };

      // 2. Collect Resource Timing (all loaded assets)
      const allResources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

      const categorize = (entries: PerformanceResourceTiming[], filter: (e: PerformanceResourceTiming) => boolean) =>
        entries.filter(filter).map(e => ({
          name: e.name.split('/').pop()?.split('?')[0] || e.name,
          duration: Math.round(e.duration * 100) / 100,
          size: e.transferSize || 0,
        })).sort((a, b) => b.duration - a.duration).slice(0, 5);

      const scripts = categorize(allResources, e => e.initiatorType === 'script' || e.name.endsWith('.js'));
      const styles = categorize(allResources, e => e.initiatorType === 'link' && (e.name.endsWith('.css') || e.name.includes('.css')));
      const apiCalls = categorize(allResources, e => e.name.includes('/api/'));
      const fonts = categorize(allResources, e => e.initiatorType === 'css' || e.name.match(/\.(woff2?|ttf|otf)/) !== null);

      const totalTransferKb = Math.round(allResources.reduce((sum, e) => sum + (e.transferSize || 0), 0) / 1024);

      const resources = {
        scripts,
        styles,
        api_calls: apiCalls,
        fonts,
        total_resources: allResources.length,
        total_transfer_kb: totalTransferKb,
      };

      // 3. Fetch server-side Lambda/container data
      performance.clearResourceTimings();
      const fetchStart = performance.now();
      const response = await fetch(url, { cache: 'no-store' });
      const fetchEnd = performance.now();

      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }

      const serverData = await response.json();
      const totalMs = Math.round((fetchEnd - fetchStart) * 100) / 100;

      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const entry = entries.find(e => e.name.includes('/trace/pageload'));

      const safeDelta = (a: number, b: number, max: number) => {
        if (!a || !b || a <= 0 || b <= 0) return 0;
        const d = Math.round((a - b) * 100) / 100;
        return d > 0 && d < max ? d : 0;
      };

      const client = {
        total_ms: totalMs,
        dns_ms: entry ? safeDelta(entry.domainLookupEnd, entry.domainLookupStart, totalMs) : 0,
        tcp_tls_ms: entry ? safeDelta(entry.connectEnd, entry.connectStart, totalMs) : 0,
        ttfb_ms: entry ? safeDelta(entry.responseStart, entry.requestStart, totalMs) : 0,
        download_ms: entry ? safeDelta(entry.responseEnd, entry.responseStart, totalMs) : 0,
      };

      return {
        data: {
          ...serverData,
          client,
          navigation,
          resources,
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Page load trace failed',
      };
    }
  }
}

// Trace result type
export interface TraceResult {
  trace_id: string;
  timestamp: string;
  cold_start: boolean;
  server: {
    total_ms: number;
    lambda_init_ms: number;
    flask_routing_ms: number;
    db_ping_ms: number;
    db_status: string;
  };
  lambda: {
    region: string;
    memory_mb: number;
    function_name: string;
    request_id: string;
  };
  xray: {
    trace_id: string;
    console_url: string;
    enabled: boolean;
  };
  client: {
    total_ms: number;
    dns_ms: number;
    tcp_tls_ms: number;
    ttfb_ms: number;
    download_ms: number;
  };
}

// Deep trace result type (real DB queries)
export interface DeepTraceQuery {
  name: string;
  collection: string;
  operation: string;
  ms: number;
  result: number;
}

export interface DeepTraceResult {
  trace_id: string;
  timestamp: string;
  cold_start: boolean;
  server: {
    total_ms: number;
    lambda_init_ms: number;
    flask_routing_ms: number;
    total_db_ms: number;
    db_status: string;
  };
  queries: DeepTraceQuery[];
  data: {
    unique_visitors: number;
    total_registered: number;
    organizations: number;
    linkedin_found: number;
    map_locations: number;
  };
  lambda: {
    region: string;
    memory_mb: number;
    function_name: string;
    request_id: string;
  };
  xray: {
    trace_id: string;
    console_url: string;
    enabled: boolean;
  };
  client: {
    total_ms: number;
    dns_ms: number;
    tcp_tls_ms: number;
    ttfb_ms: number;
    download_ms: number;
  };
}

// Page load trace result type
export interface PageLoadTraceResult {
  trace_id: string;
  timestamp: string;
  cold_start: boolean;
  server: {
    total_ms: number;
    lambda_init_ms: number;
    flask_routing_ms: number;
    db_ping_ms: number;
    db_status: string;
  };
  container: {
    cold_start_init_ms: number;
    first_request_id: string | null;
    is_warm: boolean;
  };
  lambda: {
    region: string;
    memory_mb: number;
    function_name: string;
    request_id: string;
  };
  xray: {
    trace_id: string;
    console_url: string;
    enabled: boolean;
  };
  infrastructure: {
    dns: string;
    cdn: string;
    static_origin: string;
    api_origin: string;
    compute: string;
    database: string;
    tracing: string;
    security: string;
  };
  // Added client-side
  client: {
    total_ms: number;
    dns_ms: number;
    tcp_tls_ms: number;
    ttfb_ms: number;
    download_ms: number;
  };
  navigation: {
    dns_ms: number;
    tcp_ms: number;
    tls_ms: number;
    ttfb_ms: number;
    document_download_ms: number;
    dom_parse_ms: number;
    dom_interactive_ms: number;
    page_load_ms: number;
    redirect_ms: number;
    transfer_size: number;
  };
  resources: {
    scripts: { name: string; duration: number; size: number }[];
    styles: { name: string; duration: number; size: number }[];
    api_calls: { name: string; duration: number; size: number }[];
    fonts: { name: string; duration: number; size: number }[];
    total_resources: number;
    total_transfer_kb: number;
  };
}

// ============================================
// CI/CD Sandbox Endpoints
// ============================================

interface SandboxStatus {
  status: string;
  conclusion: string | null;
  run_id: number;
  html_url?: string;
  jobs: {
    name: string;
    status: string;
    conclusion: string | null;
    steps: {
      name: string;
      status: string;
      conclusion: string | null;
    }[];
  }[];
}

interface SandboxLatest {
  message: string;
  color: string;
  timestamp: string;
}

declare module ApiService {
  interface Prototype {
    deploySandboxMessage(message: string, color: string): Promise<ApiResponse<any>>;
    getSandboxStatus(): Promise<ApiResponse<SandboxStatus>>;
    getLatestSandboxMessage(): Promise<ApiResponse<SandboxLatest>>;
  }
}

Object.assign(ApiService.prototype, {
  async deploySandboxMessage(this: ApiService, message: string, color: string) {
    return this['request']('/infra/sandbox/deploy', {
      method: 'POST',
      body: JSON.stringify({ message, color }),
    });
  },

  async getSandboxStatus(this: ApiService) {
    return this['request']('/infra/sandbox/status', {
      method: 'GET',
    });
  },

  async getLatestSandboxMessage(this: ApiService) {
    return this['request']('/infra/sandbox/latest', {
      method: 'GET',
    });
  }
});

export const apiService = new ApiService(API_BASE_URL);

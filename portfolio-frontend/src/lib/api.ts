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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
          error: data.error || data.message || `HTTP ${response.status}`,
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

  async register(username: string, password: string, email?: string) {
    return this.request<{ message: string; username: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email }),
    });
  }

  async login(username: string, password: string) {
    const response = await this.request<{
      access_token: string;
      username: string;
      email?: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
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
      id: number;
      username: string;
      email?: string;
      created_at?: string;
    }>('/auth/profile', {
      method: 'GET',
    });
  }

  async verifyToken() {
    return this.request<{ username: string; valid: boolean }>('/auth/verify', {
      method: 'GET',
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

  async getOrgStats() {
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
    }>('/info/org-stats', {
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

  private jobRequest<T>(endpoint: string, options: RequestInit = {}, timeoutMs?: number): Promise<ApiResponse<T>> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('job_search_token') : null;
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return this.request<T>(endpoint, {
      ...options,
      headers: { ...headers, ...options.headers as Record<string, string> },
    }, timeoutMs);
  }

  async jobSearchAuth(password: string) {
    const response = await this.request<{ access_token: string }>('/jobs/auth', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    if (response.data?.access_token && typeof window !== 'undefined') {
      localStorage.setItem('job_search_token', response.data.access_token);
    }
    return response;
  }

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
    return this.jobRequest<{ jobs: import('../types/jobs').Job[]; total: number; page: number }>(
      `/jobs/search?${searchParams.toString()}`
    );
  }

  async batchSearchJobs(params: import('../types/jobs').BatchSearchParams) {
    return this.jobRequest<import('../types/jobs').BatchSearchResponse>('/jobs/batch-search', {
      method: 'POST',
      body: JSON.stringify(params),
    }, 30000);
  }

  async analyzeJob(job: import('../types/jobs').Job, action: 'summarize' | 'missing_skills' | 'cover_letter') {
    return this.jobRequest<{ result: string; action: string }>('/jobs/analyze', {
      method: 'POST',
      body: JSON.stringify({ job, action }),
    });
  }

  async uploadResume(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const token = typeof window !== 'undefined' ? localStorage.getItem('job_search_token') : null;
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
    return this.jobRequest<{ resume: import('../types/jobs').ParsedResume }>('/jobs/resume');
  }

  async tailorResume(jobDescription: string) {
    return this.jobRequest<{ tailored: import('../types/jobs').TailoredResume }>('/jobs/tailor-resume', {
      method: 'POST',
      body: JSON.stringify({ job_description: jobDescription }),
    }, 30000);
  }

  async getSavedJobs() {
    return this.jobRequest<{ jobs: import('../types/jobs').SavedJob[] }>('/jobs/saved');
  }

  async saveJob(job: import('../types/jobs').Job) {
    return this.jobRequest<{ job: import('../types/jobs').SavedJob }>('/jobs/saved', {
      method: 'POST',
      body: JSON.stringify({ job }),
    });
  }

  async updateSavedJob(jobId: string, data: { status?: string; notes?: string }) {
    return this.jobRequest<{ job: import('../types/jobs').SavedJob }>(`/jobs/saved/${jobId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSavedJob(jobId: string) {
    return this.jobRequest<{ message: string }>(`/jobs/saved/${jobId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // Resume Parser endpoints (/api/resume)
  // ============================================

  async getResumeStatus() {
    return this.jobRequest<import('../types/resume').ResumeStatus>('/resume/status');
  }

  async uploadResumeForParser(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const token = typeof window !== 'undefined' ? localStorage.getItem('job_search_token') : null;
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
      if (!response.ok) return { error: data.error || `HTTP ${response.status}` };
      return { data } as ApiResponse<{ resume: import('../types/jobs').ParsedResume }>;
    } catch (error) {
      clearTimeout(timeoutId);
      return { error: error instanceof Error ? error.message : 'Upload failed' };
    }
  }

  async tailorResume(
    jobDescription: string,
  ): Promise<ApiResponse<{ jd_analysis: import('../types/resume').JDAnalysis; tailored_resume: import('../types/resume').TailoredFullResume }>> {
    return this.jobRequest<{ jd_analysis: import('../types/resume').JDAnalysis; tailored_resume: import('../types/resume').TailoredFullResume }>(
      '/resume/tailor',
      { method: 'POST', body: JSON.stringify({ job_description: jobDescription }) },
      60000,
    );
  }

  async fetchATSScores(
    tailoredResume: import('../types/resume').TailoredFullResume,
    jdAnalysis: import('../types/resume').JDAnalysis,
  ): Promise<ApiResponse<{ ats_scores: import('../types/resume').ATSScores }>> {
    return this.jobRequest<{ ats_scores: import('../types/resume').ATSScores }>(
      '/resume/ats-scores',
      { method: 'POST', body: JSON.stringify({ tailored_resume: tailoredResume, jd_analysis: jdAnalysis }) },
      60000,
    );
  }

  async downloadTailoredResume(
    tailoredResume: import('../types/resume').TailoredFullResume,
    jdAnalysis: import('../types/resume').JDAnalysis,
    format: 'pdf' | 'docx'
  ): Promise<{ data?: Blob; error?: string; filename?: string }> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('job_search_token') : null;
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
}

export const apiService = new ApiService(API_BASE_URL);

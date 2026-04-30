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

import { toast } from "sonner";

const LLM_RETRIES_EXHAUSTED_TOAST_ID = "llm-retries-exhausted";

function notifyLLMRetriesExhausted(): void {
  toast.error(
    "⚡ High demand right now. Please try again in a moment.",
    { id: LLM_RETRIES_EXHAUSTED_TOAST_ID, duration: 6000 },
  );
}

// In browser on production (non-localhost), always use same origin so /api hits CloudFront regardless of build env.
// This avoids API URL mismatch after infra changes (e.g. Lambda URL, domain).
function getApiBaseUrl(): string {
  const build = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  if (
    typeof window !== "undefined" &&
    window.location?.origin &&
    !window.location.origin.includes("localhost")
  )
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
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("auth_token");
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token && typeof window !== "undefined") {
      localStorage.setItem("auth_token", token);
    } else if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
    }
  }

  getToken(): string | null {
    return (
      this.token ||
      (typeof window !== "undefined"
        ? localStorage.getItem("auth_token")
        : null)
    );
  }

  private static readonly REQUEST_TIMEOUT_MS = 15000;

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs?: number,
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getToken();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      timeoutMs || ApiService.REQUEST_TIMEOUT_MS,
    );

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
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("auth:session-expired"));
        }
        return { error: "Session expired. Please sign in again." };
      }

      if (!response.ok) {
        return {
          error:
            data.error || data.message || data.msg || `HTTP ${response.status}`,
        };
      }

      return { data };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        return { error: "Request timed out. Please try again." };
      }
      return {
        error: error instanceof Error ? error.message : "Network error",
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
    fingerprint_hash?: string,
  ) {
    const response = await this.request<{
      access_token: string;
      email: string;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        role,
        sector,
        session_id,
        fingerprint_hash,
      }),
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
    fingerprint_hash?: string,
  ) {
    const response = await this.request<{
      access_token: string;
      email: string;
      role?: string;
      sector?: string;
    }>("/auth/login", {
      method: "POST",
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
      name?: string;
      role?: string;
      sector?: string;
      created_at?: string;
    }>("/auth/profile", {
      method: "GET",
    });
  }

  async updateProfile(data: { name?: string; role?: string; sector?: string }) {
    return this.request<{
      email: string;
      name?: string;
      role?: string;
      sector?: string;
      created_at?: string;
    }>("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async verifyToken() {
    return this.request<{ email: string; valid: boolean }>("/auth/verify", {
      method: "GET",
    });
  }

  async checkUser(fingerprint_hash: string) {
    return this.request<{ exists: boolean; email?: string }>(
      "/auth/check-user",
      {
        method: "POST",
        body: JSON.stringify({ fingerprint_hash }),
      },
    );
  }

  async checkEmail(email: string) {
    return this.request<{ exists: boolean }>("/auth/check-email", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async validatePassword(email: string, password: string) {
    return this.request<{ valid: boolean }>("/auth/validate-password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  // ============================================
  // Visitor info endpoints (/api/info)
  // ============================================

  async storeVisitorInfo(data: Record<string, any>) {
    return this.request<{
      message: string;
      ip: string;
      status: "new" | "existing";
      session_id: string;
      location?: {
        city: string;
        country: string;
      };
    }>("/info", {
      method: "POST",
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
    }>("/info/stats", {
      method: "GET",
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
    }>("/info/register-visitor", {
      method: "POST",
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
    }>(`/info/org-stats${queryParams || ""}`, {
      method: "GET",
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
    }>("/session/validate", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    });
  }

  async trackPageView(sessionId: string, page: string) {
    return this.request<{
      success: boolean;
      message: string;
    }>("/session/track-page", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, page }),
    });
  }

  async getSessionStats() {
    return this.request<{
      total_sessions: number;
      active_sessions_1h: number;
      tracked_sessions: number;
    }>("/session/stats", {
      method: "GET",
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
    }>("/session/track-time", {
      method: "POST",
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
    }>("/session/section-analytics", {
      method: "GET",
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
    }>("/geo/lookup", {
      method: "POST",
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
    }>("/geo/my-ip", {
      method: "GET",
    });
  }

  async getIPStats() {
    return this.request<{
      total_cached_ips: number;
      top_countries: Array<{ country: string; count: number }>;
      top_cities: Array<{ city: string; count: number }>;
    }>("/geo/stats", {
      method: "GET",
    });
  }

  // ============================================
  // Contact endpoints (/api/contact)
  // ============================================

  async submitContact(
    name: string,
    email: string,
    subject: string,
    message: string,
  ) {
    return this.request<{ message: string; success: boolean }>("/contact", {
      method: "POST",
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
    }>("/contact/messages", {
      method: "GET",
    });
  }

  // ============================================
  // Chat endpoints (/api/chat)
  // ============================================

  async sendChatMessage(
    message: string,
    history?: Array<{ role: string; content: string }>,
  ) {
    return this.request<{ response: string; success: boolean }>("/chat", {
      method: "POST",
      body: JSON.stringify({ message, history }),
    });
  }

  // ============================================
  // Cloud Diary (powers Now Building ticker + agent's Builder specialist)
  // ============================================

  async getCloudDiary(limit = 5) {
    return this.request<{
      ok: boolean;
      data: {
        entries: Array<{
          date: string;
          headline: string;
          highlights: string[];
          tech: string[];
          shipping_score?: number;
          created_at?: string;
        }>;
        count: number;
      };
    }>(`/chat/diary?limit=${limit}`, { method: "GET" });
  }

  async getLatestDiary() {
    return this.request<{
      ok: boolean;
      data: {
        date: string;
        headline: string;
        highlights: string[];
        tech: string[];
        shipping_score?: number;
      } | null;
    }>("/chat/diary/latest", { method: "GET" });
  }

  // ============================================
  // Health check
  // ============================================

  async healthCheck() {
    return this.request<{
      status: string;
      service: string;
      version: string;
    }>("/health", {
      method: "GET",
    });
  }

  // ============================================
  // Job Search endpoints (/api/jobs)
  // ============================================

  async searchJobs(
    params: {
      q: string;
      page?: number;
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
    },
    onPartial?: (partial: import("../types/jobs").JobSearchResponse) => void,
  ) {
    const searchParams = new URLSearchParams();
    searchParams.set("q", params.q);
    if (params.page) searchParams.set("page", String(params.page));
    if (params.location) searchParams.set("location", params.location);
    if (params.date_posted) searchParams.set("date_posted", params.date_posted);
    if (params.remote) searchParams.set("remote", "true");
    if (params.type) searchParams.set("type", params.type);
    if (params.h1b_only) searchParams.set("h1b_only", "true");
    if (params.visa_or_contract) searchParams.set("visa_or_contract", "true");
    if (params.experience_level) searchParams.set("experience_level", params.experience_level);
    if (params.source) searchParams.set("source", params.source);
    searchParams.set("include_company_careers", params.include_company_careers ? "true" : "false");
    searchParams.set("use_resume_recommendations", params.use_resume_recommendations ? "true" : "false");
    if (params.force_refresh) searchParams.set("force_refresh", "true");
    const submitResp = await this.request<
      | { job_id: string }
      | import("../types/jobs").JobSearchResponse
    >(`/jobs/search?${searchParams.toString()}`);
    if (submitResp.error) return { error: submitResp.error };
    if ("job_id" in (submitResp.data || {})) {
      return this.pollJob<import("../types/jobs").JobSearchResponse>(
        (submitResp.data as { job_id: string }).job_id,
        300000,
        undefined,
        onPartial,
      );
    }
    return submitResp as ApiResponse<import("../types/jobs").JobSearchResponse>;
  }

  async batchSearchJobs(
    params: import("../types/jobs").BatchSearchParams,
    onPartial?: (partial: import("../types/jobs").BatchSearchResponse) => void,
  ) {
    const submitResp = await this.request<
      { job_id: string } | import("../types/jobs").BatchSearchResponse
    >(
      "/jobs/batch-search",
      {
        method: "POST",
        body: JSON.stringify(params),
      },
      30000,
    );
    if (submitResp.error) return { error: submitResp.error };
    if ("job_id" in (submitResp.data || {})) {
      return this.pollJob<import("../types/jobs").BatchSearchResponse>(
        (submitResp.data as { job_id: string }).job_id,
        300000,
        undefined,
        onPartial,
      );
    }
    return submitResp as ApiResponse<import("../types/jobs").BatchSearchResponse>;
  }

  async getApifyKey() {
    return this.request<import("../types/jobs").ApifyKeyStatus>(
      "/jobs/apify-key",
      { method: "GET" },
    );
  }

  async setApifyKey(apifyKey: string) {
    return this.request<import("../types/jobs").ApifyKeyStatus & { ok: boolean }>(
      "/jobs/apify-key",
      {
        method: "PUT",
        body: JSON.stringify({ apify_key: apifyKey }),
      },
    );
  }

  async deleteApifyKey() {
    return this.request<{ ok: boolean; has_key: boolean }>(
      "/jobs/apify-key",
      { method: "DELETE" },
    );
  }

  async suggestPipelineFilters() {
    return this.request<{ suggestions: import("../types/jobs").SmartFilterSuggestions }>(
      "/jobs/pipeline/suggest-filters",
      { method: "GET" },
      45000,
    );
  }

  async runDailyPipeline(
    params: import("../types/jobs").DailyPipelineParams,
    onPartial?: (partial: import("../types/jobs").DailyPipelineResult) => void,
  ): Promise<ApiResponse<import("../types/jobs").DailyPipelineResult>> {
    const submitResp = await this.request<{ job_id: string }>(
      "/jobs/pipeline",
      {
        method: "POST",
        body: JSON.stringify(params),
      },
      30000,
    );
    if (submitResp.error) return { error: submitResp.error };
    if (!submitResp.data?.job_id) return { error: "Failed to start pipeline" };
    return this.pollJob<import("../types/jobs").DailyPipelineResult>(
      submitResp.data.job_id,
      900000,
      undefined,
      onPartial,
    );
  }

  async analyzeJob(
    job: import("../types/jobs").Job,
    action: "summarize" | "missing_skills" | "cover_letter",
  ) {
    return this.request<{ result: string; action: string }>("/jobs/analyze", {
      method: "POST",
      body: JSON.stringify({ job, action }),
    });
  }

  async uploadResume(
    file: File,
  ): Promise<ApiResponse<{ resume: import("../types/jobs").ParsedResume }>> {
    const formData = new FormData();
    formData.append("file", file);
    const token = this.getToken();
    const url = `${this.baseURL}/jobs/resume`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        return { error: data.error || `HTTP ${response.status}` };
      return { data } as ApiResponse<{
        resume: import("../types/jobs").ParsedResume;
      }>;
    } catch (error) {
      clearTimeout(timeoutId);
      return {
        error: error instanceof Error ? error.message : "Upload failed",
      };
    }
  }

  async getResume() {
    return this.request<{ resume: import("../types/jobs").ParsedResume }>(
      "/jobs/resume",
    );
  }

  async tailorResume(jobDescription: string) {
    return this.request<{ tailored: import("../types/jobs").TailoredResume }>(
      "/jobs/tailor-resume",
      {
        method: "POST",
        body: JSON.stringify({ job_description: jobDescription }),
      },
      30000,
    );
  }

  async getSavedJobs() {
    return this.request<{ jobs: import("../types/jobs").SavedJob[] }>(
      "/jobs/saved",
    );
  }

  async getJobFilters() {
    return this.request<import("../types/jobs").SavedJobFilters>(
      "/jobs/filters",
    );
  }

  async saveJobFilters(filters: import("../types/jobs").JobSearchFilters) {
    return this.request<import("../types/jobs").SavedJobFilters>(
      "/jobs/filters",
      {
        method: "PUT",
        body: JSON.stringify({ filters }),
      },
    );
  }

  async saveJob(job: import("../types/jobs").Job) {
    return this.request<{ job: import("../types/jobs").SavedJob }>(
      "/jobs/saved",
      {
        method: "POST",
        body: JSON.stringify({ job }),
      },
    );
  }

  async updateSavedJob(
    jobId: string,
    data: { status?: string; notes?: string },
  ) {
    return this.request<{ job: import("../types/jobs").SavedJob }>(
      `/jobs/saved/${jobId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
  }

  async deleteSavedJob(jobId: string) {
    return this.request<{ message: string }>(`/jobs/saved/${jobId}`, {
      method: "DELETE",
    });
  }

  // ============================================
  // Resume Parser endpoints (/api/resume)
  // - Async job pattern: submit -> poll -> result
  // ============================================

  async getResumeStatus() {
    return this.request<import("../types/resume").ResumeStatus>(
      "/resume/status",
    );
  }

  async uploadResumeForParser(
    file: File,
  ): Promise<ApiResponse<{ resume: import("../types/jobs").ParsedResume }>> {
    const formData = new FormData();
    formData.append("file", file);
    const token = this.getToken();
    const url = `${this.baseURL}/resume/upload`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        return { error: "Session expired. Please sign in again." };
      }
      if (!response.ok)
        return { error: data.error || `HTTP ${response.status}` };

      // Backend returns { job_id } with 202 — poll for the parsed result
      if (data.job_id) {
        const pollResult = await this.pollJob<{ parsed_resume: any }>(
          data.job_id,
          120000,
        );
        return pollResult;
      }

      // Fallback: if backend returns the resume directly (shouldn't happen, but safe)
      return { data } as ApiResponse<{ parsed_resume: any }>;
    } catch (error) {
      clearTimeout(timeoutId);
      return {
        error: error instanceof Error ? error.message : "Upload failed",
      };
    }
  }

  /**
   * Poll a resume job until it completes or fails.
   * - 30s timeout per individual poll request (handles cold Lambda starts)
   * - Retries up to 3 consecutive transient errors before bailing
   * - 120s hard limit total by default (callers can raise)
   * - Respects AbortSignal for cancellation
   * - Optional onPartial fires while the job is still processing so the
   *   caller can stream in partial results (e.g. job-search sources that
   *   have finished while others are still running).
   */
  private async pollJob<T>(
    jobId: string,
    maxWaitMs = 120000,
    signal?: AbortSignal,
    onPartial?: (partial: T) => void,
  ): Promise<ApiResponse<T>> {
    const pollInterval = 2000;
    const startTime = Date.now();
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;

    while (Date.now() - startTime < maxWaitMs) {
      if (signal?.aborted) return { error: "Cancelled" };

      const resp = await this.request<{
        status: string;
        result?: T;
        error?: string;
        error_code?: string;
      }>(`/resume/job/${jobId}`, {}, 30000);

      if (resp.error) {
        consecutiveErrors++;
        if (consecutiveErrors >= maxConsecutiveErrors) {
          return { error: resp.error };
        }
        // Transient error (cold start / brief timeout) — wait and retry
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        continue;
      }

      consecutiveErrors = 0;
      const job = resp.data;
      if (!job) return { error: "Job not found" };

      if (job.status === "completed" && job.result) {
        return { data: job.result as unknown as T };
      }

      if (job.status === "failed") {
        if (job.error_code === "LLM_RETRIES_EXHAUSTED") {
          notifyLLMRetriesExhausted();
          return { error: "" };
        }
        return { error: job.error || "Job failed. Please try again." };
      }

      // Still processing — stream whatever partial result has been written.
      if (onPartial && job.result) {
        try {
          onPartial(job.result as unknown as T);
        } catch {
          // Callback errors should never abort polling.
        }
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    return { error: "Request timed out. Please try again." };
  }

  async extractJD(
    jobDescription: string,
  ): Promise<
    ApiResponse<{ jd_analysis: import("../types/resume").JDAnalysis }>
  > {
    const submitResp = await this.request<{ job_id: string }>(
      "/resume/extract-jd",
      {
        method: "POST",
        body: JSON.stringify({ job_description: jobDescription }),
      },
      30000,
    );
    if (submitResp.error) return { error: submitResp.error };
    if (!submitResp.data?.job_id) return { error: "Failed to submit job" };

    return this.pollJob<{ jd_analysis: import("../types/resume").JDAnalysis }>(
      submitResp.data.job_id,
    );
  }

  async tailorResumeForParser(
    jdAnalysis: import("../types/resume").JDAnalysis,
    signal?: AbortSignal,
  ): Promise<
    ApiResponse<{
      tailored_resume: import("../types/resume").TailoredFullResume;
    }>
  > {
    const submitResp = await this.request<{ job_id: string }>(
      "/resume/tailor",
      { method: "POST", body: JSON.stringify({ jd_analysis: jdAnalysis }) },
      30000,
    );
    if (submitResp.error) return { error: submitResp.error };
    if (!submitResp.data?.job_id) return { error: "Failed to submit job" };

    return this.pollJob<{
      tailored_resume: import("../types/resume").TailoredFullResume;
    }>(submitResp.data.job_id, 120000, signal);
  }

  async regenerateResume(
    tailoredResume: import("../types/resume").TailoredFullResume,
    jdAnalysis: import("../types/resume").JDAnalysis,
    userFeedback: string,
    signal?: AbortSignal,
  ): Promise<
    ApiResponse<{
      tailored_resume: import("../types/resume").TailoredFullResume;
    }>
  > {
    const submitResp = await this.request<{ job_id: string }>(
      "/resume/regenerate",
      {
        method: "POST",
        body: JSON.stringify({
          tailored_resume: tailoredResume,
          jd_analysis: jdAnalysis,
          user_feedback: userFeedback,
        }),
      },
      30000,
    );
    if (submitResp.error) return { error: submitResp.error };
    if (!submitResp.data?.job_id)
      return { error: "Failed to submit regeneration job" };

    return this.pollJob<{
      tailored_resume: import("../types/resume").TailoredFullResume;
    }>(submitResp.data.job_id, 120000, signal);
  }

  async rewriteBullet(
    bullet: string,
    jobTitle?: string,
    company?: string,
    jdKeywords?: string[],
  ): Promise<ApiResponse<{ rewritten: string }>> {
    return this.request("/resume/rewrite-bullet", {
      method: "POST",
      body: JSON.stringify({
        bullet,
        job_title: jobTitle || "",
        company: company || "",
        jd_keywords: jdKeywords || [],
      }),
    });
  }

  async fetchATSScores(
    tailoredResume: import("../types/resume").TailoredFullResume,
    jdAnalysis: import("../types/resume").JDAnalysis,
    signal?: AbortSignal,
  ): Promise<ApiResponse<{ ats_scores: import("../types/resume").ATSScores }>> {
    const submitResp = await this.request<{ job_id: string }>(
      "/resume/ats-scores",
      {
        method: "POST",
        body: JSON.stringify({
          tailored_resume: tailoredResume,
          jd_analysis: jdAnalysis,
        }),
      },
      30000,
    );
    if (submitResp.error) return { error: submitResp.error };
    if (!submitResp.data?.job_id) return { error: "Failed to submit job" };

    return this.pollJob<{ ats_scores: import("../types/resume").ATSScores }>(
      submitResp.data.job_id,
      120000,
      signal,
    );
  }

  async saveTailoringRecord(data: {
    record_id?: string;
    jd_text?: string;
    jd_analysis?: any;
    tailored_resume?: any;
    ats_scores?: any;
    base_resume_filename?: string;
    base_resume_s3_key?: string;
  }): Promise<ApiResponse<{ record_id: string; updated?: boolean }>> {
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      tz = undefined;
    }
    return this.request("/resume/save-record", {
      method: "POST",
      body: JSON.stringify({ ...data, tz }),
    });
  }

  // ============================================
  // Resume management endpoints
  // ============================================

  async listBaseResumes(): Promise<ApiResponse<{ versions: any[] }>> {
    return this.request("/resume/versions");
  }

  async listGeneratedResumes(): Promise<ApiResponse<{ generated: any[] }>> {
    return this.request("/resume/generated");
  }

  async listTailoringRecords(): Promise<ApiResponse<{ records: any[] }>> {
    return this.request("/resume/tailoring-records");
  }

  async getApplicationStreak(): Promise<
    ApiResponse<{
      current_streak: number;
      longest_streak: number;
      today_count: number;
      total_applications: number;
      last_application_date: string | null;
      heatmap: { date: string; count: number }[];
    }>
  > {
    let tz = "";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      tz = "";
    }
    const qs = tz ? `?tz=${encodeURIComponent(tz)}` : "";
    return this.request(`/resume/streak${qs}`);
  }

  async batchTailor(
    jdList: { text: string; title: string }[],
  ): Promise<ApiResponse<{ jobs: { job_id: string; title: string }[] }>> {
    return this.request(
      "/resume/batch-tailor",
      {
        method: "POST",
        body: JSON.stringify({ jd_list: jdList }),
      },
      30000,
    );
  }

  async generateCoverLetter(
    tailoredResume: import("../types/resume").TailoredFullResume,
    jdAnalysis: import("../types/resume").JDAnalysis,
    signal?: AbortSignal,
  ): Promise<ApiResponse<{ cover_letter: string }>> {
    const submitResp = await this.request<{ job_id: string }>(
      "/resume/cover-letter",
      {
        method: "POST",
        body: JSON.stringify({
          tailored_resume: tailoredResume,
          jd_analysis: jdAnalysis,
        }),
      },
      30000,
    );
    if (submitResp.error) return { error: submitResp.error };
    if (!submitResp.data?.job_id) return { error: "Failed to submit job" };

    return this.pollJob<{ cover_letter: string }>(
      submitResp.data.job_id,
      120000,
      signal,
    );
  }

  async downloadCoverLetterPDF(
    coverLetter: string,
    candidateName: string,
    jobTitle: string,
    company: string,
  ): Promise<{ data?: Blob; error?: string; filename?: string }> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
      const resp = await fetch(`${this.baseURL}/resume/cover-letter/download`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          cover_letter: coverLetter,
          candidate_name: candidateName,
          job_title: jobTitle,
          company,
        }),
      });
      if (!resp.ok) {
        const err = await resp
          .json()
          .catch(() => ({ error: "Download failed" }));
        return { error: err.error || "Download failed" };
      }
      const blob = await resp.blob();
      const cd = resp.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/);
      return { data: blob, filename: match?.[1] || "cover_letter.pdf" };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Download failed" };
    }
  }

  async pollJobStatus<T>(
    jobId: string,
  ): Promise<ApiResponse<T & { status: string }>> {
    const resp = await this.request<
      T & { status: string; error?: string; error_code?: string }
    >(`/resume/job/${jobId}`);
    if (resp.data?.error_code === "LLM_RETRIES_EXHAUSTED") {
      notifyLLMRetriesExhausted();
      resp.data = { ...resp.data, error: "" };
    }
    return resp;
  }

  async getTechChronicle(category: string = "all"): Promise<
    ApiResponse<{
      items: import("../types/techChronicle").TechChronicleItem[];
      trendingTags: string[];
      generatedAt: string | null;
    }>
  > {
    return this.request(
      `/tech-chronicle?category=${encodeURIComponent(category)}`,
    );
  }

  async setActiveResume(s3Key: string): Promise<ApiResponse<any>> {
    return this.request("/resume/active", {
      method: "PUT",
      body: JSON.stringify({ s3_key: s3Key }),
    });
  }

  async deleteResume(s3Key: string): Promise<ApiResponse<any>> {
    return this.request(`/resume/file/${encodeURIComponent(s3Key)}`, {
      method: "DELETE",
    });
  }

  async downloadResumeFile(s3Key: string): Promise<Blob> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch(
      `${this.baseURL}/resume/download-file/${encodeURIComponent(s3Key)}`,
      {
        headers,
      },
    );
    if (!response.ok) throw new Error("Download failed");
    return response.blob();
  }

  async downloadTailoredResume(
    tailoredResume: import("../types/resume").TailoredFullResume,
    jdAnalysis: import("../types/resume").JDAnalysis,
    format: "pdf" | "docx",
    opts?: {
      recordId?: string;
      versionId?: string;
      source?: "initial" | "regenerated" | "edited";
      autoSaveOnEdit?: boolean;
    },
  ): Promise<{ data?: Blob; error?: string; filename?: string }> {
    const token = this.getToken();
    const url = `${this.baseURL}/resume/download`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          tailored_resume: tailoredResume,
          jd_analysis: jdAnalysis,
          format,
          job_title: jdAnalysis.job_title || "untitled",
          record_id: opts?.recordId,
          version_id: opts?.versionId,
          source: opts?.source,
          auto_save_on_edit: opts?.autoSaveOnEdit ?? true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return { error: errData.error || `HTTP ${response.status}` };
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `resume.${format}`;
      return { data: blob, filename };
    } catch (error) {
      clearTimeout(timeoutId);
      return {
        error: error instanceof Error ? error.message : "Download failed",
      };
    }
  }

  // ============================================
  // Tailoring record versioning
  // ============================================

  async saveResumeVersion(
    recordId: string,
    data: {
      tailored_resume: import("../types/resume").TailoredFullResume;
      source: "initial" | "regenerated" | "edited";
      user_feedback?: string;
      ats_scores?: import("../types/resume").ATSScores;
      parent_version_id?: string;
      set_current?: boolean;
    },
  ): Promise<
    ApiResponse<{
      version_id: string;
      version_number: number;
      content_hash: string;
      created: boolean;
    }>
  > {
    return this.request(`/resume/tailoring-records/${recordId}/versions`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async setCurrentResumeVersion(
    recordId: string,
    versionId: string,
  ): Promise<ApiResponse<{ current_version_id: string }>> {
    return this.request(
      `/resume/tailoring-records/${recordId}/current-version`,
      {
        method: "PUT",
        body: JSON.stringify({ version_id: versionId }),
      },
    );
  }

  async getTailoringRecord(
    recordId: string,
  ): Promise<ApiResponse<{ record: any }>> {
    return this.request(`/resume/tailoring-records/${recordId}`);
  }

  async deleteTailoringRecord(
    recordId: string,
  ): Promise<ApiResponse<any>> {
    return this.request(`/resume/tailoring-records/${recordId}`, {
      method: "DELETE",
    });
  }

  async updateApplication(
    recordId: string,
    patch: {
      status?:
        | "draft"
        | "applied"
        | "interviewing"
        | "offer"
        | "rejected"
        | "withdrawn"
        | "ghosted";
      applied_at?: string | null;
      next_action_date?: string | null;
      next_action_note?: string;
      notes?: string;
      recruiter_name?: string;
      recruiter_email?: string;
      recruiter_company?: string;
      job_url?: string;
      interview_dates?: string[];
    },
  ): Promise<ApiResponse<{ application: any }>> {
    return this.request(
      `/resume/tailoring-records/${recordId}/application`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
      },
    );
  }

  async generateInterviewPrep(
    recordId: string,
    opts?: { force?: boolean },
  ): Promise<
    ApiResponse<{
      interview_prep: {
        content: import("../types/resume").InterviewPrepContent;
        generated_at: string;
        grounded_version_id?: string;
      };
      cached: boolean;
    }>
  > {
    return this.request(
      `/resume/tailoring-records/${recordId}/interview-prep`,
      {
        method: "POST",
        body: JSON.stringify({ force: !!opts?.force }),
      },
      90000,
    );
  }

  async getPracticeQuestion(
    recordId: string,
    body: {
      category: "behavioral" | "technical" | "company" | "coding"
        | "system_design" | "case_study" | "data_challenge";
      difficulty: import("../types/resume").QDifficulty;
      seen_titles?: string[];
      focus?: string;
    },
  ): Promise<ApiResponse<{ category: string; difficulty: string; question: any }>> {
    return this.request(
      `/resume/tailoring-records/${recordId}/practice-question`,
      { method: "POST", body: JSON.stringify(body) },
      60000,
    );
  }

  async chatWithCoach(
    recordId: string,
    message: string,
  ): Promise<ApiResponse<{ reply: string; messages: import("../types/resume").ChatMessage[] }>> {
    return this.request(
      `/resume/tailoring-records/${recordId}/chat`,
      { method: "POST", body: JSON.stringify({ message }) },
      60000,
    );
  }

  async resetCoachChat(
    recordId: string,
  ): Promise<ApiResponse<{ messages: import("../types/resume").ChatMessage[] }>> {
    return this.request(
      `/resume/tailoring-records/${recordId}/chat`,
      { method: "POST", body: JSON.stringify({ reset: true }) },
    );
  }

  async getCoachChat(
    recordId: string,
  ): Promise<ApiResponse<{ messages: import("../types/resume").ChatMessage[] }>> {
    return this.request(`/resume/tailoring-records/${recordId}/chat`);
  }

  // --- Career Copilot (multi-agent RAG + playground) /api/resume/career-copilot ---

  async getCareerCopilotState(): Promise<
    ApiResponse<{
      has_resume: boolean;
      messages: Array<{
        role: string;
        content: string;
        at?: string;
        id?: string;
        meta?: unknown;
      }>;
      suggested_prompts: string[];
      next_best_actions: Array<{ title: string; reason: string }>;
      playground: Record<string, unknown>;
      tracks: Array<{
        id: string;
        title: string;
        description: string;
        steps: Array<{ title: string; type: string; body: string }>;
      }>;
      last_tab?: string;
      visits?: Record<string, number>;
      topics?: Record<string, number>;
    }>
  > {
    return this.request("/resume/career-copilot/state", {}, 20000);
  }

  async sendCareerCopilotMessage(
    message: string,
    jdPaste?: string,
  ): Promise<
    ApiResponse<{
      ok: boolean;
      reply: string;
      pipeline: Array<{ agent: string; label: string; summary: string }>;
      citations: Array<{ id: string; snippet: string }>;
      rag_grounding: string;
      suggested_prompts: string[];
      next_best_actions: Array<{ title: string; reason: string }>;
      compliance: string;
      messages: Array<{
        role: string;
        content: string;
        at?: string;
        id?: string;
        meta?: unknown;
      }>;
    }>
  > {
    return this.request(
      "/resume/career-copilot/chat",
      {
        method: "POST",
        body: JSON.stringify({
          message,
          jd_paste: jdPaste?.trim() || "",
        }),
      },
      120000,
    );
  }

  async resetCareerCopilotChat(): Promise<ApiResponse<{ ok: boolean; cleared?: boolean }>> {
    return this.request(
      "/resume/career-copilot/chat",
      { method: "POST", body: JSON.stringify({ reset: true }) },
      30000,
    );
  }

  async recordCareerCopilotTab(tab: string): Promise<ApiResponse<{ ok: boolean }>> {
    return this.request(
      "/resume/career-copilot/behavior",
      { method: "POST", body: JSON.stringify({ tab }) },
      15000,
    );
  }

  async startPlaygroundTrack(body: {
    track_id?: string;
    custom_topic?: string;
  }): Promise<ApiResponse<{ ok: boolean; error?: string; playground?: Record<string, unknown> }>> {
    return this.request(
      "/resume/career-copilot/playground/start",
      { method: "POST", body: JSON.stringify(body) },
      120000,
    );
  }

  async advancePlaygroundStep(): Promise<
    ApiResponse<{ ok: boolean; error?: string; playground?: Record<string, unknown> }>
  > {
    return this.request(
      "/resume/career-copilot/playground/advance",
      { method: "POST", body: "{}" },
      30000,
    );
  }

  async resetPlaygroundTrack(): Promise<ApiResponse<{ ok: boolean }>> {
    return this.request(
      "/resume/career-copilot/playground/reset",
      { method: "POST", body: "{}" },
      15000,
    );
  }

  // --- Outreach Campaign methods ---

  async getOutreachCampaigns(): Promise<ApiResponse<{
    campaigns: Array<{
      campaign_id: string;
      target_company: string;
      target_role: string;
      channel: string;
      contacts: Array<{ name: string; title: string; notes: string }>;
      sequence: Array<{
        step: number;
        action: string;
        template: string;
        status: string;
        sent_at: string | null;
        notes: string;
      }>;
      status: string;
      created_at: string;
    }>;
  }>> {
    return this.request("/resume/career-copilot/outreach/campaigns");
  }

  async createOutreachCampaign(body: {
    target_company: string;
    target_role: string;
    contacts?: Array<{ name: string; title: string; notes: string }>;
    channel: string;
  }): Promise<ApiResponse<{ ok: boolean; campaign: any }>> {
    return this.request(
      "/resume/career-copilot/outreach/create",
      { method: "POST", body: JSON.stringify(body) },
      30000,
    );
  }

  async generateOutreachSequence(body: {
    company: string;
    role: string;
    channel: string;
  }): Promise<ApiResponse<{
    ok: boolean;
    sequence: Array<{ step: number; action: string; template: string }>;
  }>> {
    return this.request(
      "/resume/career-copilot/outreach/generate-sequence",
      { method: "POST", body: JSON.stringify(body) },
      120000,
    );
  }

  async updateOutreachStep(
    campaignId: string,
    body: { step_index: number; status: string; notes?: string },
  ): Promise<ApiResponse<{ ok: boolean; campaign: any }>> {
    return this.request(
      `/resume/career-copilot/outreach/${campaignId}/step`,
      { method: "PATCH", body: JSON.stringify(body) },
      15000,
    );
  }

  // --- Memory methods ---

  async getMemoryNotes(): Promise<ApiResponse<{ notes: Record<string, string> }>> {
    return this.request("/resume/career-copilot/memory");
  }

  async saveMemoryNote(key: string, value: string): Promise<ApiResponse<{ ok: boolean }>> {
    return this.request(
      "/resume/career-copilot/memory",
      { method: "POST", body: JSON.stringify({ key, value }) },
      15000,
    );
  }

  async deleteMemoryNote(key: string): Promise<ApiResponse<{ ok: boolean }>> {
    return this.request(
      `/resume/career-copilot/memory/${encodeURIComponent(key)}`,
      { method: "DELETE" },
      15000,
    );
  }

  // --- Timeline ---

  async getCopilotTimeline(limit?: number): Promise<ApiResponse<{
    events: Array<{ type: string; description: string; timestamp: string }>;
  }>> {
    const q = limit ? `?limit=${limit}` : "";
    return this.request(`/resume/career-copilot/timeline${q}`);
  }

  // --- Playground quiz/assessment ---

  async generatePlaygroundQuiz(body: {
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    count: number;
  }): Promise<ApiResponse<{
    ok: boolean;
    questions: Array<{
      question: string;
      options: string[];
      correct_index: number;
      explanation: string;
    }>;
  }>> {
    return this.request(
      "/resume/career-copilot/playground/quiz",
      { method: "POST", body: JSON.stringify(body) },
      120000,
    );
  }

  async evaluatePlaygroundAnswer(body: {
    question: string;
    user_answer: string;
  }): Promise<ApiResponse<{
    ok: boolean;
    score: number;
    feedback: string;
    model_answer: string;
  }>> {
    return this.request(
      "/resume/career-copilot/playground/evaluate",
      { method: "POST", body: JSON.stringify(body) },
      60000,
    );
  }

  // --- Job Intelligence ---

  async getStaleApplications(days = 5): Promise<ApiResponse<{
    ok: boolean;
    count: number;
    stale_applications: Array<{
      record_id: string;
      job_title: string;
      company: string;
      status: string;
      days_stale: number;
      applied_at?: string;
      next_action_date?: string;
    }>;
  }>> {
    return this.request(`/resume/career-copilot/intelligence/stale?days=${days}`);
  }

  async generateIntelligenceFollowup(body: {
    record_id: string;
    channel?: "email" | "linkedin";
  }): Promise<ApiResponse<{
    ok: boolean;
    channel: string;
    followup: { subject: string; message: string; tone: string; next_step: string };
  }>> {
    return this.request(
      "/resume/career-copilot/intelligence/followup",
      { method: "POST", body: JSON.stringify(body) },
      45000,
    );
  }

  async getFunnelAnalytics(): Promise<ApiResponse<{
    ok: boolean;
    counts: Record<string, number>;
    conversions: Record<string, number>;
    insight: { headline: string; insight: string; action_items: string[] };
  }>> {
    return this.request("/resume/career-copilot/intelligence/funnel");
  }

  async getRejectionInsights(): Promise<ApiResponse<{
    ok: boolean;
    total: number;
    patterns: Array<{ theme: string; evidence: string }>;
    suggestions: string[];
  }>> {
    return this.request("/resume/career-copilot/intelligence/rejection-insights", {}, 45000);
  }

  async reframeRejection(record_id: string): Promise<ApiResponse<{
    ok: boolean;
    reframe: {
      acknowledgement: string;
      what_went_right: string;
      next_actions: string[];
      silver_lining: string;
    };
  }>> {
    return this.request(
      "/resume/career-copilot/intelligence/reframe",
      { method: "POST", body: JSON.stringify({ record_id }) },
      45000,
    );
  }

  async getWeeklyDigest(): Promise<ApiResponse<{
    ok: boolean;
    stats: { events_this_week: number; events_last_week: number };
    digest: {
      headline: string;
      summary: string;
      wins: string[];
      focus_for_next_week: string[];
    };
  }>> {
    return this.request("/resume/career-copilot/intelligence/weekly-digest", {}, 45000);
  }

  // --- Momentum ---

  async getMomentumData(): Promise<ApiResponse<{
    ok: boolean;
    streak: number;
    momentum_score: number;
    trend: "up" | "down";
    this_week: number;
    last_week: number;
    milestones: Array<{ id: string; label: string; earned: boolean }>;
    heatmap: Array<{ date: string; count: number }>;
  }>> {
    return this.request("/resume/career-copilot/momentum");
  }

  async recordMomentumActivity(
    activity_type: string,
    metadata?: Record<string, unknown>,
  ): Promise<ApiResponse<{ ok: boolean }>> {
    return this.request(
      "/resume/career-copilot/momentum/activity",
      { method: "POST", body: JSON.stringify({ activity_type, metadata: metadata || {} }) },
      15000,
    );
  }

  // --- Networking CRM ---

  async getNetworkContacts(): Promise<ApiResponse<{ ok: boolean; contacts: any[] }>> {
    return this.request("/resume/career-copilot/network/contacts");
  }

  async addNetworkContact(body: {
    name: string;
    company?: string;
    role?: string;
    platform?: string;
    relationship_strength?: string;
    notes?: string;
    last_contacted?: string;
    referral_status?: string;
  }): Promise<ApiResponse<{ ok: boolean; contact: any }>> {
    return this.request(
      "/resume/career-copilot/network/contacts",
      { method: "POST", body: JSON.stringify(body) },
      20000,
    );
  }

  async updateNetworkContact(
    contactId: string,
    body: Record<string, unknown>,
  ): Promise<ApiResponse<{ ok: boolean; contact: any }>> {
    return this.request(
      `/resume/career-copilot/network/contacts/${encodeURIComponent(contactId)}`,
      { method: "PUT", body: JSON.stringify(body) },
      20000,
    );
  }

  async deleteNetworkContact(contactId: string): Promise<ApiResponse<{ ok: boolean }>> {
    return this.request(
      `/resume/career-copilot/network/contacts/${encodeURIComponent(contactId)}`,
      { method: "DELETE" },
      15000,
    );
  }

  async generateNetworkIntro(contact_id: string): Promise<ApiResponse<{
    ok: boolean;
    intro: { message: string; subject: string; tone: string };
  }>> {
    return this.request(
      "/resume/career-copilot/network/generate-intro",
      { method: "POST", body: JSON.stringify({ contact_id }) },
      45000,
    );
  }

  async getNetworkingInsights(): Promise<ApiResponse<{
    ok: boolean;
    insights: { headline: string; analysis: string; actions: string[] };
  }>> {
    return this.request("/resume/career-copilot/network/insights", {}, 45000);
  }

  // --- Offer Workspace ---

  async getOffers(): Promise<ApiResponse<{ ok: boolean; offers: any[] }>> {
    return this.request("/resume/career-copilot/offers");
  }

  async addOffer(body: Record<string, unknown>): Promise<ApiResponse<{ ok: boolean; offer: any }>> {
    return this.request(
      "/resume/career-copilot/offers",
      { method: "POST", body: JSON.stringify(body) },
      20000,
    );
  }

  async updateOffer(
    offerId: string,
    body: Record<string, unknown>,
  ): Promise<ApiResponse<{ ok: boolean; offer: any }>> {
    return this.request(
      `/resume/career-copilot/offers/${encodeURIComponent(offerId)}`,
      { method: "PUT", body: JSON.stringify(body) },
      20000,
    );
  }

  async deleteOffer(offerId: string): Promise<ApiResponse<{ ok: boolean }>> {
    return this.request(
      `/resume/career-copilot/offers/${encodeURIComponent(offerId)}`,
      { method: "DELETE" },
      15000,
    );
  }

  async compareOffers(): Promise<ApiResponse<{
    ok: boolean;
    offers: any[];
    comparison: {
      headline: string;
      recommendation: string;
      pros_cons: Array<{ company: string; pros: string[]; cons: string[] }>;
      total_comp_table: Array<{ company: string; total_comp: number }>;
    };
  }>> {
    return this.request("/resume/career-copilot/offers/compare", {}, 60000);
  }

  async generateNegotiationScript(
    offer_id: string,
    ask: string,
  ): Promise<ApiResponse<{
    ok: boolean;
    script: {
      email_subject: string;
      email_body: string;
      talking_points: string[];
      fallback_if_denied: string;
    };
  }>> {
    return this.request(
      "/resume/career-copilot/offers/negotiate",
      { method: "POST", body: JSON.stringify({ offer_id, ask }) },
      60000,
    );
  }

  async evaluateMockAnswer(
    recordId: string,
    body: { question: string; user_answer: string; category?: string },
  ): Promise<ApiResponse<{ evaluation: import("../types/resume").MockEvaluation }>> {
    return this.request(
      `/resume/tailoring-records/${recordId}/mock-evaluate`,
      { method: "POST", body: JSON.stringify(body) },
      60000,
    );
  }

  // ============================================
  // Admin endpoints (/api/admin)
  // ============================================

  async getAdminStats() {
    return this.request<{
      total_users: number;
      users_7d: number;
      users_30d: number;
      total_parsed_resumes: number;
      total_base_resumes: number;
      legacy_generated_resumes: number;
      total_tailoring_sessions: number;
      tailoring_7d: number;
      tailoring_30d: number;
      total_versions: number;
      cached_pdf_files: number;
      cached_docx_files: number;
      total_applications: number;
      applications_by_status: Record<string, number>;
      total_interview_prep_packs: number;
    }>("/admin/stats");
  }

  async getAdminUsers() {
    return this.request<{
      users: Array<{
        id: string;
        email: string;
        name: string | null;
        role: string | null;
        sector: string | null;
        created_at: string | null;
        last_login: string | null;
        last_login_ip: string | null;
        login_attempts: number;
        base_resumes: number;
        generated_resumes: number;
        tailoring_sessions: number;
        has_parsed_resume: boolean;
      }>;
    }>("/admin/users");
  }

  async getAdminUserDetail(email: string) {
    return this.request<{
      user: {
        id: string;
        email: string;
        name: string | null;
        role: string | null;
        sector: string | null;
        created_at: string | null;
        last_login: string | null;
        last_login_ip: string | null;
        login_attempts: number;
        fingerprint_hash: string | null;
        session_id: string | null;
      };
      parsed_resume: any;
      base_resumes: any[];
      generated_resumes: any[];
      tailoring_records: any[];
    }>(`/admin/user/${encodeURIComponent(email)}`);
  }

  async getAdminResumes() {
    return this.request<{ resumes: any[] }>("/admin/resumes");
  }

  async getAdminTailoring(opts?: { status?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (opts?.status) params.set("status", opts.status);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return this.request<{ records: any[] }>(
      `/admin/tailoring${qs ? `?${qs}` : ""}`,
    );
  }

  async getAdminTailoringDetail(
    recordId: string,
    includeCurrentResume = false,
  ) {
    const qs = includeCurrentResume ? "?include_current_resume=1" : "";
    return this.request<{ record: any }>(
      `/admin/tailoring/${encodeURIComponent(recordId)}${qs}`,
    );
  }

  async getAdminApplications(status?: string) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request<{ applications: any[] }>(`/admin/applications${qs}`);
  }

  async getAdminInterviewPrep() {
    return this.request<{ prep_packs: any[] }>("/admin/interview-prep");
  }

  async getAdminResumeUrl(
    s3Key: string,
    disposition: "inline" | "attachment" = "inline",
    filename?: string,
  ) {
    let url = `/admin/resume-url?s3_key=${encodeURIComponent(s3Key)}&disposition=${disposition}`;
    if (filename) url += `&filename=${encodeURIComponent(filename)}`;
    return this.request<{ url: string; content_type: string }>(url);
  }

  async getAdminActivity() {
    return this.request<{
      activities: Array<{
        type: string;
        email: string;
        name?: string;
        detail?: string;
        company?: string;
        ats_score?: number;
        timestamp: string;
      }>;
    }>("/admin/activity");
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
      const response = await fetch(url, { cache: "no-store" });
      const fetchEnd = performance.now();

      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }

      const serverData = await response.json();
      const totalMs = Math.round((fetchEnd - fetchStart) * 100) / 100;

      // Get Resource Timing entry for this specific request
      const entries = performance.getEntriesByType(
        "resource",
      ) as PerformanceResourceTiming[];
      const entry = entries.find((e) => e.name.includes("/trace"));

      // Helper: safely compute duration from Resource Timing (handles cross-origin zeroes)
      const safeDelta = (a: number, b: number, max: number) => {
        if (!a || !b || a <= 0 || b <= 0) return 0;
        const d = Math.round((a - b) * 100) / 100;
        return d > 0 && d < max ? d : 0;
      };

      const client = {
        total_ms: totalMs,
        dns_ms: entry
          ? safeDelta(entry.domainLookupEnd, entry.domainLookupStart, totalMs)
          : 0,
        tcp_tls_ms: entry
          ? safeDelta(entry.connectEnd, entry.connectStart, totalMs)
          : 0,
        ttfb_ms: entry
          ? safeDelta(entry.responseStart, entry.requestStart, totalMs)
          : 0,
        download_ms: entry
          ? safeDelta(entry.responseEnd, entry.responseStart, totalMs)
          : 0,
      };

      return {
        data: {
          ...serverData,
          client,
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Trace request failed",
      };
    }
  }

  async traceDeepRequest(): Promise<ApiResponse<DeepTraceResult>> {
    const url = `${this.baseURL}/trace/deep`;

    performance.clearResourceTimings();

    try {
      const fetchStart = performance.now();
      const response = await fetch(url, { cache: "no-store" });
      const fetchEnd = performance.now();

      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }

      const serverData = await response.json();
      const totalMs = Math.round((fetchEnd - fetchStart) * 100) / 100;

      const entries = performance.getEntriesByType(
        "resource",
      ) as PerformanceResourceTiming[];
      const entry = entries.find((e) => e.name.includes("/trace/deep"));

      const safeDelta = (a: number, b: number, max: number) => {
        if (!a || !b || a <= 0 || b <= 0) return 0;
        const d = Math.round((a - b) * 100) / 100;
        return d > 0 && d < max ? d : 0;
      };

      const client = {
        total_ms: totalMs,
        dns_ms: entry
          ? safeDelta(entry.domainLookupEnd, entry.domainLookupStart, totalMs)
          : 0,
        tcp_tls_ms: entry
          ? safeDelta(entry.connectEnd, entry.connectStart, totalMs)
          : 0,
        ttfb_ms: entry
          ? safeDelta(entry.responseStart, entry.requestStart, totalMs)
          : 0,
        download_ms: entry
          ? safeDelta(entry.responseEnd, entry.responseStart, totalMs)
          : 0,
      };

      return {
        data: {
          ...serverData,
          client,
        },
      };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Deep trace request failed",
      };
    }
  }

  async tracePageLoad(): Promise<ApiResponse<PageLoadTraceResult>> {
    const url = `${this.baseURL}/trace/pageload`;

    try {
      // 1. Collect Navigation Timing (the actual page load)
      const navEntries = performance.getEntriesByType(
        "navigation",
      ) as PerformanceNavigationTiming[];
      const nav = navEntries[0];

      const navigation = nav
        ? {
            dns_ms:
              Math.round((nav.domainLookupEnd - nav.domainLookupStart) * 100) /
              100,
            tcp_ms: Math.round((nav.connectEnd - nav.connectStart) * 100) / 100,
            tls_ms:
              nav.secureConnectionStart > 0
                ? Math.round(
                    (nav.connectEnd - nav.secureConnectionStart) * 100,
                  ) / 100
                : 0,
            ttfb_ms:
              Math.round((nav.responseStart - nav.requestStart) * 100) / 100,
            document_download_ms:
              Math.round((nav.responseEnd - nav.responseStart) * 100) / 100,
            dom_parse_ms:
              Math.round((nav.domInteractive - nav.responseEnd) * 100) / 100,
            dom_interactive_ms: Math.round(nav.domInteractive * 100) / 100,
            page_load_ms:
              Math.round(
                (nav.loadEventEnd > 0 ? nav.loadEventEnd : performance.now()) *
                  100,
              ) / 100,
            redirect_ms:
              Math.round((nav.redirectEnd - nav.redirectStart) * 100) / 100,
            transfer_size: nav.transferSize || 0,
          }
        : {
            dns_ms: 0,
            tcp_ms: 0,
            tls_ms: 0,
            ttfb_ms: 0,
            document_download_ms: 0,
            dom_parse_ms: 0,
            dom_interactive_ms: 0,
            page_load_ms: Math.round(performance.now() * 100) / 100,
            redirect_ms: 0,
            transfer_size: 0,
          };

      // 2. Collect Resource Timing (all loaded assets)
      const allResources = performance.getEntriesByType(
        "resource",
      ) as PerformanceResourceTiming[];

      const categorize = (
        entries: PerformanceResourceTiming[],
        filter: (e: PerformanceResourceTiming) => boolean,
      ) =>
        entries
          .filter(filter)
          .map((e) => ({
            name: e.name.split("/").pop()?.split("?")[0] || e.name,
            duration: Math.round(e.duration * 100) / 100,
            size: e.transferSize || 0,
          }))
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 5);

      const scripts = categorize(
        allResources,
        (e) => e.initiatorType === "script" || e.name.endsWith(".js"),
      );
      const styles = categorize(
        allResources,
        (e) =>
          e.initiatorType === "link" &&
          (e.name.endsWith(".css") || e.name.includes(".css")),
      );
      const apiCalls = categorize(allResources, (e) =>
        e.name.includes("/api/"),
      );
      const fonts = categorize(
        allResources,
        (e) =>
          e.initiatorType === "css" ||
          e.name.match(/\.(woff2?|ttf|otf)/) !== null,
      );

      const totalTransferKb = Math.round(
        allResources.reduce((sum, e) => sum + (e.transferSize || 0), 0) / 1024,
      );

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
      const response = await fetch(url, { cache: "no-store" });
      const fetchEnd = performance.now();

      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }

      const serverData = await response.json();
      const totalMs = Math.round((fetchEnd - fetchStart) * 100) / 100;

      const entries = performance.getEntriesByType(
        "resource",
      ) as PerformanceResourceTiming[];
      const entry = entries.find((e) => e.name.includes("/trace/pageload"));

      const safeDelta = (a: number, b: number, max: number) => {
        if (!a || !b || a <= 0 || b <= 0) return 0;
        const d = Math.round((a - b) * 100) / 100;
        return d > 0 && d < max ? d : 0;
      };

      const client = {
        total_ms: totalMs,
        dns_ms: entry
          ? safeDelta(entry.domainLookupEnd, entry.domainLookupStart, totalMs)
          : 0,
        tcp_tls_ms: entry
          ? safeDelta(entry.connectEnd, entry.connectStart, totalMs)
          : 0,
        ttfb_ms: entry
          ? safeDelta(entry.responseStart, entry.requestStart, totalMs)
          : 0,
        download_ms: entry
          ? safeDelta(entry.responseEnd, entry.responseStart, totalMs)
          : 0,
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
        error:
          error instanceof Error ? error.message : "Page load trace failed",
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
    deploySandboxMessage(
      message: string,
      color: string,
    ): Promise<ApiResponse<any>>;
    getSandboxStatus(): Promise<ApiResponse<SandboxStatus>>;
    getLatestSandboxMessage(): Promise<ApiResponse<SandboxLatest>>;
  }
}

Object.assign(ApiService.prototype, {
  async deploySandboxMessage(this: ApiService, message: string, color: string) {
    return this["request"]("/infra/sandbox/deploy", {
      method: "POST",
      body: JSON.stringify({ message, color }),
    });
  },

  async getSandboxStatus(this: ApiService) {
    return this["request"]("/infra/sandbox/status", {
      method: "GET",
    });
  },

  async getLatestSandboxMessage(this: ApiService) {
    return this["request"]("/infra/sandbox/latest", {
      method: "GET",
    });
  },

  // ============================================
  // Ephemeral Preview Environments (admin)
  // ============================================
  async listAdminEnvironments(this: ApiService, opts?: { fresh?: boolean }) {
    const qs = opts?.fresh ? "?fresh=true" : "";
    return this["request"]<{
      environments: Array<{
        branch_slug: string;
        pr_number?: number | string;
        head_ref?: string;
        actor?: string;
        status?: string;
        frontend_url?: string;
        api_url?: string;
        api_id?: string;
        layer_version_arn?: string;
        mongo_db?: string;
        created_at?: string;
        last_seen_at?: string;
        gh_run_id?: string;
        resource_arns?: string[];
      }>;
      count: number;
    }>(`/admin/environments${qs}`);
  },

  async teardownAdminEnvironment(this: ApiService, slug: string) {
    return this["request"]<{ ok: boolean; slug: string; status: string }>(
      `/admin/environments/${encodeURIComponent(slug)}/teardown`,
      { method: "POST" }
    );
  },
});

export const apiService = new ApiService(API_BASE_URL);

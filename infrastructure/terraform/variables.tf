# =============================================================================
# Input Variables
# =============================================================================

variable "aws_region" {
  description = "AWS region for deploying resources"
  type        = string
  default     = "us-east-1" # Required for CloudFront ACM certificates
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "portfolio"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "domain_name" {
  description = "Primary domain name"
  type        = string
  default     = "manneharshithsiddardha.com"
}

# =============================================================================
# Backend Configuration Variables
# =============================================================================

variable "mongodb_uri" {
  description = "MongoDB Atlas connection URI"
  type        = string
  sensitive   = true
}

variable "jwt_secret_key" {
  description = "JWT secret key for authentication"
  type        = string
  sensitive   = true
}

variable "ipinfo_token" {
  description = "IPInfo.io API token for geolocation"
  type        = string
  sensitive   = true
  default     = ""
}

variable "gemini_api_key" {
  description = "Google Gemini API key for AI chatbot"
  type        = string
  sensitive   = true
  default     = ""
}

variable "jsearch_api_key" {
  description = "JSearch RapidAPI key for job search"
  type        = string
  sensitive   = true
  default     = ""
}

variable "apify_api_key" {
  description = "Apify API token for job listing scrapers"
  type        = string
  sensitive   = true
  default     = ""
}

variable "apify_actor_memory_mb" {
  description = "Memory assigned to standard Apify actor runs used by job search"
  type        = number
  default     = 1024
}

variable "apify_company_actor_memory_mb" {
  description = "Memory assigned to heavier company-career Apify actor runs"
  type        = number
  default     = 1024
}

variable "apify_linkedin_actor" {
  description = "Optional Apify actor id for LinkedIn job scraping"
  type        = string
  default     = "curious_coder/linkedin-jobs-scraper"
}

variable "apify_workday_actor" {
  description = "Optional Apify actor id for Workday job scraping"
  type        = string
  default     = "fantastic-jobs/workday-jobs-api"
}

variable "apify_indeed_actor" {
  description = "Optional Apify actor id for Indeed job scraping"
  type        = string
  default     = ""
}

variable "apify_google_actor" {
  description = "Optional Apify actor id for Google Jobs scraping"
  type        = string
  default     = ""
}

variable "apify_company_actor" {
  description = "Optional Apify actor id for company career page scraping"
  type        = string
  default     = ""
}

variable "apify_jobright_actor" {
  description = "Optional Apify actor id for Jobright job scraping"
  type        = string
  default     = ""
}

variable "job_search_password_hash" {
  description = "Bcrypt hash of the job search dashboard password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_pat" {
  description = "GitHub PAT for triggering CI/CD Sandbox sandbox.yml"
  type        = string
  sensitive   = true
  default     = ""
}

# =============================================================================
# Gmail Integration (Applications-tab auto-status from inbox)
# =============================================================================

variable "google_oauth_client_id" {
  description = "Google Cloud OAuth 2.0 Web client ID (for Gmail readonly scope)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_oauth_client_secret" {
  description = "Google Cloud OAuth 2.0 client secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_oauth_redirect_uri" {
  description = "OAuth redirect URI registered in the Google Cloud client. Must match exactly. Defaults to https://<domain_name>/oauth/gmail/callback when left empty."
  type        = string
  default     = ""
}

variable "gmail_token_encryption_key" {
  description = "Fernet key (or any string; hashed to 32 bytes) used to encrypt Gmail refresh tokens at rest. Generate with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'. ROTATING THIS KEY INVALIDATES ALL EXISTING GMAIL LINKS."
  type        = string
  sensitive   = true
  default     = ""
}

# Lambda memory/timeout are configured per-service in lambda.tf locals.services

# =============================================================================
# Feature Flags
# =============================================================================

variable "enable_waf" {
  description = "Enable AWS WAF for additional security"
  type        = bool
  default     = false # Set to true for additional security (adds cost)
}

variable "enable_logging" {
  description = "Enable CloudWatch logging for Lambda and API Gateway"
  type        = bool
  default     = true
}

# =============================================================================
# Ephemeral Preview Environments
# =============================================================================

variable "enable_preview_infra" {
  description = "Provision the shared scaffolding for per-PR preview environments (wildcard cert, shared CloudFront, shared S3 bucket, DynamoDB tracking table, scoped CI role)."
  type        = bool
  default     = false
}

variable "preview_subdomain_prefix" {
  description = "Subdomain segment under which preview envs are addressed: {slug}.{prefix}.{domain}"
  type        = string
  default     = "preview"
}

variable "preview_idle_days" {
  description = "Days of inactivity before the reaper tears down a preview env"
  type        = number
  default     = 7
}

variable "preview_github_repo" {
  description = "GitHub repo (owner/name) used for workflow_dispatch teardown calls from the dashboard"
  type        = string
  default     = ""
}

variable "preview_github_pat" {
  description = "GitHub PAT used by the dashboard backend to trigger preview-down.yml via workflow_dispatch. Stored in SSM."
  type        = string
  sensitive   = true
  default     = ""
}

# =============================================================================
# Grafana (GCP-hosted) Integration
# =============================================================================

variable "enable_grafana" {
  description = "Create IAM user with read-only CloudWatch/X-Ray access for Grafana on GCP"
  type        = bool
  default     = false
}

variable "grafana_gcp_ip" {
  description = "Static IP of the Grafana instance on GCP (for DNS record)"
  type        = string
  default     = ""
}

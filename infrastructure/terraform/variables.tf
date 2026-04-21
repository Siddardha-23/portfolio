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
  description = "Memory assigned to Apify actor runs used by job search"
  type        = number
  default     = 1024
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

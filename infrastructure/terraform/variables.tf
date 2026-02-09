# =============================================================================
# Input Variables
# =============================================================================

variable "aws_region" {
  description = "AWS region for deploying resources"
  type        = string
  default     = "us-east-1"  # Required for CloudFront ACM certificates
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

variable "lambda_memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 512
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 30
}

# =============================================================================
# Feature Flags
# =============================================================================

variable "enable_waf" {
  description = "Enable AWS WAF for additional security"
  type        = bool
  default     = false  # Set to true for additional security (adds cost)
}

variable "enable_logging" {
  description = "Enable CloudWatch logging for Lambda and API Gateway"
  type        = bool
  default     = true
}

# =============================================================================
# AWS Systems Manager Parameter Store for Secrets
# =============================================================================
# Using SSM Parameter Store (SecureString) for sensitive values
# This is FREE for standard parameters and integrates with Lambda natively
# =============================================================================

# -----------------------------------------------------------------------------
# MongoDB URI (SecureString - encrypted with AWS KMS)
# -----------------------------------------------------------------------------
resource "aws_ssm_parameter" "mongodb_uri" {
  name        = "/${var.project_name}/${var.environment}/mongodb-uri"
  description = "MongoDB Atlas connection URI"
  type        = "SecureString"
  value       = var.mongodb_uri
  tier        = "Standard"  # Free tier

  tags = {
    Name        = "${var.project_name}-mongodb-uri"
    Environment = var.environment
  }

  lifecycle {
    ignore_changes = [value]  # Don't update if value changes in console
  }
}

# -----------------------------------------------------------------------------
# JWT Secret Key (SecureString)
# -----------------------------------------------------------------------------
resource "aws_ssm_parameter" "jwt_secret" {
  name        = "/${var.project_name}/${var.environment}/jwt-secret-key"
  description = "JWT secret key for authentication"
  type        = "SecureString"
  value       = var.jwt_secret_key
  tier        = "Standard"

  tags = {
    Name        = "${var.project_name}-jwt-secret"
    Environment = var.environment
  }

  lifecycle {
    ignore_changes = [value]
  }
}

# -----------------------------------------------------------------------------
# IPInfo Token (SecureString - optional)
# -----------------------------------------------------------------------------
resource "aws_ssm_parameter" "ipinfo_token" {
  count       = var.ipinfo_token != "" ? 1 : 0
  
  name        = "/${var.project_name}/${var.environment}/ipinfo-token"
  description = "IPInfo.io API token for geolocation"
  type        = "SecureString"
  value       = var.ipinfo_token
  tier        = "Standard"

  tags = {
    Name        = "${var.project_name}-ipinfo-token"
    Environment = var.environment
  }

  lifecycle {
    ignore_changes = [value]
  }
}

# -----------------------------------------------------------------------------
# Gemini API Key (SecureString - optional)
# -----------------------------------------------------------------------------
resource "aws_ssm_parameter" "gemini_api_key" {
  count       = var.gemini_api_key != "" ? 1 : 0

  name        = "/${var.project_name}/${var.environment}/gemini-api-key"
  description = "Google Gemini API key for AI chatbot"
  type        = "SecureString"
  value       = var.gemini_api_key
  tier        = "Standard"

  tags = {
    Name        = "${var.project_name}-gemini-api-key"
    Environment = var.environment
  }

  lifecycle {
    ignore_changes = [value]
  }
}

# -----------------------------------------------------------------------------
# JSearch API Key (SecureString - optional)
# -----------------------------------------------------------------------------
resource "aws_ssm_parameter" "jsearch_api_key" {
  count       = var.jsearch_api_key != "" ? 1 : 0

  name        = "/${var.project_name}/${var.environment}/jsearch-api-key"
  description = "JSearch RapidAPI key for job search"
  type        = "SecureString"
  value       = var.jsearch_api_key
  tier        = "Standard"

  tags = {
    Name        = "${var.project_name}-jsearch-api-key"
    Environment = var.environment
  }

  lifecycle {
    ignore_changes = [value]
  }
}

# -----------------------------------------------------------------------------
# Job Search Password Hash (SecureString - optional)
# -----------------------------------------------------------------------------
resource "aws_ssm_parameter" "job_search_password_hash" {
  count       = var.job_search_password_hash != "" ? 1 : 0

  name        = "/${var.project_name}/${var.environment}/job-search-password-hash"
  description = "Bcrypt hash of the job search dashboard password"
  type        = "SecureString"
  value       = var.job_search_password_hash
  tier        = "Standard"

  tags = {
    Name        = "${var.project_name}-job-search-password-hash"
    Environment = var.environment
  }

  lifecycle {
    ignore_changes = [value]
  }
}

# -----------------------------------------------------------------------------
# GitHub PAT (SecureString - optional)
# -----------------------------------------------------------------------------
resource "aws_ssm_parameter" "github_pat" {
  count       = var.github_pat != "" ? 1 : 0

  name        = "/${var.project_name}/${var.environment}/github-pat"
  description = "GitHub PAT for triggering CI/CD Sandbox sandbox.yml"
  type        = "SecureString"
  value       = var.github_pat
  tier        = "Standard"

  tags = {
    Name        = "${var.project_name}-github-pat"
    Environment = var.environment
  }

  lifecycle {
    ignore_changes = [value]
  }
}

# -----------------------------------------------------------------------------
# Non-sensitive Configuration (String - not encrypted)
# -----------------------------------------------------------------------------
resource "aws_ssm_parameter" "allowed_origins" {
  name        = "/${var.project_name}/${var.environment}/allowed-origins"
  description = "CORS allowed origins"
  type        = "String"
  value       = "https://${var.domain_name},https://www.${var.domain_name}"
  tier        = "Standard"

  tags = {
    Name        = "${var.project_name}-allowed-origins"
    Environment = var.environment
  }
}

resource "aws_ssm_parameter" "environment" {
  name        = "/${var.project_name}/${var.environment}/environment"
  description = "Current environment name"
  type        = "String"
  value       = var.environment
  tier        = "Standard"

  tags = {
    Name        = "${var.project_name}-environment"
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# Outputs for reference
# -----------------------------------------------------------------------------
output "ssm_parameter_paths" {
  description = "SSM Parameter Store paths"
  sensitive   = true
  value = {
    mongodb_uri              = aws_ssm_parameter.mongodb_uri.name
    jwt_secret               = aws_ssm_parameter.jwt_secret.name
    ipinfo_token             = var.ipinfo_token != "" ? aws_ssm_parameter.ipinfo_token[0].name : "not configured"
    gemini_api_key           = var.gemini_api_key != "" ? aws_ssm_parameter.gemini_api_key[0].name : "not configured"
    jsearch_api_key          = var.jsearch_api_key != "" ? aws_ssm_parameter.jsearch_api_key[0].name : "not configured"
    job_search_password_hash = var.job_search_password_hash != "" ? aws_ssm_parameter.job_search_password_hash[0].name : "not configured"
    github_pat               = var.github_pat != "" ? aws_ssm_parameter.github_pat[0].name : "not configured"
    allowed_origins          = aws_ssm_parameter.allowed_origins.name
    environment              = aws_ssm_parameter.environment.name
  }
}

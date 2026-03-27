# =============================================================================
# Input Variables
# =============================================================================

variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
}

variable "gcp_region" {
  description = "GCP region (us-west1, us-central1, us-east1 eligible for always-free e2-micro)"
  type        = string
  default     = "us-east1"
}

variable "gcp_zone" {
  description = "GCP zone within the region"
  type        = string
  default     = "us-east1-b"
}

variable "project_name" {
  description = "Project name (used for resource naming)"
  type        = string
  default     = "portfolio"
}

# =============================================================================
# AWS Credentials (from AWS Terraform outputs)
# =============================================================================

variable "aws_access_key_id" {
  description = "AWS access key ID for Grafana CloudWatch data source"
  type        = string
  sensitive   = true
}

variable "aws_secret_access_key" {
  description = "AWS secret access key for Grafana CloudWatch data source"
  type        = string
  sensitive   = true
}

variable "aws_region" {
  description = "AWS region where Lambda/CloudWatch resources are deployed"
  type        = string
  default     = "us-east-1"
}

# =============================================================================
# Grafana Configuration
# =============================================================================

variable "grafana_admin_password" {
  description = "Grafana admin password (change from default on first login)"
  type        = string
  sensitive   = true
  default     = "admin"
}

# =============================================================================
# Grafana on GCP - Main Configuration
# =============================================================================
# Self-hosted Grafana on a GCE e2-micro (always-free tier) that monitors
# AWS Lambda, API Gateway, and X-Ray via CloudWatch data sources.
#
# Architecture: AWS (Lambda/CloudWatch) <-- IAM keys --> GCP (Grafana/GCE)
# =============================================================================

terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
  zone    = var.gcp_zone
}

# =============================================================================
# Portfolio Infrastructure - Main Configuration
# Architecture: S3 + CloudFront + Lambda + API Gateway
# Domain: manneharshithsiddardha.com
# =============================================================================

terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    datadog = {
      source  = "DataDog/datadog"
      version = "~> 3.50"
    }
  }

  backend "s3" {
    bucket       = "portfolio-terraform-state-024230653681"
    key          = "portfolio/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

# Primary provider - us-east-1 required for CloudFront ACM certificates
provider "aws" {
  region = var.aws_region

  # Local terraform uses AWS_PROFILE env var (set to "personal" for admin-perm bootstraps).
  # CI runs without a profile (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars).

  default_tags {
    tags = {
      Project     = "portfolio"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "harshith"
    }
  }
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# =============================================================================
# Local Variables
# =============================================================================

locals {
  domain_name   = var.domain_name
  api_subdomain = "api.${var.domain_name}"
  www_subdomain = "www.${var.domain_name}"

  # S3 bucket names must be globally unique
  frontend_bucket_name = "${var.project_name}-frontend-${data.aws_caller_identity.current.account_id}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

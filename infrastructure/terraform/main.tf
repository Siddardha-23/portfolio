# =============================================================================
# Portfolio Infrastructure - Main Configuration
# Architecture: S3 + CloudFront + Lambda + API Gateway
# Domain: manneharshithsiddardha.com
# =============================================================================

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment to use S3 backend for state management (recommended for production)
  # backend "s3" {
  #   bucket         = "portfolio-terraform-state"
  #   key            = "portfolio/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

# Primary provider - us-east-1 required for CloudFront ACM certificates
provider "aws" {
  region = var.aws_region
  
  # Use named profile for local development
  # Comment this out if using environment variables or IAM role
  profile = "portfolio"

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
  domain_name     = var.domain_name
  api_subdomain   = "api.${var.domain_name}"
  www_subdomain   = "www.${var.domain_name}"
  
  # S3 bucket names must be globally unique
  frontend_bucket_name = "${var.project_name}-frontend-${data.aws_caller_identity.current.account_id}"
  
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

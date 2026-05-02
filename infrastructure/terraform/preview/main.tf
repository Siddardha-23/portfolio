# =============================================================================
# Per-PR Preview Environment - root
# =============================================================================
# One Terraform workspace per branch slug. State key is keyed on the workspace
# name so multiple PRs do not collide.
#
# Backend:    S3 + DynamoDB lock (configure backend.tfvars at one-time bootstrap)
# Workspace:  $branch_slug (created/selected by preview-up.yml)
# Inputs:     branch_slug, pr_number, head_ref, actor, layer_version_arn
#             (everything else is read from prod via terraform_remote_state)
# =============================================================================

terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # The CI workflow runs:
  #   terraform init -backend-config=backend.hcl
  # backend.hcl is generated from preview-up.yml using TF_BACKEND_BUCKET +
  # TF_BACKEND_LOCK_TABLE secrets. Workspaces partition the key automatically.
  backend "s3" {
    key     = "preview/terraform.tfstate"
    encrypt = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project         = var.project_name
      Purpose         = "ephemeral-previews"
      EphemeralBranch = var.branch_slug
      PR              = tostring(var.pr_number)
      ManagedBy       = "terraform"
    }
  }
}

# -----------------------------------------------------------------------------
# Read prod state to reuse: lambda role, layer, ssm params, zones, shared CF/S3.
# -----------------------------------------------------------------------------
data "terraform_remote_state" "prod" {
  backend = "s3"

  config = {
    bucket = var.prod_state_bucket
    key    = var.prod_state_key
    region = var.aws_region
  }
}

locals {
  prod = data.terraform_remote_state.prod.outputs

  # Strip empty values from the SSM map so we don't push empty env vars.
  ssm_param_names = {
    for k, v in local.prod.ssm_param_names : k => v if v != ""
  }

  # Atlas caps database names at 38 bytes; the slug is already prefixed with "pr-"
  # by slugify.sh and capped at ~30 chars, so the slug-with-underscores stays well
  # under the limit. Hyphens converted because Mongo DB names with '-' are unusual.
  mongo_db_name = replace(var.branch_slug, "-", "_")
}

module "ephemeral" {
  source = "../modules/ephemeral"

  project_name             = var.project_name
  aws_region               = var.aws_region
  domain_name              = var.domain_name
  preview_subdomain_prefix = var.preview_subdomain_prefix

  branch_slug = var.branch_slug
  pr_number   = var.pr_number
  head_ref    = var.head_ref
  actor       = var.actor

  layer_version_arn = var.layer_version_arn
  lambda_role_arn   = local.prod.lambda_role_arn
  route53_zone_id   = local.prod.route53_zone_id

  ssm_parameter_names = local.ssm_param_names

  preview_shared_bucket        = local.prod.preview_shared_bucket
  preview_distribution_domain  = local.prod.preview_distribution_domain
  preview_distribution_zone_id = local.prod.preview_distribution_zone_id

  mongo_db_name = local.mongo_db_name
}

output "preview_url" {
  value = module.ephemeral.preview_url
}

output "api_url" {
  value = module.ephemeral.api_url
}

output "api_id" {
  value = module.ephemeral.api_id
}

output "lambda_function_names" {
  value = module.ephemeral.lambda_function_names
}

output "fqdn" {
  value = module.ephemeral.fqdn
}

output "mongo_db_name" {
  value = local.mongo_db_name
}

output "preview_distribution_id" {
  value = local.prod.preview_distribution_id
}

output "preview_shared_bucket" {
  value = local.prod.preview_shared_bucket
}

output "preview_ddb_table" {
  value = local.prod.preview_ddb_table
}

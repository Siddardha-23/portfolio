variable "project_name" {
  description = "Root project name (matches root Terraform var.project_name)"
  type        = string
  default     = "portfolio"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "domain_name" {
  description = "Apex domain"
  type        = string
}

variable "preview_subdomain_prefix" {
  description = "Preview zone segment - {slug}.{prefix}.{domain}"
  type        = string
  default     = "preview"
}

variable "branch_slug" {
  description = "Sanitized branch slug (already lowercased, dashed, pr- prefixed, length-capped)"
  type        = string
}

variable "pr_number" {
  description = "GitHub PR number"
  type        = number
}

variable "head_ref" {
  description = "Original branch ref (for tagging / dashboard display)"
  type        = string
  default     = ""
}

variable "actor" {
  description = "GitHub actor who triggered the PR (for tagging)"
  type        = string
  default     = ""
}

variable "layer_version_arn" {
  description = "Pinned Lambda Layer version ARN. Captured at PR-open time so that prod redeploys mid-PR don't rebase the preview onto a new layer."
  type        = string
}

variable "lambda_role_arn" {
  description = "Existing prod Lambda execution role ARN to reuse"
  type        = string
}

variable "ssm_parameter_names" {
  description = "Map of env-var name -> SSM parameter name for prod-shared secrets that previews reference read-only."
  type        = map(string)
}

variable "preview_shared_bucket" {
  description = "Shared S3 bucket name (per-prefix per env)"
  type        = string
}

variable "preview_distribution_domain" {
  description = "Shared preview CloudFront distribution domain (target of the alias record)"
  type        = string
}

variable "preview_distribution_zone_id" {
  description = "Hosted zone id of the shared preview CloudFront distribution"
  type        = string
}

variable "route53_zone_id" {
  description = "Route53 hosted zone id for the apex domain"
  type        = string
}

variable "mongo_db_name" {
  description = "Per-env MongoDB database name (e.g. portfolio_pr_<slug>)"
  type        = string
}

variable "service_specs" {
  description = "Per-service config: memory and timeout (in seconds). Service keys must match handler names."
  type = map(object({
    memory  = number
    timeout = number
  }))
  default = {
    visitor     = { memory = 128, timeout = 30 }
    auth        = { memory = 128, timeout = 15 }
    jobs-resume = { memory = 256, timeout = 60 }
    chat        = { memory = 192, timeout = 60 }
    infra       = { memory = 128, timeout = 30 }
  }
}

variable "extra_env_vars" {
  description = "Additional environment variables shared by all preview lambdas (non-secret)"
  type        = map(string)
  default     = {}
}

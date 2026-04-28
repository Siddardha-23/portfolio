variable "project_name" {
  type    = string
  default = "portfolio"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "domain_name" {
  type    = string
  default = "manneharshithsiddardha.com"
}

variable "preview_subdomain_prefix" {
  type    = string
  default = "preview"
}

variable "branch_slug" {
  description = "Sanitized branch slug (set by CI from scripts/slugify.sh)"
  type        = string
}

variable "pr_number" {
  type = number
}

variable "head_ref" {
  type    = string
  default = ""
}

variable "actor" {
  type    = string
  default = ""
}

variable "layer_version_arn" {
  description = "Pinned shared Lambda Layer ARN captured at PR-open time (CI passes this in)"
  type        = string
}

variable "prod_state_bucket" {
  description = "S3 bucket holding the prod terraform state (read via terraform_remote_state)"
  type        = string
}

variable "prod_state_key" {
  description = "Key of the prod terraform state file"
  type        = string
  default     = "portfolio/terraform.tfstate"
}

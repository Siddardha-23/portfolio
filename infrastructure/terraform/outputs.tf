# =============================================================================
# Terraform Outputs
# =============================================================================

# Frontend
output "frontend_bucket_name" {
  description = "S3 bucket name for frontend"
  value       = aws_s3_bucket.frontend.id
}

output "frontend_bucket_arn" {
  description = "S3 bucket ARN for frontend"
  value       = aws_s3_bucket.frontend.arn
}

# CloudFront
output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

# Lambda Functions (microservices)
output "lambda_function_names" {
  description = "Lambda function names for all services"
  value       = { for k, v in aws_lambda_function.service : k => v.function_name }
}

output "lambda_function_arns" {
  description = "Lambda function ARNs for all services"
  value       = { for k, v in aws_lambda_function.service : k => v.arn }
}

output "lambda_layer_arn" {
  description = "Shared Lambda Layer ARN"
  value       = aws_lambda_layer_version.shared.arn
}

# API Gateway
output "api_gateway_url" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_api.backend.api_endpoint
}

output "api_gateway_id" {
  description = "API Gateway ID"
  value       = aws_apigatewayv2_api.backend.id
}

# Domain
output "website_url" {
  description = "Primary website URL"
  value       = "https://${var.domain_name}"
}

output "api_url" {
  description = "API URL (through CloudFront)"
  value       = "https://${var.domain_name}/api"
}

# Summary
output "deployment_summary" {
  description = "Deployment summary"
  value       = <<-EOT

    Portfolio Deployment Complete (Microservices Architecture)
    =========================================================

    Website:     https://${var.domain_name}
    API:         https://${var.domain_name}/api
    Health:      https://${var.domain_name}/api/health

    S3 Bucket:   ${aws_s3_bucket.frontend.id}
    CloudFront:  ${aws_cloudfront_distribution.frontend.id}

    Lambda Functions:
    %{for k, v in aws_lambda_function.service~}
      - ${v.function_name} (${local.services[k].description})
    %{endfor~}

    Shared Layer: ${aws_lambda_layer_version.shared.layer_name} v${aws_lambda_layer_version.shared.version}

    Secrets: AWS SSM Parameter Store
    Path:    /${var.project_name}/${var.environment}/*

  EOT
}

# Preview env wiring (consumed by per-PR root via terraform_remote_state)
output "lambda_role_arn" {
  description = "Prod Lambda execution role ARN - reused by preview lambdas"
  value       = aws_iam_role.lambda.arn
}

output "route53_zone_id" {
  description = "Hosted zone id for the primary domain"
  value       = data.aws_route53_zone.main.zone_id
}

output "ssm_param_names" {
  description = "Prod SSM parameter names that preview lambdas reference read-only"
  # Marked sensitive because some referenced SSM parameters are SecureStrings,
  # and the provider propagates sensitivity through the .name attribute. The
  # values here are just parameter *names* (not secret material).
  sensitive = true
  value = {
    SSM_MONGODB_URI              = aws_ssm_parameter.mongodb_uri.name
    SSM_JWT_SECRET               = aws_ssm_parameter.jwt_secret.name
    SSM_IPINFO_TOKEN             = var.ipinfo_token != "" ? aws_ssm_parameter.ipinfo_token[0].name : ""
    SSM_GEMINI_API_KEY           = var.gemini_api_key != "" ? aws_ssm_parameter.gemini_api_key[0].name : ""
    SSM_JSEARCH_API_KEY          = var.jsearch_api_key != "" ? aws_ssm_parameter.jsearch_api_key[0].name : ""
    SSM_APIFY_API_KEY            = var.apify_api_key != "" ? aws_ssm_parameter.apify_api_key[0].name : ""
    SSM_JOB_SEARCH_PASSWORD_HASH = var.job_search_password_hash != "" ? aws_ssm_parameter.job_search_password_hash[0].name : ""
    SSM_GITHUB_PAT               = var.github_pat != "" ? aws_ssm_parameter.github_pat[0].name : ""
  }
}

# Grafana on GCP
output "grafana_aws_access_key_id" {
  description = "AWS access key ID for Grafana CloudWatch data source"
  value       = var.enable_grafana ? aws_iam_access_key.grafana[0].id : ""
  sensitive   = true
}

output "grafana_aws_secret_access_key" {
  description = "AWS secret access key for Grafana CloudWatch data source"
  value       = var.enable_grafana ? aws_iam_access_key.grafana[0].secret : ""
  sensitive   = true
}

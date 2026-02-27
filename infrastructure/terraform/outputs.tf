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

# Lambda
output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.backend.function_name
}

output "lambda_function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.backend.arn
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
  value = <<-EOT

    ╔══════════════════════════════════════════════════════════════╗
    ║              PORTFOLIO DEPLOYMENT COMPLETE                     ║
    ╠══════════════════════════════════════════════════════════════╣
    ║                                                                ║
    ║  🌐 Website:     https://${var.domain_name}
    ║  🔗 API:         https://${var.domain_name}/api
    ║  📊 Health:      https://${var.domain_name}/api/health
    ║                                                                ║
    ║  📦 S3 Bucket:   ${aws_s3_bucket.frontend.id}
    ║  ⚡ Lambda:      ${aws_lambda_function.backend.function_name}
    ║  🚀 CloudFront:  ${aws_cloudfront_distribution.frontend.id}
    ║                                                                ║
    ║  🔐 Secrets:     AWS SSM Parameter Store                       ║
    ║     Path:        /${var.project_name}/${var.environment}/*
    ║                                                                ║
    ╚══════════════════════════════════════════════════════════════╝

    📋 Bitbucket Variables Needed:
    ────────────────────────────────────────────────────────────────
    S3_BUCKET_NAME=${aws_s3_bucket.frontend.id}
    CLOUDFRONT_DISTRIBUTION_ID=${aws_cloudfront_distribution.frontend.id}
    LAMBDA_FUNCTION_NAME=${aws_lambda_function.backend.function_name}
    DOMAIN_NAME=${var.domain_name}

  EOT
}

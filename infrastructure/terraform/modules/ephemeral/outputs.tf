output "preview_url" {
  value       = "https://${local.preview_fqdn}"
  description = "Public URL for this preview env"
}

output "api_url" {
  value       = aws_apigatewayv2_api.preview.api_endpoint
  description = "Direct API Gateway endpoint (CloudFront proxies via X-Preview-Slug)"
}

output "api_id" {
  value       = aws_apigatewayv2_api.preview.id
  description = "Preview API Gateway id (used by preview-down.yml to drain traffic before destroy)"
}

output "lambda_function_names" {
  value       = { for k, fn in aws_lambda_function.service : k => fn.function_name }
  description = "Map of service -> preview Lambda function name (CI uses these for code update)"
}

output "branch_slug" {
  value = var.branch_slug
}

output "fqdn" {
  value = local.preview_fqdn
}

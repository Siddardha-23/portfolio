# =============================================================================
# Ephemeral Preview Environment - per-PR module
# Creates: 5 Lambdas, 1 API Gateway HTTP API, 1 Route53 alias record.
# Reuses: prod Lambda role, prod SSM secrets, pinned Lambda Layer ARN, shared
# preview CloudFront, shared preview S3 bucket (one prefix per env).
# =============================================================================

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  preview_fqdn = "${var.branch_slug}.${var.preview_subdomain_prefix}.${var.domain_name}"

  common_tags = {
    Project         = var.project_name
    Purpose         = "ephemeral-previews"
    EphemeralBranch = var.branch_slug
    PR              = tostring(var.pr_number)
    HeadRef         = var.head_ref
    Actor           = var.actor
    ManagedBy       = "terraform"
  }

  # Service -> common env vars merged below in each lambda definition.
  base_env_vars = merge(
    {
      ENVIRONMENT     = "preview"
      ALLOWED_ORIGINS = "https://${local.preview_fqdn}"
      LOG_LEVEL       = "INFO"
      AWS_REGION_NAME = var.aws_region
      USE_SSM_SECRETS = "true"
      DB_NAME         = var.mongo_db_name
      PREVIEW_SLUG    = var.branch_slug
    },
    var.extra_env_vars,
    var.ssm_parameter_names,
  )

  # Per-PR placeholder zip - each function name passed in for clarity.
  service_names = keys(var.service_specs)
}

# Per-service placeholder zip (CI overwrites with real code on first apply)
data "archive_file" "placeholder" {
  for_each = var.service_specs

  type        = "zip"
  output_path = "${path.module}/.terraform-tmp/placeholder-${var.branch_slug}-${each.key}.zip"

  source {
    filename = "lambda_handler.py"
    content  = <<-PY
      def handler(event, context):
          return {
              "statusCode": 200,
              "body": "preview placeholder: ${each.key} (${var.branch_slug})",
          }
    PY
  }
}

resource "aws_cloudwatch_log_group" "service" {
  for_each = var.service_specs

  name              = "/aws/lambda/${var.project_name}-preview-${var.branch_slug}-${each.key}"
  retention_in_days = 7
  tags              = local.common_tags
}

resource "aws_lambda_function" "service" {
  for_each = var.service_specs

  function_name = "${var.project_name}-preview-${var.branch_slug}-${each.key}"
  role          = var.lambda_role_arn
  handler       = "lambda_handler.handler"
  runtime       = "python3.12"
  architectures = ["arm64"]
  memory_size   = each.value.memory
  timeout       = each.value.timeout
  description   = "Preview ${each.key} for ${var.branch_slug} (PR #${var.pr_number})"

  filename         = data.archive_file.placeholder[each.key].output_path
  source_code_hash = data.archive_file.placeholder[each.key].output_base64sha256

  layers = [var.layer_version_arn]

  environment {
    variables = merge(
      local.base_env_vars,
      {
        SERVICE_NAME = each.key
      }
    )
  }

  tracing_config {
    mode = "Active"
  }

  tags = merge(local.common_tags, { Service = each.key })

  lifecycle {
    # CI overwrites code on every push; don't fight it.
    ignore_changes = [filename, source_code_hash]
  }

  depends_on = [aws_cloudwatch_log_group.service]
}

# =============================================================================
# API Gateway HTTP API (per-PR)
# =============================================================================

resource "aws_apigatewayv2_api" "preview" {
  name          = "${var.project_name}-preview-${var.branch_slug}"
  protocol_type = "HTTP"
  description   = "Preview API for ${var.branch_slug} (PR #${var.pr_number})"

  cors_configuration {
    allow_origins     = ["https://${local.preview_fqdn}"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    allow_headers     = ["Content-Type", "Authorization", "X-Preview-Slug"]
    allow_credentials = true
    max_age           = 3600
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.preview.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 50
    throttling_rate_limit  = 25
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "service" {
  for_each = var.service_specs

  api_id                 = aws_apigatewayv2_api.preview.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.service[each.key].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# Route table mirrors prod: see infrastructure/terraform/lambda.tf locals.api_routes
locals {
  api_routes = {
    "POST /api/info"            = "visitor"
    "ANY /api/info/{proxy+}"    = "visitor"
    "ANY /api/session/{proxy+}" = "visitor"
    "POST /api/contact"         = "visitor"
    "ANY /api/contact/{proxy+}" = "visitor"
    "ANY /api/geo/{proxy+}"     = "visitor"
    "POST /api/geo/lookup"      = "visitor"
    "GET /api/health"           = "visitor"

    "ANY /api/auth/{proxy+}"  = "auth"
    "ANY /api/admin/{proxy+}" = "auth"

    "ANY /api/jobs/{proxy+}"           = "jobs-resume"
    "ANY /api/resume/{proxy+}"         = "jobs-resume"
    "GET /api/tech-chronicle"          = "jobs-resume"
    "ANY /api/tech-chronicle/{proxy+}" = "jobs-resume"

    "POST /api/chat"         = "chat"
    "ANY /api/chat/{proxy+}" = "chat"

    "ANY /api/infra/{proxy+}" = "infra"
    "GET /api/trace"          = "infra"
    "ANY /api/trace/{proxy+}" = "infra"
  }
}

resource "aws_apigatewayv2_route" "service" {
  for_each = local.api_routes

  api_id    = aws_apigatewayv2_api.preview.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.service[each.value].id}"
}

resource "aws_lambda_permission" "api_gateway" {
  for_each = var.service_specs

  statement_id  = "AllowAPIGwInvokePreview-${var.branch_slug}-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.service[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.preview.execution_arn}/*/*"
}

# =============================================================================
# Route53 alias record - {slug}.preview.{domain} -> shared CloudFront
# =============================================================================

resource "aws_route53_record" "preview_alias" {
  zone_id = var.route53_zone_id
  name    = local.preview_fqdn
  type    = "A"

  alias {
    name                   = var.preview_distribution_domain
    zone_id                = var.preview_distribution_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "preview_alias_v6" {
  zone_id = var.route53_zone_id
  name    = local.preview_fqdn
  type    = "AAAA"

  alias {
    name                   = var.preview_distribution_domain
    zone_id                = var.preview_distribution_zone_id
    evaluate_target_health = false
  }
}

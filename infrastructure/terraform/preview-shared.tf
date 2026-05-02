# =============================================================================
# Ephemeral Preview Environments - Shared Scaffolding
# =============================================================================
# One-time shared infrastructure that all per-PR preview envs reuse:
#   - Wildcard ACM cert for *.{prefix}.{domain}
#   - Shared CloudFront distribution with viewer-request CloudFront Function
#     that routes {slug}.{prefix}.{domain} to S3 prefix /{slug}/* and to the
#     correct preview API Gateway via a custom origin header.
#   - Shared S3 bucket with per-prefix 14-day lifecycle as a safety net.
#   - DynamoDB tracking table (operational index; AWS tags are source of truth).
#   - Scoped IAM role for CI to manage preview resources by name+tag only.
#   - SSM param holding the GitHub PAT for dashboard-triggered teardown.
#
# Toggle with: var.enable_preview_infra = true
# =============================================================================

locals {
  preview_enabled       = var.enable_preview_infra
  preview_zone_apex     = "${var.preview_subdomain_prefix}.${var.domain_name}"
  preview_wildcard_fqdn = "*.${local.preview_zone_apex}"
  preview_bucket_name   = "${var.project_name}-preview-shared-${data.aws_caller_identity.current.account_id}"
  preview_ddb_name      = "${var.project_name}-ephemeral-envs"
}

# -----------------------------------------------------------------------------
# Wildcard ACM cert for *.preview.{domain}
# -----------------------------------------------------------------------------
resource "aws_acm_certificate" "preview" {
  count = local.preview_enabled ? 1 : 0

  domain_name       = local.preview_wildcard_fqdn
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name    = "${var.project_name}-preview-cert"
    Purpose = "ephemeral-previews"
  }
}

resource "aws_route53_record" "preview_cert_validation" {
  for_each = local.preview_enabled ? {
    for dvo in aws_acm_certificate.preview[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
}

resource "aws_acm_certificate_validation" "preview" {
  count = local.preview_enabled ? 1 : 0

  certificate_arn         = aws_acm_certificate.preview[0].arn
  validation_record_fqdns = [for r in aws_route53_record.preview_cert_validation : r.fqdn]
}

# -----------------------------------------------------------------------------
# Shared S3 bucket for all preview frontends (one prefix per env)
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "preview_shared" {
  count = local.preview_enabled ? 1 : 0

  bucket = local.preview_bucket_name

  tags = {
    Name    = local.preview_bucket_name
    Purpose = "ephemeral-previews"
  }
}

resource "aws_s3_bucket_public_access_block" "preview_shared" {
  count = local.preview_enabled ? 1 : 0

  bucket                  = aws_s3_bucket.preview_shared[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "preview_shared" {
  count = local.preview_enabled ? 1 : 0

  bucket = aws_s3_bucket.preview_shared[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "preview_shared" {
  count = local.preview_enabled ? 1 : 0

  bucket = aws_s3_bucket.preview_shared[0].id

  # Safety net: any preview prefix older than 14 days gets cleaned up even if
  # preview-down.yml fails to empty it. Reaper should normally delete first.
  rule {
    id     = "expire-stale-previews"
    status = "Enabled"

    expiration {
      days = 14
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

# -----------------------------------------------------------------------------
# CloudFront Function: rewrite {slug}.preview.{domain}/path -> /{slug}/path
# for S3 origin, and forward an X-Preview-Slug header for the API origin so
# our wrapper Lambda routes to the right preview API Gateway.
# -----------------------------------------------------------------------------
resource "aws_cloudfront_function" "preview_rewrite" {
  count = local.preview_enabled ? 1 : 0

  name    = "${var.project_name}-preview-rewrite"
  runtime = "cloudfront-js-2.0"
  comment = "Rewrites {slug}.preview.{domain} to S3 prefix /{slug}/* and tags API requests with X-Preview-Slug"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var req = event.request;
      var host = req.headers.host && req.headers.host.value ? req.headers.host.value : "";
      var parts = host.split(".");
      // Expect: {slug}.${var.preview_subdomain_prefix}.{...domain...}
      if (parts.length < 3 || parts[1] !== "${var.preview_subdomain_prefix}") {
        return req;
      }
      var slug = parts[0];
      // Tag every request with the slug so origin handlers (API router Lambda) can dispatch.
      req.headers["x-preview-slug"] = { value: slug };

      var uri = req.uri;
      // Rewrite /api/<path> -> /api/preview-route/<path> so prod's API Gateway
      // routes the request to the infra service's preview_router blueprint,
      // which proxies it to the per-PR API Gateway based on X-Preview-Slug.
      if (uri.indexOf("/api/") === 0) {
        req.uri = "/api/preview-route" + uri.substring(4);
        return req;
      }
      // Static asset (has a file extension) -> /{slug}{uri}
      // SPA route or root -> /{slug}/index.html (lets React Router handle it client-side).
      var hasExtension = /\.[a-zA-Z0-9]+$/.test(uri);
      if (uri === "/" || uri === "" || !hasExtension) {
        req.uri = "/" + slug + "/index.html";
      } else {
        req.uri = "/" + slug + uri;
      }
      return req;
    }
  EOT
}

# -----------------------------------------------------------------------------
# CloudFront OAC for the shared preview bucket
# -----------------------------------------------------------------------------
resource "aws_cloudfront_origin_access_control" "preview_shared" {
  count = local.preview_enabled ? 1 : 0

  name                              = "${var.project_name}-preview-shared-oac"
  description                       = "OAC for shared preview S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# -----------------------------------------------------------------------------
# Shared preview CloudFront distribution
# -----------------------------------------------------------------------------
# The API origin is the prod-side router Lambda exposed via API Gateway. The
# router Lambda inspects X-Preview-Slug and proxies the request to the matching
# preview API Gateway. We point the API origin at the prod API Gateway; routing
# is implemented in the infra service blueprint (preview_router.py) which
# handles ANY /api/preview-route/* and proxies to the correct preview env.
#
# Initially the API origin can also be the prod API Gateway itself; the Lambda
# router decides what to do based on the X-Preview-Slug header.
# -----------------------------------------------------------------------------
resource "aws_cloudfront_distribution" "preview_shared" {
  count = local.preview_enabled ? 1 : 0

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Portfolio shared preview environments"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  aliases = [local.preview_wildcard_fqdn]

  origin {
    domain_name              = aws_s3_bucket.preview_shared[0].bucket_regional_domain_name
    origin_id                = "S3-Preview-Shared"
    origin_access_control_id = aws_cloudfront_origin_access_control.preview_shared[0].id
  }

  origin {
    # Prod API GW hosts the preview-router blueprint that fans out to per-PR APIs.
    domain_name = replace(aws_apigatewayv2_api.backend.api_endpoint, "https://", "")
    origin_id   = "API-Preview-Router"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-Preview-Shared"
    cache_policy_id  = local.cloudfront_cache_policy_caching_optimized

    viewer_protocol_policy = "redirect-to-https"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.preview_rewrite[0].arn
    }
  }

  ordered_cache_behavior {
    path_pattern             = "/api/*"
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = "API-Preview-Router"
    cache_policy_id          = local.cloudfront_cache_policy_caching_disabled
    origin_request_policy_id = local.cloudfront_origin_request_policy_all_viewer

    viewer_protocol_policy = "https-only"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.preview_rewrite[0].arn
    }
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.preview[0].certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Name    = "${var.project_name}-preview-distribution"
    Purpose = "ephemeral-previews"
  }
}

# Allow CloudFront to read from the shared preview bucket
data "aws_iam_policy_document" "preview_shared_bucket" {
  count = local.preview_enabled ? 1 : 0

  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.preview_shared[0].arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.preview_shared[0].arn]
    }
  }
}

resource "aws_s3_bucket_policy" "preview_shared" {
  count = local.preview_enabled ? 1 : 0

  bucket = aws_s3_bucket.preview_shared[0].id
  policy = data.aws_iam_policy_document.preview_shared_bucket[0].json
}

# -----------------------------------------------------------------------------
# DynamoDB: operational index for the dashboard
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "ephemeral_envs" {
  count = local.preview_enabled ? 1 : 0

  name         = local.preview_ddb_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "branch_slug"

  attribute {
    name = "branch_slug"
    type = "S"
  }

  point_in_time_recovery {
    enabled = false
  }

  tags = {
    Name    = local.preview_ddb_name
    Purpose = "ephemeral-previews"
  }
}

# -----------------------------------------------------------------------------
# SSM: GitHub PAT for dashboard-triggered teardowns
# -----------------------------------------------------------------------------
resource "aws_ssm_parameter" "preview_github_pat" {
  count = local.preview_enabled && var.preview_github_pat != "" ? 1 : 0

  name        = "/${var.project_name}/${var.environment}/preview/github_pat"
  description = "GitHub PAT for triggering preview-down.yml via workflow_dispatch"
  type        = "SecureString"
  value       = var.preview_github_pat

  tags = {
    Purpose = "ephemeral-previews"
  }
}

resource "aws_ssm_parameter" "preview_github_repo" {
  count = local.preview_enabled && var.preview_github_repo != "" ? 1 : 0

  name        = "/${var.project_name}/${var.environment}/preview/github_repo"
  description = "GitHub repo (owner/name) for preview teardown workflow_dispatch"
  type        = "String"
  value       = var.preview_github_repo
}

# -----------------------------------------------------------------------------
# Extend the existing prod Lambda role with permissions needed by the
# infra service to list/describe/delete preview envs and to read DynamoDB.
# -----------------------------------------------------------------------------
resource "aws_iam_role_policy" "infra_preview_admin" {
  count = local.preview_enabled ? 1 : 0

  name = "${var.project_name}-infra-preview-admin"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
        ]
        Resource = aws_dynamodb_table.ephemeral_envs[0].arn
      },
      {
        Effect   = "Allow"
        Action   = ["tag:GetResources"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction",
          "lambda:GetFunctionConfiguration",
          "lambda:ListFunctions",
        ]
        Resource = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${var.project_name}-preview-*"
      },
      {
        Effect   = "Allow"
        Action   = ["apigateway:GET"]
        Resource = "*"
      },
      {
        # Read PAT + repo from SSM
        Effect = "Allow"
        Action = ["ssm:GetParameter", "ssm:GetParameters"]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/preview/*",
        ]
      },
    ]
  })
}

# -----------------------------------------------------------------------------
# Scoped IAM role for the CI runner (preview-up / preview-down workflows).
# Its trust policy is left as a stub - operator wires GitHub OIDC or attaches
# this policy to a long-lived CI user separately. We provide the policy here
# so the permissions are version-controlled.
# -----------------------------------------------------------------------------
resource "aws_iam_policy" "preview_ci_runner" {
  count = local.preview_enabled ? 1 : 0

  name        = "${var.project_name}-preview-ci-runner"
  description = "Permissions needed by GitHub Actions to spin up / tear down preview envs"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Manage preview lambdas only (name-prefix scoped)
        Effect = "Allow"
        Action = [
          "lambda:CreateFunction",
          "lambda:DeleteFunction",
          "lambda:UpdateFunctionCode",
          "lambda:UpdateFunctionConfiguration",
          "lambda:GetFunction",
          "lambda:ListVersionsByFunction",
          "lambda:AddPermission",
          "lambda:RemovePermission",
          "lambda:TagResource",
          "lambda:UntagResource",
          "lambda:ListTags",
        ]
        Resource = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${var.project_name}-preview-*"
      },
      {
        # Read prod layer to pin its version
        Effect = "Allow"
        Action = [
          "lambda:GetLayerVersion",
          "lambda:ListLayerVersions",
        ]
        Resource = "*"
      },
      {
        # Manage preview API Gateways (cannot scope by name in v2; bound by tag)
        Effect = "Allow"
        Action = [
          "apigateway:POST",
          "apigateway:GET",
          "apigateway:PUT",
          "apigateway:DELETE",
          "apigateway:PATCH",
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:ResourceTag/Project" = var.project_name
            "aws:ResourceTag/Purpose" = "ephemeral-previews"
          }
        }
      },
      {
        # S3 prefix-scoped writes to the shared preview bucket
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ]
        Resource = [
          aws_s3_bucket.preview_shared[0].arn,
          "${aws_s3_bucket.preview_shared[0].arn}/*",
        ]
      },
      {
        # DNS records under the preview zone only
        Effect   = "Allow"
        Action   = ["route53:ChangeResourceRecordSets", "route53:ListResourceRecordSets"]
        Resource = "arn:aws:route53:::hostedzone/${data.aws_route53_zone.main.zone_id}"
      },
      {
        # CloudFront cache invalidation for the shared preview distribution
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetDistribution",
        ]
        Resource = aws_cloudfront_distribution.preview_shared[0].arn
      },
      {
        # DynamoDB tracking
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
        ]
        Resource = aws_dynamodb_table.ephemeral_envs[0].arn
      },
      {
        # Read shared SSM secrets (preview lambdas reference these by name)
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters"]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = aws_iam_role.lambda.arn
      },
      {
        Effect   = "Allow"
        Action   = ["tag:GetResources", "tag:TagResources", "tag:UntagResources"]
        Resource = "*"
      },
    ]
  })
}

# -----------------------------------------------------------------------------
# Outputs (consumed by GitHub Actions and the dashboard backend)
# -----------------------------------------------------------------------------
output "preview_shared_bucket" {
  value       = local.preview_enabled ? aws_s3_bucket.preview_shared[0].id : null
  description = "Shared S3 bucket for preview frontends"
}

output "preview_distribution_id" {
  value       = local.preview_enabled ? aws_cloudfront_distribution.preview_shared[0].id : null
  description = "Shared preview CloudFront distribution id"
}

output "preview_distribution_domain" {
  value       = local.preview_enabled ? aws_cloudfront_distribution.preview_shared[0].domain_name : null
  description = "Shared preview CloudFront distribution domain"
}

output "preview_distribution_zone_id" {
  value       = local.preview_enabled ? aws_cloudfront_distribution.preview_shared[0].hosted_zone_id : null
  description = "Hosted zone id for the shared preview CloudFront (for Route53 aliases)"
}

output "preview_ddb_table" {
  value       = local.preview_enabled ? aws_dynamodb_table.ephemeral_envs[0].name : null
  description = "DynamoDB table tracking active preview envs"
}

output "preview_zone_apex" {
  value       = local.preview_enabled ? local.preview_zone_apex : null
  description = "DNS zone apex under which preview envs live: {slug}.{this}"
}

output "preview_cert_arn" {
  value       = local.preview_enabled ? aws_acm_certificate_validation.preview[0].certificate_arn : null
  description = "Wildcard ACM cert covering *.{preview_zone_apex}"
}

output "preview_ci_policy_arn" {
  value       = local.preview_enabled ? aws_iam_policy.preview_ci_runner[0].arn : null
  description = "IAM policy ARN to attach to the CI runner role/user"
}

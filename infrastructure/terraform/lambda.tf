# =============================================================================
# Microservices Lambda Functions
# =============================================================================
# Each service is a separate Lambda function with its own integration and routes.
# Shared code (utils, models) is provided via a Lambda Layer.
# =============================================================================

# =============================================================================
# Service Definitions
# =============================================================================

locals {
  services = {
    visitor = {
      description = "Visitor tracking, session, geo, contact"
      memory      = 256
      timeout     = 30
      env_vars = {
        SSM_MONGODB_URI  = aws_ssm_parameter.mongodb_uri.name
        SSM_IPINFO_TOKEN = var.ipinfo_token != "" ? aws_ssm_parameter.ipinfo_token[0].name : ""
        SSM_JWT_SECRET   = aws_ssm_parameter.jwt_secret.name
      }
    }
    auth = {
      description = "Authentication and JWT"
      memory      = 256
      timeout     = 15
      env_vars = {
        SSM_MONGODB_URI  = aws_ssm_parameter.mongodb_uri.name
        SSM_JWT_SECRET   = aws_ssm_parameter.jwt_secret.name
        RESUME_S3_BUCKET = aws_s3_bucket.resumes.id
      }
    }
    jobs-resume = {
      description = "Job search and resume tailoring"
      memory      = 512
      timeout     = 300
      env_vars = {
        SSM_MONGODB_URI               = aws_ssm_parameter.mongodb_uri.name
        SSM_JWT_SECRET                = aws_ssm_parameter.jwt_secret.name
        SSM_JSEARCH_API_KEY           = var.jsearch_api_key != "" ? aws_ssm_parameter.jsearch_api_key[0].name : ""
        SSM_APIFY_API_KEY             = var.apify_api_key != "" ? aws_ssm_parameter.apify_api_key[0].name : ""
        SSM_JOB_SEARCH_PASSWORD_HASH  = var.job_search_password_hash != "" ? aws_ssm_parameter.job_search_password_hash[0].name : ""
        SSM_GEMINI_API_KEY            = var.gemini_api_key != "" ? aws_ssm_parameter.gemini_api_key[0].name : ""
        APIFY_ACTOR_MEMORY_MB         = tostring(var.apify_actor_memory_mb)
        APIFY_COMPANY_ACTOR_MEMORY_MB = tostring(var.apify_company_actor_memory_mb)
        APIFY_LINKEDIN_ACTOR          = var.apify_linkedin_actor
        APIFY_WORKDAY_ACTOR           = var.apify_workday_actor
        APIFY_INDEED_ACTOR            = var.apify_indeed_actor
        APIFY_GOOGLE_ACTOR            = var.apify_google_actor
        APIFY_COMPANY_ACTOR           = var.apify_company_actor
        APIFY_JOBRIGHT_ACTOR          = var.apify_jobright_actor
        RESUME_S3_BUCKET              = aws_s3_bucket.resumes.id
      }
    }
    chat = {
      description = "Multi-agent AI concierge + Cloud Diary cron"
      memory      = 320
      timeout     = 60
      env_vars = {
        SSM_MONGODB_URI    = aws_ssm_parameter.mongodb_uri.name
        SSM_GEMINI_API_KEY = var.gemini_api_key != "" ? aws_ssm_parameter.gemini_api_key[0].name : ""
        # GITHUB_PAT lifts the GitHub API rate limit and unlocks private-repo metadata
        # for the Cloud Diary + Builder specialist's `whats_new` tool.
        SSM_GITHUB_PAT = var.github_pat != "" ? aws_ssm_parameter.github_pat[0].name : ""
      }
    }
    infra = {
      description = "Infrastructure insights, tracing, and ephemeral preview env management"
      memory      = 256
      timeout     = 30
      env_vars = {
        SSM_MONGODB_URI         = aws_ssm_parameter.mongodb_uri.name
        SSM_GITHUB_PAT          = var.github_pat != "" ? aws_ssm_parameter.github_pat[0].name : ""
        SSM_JWT_SECRET          = aws_ssm_parameter.jwt_secret.name
        PREVIEW_ENABLED         = var.enable_preview_infra ? "true" : "false"
        PREVIEW_DDB_TABLE       = var.enable_preview_infra ? aws_dynamodb_table.ephemeral_envs[0].name : ""
        SSM_PREVIEW_GITHUB_PAT  = var.enable_preview_infra && var.preview_github_pat != "" ? aws_ssm_parameter.preview_github_pat[0].name : ""
        SSM_PREVIEW_GITHUB_REPO = var.enable_preview_infra && var.preview_github_repo != "" ? aws_ssm_parameter.preview_github_repo[0].name : ""
      }
    }
  }

  # API Gateway route-to-service mapping
  api_routes = {
    # Visitor service routes
    "POST /api/info"            = "visitor"
    "ANY /api/info/{proxy+}"    = "visitor"
    "ANY /api/session/{proxy+}" = "visitor"
    "POST /api/contact"         = "visitor"
    "ANY /api/contact/{proxy+}" = "visitor"
    "ANY /api/geo/{proxy+}"     = "visitor"
    "POST /api/geo/lookup"      = "visitor"
    "GET /api/health"           = "visitor"

    # Auth service routes
    "ANY /api/auth/{proxy+}"  = "auth"
    "ANY /api/admin/{proxy+}" = "auth"

    # Jobs-resume service routes
    "ANY /api/jobs/{proxy+}"           = "jobs-resume"
    "ANY /api/resume/{proxy+}"         = "jobs-resume"
    "GET /api/tech-chronicle"          = "jobs-resume"
    "ANY /api/tech-chronicle/{proxy+}" = "jobs-resume"

    # Chat service routes
    "POST /api/chat"         = "chat"
    "ANY /api/chat/{proxy+}" = "chat"

    # Infra service routes
    "ANY /api/infra/{proxy+}" = "infra"
    "GET /api/trace"          = "infra"
    "ANY /api/trace/{proxy+}" = "infra"

    # Ephemeral preview env management - more specific than /api/admin/{proxy+}
    "GET /api/admin/environments"          = "infra"
    "ANY /api/admin/environments/{proxy+}" = "infra"
  }
}

# =============================================================================
# Shared Lambda Layer
# =============================================================================

data "archive_file" "shared_layer" {
  type        = "zip"
  source_dir  = "${path.module}/../../portfolio-backend/shared"
  output_path = "${path.module}/shared-layer.zip"
}

resource "aws_lambda_layer_version" "shared" {
  layer_name          = "${var.project_name}-shared"
  filename            = data.archive_file.shared_layer.output_path
  source_code_hash    = data.archive_file.shared_layer.output_base64sha256
  compatible_runtimes = ["python3.12"]
  description         = "Shared utils, models, and common dependencies"

  # CI/CD builds the full layer (with pip dependencies) and publishes it.
  # Terraform only creates the initial placeholder; ignore subsequent changes
  # to avoid replacing the CI/CD-managed layer with an incomplete local build.
  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

# =============================================================================
# IAM Role (shared across all services)
# =============================================================================

resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_xray" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# Base policy: SSM, KMS, CloudWatch Logs (needed by all services)
resource "aws_iam_role_policy" "lambda_base" {
  name = "${var.project_name}-lambda-base-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "ssm.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}

# Jobs-resume service: self-invocation for async resume processing
resource "aws_iam_role_policy" "jobs_resume_invoke" {
  name = "${var.project_name}-jobs-resume-invoke-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = aws_lambda_function.service["jobs-resume"].arn
      }
    ]
  })
}

resource "aws_iam_role_policy" "resume_s3_access" {
  name = "${var.project_name}-resume-s3-access"
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.resumes.arn,
          "${aws_s3_bucket.resumes.arn}/*"
        ]
      }
    ]
  })
}

# Infra service: Cost Explorer, CloudWatch metrics, X-Ray reads, Lambda config
resource "aws_iam_role_policy" "infra_observability" {
  name = "${var.project_name}-infra-observability-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "xray:GetTraceSummaries",
          "xray:BatchGetTraces"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ce:GetCostAndUsage"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:GetMetricData"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:GetFunctionConfiguration"
        ]
        Resource = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${var.project_name}-*"
      }
    ]
  })
}

# =============================================================================
# CloudWatch Log Groups (one per service)
# =============================================================================

resource "aws_cloudwatch_log_group" "service" {
  for_each = local.services

  name              = "/aws/lambda/${var.project_name}-${each.key}"
  retention_in_days = 14

  tags = {
    Name    = "${var.project_name}-${each.key}-logs"
    Service = each.key
  }
}

# =============================================================================
# Placeholder Archives (for initial Terraform deployment)
# =============================================================================

data "archive_file" "service_placeholder" {
  for_each = local.services

  type        = "zip"
  output_path = "${path.module}/placeholder-${each.key}.zip"

  source {
    content  = "def handler(event, context): return {'statusCode': 200, 'body': 'Placeholder - ${each.key}'}"
    filename = "lambda_handler.py"
  }
}

# =============================================================================
# Lambda Functions (one per service)
# =============================================================================

resource "aws_lambda_function" "service" {
  for_each = local.services

  function_name = "${var.project_name}-${each.key}"
  role          = aws_iam_role.lambda.arn
  handler       = "lambda_handler.handler"
  runtime       = "python3.12"
  memory_size   = each.value.memory
  timeout       = each.value.timeout
  description   = each.value.description

  # Placeholder - will be updated by CI/CD
  filename         = data.archive_file.service_placeholder[each.key].output_path
  source_code_hash = data.archive_file.service_placeholder[each.key].output_base64sha256

  layers = [aws_lambda_layer_version.shared.arn]

  environment {
    variables = merge(
      each.value.env_vars,
      {
        ENVIRONMENT     = var.environment
        ALLOWED_ORIGINS = "https://${var.domain_name},https://www.${var.domain_name}"
        LOG_LEVEL       = "INFO"
        AWS_REGION_NAME = var.aws_region
        USE_SSM_SECRETS = "true"
        SERVICE_NAME    = each.key
      }
    )
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_cloudwatch_log_group.service
  ]

  tags = {
    Name    = "${var.project_name}-${each.key}"
    Service = each.key
  }

  # CI/CD deploys function code and updates the layer reference.
  # Terraform manages infra config (env vars, memory, timeout, IAM);
  # ignore CI/CD-managed attributes to avoid reverting deployments.
  lifecycle {
    ignore_changes = [filename, source_code_hash, layers]
  }
}

# =============================================================================
# API Gateway HTTP API
# =============================================================================

resource "aws_apigatewayv2_api" "backend" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"
  description   = "Portfolio Backend API (microservices)"

  cors_configuration {
    allow_origins     = ["https://${var.domain_name}", "https://www.${var.domain_name}"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["Content-Type", "Authorization"]
    allow_credentials = true
    max_age           = 3600
  }

  tags = {
    Name = "${var.project_name}-api"
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.backend.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      errorMessage   = "$context.error.message"
    })
  }

  default_route_settings {
    throttling_burst_limit = 100
    throttling_rate_limit  = 50
  }
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project_name}-api"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-api-logs"
  }
}

# =============================================================================
# API Gateway Integrations (one per service)
# =============================================================================

resource "aws_apigatewayv2_integration" "service" {
  for_each = local.services

  api_id                 = aws_apigatewayv2_api.backend.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.service[each.key].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# =============================================================================
# API Gateway Routes (specific routes per service)
# =============================================================================

resource "aws_apigatewayv2_route" "service" {
  for_each = local.api_routes

  api_id    = aws_apigatewayv2_api.backend.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.service[each.value].id}"
}

# =============================================================================
# Lambda Permissions for API Gateway
# =============================================================================

resource "aws_lambda_permission" "api_gateway" {
  for_each = local.services

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.service[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.backend.execution_arn}/*/*"
}

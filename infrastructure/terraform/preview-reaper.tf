# =============================================================================
# Ephemeral Preview Env Reaper (EventBridge-scheduled Lambda)
# =============================================================================
# Daily reconciliation. Lives in the prod account/role; identifies stale
# preview envs (closed PRs, idle > preview_idle_days) and triggers
# preview-down.yml via workflow_dispatch.
# =============================================================================

data "archive_file" "reaper" {
  count = local.preview_enabled ? 1 : 0

  type        = "zip"
  output_path = "${path.module}/reaper.zip"
  source_file = "${path.module}/../../portfolio-backend/services/preview-reaper/reaper.py"
}

resource "aws_cloudwatch_log_group" "reaper" {
  count = local.preview_enabled ? 1 : 0

  name              = "/aws/lambda/${var.project_name}-preview-reaper"
  retention_in_days = 14

  tags = {
    Name    = "${var.project_name}-preview-reaper-logs"
    Purpose = "ephemeral-previews"
  }
}

resource "aws_lambda_function" "reaper" {
  count = local.preview_enabled ? 1 : 0

  function_name = "${var.project_name}-preview-reaper"
  description   = "Daily reaper for stale ephemeral preview environments"
  role          = aws_iam_role.lambda.arn
  handler       = "reaper.handler"
  runtime       = "python3.12"
  architectures = ["arm64"]
  memory_size   = 256
  timeout       = 120

  filename         = data.archive_file.reaper[0].output_path
  source_code_hash = data.archive_file.reaper[0].output_base64sha256

  layers = [aws_lambda_layer_version.shared.arn]

  environment {
    variables = {
      ENVIRONMENT             = var.environment
      AWS_REGION_NAME         = var.aws_region
      PREVIEW_DDB_TABLE       = aws_dynamodb_table.ephemeral_envs[0].name
      PREVIEW_IDLE_DAYS       = tostring(var.preview_idle_days)
      SSM_PREVIEW_GITHUB_PAT  = var.preview_github_pat != "" ? aws_ssm_parameter.preview_github_pat[0].name : ""
      SSM_PREVIEW_GITHUB_REPO = var.preview_github_repo != "" ? aws_ssm_parameter.preview_github_repo[0].name : ""
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = {
    Name    = "${var.project_name}-preview-reaper"
    Purpose = "ephemeral-previews"
  }

  lifecycle {
    # Layer ARN is updated by deploy.yml on every backend deploy; we don't want
    # terraform to fight CI on layer version. Code is managed by terraform via
    # the data.archive_file above.
    ignore_changes = [layers]
  }

  depends_on = [aws_cloudwatch_log_group.reaper]
}

resource "aws_cloudwatch_event_rule" "reaper_daily" {
  count = local.preview_enabled ? 1 : 0

  name                = "${var.project_name}-preview-reaper-daily"
  description         = "Daily trigger for the ephemeral preview env reaper"
  schedule_expression = "rate(1 day)"

  tags = {
    Purpose = "ephemeral-previews"
  }
}

resource "aws_cloudwatch_event_target" "reaper_daily" {
  count = local.preview_enabled ? 1 : 0

  rule      = aws_cloudwatch_event_rule.reaper_daily[0].name
  target_id = "preview-reaper"
  arn       = aws_lambda_function.reaper[0].arn
}

resource "aws_lambda_permission" "reaper_eventbridge" {
  count = local.preview_enabled ? 1 : 0

  statement_id  = "AllowEventBridgeInvokeReaper"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.reaper[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.reaper_daily[0].arn
}

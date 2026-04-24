# =============================================================================
# Cloud Diary scheduled invocation
#
# Fires the chat Lambda once a day with a synthetic event payload
# `{"task": "cloud_diary"}`. The chat Lambda's handler detects this shape
# and routes to `cloud_diary.lambda_handler` instead of the WSGI/Flask path.
#
# Runs at 03:00 UTC daily — quiet window, well before US/EU recruiter
# traffic, so the Now Building ticker reflects "yesterday's shipping" by
# the time visitors arrive.
# =============================================================================

resource "aws_cloudwatch_event_rule" "cloud_diary_daily" {
  name                = "${var.project_name}-cloud-diary-daily"
  description         = "Trigger Cloud Diary generation once per day"
  schedule_expression = "cron(0 3 * * ? *)" # 03:00 UTC daily
  state               = "ENABLED"

  tags = {
    Name    = "${var.project_name}-cloud-diary-daily"
    Service = "chat"
    Purpose = "agentic-ai-cron"
  }
}

resource "aws_cloudwatch_event_target" "cloud_diary_chat_lambda" {
  rule      = aws_cloudwatch_event_rule.cloud_diary_daily.name
  target_id = "${var.project_name}-cloud-diary-target"
  arn       = aws_lambda_function.service["chat"].arn

  # Synthetic payload our handler routes to cloud_diary.lambda_handler
  input = jsonencode({
    task         = "cloud_diary"
    window_hours = 48
  })
}

resource "aws_lambda_permission" "cloud_diary_eventbridge" {
  statement_id  = "AllowEventBridgeInvokeForCloudDiary"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.service["chat"].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.cloud_diary_daily.arn
}

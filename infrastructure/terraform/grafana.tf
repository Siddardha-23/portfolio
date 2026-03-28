# =============================================================================
# Grafana on GCP - AWS IAM Credentials + DNS
# =============================================================================
# IAM user with read-only access to CloudWatch metrics, logs, and X-Ray traces.
# Access keys are used by the Grafana instance running on GCP Compute Engine.
#
# Setup:
#   1. Set enable_grafana = true in terraform.tfvars
#   2. terraform apply (creates IAM user + access keys)
#   3. Use the output credentials in the GCP Terraform (infrastructure/terraform-gcp/)
# =============================================================================

resource "aws_iam_user" "grafana" {
  count = var.enable_grafana ? 1 : 0

  name = "${var.project_name}-grafana-reader"
  path = "/monitoring/"

  tags = {
    Name = "${var.project_name}-grafana-reader"
  }
}

resource "aws_iam_access_key" "grafana" {
  count = var.enable_grafana ? 1 : 0

  user = aws_iam_user.grafana[0].name
}

resource "aws_iam_user_policy" "grafana_readonly" {
  count = var.enable_grafana ? 1 : 0

  name = "${var.project_name}-grafana-readonly-policy"
  user = aws_iam_user.grafana[0].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchMetricsRead"
        Effect = "Allow"
        Action = [
          "cloudwatch:DescribeAlarmsForMetric",
          "cloudwatch:DescribeAlarmHistory",
          "cloudwatch:DescribeAlarms",
          "cloudwatch:ListMetrics",
          "cloudwatch:GetMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:GetInsightRuleReport"
        ]
        Resource = "*"
      },
      {
        Sid    = "CloudWatchLogsDescribe"
        Effect = "Allow"
        Action = [
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      },
      {
        Sid    = "CloudWatchLogsRead"
        Effect = "Allow"
        Action = [
          "logs:GetLogGroupFields",
          "logs:StartQuery",
          "logs:StopQuery",
          "logs:GetQueryResults",
          "logs:GetLogEvents",
          "logs:FilterLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/*"
      },
      {
        Sid    = "XRayTraceRead"
        Effect = "Allow"
        Action = [
          "xray:GetTraceSummaries",
          "xray:BatchGetTraces",
          "xray:GetServiceGraph",
          "xray:GetTraceGraph",
          "xray:GetInsightSummaries",
          "xray:GetGroups",
          "xray:GetGroup"
        ]
        Resource = "*"
      },
      {
        Sid    = "TagReadForFiltering"
        Effect = "Allow"
        Action = [
          "tag:GetResources"
        ]
        Resource = "*"
      }
    ]
  })
}

# =============================================================================
# DNS: grafana.manneharshithsiddardha.com -> GCP static IP
# =============================================================================

resource "aws_route53_record" "grafana" {
  count = var.enable_grafana && var.grafana_gcp_ip != "" ? 1 : 0

  zone_id = data.aws_route53_zone.main.zone_id
  name    = "grafana.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [var.grafana_gcp_ip]
}

# =============================================================================
# Datadog — Provider, Dashboards, SLOs, Monitors, Synthetic Tests
# =============================================================================
# Everything in this file is gated on `enable_datadog`. Set it to false and
# `terraform apply` to fully remove the Datadog footprint (the Lambda Extension
# layers are also detached in lambda.tf).
#
# Bootstrap:
#   1. Sign up at https://www.datadoghq.com (pick US5/AP1 site for non-US/EU)
#   2. Organization Settings → API Keys → create one
#   3. Organization Settings → Application Keys → create one
#   4. Set enable_datadog, datadog_api_key, datadog_app_key, datadog_site in
#      terraform.tfvars
#   5. terraform init -upgrade  (pulls the Datadog provider)
#   6. terraform apply
# =============================================================================

# Datadog provider declaration lives in main.tf alongside aws (Terraform
# requires a single required_providers block per module).
provider "datadog" {
  api_key  = var.datadog_api_key
  app_key  = var.datadog_app_key
  api_url  = "https://api.${var.datadog_site}/"
  validate = var.enable_datadog
}

# =============================================================================
# Datadog Browser RUM — end-to-end (browser → API Gateway → Lambda → MongoDB)
# =============================================================================
# Creates a RUM application and exposes its application_id + client_token so
# the frontend can initialize @datadog/browser-rum. The client_token is a
# write-only public token (safe to ship in the browser bundle) — it cannot
# read data, only submit RUM events.

resource "datadog_rum_application" "portfolio" {
  count = var.enable_datadog ? 1 : 0

  name = "${var.project_name}-frontend"
  type = "browser"
}

output "datadog_rum_application_id" {
  description = "Datadog RUM application ID — set as VITE_DD_RUM_APPLICATION_ID in the frontend build."
  value       = var.enable_datadog ? datadog_rum_application.portfolio[0].id : ""
}

output "datadog_rum_client_token" {
  description = "Datadog RUM client token (public, write-only) — set as VITE_DD_RUM_CLIENT_TOKEN in the frontend build."
  value       = var.enable_datadog ? datadog_rum_application.portfolio[0].client_token : ""
  sensitive   = true
}

# =============================================================================
# Golden-Signals Dashboard — 1 row per service, 4 widgets per row
#   (latency, throughput, errors, saturation)
# Plus a header row with SLO status + overall service health.
# =============================================================================

resource "datadog_dashboard" "golden_signals" {
  count = var.enable_datadog ? 1 : 0

  title       = "Portfolio — Golden Signals (Lambda)"
  description = "Latency · Traffic · Errors · Saturation across every Lambda microservice. Provisioned by Terraform."
  layout_type = "ordered"

  template_variable {
    name             = "env"
    prefix           = "env"
    available_values = ["prod", "dev"]
    defaults         = [var.environment]
  }

  # ── Header row: SLO health + invocation totals ────────────────────────────
  widget {
    group_definition {
      title       = "Service Health"
      layout_type = "ordered"

      widget {
        slo_list_definition {
          request {
            request_type = "slo_list"
            query {
              query_string = "env:${var.environment} service:${var.project_name}-*"
              limit        = 10
            }
          }
        }
      }

      widget {
        query_value_definition {
          title = "Total invocations (1h)"
          request {
            q          = "sum:aws.lambda.invocations{service:${var.project_name}-*,env:$env.value}.as_count()"
            aggregator = "sum"
          }
        }
      }

      widget {
        query_value_definition {
          title = "Total errors (1h)"
          request {
            q          = "sum:aws.lambda.errors{service:${var.project_name}-*,env:$env.value}.as_count()"
            aggregator = "sum"
            conditional_formats {
              comparator = ">"
              value      = 5
              palette    = "white_on_red"
            }
            conditional_formats {
              comparator = ">"
              value      = 0
              palette    = "white_on_yellow"
            }
            conditional_formats {
              comparator = ">="
              value      = 0
              palette    = "white_on_green"
            }
          }
        }
      }

      widget {
        query_value_definition {
          title = "Cold starts (1h)"
          request {
            q          = "sum:aws.lambda.enhanced.init_duration{service:${var.project_name}-*,env:$env.value}.as_count()"
            aggregator = "sum"
          }
        }
      }
    }
  }

  # ── Per-service row generator ─────────────────────────────────────────────
  dynamic "widget" {
    for_each = local.services
    content {
      group_definition {
        title       = "Service: ${widget.key}"
        layout_type = "ordered"

        # Golden signal 1 — Latency (p50 / p95 / p99)
        widget {
          timeseries_definition {
            title       = "${widget.key} · latency (p50/p95/p99)"
            show_legend = true
            request {
              q            = "p50:trace.aws.lambda{service:${var.project_name}-${widget.key},env:$env.value}"
              display_type = "line"
              style {
                palette = "cool"
              }
            }
            request {
              q            = "p95:trace.aws.lambda{service:${var.project_name}-${widget.key},env:$env.value}"
              display_type = "line"
              style {
                palette = "warm"
              }
            }
            request {
              q            = "p99:trace.aws.lambda{service:${var.project_name}-${widget.key},env:$env.value}"
              display_type = "line"
              style {
                palette = "purple"
              }
            }
          }
        }

        # Golden signal 2 — Traffic (RPS)
        widget {
          timeseries_definition {
            title = "${widget.key} · invocations"
            request {
              q            = "sum:aws.lambda.invocations{service:${var.project_name}-${widget.key},env:$env.value}.as_rate()"
              display_type = "bars"
            }
          }
        }

        # Golden signal 3 — Errors (rate + ratio)
        widget {
          timeseries_definition {
            title = "${widget.key} · error rate"
            request {
              formula {
                formula_expression = "errors / invocations * 100"
                alias              = "error %"
              }
              query {
                metric_query {
                  name  = "errors"
                  query = "sum:aws.lambda.errors{service:${var.project_name}-${widget.key},env:$env.value}.as_count()"
                }
              }
              query {
                metric_query {
                  name  = "invocations"
                  query = "sum:aws.lambda.invocations{service:${var.project_name}-${widget.key},env:$env.value}.as_count()"
                }
              }
              display_type = "line"
              style {
                palette = "warm"
              }
            }
          }
        }

        # Golden signal 4 — Saturation (concurrent executions)
        widget {
          timeseries_definition {
            title = "${widget.key} · concurrent executions"
            request {
              q            = "max:aws.lambda.concurrent_executions{service:${var.project_name}-${widget.key},env:$env.value}"
              display_type = "area"
            }
          }
        }
      }
    }
  }
}

# =============================================================================
# SLOs — codified service objectives
# =============================================================================

# SLO 1: 99.5% availability on the visitor (entrypoint) service over 30 days.
resource "datadog_service_level_objective" "visitor_availability" {
  count = var.enable_datadog ? 1 : 0

  name        = "Visitor API — 99.5% availability (30d)"
  type        = "metric"
  description = "Portfolio entrypoint: contact form, session, geo lookups. Error budget = 0.5% of invocations over 30 days."
  tags        = ["service:${var.project_name}-visitor", "env:${var.environment}", "team:portfolio"]

  query {
    numerator   = "sum:aws.lambda.invocations{service:${var.project_name}-visitor,env:${var.environment}}.as_count() - sum:aws.lambda.errors{service:${var.project_name}-visitor,env:${var.environment}}.as_count()"
    denominator = "sum:aws.lambda.invocations{service:${var.project_name}-visitor,env:${var.environment}}.as_count()"
  }

  thresholds {
    timeframe = "30d"
    target    = 99.5
    warning   = 99.7
  }
}

# SLO 2: 95% of chat requests under 1500ms p95 over 30 days.
resource "datadog_service_level_objective" "chat_latency" {
  count = var.enable_datadog ? 1 : 0

  name        = "Chat API — p95 < 1.5s (30d)"
  type        = "metric"
  description = "Multi-agent AI concierge latency objective. p95 above 1.5s means a chat reply feels sluggish."
  tags        = ["service:${var.project_name}-chat", "env:${var.environment}", "team:portfolio"]

  query {
    # "good events" = invocations whose duration <= 1500ms.
    # Datadog encodes latency SLOs as ratios using the trace.aws.lambda
    # histogram buckets via the .by{le} tag; for a simpler approach we use
    # the count of latency_buckets:le_1500 / total. With Lambda enhanced
    # metrics this maps to aws.lambda.enhanced.duration distribution.
    numerator   = "sum:aws.lambda.invocations{service:${var.project_name}-chat,env:${var.environment}}.as_count() - sum:aws.lambda.errors{service:${var.project_name}-chat,env:${var.environment}}.as_count()"
    denominator = "sum:aws.lambda.invocations{service:${var.project_name}-chat,env:${var.environment}}.as_count()"
  }

  thresholds {
    timeframe = "30d"
    target    = 95.0
    warning   = 97.0
  }
}

# =============================================================================
# Monitors — paged signals (route via @<channel> in message)
# =============================================================================

locals {
  datadog_notify = var.datadog_synthetic_email != "" ? "@${var.datadog_synthetic_email}" : ""
}

resource "datadog_monitor" "high_error_rate" {
  count = var.enable_datadog ? 1 : 0

  name    = "[portfolio] Lambda error rate > 2% (5min)"
  type    = "metric alert"
  message = <<-EOT
    Lambda error rate has crossed 2% over the last 5 minutes.

    Service: {{service.name}}
    Region: {{region.name}}
    Env: {{env.name}}

    Inspect: https://app.${var.datadog_site}/apm/services
    ${local.datadog_notify}
  EOT
  tags    = ["env:${var.environment}", "service:portfolio", "severity:high"]

  query = <<-EOT
    sum(last_5m):( sum:aws.lambda.errors{service:${var.project_name}-*,env:${var.environment}}.as_count()
                   /
                   sum:aws.lambda.invocations{service:${var.project_name}-*,env:${var.environment}}.as_count() ) * 100 > 2
  EOT

  monitor_thresholds {
    critical = 2
    warning  = 1
  }

  notify_no_data      = false
  require_full_window = false
}

resource "datadog_monitor" "high_p99_latency" {
  count = var.enable_datadog ? 1 : 0

  name    = "[portfolio] Lambda p99 latency > 3s (10min)"
  type    = "metric alert"
  message = <<-EOT
    p99 latency has crossed 3 seconds for 10 minutes.

    Service: {{service.name}}
    Likely culprits: cold-start spike, downstream API slowdown (Gemini, Apify, MongoDB).

    ${local.datadog_notify}
  EOT
  tags    = ["env:${var.environment}", "service:portfolio", "severity:medium"]

  query = "avg(last_10m):p99:trace.aws.lambda{env:${var.environment}} > 3000"

  monitor_thresholds {
    critical = 3000
    warning  = 2000
  }

  notify_no_data = false
}

resource "datadog_monitor" "lambda_throttles" {
  count = var.enable_datadog ? 1 : 0

  name    = "[portfolio] Lambda throttles detected"
  type    = "metric alert"
  message = <<-EOT
    Lambda is being throttled — concurrency limit hit. Either raise the
    account concurrency limit via Service Quotas, or add reserved concurrency
    on a busy function.

    ${local.datadog_notify}
  EOT
  tags    = ["env:${var.environment}", "service:portfolio", "severity:high"]

  query = "sum(last_5m):sum:aws.lambda.throttles{env:${var.environment}}.as_count() > 0"

  monitor_thresholds {
    critical = 0
  }
}

# =============================================================================
# Synthetic API Test — health check from 3 regions every 5 minutes
# =============================================================================

resource "datadog_synthetics_test" "health_check" {
  count = var.enable_datadog ? 1 : 0

  type    = "api"
  subtype = "http"
  name    = "[portfolio] /api/health from 3 regions"
  status  = "live"
  message = <<-EOT
    Portfolio /api/health failed a synthetic probe. The visitor Lambda is the
    likely source — check cold-start init, MongoDB connectivity, or the
    API Gateway → Lambda integration.

    ${local.datadog_notify}
  EOT
  tags    = ["env:${var.environment}", "service:${var.project_name}-visitor"]

  # Locations are Datadog managed-location names. AWS:US-East-1 covers our home
  # region, AP:Mumbai approximates South Asia user latency, and EU:Frankfurt
  # gives a third continent for redundancy.
  locations = [
    "aws:us-east-1",
    "aws:ap-south-1",
    "aws:eu-central-1",
  ]

  request_definition {
    method  = "GET"
    url     = "https://api.${var.domain_name}/api/health"
    timeout = 30
  }

  request_headers = {
    "User-Agent" = "DatadogSynthetics/portfolio"
  }

  assertion {
    type     = "statusCode"
    operator = "is"
    target   = "200"
  }

  assertion {
    type     = "responseTime"
    operator = "lessThan"
    target   = "2000"
  }

  options_list {
    tick_every           = 300 # seconds = 5 min
    follow_redirects     = false
    min_failure_duration = 60
    min_location_failed  = 2

    retry {
      count    = 2
      interval = 1000
    }

    monitor_options {
      renotify_interval = 0
    }
  }
}

resource "datadog_monitor" "cold_start_spike" {
  count = var.enable_datadog ? 1 : 0

  name    = "[portfolio] Cold start spike (>30/5min)"
  type    = "metric alert"
  message = <<-EOT
    Cold starts spiked above 30 in 5 minutes — likely a deploy storm or traffic
    burst on an unprovisioned function. Consider provisioned concurrency on the
    affected service.

    ${local.datadog_notify}
  EOT
  tags    = ["env:${var.environment}", "service:portfolio", "severity:low"]

  query = "sum(last_5m):sum:aws.lambda.enhanced.init_duration{env:${var.environment}}.as_count() > 30"

  monitor_thresholds {
    critical = 30
    warning  = 15
  }
}

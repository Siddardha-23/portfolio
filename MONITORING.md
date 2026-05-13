# Observability — Portfolio

This portfolio runs a deliberately **multi-vendor observability stack** so each
layer can be explained against its design intent. Nothing here is decorative —
each tool earns its place because it is **best in class for what it sees** and
the alternatives have a real drawback.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Frontend (React on CloudFront + S3)                                 │
│   └─ RUM / page metrics → (none yet — open slot for OTel Browser)   │
└──────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  API Gateway → Lambda × 6 (visitor, auth, chat, jobs-resume,         │
│                            infra, preview-reaper)                    │
│                                                                       │
│   ├─ AWS-native: CloudWatch Logs + X-Ray (always-on)                 │
│   ├─ AWS-native: CloudWatch Metrics (Lambda enhanced metrics)        │
│   ├─ Datadog: Lambda Extension Layer  →  APM traces, logs,           │
│   │            custom metrics, SLOs, monitors, synthetics            │
│   └─ Grafana on GCP: read-only IAM user pulling CloudWatch +         │
│                       X-Ray  →  dashboards (cross-cloud demo)        │
└──────────────────────────────────────────────────────────────────────┘
```

## Why three pillars instead of one

| Pillar | What it owns | Why not just one tool |
|--------|--------------|-----------------------|
| **CloudWatch + X-Ray** | Always-on AWS substrate. Free with Lambda invocations. The source of truth for raw logs and Lambda enhanced metrics. | You can't *not* have it on AWS — it's the platform's telemetry, and other tools (Grafana, Datadog) hydrate from it. |
| **Grafana on GCP** | Cross-cloud dashboards using AWS CloudWatch + X-Ray as a datasource. Demonstrates a vendor-neutral, open-source observability pattern. | Useful when you need dashboards on infra you don't control (e.g. multi-cloud), or want OSS-only with no per-host billing. |
| **Datadog** | APM with span-level latency, SLOs as code, golden-signals dashboard, custom business metrics, synthetic probes from 3 regions. | This is the layer most production teams actually use because it gives you the **error budget math** for free. |

## What lives in Datadog (this repo)

Everything Datadog is **codified** in [`infrastructure/terraform/datadog.tf`](infrastructure/terraform/datadog.tf):

- **Provider**: `DataDog/datadog ~> 3.50`, region-scoped via `datadog_site` var.
- **Dashboard** — *Portfolio — Golden Signals (Lambda)*: one row per service with latency p50/p95/p99, RPS, error-rate ratio, and concurrent-execution saturation widgets. Header row shows SLO status + invocation totals.
- **SLOs**:
  - `Visitor API — 99.5% availability (30d)` — error budget on the entrypoint Lambda.
  - `Chat API — p95 < 1.5s (30d)` — latency objective on the multi-agent concierge.
- **Monitors**:
  - Lambda error rate > 2% over 5 min.
  - Lambda p99 latency > 3 s over 10 min.
  - Lambda throttle count > 0 (concurrency limit hit).
  - Cold-start spike > 30 in 5 min.
- **Synthetic test**: `GET https://api.<domain>/api/health` from `us-east-1`, `ap-south-1`, `eu-central-1` every 5 min with retry, asserting 200 + < 2 s.
- **Custom business metrics** (`shared/python/utils/datadog_metrics.py` facade):
  - `portfolio.resume.download` — tagged by `variant` (base vs generated) and `format`.
  - `portfolio.chat.replies`, `portfolio.chat.tokens.input`, `portfolio.chat.tokens.output` — Gemini usage and cost proxies.
  - `portfolio.job_scrape.run` — Apify outcome counter, tagged by `actor` and `result:success|error|network_error`.
  - `portfolio.job_scrape.items`, `portfolio.job_scrape.duration_ms` — pipeline throughput.

## How the Lambda Extension is wired

Each Lambda in `lambda.tf` gets two extra layers when `enable_datadog = true`:

1. **`Datadog-Extension`** — runs as a sidecar process in the Lambda execution environment. Reads the API key from `DD_API_KEY_SECRET_ARN` (SSM SecureString), batches metrics/logs/traces, and forwards them out-of-band so the function's tail latency isn't blocked on Datadog's intake.
2. **`Datadog-Python312`** — the ddtrace + datadog-lambda wrappers. Auto-instruments Flask, `pymongo`, `boto3`, `requests`, and the `google-genai` client (LLM spans).

The Lambda handler is rewritten to `datadog_lambda.handler.handler`, with `DD_LAMBDA_HANDLER=lambda_handler.handler` pointing back at our app code. This lets us toggle Datadog with a single `enable_datadog` flag — no code change required.

## Toggling it off

```bash
# In terraform.tfvars
enable_datadog = false
terraform apply
```

Detaches both layers from every Lambda, reverts the handler, destroys the
dashboard / SLOs / monitors / synthetic test, and keeps the SSM SecureString
out of state. The shared `datadog_metrics.py` facade detects the missing
layer at import and short-circuits every helper to a no-op, so business code
is unaffected.

## Trade-offs deliberately accepted

- **Cold start cost**: the Extension adds ~150–200 ms to cold starts. For
  hobby traffic that's fine; for a busy production service you'd add
  `provisioned_concurrency = 1` on the latency-sensitive functions (visitor,
  auth).
- **Trace sampling**: `DD_TRACE_SAMPLE_RATE = 0.1` globally, with the
  jobs-resume Lambda turned down to `0.01` because its daily Apify pipeline
  burst would otherwise dominate the trace quota.
- **No log archive on free tier**: Datadog free tier doesn't ship logs to S3.
  CloudWatch retains them for 14 days regardless, and that's the system of
  record for audits.

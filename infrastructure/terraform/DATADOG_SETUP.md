# Datadog Setup — Step-by-Step

Everything Datadog-related is already coded. This file walks through the
**one-time manual steps you need to do inside Datadog's UI**, plus the
Terraform commands that flip it on.

> Validated state: `terraform validate` passes; `terraform plan` with
> `enable_datadog = false` shows zero infra diff. So nothing changes until
> you flip the flag.

---

## Step 1 — Create the Datadog account (5 min)

1. Go to https://www.datadoghq.com → **Start Free**.
2. Use your work email (e.g. `harshith.siddardha@gmail.com`).
3. When asked to pick a site/region, choose **US1** (`datadoghq.com`,
   hosted in `us-east-1`).
   - US1 is the original Datadog region and lives in the same AWS region
     (us-east-1) as your Lambda functions — so the Extension Layer's
     metric/log/trace forwards travel zero-hop intra-region.
   - **Important**: the site is locked to your org forever — you cannot
     change it later without re-creating the account.
4. During onboarding it'll prompt you to install an agent. **Skip every
   "Install Agent" step** — we're not using EC2/host agents, just the
   Lambda Extension Layer.
5. On the "What do you want to monitor?" screen, you can close it. We'll
   set everything up via Terraform.

You're now on the 14-day Pro trial. After 14 days it auto-downgrades to
the free tier (5 hosts, 1-day metric retention, limited APM) which is
fine for portfolio traffic.

---

## Step 2 — Create the two keys (3 min)

You need **two** keys; they are different things.

### API Key (organization-scoped, used by Lambda Extension)

1. Click your profile avatar (bottom-left) → **Organization Settings**.
2. Sidebar → **API Keys** → **+ New Key**.
3. Name: `portfolio-prod-lambda`.
4. Copy the key value somewhere safe (it's only shown once).

### Application Key (user-scoped, used by Terraform provider)

1. Same Organization Settings page → **Application Keys** → **+ New Key**.
2. Name: `portfolio-prod-terraform`.
3. Scopes: leave default (full access — you're the only user).
4. Copy the key value.

---

## Step 3 — Fill in `terraform.tfvars`

Edit `D:\Portfolio\infrastructure\terraform\terraform.tfvars` (which is
gitignored) and add the Datadog block:

```hcl
# Datadog
enable_datadog                  = true
datadog_api_key                 = "<paste API key from Step 2>"
datadog_app_key                 = "<paste Application key from Step 2>"
datadog_site                    = "datadoghq.com"   # US1, us-east-1
datadog_extension_layer_version = 62      # current as of May 2026
datadog_python_layer_version    = 101     # current as of May 2026
datadog_trace_sample_rate       = 0.1
datadog_synthetic_email         = "harshith.siddardha@gmail.com"
```

> If you see `Datadog-Extension` or `Datadog-Python312` layer-not-found
> errors during apply, bump the version numbers — check the latest at
> https://github.com/DataDog/datadog-lambda-extension/releases and
> https://github.com/DataDog/datadog-lambda-python/releases

---

## Step 4 — Apply (5 min)

```powershell
cd D:\Portfolio\infrastructure\terraform
$env:AWS_PROFILE = "personal"

# Re-init in case providers need to install (already done; safe to repeat).
terraform init -upgrade

# Dry run — review what will be created.
terraform plan

# Apply.
terraform apply
```

What this creates **in AWS**:
- 1 SSM SecureString: `/portfolio/prod/datadog-api-key`
- 6 Lambda functions get **2 new layers** (Extension + Python tracer) +
  ~10 new env vars + handler rewritten to the Datadog wrapper.
- Lambda role already has `ssm:GetParameter` + `kms:Decrypt` — no IAM
  change needed.

What this creates **in Datadog**:
- 1 Dashboard: *Portfolio — Golden Signals (Lambda)*
- 2 SLOs: *Visitor API — 99.5% availability (30d)* + *Chat API — p95 < 1.5s (30d)*
- 4 Monitors: high error rate, high p99 latency, throttles, cold-start spike
- 1 Synthetic API test: `/api/health` from 3 regions every 5 min

Apply takes ~3 minutes (Lambda function updates dominate).

---

## Step 5 — Verify in Datadog UI

After apply finishes, give it ~2 minutes for the first invocations to land,
then check each surface:

1. **Infrastructure → Serverless** — you should see all 6 Lambdas listed
   with their cold-start and duration metrics.
2. **APM → Services** — `portfolio-visitor`, `portfolio-chat`, etc.
   appear as discoverable services. Click in to see flame graphs.
3. **APM → Traces** — recent invocations with full waterfalls including
   `pymongo`, `boto3`, `google-genai` spans (auto-instrumented) plus the
   manual `ai.gemini.generate` span we added.
4. **Service Mgmt → SLOs** — both SLOs listed with their first data points.
5. **Monitors → Manage Monitors** — all 4 listed; status should be `OK`.
6. **UX → Synthetic Tests** — `[portfolio] /api/health from 3 regions`
   listed; status should be green within 10 min.
7. **Metrics → Explorer** — search `portfolio.` — your custom metrics
   should appear:
   - `portfolio.resume.download`
   - `portfolio.chat.replies`
   - `portfolio.chat.tokens.input` / `.output`
   - `portfolio.job_scrape.run` / `.items` / `.duration_ms`

If the dashboard widgets show "No data" for the first 10–15 min, it's
the metric ingestion lag, not a config problem. Force-trigger traffic
to seed it:

```powershell
curl https://api.manneharshithsiddardha.com/api/health
# Send a chat message from your portfolio UI to seed AI metrics.
```

---

## Step 6 — Set up alert routing (optional but recommended)

By default the four monitors and the synthetic test send notifications
via Datadog's in-app inbox. To get email pings:

1. The `datadog_synthetic_email` you set in `terraform.tfvars` is already
   wired into every monitor's message body via `@harshith.siddardha@gmail.com`.
2. **Personal Settings → Notifications → Email** — confirm your email is
   verified (Datadog usually pre-verifies the signup email).
3. Trigger a test alert: temporarily edit a monitor's threshold in the UI
   to a value that's guaranteed to trip (e.g. error rate > 0), wait for
   the email, then revert.

For Slack, you'd connect the Slack integration under **Integrations**
and then reference `@slack-<channel-name>` in the monitor message body —
but you don't currently have a Slack workspace, so email is fine.

---

## Step 7 — Drop the resume hedge

Open the resume editor (your portfolio's `/applications` Resume tab, or
the S3 base PDF) and replace the current line:

> *Built observability with Prometheus, Grafana, and Loki for cluster
> metrics, application logs, and SLO dashboards; integrated CloudWatch
> alarms and **Datadog-style golden-signal monitoring** to cut incident
> MTTR by 35%.*

with the factually-backed version:

> *Built observability with Prometheus, Grafana, and Loki for cluster
> metrics, application logs, and SLO dashboards; implemented Datadog
> serverless APM, 99.5% availability + p95 latency SLOs, and golden-signal
> dashboards/monitors as code via the Datadog Terraform provider, with
> custom metrics for AI token usage and pipeline success rates.*

You can now talk to it in interviews:
- "Yes, I provisioned the dashboard as Terraform — here's the file."
- "The SLO query is `1 - errors/invocations` over 30 days with a 99.5% target."
- "The Extension Layer fetches the API key from SSM at cold-start so we don't
  ship the key in the function env vars."
- "Sample rate is 0.1 globally with jobs-resume turned down to 0.01
  because its Apify burst would dominate the trace quota."

---

## Step 8 — Cost guardrails (after the trial)

After 14 days you'll be on the free tier. To stay there:

1. **Datadog UI → Plan & Usage → Usage** — watch the *Indexed Spans* and
   *Custom Metrics* counters.
2. **Custom metrics**: free tier is 100 metrics per host. We use 9 names
   (well under the cap).
3. **Indexed traces**: free tier is 1M / month. At 10% sampling and
   hobby traffic you'll be far under.
4. If you ever exceed: bump `datadog_trace_sample_rate` down to `0.01`
   and `terraform apply` — takes effect on the next Lambda cold-start.

---

## Tearing it back down

If you want to remove the whole Datadog footprint cleanly:

```hcl
# terraform.tfvars
enable_datadog = false
```

```powershell
terraform apply
```

This:
- Detaches both Datadog layers from every Lambda (handler reverts to
  `lambda_handler.handler`).
- Destroys the dashboard, SLOs, monitors, and synthetic test in Datadog.
- Removes the SSM SecureString (you can also delete the value from the
  Datadog side under Organization Settings → API Keys).

The custom-metric `dd_metric(...)` and `dd_span(...)` calls left in the
Python code become no-ops automatically — no code change needed.

---

## Troubleshooting cheat-sheet

| Symptom | Fix |
|---------|-----|
| `terraform apply` errors with `403 Forbidden` from Datadog | Wrong API/App key, or `datadog_site` doesn't match the org's actual site. Check the URL in your Datadog UI's browser tab. |
| Layer ARN not found | Bump `datadog_extension_layer_version` / `datadog_python_layer_version` to the latest from the GitHub release pages. |
| Lambda returns 500 right after enabling Datadog | Check CloudWatch logs for the affected Lambda. Almost always `DD_API_KEY_SECRET_ARN` couldn't be read — confirm the SSM parameter `/portfolio/prod/datadog-api-key` exists and the Lambda role has `ssm:GetParameter` on `/portfolio/*` (it does, by default). |
| No spans in Datadog APM after 15 min | Confirm `DD_LAMBDA_HANDLER=lambda_handler.handler` is set on every Lambda (it is, via Terraform). Check that the Lambda's actual handler in the AWS console reads `datadog_lambda.handler.handler`. |
| Custom metrics missing | Check that `DD_LAMBDA_HANDLER` is set (the facade keys off it). Force a cold start by deploying a no-op code change. |
| SLO shows "No data" | SLOs need ~10 min of metric flow to populate. Trigger traffic with `curl /api/health` repeatedly. |

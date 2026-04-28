/**
 * Ephemeral Preview Environments — enterprise-grade case study.
 *
 * Showcases the per-PR serverless platform built on this repo: shared
 * CloudFront with viewer-request rewrite, Terraform workspace per slug,
 * pinned Lambda layer ARN, tag-as-truth reaper, full GitOps lifecycle.
 */
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import AWSEnterpriseArchDiagram, { type EAA_DiagramData } from '@/components/AWSEnterpriseArchDiagram';
import {
    ArrowLeft, ArrowRight, Sparkles, Github, GitBranch, GitPullRequest,
    Layers, Cpu, Network, Globe, HardDrive, Database, Lock, Activity,
    Server, Wifi, Code, Rocket, CheckCircle2, XCircle, Clock,
    Shield, Zap, DollarSign, Lightbulb, Tag, Workflow, Boxes, Trash2,
    Hash, Eye, Bell, Repeat,
} from 'lucide-react';
import {
    SiTerraform, SiGithubactions, SiMongodb, SiAmazonwebservices,
} from 'react-icons/si';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';

// ============================================================================
// Hero stats + section heading helpers
// ============================================================================

function StatCard({ value, label, icon, accent }: {
    value: string; label: string; icon: React.ReactNode; accent: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        >
            <Card className="p-4 border-0 shadow-lg bg-card/80 backdrop-blur-sm h-full relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
                <div className="flex items-center gap-2 mb-1.5" style={{ color: accent }}>{icon}</div>
                <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{label}</div>
            </Card>
        </motion.div>
    );
}

function SectionHeading({ kicker, kickerIcon, title, subtitle }: {
    kicker: string; kickerIcon?: React.ReactNode; title: string; subtitle?: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            className="mb-8"
        >
            <Badge variant="outline" className="mb-3 border-primary/40 text-primary px-3 py-1 text-xs uppercase tracking-wider">
                {kickerIcon}
                <span className="ml-1.5">{kicker}</span>
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{title}</h2>
            {subtitle && <p className="text-sm md:text-base text-muted-foreground max-w-3xl">{subtitle}</p>}
        </motion.div>
    );
}

// ============================================================================
// Animated GitOps lifecycle (PR open -> ready -> close -> destroy)
// ============================================================================

const LIFECYCLE_STEPS = [
    {
        id: 'open',
        icon: <GitPullRequest className="h-4 w-4" />,
        accent: '#10B981',
        title: 'PR opened',
        sub: 'github.head_ref = feat/x',
        body: 'GitHub fires a pull_request:opened webhook. preview-up.yml starts.',
    },
    {
        id: 'slug',
        icon: <Hash className="h-4 w-4" />,
        accent: '#A855F7',
        title: 'Slugify',
        sub: 'pr-feat-x',
        body: 'scripts/slugify.sh enforces pr- prefix, length cap with sha8 suffix on overflow, and rejects reserved labels.',
    },
    {
        id: 'pin',
        icon: <Lock className="h-4 w-4" />,
        accent: '#F59E0B',
        title: 'Pin layer',
        sub: 'aws lambda list-layer-versions',
        body: 'Capture the prod shared-layer ARN once, write it into DynamoDB. Prod redeploys mid-PR cannot rebase the preview onto a new layer.',
    },
    {
        id: 'ws',
        icon: <Boxes className="h-4 w-4" />,
        accent: '#7B42BC',
        title: 'Workspace',
        sub: 'terraform workspace select',
        body: 'Per-slug workspace partitions state on the existing S3 backend. New PR = new workspace, isolated lock.',
    },
    {
        id: 'apply',
        icon: <SiTerraform className="h-4 w-4" />,
        accent: '#7B42BC',
        title: 'terraform apply',
        sub: '5 lambdas + API GW + Route53',
        body: 'Ephemeral module reuses prod IAM role + read-only SSM via terraform_remote_state. Tags every resource with EphemeralBranch={slug}.',
    },
    {
        id: 'frontend',
        icon: <HardDrive className="h-4 w-4" />,
        accent: '#3ECF8E',
        title: 'Frontend',
        sub: 'S3 sync /{slug}/* + CF invalidate',
        body: 'Vite build with VITE_API_URL=https://{slug}.preview.../api → s3://portfolio-preview-shared/{slug}/. CloudFront Function rewrites the host to that prefix.',
    },
    {
        id: 'ready',
        icon: <CheckCircle2 className="h-4 w-4" />,
        accent: '#10B981',
        title: 'Ready',
        sub: '~2 min from push',
        body: 'DDB row written, sticky PR comment posted with the preview URL. Whole env spun up without any per-PR CloudFront create.',
    },
    {
        id: 'live',
        icon: <Activity className="h-4 w-4" />,
        accent: '#3B82F6',
        title: 'In use',
        sub: 'reviewers click the URL',
        body: 'Traffic hits the shared CloudFront → CF Function tags it with X-Preview-Slug → routed to that PR\'s API Gateway and Lambdas → per-env Mongo DB.',
    },
    {
        id: 'close',
        icon: <XCircle className="h-4 w-4" />,
        accent: '#EF4444',
        title: 'PR closed',
        sub: 'pull_request:closed',
        body: 'preview-down.yml runs. Mark DDB row destroying. Same path also fires from the dashboard via workflow_dispatch.',
    },
    {
        id: 'drain',
        icon: <Trash2 className="h-4 w-4" />,
        accent: '#EF4444',
        title: 'Drain → destroy',
        sub: 'API GW deleted first, sleep 30s',
        body: 'Inbound traffic dies in seconds. Then drop portfolio_pr_{slug} (script refuses any non-preview name), terraform destroy, empty S3 prefix, delete workspace + DDB row.',
    },
    {
        id: 'reap',
        icon: <Repeat className="h-4 w-4" />,
        accent: '#A855F7',
        title: 'Daily reaper',
        sub: 'EventBridge → Lambda',
        body: 'Tag API is the source of truth. Reaper reconciles against open PRs + last_seen_at. Dispatches preview-down.yml for anything closed/idle/orphaned.',
    },
];

function LifecycleTimeline() {
    const [active, setActive] = useState<number | null>(null);
    return (
        <div className="relative">
            {/* horizontal rail */}
            <div className="absolute left-0 right-0 top-[26px] h-0.5 bg-gradient-to-r from-emerald-500/40 via-violet-500/40 to-rose-500/40 rounded-full" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-11 gap-3">
                {LIFECYCLE_STEPS.map((step, i) => (
                    <motion.button
                        key={step.id}
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onFocus={() => setActive(i)}
                        onMouseLeave={() => setActive(null)}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.04 }}
                        className="group flex flex-col items-center text-center px-1"
                    >
                        <motion.div
                            className="relative flex items-center justify-center w-12 h-12 rounded-2xl shadow-lg ring-1 ring-white/10 backdrop-blur"
                            style={{ background: `linear-gradient(135deg, ${step.accent}25, ${step.accent}05)`, color: step.accent }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <div className="absolute inset-0 rounded-2xl border" style={{ borderColor: `${step.accent}55` }} />
                            {step.icon}
                            <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold rounded-full px-1.5 py-0.5 bg-background/80 text-foreground/80 border border-white/10 tabular-nums">
                                {String(i + 1).padStart(2, '0')}
                            </span>
                        </motion.div>
                        <p className="mt-2 text-[11px] font-bold text-foreground leading-tight">{step.title}</p>
                        <p className="text-[9px] text-muted-foreground leading-tight font-mono mt-0.5 truncate w-full">{step.sub}</p>
                    </motion.button>
                ))}
            </div>

            {/* description card */}
            <motion.div
                key={active ?? 'idle'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-6"
            >
                <Card className="p-4 border-0 shadow-md bg-card/80 backdrop-blur-sm">
                    {active !== null ? (
                        <div className="flex gap-3 items-start">
                            <div
                                className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                                style={{ background: `${LIFECYCLE_STEPS[active].accent}20`, color: LIFECYCLE_STEPS[active].accent }}
                            >
                                {LIFECYCLE_STEPS[active].icon}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-foreground">{LIFECYCLE_STEPS[active].title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{LIFECYCLE_STEPS[active].body}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground italic text-center">
                            Hover any step to expand. The whole loop runs autonomously — open a PR, the env appears; close it, the env vanishes.
                        </p>
                    )}
                </Card>
            </motion.div>
        </div>
    );
}

// ============================================================================
// Terraform features showcase
// ============================================================================

const TF_FEATURES = [
    {
        icon: <Boxes className="h-4 w-4" />,
        accent: '#7B42BC',
        name: 'Workspaces',
        body: 'One workspace per slug on a shared S3 backend. State is partitioned automatically — workspaces are not mixed with prod state.',
        snippet: 'terraform workspace select "$slug" || \\\nterraform workspace new "$slug"',
    },
    {
        icon: <Layers className="h-4 w-4" />,
        accent: '#06B6D4',
        name: 'Reusable module',
        body: 'modules/ephemeral encapsulates the per-PR resources (5 Lambdas + API GW + Route53 alias) so the per-PR root is < 100 lines.',
        snippet: 'module "ephemeral" {\n  source            = "../modules/ephemeral"\n  branch_slug       = var.branch_slug\n  layer_version_arn = var.layer_version_arn\n  ...\n}',
    },
    {
        icon: <Network className="h-4 w-4" />,
        accent: '#3B82F6',
        name: 'terraform_remote_state',
        body: 'The per-PR root reads prod outputs (Lambda role, zone id, SSM names, shared CF) instead of duplicating resources. Single source of truth.',
        snippet: 'data "terraform_remote_state" "prod" {\n  backend = "s3"\n  config  = { bucket = ..., key = "portfolio/terraform.tfstate" }\n}',
    },
    {
        icon: <Lock className="h-4 w-4" />,
        accent: '#F59E0B',
        name: 'Pinned layer ARN',
        body: 'CI captures the current shared-layer ARN at PR-open time and passes it as an input variable. Prod redeploys cannot drift live previews.',
        snippet: 'variable "layer_version_arn" {\n  description = "Pinned at PR-open; never a data source"\n  type        = string\n}',
    },
    {
        icon: <Tag className="h-4 w-4" />,
        accent: '#10B981',
        name: 'Tag-driven scoping',
        body: 'IAM policies use ResourceTag conditions; the reaper queries ResourceGroupsTaggingAPI. Tags become the authoritative inventory.',
        snippet: 'Condition = {\n  StringEquals = {\n    "aws:ResourceTag/Purpose" = "ephemeral-previews"\n  }\n}',
    },
    {
        icon: <Eye className="h-4 w-4" />,
        accent: '#EF4444',
        name: 'lifecycle ignore_changes',
        body: 'Terraform owns infra config; CI owns code. ignore_changes on filename/source_code_hash/layers prevents apply from undoing deploys.',
        snippet: 'lifecycle {\n  ignore_changes = [filename, source_code_hash, layers]\n}',
    },
    {
        icon: <Workflow className="h-4 w-4" />,
        accent: '#A855F7',
        name: 'count-gated rollout',
        body: 'enable_preview_infra = true gates the entire shared scaffolding. The same root supports prod-only or prod+preview without conditional modules.',
        snippet: 'resource "aws_dynamodb_table" "ephemeral_envs" {\n  count = local.preview_enabled ? 1 : 0\n  ...\n}',
    },
    {
        icon: <Shield className="h-4 w-4" />,
        accent: '#DC2626',
        name: 'Multi-platform locks',
        body: '.terraform.lock.hcl holds checksums for linux_amd64/arm64, darwin_amd64/arm64, windows_amd64. Anyone on the team can run init without re-locking.',
        snippet: 'terraform providers lock \\\n  -platform=linux_amd64 -platform=darwin_arm64 \\\n  -platform=windows_amd64',
    },
];

function TfFeatureCard({ f, idx }: { f: typeof TF_FEATURES[number]; idx: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: idx * 0.04 }}
        >
            <Card className="p-4 h-full border-0 shadow-lg bg-card/80 backdrop-blur-sm hover:shadow-xl transition-shadow group">
                <div className="flex items-start gap-3 mb-3">
                    <div
                        className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ring-1"
                        style={{ background: `${f.accent}1a`, color: f.accent, borderColor: `${f.accent}33` }}
                    >
                        {f.icon}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground">{f.name}</p>
                        <p className="text-xs text-muted-foreground leading-snug mt-0.5">{f.body}</p>
                    </div>
                </div>
                <pre className="text-[10.5px] leading-snug font-mono bg-zinc-950/80 dark:bg-black/60 text-emerald-200/90 rounded-lg p-2.5 overflow-x-auto border border-white/5">
                    {f.snippet}
                </pre>
            </Card>
        </motion.div>
    );
}

// ============================================================================
// Code snippet block
// ============================================================================

function CodeBlock({ title, language, code, accent }: {
    title: string; language: string; code: string; accent: string;
}) {
    return (
        <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-gradient-to-r from-black/40 to-transparent">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400/70" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                    </div>
                    <p className="text-xs font-mono text-muted-foreground ml-2">{title}</p>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider" style={{ color: accent, borderColor: `${accent}55` }}>
                    {language}
                </Badge>
            </div>
            <pre className="text-[11.5px] leading-relaxed font-mono p-4 overflow-x-auto bg-zinc-950/90 dark:bg-black/70 text-zinc-100">
                {code}
            </pre>
        </Card>
    );
}

// ============================================================================
// Tradeoff table
// ============================================================================

const TRADEOFFS: Array<{ decision: string; alt: string; why: string }> = [
    {
        decision: 'Shared CloudFront + CF Function host rewrite',
        alt: 'One CloudFront distribution per PR',
        why: 'Per-PR distributions take ~15-20 min to provision. Sharing one distribution and rewriting at the edge brings spin-up down to ~2 minutes.',
    },
    {
        decision: 'Pinned Lambda layer ARN',
        alt: 'data "aws_lambda_layer_version" lookup',
        why: 'A data lookup re-resolves on every apply. If prod publishes a new layer, the next preview apply silently rebases. Pinning at PR-open prevents that.',
    },
    {
        decision: 'Tag API as source of truth',
        alt: 'DynamoDB as source of truth',
        why: 'A failed teardown leaves AWS resources behind. If DDB were authoritative, those resources would be invisible. Tag API closes the loop.',
    },
    {
        decision: 'Per-env Mongo DB on shared cluster',
        alt: 'One Mongo cluster per PR',
        why: 'M10 clusters take ~5 minutes to provision and cost $9 each. Per-DB isolation on one cluster gives schema isolation at zero marginal cost.',
    },
    {
        decision: 'Delete API GW first on teardown',
        alt: 'terraform destroy in-place',
        why: 'destroy is not a load balancer drain. Killing the API endpoint first hard-fails inbound requests so the Mongo drop later is safe.',
    },
    {
        decision: 'Workflow dispatch for dashboard teardown',
        alt: 'Direct AWS API calls from the backend',
        why: 'Reusing preview-down.yml means one well-tested teardown path covers PR close, dashboard click, and reaper. No drift.',
    },
];

// ============================================================================
// GitOps workflow visual (preview-up vs preview-down vs reaper rails)
// ============================================================================

const GITOPS_LANES: Array<{
    title: string; trigger: string; steps: string[]; accent: string; icon: React.ReactNode;
}> = [
    {
        title: 'preview-up.yml',
        trigger: 'pull_request: opened | synchronize | reopened',
        accent: '#10B981',
        icon: <Rocket className="h-4 w-4" />,
        steps: [
            'Compute slug (slugify.sh)',
            'aws lambda list-layer-versions → pin ARN',
            'terraform init -backend-config=backend.hcl',
            'workspace select-or-new $slug',
            'apply with TF_VAR_branch_slug, layer_version_arn',
            'pip install + zip + lambda update-function-code (×5)',
            'npm ci && npm run build (VITE_API_URL set per slug)',
            'aws s3 sync dist → /{slug}/',
            'CloudFront invalidate /{slug}/*',
            'aws dynamodb put-item (status=ready)',
            'sticky-pr-comment with the URL',
        ],
    },
    {
        title: 'preview-down.yml',
        trigger: 'pull_request: closed   |   workflow_dispatch',
        accent: '#EF4444',
        icon: <Trash2 className="h-4 w-4" />,
        steps: [
            'Set DDB row status=destroying',
            'aws apigatewayv2 delete-api (drain inbound)',
            'sleep 30',
            'pymongo drop_database portfolio_pr_{slug}',
            'aws s3 rm s3://.../{slug}/ --recursive',
            'terraform destroy -auto-approve',
            'terraform workspace delete $slug',
            'aws dynamodb delete-item',
            'Update sticky comment',
        ],
    },
    {
        title: 'EventBridge → reaper',
        trigger: 'rate(1 day)',
        accent: '#A855F7',
        icon: <Bell className="h-4 w-4" />,
        steps: [
            'List slugs from ResourceGroupsTaggingAPI',
            'Scan DynamoDB for state',
            'GitHub API: pulls/{n} → state',
            'Compute reap targets (closed | idle>7d | orphaned)',
            'workflow_dispatch preview-down.yml per target',
        ],
    },
];

// ============================================================================
// Main page
// ============================================================================

// Coordinate plan (viewBox 1600×900):
//   Trigger   : x ≈ 200,    y mid ≈ 450
//   CI/CD     : x ≈ 480,    y top 250 / bottom 650
//   Edge      : x ≈ 800,    y 200 / 450 / 700
//   Per-PR    : x ≈ 1140,   y 270 / 600
//   Data + CP : x ≈ 1450,   y 220 / 470 / 720
const HERO_DIAGRAM: EAA_DiagramData = {
    title: 'Per-PR Ephemeral Environment — Reference Architecture',
    subtitle: 'Toggle phases (Provisioning · Request · Teardown) and play through the steps.',
    viewBox: [1600, 900],
    regions: [
        { id: 'src',     label: 'Source',                          badge: 'GitHub',           x: 60,    y: 90,  width: 280, height: 720, color: '#24292F' },
        { id: 'ci',      label: 'CI / CD',                         badge: 'GitHub Actions',   x: 360,   y: 90,  width: 260, height: 720, color: '#7B42BC' },
        { id: 'edge',    label: 'AWS Edge — Shared',               badge: 'Account · Global', x: 640,   y: 90,  width: 320, height: 720, color: '#06B6D4', dashed: true },
        { id: 'compute', label: 'AWS — Per-PR Compute',            badge: 'TF Workspace',     x: 980,   y: 90,  width: 320, height: 720, color: '#3B82F6', dashed: true },
        { id: 'data',    label: 'Shared Data + Control Plane',     badge: 'Account',          x: 1320,  y: 90,  width: 260, height: 720, color: '#10B981' },
    ],
    nodes: [
        // Source
        {
            id: 'pr',
            label: 'Pull Request',
            sublabel: 'opened · synced · closed',
            chip: 'Webhook',
            description: 'GitHub fires pull_request:* webhooks. opened/synchronize/reopened triggers the up workflow; closed triggers the down workflow.',
            icon: <Github className="h-7 w-7" />,
            category: 'Source',
            categoryColor: '#24292F',
            accentColor: '#24292F',
            x: 200, y: 450,
        },
        // CI/CD
        {
            id: 'up',
            label: 'preview-up.yml',
            sublabel: 'GitHub Actions',
            chip: 'Run',
            description: 'Computes slug, pins the prod Lambda layer ARN, runs terraform workspace-select-or-new, applies the ephemeral module, builds the frontend, syncs S3, posts a sticky PR comment.',
            icon: <SiGithubactions className="h-7 w-7" />,
            category: 'CI/CD',
            categoryColor: '#2088FF',
            accentColor: '#2088FF',
            x: 490, y: 250,
        },
        {
            id: 'tf',
            label: 'Terraform',
            sublabel: 'workspace per slug',
            chip: 'IaC',
            description: 'Per-slug workspace on the existing S3 backend. Reads prod outputs via terraform_remote_state. Module reuse keeps the per-PR root < 100 LOC.',
            icon: <SiTerraform className="h-7 w-7" />,
            category: 'IaC',
            categoryColor: '#7B42BC',
            accentColor: '#7B42BC',
            x: 490, y: 450,
        },
        {
            id: 'down',
            label: 'preview-down.yml',
            sublabel: 'closed | workflow_dispatch',
            chip: 'Drain',
            description: 'Marks DDB destroying, deletes the API GW first to drain inbound traffic, sleeps 30s, drops the per-env Mongo DB, terraform destroy, empties S3 prefix, deletes the workspace + DDB row.',
            icon: <SiGithubactions className="h-7 w-7" />,
            category: 'CI/CD',
            categoryColor: '#EF4444',
            accentColor: '#EF4444',
            x: 490, y: 650,
        },
        // Edge
        {
            id: 'r53',
            label: 'Route 53',
            sublabel: '{slug}.preview alias',
            chip: 'DNS',
            description: 'Per-slug A/AAAA alias under the wildcard ACM cert *.preview.{domain}. Created and destroyed by Terraform; never touched by hand.',
            icon: <Globe className="h-7 w-7" />,
            category: 'Networking',
            categoryColor: '#8B5CF6',
            accentColor: '#8B5CF6',
            x: 800, y: 200,
        },
        {
            id: 'cf',
            label: 'CloudFront',
            sublabel: 'shared distribution',
            chip: 'Edge',
            description: 'A single CloudFront distribution serves every PR. Skips the 15–20 minute per-PR distribution create entirely. Fronted by *.preview wildcard ACM cert.',
            icon: <Wifi className="h-7 w-7" />,
            category: 'Edge',
            categoryColor: '#06B6D4',
            accentColor: '#06B6D4',
            x: 800, y: 450,
        },
        {
            id: 'cfn',
            label: 'CloudFront Function',
            sublabel: 'host → /{slug}/* rewrite',
            chip: 'Viewer-Req',
            description: 'Viewer-request function rewrites {slug}.preview.{domain}/path to /{slug}/path on the S3 origin and tags /api/* with X-Preview-Slug for the API origin.',
            icon: <Code className="h-7 w-7" />,
            category: 'Edge',
            categoryColor: '#F59E0B',
            accentColor: '#F59E0B',
            x: 800, y: 700,
        },
        // Per-PR Compute
        {
            id: 'apigw',
            label: 'API Gateway v2',
            sublabel: 'per-PR HTTP API',
            chip: 'Per-PR',
            description: 'HTTP API created per workspace. Mirrors prod\'s 20-route table. CORS scoped to {slug}.preview.{domain}.',
            icon: <Server className="h-7 w-7" />,
            category: 'API',
            categoryColor: '#E7157B',
            accentColor: '#E7157B',
            x: 1140, y: 270,
        },
        {
            id: 'lambda',
            label: 'AWS Lambda',
            sublabel: '5 services per PR',
            chip: 'ARM64',
            description: 'Five Lambdas (visitor, auth, jobs-resume, chat, infra) named portfolio-preview-{slug}-{service}. Pinned shared layer ARN. Reuses prod IAM role.',
            icon: <Cpu className="h-7 w-7" />,
            category: 'Compute',
            categoryColor: '#FF9900',
            accentColor: '#FF9900',
            x: 1140, y: 600,
        },
        // Shared Data + CP
        {
            id: 's3',
            label: 'S3 Prefix',
            sublabel: 'portfolio-preview-shared/{slug}/*',
            chip: 'Origin',
            description: 'Single shared bucket; one prefix per env. 14-day prefix lifecycle as a teardown safety net. CloudFront origin via OAC.',
            icon: <HardDrive className="h-7 w-7" />,
            category: 'Storage',
            categoryColor: '#3ECF8E',
            accentColor: '#3ECF8E',
            x: 1450, y: 220,
        },
        {
            id: 'mongo',
            label: 'MongoDB Atlas',
            sublabel: 'portfolio_pr_{slug}',
            chip: 'Per-env DB',
            description: 'Single shared M10 cluster; one database per preview env. Schema-level isolation. Drop script refuses any name not prefixed portfolio_pr_.',
            icon: <SiMongodb className="h-7 w-7" />,
            category: 'Database',
            categoryColor: '#00684A',
            accentColor: '#00684A',
            x: 1450, y: 470,
        },
        {
            id: 'ddb',
            label: 'DynamoDB',
            sublabel: 'portfolio-ephemeral-envs',
            chip: 'Index',
            description: 'Operational index for the dashboard (PK=branch_slug). AWS resource tags remain the source of truth — DDB is reconciled, not authoritative.',
            icon: <Activity className="h-7 w-7" />,
            category: 'Database',
            categoryColor: '#3B82F6',
            accentColor: '#3B82F6',
            x: 1450, y: 720,
        },
    ],
    edges: [
        // ───── Provisioning phase (steps 1..7)
        { from: 'pr',  to: 'up',     label: 'opened/synced',  phase: 'provision', step: 1, fromSide: 'right', toSide: 'left' },
        { from: 'up',  to: 'tf',     label: 'apply',          phase: 'provision', step: 2, fromSide: 'bottom', toSide: 'top' },
        { from: 'tf',  to: 'r53',    label: 'create alias',   phase: 'provision', step: 3, dashed: true,  fromSide: 'right', toSide: 'left' },
        { from: 'tf',  to: 'apigw',  label: 'create API GW',  phase: 'provision', step: 4, dashed: true,  fromSide: 'right', toSide: 'left' },
        { from: 'tf',  to: 'lambda', label: 'deploy lambdas', phase: 'provision', step: 5, dashed: true,  fromSide: 'right', toSide: 'left' },
        { from: 'up',  to: 's3',     label: 'sync /{slug}/*', phase: 'provision', step: 6, dashed: true,  fromSide: 'right', toSide: 'top' },
        { from: 'up',  to: 'ddb',    label: 'put-item ready', phase: 'provision', step: 7, dashed: true,  fromSide: 'right', toSide: 'top' },

        // ───── Request flow (steps 1..6)
        { from: 'pr',     to: 'r53',    label: 'DNS lookup',         phase: 'request', step: 1, fromSide: 'right', toSide: 'left' },
        { from: 'r53',    to: 'cf',     label: 'alias',              phase: 'request', step: 2, dashed: true, fromSide: 'bottom', toSide: 'top' },
        { from: 'cf',     to: 'cfn',    label: 'viewer-request',     phase: 'request', step: 3, fromSide: 'bottom', toSide: 'top' },
        { from: 'cfn',    to: 's3',     label: 'rewrite → /{slug}/', phase: 'request', step: 4, fromSide: 'right', toSide: 'left' },
        { from: 'cfn',    to: 'apigw',  label: 'X-Preview-Slug',     phase: 'request', step: 5, fromSide: 'right', toSide: 'left' },
        { from: 'apigw',  to: 'lambda', label: 'invoke',             phase: 'request', step: 6, fromSide: 'bottom', toSide: 'top' },
        { from: 'lambda', to: 'mongo',  label: 'per-PR DB',          phase: 'request', step: 7, fromSide: 'right', toSide: 'left' },

        // ───── Teardown (steps 1..6)
        { from: 'pr',     to: 'down',   label: 'closed',                phase: 'teardown', step: 1, fromSide: 'right', toSide: 'left' },
        { from: 'ddb',    to: 'down',   label: 'reaper dispatch',       phase: 'teardown', step: 2, dashed: true, fromSide: 'left', toSide: 'right' },
        { from: 'down',   to: 'apigw',  label: 'delete API GW (drain)', phase: 'teardown', step: 3, dashed: true, fromSide: 'right', toSide: 'left' },
        { from: 'down',   to: 'mongo',  label: 'drop_database',         phase: 'teardown', step: 4, dashed: true, fromSide: 'right', toSide: 'left' },
        { from: 'down',   to: 'tf',     label: 'destroy',               phase: 'teardown', step: 5, dashed: true, fromSide: 'top', toSide: 'bottom' },
        { from: 'down',   to: 's3',     label: 'rm /{slug}/*',          phase: 'teardown', step: 6, dashed: true, fromSide: 'right', toSide: 'left' },
    ],
};

const CFN_SNIPPET = `function handler(event) {
  var req = event.request;
  var host = req.headers.host && req.headers.host.value;
  var parts = host ? host.split(".") : [];
  // Expect: {slug}.preview.{...domain...}
  if (parts.length < 3 || parts[1] !== "preview") return req;

  var slug = parts[0];
  // Tag every request so the API origin can route to the right preview env.
  req.headers["x-preview-slug"] = { value: slug };

  var uri = req.uri;
  if (uri.indexOf("/api/") === 0) return req;

  // Static asset rewrite: "/" -> "/{slug}/index.html",  "/foo" -> "/{slug}/foo"
  req.uri = uri === "/" || uri === "" ? "/" + slug + "/index.html" : "/" + slug + uri;
  return req;
}`;

const SLUGIFY_SNIPPET = `# scripts/slugify.sh — branch ref -> ephemeral env slug
ref="$1"
core=$(echo -n "$ref" \\
    | tr '[:upper:]' '[:lower:]' \\
    | sed -E 's/[^a-z0-9-]+/-/g; s/-+/-/g; s/^-+//; s/-+$//')
slug="pr-$core"

# Length cap: pr- + 18 chars + sha8 = 30 max
if (( \${#slug} > 30 )); then
  sha8=$(echo -n "$ref" | sha256sum | cut -c1-8)
  head=$(echo -n "$core" | cut -c1-18 | sed -E 's/-+$//')
  slug="pr-\${head}-\${sha8}"
fi

case "$slug" in
  pr-prod|pr-main|pr-www|pr-api|pr-admin)
    echo "slugify: '$slug' is reserved" >&2; exit 1 ;;
esac
echo "$slug"`;

const TF_WORKSPACE_SNIPPET = `# infrastructure/terraform/preview/main.tf
terraform {
  backend "s3" {
    key     = "preview/terraform.tfstate"   # workspace name suffixes this
    encrypt = true
  }
}

# Read prod state without duplicating resources
data "terraform_remote_state" "prod" {
  backend = "s3"
  config  = { bucket = var.prod_state_bucket, key = var.prod_state_key, region = var.aws_region }
}

module "ephemeral" {
  source              = "../modules/ephemeral"
  branch_slug         = var.branch_slug
  pr_number           = var.pr_number
  layer_version_arn   = var.layer_version_arn          # pinned at PR-open time
  lambda_role_arn     = data.terraform_remote_state.prod.outputs.lambda_role_arn
  ssm_parameter_names = data.terraform_remote_state.prod.outputs.ssm_param_names
  ...
}`;

const REAPER_SNIPPET = `# portfolio-backend/services/infra/reaper.py
def handler(event, context):
    pat  = ssm("SSM_PREVIEW_GITHUB_PAT")
    repo = ssm("SSM_PREVIEW_GITHUB_REPO")

    # 1. AWS resource tags are the source of truth.
    tag_slugs = slugs_from_tags()       # ResourceGroupsTaggingAPI
    rows      = ddb_rows()              # operational index only
    all_slugs = tag_slugs | set(rows.keys())

    targets = []
    for slug in sorted(all_slugs):
        pr   = int(rows.get(slug, {}).get("pr_number") or 0)
        idle = is_idle(rows.get(slug, {}))
        if   pr and not pr_open(repo, pat, pr):  reason = "pr-closed"
        elif idle:                                reason = f"idle>{IDLE_DAYS}d"
        elif slug in tag_slugs and slug not in rows: reason = "orphaned-aws"
        else:                                     continue
        targets.append((slug, reason))

    # 2. Reuse preview-down.yml so all teardowns share one tested path.
    for slug, reason in targets:
        trigger_teardown(repo, pat, slug)
    return {"ok": True, "targets": targets}`;

export default function EphemeralEnvironmentsCaseStudy() {
    const navigate = useNavigate();
    useVisitorTracking('project-ephemeral-environments');

    useEffect(() => { window.scrollTo(0, 0); }, []);

    return (
        <div className="min-h-screen bg-background">
            {/* ─── Sticky header ────────────────────────────────────────── */}
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
                <div className="container flex items-center justify-between py-3">
                    <Button variant="ghost" onClick={() => navigate('/home#projects')} className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Portfolio
                    </Button>
                    <div className="flex items-center gap-3">
                        <Badge className="bg-emerald-500 text-white">
                            <Sparkles className="h-3 w-3 mr-1" /> Live
                        </Badge>
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <main className="container px-4 md:px-6 py-8 md:py-12 max-w-6xl mx-auto">
                {/* ─── HERO ──────────────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-12"
                >
                    <Badge variant="outline" className="mb-4 border-primary/40 text-primary px-3 py-1 text-xs uppercase tracking-wider">
                        <SiAmazonwebservices className="h-3 w-3 mr-1.5" />
                        Platform Engineering · GitOps · Serverless on AWS
                    </Badge>
                    <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-3 leading-tight">
                        Ephemeral Preview Environments
                    </h1>
                    <p className="text-base md:text-lg text-muted-foreground max-w-3xl mb-6">
                        Every pull request gets a production-grade preview at{' '}
                        <code className="text-primary font-mono">{'{slug}.preview.manneharshithsiddardha.com'}</code>{' '}
                        — Lambdas, API Gateway, Mongo DB, Route53, CloudFront, all auto-provisioned and auto-destroyed.
                        A daily reaper closes the loop. An admin dashboard ships with it.
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
                        <StatCard value="~2 min" label="PR open → reachable URL" icon={<Zap className="h-4 w-4" />} accent="#10B981" />
                        <StatCard value="5" label="Lambdas per PR (ARM64)" icon={<Cpu className="h-4 w-4" />} accent="#FF9900" />
                        <StatCard value="1" label="Shared CloudFront for all envs" icon={<Wifi className="h-4 w-4" />} accent="#06B6D4" />
                        <StatCard value="$0" label="Idle cost per env" icon={<DollarSign className="h-4 w-4" />} accent="#A855F7" />
                        <StatCard value="7d" label="Idle reaper window" icon={<Clock className="h-4 w-4" />} accent="#EF4444" />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {['AWS Lambda', 'API Gateway', 'CloudFront + CF Function', 'Route53', 'ACM Wildcard', 'Terraform Workspaces', 'GitHub Actions', 'DynamoDB', 'EventBridge', 'MongoDB Atlas', 'IAM (tag-scoped)', 'SSM SecureStrings'].map((t) => (
                            <span key={t} className="text-[11px] font-mono px-2 py-1 rounded-md bg-muted/50 text-foreground/70 border border-white/5">
                                {t}
                            </span>
                        ))}
                    </div>
                </motion.section>

                {/* ─── PROBLEM ──────────────────────────────────────────── */}
                <section className="mb-14">
                    <SectionHeading
                        kicker="The problem"
                        kickerIcon={<XCircle className="h-3 w-3 mr-1" />}
                        title="Shared staging is a release bottleneck"
                        subtitle="One staging environment + many in-flight PRs = a queue. Bugs surface late, conflicting changes mask each other, and reviewers can't click a real URL until merge. Engineers learn to avoid staging — which defeats it."
                    />
                    <div className="grid md:grid-cols-3 gap-3">
                        {[
                            { icon: <Clock className="h-5 w-5" />, t: 'Slow feedback', b: '"Works on my machine" because staging held the wrong feature when the reviewer looked.' },
                            { icon: <Network className="h-5 w-5" />, t: 'Hidden conflicts', b: 'Two PRs both touch the same migration; staging flips between states.' },
                            { icon: <DollarSign className="h-5 w-5" />, t: 'Always-on cost', b: 'Staging burns money even when nothing is in flight.' },
                        ].map((p, i) => (
                            <motion.div key={p.t} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                                <Card className="p-4 border-0 bg-card/60 backdrop-blur-sm">
                                    <div className="text-rose-400 mb-2">{p.icon}</div>
                                    <p className="text-sm font-bold text-foreground">{p.t}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{p.b}</p>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* ─── ARCHITECTURE ─────────────────────────────────────── */}
                <section className="mb-14">
                    <SectionHeading
                        kicker="Architecture"
                        kickerIcon={<Layers className="h-3 w-3 mr-1" />}
                        title="One CloudFront, infinite previews"
                        subtitle="A single shared CloudFront distribution fronts every PR. A viewer-request CloudFront Function rewrites the host to an S3 prefix and tags /api/* with X-Preview-Slug. New envs spin up without ever creating a CloudFront distribution — the slow path is bypassed entirely."
                    />
                    <AWSEnterpriseArchDiagram
                        data={HERO_DIAGRAM}
                        initialPhase="request"
                        autoPlayDefault
                    />
                </section>

                {/* ─── LIFECYCLE ────────────────────────────────────────── */}
                <section className="mb-14">
                    <SectionHeading
                        kicker="GitOps lifecycle"
                        kickerIcon={<GitBranch className="h-3 w-3 mr-1" />}
                        title="Push → URL → click → vanish"
                        subtitle="Eleven steps from open to reaped, each owned by a single tool. No human in the loop, no out-of-band scripts, no manual cleanup. Hover any step to see what runs."
                    />
                    <LifecycleTimeline />
                </section>

                {/* ─── TERRAFORM FEATURES ───────────────────────────────── */}
                <section className="mb-14">
                    <SectionHeading
                        kicker="Terraform"
                        kickerIcon={<SiTerraform className="h-3 w-3 mr-1" />}
                        title="The IaC features doing the heavy lifting"
                        subtitle="State partitioning, tag-scoped IAM, layer pinning, count-gated rollouts, lifecycle escape hatches, multi-platform locks — the bits that make this hold up at scale."
                    />
                    <div className="grid md:grid-cols-2 gap-4">
                        {TF_FEATURES.map((f, i) => <TfFeatureCard key={f.name} f={f} idx={i} />)}
                    </div>
                </section>

                {/* ─── GITOPS WORKFLOWS ─────────────────────────────────── */}
                <section className="mb-14">
                    <SectionHeading
                        kicker="GitHub Actions"
                        kickerIcon={<SiGithubactions className="h-3 w-3 mr-1" />}
                        title="Three workflows, one teardown path"
                        subtitle="preview-up.yml provisions; preview-down.yml destroys; the reaper Lambda calls preview-down.yml via workflow_dispatch. The dashboard's teardown button calls the same dispatch. One destroy path, three triggers."
                    />
                    <div className="grid md:grid-cols-3 gap-4">
                        {GITOPS_LANES.map((lane, idx) => (
                            <motion.div
                                key={lane.title}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.06 }}
                            >
                                <Card className="p-4 h-full border-0 shadow-xl bg-card/80 backdrop-blur-sm relative overflow-hidden">
                                    <div className="absolute inset-x-0 top-0 h-1" style={{ background: lane.accent }} />
                                    <div className="flex items-center gap-2 mb-1.5" style={{ color: lane.accent }}>
                                        {lane.icon}
                                        <p className="text-sm font-bold text-foreground">{lane.title}</p>
                                    </div>
                                    <p className="text-[10.5px] font-mono text-muted-foreground mb-3 break-words">on: {lane.trigger}</p>
                                    <ol className="space-y-1.5">
                                        {lane.steps.map((s, i) => (
                                            <li key={i} className="flex gap-2 text-xs text-foreground/80">
                                                <span
                                                    className="shrink-0 w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-bold tabular-nums mt-0.5"
                                                    style={{ background: `${lane.accent}25`, color: lane.accent }}
                                                >
                                                    {i + 1}
                                                </span>
                                                <span className="leading-snug">{s}</span>
                                            </li>
                                        ))}
                                    </ol>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* ─── CODE SNIPPETS ────────────────────────────────────── */}
                <section className="mb-14">
                    <SectionHeading
                        kicker="The interesting bits"
                        kickerIcon={<Code className="h-3 w-3 mr-1" />}
                        title="Code that makes this enterprise-grade"
                        subtitle="Four snippets that carry most of the cleverness: the CloudFront Function that bypasses per-PR distributions, the slug rule that tames Dependabot refs, the per-PR Terraform root that consumes prod state, and the reaper that treats AWS tags as truth."
                    />
                    <div className="grid md:grid-cols-2 gap-4">
                        <CodeBlock
                            title="cloudfront/preview-rewrite.js"
                            language="JS · CF Function"
                            code={CFN_SNIPPET}
                            accent="#06B6D4"
                        />
                        <CodeBlock
                            title="scripts/slugify.sh"
                            language="bash"
                            code={SLUGIFY_SNIPPET}
                            accent="#10B981"
                        />
                        <CodeBlock
                            title="infrastructure/terraform/preview/main.tf"
                            language="HCL · Terraform"
                            code={TF_WORKSPACE_SNIPPET}
                            accent="#7B42BC"
                        />
                        <CodeBlock
                            title="services/infra/reaper.py"
                            language="Python · EventBridge"
                            code={REAPER_SNIPPET}
                            accent="#A855F7"
                        />
                    </div>
                </section>

                {/* ─── TRADEOFFS ───────────────────────────────────────── */}
                <section className="mb-14">
                    <SectionHeading
                        kicker="Engineering decisions"
                        kickerIcon={<Lightbulb className="h-3 w-3 mr-1" />}
                        title="What we picked and what we didn't"
                        subtitle="Six decisions where the obvious answer is wrong. Each is the difference between a demo and something a team can run."
                    />
                    <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm overflow-hidden">
                        <div className="grid grid-cols-12 gap-0 px-4 py-2.5 border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            <div className="col-span-4">Decision</div>
                            <div className="col-span-3">Alternative</div>
                            <div className="col-span-5">Why this</div>
                        </div>
                        {TRADEOFFS.map((t, i) => (
                            <motion.div
                                key={t.decision}
                                initial={{ opacity: 0, x: -8 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.04 }}
                                className={`grid grid-cols-12 gap-3 px-4 py-3 text-xs border-b border-white/5 last:border-b-0 ${i % 2 === 0 ? 'bg-white/[0.015]' : ''}`}
                            >
                                <div className="col-span-4 font-bold text-foreground">{t.decision}</div>
                                <div className="col-span-3 text-muted-foreground line-through decoration-rose-500/40">{t.alt}</div>
                                <div className="col-span-5 text-foreground/80">{t.why}</div>
                            </motion.div>
                        ))}
                    </Card>
                </section>

                {/* ─── CTA ─────────────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center"
                >
                    <Card className="p-6 md:p-8 border-0 shadow-2xl bg-gradient-to-br from-primary/10 via-card to-emerald-500/5">
                        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2">
                            Want preview envs like this on your team?
                        </h3>
                        <p className="text-sm text-muted-foreground mb-5 max-w-xl mx-auto">
                            The whole platform is open source on this repo — Terraform module, workflows, dashboard, reaper. Drop the wildcard cert + shared CloudFront once, and every PR after that is automatic.
                        </p>
                        <div className="flex flex-wrap gap-3 justify-center">
                            <Button className="btn-premium" onClick={() => navigate('/home#contact')}>
                                Talk about platform engineering
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                            <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10" asChild>
                                <a href="https://github.com/manneharshithsiddardha/portfolio" target="_blank" rel="noopener noreferrer">
                                    <Github className="mr-2 h-4 w-4" />
                                    View source
                                </a>
                            </Button>
                            <Button variant="ghost" onClick={() => navigate('/home#projects')} className="text-muted-foreground">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                All projects
                            </Button>
                        </div>
                    </Card>
                </motion.section>
            </main>
        </div>
    );
}

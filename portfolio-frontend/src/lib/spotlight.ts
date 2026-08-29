/**
 * Spotlight — volunteer engineering contributions at Gnanalytica, an early-stage
 * analytics startup based in India.
 *
 * Deliberately carries no period, no employment type and no compensation: this is
 * unpaid contribution to an India-based company, and the page says only that.
 *
 * Every figure below is counted from the repositories, not estimated:
 *
 *   git log --author=<identity> --format=%s | grep -oE '^[a-z]+' | sort | uniq -c
 *   git log --author=<identity> --name-only --format= | ... | sort | uniq -c
 *
 * The date axis is deliberately omitted from the charts — see the module note
 * above about what this section does not assert.
 *
 * Product names are used; client names are not.
 */

export interface PipelineStage {
    key: string;
    label: string;
    detail: string;
    items: string[];
}

/** One segment of the commit-mix bar. */
export interface MixSegment {
    label: string;
    value: number;
}

/** One row of the "where the work landed" chart. */
export interface SurfaceRow {
    label: string;
    value: number;
}

export interface SpotlightStat {
    value: string;
    label: string;
}

export interface SpotlightSystem {
    index: string;
    name: string;
    kind: string;
    headline: string;
    summary: string;
    /** Share of the repository's history, for the ownership readout. */
    commits: { mine: number; total: number; note: string };
    stats: SpotlightStat[];
    commitMix: MixSegment[];
    surface: SurfaceRow[];
    contributions: string[];
    pipeline: PipelineStage[];
    stack: string[];
    /** Accent per theme — the dark value is unreadable on a light ground. */
    accent: { light: string; dark: string };
}

export const SPOTLIGHT_INTRO = {
    eyebrow: 'Spotlight',
    label: 'Volunteer engineering',
    org: 'Gnanalytica',
    orgNote: 'Early-stage analytics startup · India',
    title: 'Two production systems, built the way I want to build.',
    body:
        'Unpaid contribution to a startup founded by friends, and where I do my most ' +
        'current work: agentic AI in production, multi-tenant data boundaries that have ' +
        'to hold, and the operational engineering that decides whether any of it ' +
        'survives real users.',
};

export const SPOTLIGHT_SYSTEMS: SpotlightSystem[] = [
    {
        index: '01',
        name: 'Standup AI',
        kind: 'Meeting intelligence platform',
        headline: 'Meetings that answer questions afterwards.',
        summary:
            'A bot joins the call, a knowledge graph builds itself while people are still ' +
            'talking, and afterwards the team asks it what was decided and who owns what.',
        commits: { mine: 739, total: 747, note: 'of the repository — owned end to end' },
        stats: [
            { value: '~50ms', label: 'Graph answer, no model call' },
            { value: '~$0.001', label: 'Typical full answer' },
            { value: '30s', label: 'Live graph refresh' },
        ],
        commitMix: [
            { label: 'Features', value: 302 },
            { label: 'Fixes', value: 228 },
            { label: 'Docs & ADRs', value: 52 },
            { label: 'Perf & refactor', value: 20 },
            { label: 'Tests & CI', value: 17 },
            { label: 'Chore & other', value: 120 },
        ],
        surface: [
            { label: 'Backend', value: 1821 },
            { label: 'Frontend', value: 1466 },
            { label: 'Tests', value: 559 },
            { label: 'Docs & ADRs', value: 150 },
            { label: 'Infra & CI', value: 120 },
        ],
        contributions: [
            'Owned the platform end to end — Python backend, React frontend, Terraform infrastructure and CI — across 739 of its 747 commits.',
            'Built the real-time pipeline: meeting bots stream transcript webhooks every ~2s, batched into 30s chunks that a fast model turns into knowledge-graph deltas.',
            'Designed a four-tier answer router that serves most questions straight from the graph with no model call, escalating to a tool-using model only when a question needs verbatim transcript.',
            'Rebuilt production on GCP with Workload Identity Federation and systemd, retiring long-lived service-account keys, then added readiness probes, deploy health gates and incident runbooks.',
            'Enforced privacy at the data layer — participants-only meetings sealed across every read surface, behind a fail-closed capability registry.',
            'Shipped an append-only AI-usage ledger enforced by database privileges, attributing spend per tenant, workspace and member.',
        ],
        pipeline: [
            {
                key: 'capture',
                label: 'Capture',
                detail: 'streaming',
                items: [
                    'Bot joins the meeting',
                    'Transcript webhooks every ~2s',
                    'Buffered, flushed in 30s chunks',
                ],
            },
            {
                key: 'graph',
                label: 'Graph',
                detail: 'two writers',
                items: [
                    'Fast model: chunk → graph delta',
                    'Reasoning model: corpus rebuild at end',
                    'Live + corpus merged into one graph',
                ],
            },
            {
                key: 'answer',
                label: 'Answer',
                detail: '4 tiers',
                items: [
                    'Cache, then graph-direct with no model',
                    'Graph query rendered to prose',
                    'Full context, then tools for quotes',
                ],
            },
        ],
        stack: [
            'Python',
            'Gemini on Vertex AI',
            'Claude Sonnet',
            'Postgres',
            'Knowledge graphs',
            'GCP · WIF · systemd',
            'Terraform',
            'React',
        ],
        accent: { light: '#0d9488', dark: '#38e0d0' },
    },
    {
        index: '02',
        name: 'Valytica',
        kind: 'Multi-tenant B2B SaaS',
        headline: 'Every AI claim traceable to the page it came from.',
        summary:
            'Documents come in, an agentic pipeline extracts the fields, a finalised report ' +
            'goes out — and no extracted value is unaccountable.',
        commits: { mine: 128, total: 806, note: 'security, performance, compliance, reports' },
        stats: [
            { value: 'RLS', label: 'Tenancy enforced in Postgres' },
            { value: 'DPDP', label: 'Consent, access, withdrawal' },
            { value: '281kB', label: 'Off the report critical path' },
        ],
        commitMix: [
            { label: 'Fixes', value: 48 },
            { label: 'Features', value: 14 },
            { label: 'Performance', value: 8 },
            { label: 'Docs', value: 5 },
            { label: 'Merges & chore', value: 53 },
        ],
        surface: [
            { label: 'App routes', value: 129 },
            { label: 'API', value: 56 },
            { label: 'AI pipeline', value: 48 },
            { label: 'Case UI', value: 47 },
            { label: 'Scripts & config', value: 39 },
            { label: 'Report & PDF', value: 20 },
        ],
        contributions: [
            'Led pre-launch security hardening — closed a billing bypass, scoped every row-level policy to the organisation rather than the person, and fixed a multi-tenancy gap before launch.',
            "Implemented India's DPDP obligations end to end: consent capture, right of access, consent withdrawal, and the s.5(3) notice in four languages.",
            'Built the agentic extraction pipeline with concurrent field shards, abstention rules so the model may answer "unknown", and a verify pass gated so it is not paid for twice.',
            'Made every extracted value auditable — each field highlights the exact source page it was read from, pre-warmed so the click never stalls.',
            'Delivered the Word and PDF report engine with an in-place document editor and a coverage gate that blocks finalisation.',
            'Instrumented production with Sentry — tracing, masked session replay, source maps and per-environment tagging.',
        ],
        pipeline: [
            {
                key: 'extract',
                label: 'Extract',
                detail: 'agentic',
                items: [
                    'Concurrent field shards',
                    'Abstention over guessing',
                    'Gated verify pass',
                ],
            },
            {
                key: 'evidence',
                label: 'Evidence',
                detail: 'traceable',
                items: [
                    'Field highlights its source page',
                    'Yellow until accepted, then green',
                    'Pages pre-warmed for instant clicks',
                ],
            },
            {
                key: 'report',
                label: 'Report',
                detail: 'auditable',
                items: [
                    'Word and PDF that agree',
                    'Edited in place in the browser',
                    'Coverage gate before finalising',
                ],
            },
        ],
        stack: [
            'Next.js · React 19',
            'Supabase · Postgres RLS',
            'Vercel AI Gateway',
            'Gemini on Vertex',
            'Sentry',
            'TypeScript',
            'Tailwind',
        ],
        accent: { light: '#0369a1', dark: '#7dd3fc' },
    },
];

export interface CapabilityPillar {
    key: string;
    title: string;
    blurb: string;
    items: string[];
}

/** Four capability pillars, each backed by shipped work rather than a course. */
export const CAPABILITY_PILLARS: CapabilityPillar[] = [
    {
        key: 'ai-workflow',
        title: 'AI-assisted engineering',
        blurb: 'Agents as a daily tool, with the guardrails that make them safe to use.',
        items: [
            'Claude Code · Cursor · Codex',
            'Repo-level agent configs',
            'Spec-first PRs, one concern each',
            'Architecture decision records',
            'Evals over prompt changes',
        ],
    },
    {
        key: 'applied-ai',
        title: 'Applied AI & agentic systems',
        blurb: 'Models in production, with cost and failure modes accounted for.',
        items: [
            'Gemini on Vertex · Sonnet tool use',
            'Multi-tier routing by cost',
            'Knowledge graphs over transcripts',
            'RAG corpora with durable synthesis',
            'Per-tenant token metering',
        ],
    },
    {
        key: 'sre',
        title: 'Production SRE & observability',
        blurb: 'The work that decides whether a launch survives its first week.',
        items: [
            'Sentry tracing & masked replay',
            'Readiness probes, deploy gates',
            'Runbooks written before the incident',
            'Rate limiting on model routes',
            'Workload Identity, no static keys',
        ],
    },
    {
        key: 'security',
        title: 'Security & compliance',
        blurb: 'Data boundaries enforced where they cannot be argued with.',
        items: [
            'Postgres RLS scoped per org',
            'SECURITY DEFINER audit trails',
            'DPDP consent, access, withdrawal',
            'CSP and security headers',
            'Advisories closed before launch',
        ],
    },
];

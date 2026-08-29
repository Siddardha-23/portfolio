/**
 * Spotlight — volunteer engineering contributions to an early-stage analytics
 * startup based in India.
 *
 * Deliberately carries no period, no employment type and no compensation: this
 * is unpaid contribution to an India-based company, and the page says only that.
 *
 * Every claim below is traceable to a commit in those repositories. Product names
 * are used; client names are not. Figures come from the projects' own
 * architecture docs, never from estimation.
 */

export interface PipelineStage {
    key: string;
    label: string;
    detail: string;
    /** Rows rendered inside the stage box. */
    items: string[];
}

export interface SpotlightMetric {
    value: string;
    label: string;
    /** 0-1, drives the bar fill. */
    weight: number;
}

export interface SpotlightSystem {
    index: string;
    name: string;
    kind: string;
    /** Short attribution of scope, e.g. share of the commit history. */
    ownership: string;
    headline: string;
    summary: string;
    pipeline: PipelineStage[];
    metrics: SpotlightMetric[];
    highlights: string[];
    stack: string[];
    accent: string;
}

export const SPOTLIGHT_INTRO = {
    eyebrow: 'Spotlight',
    label: 'Volunteer engineering',
    org: 'Early-stage analytics startup · India',
    title: 'Two production systems, built the way I want to build.',
    body:
        'Unpaid contribution to a startup founded by friends. It is where I do my most ' +
        'current work: agentic AI in production, multi-tenant data boundaries that have ' +
        'to hold, and the unglamorous operational engineering that decides whether any ' +
        'of it survives contact with real users.',
};

export const SPOTLIGHT_SYSTEMS: SpotlightSystem[] = [
    {
        index: '01',
        name: 'Standup AI',
        kind: 'Meeting intelligence platform',
        ownership: '739 of 747 commits — owned end to end',
        headline: 'Meetings that answer questions afterwards.',
        summary:
            'A bot joins the call, the transcript streams in, and a knowledge graph builds ' +
            'itself while people are still talking. Afterwards the team asks it what was ' +
            'decided, who owns what, and what is blocked — and it answers from the graph ' +
            'rather than re-reading the transcript.',
        pipeline: [
            {
                key: 'capture',
                label: 'Capture',
                detail: 'streaming',
                items: [
                    'Recall.ai bot joins the meeting',
                    'Transcript webhooks every ~2s',
                    'Utterance ring buffer, flushed in 30s chunks',
                ],
            },
            {
                key: 'graph',
                label: 'Graph',
                detail: 'two writers',
                items: [
                    'Gemini 2.5 Flash: 30s chunk → graph delta',
                    'Sonnet: full corpus rebuild at meeting end',
                    'Live + corpus merged into one unified graph',
                ],
            },
            {
                key: 'answer',
                label: 'Answer',
                detail: '4-tier router',
                items: [
                    'Cache hit, then graph-direct with no LLM at all',
                    'Graph query rendered to prose by a small model',
                    'Full context, then tool-use only when quotes are needed',
                ],
            },
        ],
        metrics: [
            { value: '~50ms', label: 'Graph-direct answer, zero LLM cost', weight: 0.08 },
            { value: '~$0.001', label: 'Typical full-context answer', weight: 0.35 },
            { value: '30s', label: 'Live graph refresh during a meeting', weight: 0.5 },
            { value: '9', label: 'Tools available to the reasoning tier', weight: 0.8 },
        ],
        highlights: [
            'Rebuilt production onto Workload Identity Federation and systemd, off container-optimised OS — no long-lived service-account keys.',
            'Found and fixed a silent outage where every AI feature was off in production because Gemini was not detected on Vertex; routed all model calls through one client factory.',
            'Sealed participants-only meetings across every read surface, behind a fail-closed public-capability registry.',
            'Append-only AI-usage ledger enforced at the database privilege layer, attributed per tenant, workspace and member.',
            'Readiness probes, incident runbooks, and a deploy health gate that speaks TLS — after a gate that did not took production down.',
        ],
        stack: [
            'Python',
            'Gemini on Vertex AI',
            'Claude Sonnet',
            'Recall.ai',
            'Postgres',
            'Knowledge graphs',
            'GCP · WIF · systemd',
            'Slack',
            'Linear',
            'Vercel',
        ],
        accent: '#38e0d0',
    },
    {
        index: '02',
        name: 'Valytica',
        kind: 'Multi-tenant B2B SaaS',
        ownership: '128 commits — security, performance, compliance, report engine',
        headline: 'Every AI claim traceable to the page it came from.',
        summary:
            'A valuation workspace: documents come in, an agentic pipeline extracts the ' +
            'fields, and a finalised report goes out. The part I care about is that no ' +
            'extracted value is unaccountable — click a field and it highlights the exact ' +
            'page it was read from, and nothing finalises until coverage is satisfied.',
        pipeline: [
            {
                key: 'extract',
                label: 'Extract',
                detail: 'agentic',
                items: [
                    'Concurrent field shards, not one serial pass',
                    'Identifier and abstention rules — it may answer "unknown"',
                    'Verify pass, gated so it is not paid for twice',
                ],
            },
            {
                key: 'evidence',
                label: 'Evidence',
                detail: 'traceable',
                items: [
                    'Every field highlighted on its source page',
                    'Yellow until accepted, then green',
                    'Pages pre-warmed so a click never stalls',
                ],
            },
            {
                key: 'report',
                label: 'Report',
                detail: 'auditable',
                items: [
                    'Word and PDF that agree on dates and money',
                    'Edited in place through a WOPI document editor',
                    'Coverage gate before anything can be finalised',
                ],
            },
        ],
        metrics: [
            { value: 'RLS', label: 'Tenancy enforced in Postgres, per organisation', weight: 0.9 },
            { value: 'DPDP', label: 'Consent, access and withdrawal implemented', weight: 0.7 },
            { value: 'bom1', label: 'Functions pinned to the users’ region', weight: 0.45 },
            { value: '281kB', label: 'Taken off the report critical path', weight: 0.3 },
        ],
        highlights: [
            'Pre-launch security hardening: closed a billing bypass, scoped every case policy to the organisation rather than the person, and fixed a multi-tenancy gap before launch.',
            'Made audit logs writable only through a SECURITY DEFINER rpc, and moved portal evidence to path-addressed storage signed on read.',
            'Implemented India’s DPDP obligations end to end — consent capture, right of access, consent withdrawal, and the s.5(3) notice in four languages.',
            'Turned on Sentry tracing with masked session replay, uploaded source maps, tagged deploy environments, and corrected a privacy notice that named the wrong data region.',
            'Performance work with a user-visible point: cut the round trips behind case-page navigation, bounded photo fan-out, and stopped a failed search being cached for a week.',
        ],
        stack: [
            'Next.js · React 19',
            'Supabase · Postgres RLS',
            'Vercel AI Gateway',
            'Gemini on Vertex',
            'Sentry',
            'Collabora · WOPI',
            'TypeScript',
            'Tailwind',
        ],
        accent: '#7dd3fc',
    },
];

export interface CapabilityPillar {
    key: string;
    title: string;
    blurb: string;
    items: string[];
}

/**
 * The four capability pillars, each backed by shipped work rather than a course.
 */
export const CAPABILITY_PILLARS: CapabilityPillar[] = [
    {
        key: 'ai-workflow',
        title: 'AI-assisted engineering',
        blurb: 'Agents as a daily tool, with the guardrails that make them safe to use.',
        items: [
            'Claude Code · Cursor · Codex',
            'Repo-level agent configs (AGENTS.md, CLAUDE.md)',
            'Spec-first PRs, one concern per branch',
            'Architecture decision records',
            'Eval harnesses over prompt changes',
        ],
    },
    {
        key: 'applied-ai',
        title: 'Applied AI & agentic systems',
        blurb: 'Models in production, with cost and failure modes accounted for.',
        items: [
            'Gemini on Vertex AI · Claude Sonnet tool use',
            'Multi-tier routing — cheapest path that can answer',
            'Knowledge graphs over transcripts and documents',
            'RAG corpora with durable synthesis',
            'Per-tenant token metering and usage ledgers',
        ],
    },
    {
        key: 'sre',
        title: 'Production SRE & observability',
        blurb: 'The work that decides whether a launch survives its first week.',
        items: [
            'Sentry tracing and masked session replay',
            'Readiness probes and deploy health gates',
            'Incident runbooks written before the incident',
            'Rate limiting on every LLM-backed route',
            'Workload Identity Federation, no static keys',
        ],
    },
    {
        key: 'security',
        title: 'Security & compliance',
        blurb: 'Data boundaries enforced where they cannot be argued with — the database.',
        items: [
            'Postgres RLS scoped per organisation',
            'SECURITY DEFINER rpcs for audit trails',
            'DPDP consent, access and withdrawal',
            'CSP and security headers',
            'Dependency advisories closed before launch',
        ],
    },
];

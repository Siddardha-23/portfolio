import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Rocket, Bot, GitBranch, ShieldCheck, Boxes, Sparkles } from 'lucide-react';

/**
 * "How I Build" — makes the two weakest recruiter signals explicit and
 * scannable: sole-engineer, end-to-end SaaS ownership (the founder story)
 * and AI-assisted engineering (Claude Code, Cursor, MCP, multi-agent).
 */

const ventures = [
  {
    name: 'Infratrix',
    tagline: 'AWS Well-Architected analysis engine',
    detail:
      'Reads a customer AWS account read-only, models it as an 11,880-node graph, and runs a deterministic solver over 104 optimization patterns — findings with a traversable evidence path, not a model opinion.',
    status: 'Live',
  },
  {
    name: 'Aspirely',
    tagline: 'Job-application automation SaaS',
    detail:
      'Four independently deployed Flask Lambda services behind one API Gateway, on MongoDB and Claude via AWS Bedrock, with deterministic ATS adapters for Greenhouse, Lever, Ashby and a 1,013-tenant Workday catalog.',
    status: 'Live',
  },
  {
    name: 'Cupola',
    tagline: 'Sovereign monitoring-as-a-service',
    detail:
      'Runs entirely inside the customer estate: ClickHouse hot/warm telemetry, embedded Kùzu topology graph, a cost-based query planner, and a Rust + eBPF edge agent. Cold tier stays as Parquet in the customer bucket.',
    status: 'In build',
  },
];

const aiPractices = [
  {
    icon: Bot,
    title: 'Agentic coding',
    body: 'Claude Code and Cursor drive real production codebases — not toy demos — with custom agent skills and subagents.',
  },
  {
    icon: GitBranch,
    title: 'Multi-agent loops',
    body: 'Planner, implementer and reviewer agents run in loops with golden-set evals and guardrails gating what ships.',
  },
  {
    icon: Boxes,
    title: 'MCP tooling',
    body: 'I build Model Context Protocol servers so agents can safely reach my repos, infra and data with the right context.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified, not vibes',
    body: 'Every AI-assisted change is held to the same bar as hand-written code: builds, tests and reviews must pass.',
  },
];

export default function HowIBuild() {
  return (
    <section id="how-i-build" className="py-20 md:py-24 bg-background relative overflow-hidden scroll-mt-24">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 w-48 md:w-96 h-48 md:h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-40 md:w-80 h-40 md:h-80 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="container px-4 md:px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-10 md:mb-16">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="mb-3 md:mb-4 border-primary/40 text-primary px-3 md:px-4 py-1 text-xs md:text-sm">
              <Rocket className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1.5 md:mr-2" />
              How I Build
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight mb-4 md:mb-6 text-foreground">
              Sole engineer, end to end — with AI in the loop
            </h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto px-4 leading-relaxed">
              I design, build, ship and operate multi-tenant SaaS products on my own — backend, frontend,
              cloud infrastructure, CI/CD, observability and security — and I use AI-assisted engineering
              to move at a pace a one-person team otherwise could not.
            </p>
            <div className="w-24 md:w-32 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent mx-auto mt-6" />
          </motion.div>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Founder story — ventures I own solo */}
          <div className="mb-16">
            <h3 className="text-xl md:text-2xl font-semibold text-foreground mb-6 flex items-center gap-2">
              <span className="w-8 h-1 bg-primary rounded-full" />
              Products I own solo
              <span className="text-sm font-normal text-muted-foreground">— under the Aithrex umbrella</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {ventures.map((v, i) => (
                <motion.div
                  key={v.name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.08 }}
                  className="relative bg-card p-6 rounded-2xl border border-border/50 shadow-sm h-full"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-bold text-foreground">{v.name}</h4>
                    <Badge
                      variant="outline"
                      className={
                        v.status === 'Live'
                          ? 'border-emerald-500/40 text-emerald-500 text-xs'
                          : 'border-amber-500/40 text-amber-500 text-xs'
                      }
                    >
                      {v.status}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-primary mb-2">{v.tagline}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{v.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* AI-assisted engineering */}
          <div>
            <h3 className="text-xl md:text-2xl font-semibold text-foreground mb-6 flex items-center gap-2">
              <span className="w-8 h-1 bg-accent rounded-full" />
              AI-assisted engineering
              <Sparkles className="h-4 w-4 text-accent" />
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {aiPractices.map((p, i) => (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.08 }}
                  className="relative bg-card p-6 rounded-2xl border border-border/50 shadow-sm h-full"
                >
                  <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                    <p.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="text-base font-bold text-foreground mb-2">{p.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Claude Code', 'Cursor', 'OpenAI Codex', 'MCP servers', 'Custom agent skills', 'Subagents', 'Multi-agent loops', 'Eval harnesses'].map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-lg border border-border/60 bg-card px-3 py-1.5 text-sm text-foreground/85"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

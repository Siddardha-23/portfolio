/**
 * Cards - Typed display components rendered in the Concierge side panel.
 *
 * Each card maps to a "type" string the model emits. A small registry below
 * the components routes by type; unknown types fall back to a generic JSON
 * inspector (collapsed by default) so the UI never breaks on a new shape.
 */
import { motion } from "framer-motion";
import {
  Briefcase, Award, Code, Rocket, ExternalLink, Mail, Linkedin,
  Github, Sparkles, CheckCircle2, XCircle, TrendingUp,
} from "lucide-react";
import type { DisplayCard } from "../types";

const Wrapper = ({ children, color = "primary" }: { children: React.ReactNode; color?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 8, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    className="relative rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/40 backdrop-blur-sm p-4 shadow-lg overflow-hidden"
  >
    <div
      className="absolute inset-x-0 top-0 h-px"
      style={{ background: `linear-gradient(90deg, transparent, hsl(var(--${color})/0.6), transparent)` }}
    />
    {children}
  </motion.div>
);

const Heading = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <h4 className="text-sm font-semibold tracking-tight">{title}</h4>
  </div>
);

// ---------- ProjectCard ----------
function ProjectCardView({ payload }: { payload: any }) {
  const { title, slug, blurb, tech = [], metrics = [] } = payload || {};
  return (
    <Wrapper>
      <Heading icon={Rocket} title={title || "Project"} />
      {blurb && <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{blurb}</p>}
      {Array.isArray(tech) && tech.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tech.slice(0, 8).map((t: string, i: number) => (
            <span key={i} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-medium">
              {t}
            </span>
          ))}
        </div>
      )}
      {Array.isArray(metrics) && metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {metrics.slice(0, 4).map((m: any, i: number) => (
            <div key={i} className="rounded-lg border border-border/40 bg-background/30 p-2">
              <div className="text-base font-bold text-primary">{m.value}</div>
              <div className="text-[10px] text-muted-foreground">{m.label}</div>
            </div>
          ))}
        </div>
      )}
      {slug && (
        <button
          className="w-full text-xs font-medium text-primary hover:underline inline-flex items-center justify-center gap-1.5"
          onClick={() => {
            const el = document.getElementById("projects");
            el?.scrollIntoView({ behavior: "smooth" });
            window.dispatchEvent(new CustomEvent("concierge:highlight-project", { detail: { slug } }));
          }}
        >
          View on portfolio <ExternalLink className="h-3 w-3" />
        </button>
      )}
    </Wrapper>
  );
}

// ---------- TimelineSlice ----------
function TimelineSliceView({ payload }: { payload: any }) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return (
    <Wrapper>
      <Heading icon={Briefcase} title="Experience" />
      <div className="space-y-3">
        {items.slice(0, 4).map((it: any, i: number) => (
          <div key={i} className="relative pl-4 border-l-2 border-primary/30">
            <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary" />
            <div className="text-xs font-semibold">{it.title}</div>
            <div className="text-[10px] text-muted-foreground">{it.org} · {it.period}</div>
            {Array.isArray(it.bullets) && (
              <ul className="mt-1 space-y-0.5">
                {it.bullets.slice(0, 3).map((b: string, j: number) => (
                  <li key={j} className="text-[11px] text-foreground/80 leading-snug">• {b}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Wrapper>
  );
}

// ---------- SkillCluster ----------
function SkillClusterView({ payload }: { payload: any }) {
  const groups = Array.isArray(payload?.groups) ? payload.groups : [];
  return (
    <Wrapper>
      <Heading icon={Code} title="Skills" />
      <div className="space-y-3">
        {groups.slice(0, 4).map((g: any, i: number) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: g.color || "hsl(var(--primary))" }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(g.items || []).slice(0, 14).map((s: string, j: number) => (
                <span
                  key={j}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium border"
                  style={{
                    background: `${g.color || "hsl(var(--primary))"}1A`,
                    color: g.color || "hsl(var(--primary))",
                    borderColor: `${g.color || "hsl(var(--primary))"}40`,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Wrapper>
  );
}

// ---------- MetricStat ----------
function MetricStatView({ payload }: { payload: any }) {
  const stats = Array.isArray(payload?.stats) ? payload.stats : [];
  return (
    <Wrapper>
      <Heading icon={TrendingUp} title="Impact" />
      <div className="grid grid-cols-2 gap-2">
        {stats.slice(0, 6).map((s: any, i: number) => (
          <div key={i} className="rounded-lg border border-border/40 bg-background/40 p-3">
            <div className="text-xl font-bold text-primary">{s.value}</div>
            <div className="text-[10px] font-medium">{s.label}</div>
            {s.hint && <div className="text-[10px] text-muted-foreground mt-0.5">{s.hint}</div>}
          </div>
        ))}
      </div>
    </Wrapper>
  );
}

// ---------- JDMatchCard ----------
function JDMatchCardView({ payload }: { payload: any }) {
  const { score, matched = [], missing = [], summary, top_bullets = [], deep_link } = payload || {};
  return (
    <Wrapper color="accent">
      <Heading icon={Sparkles} title="JD Match" />
      {typeof score === "number" && (
        <div className="flex items-center gap-3 mb-3">
          <div className="relative h-14 w-14">
            <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
              <circle cx="18" cy="18" r="16" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="16" fill="none"
                stroke="hsl(var(--primary))" strokeWidth="3"
                strokeDasharray={`${Math.max(0, Math.min(100, score))}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
              {Math.round(score)}%
            </div>
          </div>
          <div className="flex-1 text-xs text-muted-foreground leading-snug">
            {summary || "Match score against this JD."}
          </div>
        </div>
      )}
      {!score && summary && <p className="text-xs text-muted-foreground mb-3">{summary}</p>}

      {matched.length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] font-semibold text-emerald-500 mb-1 uppercase tracking-wider">Matched</div>
          <div className="flex flex-wrap gap-1">
            {matched.slice(0, 8).map((m: string, i: number) => (
              <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 inline-flex items-center gap-0.5">
                <CheckCircle2 className="h-2.5 w-2.5" /> {m}
              </span>
            ))}
          </div>
        </div>
      )}
      {missing.length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] font-semibold text-amber-500 mb-1 uppercase tracking-wider">Gaps to mention</div>
          <div className="flex flex-wrap gap-1">
            {missing.slice(0, 6).map((m: string, i: number) => (
              <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/30 inline-flex items-center gap-0.5">
                <XCircle className="h-2.5 w-2.5" /> {m}
              </span>
            ))}
          </div>
        </div>
      )}
      {top_bullets.length > 0 && (
        <ul className="space-y-1 mt-2">
          {top_bullets.slice(0, 4).map((b: string, i: number) => (
            <li key={i} className="text-[11px] text-foreground/85 leading-snug">• {b}</li>
          ))}
        </ul>
      )}
      <a
        href={deep_link || "/resume-parser"}
        className="mt-3 block text-center text-xs font-semibold text-primary hover:underline"
      >
        Open the full resume tailor →
      </a>
    </Wrapper>
  );
}

// ---------- ContactCard ----------
function ContactCardView({ payload }: { payload: any }) {
  const { email, linkedin, github } = payload || {};
  return (
    <Wrapper>
      <Heading icon={Mail} title="Contact" />
      <div className="space-y-2">
        {email && (
          <a href={`mailto:${email}`} className="flex items-center gap-2 p-2 rounded-lg bg-background/50 hover:bg-primary/10 text-xs">
            <Mail className="h-3.5 w-3.5 text-primary" /> {email}
          </a>
        )}
        {linkedin && (
          <a href={linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-background/50 hover:bg-primary/10 text-xs">
            <Linkedin className="h-3.5 w-3.5 text-primary" /> LinkedIn
          </a>
        )}
        {github && (
          <a href={github} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-background/50 hover:bg-primary/10 text-xs">
            <Github className="h-3.5 w-3.5 text-primary" /> GitHub
          </a>
        )}
      </div>
    </Wrapper>
  );
}

// ---------- ElevatorPitch ----------
function ElevatorPitchView({ payload }: { payload: any }) {
  const { title, lines = [], cta } = payload || {};
  return (
    <Wrapper color="primary">
      <Heading icon={Award} title={title || "Elevator Pitch"} />
      <div className="space-y-2 mb-3">
        {lines.slice(0, 5).map((line: string, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i }}
            className="text-xs leading-relaxed border-l-2 border-primary/40 pl-3 py-0.5"
          >
            {line}
          </motion.div>
        ))}
      </div>
      {cta && <div className="text-[11px] text-primary font-semibold">{cta}</div>}
    </Wrapper>
  );
}

// ---------- Registry ----------
const REGISTRY: Record<string, React.FC<{ payload: any }>> = {
  ProjectCard: ProjectCardView,
  TimelineSlice: TimelineSliceView,
  SkillCluster: SkillClusterView,
  MetricStat: MetricStatView,
  JDMatchCard: JDMatchCardView,
  ContactCard: ContactCardView,
  ElevatorPitch: ElevatorPitchView,
};

export function CardRenderer({ card }: { card: DisplayCard | null }) {
  if (!card) return null;
  const View = REGISTRY[card.type];
  if (!View) {
    return (
      <Wrapper>
        <pre className="text-[10px] text-muted-foreground overflow-auto max-h-40">
          {JSON.stringify(card.payload, null, 2)}
        </pre>
      </Wrapper>
    );
  }
  return <View payload={card.payload} />;
}

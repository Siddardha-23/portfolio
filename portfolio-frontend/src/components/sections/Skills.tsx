import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SKILLS } from '@/lib/constants';
import UnderTheHoodChips from '@/components/UnderTheHoodChips';
import { FEATURES } from '@/lib/underTheHoodData';
import {
  Code2,
  Cloud,
  Database,
  Award,
  Sparkles,
  Server,
  Layout,
  ShieldCheck,
  BrainCircuit,
  Activity,
  Wrench,
  Boxes,
  Shield,
  ExternalLink,
  Calendar
} from 'lucide-react';

type SkillCategoryKey =
  | 'languages'
  | 'backend'
  | 'frontend'
  | 'data'
  | 'cloud'
  | 'infrastructure'
  | 'ai'
  | 'security'
  | 'observability'
  | 'aiTooling';

// Category configurations — one per SKILLS group (certifications rendered separately).
// Gradients reuse the existing purple/indigo family plus neutral supporting tints;
// no new palette tokens introduced.
const categoryConfig: Record<
  SkillCategoryKey,
  { title: string; icon: typeof Code2; gradient: string; description: string }
> = {
  languages: {
    title: 'Languages',
    icon: Code2,
    gradient: 'from-primary to-accent',
    description: 'Core programming languages'
  },
  backend: {
    title: 'Backend',
    icon: Server,
    gradient: 'from-violet-500 to-indigo-500',
    description: 'APIs, services and frameworks'
  },
  frontend: {
    title: 'Frontend',
    icon: Layout,
    gradient: 'from-indigo-500 to-blue-500',
    description: 'Interfaces and build tooling'
  },
  data: {
    title: 'Data',
    icon: Database,
    gradient: 'from-purple-500 to-fuchsia-500',
    description: 'Databases and stores'
  },
  cloud: {
    title: 'Cloud',
    icon: Cloud,
    gradient: 'from-accent to-primary',
    description: 'Cloud platforms and services'
  },
  infrastructure: {
    title: 'Infrastructure',
    icon: Boxes,
    gradient: 'from-indigo-500 to-violet-500',
    description: 'IaC, containers and CI/CD'
  },
  ai: {
    title: 'AI & LLM',
    icon: BrainCircuit,
    gradient: 'from-fuchsia-500 to-purple-500',
    description: 'Models, RAG and agent workflows'
  },
  security: {
    title: 'Security & Compliance',
    icon: ShieldCheck,
    gradient: 'from-violet-500 to-purple-500',
    description: 'Access control and data protection'
  },
  observability: {
    title: 'Observability',
    icon: Activity,
    gradient: 'from-blue-500 to-indigo-500',
    description: 'Metrics, logs and traces'
  },
  aiTooling: {
    title: 'AI Tooling',
    icon: Wrench,
    gradient: 'from-purple-500 to-indigo-500',
    description: 'Agent development and evals'
  }
};

const CATEGORY_ORDER: SkillCategoryKey[] = [
  'languages',
  'backend',
  'frontend',
  'data',
  'cloud',
  'infrastructure',
  'ai',
  'security',
  'observability',
  'aiTooling'
];

// Skill chip — informational tile, subtle hover.
function SkillChip({ skill, index, categoryIndex }: { skill: string; index: number; categoryIndex: number }) {
  const reduceMotion = useReducedMotion();
  const delay = reduceMotion ? 0 : Math.min(categoryIndex * 0.05 + index * 0.03, 0.6);

  return (
    <motion.span
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.3 }}
      className="inline-flex items-center rounded-lg border border-border/60 bg-card px-3 py-1.5 text-sm text-foreground/85 hover:border-primary/30 hover:text-foreground transition-colors"
    >
      {skill}
    </motion.span>
  );
}

// Category section component
function CategorySection({ categoryKey, skills, index }: { categoryKey: SkillCategoryKey; skills: string[]; index: number }) {
  const config = categoryConfig[categoryKey];
  const Icon = config.icon;
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      id={`skills-${categoryKey}`}
      initial={reduceMotion ? false : { opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ delay: Math.min(index * 0.08, 0.4), duration: 0.5 }}
      className="rounded-xl transition-all duration-500 scroll-mt-24"
    >
      <Card className="relative overflow-hidden border-0 shadow-2xl bg-card/80 backdrop-blur-sm h-full">
        {/* Top gradient accent */}
        <div className={`h-1.5 bg-gradient-to-r ${config.gradient}`} />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-5">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${config.gradient} shadow-lg`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">{config.title}</h3>
              <p className="text-sm text-muted-foreground">{config.description}</p>
            </div>
            <Badge variant="outline" className="ml-auto text-primary border-primary/30 shrink-0">
              {skills.length}
            </Badge>
          </div>

          {/* Skills chips */}
          <div className="flex flex-wrap gap-2">
            {skills.map((skill, i) => (
              <SkillChip key={i} skill={skill} index={i} categoryIndex={index} />
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// Certification card with clickable link
function CertificationCard({ cert, index }: { cert: { name: string; issuer: string; date: string; link: string }; index: number }) {
  const reduceMotion = useReducedMotion();
  const delay = reduceMotion ? 0 : index * 0.05;
  const color = '#FF9900'; // AWS orange color

  const handleClick = () => {
    if (cert.link) {
      window.open(cert.link, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.4 }}
      whileHover={reduceMotion ? undefined : { scale: 1.02, y: -3 }}
      className={`group relative ${cert.link ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"
        style={{ background: `${color}40` }}
      />
      <div className="relative p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300 shadow-lg hover:shadow-xl">
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 shrink-0"
            style={{ background: `${color}20` }}
          >
            <Award className="h-5 w-5" style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-medium text-foreground text-sm block leading-tight">{cert.name}</span>
            <span className="text-xs text-muted-foreground mt-1 block">{cert.issuer}</span>
          </div>
          {cert.link && (
            <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="h-4 w-4 text-primary" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{cert.date}</span>
          </div>
          {cert.link ? (
            <span className="text-xs text-primary font-medium">View Credential →</span>
          ) : (
            <span className="text-xs text-muted-foreground/50">Link coming soon</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Certifications section with special card layout
function CertificationsSection({ certifications }: { certifications: { name: string; issuer: string; date: string; link: string }[] }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      id="skills-certifications"
      initial={reduceMotion ? false : { opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5 }}
      className="rounded-xl transition-all duration-500 scroll-mt-24 mt-8"
    >
      <Card className="relative overflow-hidden border-0 shadow-2xl bg-card/80 backdrop-blur-sm">
        {/* Top gradient accent */}
        <div className="h-1.5 bg-gradient-to-r from-primary to-accent" />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg">
              <Award className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Certifications</h3>
              <p className="text-sm text-muted-foreground">Professional credentials</p>
            </div>
            <Badge variant="outline" className="ml-auto text-primary border-primary/30">
              {certifications.length} credentials
            </Badge>
          </div>

          {/* Certifications grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {certifications.map((cert, i) => (
              <CertificationCard key={i} cert={cert} index={i} />
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// Floating particles animation - hidden on mobile for performance and when reduced motion is set
function FloatingParticles() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none hidden md:block">
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-primary/20"
          initial={{
            x: Math.random() * 100 + '%',
            y: '100%',
            scale: Math.random() * 0.5 + 0.5
          }}
          animate={{
            y: '-100%',
            opacity: [0, 1, 0]
          }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: 'linear'
          }}
        />
      ))}
    </div>
  );
}

// Skill stats — clickable to scroll to a category cluster.
function SkillsStats() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const reduceMotion = useReducedMotion();

  const stats = [
    { label: 'Backend', value: SKILLS.backend.length, icon: Server, color: '#8b5cf6', scrollTo: 'skills-backend' },
    { label: 'Cloud & Infra', value: SKILLS.cloud.length + SKILLS.infrastructure.length, icon: Cloud, color: '#6366f1', scrollTo: 'skills-cloud' },
    { label: 'AI & LLM', value: SKILLS.ai.length + SKILLS.aiTooling.length, icon: BrainCircuit, color: '#a855f7', scrollTo: 'skills-ai' },
    { label: 'Certifications', value: SKILLS.certifications.length, icon: Award, color: '#8b5cf6', scrollTo: 'skills-certifications' }
  ];

  const handleClick = (scrollTo: string) => {
    const el = document.getElementById(scrollTo);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-primary/50', 'ring-offset-2', 'ring-offset-background');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-primary/50', 'ring-offset-2', 'ring-offset-background');
      }, 2000);
    }
  };

  return (
    <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8 md:mb-12">
      {stats.map((stat, i) => (
        <motion.div
          key={i}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: reduceMotion ? 0 : i * 0.1, duration: 0.4 }}
          className="relative group cursor-pointer"
          onClick={() => handleClick(stat.scrollTo)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleClick(stat.scrollTo)}
        >
          <div className="absolute inset-0 rounded-xl md:rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative p-4 md:p-6 rounded-xl md:rounded-2xl bg-card border border-border/50 text-center hover:border-primary/30 hover:shadow-lg transition-all">
            <div
              className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ background: `${stat.color}20` }}
            >
              <stat.icon className="h-6 w-6" style={{ color: stat.color }} />
            </div>
            <div className="text-3xl font-bold text-foreground mb-1">{stat.value}</div>
            <div className="text-sm text-muted-foreground group-hover:text-primary transition-colors">{stat.label}</div>
            <div className="text-[10px] text-muted-foreground/60 mt-1">Click to view ↓</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default function Skills() {
  // Concierge filter_skills intent — scroll to the requested category
  useEffect(() => {
    const handler = (e: Event) => {
      const group = (e as CustomEvent<{ group: string }>).detail?.group;
      const map: Record<string, string> = {
        cloud: 'skills-cloud',
        programming: 'skills-languages',
        tools: 'skills-infrastructure',
        ai: 'skills-ai',
        security: 'skills-security',
        all: 'skills'
      };
      const id = map[group] || 'skills';
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('concierge-pulse');
        window.setTimeout(() => el.classList.remove('concierge-pulse'), 2200);
      }
    };
    window.addEventListener('concierge:filter-skills', handler);
    return () => window.removeEventListener('concierge:filter-skills', handler);
  }, []);

  return (
    <section id="skills" className="pb-20 md:pb-24 section-dark relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 z-0">
        <FloatingParticles />
        <div className="absolute top-0 left-1/4 w-48 md:w-96 h-48 md:h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-40 md:w-80 h-40 md:h-80 bg-accent/5 rounded-full blur-3xl" />

        {/* Hexagon pattern - hidden on mobile */}
        <div
          className="absolute inset-0 opacity-[0.03] hidden md:block"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='70' viewBox='0 0 60 70' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l30 17.5v35L30 70 0 52.5v-35z' fill='none' stroke='%23fff' stroke-width='1'/%3E%3C/svg%3E")`,
            backgroundSize: '60px 70px'
          }}
        />
      </div>

      <div className="container px-4 md:px-6 relative z-10">
        {/* Section header */}
        <div className="text-center mb-8 md:mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="mb-3 md:mb-4 border-primary/40 text-primary px-3 md:px-4 py-1 text-xs md:text-sm">
              <Sparkles className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1.5 md:mr-2" />
              Technical Expertise
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight mb-4 md:mb-6 text-foreground">
              Skills & Technologies
            </h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto mb-4 md:mb-6 px-4">
              A production toolkit spanning backend and APIs, cloud and infrastructure, applied
              AI and LLM systems, and the security and observability that keep them running.
            </p>
            <div className="w-24 md:w-32 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent mx-auto" />
          </motion.div>
          {/* Under the Hood chips */}
          {(() => {
            const feature = FEATURES.find(f => f.featureId === 'infrastructure');
            return feature ? (
              <div className="flex justify-center mt-4">
                <UnderTheHoodChips featureId="infrastructure" chips={feature.chips} />
              </div>
            ) : null;
          })()}
        </div>

        {/* Stats overview */}
        <SkillsStats />

        {/* Skills categories grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {CATEGORY_ORDER.map((key, i) => (
            <CategorySection
              key={key}
              categoryKey={key}
              skills={SKILLS[key]}
              index={i}
            />
          ))}
        </div>

        {/* Certifications */}
        <CertificationsSection certifications={SKILLS.certifications} />

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">
              Always learning. Always building.
            </span>
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

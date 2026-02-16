import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SKILLS, TECH_STACK_CATEGORIES } from '@/lib/constants';
import {
  Code2,
  Cloud,
  Database,
  Award,
  Sparkles,
  Zap,
  Terminal,
  Server,
  GitBranch,
  Container,
  Globe,
  Shield,
  Cpu,
  FileCode,
  Layers,
  ExternalLink,
  Calendar
} from 'lucide-react';

// Skill icons mapping
const skillIcons: { [key: string]: React.ReactNode } = {
  'Python': <FileCode className="h-5 w-5" />,
  'Java': <Cpu className="h-5 w-5" />,
  'Bash': <Terminal className="h-5 w-5" />,
  'JavaScript': <Code2 className="h-5 w-5" />,
  'SQL': <Database className="h-5 w-5" />,
  'HTML': <Globe className="h-5 w-5" />,
  'CSS': <Layers className="h-5 w-5" />,
  'Terraform': <Server className="h-5 w-5" />,
  'CloudFormation': <Cloud className="h-5 w-5" />,
  'Docker': <Container className="h-5 w-5" />,
  'Git': <GitBranch className="h-5 w-5" />,
  'GitHub': <GitBranch className="h-5 w-5" />,
  'Nginx': <Server className="h-5 w-5" />,
  'Flask': <Zap className="h-5 w-5" />,
  'Postgres': <Database className="h-5 w-5" />,
  'Linux/Unix': <Terminal className="h-5 w-5" />,
  'Windows': <Cpu className="h-5 w-5" />,
  'CodeCommit': <GitBranch className="h-5 w-5" />,
  'AWS Cloud Practitioner': <Award className="h-5 w-5" />
};

// Skill colors
const skillColors: { [key: string]: string } = {
  'Python': '#3776AB',
  'Java': '#ED8B00',
  'Bash': '#4EAA25',
  'JavaScript': '#F7DF1E',
  'SQL': '#336791',
  'HTML': '#E34F26',
  'CSS': '#1572B6',
  'Terraform': '#7B42BC',
  'CloudFormation': '#FF9900',
  'Docker': '#2496ED',
  'Git': '#F05032',
  'GitHub': '#181717',
  'Nginx': '#009639',
  'Flask': '#000000',
  'Postgres': '#336791',
  'Linux/Unix': '#FCC624',
  'Windows': '#0078D6',
  'CodeCommit': '#FF9900',
  'AWS Cloud Practitioner': '#FF9900'
};

// Category configurations for tech stack (no skill bars / star ratings)
const categoryConfig: Record<string, { title: string; icon: React.ElementType; gradient: string; description: string }> = {
  cloud: {
    title: 'Cloud',
    icon: Cloud,
    gradient: 'from-orange-500 to-amber-500',
    description: 'Cloud platforms'
  },
  infrastructureAsCode: {
    title: 'Infrastructure as Code',
    icon: Server,
    gradient: 'from-purple-500 to-violet-500',
    description: 'IaC tools'
  },
  languages: {
    title: 'Languages',
    icon: Code2,
    gradient: 'from-blue-500 to-cyan-500',
    description: 'Programming languages'
  },
  tools: {
    title: 'Tools',
    icon: Database,
    gradient: 'from-emerald-500 to-teal-500',
    description: 'Development & ops tools'
  },
  certifications: {
    title: 'Certifications',
    icon: Award,
    gradient: 'from-purple-500 to-pink-500',
    description: 'Professional credentials'
  }
};

// Clean skill chip (no bars, no ratings)
function SkillChip({ skill, index, categoryIndex }: { skill: string; index: number; categoryIndex: number }) {
  const color = skillColors[skill.split(' ')[0]] || '#6366f1';
  const Icon = skillIcons[skill.split(' ')[0]] || <Zap className="h-4 w-4" />;
  const delay = categoryIndex * 0.1 + index * 0.03;

  return (
    <motion.span
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.3 }}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 bg-card/80 text-sm text-foreground hover:border-primary/30 transition-colors"
      style={{ borderLeftColor: color, borderLeftWidth: '3px' }}
    >
      <span style={{ color }}>{Icon}</span>
      {skill}
    </motion.span>
  );
}

// Category section component (clean listing, no bars)
function CategorySection({ categoryKey, skills, index }: { categoryKey: string; skills: string[]; index: number }) {
  const config = categoryConfig[categoryKey];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <motion.div
      id={`skills-${categoryKey}`}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.15, duration: 0.6 }}
      className="rounded-xl transition-all duration-500"
    >
      <Card className="relative overflow-hidden border-0 shadow-2xl bg-card/80 backdrop-blur-sm">
        <div className={`h-1.5 bg-gradient-to-r ${config.gradient}`} />
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${config.gradient} shadow-lg`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">{config.title}</h3>
              <p className="text-sm text-muted-foreground">{config.description}</p>
            </div>
            <Badge variant="outline" className="ml-auto text-primary border-primary/30">
              {skills.length}
            </Badge>
          </div>
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
  const delay = 3 * 0.2 + index * 0.05;
  const color = '#FF9900'; // AWS orange color

  const handleClick = () => {
    if (cert.link) {
      window.open(cert.link, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.4, type: "spring", stiffness: 100 }}
      whileHover={{ scale: 1.02, y: -3 }}
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
function CertificationsSection({ certifications, index }: { certifications: { name: string; issuer: string; date: string; link: string }[]; index: number }) {
  const config = categoryConfig.certifications;
  const Icon = config.icon;

  return (
    <motion.div
      id="skills-certifications"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.15, duration: 0.6 }}
      className="rounded-xl transition-all duration-500"
    >
      <Card className="relative overflow-hidden border-0 shadow-2xl bg-card/80 backdrop-blur-sm">
        {/* Top gradient accent */}
        <div className={`h-1.5 bg-gradient-to-r ${config.gradient}`} />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${config.gradient} shadow-lg`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">{config.title}</h3>
              <p className="text-sm text-muted-foreground">{config.description}</p>
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

// Floating particles animation - hidden on mobile for performance
function FloatingParticles() {
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
            ease: "linear"
          }}
        />
      ))}
    </div>
  );
}

// Skill stats — clickable to scroll to category
function SkillsStats() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  const stats = [
    { label: 'Cloud', value: TECH_STACK_CATEGORIES.cloud.length, icon: Cloud, color: '#f59e0b', scrollTo: 'skills-cloud' },
    { label: 'IaC', value: TECH_STACK_CATEGORIES.infrastructureAsCode.length, icon: Server, color: '#7c3aed', scrollTo: 'skills-infrastructureAsCode' },
    { label: 'Languages', value: TECH_STACK_CATEGORIES.languages.length, icon: Code2, color: '#3b82f6', scrollTo: 'skills-languages' },
    { label: 'Certifications', value: SKILLS.certifications.length, icon: Award, color: '#a855f7', scrollTo: 'skills-certifications' }
  ];

  const handleClick = (scrollTo: string) => {
    const el = document.getElementById(scrollTo);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a brief highlight effect
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
          initial={{ opacity: 0, scale: 0.8 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: i * 0.1, duration: 0.5, type: "spring" }}
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
            <motion.div
              className="text-3xl font-bold text-foreground mb-1"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
            >
              {stat.value}
            </motion.div>
            <div className="text-sm text-muted-foreground group-hover:text-primary transition-colors">{stat.label}</div>
            <div className="text-[10px] text-muted-foreground/50 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to view ↓</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default function Skills() {
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
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 text-foreground">
              Skills & Technologies
            </h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto mb-4 md:mb-6 px-4">
              A comprehensive toolkit built through hands-on experience in cloud infrastructure,
              DevOps practices, and software development
            </p>
            <div className="w-16 md:w-24 h-1 bg-gradient-to-r from-primary via-accent to-primary mx-auto rounded-full" />
          </motion.div>
        </div>

        {/* Stats overview */}
        <SkillsStats />

        {/* Tech stack categories (clean, no skill bars) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <CategorySection
            categoryKey="cloud"
            skills={TECH_STACK_CATEGORIES.cloud}
            index={0}
          />
          <CategorySection
            categoryKey="infrastructureAsCode"
            skills={TECH_STACK_CATEGORIES.infrastructureAsCode}
            index={1}
          />
          <CategorySection
            categoryKey="languages"
            skills={TECH_STACK_CATEGORIES.languages}
            index={2}
          />
          <CategorySection
            categoryKey="tools"
            skills={TECH_STACK_CATEGORIES.tools}
            index={3}
          />
          <CertificationsSection
            certifications={SKILLS.certifications}
            index={4}
          />
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">
              Continuously learning and expanding my skill set
            </span>
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
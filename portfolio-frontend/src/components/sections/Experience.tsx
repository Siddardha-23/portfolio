import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EXPERIENCE } from '@/lib/constants';
import {
  Briefcase,
  Calendar,
  MapPin,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  Code,
  Server,
  Shield,
  Lightbulb,
  GraduationCap,
  Cog,
  Rocket,
  Search
} from 'lucide-react';

// Category icons mapping
const categoryIcons: { [key: string]: React.ReactNode } = {
  Infrastructure: <Server className="h-4 w-4" />,
  Development: <Code className="h-4 w-4" />,
  Optimization: <TrendingUp className="h-4 w-4" />,
  Security: <Shield className="h-4 w-4" />,
  Innovation: <Lightbulb className="h-4 w-4" />,
  Learning: <GraduationCap className="h-4 w-4" />,
  Automation: <Cog className="h-4 w-4" />,
  Exploration: <Search className="h-4 w-4" />,
  DevOps: <Rocket className="h-4 w-4" />
};

// Category colors
const categoryColors: { [key: string]: string } = {
  Infrastructure: '#6366f1',
  Development: '#10b981',
  Optimization: '#f59e0b',
  Security: '#ef4444',
  Innovation: '#8b5cf6',
  Learning: '#3b82f6',
  Automation: '#14b8a6',
  Exploration: '#ec4899',
  DevOps: '#f97316'
};

// Animated counter for impact metrics
function AnimatedCounter({ value, suffix, duration = 2000 }: { value: number; suffix: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (isInView) {
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(parseFloat((value * easeOut).toFixed(1)));
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }
  }, [isInView, value, duration]);

  return (
    <span ref={ref} className="text-3xl font-bold text-primary">
      {displayValue.toFixed(value % 1 !== 0 ? 1 : 0)}{suffix}
    </span>
  );
}

// Impact metric card component
function ImpactMetricCard({ metric, index, color }: {
  metric: { value: number; label: string; suffix: string };
  index: number;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay: 0.3 + index * 0.1, duration: 0.4, type: "spring" }}
      className="relative group"
    >
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"
        style={{ background: `${color}40` }}
      />
      <div className="relative p-4 rounded-xl bg-gradient-to-br from-background/80 to-secondary/30 border border-border/50 backdrop-blur-sm">
        <div className="flex flex-col items-center text-center">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
            style={{ background: `${color}20` }}
          >
            <TrendingUp className="h-5 w-5" style={{ color }} />
          </div>
          <AnimatedCounter value={metric.value} suffix={metric.suffix} />
          <span className="text-xs text-muted-foreground mt-1">{metric.label}</span>
        </div>
      </div>
    </motion.div>
  );
}

// Skill tag component
function SkillTag({ skill, index }: { skill: string; index: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.5 + index * 0.05, duration: 0.3 }}
      className="px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
    >
      {skill}
    </motion.span>
  );
}

// Timeline animations
const timelineVariants = {
  hidden: { opacity: 0, scaleY: 0 },
  visible: {
    opacity: 1,
    scaleY: 1,
    transition: {
      duration: 1.5,
      ease: "easeOut"
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, x: -50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

const dotVariants = {
  hidden: { opacity: 0, scale: 0 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * 0.2,
      duration: 0.5,
      type: "spring",
      stiffness: 200
    }
  })
};

export default function Experience() {
  const [expandedCards, setExpandedCards] = useState<{ [key: number]: boolean }>({});

  const toggleExpand = (index: number) => {
    setExpandedCards(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <section id="experience" className="pb-24 section-dark relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary/3 to-transparent rounded-full" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      <div className="container px-4 md:px-6 relative z-10">
        {/* Section header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="mb-4 border-primary/40 text-primary px-4 py-1">
              <Briefcase className="h-3.5 w-3.5 mr-2" />
              Professional Journey
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Work Experience
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              Building scalable solutions and driving innovation in cloud & DevOps
            </p>
            <div className="w-24 h-1 bg-gradient-to-r from-primary via-accent to-primary mx-auto rounded-full" />
          </motion.div>
        </div>

        {/* Experience timeline */}
        <div className="max-w-5xl mx-auto">
          <div className="relative">
            {/* Animated timeline line */}
            <motion.div
              className="absolute left-6 md:left-8 top-0 bottom-0 w-0.5 origin-top"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={timelineVariants}
            >
              <div className="h-full bg-gradient-to-b from-primary via-accent to-primary/50" />
            </motion.div>

            {/* Experience cards */}
            <div className="space-y-12">
              {EXPERIENCE.map((exp, index) => (
                <motion.div
                  key={index}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-50px" }}
                  className="relative pl-16 md:pl-20"
                >
                  {/* Timeline dot */}
                  <motion.div
                    custom={index}
                    variants={dotVariants}
                    className="absolute left-0 top-0"
                  >
                    <div
                      className="relative w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center shadow-xl"
                      style={{
                        background: `linear-gradient(135deg, ${exp.companyColor}, ${exp.companyColor}cc)`
                      }}
                    >
                      {/* Pulsing ring */}
                      <span
                        className="absolute inset-0 rounded-full animate-ping opacity-20"
                        style={{ background: exp.companyColor }}
                      />
                      {/* Company initials */}
                      <span className="text-white font-bold text-sm md:text-lg relative z-10">
                        {exp.companyInitials}
                      </span>
                    </div>
                  </motion.div>

                  {/* Main card */}
                  <motion.div variants={cardVariants}>
                    <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-card to-card/80 backdrop-blur-sm">
                      {/* Top accent gradient */}
                      <div
                        className="h-1.5"
                        style={{
                          background: `linear-gradient(90deg, ${exp.companyColor}, ${exp.companyColor}80, transparent)`
                        }}
                      />

                      <div className="p-6 md:p-8">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-2xl font-bold text-foreground">
                                {exp.position}
                              </h3>
                              <Badge
                                variant="outline"
                                className={`text-xs ${exp.type === 'Full-time' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}
                              >
                                {exp.type}
                              </Badge>
                            </div>
                            <p className="text-lg font-medium" style={{ color: exp.companyColor }}>
                              {exp.company}
                            </p>
                          </div>

                          {/* Duration badge */}
                          <div className="flex items-center gap-2 text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full border border-border/50">
                            <Calendar className="h-4 w-4" style={{ color: exp.companyColor }} />
                            <span className="text-sm font-medium">{exp.duration}</span>
                          </div>
                        </div>

                        {/* Meta info */}
                        <div className="flex flex-wrap gap-3 mb-6">
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Calendar className="h-4 w-4 text-primary" />
                            <span>{exp.period}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <MapPin className="h-4 w-4 text-primary" />
                            <span>{exp.location}</span>
                          </div>
                        </div>

                        {/* Impact metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                          {exp.impactMetrics.map((metric, i) => (
                            <ImpactMetricCard
                              key={i}
                              metric={metric}
                              index={i}
                              color={exp.companyColor}
                            />
                          ))}
                        </div>

                        {/* Skills tags */}
                        <div className="flex flex-wrap gap-2 mb-6">
                          {exp.skills.map((skill, i) => (
                            <SkillTag key={i} skill={skill} index={i} />
                          ))}
                        </div>

                        {/* Expand/Collapse button */}
                        <button
                          onClick={() => toggleExpand(index)}
                          className="w-full flex items-center justify-center gap-2 py-2 text-muted-foreground hover:text-foreground transition-colors border-t border-border/50 mt-2"
                        >
                          <span className="text-sm font-medium">
                            {expandedCards[index] ? 'Hide Responsibilities' : 'View Responsibilities'}
                          </span>
                          {expandedCards[index] ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>

                        {/* Expandable responsibilities */}
                        <AnimatePresence>
                          {expandedCards[index] && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="pt-6 space-y-4">
                                {exp.responsibilities.map((resp, i) => {
                                  const categoryColor = categoryColors[resp.category] || exp.companyColor;
                                  const CategoryIcon = categoryIcons[resp.category] || <Zap className="h-4 w-4" />;

                                  return (
                                    <motion.div
                                      key={i}
                                      initial={{ opacity: 0, x: -20 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: i * 0.1, duration: 0.3 }}
                                      className="group"
                                    >
                                      <div className="flex gap-4 p-4 rounded-xl bg-background/50 border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg">
                                        {/* Category icon */}
                                        <div
                                          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                                          style={{ background: `${categoryColor}20` }}
                                        >
                                          <div style={{ color: categoryColor }}>
                                            {CategoryIcon}
                                          </div>
                                        </div>

                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Badge
                                              variant="outline"
                                              className="text-xs font-medium"
                                              style={{
                                                background: `${categoryColor}15`,
                                                color: categoryColor,
                                                borderColor: `${categoryColor}40`
                                              }}
                                            >
                                              {resp.category}
                                            </Badge>
                                          </div>
                                          <p className="text-foreground/80 text-sm leading-relaxed">
                                            {resp.text}
                                          </p>
                                        </div>
                                      </div>
                                    </motion.div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </Card>
                  </motion.div>
                </motion.div>
              ))}
            </div>

            {/* Timeline end marker */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, duration: 0.3 }}
              className="absolute left-6 md:left-8 bottom-0 transform -translate-x-1/2"
            >
              <div className="w-4 h-4 rounded-full bg-gradient-to-r from-primary to-accent shadow-lg" />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
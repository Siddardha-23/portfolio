import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { Cloud, Code, Database, Server, Download, ArrowRight, Zap, Users, Clock, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PERSONAL_INFO } from '@/lib/constants';

// Animated stat counter
function AnimatedStat({ value, label, suffix = '', icon: Icon }: { value: number; label: string; suffix?: string; icon: React.ElementType }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (isInView) {
      const duration = 2000;
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.round(value * easeOut));
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }
  }, [isInView, value]);

  return (
    <div ref={ref} className="text-center group">
      <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-2 md:mb-3 rounded-xl md:rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
        <Icon className="h-5 w-5 md:h-7 md:w-7 text-primary" />
      </div>
      <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">
        {displayValue}{suffix}
      </div>
      <div className="text-xs md:text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

// Interactive feature card with hover effects
function FeatureCard({ icon: Icon, title, description, index, color }: {
  icon: React.ElementType;
  title: string;
  description: string;
  index: number;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="group relative"
    >
      {/* Glow effect on hover */}
      <div
        className="absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
        style={{ background: `${color}30` }}
      />

      <div className="relative bg-card p-6 rounded-2xl border border-border/50 hover:border-primary/30 transition-all duration-300 shadow-lg hover:shadow-2xl h-full">
        {/* Icon with gradient background */}
        <div
          className="w-14 h-14 rounded-xl mb-4 flex items-center justify-center transition-transform duration-300 group-hover:rotate-6"
          style={{ background: `linear-gradient(135deg, ${color}20, ${color}40)` }}
        >
          <Icon className="h-7 w-7" style={{ color }} />
        </div>

        <h4 className="text-lg font-bold mb-2 text-foreground group-hover:text-primary transition-colors">
          {title}
        </h4>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>

        {/* Learn more arrow that appears on hover */}
        <div className="mt-4 flex items-center text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="text-sm font-medium mr-1">Learn More</span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </motion.div>
  );
}

export default function About() {
  const featureItems = [
    {
      icon: Cloud,
      title: 'Cloud Architecture',
      description: 'Designing scalable, secure AWS infrastructure with VPC, EC2, S3, and more for high-availability solutions.',
      color: '#FF9900'
    },
    {
      icon: Code,
      title: 'DevOps Automation',
      description: 'Building CI/CD pipelines with CodePipeline, GitHub Actions, and automating workflows for rapid delivery.',
      color: '#10b981'
    },
    {
      icon: Server,
      title: 'Containerization',
      description: 'Containerizing applications with Docker and orchestrating deployments on AWS ECS/Fargate.',
      color: '#2496ED'
    },
    {
      icon: Database,
      title: 'Infrastructure as Code',
      description: 'Managing infrastructure with Terraform and CloudFormation for reproducible, version-controlled deployments.',
      color: '#7B42BC'
    }
  ];

  const stats = [
    { value: 2, label: 'Years Experience', suffix: '+', icon: Clock },
    { value: 15, label: 'AWS Services', suffix: '+', icon: Cloud },
    { value: 45, label: 'Efficiency Gain', suffix: '%', icon: Zap },
    { value: 100, label: 'Code Coverage', suffix: '%', icon: Target }
  ];

  return (
    <section id="about" className="pb-20 md:pb-24 bg-background relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-40 md:w-80 h-40 md:h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-48 md:w-96 h-48 md:h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="container px-4 md:px-6 relative z-10">
        {/* Section header */}
        <div className="text-center mb-10 md:mb-16">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="mb-3 md:mb-4 border-primary/40 text-primary px-3 md:px-4 py-1 text-xs md:text-sm">
              <Users className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1.5 md:mr-2" />
              About Me
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 text-foreground">
              Cloud & DevOps Professional
            </h2>
            <div className="w-16 md:w-24 h-1 bg-gradient-to-r from-primary via-accent to-primary mx-auto rounded-full" />
          </motion.div>
        </div>

        {/* Main content */}
        <div className="max-w-6xl mx-auto">
          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16 p-6 rounded-2xl bg-gradient-to-r from-card via-secondary/30 to-card border border-border/50"
          >
            {stats.map((stat, i) => (
              <AnimatedStat key={i} {...stat} />
            ))}
          </motion.div>

          {/* About content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start mb-16">
            {/* Left: Personal intro */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h3 className="text-2xl font-bold mb-6 text-foreground flex items-center gap-2">
                <span className="w-8 h-1 bg-primary rounded-full" />
                Who I Am
              </h3>

              <div className="space-y-4 text-foreground/80 leading-relaxed">
                <p>
                  I'm <span className="font-semibold text-primary">Harshith Siddardha Manne</span>,
                  a passionate Cloud & DevOps Engineer pursuing my Master's in Information Technology
                  at <span className="font-semibold">Arizona State University</span>.
                </p>
                <p>
                  {PERSONAL_INFO.summary}
                </p>
                <p>
                  My expertise lies in designing and implementing secure, scalable infrastructure
                  solutions using AWS, Terraform, Docker, and modern CI/CD practices. I thrive on
                  automating workflows and optimizing deployment pipelines to deliver reliable
                  software faster.
                </p>
              </div>

              {/* Quick highlights */}
              <div className="mt-8 space-y-3">
                {[
                  'AWS Infrastructure Architecture',
                  'DevOps & CI/CD Pipeline Automation',
                  'Container Orchestration with ECS/Fargate',
                  'Infrastructure as Code (Terraform & CloudFormation)'
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                    className="flex items-center gap-3 group"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary group-hover:scale-150 transition-transform" />
                    <span className="text-foreground/90 group-hover:text-primary transition-colors">
                      {item}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* CTA buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="mt-8 flex flex-wrap gap-4"
              >
                <Button className="btn-premium group" asChild>
                  <a href="#contact">
                    Let's Connect
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </a>
                </Button>
                <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10" asChild>
                  <a href="/resume.pdf" download>
                    <Download className="mr-2 h-4 w-4" />
                    Download Resume
                  </a>
                </Button>
              </motion.div>
            </motion.div>

            {/* Right: Feature cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {featureItems.map((item, index) => (
                <FeatureCard key={index} index={index} {...item} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PROJECTS } from '@/lib/constants';
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Github,
  ArrowRight,
  Layers,
  Cloud,
  Server,
  Code,
  Rocket,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';

// Tech icon mapping
const techIcons: { [key: string]: React.ReactNode } = {
  'AWS': <Cloud className="h-4 w-4" />,
  'Terraform': <Server className="h-4 w-4" />,
  'Docker': <Layers className="h-4 w-4" />,
  'Flask': <Code className="h-4 w-4" />,
  'React': <Code className="h-4 w-4" />,
  'Nginx': <Server className="h-4 w-4" />,
  'CI/CD': <Rocket className="h-4 w-4" />
};

// Tech color mapping
const techColors: { [key: string]: string } = {
  'AWS': '#FF9900',
  'Terraform': '#7B42BC',
  'Docker': '#2496ED',
  'Flask': '#000000',
  'React': '#61DAFB',
  'Nginx': '#009639',
  'CI/CD': '#4CAF50'
};

// Project card component
function ProjectCard({ project, index }: { project: typeof PROJECTS[0]; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: index * 0.2 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group"
    >
      <Card className="relative overflow-hidden border-0 shadow-2xl bg-card h-full">
        {/* Animated gradient border effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ padding: '2px' }}
          animate={isHovered ? { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] } : {}}
          transition={{ duration: 3, repeat: Infinity }}
        />

        {/* Inner content */}
        <div className="relative bg-card m-[2px] rounded-lg overflow-hidden">
          {/* Project header with visual element */}
          <div className="relative h-48 overflow-hidden bg-gradient-to-br from-primary/20 via-secondary/50 to-accent/20">
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute inset-0" style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)',
                backgroundSize: '20px 20px'
              }} />
            </div>

            {/* Floating icons animation */}
            <div className="absolute inset-0">
              {project.technologies.slice(0, 4).map((tech, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    top: `${20 + i * 20}%`,
                    left: `${10 + i * 25}%`
                  }}
                  animate={{
                    y: [0, -10, 0],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: i * 0.5
                  }}
                >
                  <div
                    className="p-3 rounded-xl backdrop-blur-sm border border-white/10"
                    style={{ background: `${techColors[tech] || '#6366f1'}20` }}
                  >
                    <div style={{ color: techColors[tech] || '#6366f1' }}>
                      {techIcons[tech] || <Code className="h-4 w-4" />}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Project number badge */}
            <div className="absolute top-4 right-4">
              <Badge className="bg-background/80 backdrop-blur-sm text-foreground border-0 px-3 py-1 shadow-lg">
                <Sparkles className="h-3 w-3 mr-1 text-primary" />
                Featured
              </Badge>
            </div>

            {/* Title overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-card via-card/80 to-transparent">
              <h3 className="text-2xl font-bold text-foreground mb-1">{project.title}</h3>
              <div className="flex items-center text-muted-foreground text-sm">
                <Calendar className="h-4 w-4 mr-2" />
                {project.period}
              </div>
            </div>
          </div>

          {/* Content section */}
          <div className="p-6">
            {/* Tech stack */}
            <div className="flex flex-wrap gap-2 mb-6">
              {project.technologies.map((tech, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.05, duration: 0.3 }}
                  whileHover={{ scale: 1.1, y: -2 }}
                >
                  <Badge
                    variant="outline"
                    className="px-3 py-1 flex items-center gap-1.5 border font-medium transition-colors"
                    style={{
                      background: `${techColors[tech] || '#6366f1'}10`,
                      color: techColors[tech] || '#6366f1',
                      borderColor: `${techColors[tech] || '#6366f1'}40`
                    }}
                  >
                    {techIcons[tech] || <Code className="h-3 w-3" />}
                    {tech}
                  </Badge>
                </motion.div>
              ))}
            </div>

            {/* Description points - show first 2, expandable */}
            <ul className="space-y-3">
              {project.description.slice(0, isExpanded ? project.description.length : 2).map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-foreground/80 text-sm leading-relaxed">{item}</span>
                </motion.li>
              ))}
            </ul>

            {/* Expand button if more descriptions */}
            {project.description.length > 2 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-center gap-2 mt-4 py-2 text-muted-foreground hover:text-primary transition-colors"
              >
                <span className="text-sm font-medium">
                  {isExpanded ? 'Show Less' : `Show ${project.description.length - 2} More`}
                </span>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-border/50">
              <Button className="flex-1 btn-premium group" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Live Demo
                <ArrowRight className="ml-auto h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </Button>
              <Button variant="outline" size="sm" className="border-primary/50 text-primary hover:bg-primary/10">
                <Github className="h-4 w-4 mr-2" />
                Code
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function Projects() {
  return (
    <section id="projects" className="pb-20 md:pb-24 section-light relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 right-0 w-40 md:w-80 h-40 md:h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-48 md:w-96 h-48 md:h-96 bg-accent/5 rounded-full blur-3xl" />

        {/* Floating particles - hidden on mobile for performance */}
        <div className="hidden md:block">
          {[...Array(10)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-primary/20"
              initial={{
                x: `${Math.random() * 100}%`,
                y: '100%'
              }}
              animate={{
                y: '-100%',
                opacity: [0, 1, 0]
              }}
              transition={{
                duration: Math.random() * 15 + 10,
                repeat: Infinity,
                delay: Math.random() * 5
              }}
            />
          ))}
        </div>
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
              <Rocket className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1.5 md:mr-2" />
              Featured Work
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 text-foreground">
              Projects
            </h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto mb-4 md:mb-6 px-4">
              Showcasing real-world applications of cloud infrastructure, DevOps automation,
              and modern deployment practices
            </p>
            <div className="w-16 md:w-24 h-1 bg-gradient-to-r from-primary via-accent to-primary mx-auto rounded-full" />
          </motion.div>
        </div>

        {/* Projects grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {PROJECTS.map((project, index) => (
            <ProjectCard key={index} project={project} index={index} />
          ))}
        </div>

        {/* More projects CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-16 text-center"
        >
          <Button variant="outline" size="lg" className="border-primary/50 text-primary hover:bg-primary/10 group" asChild>
            <a href="https://github.com/Siddardha-23" target="_blank" rel="noopener noreferrer">
              <Github className="mr-2 h-5 w-5" />
              View More on GitHub
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
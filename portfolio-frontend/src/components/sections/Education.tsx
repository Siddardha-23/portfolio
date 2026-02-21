import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Calendar, GraduationCap, MapPin, BookOpen, Trophy, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { EDUCATION } from '@/lib/constants';

// Animated counter component for GPA
function AnimatedGPA({ value, maxValue, color }: { value: number; maxValue: number; color: { primary: string; secondary: string } }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const [displayValue, setDisplayValue] = useState(0);
  const percentage = (value / maxValue) * 100;
  const circumference = 2 * Math.PI * 54; // radius = 54

  useEffect(() => {
    if (isInView) {
      const duration = 2000;
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Easing function for smooth animation
        const easeOut = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(parseFloat((value * easeOut).toFixed(2)));
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }
  }, [isInView, value]);

  return (
    <div ref={ref} className="relative w-32 h-32">
      {/* Background circle */}
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r="54"
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          className="text-muted/20"
        />
        {/* Animated progress circle */}
        <motion.circle
          cx="60"
          cy="60"
          r="54"
          stroke={`url(#gpaGradient-${color.primary.replace('#', '')})`}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
          animate={isInView ? { strokeDashoffset: circumference - (percentage / 100) * circumference } : {}}
          transition={{ duration: 2, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id={`gpaGradient-${color.primary.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color.primary} />
            <stop offset="100%" stopColor={color.secondary} />
          </linearGradient>
        </defs>
      </svg>
      {/* GPA value in center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-foreground">{displayValue.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground">/ {maxValue.toFixed(1)}</span>
      </div>
    </div>
  );
}

// Grade badge component
function GradeBadge({ grade }: { grade: string }) {
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
      case 'A+':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'A-':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'B+':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'B':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      default:
        return 'bg-primary/20 text-primary border-primary/30';
    }
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getGradeColor(grade)}`}>
      {grade}
    </span>
  );
}

// Card animation variants
const cardVariants = {
  hidden: { opacity: 0, y: 60 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.3,
      duration: 0.8,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  })
};

const courseVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.5 + i * 0.1,
      duration: 0.4
    }
  })
};

const achievementVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: 0.8 + i * 0.15,
      duration: 0.3,
      type: "spring",
      stiffness: 200
    }
  })
};

export default function Education() {
  const [expandedCards, setExpandedCards] = useState<{ [key: number]: boolean }>({});

  const toggleExpand = (index: number) => {
    setExpandedCards(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <section id="education" className="pb-24 section-light relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-accent/5 to-transparent rounded-full blur-3xl" />
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
              <GraduationCap className="h-3.5 w-3.5 mr-2" />
              Academic Journey
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Education
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              MS in Information Technology (ASU) and BS in Computer Science (JNTU)
            </p>
            <div className="w-24 h-1 bg-gradient-to-r from-primary via-accent to-primary mx-auto rounded-full" />
          </motion.div>
        </div>

        {/* Education cards */}
        <div className="max-w-6xl mx-auto space-y-12">
          {EDUCATION.map((edu, index) => (
            <motion.div
              key={index}
              custom={index}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={cardVariants}
            >
              <Card className="relative overflow-hidden border-0 shadow-2xl">
                {/* Campus image as a side panel - NOT as background */}
                <div className="flex flex-col lg:flex-row">
                  {/* Campus Image Side Panel */}
                  <div className="relative lg:w-72 h-48 lg:h-auto overflow-hidden shrink-0">
                    <img
                      src={edu.campusImage}
                      alt={`${edu.institution} campus`}
                      className="w-full h-full object-cover"
                    />
                    {/* Gradient overlay for better blending */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(135deg, ${edu.color.primary}40 0%, ${edu.color.secondary}30 100%)`
                      }}
                    />
                    {/* University badge overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl backdrop-blur-sm"
                        style={{
                          background: `linear-gradient(135deg, ${edu.color.primary}ee, ${edu.color.secondary}ee)`
                        }}
                      >
                        <GraduationCap className="h-10 w-10 text-white" />
                      </div>
                    </div>
                    {/* Status badge on image */}
                    <div className="absolute top-4 left-4">
                      <Badge
                        className={`shadow-lg ${edu.status === 'In Progress' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'}`}
                      >
                        {edu.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Main content area with solid background */}
                  <div className="flex-1 bg-card">
                    {/* Top accent bar with university colors */}
                    <div
                      className="h-1.5"
                      style={{
                        background: `linear-gradient(90deg, ${edu.color.primary}, ${edu.color.secondary}, ${edu.color.primary})`
                      }}
                    />

                    <div className="p-6 lg:p-8">
                      {/* Header row */}
                      <div className="flex flex-col xl:flex-row xl:items-start gap-6">
                        {/* Left side - University info */}
                        <div className="flex-1">
                          <div className="mb-4">
                            <h3 className="text-2xl font-bold text-foreground mb-2">
                              {edu.degree}
                            </h3>
                            <p className="text-lg font-semibold" style={{ color: edu.color.primary }}>
                              {edu.institution}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {edu.institutionFull}
                            </p>
                          </div>

                          {/* Meta information */}
                          <div className="flex flex-wrap gap-3 mb-5">
                            <div className="flex items-center gap-2 text-muted-foreground px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50">
                              <Calendar className="h-4 w-4" style={{ color: edu.color.primary }} />
                              <span className="text-sm font-medium">{edu.period}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50">
                              <MapPin className="h-4 w-4" style={{ color: edu.color.primary }} />
                              <span className="text-sm font-medium">{edu.location}</span>
                            </div>
                          </div>

                          {/* Achievements */}
                          <div className="flex flex-wrap gap-2">
                            {edu.achievements.map((achievement, i) => (
                              <motion.div
                                key={i}
                                custom={i}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                variants={achievementVariants}
                              >
                                <Badge
                                  className="px-3 py-1.5 text-sm font-medium border shadow-sm"
                                  style={{
                                    background: `${edu.color.primary}15`,
                                    color: edu.color.primary,
                                    borderColor: `${edu.color.primary}30`
                                  }}
                                >
                                  <Trophy className="h-3 w-3 mr-1.5" />
                                  {achievement}
                                </Badge>
                              </motion.div>
                            ))}
                          </div>
                        </div>

                        {/* Right side - GPA visualization */}
                        <div className="flex flex-col items-center bg-secondary/30 rounded-2xl p-4 border border-border/50">
                          <AnimatedGPA value={edu.gpa} maxValue={edu.maxGpa} color={edu.color} />
                          <p className="text-sm font-semibold text-foreground mt-2">Grade Point Average</p>
                          <p className="text-xs text-muted-foreground">{edu.gpaText}</p>
                        </div>
                      </div>

                      {/* Expand/Collapse button */}
                      <button
                        onClick={() => toggleExpand(index)}
                        className="w-full flex items-center justify-center gap-2 py-3 mt-4 text-muted-foreground hover:text-foreground transition-colors border-t border-border/50 rounded-b-lg hover:bg-secondary/30"
                      >
                        <BookOpen className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {expandedCards[index] ? 'Hide Coursework' : 'View Coursework & Grades'}
                        </span>
                        {expandedCards[index] ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      {/* Expandable coursework section */}
                      <motion.div
                        initial={false}
                        animate={{
                          height: expandedCards[index] ? 'auto' : 0,
                          opacity: expandedCards[index] ? 1 : 0
                        }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="pt-6 border-t border-border/50 mt-4">
                          <div className="flex items-center gap-2 mb-4">
                            <BookOpen className="h-5 w-5" style={{ color: edu.color.primary }} />
                            <h4 className="font-semibold text-foreground">Relevant Coursework</h4>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {edu.coursework.map((course, i) => (
                              <motion.div
                                key={i}
                                custom={i}
                                initial="hidden"
                                animate={expandedCards[index] ? "visible" : "hidden"}
                                variants={courseVariants}
                                className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/50 hover:border-primary/30 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <Star className="h-4 w-4 text-amber-400" />
                                  <span className="text-sm text-foreground font-medium">{course.name}</span>
                                </div>
                                <GradeBadge grade={course.grade} />
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
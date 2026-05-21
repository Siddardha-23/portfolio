import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Cloud, Code, Server, Database, GitBranch, Download, Mail, Sparkles, ArrowRight, Briefcase, MapPin, Search, Building2, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PERSONAL_INFO, ROLES } from '@/lib/constants';
import { apiService } from '@/lib/api';
import { VisitorMapTrigger } from '@/components/VisitorMapTrigger';
import { ResumeViewer } from '@/components/ResumeViewer';
import UnderTheHoodChips from '@/components/UnderTheHoodChips';
import { FEATURES } from '@/lib/underTheHoodData';
import { BuilderAgentInlineTrigger } from '@/components/agent/BuilderAgent';


// Animated role typewriter
function RoleTypewriter() {
  const [currentRoleIndex, setCurrentRoleIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentRole = ROLES[currentRoleIndex];
    const typeSpeed = isDeleting ? 50 : 100;

    if (!isDeleting && displayText === currentRole) {
      const timeout = setTimeout(() => setIsDeleting(true), 2000);
      return () => clearTimeout(timeout);
    } else if (isDeleting && displayText === '') {
      setIsDeleting(false);
      setCurrentRoleIndex((prev) => (prev + 1) % ROLES.length);
      return;
    }

    const timeout = setTimeout(() => {
      setDisplayText(prev =>
        isDeleting
          ? currentRole.substring(0, prev.length - 1)
          : currentRole.substring(0, prev.length + 1)
      );
    }, typeSpeed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentRoleIndex]);

  return (
    <span className="inline-flex items-center flex-wrap">
      <span className="gradient-text">{displayText}</span>
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="inline-block w-[3px] h-6 md:h-8 bg-primary ml-1"
      />
    </span>
  );
}

// Floating tech icon component
function FloatingIcon({ icon: Icon, delay, size, x, y, duration }: {
  icon: React.ElementType;
  delay: number;
  size: number;
  x: string;
  y: string;
  duration: number;
}) {
  return (
    <motion.div
      className="absolute text-primary/20 dark:text-accent/20 hidden lg:block"
      style={{ left: x, top: y }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0.2, 0.4, 0.2],
        scale: [1, 1.1, 1],
        y: [0, -15, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        delay,
        ease: "easeInOut"
      }}
    >
      <Icon style={{ width: size, height: size }} />
    </motion.div>
  );
}

// Recruiter Panel Component (Right side)
function RecruiterPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<{
    organizations: Array<{ name: string; visitors: number }>;
    total_visitors: number;
    total_registered: number;
    linkedin_profiles_found: number;
  } | null>(null);
  const [currentOrgIndex, setCurrentOrgIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const filteredRoles = ROLES.filter(role =>
    role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await apiService.getOrgStats();
        if (response.data) {
          setStats(response.data);
        }
      } catch {
        // Silently handle fetch failure
      } finally {
        setIsLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    if (!stats?.organizations.length || isCarouselPaused) return;
    const interval = setInterval(() => {
      setCurrentOrgIndex((prev) => (prev + 1) % stats.organizations.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [stats?.organizations.length, isCarouselPaused]);

  const handleRoleSelect = (role: string) => {
    setSearchQuery('');
    const roleToSectionMapping: Record<string, string> = {
      'Cloud Engineer': 'skills',
      'DevOps Engineer': 'skills',
      'AWS Specialist': 'skills',
      'Infrastructure Engineer': 'experience',
      'Site Reliability Engineer (SRE)': 'experience',
      'Systems Administrator': 'skills',
      'Backend Developer': 'projects',
      'Full-Stack Developer': 'projects',
      'Data Engineer': 'experience',
    };
    const sectionId = roleToSectionMapping[role] || 'skills';
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const currentOrg = stats?.organizations[currentOrgIndex];

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6, duration: 0.7 }}
      className="h-full"
    >
      <div className="relative h-full">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20 rounded-3xl blur-xl opacity-60" />

        <div className="relative h-full glass-card rounded-3xl p-6 md:p-8 border border-primary/20 flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Looking to hire?</h3>
              <p className="text-sm text-muted-foreground">Find my relevant experience</p>
            </div>
          </div>

          {/* Role Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              className="pl-10 h-12 bg-background/50 border-border focus-visible:ring-primary/40"
              placeholder="Search roles (DevOps, Cloud...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {searchQuery && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full left-0 right-0 mt-2 z-50 bg-popover border border-border rounded-xl shadow-2xl max-h-48 overflow-y-auto"
              >
                {filteredRoles.length > 0 ? (
                  <ul className="py-2">
                    {filteredRoles.map((role, idx) => (
                      <li
                        key={idx}
                        onClick={() => handleRoleSelect(role)}
                        className="px-4 py-2.5 hover:bg-secondary cursor-pointer text-sm text-foreground flex items-center gap-2 transition-colors"
                      >
                        <ArrowRight className="h-3 w-3 text-primary" />
                        {role}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-3 text-sm text-muted-foreground">No matching roles</p>
                )}
              </motion.div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Visitors</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Stats Grid — skeleton placeholders that match final layout
              so there's no jump when real data lands */}
          {isLoadingStats && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-6 animate-pulse" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-[62px] rounded-xl bg-secondary/40 border border-border/60 flex flex-col items-center justify-center gap-1.5">
                    <div className="h-4 w-8 rounded bg-secondary" />
                    <div className="h-2 w-12 rounded bg-secondary/70" />
                  </div>
                ))}
              </div>
              <div className="mb-4 animate-pulse" aria-hidden>
                <div className="h-11 rounded-xl bg-secondary/40 border border-border/60" />
              </div>
              <div className="flex-1 flex flex-col justify-end animate-pulse" aria-hidden>
                <div className="p-4 rounded-xl bg-secondary/30 border border-border/40">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-secondary" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 rounded bg-secondary" />
                      <div className="h-2 w-1/2 rounded bg-secondary/70" />
                    </div>
                  </div>
                  <div className="flex justify-center gap-1.5 mt-3">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div key={i} className="h-1.5 w-1.5 rounded-full bg-secondary" />
                    ))}
                  </div>
                </div>
              </div>
              <span className="sr-only">Loading visitor stats…</span>
            </>
          )}
          {stats && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="text-center p-3 rounded-xl bg-secondary/40 border border-border">
                <div className="text-xl font-bold text-primary">{stats.total_visitors}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Visitors</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-secondary/40 border border-border">
                <div className="text-xl font-bold text-accent">{stats.organizations.length}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Orgs</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-secondary/40 border border-border">
                <div className="text-xl font-bold text-blue-500">{stats.linkedin_profiles_found}</div>
                <div className="text-[10px] text-muted-foreground uppercase">LinkedIn</div>
              </div>
            </div>
          )}

          {/* Global Reach Button */}
          {stats && (
            <div className="mb-4">
              <VisitorMapTrigger onClick={() => window.dispatchEvent(new CustomEvent('open-visitor-map'))} />
            </div>
          )}

          {/* Organization Carousel */}
          {stats && stats.organizations.length > 0 && (
            <div className="flex-1 flex flex-col justify-end">
              <div
                className="p-4 rounded-xl bg-secondary/30 border border-border/50"
                onMouseEnter={() => setIsCarouselPaused(true)}
                onMouseLeave={() => setIsCarouselPaused(false)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/30">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentOrgIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="flex-1 min-w-0"
                    >
                      <div className="font-medium text-foreground truncate">
                        {currentOrg?.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {currentOrg?.visitors} professional{currentOrg && currentOrg.visitors > 1 ? 's' : ''} visited
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Dot indicators */}
                <div className="flex justify-center gap-1.5 mt-3">
                  {stats.organizations.slice(0, 5).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentOrgIndex(idx)}
                      className={`h-1.5 rounded-full transition-all ${idx === currentOrgIndex ? 'w-4 bg-primary' : 'w-1.5 bg-primary/30 hover:bg-primary/50'
                        }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Hero() {
  const navigate = useNavigate();
  const [visitorName, setVisitorName] = useState('');
  const [isReturningVisitor, setIsReturningVisitor] = useState(false);

  useEffect(() => {
    const visitorInfo = localStorage.getItem('visitorInfo');
    if (visitorInfo) {
      try {
        const { firstName } = JSON.parse(visitorInfo);
        setVisitorName(firstName);
      } catch {
        // Corrupted visitorInfo - clear it
        localStorage.removeItem('visitorInfo');
        return;
      }
    }

    // Track visit count to distinguish first visit from return visits
    // This runs for all users (form submitted or skipped) since portfolio_visit_count
    // is set during both form submit and skip
    const visitCountStr = localStorage.getItem('portfolio_visit_count');
    const currentCount = parseInt(visitCountStr || '0', 10);
    if (currentCount > 1) {
      setIsReturningVisitor(true);
    }
    // Increment visit count for next time
    if (currentCount > 0) {
      localStorage.setItem('portfolio_visit_count', String(currentCount + 1));
    }
  }, []);

  const scrollToAbout = () => {
    const aboutSection = document.getElementById('about');
    if (aboutSection) {
      aboutSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const floatingIcons = [
    { icon: Cloud, delay: 0, size: 36, x: '5%', y: '20%', duration: 6 },
    { icon: Server, delay: 1, size: 28, x: '95%', y: '15%', duration: 7 },
    { icon: Database, delay: 2, size: 32, x: '3%', y: '75%', duration: 5 },
    { icon: Code, delay: 0.5, size: 24, x: '92%', y: '70%', duration: 8 },
    { icon: GitBranch, delay: 1.5, size: 26, x: '8%', y: '50%', duration: 6 }
  ];

  return (
    <section id="hero" className="relative min-h-screen flex items-center overflow-hidden py-20 md:py-24">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-secondary/20 to-background" />

        <motion.div
          className="absolute top-1/4 left-1/4 w-[300px] md:w-[500px] h-[300px] md:h-[500px] rounded-full bg-primary/10 blur-[80px] md:blur-[120px]"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-[250px] md:w-[400px] h-[250px] md:h-[400px] rounded-full bg-accent/10 blur-[80px] md:blur-[120px]"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, delay: 2 }}
        />

        <div
          className="absolute inset-0 opacity-[0.02] hidden md:block"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Floating icons */}
      {floatingIcons.map((props, i) => (
        <FloatingIcon key={i} {...props} />
      ))}

      <div className="container px-4 md:px-6 z-10">
        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* LEFT SIDE - Introduction */}
          <div className="text-center lg:text-left">
            {/* Welcome badge */}
            {visitorName && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="mb-4 md:mb-6"
              >
                <span
                  role="status"
                  aria-live="polite"
                  className="inline-flex items-center px-3 py-1.5 text-xs md:text-sm rounded-full bg-primary/10 text-primary border border-primary/25"
                >
                  <Sparkles className="h-3 w-3 md:h-4 md:w-4 mr-1.5" />
                  {isReturningVisitor ? `Welcome back, ${visitorName}!` : `Hello, ${visitorName}!`}
                </span>
              </motion.div>
            )}

            {/* Intro text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-lg md:text-xl text-muted-foreground mb-2 font-light">
                Hello, I'm
              </h2>
            </motion.div>

            {/* Name + inline AI-team trigger (the blink icon that used to
                float at bottom-right and collide with the Concierge) */}
            <motion.h1
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 text-foreground leading-tight"
            >
              <span className="inline-flex items-center gap-3 flex-wrap">
                <span className="gradient-text">Harshith</span>
                <span className="inline-block align-middle">
                  <BuilderAgentInlineTrigger size={38} />
                </span>
              </span>
              <br />
              <span className="text-foreground/80">Siddardha</span>
            </motion.h1>

            {/* Typewriter role */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-medium mb-6 min-h-[2rem]"
            >
              <RoleTypewriter />
            </motion.div>

            {/* Summary */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-6 leading-relaxed"
            >
              {PERSONAL_INFO.summary}
            </motion.p>

            {/* Quick stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="flex flex-wrap justify-center lg:justify-start gap-2 mb-6"
            >
              {[
                { icon: MapPin, label: 'Location', value: 'Tempe, AZ' },
                { icon: Briefcase, label: 'Status', value: 'Seeking Full-Time' },
                { icon: Sparkles, label: 'Graduating', value: 'May 2026' },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 backdrop-blur-sm border border-border/50"
                >
                  <stat.icon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">{stat.label}:</span>
                  <span className="text-xs font-medium text-foreground">{stat.value}</span>
                </div>
              ))}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
            >
              <Button
                size="lg"
                className="btn-premium text-sm md:text-base px-6 py-5 group"
                onClick={scrollToAbout}
              >
                Explore My Work
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary/50 text-primary hover:bg-primary/10 text-sm md:text-base px-6 py-5"
                asChild
              >
                <a href="#contact">
                  <Mail className="mr-2 h-4 w-4" />
                  Get In Touch
                </a>
              </Button>
              <ResumeViewer>
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground text-sm md:text-base px-6 py-5"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Resume
                </Button>
              </ResumeViewer>
            </motion.div>

            {/* Availability */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.5 }}
              className="mt-8 flex items-center justify-center lg:justify-start gap-2 text-xs text-muted-foreground"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span>Available for opportunities starting May 2026</span>
            </motion.div>

            {/* Under the Hood chips */}
            {(() => {
              const feature = FEATURES.find(f => f.featureId === 'hero');
              return feature ? (
                <UnderTheHoodChips featureId="hero" chips={feature.chips} className="mt-4 justify-center lg:justify-start" />
              ) : null;
            })()}
          </div>

          {/* RIGHT SIDE - Tool Cards + Recruiter Panel */}
          <div className="hidden lg:block space-y-4">
            {/* Floating Tool Cards */}
            <div className="flex gap-3">
              <motion.a
                href="https://aithrex.tech"
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="group flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary/50 backdrop-blur-sm border border-indigo-500/20 hover:border-indigo-500/40 transition-all cursor-pointer text-left"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="relative flex-shrink-0">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 border border-indigo-500/30">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                  </div>
                  <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white leading-none">
                    Live
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">Aithrex · Infratrix</div>
                  <div className="text-xs text-muted-foreground">Autonomous AI for cloud infra</div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
              </motion.a>

              <motion.button
                onClick={() => {
                  const el = document.getElementById('now-building');
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.5 }}
                className="group flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary/50 backdrop-blur-sm border border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer text-left"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="relative flex-shrink-0">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
                    <Activity className="h-4 w-4 text-emerald-400" />
                  </div>
                  <span className="absolute -top-1.5 -right-1.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">Cloud Diary</div>
                  <div className="text-xs text-muted-foreground">What I'm shipping right now</div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
              </motion.button>
            </div>

            <RecruiterPanel />
          </div>
        </div>

        {/* Mobile Recruiter Panel - Below on smaller screens */}
        <div className="lg:hidden mt-12 space-y-4">
          {/* Mobile Tool Cards */}
          <div className="flex flex-col sm:flex-row gap-3">
            <motion.a
              href="https://aithrex.tech"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="group flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary/50 backdrop-blur-sm border border-indigo-500/20 hover:border-indigo-500/40 transition-all cursor-pointer text-left"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative flex-shrink-0">
                <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 border border-indigo-500/30">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white leading-none">
                  Live
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">Aithrex · Infratrix</div>
                <div className="text-xs text-muted-foreground">Autonomous AI for cloud infra</div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground group-hover:text-indigo-400 transition-all" />
            </motion.a>

            <motion.button
              onClick={() => {
                const el = document.getElementById('now-building');
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.5 }}
              className="group flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary/50 backdrop-blur-sm border border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer text-left"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative flex-shrink-0">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
                  <Activity className="h-4 w-4 text-emerald-400" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">Cloud Diary</div>
                <div className="text-xs text-muted-foreground">What I'm shipping right now</div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground group-hover:text-emerald-400 transition-all" />
            </motion.button>
          </div>

          <RecruiterPanel />
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-6 md:bottom-10 left-1/2 transform -translate-x-1/2 z-20"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={scrollToAbout}
          className="text-primary hover:text-primary/80 bg-secondary/80 backdrop-blur-sm hover:bg-secondary rounded-full border border-primary/20 h-10 w-10 md:h-12 md:w-12"
        >
          <ChevronDown className="h-5 w-5 md:h-6 md:w-6" />
        </Button>
      </motion.div>
    </section>
  );
}
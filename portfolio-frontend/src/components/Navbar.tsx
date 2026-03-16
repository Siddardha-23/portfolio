import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Menu, X, ChevronRight, Download, Mail } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { UnderTheHoodToggle } from '@/components/UnderTheHoodToggle';
import { ResumeViewer } from '@/components/ResumeViewer';

const navItems = [
  { label: 'Home', href: '/home', shortLabel: 'Home' },
  { label: 'About', href: '/home#about', shortLabel: 'About' },
  { label: 'Skills', href: '/home#skills', shortLabel: 'Skills' },
  { label: 'Education', href: '/home#education', shortLabel: 'Edu' },
  { label: 'Experience', href: '/home#experience', shortLabel: 'Work' },
  { label: 'Projects', href: '/home#projects', shortLabel: 'Projects' },
  { label: 'Cloud Lab', href: '/cloud-lab', shortLabel: 'Lab' },
  { label: 'Contact', href: '/home#contact', shortLabel: 'Contact' },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [scrollProgress, setScrollProgress] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);

      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = height > 0 ? Math.min((winScroll / height) * 100, 100) : 0;
      setScrollProgress(scrolled);

      const sections = navItems.map(item => item.href.split('#')[1]).filter(Boolean);
      const currentSection = sections.find(section => {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          return rect.top <= 200 && rect.bottom >= 200;
        }
        return false;
      });

      if (currentSection) {
        setActiveSection(currentSection);
      } else if (window.scrollY < 100) {
        setActiveSection('');
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);

    const isOnHome = location.pathname === '/home';
    const hasHash = href.includes('#');
    const hash = hasHash ? href.split('#')[1] : '';

    if (href === '/home' && isOnHome) {
      // Already on home, scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (hasHash && isOnHome) {
      // Already on home, just scroll to section
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update URL hash without navigation
      window.history.pushState(null, '', href);
      return;
    }

    // Navigate to the page (handles /cloud-lab and cross-page navigation)
    navigate(href);

    // If navigating to /home with hash, scroll after navigation
    if (hasHash) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  };

  const navVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.05, duration: 0.3 }
    })
  };

  const mobileMenuVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { staggerChildren: 0.05 }
    },
    exit: { opacity: 0, y: -20 }
  };

  const mobileItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  return (
    <>
      {/* Floating glass island navbar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
        {/* Scroll progress bar */}
        <motion.div
          className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-primary via-accent to-primary z-50"
          style={{ width: `${scrollProgress}%` }}
        />

        <motion.header
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, type: 'spring', damping: 20 }}
          className={cn(
            'pointer-events-auto transition-all duration-500 mt-3',
            isScrolled
              ? 'bg-background/60 backdrop-blur-2xl border border-border/40 shadow-xl shadow-black/5 dark:shadow-black/20 rounded-2xl px-3 py-2'
              : 'bg-background/30 backdrop-blur-lg border border-white/10 shadow-lg rounded-2xl px-3 py-2.5'
          )}
        >
          <div className="flex items-center gap-2">
            {/* Logo */}
            <Link
              to="/home"
              onClick={(e) => handleNavClick(e, '/home')}
              className="relative group shrink-0"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="flex items-center"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-white font-bold text-sm">HS</span>
                </div>
                <div className="hidden xl:block ml-2.5">
                  <span className="text-base font-bold gradient-text">Harshith</span>
                  <span className="text-base font-light text-foreground/60 ml-1">S</span>
                </div>
              </motion.div>
            </Link>

            {/* Separator */}
            <div className="hidden lg:block w-px h-6 bg-border/50 mx-1" />

            {/* Desktop Navigation pills */}
            <nav role="navigation" aria-label="Main navigation" className="hidden lg:flex items-center gap-0.5">
              {navItems.map((item, index) => {
                const isActive = activeSection === item.href.split('#')[1] ||
                  (item.href === '/home' && !activeSection && location.pathname === '/home') ||
                  (item.href === '/cloud-lab' && location.pathname === '/cloud-lab');

                return (
                  <motion.div
                    key={item.label}
                    custom={index}
                    initial="hidden"
                    animate="visible"
                    variants={navVariants}
                  >
                    <a
                      href={item.href}
                      onClick={(e) => handleNavClick(e, item.href)}
                      className={cn(
                        "relative text-xs font-medium rounded-xl px-3 py-1.5 transition-all duration-300 block",
                        isActive
                          ? "text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeNavBg"
                          className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-xl"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                      <span className="relative z-10">{item.shortLabel}</span>
                    </a>
                  </motion.div>
                );
              })}
            </nav>

            {/* Separator */}
            <div className="hidden lg:block w-px h-6 bg-border/50 mx-1" />

            {/* Action buttons */}
            <div className="hidden lg:flex items-center gap-1">
              <UnderTheHoodToggle />
              <ThemeToggle />
              <a
                href="/home#contact"
                onClick={(e) => handleNavClick(e, '/home#contact')}
                className="hidden xl:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-medium shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 hover:scale-[1.02]"
              >
                <Mail className="h-3.5 w-3.5" />
                Hire Me
              </a>
            </div>

            {/* Mobile controls */}
            <div className="flex items-center gap-1.5 lg:hidden ml-auto">
              <UnderTheHoodToggle />
              <ThemeToggle />
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] transition-colors"
              >
                <AnimatePresence mode="wait">
                  {isMobileMenuOpen ? (
                    <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                      <X className="h-5 w-5" />
                    </motion.div>
                  ) : (
                    <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                      <Menu className="h-5 w-5" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>
        </motion.header>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 top-0 z-40 bg-background/98 backdrop-blur-xl lg:hidden"
          >
            <motion.nav
              variants={mobileMenuVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="container pt-24 pb-8"
            >
              <ul className="space-y-2">
                {navItems.map((item) => {
                  const isActive = activeSection === item.href.split('#')[1];
                  return (
                    <motion.li key={item.label} variants={mobileItemVariants}>
                      <a
                        href={item.href}
                        onClick={(e) => handleNavClick(e, item.href)}
                        className={cn(
                          "w-full flex justify-between items-center text-lg font-medium rounded-xl py-4 px-4 transition-colors",
                          isActive
                            ? "bg-gradient-to-r from-primary/10 to-accent/10 text-primary"
                            : "text-foreground hover:bg-secondary/50"
                        )}
                      >
                        <span>{item.label}</span>
                        <ChevronRight className={cn("h-5 w-5 transition-transform", isActive && "text-primary")} />
                      </a>
                    </motion.li>
                  );
                })}
              </ul>

              <motion.div variants={mobileItemVariants} className="mt-8 space-y-3">
                <a
                  href="/home#contact"
                  onClick={(e) => handleNavClick(e, '/home#contact')}
                  className="w-full flex items-center justify-center gap-2 btn-premium py-4 text-lg rounded-xl"
                >
                  <Mail className="h-5 w-5" />
                  Get In Touch
                </a>
                <ResumeViewer className="w-full">
                  <Button variant="outline" className="w-full py-6 text-lg border-primary/50">
                    <Download className="h-5 w-5 mr-2" />
                    View / Download Resume
                  </Button>
                </ResumeViewer>
              </motion.div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

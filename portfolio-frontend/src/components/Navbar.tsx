import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Menu, X, ChevronRight, Download, Mail } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

const navItems = [
  { label: 'Home', href: '/home', shortLabel: 'Home' },
  { label: 'About', href: '/home#about', shortLabel: 'About' },
  { label: 'Skills', href: '/home#skills', shortLabel: 'Skills' },
  { label: 'Education', href: '/home#education', shortLabel: 'Edu' },
  { label: 'Experience', href: '/home#experience', shortLabel: 'Work' },
  { label: 'Projects', href: '/home#projects', shortLabel: 'Projects' },
  { label: 'Contact', href: '/home#contact', shortLabel: 'Contact' },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [scrollProgress, setScrollProgress] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);

      // Calculate scroll progress
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      setScrollProgress(scrolled);

      // Update active section based on scroll position
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

  const scrollToSection = (sectionId: string) => {
    setIsMobileMenuOpen(false);
    if (!sectionId.includes('#')) return;

    const id = sectionId.split('#')[1];
    const element = document.getElementById(id);
    if (element) {
      // Use scrollIntoView with block: 'start' and let CSS scroll-margin-top handle the offset
      // This works better with the CSS scroll-margin-top: 80px we have on sections
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
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
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
          isScrolled
            ? 'bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg py-2'
            : 'bg-transparent py-4'
        )}
      >
        {/* Scroll progress bar */}
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-primary via-accent to-primary"
          style={{ width: `${scrollProgress}%` }}
        />

        <div className="container flex items-center justify-between">
          {/* Logo with animation */}
          <Link
            to="/home"
            className="relative group"
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center"
            >
              {/* Logo icon */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mr-3 shadow-lg group-hover:scale-110 transition-transform duration-300">
                <span className="text-white font-bold text-lg">HS</span>
              </div>

              {/* Name with gradient */}
              <div className="hidden sm:block">
                <span className="text-xl font-bold gradient-text group-hover:opacity-80 transition-opacity">
                  Harshith
                </span>
                <span className="text-xl font-light text-foreground/70">
                  Siddardha
                </span>
              </div>
            </motion.div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            <nav className="flex items-center bg-secondary/30 backdrop-blur-sm rounded-full p-1 mr-4 border border-border/50">
              {navItems.map((item, index) => {
                const isActive = activeSection === item.href.split('#')[1] ||
                  (item.href === '/home' && !activeSection && location.pathname === '/home');

                return (
                  <motion.div
                    key={item.label}
                    custom={index}
                    initial="hidden"
                    animate="visible"
                    variants={navVariants}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "relative text-sm font-medium rounded-full px-4 py-2 transition-all duration-300",
                        isActive
                          ? "text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => scrollToSection(item.href)}
                      asChild
                    >
                      <Link to={item.href}>
                        {/* Active indicator background */}
                        {isActive && (
                          <motion.div
                            layoutId="activeNavBg"
                            className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-full"
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                          />
                        )}
                        <span className="relative z-10">{item.shortLabel}</span>
                      </Link>
                    </Button>
                  </motion.div>
                );
              })}
            </nav>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                size="sm"
                className="btn-premium rounded-full px-4 hidden xl:flex"
                asChild
              >
                <a href="#contact">
                  <Mail className="h-4 w-4 mr-2" />
                  Hire Me
                </a>
              </Button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-3 lg:hidden">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="relative rounded-full bg-secondary/50 hover:bg-secondary"
            >
              <AnimatePresence mode="wait">
                {isMobileMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="h-5 w-5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Menu className="h-5 w-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          </div>
        </div>
      </header>

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
                {navItems.map((item, index) => {
                  const isActive = activeSection === item.href.split('#')[1];
                  return (
                    <motion.li key={item.label} variants={mobileItemVariants}>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-between text-lg font-medium rounded-xl py-6 px-4",
                          isActive
                            ? "bg-gradient-to-r from-primary/10 to-accent/10 text-primary"
                            : "text-foreground hover:bg-secondary/50"
                        )}
                        onClick={() => scrollToSection(item.href)}
                        asChild
                      >
                        <Link to={item.href}>
                          <span>{item.label}</span>
                          <ChevronRight className={cn(
                            "h-5 w-5 transition-transform",
                            isActive && "text-primary"
                          )} />
                        </Link>
                      </Button>
                    </motion.li>
                  );
                })}
              </ul>

              {/* Mobile CTA buttons */}
              <motion.div
                variants={mobileItemVariants}
                className="mt-8 space-y-3"
              >
                <Button className="w-full btn-premium py-6 text-lg" asChild>
                  <a href="#contact" onClick={() => setIsMobileMenuOpen(false)}>
                    <Mail className="h-5 w-5 mr-2" />
                    Get In Touch
                  </a>
                </Button>
                <Button variant="outline" className="w-full py-6 text-lg border-primary/50" asChild>
                  <a href="/resume.pdf" download>
                    <Download className="h-5 w-5 mr-2" />
                    Download Resume
                  </a>
                </Button>
              </motion.div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
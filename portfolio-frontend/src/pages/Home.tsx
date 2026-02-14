import Navbar from '@/components/Navbar';
import Hero from '@/components/sections/Hero';
import About from '@/components/sections/About';
import Skills from '@/components/sections/Skills';
import Education from '@/components/sections/Education';
import Experience from '@/components/sections/Experience';
import Projects from '@/components/sections/Projects';
import Contact from '@/components/sections/Contact';
import Footer from '@/components/Footer';
import FloatingFormPrompt from '@/components/FloatingFormPrompt';
import VisitorGlobe from '@/components/VisitorGlobe';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';
import { useSectionTimeTracking } from '@/hooks/useSectionTimeTracking';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';



export default function Home() {
  const location = useLocation();

  // Track visitor on home page load (captures even skipped users)
  useVisitorTracking('home');
  // Track time spent in each section for analytics
  useSectionTimeTracking();

  // Handle hash-based scroll on mount (e.g., /home#projects from architecture page)
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      // Small delay to ensure DOM is rendered
      const timer = setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
        {/* Hero section now includes the recruiter panel (role search + visitor showcase) */}
        <Hero />

        <About />
        <Skills />
        <Education />
        <Experience />
        <Projects />
        <Contact />
      </main>

      <Footer />
      <FloatingFormPrompt />
      <VisitorGlobe />
    </div>
  );
}
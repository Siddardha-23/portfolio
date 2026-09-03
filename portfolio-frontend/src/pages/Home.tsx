import Navbar from '@/components/Navbar';
import Hero from '@/components/sections/Hero';
import About from '@/components/sections/About';
import Skills from '@/components/sections/Skills';
import Education from '@/components/sections/Education';
import Experience from '@/components/sections/Experience';
import Contributions from '@/components/sections/Contributions';
import Spotlight from '@/components/sections/Spotlight';
import Projects from '@/components/sections/Projects';
import Contact from '@/components/sections/Contact';
import Footer from '@/components/Footer';
import FloatingFormPrompt from '@/components/FloatingFormPrompt';
import BuilderAgent from '@/components/agent/BuilderAgent';
import NowBuildingTicker from '@/components/NowBuildingTicker';
import ConciergeRoot from '@/components/concierge/ConciergeRoot';
import AspirelyCallout from '@/components/sunset/AspirelyCallout';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';
import { useSectionTimeTracking } from '@/hooks/useSectionTimeTracking';
import { lazy, Suspense, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Both globe surfaces pull in three.js, so they stay behind lazy boundaries.
// GlobeSection renders on scroll; VisitorGlobe only mounts its renderer on open.
const GlobeSection = lazy(() => import('@/components/sections/GlobeSection'));
const VisitorGlobe = lazy(() => import('@/components/VisitorGlobe'));

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

    // Ensure fresh landing on Home starts at the top.
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
        {/* Hero section now includes the recruiter panel (role search + visitor showcase) */}
        <Hero />

        {/* Live "Now Building" ticker — auto-updates from GitHub via the Cloud Diary */}
        <NowBuildingTicker />

        <About />
        <Skills />
        <Education />
        <Experience />

        {/* Engineering contributions — architecture and decisions behind the
            last year of work. Sits between Experience and Projects. */}
        <Contributions />

        {/* Current work, and the strongest material on the page — so it lands
            straight after the roles rather than at the end of the archive. */}
        <Spotlight />

        <Projects />
        {/* Sits after Projects because the Resume Tailor IS one of the projects
            shown above — the "it graduated to aspirely.me" note reads as the
            next beat of that story rather than an interruption. */}
        <AspirelyCallout />

        {/* Visitor globe: proof of reach, sitting between the work and the ask. */}
        <Suspense fallback={<div className="h-[520px]" />}>
          <GlobeSection />
        </Suspense>

        <Contact />
      </main>

      <Footer />
      <FloatingFormPrompt />
      <BuilderAgent />
      <ConciergeRoot />
      <Suspense fallback={null}>
        <VisitorGlobe />
      </Suspense>
    </div>
  );
}

import Navbar from '@/components/Navbar';
import Hero from '@/components/sections/Hero';
import About from '@/components/sections/About';
import Skills from '@/components/sections/Skills';
import Education from '@/components/sections/Education';
import Experience from '@/components/sections/Experience';
import Projects from '@/components/sections/Projects';
import Contact from '@/components/sections/Contact';
import Footer from '@/components/Footer';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';


export default function Home() {
  // Track visitor on home page load (captures even skipped users)
  useVisitorTracking('home');

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
    </div>
  );
}
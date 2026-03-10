import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense, useState, useCallback, useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './components/theme-provider';
import { UnderTheHoodProvider } from './contexts/UnderTheHoodContext';
import UnderTheHoodDrawer from './components/UnderTheHoodDrawer';
import Welcome from './pages/Welcome';
import Home from './pages/Home';
import ProjectArchitecture from './pages/ProjectArchitecture';
import NotFound from './pages/NotFound';
import { useKonamiCode } from './components/DeployRunner';

const JobSearch = lazy(() => import('./pages/JobSearch'));
const ResumeParser = lazy(() => import('./pages/ResumeParser'));
const DeployRunner = lazy(() => import('./components/DeployRunner'));

const queryClient = new QueryClient();

// Inner component that can use hooks
function AppContent() {
  const [showGame, setShowGame] = useState(false);

  const openGame = useCallback(() => {
    setShowGame(true);
  }, []);

  useKonamiCode(openGame);

  // Also listen for custom event from footer gamepad button
  useEffect(() => {
    const handler = () => setShowGame(true);
    window.addEventListener('open-deploy-runner', handler);
    return () => window.removeEventListener('open-deploy-runner', handler);
  }, []);

  return (
    <>
      <Toaster />
      <UnderTheHoodDrawer />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/home" element={<Home />} />
          <Route path="/project/:slug" element={<ProjectArchitecture />} />
          <Route path="/job-search" element={<Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}><JobSearch /></Suspense>} />
          <Route path="/resume-parser" element={<Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}><ResumeParser /></Suspense>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>

      {/* Easter Egg: Deploy Runner Game (Konami Code) */}
      <Suspense fallback={null}>
        <DeployRunner isOpen={showGame} onClose={() => setShowGame(false)} />
      </Suspense>
    </>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system">
        <UnderTheHoodProvider>
          <TooltipProvider>
            <AppContent />
          </TooltipProvider>
        </UnderTheHoodProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;


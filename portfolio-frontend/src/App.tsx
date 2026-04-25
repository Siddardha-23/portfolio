import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense, useState, useCallback, useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './components/theme-provider';
import { UnderTheHoodProvider } from './contexts/UnderTheHoodContext';
import { AuthProvider } from './contexts/AuthContext';
import UnderTheHoodDrawer from './components/UnderTheHoodDrawer';
import Welcome from './pages/Welcome';
import Home from './pages/Home';
import ProjectArchitecture from './pages/ProjectArchitecture';
import NotFound from './pages/NotFound';
import { useKonamiCode } from './components/DeployRunner';

const ResumeParser = lazy(() => import('./pages/ResumeParser'));
const DeployRunner = lazy(() => import('./components/DeployRunner'));
const CloudLab = lazy(() => import('./pages/CloudLab'));
const AdminPortal = lazy(() => import('./pages/AdminPortal'));

const queryClient = new QueryClient();

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" aria-live="polite">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span>Loading workspace...</span>
      </div>
    </div>
  );
}

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
          <Route path="/cloud-lab" element={<Suspense fallback={<RouteLoadingFallback />}><CloudLab /></Suspense>} />
          <Route path="/project/:slug" element={<ProjectArchitecture />} />
          <Route path="/resume-parser" element={<Suspense fallback={<RouteLoadingFallback />}><ResumeParser /></Suspense>} />
          <Route path="/admin" element={<Suspense fallback={<RouteLoadingFallback />}><AdminPortal /></Suspense>} />
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
        <AuthProvider>
          <UnderTheHoodProvider>
            <TooltipProvider>
              <AppContent />
            </TooltipProvider>
          </UnderTheHoodProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;


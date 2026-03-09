import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './components/theme-provider';
import { UnderTheHoodProvider } from './contexts/UnderTheHoodContext';
import UnderTheHoodDrawer from './components/UnderTheHoodDrawer';
import Welcome from './pages/Welcome';
import Home from './pages/Home';
import ProjectArchitecture from './pages/ProjectArchitecture';
import NotFound from './pages/NotFound';

const JobSearch = lazy(() => import('./pages/JobSearch'));
const ResumeParser = lazy(() => import('./pages/ResumeParser'));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system">
        <UnderTheHoodProvider>
          <TooltipProvider>
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
          </TooltipProvider>
        </UnderTheHoodProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

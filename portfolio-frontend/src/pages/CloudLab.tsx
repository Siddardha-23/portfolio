import { useState, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import {
  GitBranch, Globe, Shield, DollarSign, Target, HeartPulse, BarChart3, Cloud, Server, ChevronLeft, Play, LineChart
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DeployBadge from '@/components/DeployBadge';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';

const SectionAnalytics = lazy(() => import('@/components/SectionAnalytics'));
const GitTimeline = lazy(() => import('@/components/GitTimeline'));
const EdgeLatencyTester = lazy(() => import('@/components/EdgeLatencyTester'));
const SecurityScorecard = lazy(() => import('@/components/SecurityScorecard'));
const InfraCostCalculator = lazy(() => import('@/components/InfraCostCalculator'));
const RecruiterMatch = lazy(() => import('@/components/RecruiterMatch'));
const InfraHealthDashboard = lazy(() => import('@/components/InfraHealthDashboard'));
const SandboxDeployer = lazy(() => import('@/components/SandboxDeployer'));

function ModalLoadingFallback() {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[min(560px,92vw)] rounded-2xl border border-border/60 bg-background/95 p-6 shadow-2xl">
        <div className="space-y-3 animate-pulse">
          <div className="h-5 w-40 rounded bg-secondary/60" />
          <div className="h-4 w-64 rounded bg-secondary/40" />
          <div className="h-40 rounded-xl bg-secondary/40" />
          <div className="h-10 rounded-lg bg-secondary/40" />
        </div>
      </div>
    </div>
  );
}

export default function CloudLab() {
  useVisitorTracking('cloud-lab');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showLatency, setShowLatency] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showCosts, setShowCosts] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);

  const hoverShadowClass: Record<string, string> = {
    primary: 'hover:shadow-primary/10',
    'violet-500': 'hover:shadow-violet-500/10',
    'emerald-500': 'hover:shadow-emerald-500/10',
    'rose-500': 'hover:shadow-rose-500/10',
    'green-500': 'hover:shadow-green-500/10',
    'blue-500': 'hover:shadow-blue-500/10',
    'orange-500': 'hover:shadow-orange-500/10',
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-16">
        <div className="container px-4 md:px-6">
          <Link to="/home" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Home
          </Link>

          <div className="mb-12 text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mb-6">
              <Cloud className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="gradient-text">Cloud Lab</span> & Interactive Demo
            </h1>
            <p className="text-lg text-muted-foreground">
              Deep dive into the infrastructure that powers this portfolio. Explore real-time AWS integrations, edge performance testing, and live infrastructure costs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
            {([
              {
                icon: BarChart3,
                label: 'Analytics',
                desc: 'Engagement data',
                badge: 'Beta',
                gradient: 'from-primary to-accent',
                glow: 'primary',
                iconColor: 'text-primary',
                onClick: () => setShowAnalytics(true),
              },
              {
                icon: GitBranch,
                label: 'Build Journey',
                desc: 'Git commit story',
                badge: 'Live',
                gradient: 'from-violet-500 to-purple-500',
                glow: 'violet-500',
                iconColor: 'text-violet-500',
                onClick: () => setShowTimeline(true),
              },
              {
                icon: Globe,
                label: 'Edge Latency',
                desc: 'CDN performance',
                badge: 'CDN',
                gradient: 'from-emerald-500 to-cyan-500',
                glow: 'emerald-500',
                iconColor: 'text-emerald-500',
                onClick: () => setShowLatency(true),
              },
              {
                icon: Shield,
                label: 'Security Scan',
                desc: 'Headers audit',
                badge: 'Live',
                gradient: 'from-rose-500 to-amber-500',
                glow: 'rose-500',
                iconColor: 'text-rose-500',
                onClick: () => setShowSecurity(true),
              },
              {
                icon: DollarSign,
                label: 'Infra Costs',
                desc: 'Real AWS pricing',
                badge: 'Real',
                gradient: 'from-green-500 to-emerald-600',
                glow: 'green-500',
                iconColor: 'text-green-500',
                onClick: () => setShowCosts(true),
              },
              {
                icon: Target,
                label: 'JD Match',
                desc: 'Skill radar chart',
                badge: 'AI',
                gradient: 'from-violet-500 to-blue-600',
                glow: 'violet-500',
                iconColor: 'text-violet-500',
                onClick: () => setShowMatch(true),
              },
              {
                icon: HeartPulse,
                label: 'Infra Health',
                desc: 'Live status check',
                badge: 'Live',
                gradient: 'from-blue-500 to-cyan-500',
                glow: 'blue-500',
                iconColor: 'text-blue-500',
                onClick: () => setShowHealth(true),
              },
              {
                icon: Play,
                label: 'Deploy Pipeline',
                desc: 'Interactive CI/CD',
                badge: 'Live',
                gradient: 'from-orange-500 to-rose-600',
                glow: 'orange-500',
                iconColor: 'text-orange-500',
                onClick: () => setShowSandbox(true),
              },
              {
                icon: LineChart,
                label: 'Grafana Metrics',
                desc: 'Live infra dashboard ↗',
                badge: 'Live',
                gradient: 'from-emerald-500 to-teal-500',
                glow: 'emerald-500',
                iconColor: 'text-emerald-500',
                onClick: () => window.open('https://grafana.manneharshithsiddardha.com', '_blank', 'noopener,noreferrer'),
              },
            ] as const).map((item, i) => (
              <motion.button
                key={item.label}
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}
                onClick={item.onClick}
                className={`relative group bg-secondary/20 backdrop-blur-md rounded-xl p-4 md:p-6 border border-border/50 hover:border-border overflow-hidden text-left transition-all duration-200 hover:shadow-md ${hoverShadowClass[item.glow] ?? ''}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-lg bg-secondary shadow-inner ${item.iconColor} bg-opacity-10`}>
                      <item.icon className={`h-5 w-5 ${item.iconColor}`} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground text-sm md:text-base group-hover:text-primary transition-colors">{item.label}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </div>
              </motion.button>
            ))}
          </div>

          <div className="my-16 flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Server className="h-4 w-4" />
              Deployment Status
            </h2>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="w-full">
            <DeployBadge />
          </div>

        </div>
      </main>

      <Footer />

      {/* Modals */}
      <Suspense fallback={<ModalLoadingFallback />}>
        {showTimeline && <GitTimeline isOpen={showTimeline} onClose={() => setShowTimeline(false)} />}
        {showAnalytics && <SectionAnalytics isOpen={showAnalytics} onClose={() => setShowAnalytics(false)} />}
        {showLatency && <EdgeLatencyTester isOpen={showLatency} onClose={() => setShowLatency(false)} />}
        {showSecurity && <SecurityScorecard isOpen={showSecurity} onClose={() => setShowSecurity(false)} />}
        {showCosts && <InfraCostCalculator isOpen={showCosts} onClose={() => setShowCosts(false)} />}
        {showMatch && <RecruiterMatch isOpen={showMatch} onClose={() => setShowMatch(false)} />}
        {showHealth && <InfraHealthDashboard isOpen={showHealth} onClose={() => setShowHealth(false)} />}
        {showSandbox && <SandboxDeployer isOpen={showSandbox} onClose={() => setShowSandbox(false)} />}
      </Suspense>
    </div>
  );
}

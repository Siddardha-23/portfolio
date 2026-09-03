/**
 * Contributions — a scroll-driven narrative of engineering contributions.
 *
 * Order (per brief):
 *   1. OwnershipScale        — open with the scale claim
 *   2. LiveIngestPipeline
 *   3. IsolationRings
 *   4. QueryRouterCascade    — Standup AI trio
 *   5. ExtractionAccuracy    — Valytica
 *   6. CohortDelivery        — AI Workshop
 *   7. InfratrixGraph (lazy) — Aithrex
 *   8. CupolaPlanes          — Aithrex
 *   9. SkillsTimeline        — close by tying it together
 *
 * Every block has an anchor id (set by BlockCard) so it is directly linkable.
 * The three.js InfratrixGraph is lazy-loaded behind Suspense so WebGL does not
 * block first paint. The whole section subject is the engineering contribution
 * — architecture and decisions — never product UI.
 */
import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Layers } from 'lucide-react';

import OwnershipScale from '@/components/contributions/OwnershipScale';
import LiveIngestPipeline from '@/components/contributions/LiveIngestPipeline';
import IsolationRings from '@/components/contributions/IsolationRings';
import QueryRouterCascade from '@/components/contributions/QueryRouterCascade';
import ExtractionAccuracy from '@/components/contributions/ExtractionAccuracy';
import CohortDelivery from '@/components/contributions/CohortDelivery';
import CupolaPlanes from '@/components/contributions/CupolaPlanes';
import SkillsTimeline from '@/components/contributions/SkillsTimeline';

// WebGL — kept behind a lazy boundary so three.js isn't in the first-paint bundle.
const InfratrixGraph = lazy(() => import('@/components/contributions/InfratrixGraph'));

const NAV = [
  { id: 'contrib-ownership', label: 'Ownership' },
  { id: 'contrib-ingest', label: 'Ingest pipeline' },
  { id: 'contrib-isolation', label: 'Isolation' },
  { id: 'contrib-router', label: 'Query router' },
  { id: 'contrib-accuracy', label: 'Extraction' },
  { id: 'contrib-cohort', label: 'Cohort' },
  { id: 'contrib-infratrix', label: 'Infratrix graph' },
  { id: 'contrib-cupola', label: 'Cupola' },
  { id: 'contrib-skills-timeline', label: 'Skills timeline' }
];

function GraphFallback() {
  return (
    <div className="scroll-mt-24 rounded-2xl border border-border/60 bg-card/70 p-8 shadow-lg">
      <div className="h-[360px] rounded-xl border border-border/60 bg-muted/10 flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading graph…</span>
      </div>
    </div>
  );
}

export default function Contributions() {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section id="contributions" className="py-20 md:py-28 relative overflow-hidden">
      <div className="container px-4 md:px-6 relative z-10">
        {/* header */}
        <div className="text-center mb-10 md:mb-14">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="mb-3 md:mb-4 border-primary/40 text-primary px-3 md:px-4 py-1 text-xs md:text-sm">
              <Layers className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1.5 md:mr-2" />
              Engineering Contributions
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight mb-4 text-foreground">
              The work, as architecture and decisions
            </h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto px-4">
              The pipelines designed, the isolation enforced, the routing decision that avoided cost, and the
              accuracy that moved. Not product screens — the engineering behind them.
            </p>
          </motion.div>

          {/* anchor nav */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                className="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
              >
                {n.label}
              </button>
            ))}
          </div>
        </div>

        {/* blocks */}
        <div className="space-y-6 md:space-y-8 max-w-5xl mx-auto">
          <OwnershipScale />
          <LiveIngestPipeline />
          <IsolationRings />
          <QueryRouterCascade />
          <ExtractionAccuracy />
          <CohortDelivery />
          <Suspense fallback={<GraphFallback />}>
            <InfratrixGraph />
          </Suspense>
          <CupolaPlanes />
          <SkillsTimeline />
        </div>
      </div>
    </section>
  );
}

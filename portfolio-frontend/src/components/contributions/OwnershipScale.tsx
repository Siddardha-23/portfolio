/**
 * OwnershipScale — the contribution claim for Standup AI.
 * Animated counters + a proportion bar for 813 of 821 commits.
 * Factual, restrained. All figures from the brief.
 */
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';
import { BlockCard, BlockHeader, StatCounter } from './_shared';

const COMMITS_MINE = 813;
const COMMITS_TOTAL = 821;
const PCT = (COMMITS_MINE / COMMITS_TOTAL) * 100;

const STATS: { value: number; label: string; suffix?: string }[] = [
  { value: 306, label: 'API endpoints' },
  { value: 2812, label: 'Automated tests' },
  { value: 148, label: 'K lines of backend Python', suffix: 'K' },
  { value: 16, label: 'Schema migrations' },
  { value: 239, label: 'Frontend components' }
];

export default function OwnershipScale() {
  const barRef = useRef<HTMLDivElement>(null);
  const inView = useInView(barRef, { once: true, margin: '-40px' });
  const reduceMotion = useReducedMotion();

  return (
    <BlockCard id="contrib-ownership">
      <BlockHeader
        eyebrow="Standup AI · contribution"
        title="Sole engineer, built and operated end to end"
        blurb="A multi-tenant meeting intelligence SaaS in production, designed, built and run by one engineer."
      />

      {/* Commit proportion */}
      <div className="mb-8">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm text-muted-foreground">Commits authored</span>
          <span className="text-sm font-semibold text-foreground tabular-nums">
            813 of 821
          </span>
        </div>
        <div
          ref={barRef}
          className="relative h-4 w-full rounded-full bg-muted/40 overflow-hidden border border-border/50"
          role="img"
          aria-label="813 of 821 commits authored"
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))' }}
            initial={reduceMotion ? false : { width: 0 }}
            animate={inView || reduceMotion ? { width: `${PCT}%` } : { width: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          />
        </div>
        <div className="mt-1 text-xs text-muted-foreground tabular-nums">{PCT.toFixed(1)}% of all commits</div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
        {STATS.map((s) => (
          <StatCounter key={s.label} value={s.value} suffix={s.suffix} label={s.label} />
        ))}
      </div>
    </BlockCard>
  );
}

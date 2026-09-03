/**
 * SkillsTimeline — skills gained over time.
 * Rows are skill clusters; columns are periods from Jan 2021 to now. Cells
 * shade by depth (0 = not yet, up to 4 = deep), so the viewer sees when each
 * capability entered the stack and where it deepened. The four employers are
 * marked as milestones along the axis. Reduced motion => cells appear at once.
 */
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';
import { BlockCard, BlockHeader, ScrollableDiagram } from './_shared';

// Period columns (half-year buckets, Jan 2021 → 2026 present).
const PERIODS = ['H1 21', 'H2 21', 'H1 22', 'H2 22', 'H1 23', 'H2 23', 'H1 24', 'H2 24', 'H1 25', 'H2 25', 'H1 26', 'Now'];

// Depth 0..4 per cluster per period. Reflects the resume arc: DevOps/cloud
// early at Deep Algorithms, backend broadening, AI/LLM + security deepening at
// Gnanalytica in the last year, frontend throughout the portfolio + product work.
type Row = { cluster: string; depth: number[] };
const ROWS: Row[] = [
  { cluster: 'Cloud & Infra', depth: [1, 2, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4] },
  { cluster: 'Backend', depth: [1, 1, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4] },
  { cluster: 'AI & LLM', depth: [0, 0, 0, 0, 1, 1, 1, 2, 3, 4, 4, 4] },
  { cluster: 'Security & Compliance', depth: [0, 0, 1, 1, 1, 2, 2, 2, 3, 4, 4, 4] },
  { cluster: 'Frontend', depth: [0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4] }
];

// Employer milestones: label + column index where they begin.
const MILESTONES: { label: string; col: number }[] = [
  { label: 'Deep Algorithms (intern)', col: 0 },
  { label: 'Deep Algorithms (Cloud & DevOps)', col: 4 },
  { label: 'Gnanalytica (intern)', col: 9 },
  { label: 'Gnanalytica (SWE)', col: 10 }
];

const CELL = 30;
const GAP = 4;
const LABEL_W = 150;

function depthColor(d: number) {
  if (d <= 0) return 'hsl(var(--muted) / 0.5)';
  // Blend from border-ish to full primary by depth.
  const alpha = 0.18 + d * 0.205; // 0.385 .. 0.995
  return `hsl(var(--primary) / ${alpha.toFixed(3)})`;
}

export default function SkillsTimeline() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  const gridWidth = LABEL_W + PERIODS.length * (CELL + GAP);

  return (
    <BlockCard id="contrib-skills-timeline">
      <BlockHeader
        eyebrow="Timeline · capabilities"
        title="Skills gained over time"
        blurb="From January 2021 to now. Darker cells mean deeper. You can read at a glance when each capability entered the stack and where it deepened."
      />

      <div ref={ref}>
        <ScrollableDiagram minWidth={gridWidth}>
          <div style={{ width: gridWidth }}>
            {/* period axis */}
            <div className="flex" style={{ paddingLeft: LABEL_W }}>
              {PERIODS.map((p) => (
                <div
                  key={p}
                  className="text-[10px] text-muted-foreground text-center"
                  style={{ width: CELL, marginRight: GAP }}
                >
                  {p}
                </div>
              ))}
            </div>

            {/* rows */}
            <div className="mt-1 space-y-1">
              {ROWS.map((row, ri) => (
                <div key={row.cluster} className="flex items-center">
                  <div className="text-xs font-medium text-foreground pr-2" style={{ width: LABEL_W }}>
                    {row.cluster}
                  </div>
                  {row.depth.map((d, ci) => (
                    <motion.div
                      key={ci}
                      className="rounded-[4px] border border-border/40"
                      style={{ width: CELL, height: CELL, marginRight: GAP, background: depthColor(d) }}
                      initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
                      animate={inView || reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
                      transition={{ duration: 0.3, delay: reduceMotion ? 0 : (ri * PERIODS.length + ci) * 0.012 }}
                      title={`${row.cluster} · ${PERIODS[ci]} · depth ${d}/4`}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* milestones */}
            <div className="relative mt-3" style={{ marginLeft: LABEL_W, height: 40 }}>
              {MILESTONES.map((m, i) => {
                const left = m.col * (CELL + GAP);
                return (
                  <div key={m.label} className="absolute top-0 flex flex-col items-start" style={{ left }}>
                    <div className="h-3 w-px bg-accent" />
                    <div
                      className="text-[9.5px] text-muted-foreground whitespace-nowrap"
                      style={{ transform: i % 2 === 0 ? 'translateY(0)' : 'translateY(14px)' }}
                    >
                      {m.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollableDiagram>
      </div>

      {/* depth legend */}
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((d) => (
          <span key={d} className="h-3 w-6 rounded-[3px] border border-border/40" style={{ background: depthColor(d) }} />
        ))}
        <span>Deeper</span>
      </div>
    </BlockCard>
  );
}

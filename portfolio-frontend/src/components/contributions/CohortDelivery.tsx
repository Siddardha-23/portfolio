/**
 * CohortDelivery — AI Workshop delivery.
 * 164 students across three pods (50 / 74 / 40), 6 faculty, 30 days,
 * 33 graded assignments, ~157 submissions graded per assignment.
 * The only verified end-user number in the portfolio, so it gets room.
 * Reduced motion => static bars at full height.
 */
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';
import { BlockCard, BlockHeader, StatCounter } from './_shared';

const PODS = [
  { name: 'Pod A', students: 50 },
  { name: 'Pod B', students: 74 },
  { name: 'Pod C', students: 40 }
];
const MAX = Math.max(...PODS.map((p) => p.students));

export default function CohortDelivery() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <BlockCard id="contrib-cohort">
      <BlockHeader
        eyebrow="AI Workshop · delivery"
        title="A live 164-student cohort"
        blurb="Delivered across three pods and six faculty over a 30-day curriculum. Honest end-user numbers, not projections."
      />

      <div className="grid md:grid-cols-[280px_1fr] gap-8 items-center">
        {/* pods bar chart */}
        <div ref={ref}>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Students per pod
          </div>
          <div className="flex items-end gap-4 h-40">
            {PODS.map((pod, i) => {
              const h = (pod.students / MAX) * 100;
              return (
                <div key={pod.name} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-sm font-bold text-foreground tabular-nums mb-1">{pod.students}</span>
                  {/* full-height track; the fill is scaled (transform only) to the pod ratio */}
                  <div className="relative w-full flex-1">
                    <motion.div
                      className="absolute bottom-0 inset-x-0 top-0 rounded-t-md"
                      style={{
                        background: 'linear-gradient(180deg, hsl(var(--primary)), hsl(var(--accent)))',
                        transformOrigin: 'bottom'
                      }}
                      initial={reduceMotion ? false : { scaleY: 0 }}
                      animate={inView || reduceMotion ? { scaleY: h / 100 } : { scaleY: 0 }}
                      transition={{ duration: 0.7, delay: i * 0.12, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="mt-2 text-xs text-muted-foreground">{pod.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* stat grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
          <StatCounter value={164} label="Students served" />
          <StatCounter value={3} label="Pods" />
          <StatCounter value={6} label="Faculty" />
          <StatCounter value={30} label="Day curriculum" />
          <StatCounter value={33} label="Graded assignments" />
          <StatCounter value={157} prefix="~" label="Submissions graded / assignment" />
        </div>
      </div>
    </BlockCard>
  );
}

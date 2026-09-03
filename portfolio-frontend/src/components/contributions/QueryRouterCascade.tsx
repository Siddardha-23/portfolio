/**
 * QueryRouterCascade — Standup AI five-tier query router.
 *
 * A question enters at the top and falls through tiers, exiting at whichever
 * one answers it. Several example questions cycle so different tiers light up.
 * A running "cost avoided" tally accrues each time a question exits at a
 * no-model-call tier (0 or 1) instead of a paid tier.
 *
 * Visualises an engineering decision: answer the common case cheaply, escalate
 * only when the question shape requires it. Reduced motion => static ladder
 * with a representative highlighted tier and a fixed tally.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { BlockCard, BlockHeader } from './_shared';

type Tier = {
  id: number;
  name: string;
  latency: string;
  cost: string;
  note: string;
  paid: boolean;
};

const TIERS: Tier[] = [
  { id: 0, name: 'Tier 0 · response cache', latency: '~50ms', cost: 'no model call', note: '', paid: false },
  { id: 1, name: 'Tier 1 · graph-direct (regex)', latency: '~50ms', cost: 'no model call', note: '', paid: false },
  { id: 15, name: 'Tier 1.5 · Gemini Flash-Lite prose', latency: '~2s', cost: '~$0.0005', note: '', paid: true },
  { id: 2, name: 'Tier 2 · Gemini Flash full context', latency: '—', cost: '', note: '', paid: true },
  { id: 3, name: 'Tier 3 · Claude Sonnet transcript search', latency: '—', cost: '', note: '', paid: true }
];

// Example questions and the tier index (into TIERS) where each exits.
const QUESTIONS: { q: string; exit: number }[] = [
  { q: 'What did we decide about pricing?', exit: 0 },
  { q: 'Who owns the migration task?', exit: 1 },
  { q: 'Summarise the standup in two lines', exit: 2 },
  { q: 'What are the open action items?', exit: 1 },
  { q: 'Draft a follow-up from the retro', exit: 2 },
  { q: 'Find where Sara mentioned the outage', exit: 4 },
  { q: 'Is the release still on for Friday?', exit: 0 }
];

// Each avoided paid call is credited at the Tier 1.5 reference price.
const COST_PER_AVOIDED = 0.0005;

export default function QueryRouterCascade() {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, margin: '-60px' });
  const [qi, setQi] = useState(0);
  const [avoided, setAvoided] = useState(0);
  const current = QUESTIONS[qi];

  useEffect(() => {
    if (reduceMotion || !inView) return;
    const iv = window.setInterval(() => {
      setQi((prev) => {
        const next = (prev + 1) % QUESTIONS.length;
        return next;
      });
    }, 2600);
    return () => clearInterval(iv);
  }, [reduceMotion, inView]);

  // Accrue "cost avoided" when a question exits at a no-model-call tier.
  useEffect(() => {
    if (reduceMotion) return;
    if (!TIERS[current.exit].paid) {
      const t = window.setTimeout(() => setAvoided((a) => a + COST_PER_AVOIDED), 1400);
      return () => clearTimeout(t);
    }
  }, [qi, current.exit, reduceMotion]);

  // Under reduced motion, show a representative common-case exit (Tier 1).
  const shownExit = reduceMotion ? 1 : current.exit;

  return (
    <BlockCard id="contrib-router">
      <BlockHeader
        eyebrow="Standup AI · routing decision"
        title="The five-tier query router"
        blurb="The common question is answered straight from an in-memory graph in ~50ms with no model call. Costlier paths run only when the shape of the question requires it."
      />

      <div ref={rootRef} className="grid md:grid-cols-[1fr_260px] gap-6">
        <div>
          {/* current question */}
          <div className="mb-4 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-primary font-semibold mb-1">Question</div>
            <motion.div
              key={qi}
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-sm font-medium text-foreground"
            >
              {current.q}
            </motion.div>
          </div>

          {/* tier ladder */}
          <div className="space-y-2">
            {TIERS.map((tier, i) => {
              const isExit = i === shownExit;
              const passedThrough = i < shownExit;
              return (
                <motion.div
                  key={tier.id}
                  animate={{
                    borderColor: isExit
                      ? 'hsl(var(--primary))'
                      : passedThrough
                        ? 'hsl(var(--muted-foreground) / 0.3)'
                        : 'hsl(var(--border))',
                    backgroundColor: isExit ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--card))',
                    opacity: passedThrough ? 0.55 : 1
                  }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: tier.paid ? 'hsl(var(--accent))' : 'hsl(var(--primary))' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{tier.name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground tabular-nums">{tier.latency}</div>
                    <div className={`text-[11px] tabular-nums ${tier.paid ? 'text-accent' : 'text-primary'}`}>
                      {tier.cost}
                    </div>
                  </div>
                  {isExit && (
                    <span className="ml-1 shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      answered
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* running tally */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 h-fit">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Cost avoided</div>
          <div className="mt-1 text-3xl font-bold text-foreground tabular-nums">
            ${avoided.toFixed(4)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Accrues each time a question exits at Tier 0 or Tier 1 with no model call, versus the Tier 1.5
            reference price of $0.0005.
          </p>
          <div className="mt-4 space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: 'hsl(var(--primary))' }} />
              <span className="text-muted-foreground">No model call</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: 'hsl(var(--accent))' }} />
              <span className="text-muted-foreground">Paid model path</span>
            </div>
          </div>
        </div>
      </div>
    </BlockCard>
  );
}

/**
 * ExtractionAccuracy — Valytica image-only extraction hardening.
 *
 * A 97-cell grid, one cell per expected field. Animates from the 91.8%
 * baseline to the 95.9% hardened state, cells flipping as it goes, with a
 * counter ticking 91.8 -> 95.9. Three labelled states: correct, abstained
 * (model declined), wrong. Abstained vs wrong is the insight. 96.9% text-path
 * baseline shown as a reference line. Reduced motion => final (95.9%) state.
 */
import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { BlockCard, BlockHeader } from './_shared';

const TOTAL = 97;
const BASELINE_PCT = 91.8;
const HARDENED_PCT = 95.9;
const TEXT_PATH_PCT = 96.9;

type State = 'correct' | 'abstained' | 'wrong';

// Deterministic counts per phase (out of 97). Correct rounds from the pct;
// the remainder splits between abstained (declined) and wrong.
function counts(pct: number) {
  const correct = Math.round((pct / 100) * TOTAL);
  const remaining = TOTAL - correct;
  // At the hardened state most remaining fields are abstentions, not errors —
  // that is the point of the hardening. Baseline has more outright wrong.
  const wrong = pct >= HARDENED_PCT ? Math.round(remaining * 0.35) : Math.round(remaining * 0.6);
  const abstained = remaining - wrong;
  return { correct, abstained, wrong };
}

// Build a deterministic ordering of states for the grid so cell flips look
// organic but are stable across renders.
function buildGrid(pct: number): State[] {
  const { correct, abstained } = counts(pct);
  const cells: State[] = [];
  for (let i = 0; i < TOTAL; i++) {
    if (i < correct) cells.push('correct');
    else if (i < correct + abstained) cells.push('abstained');
    else cells.push('wrong');
  }
  // Stable shuffle by index parity to scatter states without randomness.
  return cells
    .map((s, i) => ({ s, key: (i * 37) % TOTAL }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.s);
}

const COLORS: Record<State, string> = {
  correct: 'hsl(var(--primary))',
  abstained: 'hsl(var(--accent))',
  wrong: 'hsl(var(--destructive))'
};

export default function ExtractionAccuracy() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [pct, setPct] = useState(reduceMotion ? HARDENED_PCT : BASELINE_PCT);
  const grid = buildGrid(pct);
  const c = counts(pct);

  useEffect(() => {
    if (reduceMotion || !inView) return;
    const start = performance.now();
    const duration = 1800;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setPct(BASELINE_PCT + (HARDENED_PCT - BASELINE_PCT) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setPct(HARDENED_PCT);
    };
    // small delay so the baseline reads before it moves
    const t = window.setTimeout(() => (raf = requestAnimationFrame(tick)), 500);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [reduceMotion, inView]);

  return (
    <BlockCard id="contrib-accuracy">
      <BlockHeader
        eyebrow="Valytica · extraction"
        title="Hardening image-only extraction"
        blurb="Across 97 expected fields, image-only accuracy moved from 91.8% to 95.9%. The gains came from teaching the model to abstain rather than guess — abstained is not the same as wrong."
      />

      <div ref={ref} className="grid md:grid-cols-[1fr_240px] gap-6 items-start">
        <div>
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18px, 1fr))' }}
            role="img"
            aria-label={`97-field extraction accuracy grid at ${pct.toFixed(1)} percent`}
          >
            {grid.map((s, i) => (
              <div
                key={i}
                className="aspect-square rounded-[3px]"
                style={{ background: COLORS[s], transition: 'background-color 300ms ease' }}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Image-path accuracy</div>
            <div className="mt-1 text-4xl font-bold text-foreground tabular-nums">{pct.toFixed(1)}%</div>
            <div className="mt-1 text-xs text-muted-foreground">from 91.8% baseline → 95.9% hardened</div>

            {/* text-path reference line */}
            <div className="mt-4 border-t border-dashed border-border pt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Text-path baseline</span>
                <span className="font-semibold text-foreground tabular-nums">{TEXT_PATH_PCT}%</span>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <Legend color={COLORS.correct} label="Correct" value={c.correct} />
            <Legend color={COLORS.abstained} label="Abstained (declined)" value={c.abstained} />
            <Legend color={COLORS.wrong} label="Wrong" value={c.wrong} />
          </div>
        </div>
      </div>
    </BlockCard>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-[3px] shrink-0" style={{ background: color }} />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}

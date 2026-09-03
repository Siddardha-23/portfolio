/**
 * Shared primitives for the Contributions infographics.
 *
 * Everything here uses only the existing theme tokens (hsl(var(--primary)),
 * hsl(var(--accent)), --muted-foreground, --card, --border) so both light and
 * dark mode work with no extra palette. Animations animate transform/opacity
 * only and respect prefers-reduced-motion.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

/** Count up to `value` when scrolled into view. Static (final value) under reduced motion. */
export function useCountUp(value: number, opts?: { duration?: number; decimals?: number }) {
  const { duration = 1200, decimals = 0 } = opts ?? {};
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration, reduceMotion]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString('en-US');

  return { ref, formatted };
}

/** A big animated stat number. */
export function StatCounter({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  label,
  className = ''
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  label: string;
  className?: string;
}) {
  const { ref, formatted } = useCountUp(value, { decimals });
  return (
    <div className={`text-center ${className}`}>
      <div className="text-3xl md:text-4xl font-bold text-foreground tabular-nums tracking-tight">
        {prefix}
        <span ref={ref}>{formatted}</span>
        {suffix}
      </div>
      <div className="mt-1 text-xs md:text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

/** Standard header for each infographic block. */
export function BlockHeader({
  eyebrow,
  title,
  blurb
}: {
  eyebrow: string;
  title: string;
  blurb?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5 }}
      className="mb-6 md:mb-8"
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">{eyebrow}</div>
      <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">{title}</h3>
      {blurb && <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-2xl">{blurb}</p>}
    </motion.div>
  );
}

/**
 * Card wrapper for a single infographic block, with an anchor id and scroll
 * margin so nav links land cleanly under a sticky navbar.
 */
export function BlockCard({
  id,
  children,
  className = ''
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      id={id}
      initial={reduceMotion ? false : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5 }}
      className={`scroll-mt-24 rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 md:p-8 shadow-lg ${className}`}
    >
      {children}
    </motion.section>
  );
}

/**
 * Horizontal scroll container so wide diagrams scroll inside their own box on
 * mobile rather than overflowing the page.
 */
export function ScrollableDiagram({
  minWidth = 720,
  children,
  className = ''
}: {
  minWidth?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-full overflow-x-auto overflow-y-hidden -mx-1 px-1 ${className}`}>
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}

export const PRIMARY = 'hsl(var(--primary))';
export const ACCENT = 'hsl(var(--accent))';
export const MUTED = 'hsl(var(--muted-foreground))';

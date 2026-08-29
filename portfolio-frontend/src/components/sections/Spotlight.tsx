/**
 * Spotlight — volunteer engineering at Gnanalytica, presented as two systems.
 *
 * The charts carry the argument and the prose stays short: a commit-mix bar, a
 * "where the work landed" chart and an ownership readout say more about what the
 * contribution actually was than another paragraph would. Every number comes from
 * the repositories — see the counting commands in lib/spotlight.ts.
 *
 * Follows the light/dark toggle like the rest of the page: surfaces use theme
 * tokens, and each system's accent has a light and a dark value because the dark
 * one is unreadable on a pale ground.
 */
import { useMemo, useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { CAPABILITY_PILLARS, SPOTLIGHT_INTRO, SPOTLIGHT_SYSTEMS } from '@/lib/spotlight';
import type { SpotlightSystem } from '@/lib/spotlight';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Hairline label used above every block. */
function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
    return (
        <div
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
            style={color ? { color } : undefined}
        >
            {children}
        </div>
    );
}

/**
 * Segmented bar of commit types.
 *
 * One accent stepped down in opacity rather than six different hues: the shares
 * stay comparable at a glance and it cannot clash with either theme.
 */
function CommitMix({ system, accent }: { system: SpotlightSystem; accent: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: '-40px' });

    const total = useMemo(
        () => system.commitMix.reduce((sum, s) => sum + s.value, 0),
        [system.commitMix]
    );

    const opacities = [1, 0.78, 0.58, 0.42, 0.28, 0.17];

    return (
        <div ref={ref}>
            <div className="flex items-baseline justify-between">
                <Eyebrow>Commit mix</Eyebrow>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {total}
                </span>
            </div>

            <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-muted">
                {system.commitMix.map((seg, i) => (
                    <motion.div
                        key={seg.label}
                        className="h-full"
                        style={{ background: accent, opacity: opacities[i] ?? 0.12 }}
                        initial={{ width: 0 }}
                        animate={inView ? { width: `${(seg.value / total) * 100}%` } : undefined}
                        transition={{ duration: 0.7, delay: 0.1 + i * 0.07, ease: EASE }}
                    />
                ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                {system.commitMix.map((seg, i) => (
                    <div key={seg.label} className="flex items-center gap-1.5">
                        <span
                            aria-hidden
                            className="h-2 w-2 rounded-full"
                            style={{ background: accent, opacity: opacities[i] ?? 0.12 }}
                        />
                        <span className="text-[12px] text-muted-foreground">{seg.label}</span>
                        <span className="font-mono text-[12px] tabular-nums text-foreground">
                            {seg.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Horizontal bars: which parts of the codebase the commits actually touched. */
function SurfaceChart({ system, accent }: { system: SpotlightSystem; accent: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: '-40px' });

    const max = useMemo(
        () => Math.max(...system.surface.map((r) => r.value)),
        [system.surface]
    );

    return (
        <div ref={ref}>
            <Eyebrow>Where the work landed</Eyebrow>
            <div className="mt-3 space-y-2.5">
                {system.surface.map((row, i) => (
                    <div key={row.label} className="grid grid-cols-[auto_1fr] items-center gap-3">
                        <span className="w-[104px] shrink-0 text-[12px] text-muted-foreground">
                            {row.label}
                        </span>
                        <div className="h-1.5 w-full rounded-full bg-muted">
                            <motion.div
                                className="h-1.5 rounded-full"
                                style={{ background: accent, opacity: 0.85 }}
                                initial={{ width: 0 }}
                                animate={inView ? { width: `${(row.value / max) * 100}%` } : undefined}
                                transition={{ duration: 0.7, delay: 0.1 + i * 0.07, ease: EASE }}
                            />
                        </div>
                    </div>
                ))}
            </div>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                by files touched
            </p>
        </div>
    );
}

/** Ownership: how much of the repository's history is this person's. */
function OwnershipDial({ system, accent }: { system: SpotlightSystem; accent: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: '-40px' });
    const reduceMotion = useReducedMotion();

    const { mine, total, note } = system.commits;
    const share = mine / total;

    // Ring geometry: a stroked circle is cheaper and crisper than an arc path.
    const R = 34;
    const CIRCUMFERENCE = 2 * Math.PI * R;

    return (
        <div ref={ref} className="flex items-center gap-5">
            <div className="relative h-[88px] w-[88px] shrink-0">
                <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
                    <circle
                        cx="44"
                        cy="44"
                        r={R}
                        fill="none"
                        strokeWidth="6"
                        className="stroke-muted"
                    />
                    <motion.circle
                        cx="44"
                        cy="44"
                        r={R}
                        fill="none"
                        stroke={accent}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        initial={{ strokeDashoffset: CIRCUMFERENCE }}
                        animate={
                            inView
                                ? { strokeDashoffset: CIRCUMFERENCE * (1 - share) }
                                : undefined
                        }
                        transition={{
                            duration: reduceMotion ? 0 : 1.1,
                            delay: 0.15,
                            ease: EASE,
                        }}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span
                        className="font-mono text-[15px] font-medium tabular-nums"
                        style={{ color: accent }}
                    >
                        {Math.round(share * 100)}%
                    </span>
                </div>
            </div>

            <div className="min-w-0">
                <div className="font-mono text-[22px] leading-none tabular-nums text-foreground">
                    {mine.toLocaleString()}
                    <span className="text-muted-foreground"> / {total.toLocaleString()}</span>
                </div>
                <div className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    commits
                </div>
                <p className="mt-2 text-[12px] leading-snug text-muted-foreground">{note}</p>
            </div>
        </div>
    );
}

/**
 * The three-stage flow. Stages, their rows and the arrows between them reveal in
 * sequence, so the diagram reads as something moving through a system rather than
 * three boxes appearing at once.
 */
function PipelineDiagram({ system, accent }: { system: SpotlightSystem; accent: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: '-60px' });

    return (
        <div ref={ref} className="relative">
            <div className="grid gap-3 md:grid-cols-3 md:gap-0">
                {system.pipeline.map((stage, i) => (
                    <div key={stage.key} className="relative flex">
                        <motion.div
                            initial={{ opacity: 0, y: 18 }}
                            animate={inView ? { opacity: 1, y: 0 } : undefined}
                            transition={{ duration: 0.55, delay: i * 0.12, ease: EASE }}
                            className="relative flex-1 border border-border bg-card/50 p-5 md:border-r-0 md:last:border-r"
                        >
                            {/* Stage rail */}
                            <div
                                aria-hidden
                                className="absolute left-0 top-0 h-px w-10"
                                style={{ background: accent }}
                            />

                            <div className="flex items-baseline justify-between gap-3">
                                <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground">
                                    {stage.label}
                                </span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                    {stage.detail}
                                </span>
                            </div>

                            <ul className="mt-4 space-y-2.5">
                                {stage.items.map((item, j) => (
                                    <motion.li
                                        key={item}
                                        initial={{ opacity: 0 }}
                                        animate={inView ? { opacity: 1 } : undefined}
                                        transition={{
                                            duration: 0.4,
                                            delay: 0.25 + i * 0.12 + j * 0.06,
                                        }}
                                        className="flex gap-2.5 text-[13px] leading-snug text-muted-foreground"
                                    >
                                        <span
                                            aria-hidden
                                            className="mt-[7px] h-px w-2 shrink-0"
                                            style={{ background: accent, opacity: 0.6 }}
                                        />
                                        {item}
                                    </motion.li>
                                ))}
                            </ul>
                        </motion.div>

                        {/* Flow arrow between stages. */}
                        {i < system.pipeline.length - 1 && (
                            <div aria-hidden className="absolute -right-2 top-8 z-10 hidden md:block">
                                <motion.svg
                                    width="16"
                                    height="8"
                                    viewBox="0 0 16 8"
                                    initial={{ opacity: 0, x: -4 }}
                                    animate={inView ? { opacity: 1, x: 0 } : undefined}
                                    transition={{ duration: 0.4, delay: 0.4 + i * 0.12 }}
                                >
                                    <path
                                        d="M0 4h11M8 1l3 3-3 3"
                                        fill="none"
                                        stroke={accent}
                                        strokeWidth="1"
                                    />
                                </motion.svg>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function SystemBlock({ system, position }: { system: SpotlightSystem; position: number }) {
    const theme = useResolvedTheme();
    const accent = system.accent[theme];

    return (
        <motion.article
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.65, ease: EASE }}
            className="border-t border-border pt-12 md:pt-16"
        >
            {/* ── Identity + ownership ── */}
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-center lg:gap-16">
                <div>
                    <div className="flex items-center gap-4">
                        <span
                            className="font-mono text-[40px] leading-none tabular-nums opacity-25"
                            style={{ color: accent }}
                        >
                            {system.index}
                        </span>
                        <div>
                            <div className="text-lg font-semibold tracking-tight text-foreground">
                                {system.name}
                            </div>
                            <Eyebrow>{system.kind}</Eyebrow>
                        </div>
                    </div>

                    <h3 className="mt-7 text-2xl font-semibold leading-[1.15] tracking-tight text-foreground md:text-[30px]">
                        {system.headline}
                    </h3>

                    <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                        {system.summary}
                    </p>

                    <div className="mt-7 flex flex-wrap gap-x-8 gap-y-4">
                        {system.stats.map((stat) => (
                            <div key={stat.label}>
                                <div
                                    className="font-mono text-[17px] tabular-nums"
                                    style={{ color: accent }}
                                >
                                    {stat.value}
                                </div>
                                <div className="mt-0.5 text-[12px] text-muted-foreground">
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-lg border border-border bg-card/50 p-6">
                    <OwnershipDial system={system} accent={accent} />
                </div>
            </div>

            {/* ── Charts ── */}
            <div className="mt-14 grid gap-10 md:grid-cols-2 md:gap-14">
                <CommitMix system={system} accent={accent} />
                <SurfaceChart system={system} accent={accent} />
            </div>

            {/* ── Pipeline ── */}
            <div className="mt-14">
                <Eyebrow>{system.pipeline.map((s) => s.label).join('  →  ')}</Eyebrow>
                <div className="mt-5">
                    <PipelineDiagram system={system} accent={accent} />
                </div>
            </div>

            {/* ── Contribution, resume-shaped but concrete ── */}
            <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-16">
                <div>
                    <Eyebrow>What I did</Eyebrow>
                    <ul className="mt-5 space-y-4">
                        {system.contributions.map((item, i) => (
                            <motion.li
                                key={item}
                                initial={{ opacity: 0, x: -8 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: '-40px' }}
                                transition={{ duration: 0.45, delay: i * 0.05, ease: EASE }}
                                className="flex gap-3.5 text-[14px] leading-relaxed text-muted-foreground"
                            >
                                <span
                                    aria-hidden
                                    className="mt-2.5 h-px w-3 shrink-0"
                                    style={{ background: accent, opacity: 0.7 }}
                                />
                                {item}
                            </motion.li>
                        ))}
                    </ul>
                </div>

                <div>
                    <Eyebrow>Stack</Eyebrow>
                    <div className="mt-5 flex flex-wrap gap-1.5">
                        {system.stack.map((tech) => (
                            <span
                                key={tech}
                                className="border border-border bg-card/50 px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
                            >
                                {tech}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {position < SPOTLIGHT_SYSTEMS.length - 1 && <div className="h-16 md:h-24" />}
        </motion.article>
    );
}

function CapabilityBand() {
    return (
        <div className="mt-24 border-t border-border pt-12 md:mt-32">
            <Eyebrow>How I work now</Eyebrow>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                Four things the last year actually taught me, each backed by shipped
                systems rather than a certificate.
            </p>

            <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
                {CAPABILITY_PILLARS.map((pillar, i) => (
                    <motion.div
                        key={pillar.key}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-60px' }}
                        transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                        className="group bg-card p-6 transition-colors hover:bg-secondary/50"
                    >
                        <div className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
                            0{i + 1}
                        </div>
                        <h4 className="mt-3 text-[15px] font-medium leading-snug text-foreground">
                            {pillar.title}
                        </h4>
                        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                            {pillar.blurb}
                        </p>
                        <ul className="mt-5 space-y-2">
                            {pillar.items.map((item) => (
                                <li
                                    key={item}
                                    className="font-mono text-[11px] leading-relaxed text-muted-foreground"
                                >
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

export default function Spotlight() {
    return (
        <section
            id="spotlight"
            className="relative overflow-hidden border-y border-border bg-secondary/30 py-24 dark:bg-background md:py-32"
        >
            {/* Hairline grid — an instrument surface, not a hero image. */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-40"
                style={{
                    backgroundImage:
                        'linear-gradient(hsl(var(--primary) / 0.07) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.07) 1px, transparent 1px)',
                    backgroundSize: '80px 80px',
                    maskImage: 'linear-gradient(to bottom, black, transparent 55%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 55%)',
                }}
            />

            <div className="container relative z-10 px-4 md:px-6">
                {/* ── Section head ── */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.6, ease: EASE }}
                    className="max-w-3xl pb-16 md:pb-20"
                >
                    <div className="flex flex-wrap items-center gap-3">
                        <Eyebrow color="hsl(var(--primary))">{SPOTLIGHT_INTRO.eyebrow}</Eyebrow>
                        <span className="border border-primary/25 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
                            {SPOTLIGHT_INTRO.label}
                        </span>
                    </div>

                    <h2 className="mt-6 text-3xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-5xl">
                        {SPOTLIGHT_INTRO.title}
                    </h2>

                    <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground md:text-base">
                        {SPOTLIGHT_INTRO.body}
                    </p>

                    <div className="mt-7 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-l-2 border-primary/40 pl-4">
                        <span className="text-[15px] font-semibold tracking-tight text-foreground">
                            {SPOTLIGHT_INTRO.org}
                        </span>
                        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            {SPOTLIGHT_INTRO.orgNote}
                        </span>
                    </div>
                </motion.div>

                {SPOTLIGHT_SYSTEMS.map((system, i) => (
                    <SystemBlock key={system.name} system={system} position={i} />
                ))}

                <CapabilityBand />
            </div>
        </section>
    );
}

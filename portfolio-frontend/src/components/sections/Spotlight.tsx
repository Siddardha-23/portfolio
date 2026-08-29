/**
 * Spotlight — the volunteer engineering work, presented as two systems.
 *
 * Instrument-panel treatment: near-black ground, hairline rules, mono for every
 * figure and label, one accent per system. The pipeline diagrams are the point of
 * the section, so they get the space and the motion; everything else stays quiet.
 */
import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { CAPABILITY_PILLARS, SPOTLIGHT_INTRO, SPOTLIGHT_SYSTEMS } from '@/lib/spotlight';
import type { SpotlightSystem } from '@/lib/spotlight';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Hairline label used above every block. */
function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
    return (
        <div
            className="font-mono text-[11px] uppercase tracking-[0.22em]"
            style={{ color: color ?? 'rgb(148 163 184 / 0.75)' }}
        >
            {children}
        </div>
    );
}

/**
 * The three-stage flow. Stages, their rows and the arrows between them reveal in
 * sequence, so the diagram reads as something moving through a system rather than
 * three boxes appearing at once.
 */
function PipelineDiagram({ system }: { system: SpotlightSystem }) {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: '-60px' });
    const reduceMotion = useReducedMotion();

    return (
        <div ref={ref} className="relative">
            <div className="grid gap-3 md:grid-cols-3 md:gap-0">
                {system.pipeline.map((stage, i) => (
                    <div key={stage.key} className="relative flex">
                        {/* Connector into this stage (not before the first). */}
                        {i > 0 && (
                            <div
                                aria-hidden
                                className="absolute -left-px top-9 hidden h-px w-6 md:block"
                                style={{ background: `${system.accent}55` }}
                            />
                        )}

                        <motion.div
                            initial={{ opacity: 0, y: 18 }}
                            animate={inView ? { opacity: 1, y: 0 } : undefined}
                            transition={{ duration: 0.55, delay: i * 0.12, ease: EASE }}
                            className="relative flex-1 border border-white/[0.07] bg-white/[0.015] p-5 md:border-r-0 md:last:border-r"
                        >
                            {/* Stage index rail */}
                            <div
                                aria-hidden
                                className="absolute left-0 top-0 h-px w-10"
                                style={{ background: system.accent }}
                            />

                            <div className="flex items-baseline justify-between gap-3">
                                <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-slate-200">
                                    {stage.label}
                                </span>
                                <span className="font-mono text-[10px] text-slate-600">
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
                                        className="flex gap-2.5 text-[13px] leading-snug text-slate-400"
                                    >
                                        <span
                                            aria-hidden
                                            className="mt-[7px] h-px w-2 shrink-0"
                                            style={{ background: `${system.accent}80` }}
                                        />
                                        {item}
                                    </motion.li>
                                ))}
                            </ul>
                        </motion.div>

                        {/* Flow arrow between stages. */}
                        {i < system.pipeline.length - 1 && (
                            <div
                                aria-hidden
                                className="absolute -right-2 top-8 z-10 hidden md:block"
                            >
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
                                        stroke={system.accent}
                                        strokeWidth="1"
                                    />
                                </motion.svg>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Ground line under the whole flow. */}
            {!reduceMotion && (
                <motion.div
                    aria-hidden
                    className="mt-px h-px origin-left"
                    style={{
                        background: `linear-gradient(90deg, ${system.accent}00, ${system.accent}66, ${system.accent}00)`,
                    }}
                    initial={{ scaleX: 0 }}
                    animate={inView ? { scaleX: 1 } : undefined}
                    transition={{ duration: 1, delay: 0.5, ease: EASE }}
                />
            )}
        </div>
    );
}

/** Figure plus a proportional bar — reads as a readout, not a marketing stat. */
function MetricRow({
    metric,
    accent,
    index,
}: {
    metric: SpotlightSystem['metrics'][number];
    accent: string;
    index: number;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: '-40px' });

    return (
        <div ref={ref} className="border-t border-white/[0.06] py-3">
            <div className="flex items-baseline justify-between gap-4">
                <span
                    className="font-mono text-[15px] tabular-nums"
                    style={{ color: accent }}
                >
                    {metric.value}
                </span>
                <span className="text-right text-[12px] leading-snug text-slate-500">
                    {metric.label}
                </span>
            </div>
            <div className="mt-2 h-px w-full bg-white/[0.06]">
                {/* origin-left so the fill grows from the axis, not the centre. */}
                <motion.div
                    className="h-px origin-left"
                    style={{ background: accent }}
                    initial={{ scaleX: 0 }}
                    animate={inView ? { scaleX: metric.weight } : undefined}
                    transition={{ duration: 0.9, delay: 0.1 + index * 0.08, ease: EASE }}
                />
            </div>
        </div>
    );
}

function SystemBlock({ system, position }: { system: SpotlightSystem; position: number }) {
    return (
        <motion.article
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.65, ease: EASE }}
            className="border-t border-white/[0.08] pt-12 md:pt-16"
        >
            {/* ── Identity ── */}
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
                <div>
                    <div className="flex items-center gap-4">
                        <span
                            className="font-mono text-[40px] leading-none tabular-nums"
                            style={{ color: `${system.accent}33` }}
                        >
                            {system.index}
                        </span>
                        <div>
                            <div className="text-lg font-semibold tracking-tight text-slate-50">
                                {system.name}
                            </div>
                            <Eyebrow>{system.kind}</Eyebrow>
                        </div>
                    </div>

                    <h3 className="mt-7 text-2xl font-semibold leading-[1.15] tracking-tight text-slate-100 md:text-[32px]">
                        {system.headline}
                    </h3>

                    <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-slate-400">
                        {system.summary}
                    </p>

                    <div
                        className="mt-6 inline-block border-l pl-3 font-mono text-[11px] leading-relaxed text-slate-500"
                        style={{ borderColor: `${system.accent}55` }}
                    >
                        {system.ownership}
                    </div>
                </div>

                {/* ── Readouts ── */}
                <div className="lg:pt-2">
                    <Eyebrow color={`${system.accent}cc`}>Readout</Eyebrow>
                    <div className="mt-4">
                        {system.metrics.map((metric, i) => (
                            <MetricRow
                                key={metric.label}
                                metric={metric}
                                accent={system.accent}
                                index={i}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Pipeline ── */}
            <div className="mt-14">
                <Eyebrow color={`${system.accent}cc`}>
                    {system.pipeline.map((s) => s.label).join('  →  ')}
                </Eyebrow>
                <div className="mt-5">
                    <PipelineDiagram system={system} />
                </div>
            </div>

            {/* ── Engineering notes ── */}
            <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-16">
                <div>
                    <Eyebrow>What that took</Eyebrow>
                    <ul className="mt-5 space-y-4">
                        {system.highlights.map((item, i) => (
                            <motion.li
                                key={item}
                                initial={{ opacity: 0, x: -8 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: '-40px' }}
                                transition={{ duration: 0.45, delay: i * 0.06, ease: EASE }}
                                className="flex gap-3.5 text-[14px] leading-relaxed text-slate-400"
                            >
                                <span
                                    aria-hidden
                                    className="mt-2.5 h-px w-3 shrink-0"
                                    style={{ background: `${system.accent}99` }}
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
                                className="border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 font-mono text-[11px] text-slate-400"
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
        <div className="mt-24 border-t border-white/[0.08] pt-12 md:mt-32">
            <Eyebrow>How I work now</Eyebrow>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-400">
                Four things the last year actually taught me, each backed by shipped
                systems rather than a certificate.
            </p>

            <div className="mt-10 grid gap-px bg-white/[0.07] md:grid-cols-2 lg:grid-cols-4">
                {CAPABILITY_PILLARS.map((pillar, i) => (
                    <motion.div
                        key={pillar.key}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-60px' }}
                        transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                        className="group bg-[#05070d] p-6 transition-colors hover:bg-white/[0.015]"
                    >
                        <div className="font-mono text-[10px] tabular-nums text-slate-700">
                            0{i + 1}
                        </div>
                        <h4 className="mt-3 text-[15px] font-medium leading-snug text-slate-100">
                            {pillar.title}
                        </h4>
                        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                            {pillar.blurb}
                        </p>
                        <ul className="mt-5 space-y-2">
                            {pillar.items.map((item) => (
                                <li
                                    key={item}
                                    className="font-mono text-[11px] leading-relaxed text-slate-500 transition-colors group-hover:text-slate-400"
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
            className="relative overflow-hidden border-y border-border/60 bg-[#05070d] py-24 md:py-32"
        >
            {/* Hairline grid — an instrument surface, not a hero image. */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(125,175,220,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(125,175,220,0.05) 1px, transparent 1px)',
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
                        <Eyebrow color="#38e0d0cc">{SPOTLIGHT_INTRO.eyebrow}</Eyebrow>
                        <span className="border border-teal-400/25 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-teal-300/90">
                            {SPOTLIGHT_INTRO.label}
                        </span>
                    </div>

                    <h2 className="mt-6 text-3xl font-semibold leading-[1.1] tracking-tight text-slate-50 md:text-5xl">
                        {SPOTLIGHT_INTRO.title}
                    </h2>

                    <p className="mt-6 text-[15px] leading-relaxed text-slate-400 md:text-base">
                        {SPOTLIGHT_INTRO.body}
                    </p>

                    <div className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-slate-600">
                        {SPOTLIGHT_INTRO.org}
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

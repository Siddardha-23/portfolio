/**
 * "Who's been here" — the visitor globe as a full-bleed home section.
 *
 * The globe used to live behind a small button in the hero, so almost nobody
 * found it. Here it earns its own scroll beat: it settles into frame as the
 * section enters, spins on its own, and hands off to the modal for filtering.
 */
import { useMemo, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowUpRight, Globe2 } from 'lucide-react';
import GlobeStage from '@/components/globe/GlobeStage';
import type { Globe3DHandle } from '@/components/globe/Globe3D';
import { useVisitorGeo } from '@/hooks/useVisitorGeo';

/** Fixed-width figure so the row does not reflow as counts animate in. */
function Stat({ value, label }: { value: number | string; label: string }) {
    return (
        <div>
            <div className="font-mono text-3xl font-medium tabular-nums text-foreground md:text-4xl">
                {value}
            </div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {label}
            </div>
        </div>
    );
}

export default function GlobeSection() {
    const sectionRef = useRef<HTMLElement>(null);
    const globeRef = useRef<Globe3DHandle>(null);
    const [globeReady, setGlobeReady] = useState(false);
    const reduceMotion = useReducedMotion();

    // three.js is ~500KB gzipped. Hold it back until the section is nearly on
    // screen so a visitor who never scrolls this far never pays for it.
    const nearViewport = useInView(sectionRef, { once: true, margin: '400px' });

    const { points, countries, totalVisitors, loading } = useVisitorGeo('all');

    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ['start end', 'end start'],
    });

    // The globe drifts and settles across the scroll beat rather than sitting still.
    const globeY = useTransform(scrollYProgress, [0, 0.5, 1], ['8%', '0%', '-8%']);
    const globeScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.92, 1, 0.96]);
    const glowOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 0.6, 0.15]);

    const topCountries = useMemo(() => countries.slice(0, 12), [countries]);

    const openDeepDive = () => window.dispatchEvent(new CustomEvent('open-visitor-map'));

    return (
        <section
            ref={sectionRef}
            id="reach"
            className="relative overflow-hidden border-y border-border/60 bg-[#05070d] py-24 md:py-32"
        >
            {/* Faint grid, to read as an instrument surface rather than a hero image. */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.35]"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(125,175,220,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(125,175,220,0.06) 1px, transparent 1px)',
                    backgroundSize: '64px 64px',
                    maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 78%)',
                    WebkitMaskImage:
                        'radial-gradient(ellipse at center, black 30%, transparent 78%)',
                }}
            />

            <div className="container relative z-10 px-4 md:px-6">
                <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
                    {/* ── Copy and figures ── */}
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-teal-400/80">
                            <Globe2 className="h-3.5 w-3.5" />
                            Global reach
                        </div>

                        <h2 className="mt-5 text-3xl font-semibold leading-[1.1] tracking-tight text-slate-50 md:text-5xl">
                            Who&apos;s been here.
                        </h2>

                        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-400">
                            Every visit is geolocated at the edge, resolved to a canonical
                            country, and plotted live. Marker height is visit volume; the arcs
                            run from Tempe out to each city.
                        </p>

                        <div className="mt-10 grid grid-cols-3 gap-6 border-t border-white/[0.07] pt-8">
                            <Stat value={loading ? '—' : totalVisitors} label="Visitors" />
                            <Stat value={loading ? '—' : countries.length} label="Countries" />
                            <Stat value={loading ? '—' : points.length} label="Cities" />
                        </div>

                        {topCountries.length > 0 && (
                            <div className="mt-8 flex flex-wrap gap-1.5">
                                {topCountries.map((c) => (
                                    <button
                                        key={c.code}
                                        type="button"
                                        onClick={() =>
                                            c.lat != null &&
                                            c.lng != null &&
                                            globeRef.current?.flyTo(c.lat, c.lng, 1.5)
                                        }
                                        className="group inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-slate-400 transition-colors hover:border-teal-400/40 hover:text-slate-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-teal-400/60"
                                        title={`Focus ${c.name}`}
                                    >
                                        <span aria-hidden>{c.flag}</span>
                                        <span>{c.name}</span>
                                        <span className="text-slate-600 group-hover:text-teal-400">
                                            {c.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={openDeepDive}
                            className="mt-9 inline-flex items-center gap-2 border-b border-teal-400/30 pb-1 font-mono text-[12px] uppercase tracking-[0.16em] text-teal-300 transition-colors hover:border-teal-400 hover:text-teal-200"
                        >
                            Explore the map
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                    </motion.div>

                    {/* ── The globe ── */}
                    <motion.div
                        className="relative"
                        style={
                            reduceMotion ? undefined : { y: globeY, scale: globeScale }
                        }
                    >
                        <motion.div
                            aria-hidden
                            className="pointer-events-none absolute inset-0 rounded-full bg-teal-400/10 blur-[90px]"
                            style={reduceMotion ? { opacity: 0.3 } : { opacity: glowOpacity }}
                        />
                        {nearViewport ? (
                            <GlobeStage
                                ref={globeRef}
                                points={points}
                                autoRotate={!reduceMotion}
                                showArcs
                                altitude={2.5}
                                onReady={() => setGlobeReady(true)}
                                className="relative aspect-square w-full max-w-[620px] justify-self-center"
                            />
                        ) : (
                            <div
                                aria-hidden
                                className="relative aspect-square w-full max-w-[620px] justify-self-center"
                            />
                        )}
                        {!loading && points.length === 0 && globeReady && (
                            <p className="absolute inset-x-0 bottom-4 text-center font-mono text-[11px] text-slate-600">
                                No plottable visitor locations yet
                            </p>
                        )}
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

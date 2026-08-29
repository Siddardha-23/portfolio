/**
 * VisitorGlobe — the filterable deep-dive over visitor locations.
 *
 * Opened by the 'open-visitor-map' event (the home section's "Explore the map",
 * and the mobile FAB). The ambient globe lives in GlobeSection; this modal is
 * where the time filters and the full country list live.
 *
 * Previously a Leaflet map. It now shares one renderer with the home section, so
 * there is a single globe implementation and no tile dependency.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Globe, MapPin, Navigation, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import GlobeStage from '@/components/globe/GlobeStage';
import type { Globe3DHandle } from '@/components/globe/Globe3D';
import { periodQuery, useVisitorGeo, type Period } from '@/hooks/useVisitorGeo';

const PERIODS: Array<{ key: Period; label: string }> = [
    { key: 'all', label: 'All Time' },
    { key: '24h', label: 'Last 24h' },
    { key: '7d', label: 'Last 7 Days' },
    { key: '30d', label: 'Last 30 Days' },
    { key: 'custom', label: 'Custom' },
];

export default function VisitorGlobe() {
    const [isOpen, setIsOpen] = useState(false);
    const [period, setPeriod] = useState<Period>('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const globeRef = useRef<Globe3DHandle>(null);
    // Mounted on page load but hidden, so it fetches only once opened.
    const { points, countries, totalVisitors, plottedVisitors, loading, refetch } =
        useVisitorGeo('all', false);

    const handleOpen = useCallback(() => {
        setIsOpen(true);
        refetch(periodQuery(period, customFrom, customTo));
    }, [refetch, period, customFrom, customTo]);

    useEffect(() => {
        const handler = () => handleOpen();
        window.addEventListener('open-visitor-map', handler);
        return () => window.removeEventListener('open-visitor-map', handler);
    }, [handleOpen]);

    // Lock the page behind the modal.
    useEffect(() => {
        if (!isOpen) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen]);

    const selectPeriod = (next: Period) => {
        setPeriod(next);
        // Custom waits for an explicit Apply, since the dates are still being typed.
        if (next !== 'custom') refetch(periodQuery(next));
    };

    const applyCustom = () => {
        if (customFrom) refetch(periodQuery('custom', customFrom, customTo));
    };

    // The header reports what is actually drawn when geo is incomplete.
    const visitorLabel = useMemo(() => {
        if (loading) return '—';
        if (plottedVisitors && plottedVisitors !== totalVisitors) {
            return `${plottedVisitors} of ${totalVisitors}`;
        }
        return String(totalVisitors);
    }, [loading, plottedVisitors, totalVisitors]);

    if (typeof window === 'undefined') return null;

    return (
        <>
            {/* Mobile entry point — the home section's link is desktop-comfortable. */}
            <motion.div
                className="fixed bottom-6 left-6 z-40 md:hidden"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 3, type: 'spring' }}
            >
                <Button
                    onClick={handleOpen}
                    className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent p-0 shadow-lg"
                    title="Visitor map"
                    aria-label="Open visitor map"
                >
                    <Globe className="h-4 w-4 text-white" />
                </Button>
            </motion.div>

            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <>
                            <motion.div
                                className="fixed inset-0 z-[9999] cursor-pointer bg-background/70 backdrop-blur-md dark:bg-black/85"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsOpen(false)}
                                role="button"
                                tabIndex={-1}
                                aria-label="Close visitor map"
                            />

                            <motion.div
                                role="dialog"
                                aria-modal="true"
                                aria-label="Global visitors"
                                className="fixed left-1/2 top-1/2 z-[10000] flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:rounded-3xl"
                                style={{ width: 'min(1100px, 95vw)', height: 'min(850px, 90vh)' }}
                                initial={{ opacity: 0, scale: 0.94 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.94 }}
                                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                            >
                                {/* ── Header ── */}
                                <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-4 sm:px-6">
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                        <div className="shrink-0 rounded-xl bg-gradient-to-br from-primary to-accent p-2.5 shadow-lg shadow-primary/20">
                                            <Globe className="h-5 w-5 text-white" />
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="font-semibold text-foreground">Global Visitors</h2>
                                            <p className="hidden font-mono text-[11px] text-muted-foreground sm:block">
                                                Drag to spin · click a country to focus
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-2">
                                        <Badge className="hidden gap-1.5 border-primary/20 bg-primary/10 font-mono text-xs text-primary sm:flex">
                                            <Users className="h-3.5 w-3.5" />
                                            {visitorLabel}
                                        </Badge>
                                        {countries.length > 0 && (
                                            <Badge className="hidden gap-1.5 border-accent/20 bg-accent/10 font-mono text-xs text-accent md:flex">
                                                <Navigation className="h-3.5 w-3.5" />
                                                {countries.length}
                                            </Badge>
                                        )}
                                        <Button
                                            onClick={() => setIsOpen(false)}
                                            className="h-8 w-8 rounded-lg bg-secondary p-0 text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                                            title="Close (ESC)"
                                            aria-label="Close"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* ── Period filter ── */}
                                <div className="scrollbar-thin flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border px-4 py-2">
                                    <span className="mr-1 shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                        Period
                                    </span>
                                    {PERIODS.map((opt) => (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => selectPeriod(opt.key)}
                                            className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[11px] transition-all ${
                                                period === opt.key
                                                    ? 'border-primary/30 bg-primary/15 text-primary'
                                                    : 'border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                    {period === 'custom' && (
                                        <div className="ml-2 flex items-center gap-2">
                                            <input
                                                type="date"
                                                value={customFrom}
                                                onChange={(e) => setCustomFrom(e.target.value)}
                                                className="h-7 rounded-md border border-border bg-card px-2 font-mono text-[11px] text-foreground focus:border-primary focus:outline-none"
                                                aria-label="From date"
                                            />
                                            <span className="font-mono text-[11px] text-muted-foreground">to</span>
                                            <input
                                                type="date"
                                                value={customTo}
                                                onChange={(e) => setCustomTo(e.target.value)}
                                                className="h-7 rounded-md border border-border bg-card px-2 font-mono text-[11px] text-foreground focus:border-primary focus:outline-none"
                                                aria-label="To date"
                                            />
                                            <button
                                                type="button"
                                                onClick={applyCustom}
                                                disabled={!customFrom}
                                                className="shrink-0 rounded-full border border-primary/30 bg-primary/15 px-3 py-1 font-mono text-[11px] text-primary transition-all hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* ── Globe ── */}
                                <div className="relative min-h-0 w-full flex-1">
                                    {loading ? (
                                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                            >
                                                <Globe className="h-10 w-10 text-primary/50" />
                                            </motion.div>
                                            <p className="font-mono text-[11px] text-muted-foreground">
                                                Loading visitor data…
                                            </p>
                                        </div>
                                    ) : points.length === 0 ? (
                                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
                                            <MapPin className="h-9 w-9 text-muted-foreground/60" />
                                            <p className="font-mono text-[11px] text-muted-foreground">
                                                No visitor locations in this period
                                            </p>
                                        </div>
                                    ) : (
                                        <GlobeStage
                                            ref={globeRef}
                                            points={points}
                                            autoRotate
                                            showArcs
                                            altitude={2.3}
                                            className="h-full w-full"
                                        />
                                    )}
                                </div>

                                {/* ── Country list ── */}
                                {countries.length > 0 && (
                                    <div className="shrink-0 border-t border-border px-4 py-3">
                                        <div className="scrollbar-thin flex max-h-[72px] flex-wrap justify-center gap-1.5 overflow-y-auto">
                                            {countries.map((c) => (
                                                <button
                                                    key={c.code}
                                                    type="button"
                                                    onClick={() =>
                                                        c.lat != null &&
                                                        c.lng != null &&
                                                        globeRef.current?.flyTo(c.lat, c.lng, 1.4)
                                                    }
                                                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-1 font-mono text-[11px] text-foreground transition-all hover:border-primary/30 hover:bg-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                                                    title={`Focus ${c.name}`}
                                                >
                                                    <span aria-hidden>{c.flag}</span>
                                                    <span className="truncate">{c.name}</span>
                                                    <span className="shrink-0 text-muted-foreground">{c.count}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}

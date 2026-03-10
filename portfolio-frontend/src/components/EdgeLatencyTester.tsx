/**
 * EdgeLatencyTester – "Test my CDN from your location"
 *
 * Pings the site's CDN endpoint multiple times, measures latency,
 * identifies CloudFront POP, and visualises results with an animated chart.
 */
import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Globe, Zap, Activity, Timer, MapPin, Server,
    Play, RotateCcw, Loader2, Wifi, ShieldCheck, ArrowDown,
} from 'lucide-react';

// ── CloudFront POP code → city map (IATA codes) ──
const POP_MAP: Record<string, { city: string; region: string; flag: string }> = {
    // North America
    IAD: { city: 'Ashburn, VA', region: 'US East', flag: '🇺🇸' },
    DFW: { city: 'Dallas, TX', region: 'US Central', flag: '🇺🇸' },
    SEA: { city: 'Seattle, WA', region: 'US West', flag: '🇺🇸' },
    SFO: { city: 'San Francisco, CA', region: 'US West', flag: '🇺🇸' },
    LAX: { city: 'Los Angeles, CA', region: 'US West', flag: '🇺🇸' },
    ORD: { city: 'Chicago, IL', region: 'US Central', flag: '🇺🇸' },
    ATL: { city: 'Atlanta, GA', region: 'US East', flag: '🇺🇸' },
    MIA: { city: 'Miami, FL', region: 'US East', flag: '🇺🇸' },
    JFK: { city: 'New York, NY', region: 'US East', flag: '🇺🇸' },
    EWR: { city: 'Newark, NJ', region: 'US East', flag: '🇺🇸' },
    BOS: { city: 'Boston, MA', region: 'US East', flag: '🇺🇸' },
    PHX: { city: 'Phoenix, AZ', region: 'US West', flag: '🇺🇸' },
    DEN: { city: 'Denver, CO', region: 'US Central', flag: '🇺🇸' },
    MSP: { city: 'Minneapolis, MN', region: 'US Central', flag: '🇺🇸' },
    PDX: { city: 'Portland, OR', region: 'US West', flag: '🇺🇸' },
    SLC: { city: 'Salt Lake City, UT', region: 'US West', flag: '🇺🇸' },
    YTO: { city: 'Toronto', region: 'Canada', flag: '🇨🇦' },
    YUL: { city: 'Montreal', region: 'Canada', flag: '🇨🇦' },
    YVR: { city: 'Vancouver', region: 'Canada', flag: '🇨🇦' },
    // Europe
    LHR: { city: 'London', region: 'Europe', flag: '🇬🇧' },
    CDG: { city: 'Paris', region: 'Europe', flag: '🇫🇷' },
    FRA: { city: 'Frankfurt', region: 'Europe', flag: '🇩🇪' },
    AMS: { city: 'Amsterdam', region: 'Europe', flag: '🇳🇱' },
    MAD: { city: 'Madrid', region: 'Europe', flag: '🇪🇸' },
    MXP: { city: 'Milan', region: 'Europe', flag: '🇮🇹' },
    ARN: { city: 'Stockholm', region: 'Europe', flag: '🇸🇪' },
    DUB: { city: 'Dublin', region: 'Europe', flag: '🇮🇪' },
    // Asia
    NRT: { city: 'Tokyo', region: 'Asia', flag: '🇯🇵' },
    ICN: { city: 'Seoul', region: 'Asia', flag: '🇰🇷' },
    SIN: { city: 'Singapore', region: 'Asia', flag: '🇸🇬' },
    BOM: { city: 'Mumbai', region: 'Asia', flag: '🇮🇳' },
    DEL: { city: 'New Delhi', region: 'Asia', flag: '🇮🇳' },
    HKG: { city: 'Hong Kong', region: 'Asia', flag: '🇭🇰' },
    SYD: { city: 'Sydney', region: 'Oceania', flag: '🇦🇺' },
    MEL: { city: 'Melbourne', region: 'Oceania', flag: '🇦🇺' },
    // South America
    GRU: { city: 'São Paulo', region: 'South America', flag: '🇧🇷' },
    BOG: { city: 'Bogotá', region: 'South America', flag: '🇨🇴' },
    SCL: { city: 'Santiago', region: 'South America', flag: '🇨🇱' },
};

function parsePOP(popHeader: string): { code: string; city: string; region: string; flag: string } | null {
    if (!popHeader) return null;
    // CloudFront POP format: "CODE-P1" or "CODE-C1" etc.
    const code = popHeader.split('-')[0].toUpperCase();
    const info = POP_MAP[code];
    if (info) return { code, ...info };
    // Unknown POP — still return the code
    return { code, city: code, region: 'Unknown', flag: '🌐' };
}

interface PingResult {
    latency: number;
    pop: string | null;
    cacheStatus: string;
    ttfb: number | null;
}

// Rating thresholds
function getLatencyRating(avg: number): { grade: string; color: string; label: string } {
    if (avg < 30) return { grade: 'A+', color: '#10b981', label: 'Excellent' };
    if (avg < 60) return { grade: 'A', color: '#22c55e', label: 'Great' };
    if (avg < 120) return { grade: 'B', color: '#f59e0b', label: 'Good' };
    if (avg < 250) return { grade: 'C', color: '#f97316', label: 'Fair' };
    return { grade: 'D', color: '#ef4444', label: 'Slow' };
}

// Latency bar component
function LatencyBar({ result, index, maxLatency }: {
    result: PingResult;
    index: number;
    maxLatency: number;
}) {
    const pct = (result.latency / maxLatency) * 100;
    const color =
        result.latency < 30 ? '#10b981' :
            result.latency < 60 ? '#22c55e' :
                result.latency < 120 ? '#f59e0b' :
                    result.latency < 250 ? '#f97316' : '#ef4444';

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
            className="flex items-center gap-3"
        >
            <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">
                #{index + 1}
            </span>
            <div className="flex-1 h-6 bg-secondary/30 rounded-lg relative overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(pct, 3)}%` }}
                    transition={{ delay: index * 0.08 + 0.1, duration: 0.5, ease: 'easeOut' }}
                    className="h-full rounded-lg"
                    style={{ background: `linear-gradient(90deg, ${color}80, ${color})` }}
                />
                <div className="absolute inset-0 flex items-center px-2 justify-between">
                    <span className="text-[10px] font-mono font-bold text-foreground">
                        {result.latency.toFixed(0)}ms
                    </span>
                    <span className="text-[9px] font-mono text-muted-foreground">
                        {result.cacheStatus === 'Hit from cloudfront' ? '⚡ HIT' :
                            result.cacheStatus === 'Miss from cloudfront' ? '🔄 MISS' :
                                result.cacheStatus || ''}
                    </span>
                </div>
            </div>
        </motion.div>
    );
}

export default function EdgeLatencyTester({ isOpen, onClose }: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
    const [results, setResults] = useState<PingResult[]>([]);
    const [popInfo, setPopInfo] = useState<ReturnType<typeof parsePOP>>(null);
    const [progress, setProgress] = useState(0);
    const abortRef = useRef<AbortController | null>(null);

    const PING_COUNT = 8;
    const TEST_URL = window.location.origin + '/index.html';

    const runTest = useCallback(async () => {
        setStatus('running');
        setResults([]);
        setPopInfo(null);
        setProgress(0);
        abortRef.current = new AbortController();
        const signal = abortRef.current.signal;
        const newResults: PingResult[] = [];

        for (let i = 0; i < PING_COUNT; i++) {
            if (signal.aborted) break;
            setProgress(((i + 1) / PING_COUNT) * 100);

            try {
                const cacheBuster = `?_cb=${Date.now()}-${i}`;
                const url = TEST_URL + cacheBuster;
                const start = performance.now();

                const res = await fetch(url, {
                    method: 'GET',
                    cache: 'no-store',
                    signal,
                });
                await res.text();

                const end = performance.now();
                const latency = end - start;

                // CloudFront headers
                const pop = res.headers.get('x-amz-cf-pop');
                const cacheStatus = res.headers.get('x-cache') || '';

                // Try to get TTFB from Resource Timing API
                let ttfb: number | null = null;
                const entries = performance.getEntriesByName(url, 'resource');
                if (entries.length > 0) {
                    const entry = entries[entries.length - 1] as PerformanceResourceTiming;
                    ttfb = entry.responseStart - entry.requestStart;
                    if (ttfb < 0) ttfb = null;
                }

                const result: PingResult = { latency, pop, cacheStatus, ttfb };
                newResults.push(result);
                setResults([...newResults]);

                // Parse POP info from first response that has it
                if (pop && !popInfo) {
                    setPopInfo(parsePOP(pop));
                }
            } catch {
                if (signal.aborted) break;
                // Network error - add a failed ping
                newResults.push({ latency: -1, pop: null, cacheStatus: 'Error', ttfb: null });
                setResults([...newResults]);
            }

            // Small delay between pings
            if (i < PING_COUNT - 1) {
                await new Promise(r => setTimeout(r, 200));
            }
        }

        setStatus('done');
    }, [TEST_URL, popInfo]);

    const reset = () => {
        abortRef.current?.abort();
        setStatus('idle');
        setResults([]);
        setPopInfo(null);
        setProgress(0);
    };

    // Computed stats
    const validResults = results.filter(r => r.latency >= 0);
    const avg = validResults.length > 0
        ? validResults.reduce((s, r) => s + r.latency, 0) / validResults.length
        : 0;
    const min = validResults.length > 0
        ? Math.min(...validResults.map(r => r.latency))
        : 0;
    const max = validResults.length > 0
        ? Math.max(...validResults.map(r => r.latency))
        : 0;
    const cacheHits = validResults.filter(r =>
        r.cacheStatus.toLowerCase().includes('hit')
    ).length;
    const rating = getLatencyRating(avg);
    const maxLatency = Math.max(max, 50);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.4, type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-4 md:inset-8 lg:inset-12 z-[61] flex items-start justify-center overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative w-full max-w-5xl my-4 flex flex-col">
                            <div className="absolute -inset-1 bg-gradient-to-br from-emerald-500/15 via-cyan-500/5 to-emerald-500/15 rounded-3xl blur-xl opacity-60 pointer-events-none" />

                            <div className="relative flex flex-col max-h-[85vh] bg-background/95 backdrop-blur-2xl rounded-3xl border border-border/50 shadow-2xl overflow-hidden">
                                {/* Header */}
                                <div className="flex-shrink-0 bg-background/90 border-b border-border/50 p-5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg">
                                                <Globe className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h2 className="text-lg font-bold text-foreground">Edge Latency Tester</h2>
                                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-full">CDN</span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">Test CDN performance from your location</p>
                                            </div>
                                        </div>
                                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground">
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                                    {/* POP Info */}
                                    {popInfo && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20"
                                        >
                                            <div className="text-3xl">{popInfo.flag}</div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                                                    <span className="text-sm font-semibold text-foreground">
                                                        CloudFront POP: {popInfo.code}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">{popInfo.city} • {popInfo.region}</p>
                                            </div>
                                            <div className="text-right">
                                                <Server className="h-4 w-4 text-emerald-500 mx-auto mb-0.5" />
                                                <span className="text-[10px] text-muted-foreground">Edge Node</span>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Stats Grid */}
                                    {validResults.length > 0 && (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {[
                                                { icon: Activity, label: 'Avg Latency', value: `${avg.toFixed(0)}ms`, color: rating.color },
                                                { icon: Zap, label: 'Fastest', value: `${min.toFixed(0)}ms`, color: '#10b981' },
                                                { icon: Timer, label: 'Slowest', value: `${max.toFixed(0)}ms`, color: '#f97316' },
                                                { icon: Wifi, label: 'Cache Hit Rate', value: `${validResults.length > 0 ? Math.round((cacheHits / validResults.length) * 100) : 0}%`, color: '#8b5cf6' },
                                            ].map((stat) => (
                                                <motion.div
                                                    key={stat.label}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="p-3 rounded-xl bg-secondary/30 border border-border/50"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 rounded-lg" style={{ background: stat.color + '18' }}>
                                                            <stat.icon className="h-3.5 w-3.5" style={{ color: stat.color }} />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                                                            <p className="text-sm font-bold text-foreground">{stat.value}</p>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Grade Badge */}
                                    {status === 'done' && validResults.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ type: 'spring', damping: 15 }}
                                            className="flex items-center justify-center"
                                        >
                                            <div className="flex items-center gap-4 px-6 py-3 rounded-2xl border border-border/50 bg-secondary/20">
                                                <div
                                                    className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black"
                                                    style={{ background: rating.color + '20', color: rating.color }}
                                                >
                                                    {rating.grade}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-foreground">CDN Performance: {rating.label}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Avg {avg.toFixed(0)}ms • {cacheHits}/{validResults.length} cache hits • {popInfo?.city || 'Unknown POP'}
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Latency Bars */}
                                    {validResults.length > 0 && (
                                        <div className="space-y-2">
                                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                                <ArrowDown className="h-3 w-3" />
                                                Individual Pings ({validResults.length}/{PING_COUNT})
                                            </h3>
                                            <div className="space-y-1.5">
                                                {results.map((r, i) =>
                                                    r.latency >= 0 ? (
                                                        <LatencyBar key={i} result={r} index={i} maxLatency={maxLatency} />
                                                    ) : (
                                                        <motion.div
                                                            key={i}
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            className="flex items-center gap-3"
                                                        >
                                                            <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">#{i + 1}</span>
                                                            <div className="flex-1 h-6 bg-destructive/10 rounded-lg flex items-center px-2">
                                                                <span className="text-[10px] font-mono text-destructive">Failed</span>
                                                            </div>
                                                        </motion.div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Progress / Start */}
                                    {status === 'idle' && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex flex-col items-center py-10 gap-4"
                                        >
                                            <div className="relative">
                                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                                                    <Globe className="h-10 w-10 text-emerald-500" />
                                                </div>
                                                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center">
                                                    <Zap className="h-3 w-3 text-white" />
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-semibold text-foreground mb-1">Ready to test CDN performance</p>
                                                <p className="text-xs text-muted-foreground max-w-xs">
                                                    Sends {PING_COUNT} requests to measure latency, identify CloudFront edge location, and analyze cache performance
                                                </p>
                                            </div>
                                            <button
                                                onClick={runTest}
                                                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium text-sm hover:opacity-90 transition-opacity shadow-lg"
                                            >
                                                <Play className="h-4 w-4" />
                                                Start Test
                                            </button>
                                        </motion.div>
                                    )}

                                    {status === 'running' && validResults.length === 0 && (
                                        <div className="flex flex-col items-center py-10 gap-3">
                                            <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                                            <p className="text-sm text-muted-foreground">Running latency test...</p>
                                            <div className="w-48 h-2 bg-secondary/50 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${progress}%` }}
                                                    transition={{ duration: 0.3 }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="flex-shrink-0 px-5 py-3 border-t border-border/50 bg-background/80 flex items-center justify-between">
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                        <ShieldCheck className="h-3 w-3 text-emerald-500" />
                                        Testing {window.location.host} via CloudFront CDN
                                    </p>
                                    {(status === 'done' || status === 'running') && (
                                        <button
                                            onClick={reset}
                                            className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                                        >
                                            <RotateCcw className="h-3 w-3" />
                                            Reset
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

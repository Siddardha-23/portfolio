/**
 * SecurityScorecard - Live security headers scan
 *
 * Fetches the site's own pages and inspects response headers to produce
 * a visual security grade - HSTS, CSP, X-Frame-Options, etc.
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Shield, ShieldCheck, ShieldAlert, Lock,
    CheckCircle2, XCircle, AlertTriangle, Loader2, RotateCcw,
    Play, ExternalLink, Eye, type LucideIcon,
} from 'lucide-react';

// ── Security header definitions ──
interface HeaderCheck {
    key: string;
    name: string;
    description: string;
    icon: LucideIcon;
    weight: number; // importance 1-10
    check: (value: string | null) => { pass: boolean; detail: string; score: number };
}

const HEADER_CHECKS: HeaderCheck[] = [
    {
        key: 'strict-transport-security',
        name: 'HSTS',
        description: 'Forces all connections over HTTPS, preventing protocol downgrade and cookie hijacking.',
        icon: Lock,
        weight: 10,
        check: (val) => {
            if (!val) return { pass: false, detail: 'Missing - site allows HTTP connections', score: 0 };
            const hasMaxAge = val.includes('max-age=');
            const maxAgeMatch = val.match(/max-age=(\d+)/);
            const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : 0;
            const hasSub = val.includes('includeSubDomains') || val.includes('includeSubdomains');
            const hasPreload = val.includes('preload');
            if (maxAge >= 31536000 && hasSub && hasPreload)
                return { pass: true, detail: `max-age=${maxAge}, includeSubDomains, preload ✓`, score: 100 };
            if (maxAge >= 31536000 && hasSub)
                return { pass: true, detail: `max-age=${maxAge}, includeSubDomains ✓`, score: 85 };
            if (hasMaxAge)
                return { pass: true, detail: `max-age=${maxAge} (consider adding includeSubDomains & preload)`, score: 60 };
            return { pass: false, detail: 'Invalid format', score: 0 };
        },
    },
    {
        key: 'content-security-policy',
        name: 'Content Security Policy',
        description: 'Controls which resources can be loaded, preventing XSS and injection attacks.',
        icon: Shield,
        weight: 10,
        check: (val) => {
            if (!val) return { pass: false, detail: 'Missing - no XSS protection from CSP', score: 0 };
            const hasDefault = val.includes('default-src');
            const hasScript = val.includes('script-src');
            const hasStyle = val.includes('style-src');
            const hasUnsafe = val.includes("'unsafe-eval'");
            if (hasDefault && hasScript && hasStyle && !hasUnsafe)
                return { pass: true, detail: 'Comprehensive policy with script and default directives', score: 95 };
            if (hasDefault && !hasUnsafe)
                return { pass: true, detail: 'Good base policy with default-src', score: 80 };
            if (hasDefault)
                return { pass: true, detail: 'Present but could be stricter', score: 60 };
            return { pass: true, detail: 'Present but minimal coverage', score: 40 };
        },
    },
    {
        key: 'x-content-type-options',
        name: 'X-Content-Type-Options',
        description: 'Prevents MIME-type sniffing, which can turn non-executable types into executable ones.',
        icon: ShieldCheck,
        weight: 7,
        check: (val) => {
            if (!val) return { pass: false, detail: 'Missing - browser may MIME-sniff responses', score: 0 };
            if (val.toLowerCase() === 'nosniff')
                return { pass: true, detail: 'nosniff ✓', score: 100 };
            return { pass: false, detail: `Unexpected value: ${val}`, score: 0 };
        },
    },
    {
        key: 'x-frame-options',
        name: 'X-Frame-Options',
        description: 'Prevents clickjacking by controlling whether the site can be embedded in frames.',
        icon: ShieldAlert,
        weight: 7,
        check: (val) => {
            if (!val) return { pass: false, detail: 'Missing - site can be framed (clickjacking risk)', score: 0 };
            const v = val.toUpperCase();
            if (v === 'DENY')
                return { pass: true, detail: 'DENY - no framing allowed ✓', score: 100 };
            if (v === 'SAMEORIGIN')
                return { pass: true, detail: 'SAMEORIGIN - only same-origin framing ✓', score: 90 };
            return { pass: true, detail: `Set to: ${val}`, score: 70 };
        },
    },
    {
        key: 'x-xss-protection',
        name: 'X-XSS-Protection',
        description: 'Legacy XSS filter in older browsers. Modern CSP is preferred but this adds defense-in-depth.',
        icon: ShieldCheck,
        weight: 4,
        check: (val) => {
            if (!val) return { pass: false, detail: 'Missing - no legacy XSS filter', score: 0 };
            if (val.includes('1') && val.includes('mode=block'))
                return { pass: true, detail: '1; mode=block ✓', score: 100 };
            if (val.includes('1'))
                return { pass: true, detail: 'Enabled (consider adding mode=block)', score: 70 };
            if (val === '0')
                return { pass: true, detail: 'Explicitly disabled (OK if CSP is strong)', score: 50 };
            return { pass: false, detail: `Unexpected: ${val}`, score: 0 };
        },
    },
    {
        key: 'referrer-policy',
        name: 'Referrer-Policy',
        description: 'Controls how much referrer information is sent with requests, protecting user privacy.',
        icon: Eye,
        weight: 5,
        check: (val) => {
            if (!val) return { pass: false, detail: 'Missing - full URL sent as referrer', score: 0 };
            const safe = ['no-referrer', 'strict-origin', 'strict-origin-when-cross-origin', 'same-origin'];
            if (safe.some(s => val.toLowerCase().includes(s)))
                return { pass: true, detail: `${val} ✓`, score: 100 };
            if (val.toLowerCase() === 'origin')
                return { pass: true, detail: 'origin (acceptable)', score: 70 };
            return { pass: true, detail: `${val} (consider stricter policy)`, score: 50 };
        },
    },
    {
        key: 'permissions-policy',
        name: 'Permissions-Policy',
        description: 'Controls which browser features (camera, mic, geolocation) the site can use.',
        icon: Lock,
        weight: 4,
        check: (val) => {
            if (!val) return { pass: false, detail: 'Not set - all browser features available to the page', score: 0 };
            const directives = val.split(',').length;
            if (directives >= 5)
                return { pass: true, detail: `${directives} restrictions configured ✓`, score: 100 };
            if (directives >= 2)
                return { pass: true, detail: `${directives} restrictions (consider adding more)`, score: 70 };
            return { pass: true, detail: 'Minimal restrictions set', score: 50 };
        },
    },
];

// ── Grade calculation ──
function calculateGrade(results: { score: number; weight: number }[]): {
    grade: string;
    percentage: number;
    color: string;
} {
    const totalWeight = results.reduce((s, r) => s + r.weight, 0);
    const weightedScore = results.reduce((s, r) => s + (r.score * r.weight), 0);
    const pct = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

    if (pct >= 95) return { grade: 'A+', percentage: pct, color: '#10b981' };
    if (pct >= 85) return { grade: 'A', percentage: pct, color: '#22c55e' };
    if (pct >= 75) return { grade: 'B+', percentage: pct, color: '#84cc16' };
    if (pct >= 65) return { grade: 'B', percentage: pct, color: '#f59e0b' };
    if (pct >= 50) return { grade: 'C', percentage: pct, color: '#f97316' };
    if (pct >= 30) return { grade: 'D', percentage: pct, color: '#ef4444' };
    return { grade: 'F', percentage: pct, color: '#dc2626' };
}

interface ScanResult {
    check: HeaderCheck;
    value: string | null;
    result: { pass: boolean; detail: string; score: number };
}

export default function SecurityScorecard({ isOpen, onClose }: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const [status, setStatus] = useState<'idle' | 'scanning' | 'done'>('idle');
    const [scanResults, setScanResults] = useState<ScanResult[]>([]);
    const [scanTime, setScanTime] = useState(0);

    const runScan = useCallback(async () => {
        setStatus('scanning');
        setScanResults([]);
        const start = performance.now();

        // Small delay for dramatic effect
        await new Promise(r => setTimeout(r, 400));

        try {
            // Fetch the site's own root with a cache buster
            const res = await fetch(window.location.origin + '/?_sec_scan=' + Date.now(), {
                method: 'GET',
                cache: 'no-store',
            });

            const results: ScanResult[] = [];

            for (const check of HEADER_CHECKS) {
                const value = res.headers.get(check.key);
                const result = check.check(value);
                results.push({ check, value, result });
                // Stagger results for animation
                setScanResults([...results]);
                await new Promise(r => setTimeout(r, 150));
            }

            setScanTime(performance.now() - start);
            setStatus('done');
        } catch {
            setStatus('done');
            setScanTime(performance.now() - start);
        }
    }, []);

    const reset = () => {
        setStatus('idle');
        setScanResults([]);
        setScanTime(0);
    };

    // Overall grade
    const grade = calculateGrade(
        scanResults.map(r => ({ score: r.result.score, weight: r.check.weight }))
    );
    const passCount = scanResults.filter(r => r.result.pass).length;

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
                            <div className="absolute -inset-1 bg-gradient-to-br from-rose-500/15 via-amber-500/5 to-rose-500/15 rounded-3xl blur-xl opacity-60 pointer-events-none" />

                            <div className="relative flex flex-col max-h-[85vh] bg-background/95 backdrop-blur-2xl rounded-3xl border border-border/50 shadow-2xl overflow-hidden">
                                {/* Header */}
                                <div className="flex-shrink-0 bg-background/90 border-b border-border/50 p-5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 shadow-lg">
                                                <Shield className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h2 className="text-lg font-bold text-foreground">Security Scorecard</h2>
                                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-rose-500 to-amber-500 text-white rounded-full">Live</span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">Security headers analysis for {window.location.host}</p>
                                            </div>
                                        </div>
                                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground">
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                                    {/* Grade Display */}
                                    {status === 'done' && scanResults.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ type: 'spring', damping: 15 }}
                                            className="flex flex-col items-center gap-4"
                                        >
                                            <div className="relative">
                                                {/* Ring */}
                                                <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
                                                    <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
                                                    <motion.circle
                                                        cx="60" cy="60" r="52" fill="none"
                                                        stroke={grade.color}
                                                        strokeWidth="8"
                                                        strokeLinecap="round"
                                                        strokeDasharray={`${2 * Math.PI * 52}`}
                                                        initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                                                        animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - grade.percentage / 100) }}
                                                        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
                                                    />
                                                </svg>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                    <span className="text-3xl font-black" style={{ color: grade.color }}>
                                                        {grade.grade}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">{grade.percentage}%</span>
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-bold text-foreground">
                                                    {passCount}/{scanResults.length} headers configured
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Scanned in {(scanTime / 1000).toFixed(1)}s
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Header Results */}
                                    {scanResults.length > 0 && (
                                        <div className="space-y-2">
                                            {scanResults.map((sr, i) => {
                                                const Icon = sr.check.icon;
                                                return (
                                                    <motion.div
                                                        key={sr.check.key}
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.05 }}
                                                        className="p-4 rounded-xl bg-secondary/20 border border-border/50 hover:border-border/80 transition-all"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`flex-shrink-0 p-2 rounded-lg ${sr.result.pass
                                                                ? sr.result.score >= 80 ? 'bg-emerald-500/15' : 'bg-amber-500/15'
                                                                : 'bg-red-500/15'
                                                                }`}>
                                                                {sr.result.pass ? (
                                                                    sr.result.score >= 80
                                                                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                                        : <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                                ) : (
                                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                                                    <h4 className="text-sm font-semibold text-foreground">{sr.check.name}</h4>
                                                                    <div className="ml-auto flex items-center gap-1.5">
                                                                        <div className="w-16 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                                                                            <motion.div
                                                                                className="h-full rounded-full"
                                                                                style={{
                                                                                    background: sr.result.score >= 80 ? '#10b981'
                                                                                        : sr.result.score >= 50 ? '#f59e0b' : '#ef4444',
                                                                                }}
                                                                                initial={{ width: 0 }}
                                                                                animate={{ width: `${sr.result.score}%` }}
                                                                                transition={{ duration: 0.5, delay: i * 0.05 + 0.2 }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">
                                                                            {sr.result.score}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <p className="text-[11px] text-muted-foreground mb-1.5">{sr.check.description}</p>
                                                                <div className={`text-[11px] font-mono px-2 py-1 rounded-md inline-block ${sr.result.pass
                                                                    ? sr.result.score >= 80
                                                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                                                    }`}>
                                                                    {sr.result.detail}
                                                                </div>
                                                                {sr.value && (
                                                                    <details className="mt-2">
                                                                        <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                                                                            Raw header value
                                                                        </summary>
                                                                        <code className="text-[10px] text-muted-foreground font-mono break-all block mt-1 p-2 bg-secondary/30 rounded-md">
                                                                            {sr.value}
                                                                        </code>
                                                                    </details>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Idle State */}
                                    {status === 'idle' && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex flex-col items-center py-10 gap-4"
                                        >
                                            <div className="relative">
                                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 flex items-center justify-center">
                                                    <Shield className="h-10 w-10 text-rose-500" />
                                                </div>
                                                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                                                    <Lock className="h-3 w-3 text-white" />
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-semibold text-foreground mb-1">Security Headers Analysis</p>
                                                <p className="text-xs text-muted-foreground max-w-xs">
                                                    Scans {HEADER_CHECKS.length} critical security headers including HSTS, CSP, X-Frame-Options, and more
                                                </p>
                                            </div>
                                            <button
                                                onClick={runScan}
                                                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-medium text-sm hover:opacity-90 transition-opacity shadow-lg"
                                            >
                                                <Play className="h-4 w-4" />
                                                Run Scan
                                            </button>
                                        </motion.div>
                                    )}

                                    {/* Scanning State */}
                                    {status === 'scanning' && scanResults.length === 0 && (
                                        <div className="flex flex-col items-center py-10 gap-3">
                                            <Loader2 className="h-8 w-8 text-rose-500 animate-spin" />
                                            <p className="text-sm text-muted-foreground">Scanning security headers...</p>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="flex-shrink-0 px-5 py-3 border-t border-border/50 bg-background/80 flex items-center justify-between">
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                        <ShieldCheck className="h-3 w-3 text-rose-500" />
                                        Live analysis of {window.location.host}
                                    </p>
                                    <div className="flex items-center gap-3">
                                        {status === 'done' && (
                                            <button
                                                onClick={reset}
                                                className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                                            >
                                                <RotateCcw className="h-3 w-3" />
                                                Rescan
                                            </button>
                                        )}
                                        <a
                                            href="https://securityheaders.com/?q=manneharshithsiddardha.com"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                                        >
                                            Verify externally
                                            <ExternalLink className="h-2.5 w-2.5" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

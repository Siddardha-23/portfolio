import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity,
    Copy,
    Check,
    ExternalLink,
    RotateCcw,
    Zap,
    Globe,
    Server,
    Database,
    Cpu,
    Shield,
    Download,
    Clock,
    MapPin,
    HardDrive,
    X,
    Users,
    Building2,
    Linkedin,
    Map,
    UserCheck,
    Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiService, TraceResult, DeepTraceResult } from '@/lib/api';

type TraceMode = 'infra' | 'data';
type TraceState = 'idle' | 'tracing' | 'complete' | 'error';

interface WaterfallSpan {
    label: string;
    ms: number;
    color: string;
    icon: React.ReactNode;
    description: string;
    resultValue?: string;
}

// ── Build waterfall for infra trace (existing behavior) ──
function buildInfraSpans(trace: TraceResult): WaterfallSpan[] {
    const spans: WaterfallSpan[] = [];

    if (trace.client.dns_ms > 0) {
        spans.push({
            label: 'DNS Lookup',
            ms: trace.client.dns_ms,
            color: '#3b82f6',
            icon: <Globe className="h-3.5 w-3.5" />,
            description: 'Domain name resolution',
        });
    }

    if (trace.client.tcp_tls_ms > 0) {
        spans.push({
            label: 'TCP + TLS',
            ms: trace.client.tcp_tls_ms,
            color: '#06b6d4',
            icon: <Shield className="h-3.5 w-3.5" />,
            description: 'Secure connection handshake',
        });
    }

    const cfTime = Math.max(0, trace.client.ttfb_ms - trace.server.total_ms);
    if (cfTime > 0.5) {
        spans.push({
            label: 'CloudFront → API GW',
            ms: Math.round(cfTime * 100) / 100,
            color: '#f59e0b',
            icon: <Zap className="h-3.5 w-3.5" />,
            description: 'Edge routing + API Gateway overhead',
        });
    }

    if (trace.cold_start && trace.server.lambda_init_ms > 0) {
        spans.push({
            label: 'Lambda Cold Start',
            ms: trace.server.lambda_init_ms,
            color: '#ef4444',
            icon: <Cpu className="h-3.5 w-3.5" />,
            description: 'Container initialization + module loading',
        });
    }

    spans.push({
        label: 'Flask Routing',
        ms: trace.server.flask_routing_ms,
        color: '#8b5cf6',
        icon: <Server className="h-3.5 w-3.5" />,
        description: 'Request matching + middleware',
    });

    spans.push({
        label: 'MongoDB Ping',
        ms: trace.server.db_ping_ms,
        color: '#22c55e',
        icon: <Database className="h-3.5 w-3.5" />,
        description: 'Round-trip to MongoDB Atlas',
    });

    if (trace.client.download_ms > 0.1) {
        spans.push({
            label: 'Response Download',
            ms: trace.client.download_ms,
            color: '#6b7280',
            icon: <Download className="h-3.5 w-3.5" />,
            description: 'Reading response body',
        });
    }

    return spans;
}

// ── Build waterfall for deep/data trace ──
const QUERY_META: Record<string, { color: string; icon: React.ReactNode }> = {
    'Unique Visitors': { color: '#3b82f6', icon: <Users className="h-3.5 w-3.5" /> },
    'Registered Count': { color: '#8b5cf6', icon: <UserCheck className="h-3.5 w-3.5" /> },
    'Org Aggregation': { color: '#f59e0b', icon: <Building2 className="h-3.5 w-3.5" /> },
    'LinkedIn Profiles': { color: '#0a66c2', icon: <Linkedin className="h-3.5 w-3.5" /> },
    'Map Locations': { color: '#22c55e', icon: <Map className="h-3.5 w-3.5" /> },
};

function buildDeepSpans(trace: DeepTraceResult): WaterfallSpan[] {
    const spans: WaterfallSpan[] = [];

    // Network spans
    if (trace.client.dns_ms > 0) {
        spans.push({
            label: 'DNS Lookup',
            ms: trace.client.dns_ms,
            color: '#3b82f6',
            icon: <Globe className="h-3.5 w-3.5" />,
            description: 'Domain name resolution',
        });
    }

    if (trace.client.tcp_tls_ms > 0) {
        spans.push({
            label: 'TCP + TLS',
            ms: trace.client.tcp_tls_ms,
            color: '#06b6d4',
            icon: <Shield className="h-3.5 w-3.5" />,
            description: 'Secure connection handshake',
        });
    }

    const cfTime = Math.max(0, trace.client.ttfb_ms - trace.server.total_ms);
    if (cfTime > 0.5) {
        spans.push({
            label: 'CloudFront → API GW',
            ms: Math.round(cfTime * 100) / 100,
            color: '#f59e0b',
            icon: <Zap className="h-3.5 w-3.5" />,
            description: 'Edge routing + API Gateway overhead',
        });
    }

    if (trace.cold_start && trace.server.lambda_init_ms > 0) {
        spans.push({
            label: 'Lambda Cold Start',
            ms: trace.server.lambda_init_ms,
            color: '#ef4444',
            icon: <Cpu className="h-3.5 w-3.5" />,
            description: 'Container initialization + module loading',
        });
    }

    spans.push({
        label: 'Flask Routing',
        ms: trace.server.flask_routing_ms,
        color: '#a855f7',
        icon: <Server className="h-3.5 w-3.5" />,
        description: 'Request matching + middleware',
    });

    // DB query spans from server
    for (const q of trace.queries) {
        const meta = QUERY_META[q.name] ?? { color: '#6b7280', icon: <Database className="h-3.5 w-3.5" /> };
        spans.push({
            label: q.name,
            ms: q.ms,
            color: meta.color,
            icon: meta.icon,
            description: `${q.collection} · ${q.operation}`,
            resultValue: String(q.result),
        });
    }

    if (trace.client.download_ms > 0.1) {
        spans.push({
            label: 'Response Download',
            ms: trace.client.download_ms,
            color: '#6b7280',
            icon: <Download className="h-3.5 w-3.5" />,
            description: 'Reading response body',
        });
    }

    return spans;
}

// ── Waterfall bar component ──
function WaterfallBar({ span, index, maxMs }: { span: WaterfallSpan; index: number; maxMs: number }) {
    const rawPercent = (span.ms / maxMs) * 100;
    const widthPercent = Math.max(3, rawPercent);
    const isSmallBar = rawPercent < 15;
    const formattedMs = span.ms < 1 ? `${(span.ms * 1000).toFixed(0)}µs` : `${span.ms.toFixed(1)}ms`;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + index * 0.08, duration: 0.4, ease: 'easeOut' }}
            className="group flex items-center gap-3 py-1.5"
        >
            {/* Label */}
            <div className="flex items-center gap-2 w-[140px] sm:w-[170px] shrink-0">
                <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: `${span.color}20`, color: span.color }}
                >
                    {span.icon}
                </div>
                <span className="text-xs font-medium text-foreground/80 truncate">{span.label}</span>
            </div>

            {/* Bar + value */}
            <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 relative h-7 bg-secondary/30 rounded overflow-hidden">
                    <motion.div
                        className="absolute inset-y-0 left-0 rounded flex items-center"
                        style={{ background: `linear-gradient(90deg, ${span.color}CC, ${span.color}90)` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPercent}%` }}
                        transition={{ delay: 0.2 + index * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {!isSmallBar && (
                            <span className="absolute right-2 text-[10px] font-bold text-white drop-shadow-sm whitespace-nowrap">
                                {formattedMs}
                            </span>
                        )}
                    </motion.div>

                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center pointer-events-none">
                        <span className="ml-2 text-[10px] text-muted-foreground">{span.description}</span>
                    </div>
                </div>

                {isSmallBar && (
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 + index * 0.08 }}
                        className="text-[11px] font-semibold whitespace-nowrap shrink-0"
                        style={{ color: span.color }}
                    >
                        {formattedMs}
                    </motion.span>
                )}

                {/* Result value badge for data queries */}
                {span.resultValue !== undefined && (
                    <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 + index * 0.08 }}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/50 text-foreground/70 shrink-0"
                    >
                        {span.resultValue}
                    </motion.span>
                )}
            </div>
        </motion.div>
    );
}

// ── Data results summary for deep trace ──
function DataResultsSummary({ data }: { data: DeepTraceResult['data'] }) {
    const items = [
        { icon: <Users className="h-3.5 w-3.5" />, label: 'Unique Visitors', value: data.unique_visitors, color: '#3b82f6' },
        { icon: <UserCheck className="h-3.5 w-3.5" />, label: 'Registered', value: data.total_registered, color: '#8b5cf6' },
        { icon: <Building2 className="h-3.5 w-3.5" />, label: 'Organizations', value: data.organizations, color: '#f59e0b' },
        { icon: <Linkedin className="h-3.5 w-3.5" />, label: 'LinkedIn Found', value: data.linkedin_found, color: '#0a66c2' },
        { icon: <Map className="h-3.5 w-3.5" />, label: 'Locations', value: data.map_locations, color: '#22c55e' },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-3 rounded-xl bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border border-border/50"
        >
            <div className="flex items-center gap-2 mb-2.5">
                <Database className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Live Data from MongoDB Atlas
                </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
                {items.map((item) => (
                    <div key={item.label} className="text-center">
                        <div
                            className="w-7 h-7 rounded-lg mx-auto mb-1 flex items-center justify-center"
                            style={{ background: `${item.color}15`, color: item.color }}
                        >
                            {item.icon}
                        </div>
                        <div className="text-sm font-bold text-foreground">{item.value}</div>
                        <div className="text-[9px] text-muted-foreground leading-tight">{item.label}</div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}

// ── Mode toggle tabs ──
function ModeToggle({ mode, onChange }: { mode: TraceMode; onChange: (m: TraceMode) => void }) {
    return (
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-secondary/50 border border-border/50">
            {([
                { key: 'infra' as const, label: 'Infra Trace', icon: <Server className="h-3 w-3" /> },
                { key: 'data' as const, label: 'Data Query Trace', icon: <Database className="h-3 w-3" /> },
            ]).map(({ key, label, icon }) => (
                <button
                    key={key}
                    onClick={() => onChange(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                        mode === key
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {icon}
                    {label}
                </button>
            ))}
        </div>
    );
}

// ── Main component ──
export default function RequestTracer() {
    const [mode, setMode] = useState<TraceMode>('infra');
    const [state, setState] = useState<TraceState>('idle');
    const [infraTrace, setInfraTrace] = useState<TraceResult | null>(null);
    const [deepTrace, setDeepTrace] = useState<DeepTraceResult | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [copied, setCopied] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const runTrace = useCallback(async (traceMode?: TraceMode) => {
        const m = traceMode ?? mode;
        setState('tracing');
        setErrorMsg('');

        if (m === 'infra') {
            setInfraTrace(null);
            const result = await apiService.traceRequest();
            if (result.error || !result.data) {
                setState('error');
                setErrorMsg(result.error || 'Unknown error');
                return;
            }
            setInfraTrace(result.data);
        } else {
            setDeepTrace(null);
            const result = await apiService.traceDeepRequest();
            if (result.error || !result.data) {
                setState('error');
                setErrorMsg(result.error || 'Unknown error');
                return;
            }
            setDeepTrace(result.data);
        }

        setState('complete');
    }, [mode]);

    const handleStart = useCallback(() => {
        setIsOpen(true);
        runTrace();
    }, [runTrace]);

    const handleModeChange = useCallback((m: TraceMode) => {
        setMode(m);
        runTrace(m);
    }, [runTrace]);

    const handleCopy = useCallback(async (text: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, []);

    // Derive spans and metadata based on mode
    const activeTrace = mode === 'infra' ? infraTrace : deepTrace;
    const spans = activeTrace
        ? (mode === 'infra'
            ? buildInfraSpans(activeTrace as TraceResult)
            : buildDeepSpans(activeTrace as DeepTraceResult))
        : [];
    const maxMs = spans.length > 0 ? Math.max(...spans.map(s => s.ms), 1) : 1;
    const totalClientMs = activeTrace
        ? (mode === 'infra'
            ? (activeTrace as TraceResult).client.total_ms
            : (activeTrace as DeepTraceResult).client.total_ms)
        : 0;

    return (
        <>
            {/* ── Trigger Card ── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="w-full"
            >
                <div className="relative group cursor-pointer" onClick={handleStart}>
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/10 to-primary/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="relative p-5 sm:p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300 shadow-lg hover:shadow-xl overflow-hidden">
                        <div className="absolute inset-0 opacity-5">
                            <div className="absolute inset-0" style={{
                                backgroundImage: 'repeating-linear-gradient(90deg, hsl(var(--primary)) 0px, hsl(var(--primary)) 1px, transparent 1px, transparent 20px)',
                                backgroundSize: '20px 100%',
                            }} />
                        </div>

                        <div className="relative flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <Activity className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                                    Trace a Live Request
                                    <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
                                        LIVE
                                    </Badge>
                                </h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    See your request travel through CloudFront → Lambda → MongoDB in real time
                                </p>
                            </div>
                            <div className="hidden sm:flex items-center gap-1 text-xs text-primary font-medium">
                                <Zap className="h-3.5 w-3.5" />
                                Try it
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* ── Waterfall Modal ── */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                            onClick={() => setIsOpen(false)}
                        />

                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="w-full max-w-2xl max-h-[85vh] bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/50 shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                                            <Activity className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-foreground">Request Trace</h3>
                                            <p className="text-xs text-muted-foreground">Distributed tracing waterfall</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                {/* Mode toggle */}
                                <div className="flex items-center justify-center px-4 sm:px-5 pt-4 shrink-0">
                                    <ModeToggle mode={mode} onChange={handleModeChange} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                                    <AnimatePresence mode="wait">
                                        {/* Tracing state */}
                                        {state === 'tracing' && (
                                            <motion.div
                                                key="tracing"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="flex flex-col items-center justify-center py-16 gap-6"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {(mode === 'infra'
                                                        ? ['Browser', 'CloudFront', 'API GW', 'Lambda', 'MongoDB']
                                                        : ['Browser', 'CloudFront', 'Lambda', 'MongoDB', 'Aggregation']
                                                    ).map((label, i) => (
                                                        <motion.div
                                                            key={label}
                                                            className="flex items-center gap-2"
                                                            initial={{ opacity: 0.3 }}
                                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                                            transition={{
                                                                duration: 1.5,
                                                                delay: i * 0.3,
                                                                repeat: Infinity,
                                                                ease: 'easeInOut',
                                                            }}
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                                {[
                                                                    <Globe key="g" className="h-4 w-4 text-primary" />,
                                                                    <Zap key="z" className="h-4 w-4 text-amber-500" />,
                                                                    ...(mode === 'infra'
                                                                        ? [<Server key="s" className="h-4 w-4 text-orange-500" />]
                                                                        : []),
                                                                    <Cpu key="c" className="h-4 w-4 text-purple-500" />,
                                                                    <Database key="d" className="h-4 w-4 text-emerald-500" />,
                                                                    ...(mode === 'data'
                                                                        ? [<Layers key="l" className="h-4 w-4 text-blue-500" />]
                                                                        : []),
                                                                ][i]}
                                                            </div>
                                                            {i < 4 && (
                                                                <motion.div
                                                                    className="w-4 h-0.5 bg-primary/30 rounded-full"
                                                                    animate={{ scaleX: [0.5, 1, 0.5], opacity: [0.3, 0.8, 0.3] }}
                                                                    transition={{ duration: 1, delay: i * 0.3, repeat: Infinity }}
                                                                />
                                                            )}
                                                        </motion.div>
                                                    ))}
                                                </div>
                                                <div className="text-sm text-muted-foreground animate-pulse">
                                                    {mode === 'infra'
                                                        ? 'Tracing request through infrastructure...'
                                                        : 'Running live database queries...'}
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Error state */}
                                        {state === 'error' && (
                                            <motion.div
                                                key="error"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="flex flex-col items-center justify-center py-12 gap-4"
                                            >
                                                <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
                                                    <X className="h-7 w-7 text-red-500" />
                                                </div>
                                                <p className="text-sm text-muted-foreground text-center">{errorMsg}</p>
                                                <Button variant="outline" size="sm" onClick={() => runTrace()}>
                                                    <RotateCcw className="h-4 w-4 mr-2" /> Retry
                                                </Button>
                                            </motion.div>
                                        )}

                                        {/* Complete state — waterfall */}
                                        {state === 'complete' && activeTrace && (
                                            <motion.div
                                                key={`complete-${mode}`}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="space-y-5"
                                            >
                                                {/* Summary row */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                                                        <Check className="h-3 w-3 mr-1" />
                                                        {totalClientMs.toFixed(0)}ms total
                                                    </Badge>
                                                    {activeTrace.cold_start && (
                                                        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30">
                                                            <Cpu className="h-3 w-3 mr-1" />
                                                            Cold Start
                                                        </Badge>
                                                    )}
                                                    <Badge className="bg-primary/10 text-primary border-primary/30">
                                                        <Server className="h-3 w-3 mr-1" />
                                                        {activeTrace.server.total_ms.toFixed(1)}ms server
                                                    </Badge>
                                                    {mode === 'data' && (
                                                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                                                            <Database className="h-3 w-3 mr-1" />
                                                            {(activeTrace as DeepTraceResult).server.total_db_ms.toFixed(1)}ms queries
                                                        </Badge>
                                                    )}
                                                    {activeTrace.xray.enabled && (
                                                        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                                                            <Activity className="h-3 w-3 mr-1" />
                                                            X-Ray Active
                                                        </Badge>
                                                    )}
                                                    {mode === 'data' && (
                                                        <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                                                            <Layers className="h-3 w-3 mr-1" />
                                                            {(activeTrace as DeepTraceResult).queries.length} queries
                                                        </Badge>
                                                    )}
                                                </div>

                                                {/* Data results summary (deep mode only) */}
                                                {mode === 'data' && (activeTrace as DeepTraceResult).data && (
                                                    <DataResultsSummary data={(activeTrace as DeepTraceResult).data} />
                                                )}

                                                {/* Waterfall */}
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                            {mode === 'infra' ? 'Waterfall' : 'Query Waterfall'}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {spans.length} spans · max {maxMs.toFixed(1)}ms
                                                        </span>
                                                    </div>
                                                    {spans.map((span, i) => (
                                                        <WaterfallBar key={`${mode}-${span.label}`} span={span} index={i} maxMs={maxMs} />
                                                    ))}
                                                </div>

                                                {/* Lambda metadata */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                    {[
                                                        { icon: <MapPin className="h-3.5 w-3.5" />, label: 'Region', value: activeTrace.lambda.region, color: '#8b5cf6' },
                                                        { icon: <HardDrive className="h-3.5 w-3.5" />, label: 'Memory', value: activeTrace.lambda.memory_mb ? `${activeTrace.lambda.memory_mb}MB` : 'N/A', color: '#f59e0b' },
                                                        { icon: <Clock className="h-3.5 w-3.5" />, label: 'Server Time', value: `${activeTrace.server.total_ms.toFixed(1)}ms`, color: '#22c55e' },
                                                        {
                                                            icon: <Database className="h-3.5 w-3.5" />,
                                                            label: 'DB Status',
                                                            value: mode === 'infra'
                                                                ? (activeTrace as TraceResult).server.db_status
                                                                : (activeTrace as DeepTraceResult).server.db_status,
                                                            color: '#3b82f6',
                                                        },
                                                    ].map((item) => (
                                                        <div
                                                            key={item.label}
                                                            className="p-2.5 rounded-xl bg-secondary/30 border border-border/50 text-center"
                                                        >
                                                            <div
                                                                className="w-7 h-7 rounded-lg mx-auto mb-1.5 flex items-center justify-center"
                                                                style={{ background: `${item.color}15`, color: item.color }}
                                                            >
                                                                {item.icon}
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground uppercase">{item.label}</div>
                                                            <div className="text-xs font-semibold text-foreground mt-0.5 truncate">{item.value}</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Trace IDs */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border/50">
                                                        <span className="text-[10px] text-muted-foreground uppercase shrink-0">Trace ID</span>
                                                        <code className="text-xs font-mono text-foreground/80 flex-1 truncate">
                                                            {activeTrace.trace_id}
                                                        </code>
                                                        <button
                                                            onClick={() => handleCopy(activeTrace.trace_id)}
                                                            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                                                        >
                                                            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                                        </button>
                                                    </div>

                                                    {activeTrace.xray.enabled && activeTrace.xray.trace_id && (
                                                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                                            <Activity className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                                            <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase shrink-0">X-Ray</span>
                                                            <code className="text-xs font-mono text-foreground/80 flex-1 truncate">
                                                                {activeTrace.xray.trace_id}
                                                            </code>
                                                            {activeTrace.xray.console_url && (
                                                                <a
                                                                    href={activeTrace.xray.console_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="w-7 h-7 rounded-md flex items-center justify-center text-amber-500 hover:bg-amber-500/10 transition-colors shrink-0"
                                                                >
                                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Re-trace */}
                                                <Button
                                                    variant="outline"
                                                    className="w-full border-primary/30 text-primary hover:bg-primary/10 group"
                                                    onClick={() => runTrace()}
                                                >
                                                    <RotateCcw className="h-4 w-4 mr-2 group-hover:-rotate-180 transition-transform duration-500" />
                                                    Trace Again
                                                </Button>
                                            </motion.div>
                                        )}

                                        {/* Idle state */}
                                        {state === 'idle' && (
                                            <motion.div
                                                key="idle"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="flex flex-col items-center justify-center py-12 gap-4"
                                            >
                                                <Button className="btn-premium" onClick={() => runTrace()}>
                                                    <Zap className="h-4 w-4 mr-2" /> Start Trace
                                                </Button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Footer */}
                                <div className="p-3 sm:p-4 border-t border-border/50 bg-secondary/20 shrink-0">
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Activity className="h-3 w-3" />
                                            Powered by AWS X-Ray + Resource Timing API
                                        </span>
                                        {activeTrace && (
                                            <span>
                                                {new Date(activeTrace.timestamp).toLocaleTimeString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

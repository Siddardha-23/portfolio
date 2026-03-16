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
    FileCode,
    MonitorPlay,
    Route,
    HardDriveDownload,
    type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiService, TraceResult, DeepTraceResult, PageLoadTraceResult } from '@/lib/api';

type TraceMode = 'pageload' | 'infra' | 'data';
type TraceState = 'idle' | 'tracing' | 'complete' | 'error';

interface WaterfallSpan {
    label: string;
    ms: number;
    color: string;
    icon: React.ReactNode;
    description: string;
    resultValue?: string;
    group?: string;
}

// ── Build waterfall for infra trace ──
function buildInfraSpans(trace: TraceResult): WaterfallSpan[] {
    const spans: WaterfallSpan[] = [];

    if (trace.client.dns_ms > 0) {
        spans.push({ label: 'DNS Lookup', ms: trace.client.dns_ms, color: '#3b82f6', icon: <Globe className="h-3.5 w-3.5" />, description: 'Domain name resolution (Route 53)' });
    }
    if (trace.client.tcp_tls_ms > 0) {
        spans.push({ label: 'TCP + TLS', ms: trace.client.tcp_tls_ms, color: '#06b6d4', icon: <Shield className="h-3.5 w-3.5" />, description: 'Secure connection handshake (TLSv1.2)' });
    }
    const cfTime = Math.max(0, trace.client.ttfb_ms - trace.server.total_ms);
    if (cfTime > 0.5) {
        spans.push({ label: 'CloudFront → API GW', ms: Math.round(cfTime * 100) / 100, color: '#f59e0b', icon: <Zap className="h-3.5 w-3.5" />, description: 'Edge routing + API Gateway overhead' });
    }
    if (trace.cold_start && trace.server.lambda_init_ms > 0) {
        spans.push({ label: 'Lambda Cold Start', ms: trace.server.lambda_init_ms, color: '#ef4444', icon: <Cpu className="h-3.5 w-3.5" />, description: 'Container init + module loading + X-Ray SDK' });
    }
    spans.push({ label: 'Flask Routing', ms: trace.server.flask_routing_ms, color: '#8b5cf6', icon: <Server className="h-3.5 w-3.5" />, description: 'Request matching + middleware chain' });
    spans.push({ label: 'MongoDB Ping', ms: trace.server.db_ping_ms, color: '#22c55e', icon: <Database className="h-3.5 w-3.5" />, description: 'Round-trip to MongoDB Atlas' });
    if (trace.client.download_ms > 0.1) {
        spans.push({ label: 'Response Download', ms: trace.client.download_ms, color: '#6b7280', icon: <Download className="h-3.5 w-3.5" />, description: 'Reading response body' });
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
    if (trace.client.dns_ms > 0) {
        spans.push({ label: 'DNS Lookup', ms: trace.client.dns_ms, color: '#3b82f6', icon: <Globe className="h-3.5 w-3.5" />, description: 'Domain name resolution' });
    }
    if (trace.client.tcp_tls_ms > 0) {
        spans.push({ label: 'TCP + TLS', ms: trace.client.tcp_tls_ms, color: '#06b6d4', icon: <Shield className="h-3.5 w-3.5" />, description: 'Secure connection handshake' });
    }
    const cfTime = Math.max(0, trace.client.ttfb_ms - trace.server.total_ms);
    if (cfTime > 0.5) {
        spans.push({ label: 'CloudFront → API GW', ms: Math.round(cfTime * 100) / 100, color: '#f59e0b', icon: <Zap className="h-3.5 w-3.5" />, description: 'Edge routing + API Gateway overhead' });
    }
    if (trace.cold_start && trace.server.lambda_init_ms > 0) {
        spans.push({ label: 'Lambda Cold Start', ms: trace.server.lambda_init_ms, color: '#ef4444', icon: <Cpu className="h-3.5 w-3.5" />, description: 'Container initialization + module loading' });
    }
    spans.push({ label: 'Flask Routing', ms: trace.server.flask_routing_ms, color: '#a855f7', icon: <Server className="h-3.5 w-3.5" />, description: 'Request matching + middleware' });
    for (const q of trace.queries) {
        const meta = QUERY_META[q.name] ?? { color: '#6b7280', icon: <Database className="h-3.5 w-3.5" /> };
        spans.push({ label: q.name, ms: q.ms, color: meta.color, icon: meta.icon, description: `${q.collection} · ${q.operation}`, resultValue: String(q.result) });
    }
    if (trace.client.download_ms > 0.1) {
        spans.push({ label: 'Response Download', ms: trace.client.download_ms, color: '#6b7280', icon: <Download className="h-3.5 w-3.5" />, description: 'Reading response body' });
    }
    return spans;
}

// ── Build waterfall for PAGE LOAD trace ──
function buildPageLoadSpans(trace: PageLoadTraceResult): WaterfallSpan[] {
    const spans: WaterfallSpan[] = [];
    const nav = trace.navigation;
    const container = trace.container;

    // Phase 1: Network (document fetch - Route 53 -> CloudFront -> S3)
    if (nav.redirect_ms > 0.5) {
        spans.push({ label: 'Redirect', ms: nav.redirect_ms, color: '#9ca3af', icon: <Route className="h-3.5 w-3.5" />, description: 'HTTP redirect (www → root)', group: 'Document' });
    }
    if (nav.dns_ms > 0) {
        spans.push({ label: 'Route 53 DNS', ms: nav.dns_ms, color: '#8b5cf6', icon: <Globe className="h-3.5 w-3.5" />, description: 'DNS resolution via Route 53 (A + AAAA alias)', group: 'Document' });
    }
    if (nav.tcp_ms > 0) {
        spans.push({ label: 'TCP Connect', ms: nav.tcp_ms, color: '#06b6d4', icon: <Shield className="h-3.5 w-3.5" />, description: 'TCP handshake to CloudFront edge', group: 'Document' });
    }
    if (nav.tls_ms > 0) {
        spans.push({ label: 'TLS Handshake', ms: nav.tls_ms, color: '#0ea5e9', icon: <Shield className="h-3.5 w-3.5" />, description: 'TLS 1.2 negotiation (ACM certificate)', group: 'Document' });
    }
    if (nav.ttfb_ms > 0) {
        spans.push({ label: 'CloudFront → S3 TTFB', ms: nav.ttfb_ms, color: '#f59e0b', icon: <Zap className="h-3.5 w-3.5" />, description: 'Time to first byte: CloudFront edge → S3 origin (OAC SigV4)', group: 'Document' });
    }
    if (nav.document_download_ms > 0.1) {
        spans.push({ label: 'HTML Download', ms: nav.document_download_ms, color: '#10b981', icon: <HardDriveDownload className="h-3.5 w-3.5" />, description: 'index.html transfer from CloudFront cache/S3', group: 'Document' });
    }

    // Phase 2: Parsing & Rendering
    if (nav.dom_parse_ms > 0) {
        spans.push({ label: 'DOM Parse + Scripts', ms: nav.dom_parse_ms, color: '#f97316', icon: <FileCode className="h-3.5 w-3.5" />, description: 'HTML parsing, JS execution, React hydration', group: 'Render' });
    }

    // Phase 3: Lambda container lifecycle
    if (container.is_warm) {
        // Warm container - show a minimal span indicating reuse, not the historical cold start
        spans.push({
            label: 'Lambda Container (warm)',
            ms: 0,
            color: '#22c55e',
            icon: <Zap className="h-3.5 w-3.5" />,
            description: `Container reused - no init needed (booted ${container.cold_start_init_ms.toFixed(0)}ms ago on first request)`,
            group: 'Lambda',
        });
    } else if (container.cold_start_init_ms > 0) {
        // Actual cold start on this request
        spans.push({
            label: 'Lambda Cold Start',
            ms: container.cold_start_init_ms,
            color: '#ef4444',
            icon: <Cpu className="h-3.5 w-3.5" />,
            description: 'Container initialization + Flask + X-Ray SDK + PyMongo patching',
            group: 'Lambda',
        });
    }

    // Phase 4: Current request to /trace/pageload (API call latency)
    spans.push({ label: 'Flask Routing', ms: trace.server.flask_routing_ms, color: '#a855f7', icon: <Server className="h-3.5 w-3.5" />, description: 'Trace endpoint request matching', group: 'Lambda' });
    spans.push({ label: 'MongoDB Atlas Ping', ms: trace.server.db_ping_ms, color: '#22c55e', icon: <Database className="h-3.5 w-3.5" />, description: 'Round-trip latency to MongoDB Atlas cluster', group: 'Lambda' });

    return spans;
}

// ── Waterfall bar component ──
function WaterfallBar({ span, index, maxMs }: { span: WaterfallSpan; index: number; maxMs: number }) {
    const isWarmStatus = span.ms === 0;
    const rawPercent = isWarmStatus ? 0 : (span.ms / maxMs) * 100;
    const widthPercent = Math.max(3, rawPercent);
    const isSmallBar = rawPercent < 15;
    const formattedMs = span.ms < 1 ? `${(span.ms * 1000).toFixed(0)}µs` : `${span.ms.toFixed(1)}ms`;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + index * 0.07, duration: 0.4, ease: 'easeOut' }}
            className="group flex items-center gap-3 py-1.5"
        >
            <div className="flex items-center gap-2 w-[140px] sm:w-[170px] shrink-0">
                <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: `${span.color}20`, color: span.color }}>
                    {span.icon}
                </div>
                <span className="text-xs font-medium text-foreground/80 truncate">{span.label}</span>
            </div>
            <div className="flex-1 flex items-center gap-2">
                {isWarmStatus ? (
                    <div className="flex-1 relative h-7 bg-emerald-500/10 rounded overflow-hidden flex items-center px-3 border border-emerald-500/20">
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{span.description}</span>
                    </div>
                ) : (
                <>
                <div className="flex-1 relative h-7 bg-secondary/30 rounded overflow-hidden">
                    <motion.div
                        className="absolute inset-y-0 left-0 rounded flex items-center"
                        style={{ background: `linear-gradient(90deg, ${span.color}CC, ${span.color}90)` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPercent}%` }}
                        transition={{ delay: 0.15 + index * 0.07, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {!isSmallBar && (
                            <span className="absolute right-2 text-[10px] font-bold text-white drop-shadow-sm whitespace-nowrap">{formattedMs}</span>
                        )}
                    </motion.div>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center pointer-events-none">
                        <span className="ml-2 text-[10px] text-muted-foreground">{span.description}</span>
                    </div>
                </div>
                {isSmallBar && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + index * 0.07 }} className="text-[11px] font-semibold whitespace-nowrap shrink-0" style={{ color: span.color }}>
                        {formattedMs}
                    </motion.span>
                )}
                </>
                )}
                {span.resultValue !== undefined && (
                    <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 + index * 0.07 }} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/50 text-foreground/70 shrink-0">
                        {span.resultValue}
                    </motion.span>
                )}
            </div>
        </motion.div>
    );
}

// ── Group divider for page load waterfall ──
function SpanGroupHeader({ label, index }: { label: string; index: number }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 + index * 0.07 }}
            className="flex items-center gap-2 pt-2 pb-0.5"
        >
            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">{label}</span>
            <div className="flex-1 h-px bg-border/50" />
        </motion.div>
    );
}

// ── Infrastructure summary for page load ──
function InfraSummary({ infra }: { infra: PageLoadTraceResult['infrastructure'] }) {
    const items: { icon: LucideIcon; label: string; value: string; color: string }[] = [
        { icon: Globe, label: 'DNS', value: 'Route 53', color: '#8b5cf6' },
        { icon: Zap, label: 'CDN', value: 'CloudFront', color: '#f59e0b' },
        { icon: HardDrive, label: 'Static', value: 'S3 + OAC', color: '#10b981' },
        { icon: Server, label: 'API', value: 'API GW → Lambda', color: '#3b82f6' },
        { icon: Database, label: 'DB', value: 'MongoDB Atlas', color: '#22c55e' },
        { icon: Activity, label: 'Tracing', value: 'X-Ray Active', color: '#f59e0b' },
        { icon: Shield, label: 'Security', value: 'HSTS + CSP', color: '#ef4444' },
        { icon: Cpu, label: 'Runtime', value: infra.compute.replace('Lambda ', ''), color: '#a855f7' },
    ];

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-3 rounded-xl bg-gradient-to-r from-amber-500/5 via-primary/5 to-emerald-500/5 border border-border/50">
            <div className="flex items-center gap-2 mb-2.5">
                <Route className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Live Infrastructure Stack</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
                {items.map((item) => (
                    <div key={item.label} className="text-center">
                        <div className="w-6 h-6 rounded-md mx-auto mb-1 flex items-center justify-center" style={{ background: `${item.color}15`, color: item.color }}>
                            <item.icon className="h-3 w-3" />
                        </div>
                        <div className="text-[10px] font-semibold text-foreground truncate">{item.value}</div>
                        <div className="text-[8px] text-muted-foreground">{item.label}</div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}

// ── Resource breakdown for page load ──
function ResourceBreakdown({ resources }: { resources: PageLoadTraceResult['resources'] }) {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="p-3 rounded-xl bg-secondary/20 border border-border/50">
            <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                    <MonitorPlay className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Page Resources</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{resources.total_resources} files · {resources.total_transfer_kb}KB</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Scripts', items: resources.scripts, color: '#f59e0b', icon: FileCode },
                    { label: 'Styles', items: resources.styles, color: '#3b82f6', icon: Layers },
                    { label: 'API Calls', items: resources.api_calls, color: '#22c55e', icon: Server },
                    { label: 'Fonts', items: resources.fonts, color: '#a855f7', icon: Globe },
                ].map(({ label, items, color, icon: Icon }) => (
                    <div key={label}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <Icon className="h-3 w-3" style={{ color }} />
                            <span className="text-[10px] font-medium text-foreground/80">{label}</span>
                            <span className="text-[9px] text-muted-foreground ml-auto">{items.length}</span>
                        </div>
                        <div className="space-y-0.5">
                            {items.slice(0, 3).map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-[9px]">
                                    <span className="text-muted-foreground truncate mr-1 max-w-[80px]">{item.name}</span>
                                    <span className="font-mono shrink-0" style={{ color }}>{item.duration.toFixed(0)}ms</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
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
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-3 rounded-xl bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border border-border/50">
            <div className="flex items-center gap-2 mb-2.5">
                <Database className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Live Data from MongoDB Atlas</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
                {items.map((item) => (
                    <div key={item.label} className="text-center">
                        <div className="w-7 h-7 rounded-lg mx-auto mb-1 flex items-center justify-center" style={{ background: `${item.color}15`, color: item.color }}>{item.icon}</div>
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
                { key: 'pageload' as const, label: 'Page Load', icon: <MonitorPlay className="h-3 w-3" /> },
                { key: 'infra' as const, label: 'Infra Trace', icon: <Server className="h-3 w-3" /> },
                { key: 'data' as const, label: 'Data Queries', icon: <Database className="h-3 w-3" /> },
            ]).map(({ key, label, icon }) => (
                <button
                    key={key}
                    onClick={() => onChange(key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                        mode === key
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {icon}
                    <span className="hidden sm:inline">{label}</span>
                </button>
            ))}
        </div>
    );
}

// ── Loading animation icons per mode ──
const LOADING_STEPS: Record<TraceMode, string[]> = {
    pageload: ['Route 53', 'CloudFront', 'S3', 'Lambda', 'MongoDB'],
    infra: ['Browser', 'CloudFront', 'API GW', 'Lambda', 'MongoDB'],
    data: ['Browser', 'CloudFront', 'Lambda', 'MongoDB', 'Aggregation'],
};

const LOADING_ICONS = [
    <Globe key="g" className="h-4 w-4 text-primary" />,
    <Zap key="z" className="h-4 w-4 text-amber-500" />,
    <HardDrive key="h" className="h-4 w-4 text-emerald-500" />,
    <Cpu key="c" className="h-4 w-4 text-purple-500" />,
    <Database key="d" className="h-4 w-4 text-emerald-500" />,
];

const LOADING_TEXT: Record<TraceMode, string> = {
    pageload: 'Analyzing your page load journey...',
    infra: 'Tracing request through infrastructure...',
    data: 'Running live database queries...',
};

// ── Main component ──
export default function RequestTracer() {
    const [mode, setMode] = useState<TraceMode>('pageload');
    const [state, setState] = useState<TraceState>('idle');
    const [infraTrace, setInfraTrace] = useState<TraceResult | null>(null);
    const [deepTrace, setDeepTrace] = useState<DeepTraceResult | null>(null);
    const [pageLoadTrace, setPageLoadTrace] = useState<PageLoadTraceResult | null>(null);
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
            if (result.error || !result.data) { setState('error'); setErrorMsg(result.error || 'Unknown error'); return; }
            setInfraTrace(result.data);
        } else if (m === 'data') {
            setDeepTrace(null);
            const result = await apiService.traceDeepRequest();
            if (result.error || !result.data) { setState('error'); setErrorMsg(result.error || 'Unknown error'); return; }
            setDeepTrace(result.data);
        } else {
            setPageLoadTrace(null);
            const result = await apiService.tracePageLoad();
            if (result.error || !result.data) { setState('error'); setErrorMsg(result.error || 'Unknown error'); return; }
            setPageLoadTrace(result.data);
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

    // Derive active trace + spans based on mode
    const activeTrace = mode === 'infra' ? infraTrace : mode === 'data' ? deepTrace : pageLoadTrace;

    const spans = activeTrace
        ? (mode === 'infra'
            ? buildInfraSpans(activeTrace as TraceResult)
            : mode === 'data'
                ? buildDeepSpans(activeTrace as DeepTraceResult)
                : buildPageLoadSpans(activeTrace as PageLoadTraceResult))
        : [];
    const maxMs = spans.length > 0 ? Math.max(...spans.map(s => s.ms), 1) : 1;

    const totalClientMs = activeTrace
        ? (mode === 'pageload'
            ? (activeTrace as PageLoadTraceResult).navigation.page_load_ms
            : mode === 'infra'
                ? (activeTrace as TraceResult).client.total_ms
                : (activeTrace as DeepTraceResult).client.total_ms)
        : 0;

    // Group spans for page load mode
    const renderSpans = () => {
        if (mode !== 'pageload') {
            return spans.map((span, i) => <WaterfallBar key={`${mode}-${span.label}`} span={span} index={i} maxMs={maxMs} />);
        }
        let lastGroup = '';
        const elements: React.ReactNode[] = [];
        let globalIdx = 0;
        for (const span of spans) {
            if (span.group && span.group !== lastGroup) {
                elements.push(<SpanGroupHeader key={`grp-${span.group}`} label={span.group} index={globalIdx} />);
                lastGroup = span.group;
            }
            elements.push(<WaterfallBar key={`${mode}-${span.label}`} span={span} index={globalIdx} maxMs={maxMs} />);
            globalIdx++;
        }
        return elements;
    };

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
                                    <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">LIVE</Badge>
                                </h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    See your request travel through Route 53 → CloudFront → S3 → Lambda → MongoDB
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
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setIsOpen(false)} />
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
                                            <p className="text-xs text-muted-foreground">Distributed tracing · AWS X-Ray</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
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
                                        {state === 'tracing' && (
                                            <motion.div key="tracing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-16 gap-6">
                                                <div className="flex items-center gap-2">
                                                    {LOADING_STEPS[mode].map((label, i) => (
                                                        <motion.div key={label} className="flex items-center gap-2" initial={{ opacity: 0.3 }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}>
                                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">{LOADING_ICONS[i]}</div>
                                                            {i < 4 && <motion.div className="w-4 h-0.5 bg-primary/30 rounded-full" animate={{ scaleX: [0.5, 1, 0.5], opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 1, delay: i * 0.3, repeat: Infinity }} />}
                                                        </motion.div>
                                                    ))}
                                                </div>
                                                <div className="text-sm text-muted-foreground animate-pulse">{LOADING_TEXT[mode]}</div>
                                            </motion.div>
                                        )}

                                        {state === 'error' && (
                                            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-12 gap-4">
                                                <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center"><X className="h-7 w-7 text-red-500" /></div>
                                                <p className="text-sm text-muted-foreground text-center">{errorMsg}</p>
                                                <Button variant="outline" size="sm" onClick={() => runTrace()}><RotateCcw className="h-4 w-4 mr-2" /> Retry</Button>
                                            </motion.div>
                                        )}

                                        {state === 'complete' && activeTrace && (
                                            <motion.div key={`complete-${mode}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                                                {/* Summary badges */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                                                        <Check className="h-3 w-3 mr-1" />
                                                        {totalClientMs.toFixed(0)}ms {mode === 'pageload' ? 'page load' : 'total'}
                                                    </Badge>
                                                    {mode === 'pageload' && (activeTrace as PageLoadTraceResult).container.is_warm && (
                                                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                                                            <Zap className="h-3 w-3 mr-1" />
                                                            Warm Container
                                                        </Badge>
                                                    )}
                                                    {mode === 'pageload' && !(activeTrace as PageLoadTraceResult).container.is_warm && (activeTrace as PageLoadTraceResult).container.cold_start_init_ms > 0 && (
                                                        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30">
                                                            <Cpu className="h-3 w-3 mr-1" />
                                                            Cold Start ({(activeTrace as PageLoadTraceResult).container.cold_start_init_ms.toFixed(0)}ms)
                                                        </Badge>
                                                    )}
                                                    {mode !== 'pageload' && activeTrace.cold_start && (
                                                        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30">
                                                            <Cpu className="h-3 w-3 mr-1" />Cold Start
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
                                                            <Activity className="h-3 w-3 mr-1" />X-Ray
                                                        </Badge>
                                                    )}
                                                    {mode === 'pageload' && (
                                                        <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                                                            <MonitorPlay className="h-3 w-3 mr-1" />
                                                            {(activeTrace as PageLoadTraceResult).resources.total_resources} resources
                                                        </Badge>
                                                    )}
                                                    {mode === 'data' && (
                                                        <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                                                            <Layers className="h-3 w-3 mr-1" />
                                                            {(activeTrace as DeepTraceResult).queries.length} queries
                                                        </Badge>
                                                    )}
                                                </div>

                                                {/* Page load: Infrastructure summary */}
                                                {mode === 'pageload' && (
                                                    <InfraSummary infra={(activeTrace as PageLoadTraceResult).infrastructure} />
                                                )}

                                                {/* Data: results summary */}
                                                {mode === 'data' && (activeTrace as DeepTraceResult).data && (
                                                    <DataResultsSummary data={(activeTrace as DeepTraceResult).data} />
                                                )}

                                                {/* Waterfall */}
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                            {mode === 'pageload' ? 'Page Load Waterfall' : mode === 'data' ? 'Query Waterfall' : 'Waterfall'}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {spans.length} spans · max {maxMs.toFixed(1)}ms
                                                        </span>
                                                    </div>
                                                    {renderSpans()}
                                                </div>

                                                {/* Page load: Resource breakdown */}
                                                {mode === 'pageload' && (
                                                    <ResourceBreakdown resources={(activeTrace as PageLoadTraceResult).resources} />
                                                )}

                                                {/* Lambda metadata grid */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                    {[
                                                        { icon: <MapPin className="h-3.5 w-3.5" />, label: 'Region', value: activeTrace.lambda.region, color: '#8b5cf6' },
                                                        { icon: <HardDrive className="h-3.5 w-3.5" />, label: 'Memory', value: activeTrace.lambda.memory_mb ? `${activeTrace.lambda.memory_mb}MB` : 'N/A', color: '#f59e0b' },
                                                        { icon: <Clock className="h-3.5 w-3.5" />, label: 'Server Time', value: `${activeTrace.server.total_ms.toFixed(1)}ms`, color: '#22c55e' },
                                                        {
                                                            icon: <Database className="h-3.5 w-3.5" />, label: 'DB Status',
                                                            value: 'db_ping_ms' in activeTrace.server
                                                                ? (activeTrace.server as TraceResult['server']).db_status
                                                                : (activeTrace as DeepTraceResult).server.db_status,
                                                            color: '#3b82f6',
                                                        },
                                                    ].map((item) => (
                                                        <div key={item.label} className="p-2.5 rounded-xl bg-secondary/30 border border-border/50 text-center">
                                                            <div className="w-7 h-7 rounded-lg mx-auto mb-1.5 flex items-center justify-center" style={{ background: `${item.color}15`, color: item.color }}>
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
                                                        <code className="text-xs font-mono text-foreground/80 flex-1 truncate">{activeTrace.trace_id}</code>
                                                        <button onClick={() => handleCopy(activeTrace.trace_id)} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0">
                                                            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                                        </button>
                                                    </div>
                                                    {activeTrace.xray.enabled && activeTrace.xray.trace_id && (
                                                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                                            <Activity className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                                            <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase shrink-0">X-Ray</span>
                                                            <code className="text-xs font-mono text-foreground/80 flex-1 truncate">{activeTrace.xray.trace_id}</code>
                                                            {activeTrace.xray.console_url && (
                                                                <a href={activeTrace.xray.console_url} target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-md flex items-center justify-center text-amber-500 hover:bg-amber-500/10 transition-colors shrink-0">
                                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Re-trace */}
                                                <Button variant="outline" className="w-full border-primary/30 text-primary hover:bg-primary/10 group" onClick={() => runTrace()}>
                                                    <RotateCcw className="h-4 w-4 mr-2 group-hover:-rotate-180 transition-transform duration-500" />
                                                    Trace Again
                                                </Button>
                                            </motion.div>
                                        )}

                                        {state === 'idle' && (
                                            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 gap-4">
                                                <Button className="btn-premium" onClick={() => runTrace()}><Zap className="h-4 w-4 mr-2" /> Start Trace</Button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Footer */}
                                <div className="p-3 sm:p-4 border-t border-border/50 bg-secondary/20 shrink-0">
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Activity className="h-3 w-3" />
                                            AWS X-Ray · Navigation Timing API · Resource Timing API
                                        </span>
                                        {activeTrace && <span>{new Date(activeTrace.timestamp).toLocaleTimeString()}</span>}
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

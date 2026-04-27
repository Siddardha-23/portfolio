/**
 * SectionAnalytics - Beautiful analytics dashboard showing visitor engagement data
 * 
 * Displays time spent in each section, engagement distribution, and trends.
 * Accessible via a "Beta" button on the home screen.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid,
    PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from 'recharts';
import {
    X, Clock, Eye, TrendingUp, Users, Flame, BarChart3,
    Sparkles, Activity, ChevronRight
} from 'lucide-react';
import { apiService } from '@/lib/api';

interface SectionData {
    id: string;
    label: string;
    avg_time_ms: number;
    avg_time_sec: number;
    total_time_ms: number;
    total_visits: number;
    session_count: number;
    max_time_ms: number;
    min_time_ms: number;
    engagement_pct: number;
}

interface AnalyticsData {
    total_sessions: number;
    sections: SectionData[];
    avg_total_time_ms: number;
    avg_total_time_sec: number;
    engagement_over_time: Array<{
        date: string;
        sessions: number;
        avg_time_sec: number;
    }>;
    top_section: string;
    total_engagement_ms: number;
}

const SECTION_COLORS = [
    '#f43f5e', // rose
    '#8b5cf6', // violet
    '#3b82f6', // blue
    '#06b6d4', // cyan
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ec4899', // pink
];

const GRADIENT_PAIRS = [
    { start: '#f43f5e', end: '#fb7185' },
    { start: '#8b5cf6', end: '#a78bfa' },
    { start: '#3b82f6', end: '#60a5fa' },
    { start: '#06b6d4', end: '#22d3ee' },
    { start: '#10b981', end: '#34d399' },
    { start: '#f59e0b', end: '#fbbf24' },
    { start: '#ec4899', end: '#f472b6' },
];

function formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const sec = ms / 1000;
    if (sec < 60) return `${sec.toFixed(1)}s`;
    const min = Math.floor(sec / 60);
    const remainSec = Math.round(sec % 60);
    return `${min}m ${remainSec}s`;
}

// Custom tooltip for recharts
function CustomBarTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl bg-popover/95 backdrop-blur-xl border border-border/60 px-4 py-3 shadow-2xl">
            <p className="text-sm font-semibold text-foreground mb-1">{label}</p>
            {payload.map((p: any, i: number) => (
                <p key={i} className="text-xs text-muted-foreground">
                    {p.name}: <span className="font-medium text-foreground">{p.value.toFixed(1)}s</span>
                </p>
            ))}
        </div>
    );
}

function CustomPieTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl bg-popover/95 backdrop-blur-xl border border-border/60 px-4 py-3 shadow-2xl">
            <p className="text-sm font-semibold text-foreground">{payload[0].name}</p>
            <p className="text-xs text-muted-foreground">
                Engagement: <span className="font-medium text-foreground">{payload[0].value.toFixed(1)}%</span>
            </p>
        </div>
    );
}

function CustomAreaTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl bg-popover/95 backdrop-blur-xl border border-border/60 px-4 py-3 shadow-2xl">
            <p className="text-sm font-semibold text-foreground mb-1">{label}</p>
            {payload.map((p: any, i: number) => (
                <p key={i} className="text-xs text-muted-foreground">
                    {p.name}: <span className="font-medium text-foreground">
                        {p.dataKey === 'sessions' ? p.value : `${p.value.toFixed(1)}s`}
                    </span>
                </p>
            ))}
        </div>
    );
}

// Stat Card component
function StatCard({ icon: Icon, label, value, subValue, color, delay }: {
    icon: React.ElementType;
    label: string;
    value: string;
    subValue?: string;
    color: string;
    delay: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4 }}
            className="relative group"
        >
            <div className="absolute -inset-0.5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"
                style={{ background: `linear-gradient(135deg, ${color}30, ${color}10)` }} />
            <div className="relative p-4 rounded-2xl bg-secondary/40 border border-border/50 hover:border-border transition-colors">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl" style={{ background: `${color}15` }}>
                        <Icon className="h-4 w-4" style={{ color }} />
                    </div>
                    <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
                        <p className="text-lg font-bold text-foreground">{value}</p>
                        {subValue && <p className="text-[10px] text-muted-foreground">{subValue}</p>}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// Loading skeleton
function AnalyticsSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-24 rounded-2xl bg-secondary/40" />
                ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-64 rounded-2xl bg-secondary/40" />
                <div className="h-64 rounded-2xl bg-secondary/40" />
            </div>
            <div className="h-48 rounded-2xl bg-secondary/40" />
        </div>
    );
}

// Chart wrapper
function ChartCard({ title, icon: Icon, children, delay = 0 }: {
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
    delay?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5 }}
            className="relative group"
        >
            <div className="absolute -inset-0.5 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
            <div className="relative rounded-2xl bg-secondary/30 border border-border/50 p-5 hover:border-border/80 transition-colors">
                <div className="flex items-center gap-2.5 mb-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                </div>
                {children}
            </div>
        </motion.div>
    );
}

// Section detail item in the ranking list
function SectionRankItem({ section, index, maxTime }: {
    section: SectionData;
    index: number;
    maxTime: number;
}) {
    const pct = maxTime > 0 ? (section.avg_time_ms / maxTime) * 100 : 0;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 * index, duration: 0.3 }}
            className="flex items-center gap-3 py-2.5"
        >
            <div
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                style={{ background: SECTION_COLORS[index % SECTION_COLORS.length] }}
            >
                {index + 1}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground truncate">{section.label}</span>
                    <span className="text-xs font-mono text-muted-foreground ml-2">
                        {formatTime(section.avg_time_ms)}
                    </span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.15 * index + 0.3, duration: 0.6, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{
                            background: `linear-gradient(90deg, ${GRADIENT_PAIRS[index % GRADIENT_PAIRS.length].start}, ${GRADIENT_PAIRS[index % GRADIENT_PAIRS.length].end})`
                        }}
                    />
                </div>
            </div>
            <div className="flex-shrink-0 text-right">
                <span className="text-[10px] text-muted-foreground block">{section.total_visits} visits</span>
            </div>
        </motion.div>
    );
}


export default function SectionAnalytics({ isOpen, onClose }: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiService.getSectionAnalytics();
            if (response.data) {
                setData(response.data);
            } else {
                setError(response.error || 'Failed to load analytics');
            }
        } catch {
            setError('Failed to connect to analytics service');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen && !data) {
            fetchAnalytics();
        }
    }, [isOpen, data, fetchAnalytics]);

    // Close on escape key
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handler);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handler);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    // Prepare chart data
    const barData = data?.sections.map(s => ({
        name: s.label,
        'Avg Time': s.avg_time_sec,
    })) || [];

    const pieData = data?.sections
        .filter(s => s.engagement_pct > 0)
        .map(s => ({
            name: s.label,
            value: s.engagement_pct,
        })) || [];

    const radarData = data?.sections.map(s => ({
        subject: s.label,
        visits: s.total_visits,
        time: s.avg_time_sec,
    })) || [];

    const sortedSections = data?.sections
        ? [...data.sections].sort((a, b) => b.avg_time_ms - a.avg_time_ms)
        : [];

    const maxAvgTime = sortedSections.length > 0 ? sortedSections[0].avg_time_ms : 1;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal — fixed header, scrollable content (no nested overflow) */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.4, type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-4 md:inset-8 lg:inset-12 z-[61] flex items-start justify-center overflow-hidden"
                    >
                        <div className="relative w-full max-w-5xl h-full flex flex-col">
                            {/* Glow */}
                            <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20 rounded-3xl blur-xl opacity-60 pointer-events-none" />

                            <div className="relative flex flex-col h-full max-h-full bg-background/95 backdrop-blur-2xl rounded-3xl border border-border/50 shadow-2xl overflow-hidden">
                                {/* Fixed header */}
                                <div className="flex-shrink-0 bg-background/90 backdrop-blur-xl border-b border-border/50">
                                    <div className="flex items-center justify-between p-5 md:p-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg">
                                                <BarChart3 className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h2 className="text-lg md:text-xl font-bold text-foreground">
                                                        Engagement Analytics
                                                    </h2>
                                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-primary to-accent text-white rounded-full">
                                                        Beta
                                                    </span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    How visitors interact with this portfolio
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={onClose}
                                            className="p-2 rounded-xl hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Scrollable content */}
                                <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
                                    {loading && <AnalyticsSkeleton />}

                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="text-center py-12"
                                        >
                                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-sm">
                                                <Activity className="h-4 w-4" />
                                                {error}
                                            </div>
                                            <button
                                                onClick={fetchAnalytics}
                                                className="mt-4 px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium flex items-center gap-2 mx-auto"
                                            >
                                                Try Again
                                                <ChevronRight className="h-3.5 w-3.5" />
                                            </button>
                                        </motion.div>
                                    )}

                                    {data && !loading && (
                                        <>
                                            {/* Empty state */}
                                            {data.total_sessions === 0 ? (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="text-center py-16"
                                                >
                                                    <div className="inline-flex p-4 rounded-2xl bg-secondary/40 mb-4">
                                                        <BarChart3 className="h-8 w-8 text-muted-foreground" />
                                                    </div>
                                                    <h3 className="text-lg font-semibold text-foreground mb-2">No data yet</h3>
                                                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                                        Analytics data will appear here as visitors interact with the portfolio.
                                                        Each section's engagement time and visit count are tracked anonymously.
                                                    </p>
                                                </motion.div>
                                            ) : (
                                                <>
                                                    {/* KPI Stats */}
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                                                        <StatCard
                                                            icon={Users}
                                                            label="Sessions Tracked"
                                                            value={data.total_sessions.toLocaleString()}
                                                            color="#3b82f6"
                                                            delay={0.1}
                                                        />
                                                        <StatCard
                                                            icon={Clock}
                                                            label="Avg. Page Time"
                                                            value={formatTime(data.avg_total_time_ms)}
                                                            color="#10b981"
                                                            delay={0.15}
                                                        />
                                                        <StatCard
                                                            icon={Flame}
                                                            label="Most Engaging"
                                                            value={data.top_section}
                                                            subValue="by avg. time"
                                                            color="#f59e0b"
                                                            delay={0.2}
                                                        />
                                                        <StatCard
                                                            icon={TrendingUp}
                                                            label="Total Engagement"
                                                            value={formatTime(data.total_engagement_ms)}
                                                            subValue="cumulative"
                                                            color="#8b5cf6"
                                                            delay={0.25}
                                                        />
                                                    </div>

                                                    {/* Charts Row 1: Bar Chart + Pie Chart */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <ChartCard title="Avg. Time per Section" icon={BarChart3} delay={0.3}>
                                                            <div className="h-64">
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <BarChart data={barData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                                                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                                                                        <XAxis
                                                                            dataKey="name"
                                                                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                                                            axisLine={{ stroke: 'hsl(var(--border))' }}
                                                                            tickLine={false}
                                                                            interval={0}
                                                                            angle={-35}
                                                                            textAnchor="end"
                                                                            height={60}
                                                                        />
                                                                        <YAxis
                                                                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                                                            axisLine={false}
                                                                            tickLine={false}
                                                                            unit="s"
                                                                        />
                                                                        <Tooltip content={<CustomBarTooltip />} />
                                                                        <defs>
                                                                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                                                                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                                                                                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0.8} />
                                                                            </linearGradient>
                                                                        </defs>
                                                                        <Bar
                                                                            dataKey="Avg Time"
                                                                            fill="url(#barGradient)"
                                                                            radius={[6, 6, 0, 0]}
                                                                            maxBarSize={40}
                                                                        />
                                                                    </BarChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </ChartCard>

                                                        <ChartCard title="Engagement Distribution" icon={Eye} delay={0.35}>
                                                            <div className="h-64">
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <PieChart>
                                                                        <Pie
                                                                            data={pieData}
                                                                            cx="50%"
                                                                            cy="50%"
                                                                            innerRadius={50}
                                                                            outerRadius={85}
                                                                            dataKey="value"
                                                                            stroke="none"
                                                                            paddingAngle={3}
                                                                        >
                                                                            {pieData.map((_, index) => (
                                                                                <Cell
                                                                                    key={`cell-${index}`}
                                                                                    fill={SECTION_COLORS[index % SECTION_COLORS.length]}
                                                                                />
                                                                            ))}
                                                                        </Pie>
                                                                        <Tooltip content={<CustomPieTooltip />} />
                                                                        <Legend
                                                                            iconType="circle"
                                                                            iconSize={8}
                                                                            formatter={(value: string) => (
                                                                                <span className="text-[11px] text-muted-foreground">{value}</span>
                                                                            )}
                                                                        />
                                                                    </PieChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </ChartCard>
                                                    </div>

                                                    {/* Charts Row 2: Area Chart + Radar Chart */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {data.engagement_over_time.length > 0 && (
                                                            <ChartCard title="Engagement Trend (7 Days)" icon={TrendingUp} delay={0.4}>
                                                                <div className="h-56">
                                                                    <ResponsiveContainer width="100%" height="100%">
                                                                        <AreaChart data={data.engagement_over_time} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                                                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                                                                            <XAxis
                                                                                dataKey="date"
                                                                                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                                                                axisLine={{ stroke: 'hsl(var(--border))' }}
                                                                                tickLine={false}
                                                                            />
                                                                            <YAxis
                                                                                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                                                                axisLine={false}
                                                                                tickLine={false}
                                                                            />
                                                                            <Tooltip content={<CustomAreaTooltip />} />
                                                                            <defs>
                                                                                <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
                                                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                                                </linearGradient>
                                                                                <linearGradient id="avgTimeGradient" x1="0" y1="0" x2="0" y2="1">
                                                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                                                </linearGradient>
                                                                            </defs>
                                                                            <Area
                                                                                type="monotone"
                                                                                dataKey="sessions"
                                                                                name="Sessions"
                                                                                stroke="#3b82f6"
                                                                                fill="url(#sessionsGradient)"
                                                                                strokeWidth={2}
                                                                            />
                                                                            <Area
                                                                                type="monotone"
                                                                                dataKey="avg_time_sec"
                                                                                name="Avg Time"
                                                                                stroke="#10b981"
                                                                                fill="url(#avgTimeGradient)"
                                                                                strokeWidth={2}
                                                                            />
                                                                        </AreaChart>
                                                                    </ResponsiveContainer>
                                                                </div>
                                                            </ChartCard>
                                                        )}

                                                        <ChartCard title="Section Engagement Radar" icon={Activity} delay={0.45}>
                                                            <div className="h-56">
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                                                                        <PolarGrid stroke="hsl(var(--border))" opacity={0.4} />
                                                                        <PolarAngleAxis
                                                                            dataKey="subject"
                                                                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                                                        />
                                                                        <PolarRadiusAxis
                                                                            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                                                                            axisLine={false}
                                                                        />
                                                                        <Radar
                                                                            name="Avg Time (s)"
                                                                            dataKey="time"
                                                                            stroke="#f43f5e"
                                                                            fill="#f43f5e"
                                                                            fillOpacity={0.15}
                                                                            strokeWidth={2}
                                                                        />
                                                                        <Radar
                                                                            name="Visits"
                                                                            dataKey="visits"
                                                                            stroke="#8b5cf6"
                                                                            fill="#8b5cf6"
                                                                            fillOpacity={0.1}
                                                                            strokeWidth={2}
                                                                        />
                                                                        <Legend
                                                                            iconType="circle"
                                                                            iconSize={8}
                                                                            formatter={(value: string) => (
                                                                                <span className="text-[11px] text-muted-foreground">{value}</span>
                                                                            )}
                                                                        />
                                                                    </RadarChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </ChartCard>
                                                    </div>

                                                    {/* Section Rankings */}
                                                    <ChartCard title="Section Engagement Ranking" icon={Flame} delay={0.5}>
                                                        <div className="space-y-1">
                                                            {sortedSections.map((section, index) => (
                                                                <SectionRankItem
                                                                    key={section.id}
                                                                    section={section}
                                                                    index={index}
                                                                    maxTime={maxAvgTime}
                                                                />
                                                            ))}
                                                        </div>
                                                    </ChartCard>

                                                    {/* Footer note */}
                                                    <motion.div
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        transition={{ delay: 0.6 }}
                                                        className="text-center py-3"
                                                    >
                                                        <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                                                            <Sparkles className="h-3 w-3 text-primary" />
                                                            Data is anonymized and aggregated across all visitor sessions
                                                            <span className="text-primary">•</span>
                                                            Powered by MongoDB Atlas aggregation pipeline
                                                        </p>
                                                    </motion.div>
                                                </>
                                            )}
                                        </>
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

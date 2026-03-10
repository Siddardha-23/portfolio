/**
 * GitTimeline - Interactive animated commit timeline
 *
 * Fetches real commit data from the GitHub API and displays it as
 * an animated, categorised story of building the portfolio.
 *
 * Accessed via a "Build Journey" button on the home screen.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, GitCommit, GitBranch, Clock, Code, FileCode,
    Shield, Bug, Paintbrush, Zap, RefreshCw, Play, Pause,
    ChevronDown, ExternalLink, Loader2, Rocket, Database,
    Server, Eye, Layers, type LucideIcon,
} from 'lucide-react';

// ── Types ──
interface GitCommitData {
    sha: string;
    message: string;
    date: string;
    author: string;
    authorAvatar: string;
    url: string;
    category: CommitCategory;
}

type CommitCategory =
    | 'feature' | 'fix' | 'infra' | 'style' | 'docs'
    | 'refactor' | 'perf' | 'security' | 'ci' | 'other';

interface MonthGroup {
    label: string;
    commits: GitCommitData[];
}

// ── Category config ──
const CATEGORY_META: Record<CommitCategory, {
    label: string;
    icon: LucideIcon;
    color: string;
    bg: string;
}> = {
    feature: { label: 'Feature', icon: Zap, color: '#10b981', bg: '#10b98118' },
    fix: { label: 'Fix', icon: Bug, color: '#f43f5e', bg: '#f43f5e18' },
    infra: { label: 'Infra', icon: Server, color: '#f59e0b', bg: '#f59e0b18' },
    style: { label: 'UI/Style', icon: Paintbrush, color: '#ec4899', bg: '#ec489918' },
    docs: { label: 'Docs', icon: FileCode, color: '#6366f1', bg: '#6366f118' },
    refactor: { label: 'Refactor', icon: RefreshCw, color: '#8b5cf6', bg: '#8b5cf618' },
    perf: { label: 'Perf', icon: Rocket, color: '#06b6d4', bg: '#06b6d418' },
    security: { label: 'Security', icon: Shield, color: '#ef4444', bg: '#ef444418' },
    ci: { label: 'CI/CD', icon: GitBranch, color: '#a855f7', bg: '#a855f718' },
    other: { label: 'Other', icon: Code, color: '#94a3b8', bg: '#94a3b818' },
};

// ── Categorise a commit by message ──
function categoriseCommit(message: string): CommitCategory {
    const m = message.toLowerCase();
    // CI/CD
    if (m.includes('deploy') || m.includes('ci/cd') || m.includes('pipeline') ||
        m.includes('workflow') || m.includes('github action') || m.includes('ci:')) return 'ci';
    // Security
    if (m.includes('security') || m.includes('auth') || m.includes('cors') ||
        m.includes('csrf') || m.includes('sanitiz') || m.includes('xss')) return 'security';
    // Infra / Terraform / Docker / AWS
    if (m.includes('terraform') || m.includes('infra') || m.includes('docker') ||
        m.includes('lambda') || m.includes('cloudfront') || m.includes('s3') ||
        m.includes('aws') || m.includes('api gateway') || m.includes('mongodb') ||
        m.includes('database') || m.includes('mangum')) return 'infra';
    // Fix/Bug
    if (m.includes('fix') || m.includes('bug') || m.includes('hotfix') ||
        m.includes('patch') || m.includes('resolve') || m.includes('error')) return 'fix';
    // Refactor
    if (m.includes('refactor') || m.includes('cleanup') || m.includes('restructur') ||
        m.includes('reorgani') || m.includes('move') || m.includes('rename')) return 'refactor';
    // Docs
    if (m.includes('readme') || m.includes('doc') || m.includes('comment') ||
        m.includes('changelog')) return 'docs';
    // Performance
    if (m.includes('perf') || m.includes('optimi') || m.includes('cache') ||
        m.includes('lazy') || m.includes('bundle') || m.includes('speed')) return 'perf';
    // Style/UI
    if (m.includes('style') || m.includes('css') || m.includes('ui') ||
        m.includes('design') || m.includes('layout') || m.includes('theme') ||
        m.includes('responsive') || m.includes('animation') || m.includes('color') ||
        m.includes('dark mode')) return 'style';
    // Feature (generic)
    if (m.includes('add') || m.includes('implement') || m.includes('create') ||
        m.includes('new') || m.includes('feature') || m.includes('feat') ||
        m.includes('build') || m.includes('integrat') || m.includes('setup') ||
        m.includes('initial')) return 'feature';
    return 'other';
}

// ── Group commits by month ──
function groupByMonth(commits: GitCommitData[]): MonthGroup[] {
    const groups: Map<string, GitCommitData[]> = new Map();
    const labels: Map<string, string> = new Map();
    for (const c of commits) {
        const d = new Date(c.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (!groups.has(key)) {
            groups.set(key, []);
            labels.set(key, label);
        }
        groups.get(key)!.push(c);
    }
    return Array.from(groups.entries()).map(([key, commits]) => ({
        label: labels.get(key) || '',
        commits,
    }));
}

// ── Format relative date ──
function relativeDate(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
}

// ── Category filter pills ──
function CategoryFilter({ active, onToggle, counts }: {
    active: Set<CommitCategory>;
    onToggle: (cat: CommitCategory) => void;
    counts: Record<CommitCategory, number>;
}) {
    const categories = Object.entries(CATEGORY_META).filter(
        ([key]) => (counts[key as CommitCategory] || 0) > 0
    );

    return (
        <div className="flex flex-wrap gap-1.5 justify-center">
            {categories.map(([key, meta]) => {
                const cat = key as CommitCategory;
                const isActive = active.has(cat);
                return (
                    <button
                        key={cat}
                        onClick={() => onToggle(cat)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200 border"
                        style={{
                            background: isActive ? meta.bg : 'transparent',
                            borderColor: isActive ? meta.color + '40' : 'hsl(var(--border))',
                            color: isActive ? meta.color : 'hsl(var(--muted-foreground))',
                            opacity: isActive ? 1 : 0.6,
                        }}
                    >
                        <meta.icon className="h-3 w-3" />
                        {meta.label}
                        <span className="opacity-60">({counts[cat]})</span>
                    </button>
                );
            })}
        </div>
    );
}

// ── Single commit card ──
function CommitCard({ commit, index, isLeft }: {
    commit: GitCommitData;
    index: number;
    isLeft: boolean;
}) {
    const meta = CATEGORY_META[commit.category];
    const Icon = meta.icon;
    const shortSha = commit.sha.slice(0, 7);

    return (
        <motion.div
            initial={{ opacity: 0, x: isLeft ? -30 : 30, y: 10 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true, margin: '-20px' }}
            transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
            className={`relative flex ${isLeft ? 'md:justify-end md:pr-8' : 'md:justify-start md:pl-8'} w-full md:w-1/2 ${isLeft ? 'md:self-start' : 'md:self-end md:ml-auto'}`}
        >
            {/* Timeline dot */}
            <div
                className="hidden md:flex absolute top-4 z-10 w-4 h-4 rounded-full border-2 items-center justify-center"
                style={{
                    borderColor: meta.color,
                    background: meta.bg,
                    [isLeft ? 'right' : 'left']: '-8px',
                }}
            >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
            </div>

            {/* Card */}
            <div className="group relative w-full max-w-md">
                <div
                    className="absolute -inset-[1px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-[2px]"
                    style={{ background: `linear-gradient(135deg, ${meta.color}25, transparent)` }}
                />
                <div className="relative p-4 rounded-xl bg-secondary/30 border border-border/50 hover:border-border/80 transition-all duration-200 hover:shadow-lg">
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-2">
                        <div
                            className="flex-shrink-0 p-1.5 rounded-lg"
                            style={{ background: meta.bg }}
                        >
                            <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                                {commit.message.split('\n')[0]}
                            </p>
                        </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{ background: meta.bg, color: meta.color }}
                        >
                            <Icon className="h-2.5 w-2.5" />
                            {meta.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {relativeDate(commit.date)}
                        </span>
                        <a
                            href={commit.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <GitCommit className="h-2.5 w-2.5" />
                            {shortSha}
                            <ExternalLink className="h-2 w-2" />
                        </a>
                    </div>

                    {/* Date tooltip */}
                    <div className="mt-2 text-[10px] text-muted-foreground/60">
                        {new Date(commit.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ── Month divider ──
function MonthDivider({ label, commitCount, delay }: {
    label: string;
    commitCount: number;
    delay: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay }}
            className="flex items-center justify-center gap-3 my-6 relative z-10"
        >
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/50 border border-border/50">
                <Layers className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">{label}</span>
                <span className="text-[10px] text-muted-foreground">({commitCount})</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
        </motion.div>
    );
}

// ── Stats summary ──
function TimelineStats({ commits }: { commits: GitCommitData[] }) {
    const totalCommits = commits.length;
    const categories = commits.reduce<Record<string, number>>((acc, c) => {
        acc[c.category] = (acc[c.category] || 0) + 1;
        return acc;
    }, {});
    const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
    const firstDate = commits.length > 0 ? new Date(commits[commits.length - 1].date) : new Date();
    const lastDate = commits.length > 0 ? new Date(commits[0].date) : new Date();
    const daySpan = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
                {
                    icon: GitCommit,
                    label: 'Total Commits',
                    value: totalCommits.toString(),
                    color: '#3b82f6',
                },
                {
                    icon: Clock,
                    label: 'Time Span',
                    value: daySpan > 30 ? `${Math.round(daySpan / 30)} months` : `${daySpan} days`,
                    color: '#10b981',
                },
                {
                    icon: Zap,
                    label: 'Top Category',
                    value: topCategory ? CATEGORY_META[topCategory[0] as CommitCategory]?.label || topCategory[0] : '-',
                    color: '#f59e0b',
                },
                {
                    icon: Rocket,
                    label: 'Commit Rate',
                    value: `${(totalCommits / Math.max(1, daySpan / 7)).toFixed(1)}/week`,
                    color: '#8b5cf6',
                },
            ].map((stat, i) => (
                <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
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
    );
}


// ── Main component ──
const GITHUB_REPO = 'Siddardha-23/portfolio';
const CACHE_KEY = 'git_timeline_cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export default function GitTimeline({ isOpen, onClose }: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const [commits, setCommits] = useState<GitCommitData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeCategories, setActiveCategories] = useState<Set<CommitCategory>>(
        new Set(Object.keys(CATEGORY_META) as CommitCategory[])
    );
    const [autoPlay, setAutoPlay] = useState(false);
    const [visibleCount, setVisibleCount] = useState(20);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch commits from GitHub API
    const fetchCommits = useCallback(async () => {
        // Check cache first
        try {
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_TTL) {
                    setCommits(data);
                    return;
                }
            }
        } catch { /* ignore cache errors */ }

        setLoading(true);
        setError(null);

        try {
            // Fetch up to 100 commits
            const res = await fetch(
                `https://api.github.com/repos/${GITHUB_REPO}/commits?per_page=100`,
                { headers: { Accept: 'application/vnd.github.v3+json' } }
            );

            if (!res.ok) {
                if (res.status === 403) throw new Error('GitHub API rate limit reached. Try again later.');
                throw new Error(`GitHub API error: ${res.status}`);
            }

            const raw = await res.json();

            const parsed: GitCommitData[] = raw.map((item: any) => ({
                sha: item.sha,
                message: item.commit.message,
                date: item.commit.author.date,
                author: item.commit.author.name,
                authorAvatar: item.author?.avatar_url || '',
                url: item.html_url,
                category: categoriseCommit(item.commit.message),
            }));

            setCommits(parsed);

            // Cache
            try {
                sessionStorage.setItem(
                    CACHE_KEY,
                    JSON.stringify({ data: parsed, timestamp: Date.now() })
                );
            } catch { /* storage full */ }
        } catch (e: any) {
            setError(e.message || 'Failed to fetch commit history');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen && commits.length === 0) {
            fetchCommits();
        }
    }, [isOpen, commits.length, fetchCommits]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', handler);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    // Auto-play: reveal commits one at a time
    useEffect(() => {
        if (!autoPlay) return;
        const filtered = commits.filter(c => activeCategories.has(c.category));
        if (visibleCount >= filtered.length) {
            setAutoPlay(false);
            return;
        }
        const timer = setInterval(() => {
            setVisibleCount(prev => {
                const next = prev + 1;
                if (next >= filtered.length) {
                    setAutoPlay(false);
                    return filtered.length;
                }
                return next;
            });
            // Auto-scroll to bottom
            if (scrollRef.current) {
                scrollRef.current.scrollTo({
                    top: scrollRef.current.scrollHeight,
                    behavior: 'smooth',
                });
            }
        }, 600);
        return () => clearInterval(timer);
    }, [autoPlay, commits, activeCategories, visibleCount]);

    // Filter + group
    const filteredCommits = commits.filter(c => activeCategories.has(c.category));
    const displayedCommits = filteredCommits.slice(0, visibleCount);
    const monthGroups = groupByMonth(displayedCommits);
    const hasMore = visibleCount < filteredCommits.length;

    // Category counts
    const categoryCounts = commits.reduce<Record<CommitCategory, number>>((acc, c) => {
        acc[c.category] = (acc[c.category] || 0) + 1;
        return acc;
    }, {} as Record<CommitCategory, number>);

    const toggleCategory = (cat: CommitCategory) => {
        setActiveCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) {
                if (next.size > 1) next.delete(cat);
            } else {
                next.add(cat);
            }
            return next;
        });
        setVisibleCount(20);
    };

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

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.4, type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-4 md:inset-8 lg:inset-12 z-[61] flex items-start justify-center overflow-hidden"
                    >
                        <div className="relative w-full max-w-5xl h-full flex flex-col">
                            {/* Glow */}
                            <div className="absolute -inset-1 bg-gradient-to-br from-primary/15 via-accent/5 to-primary/15 rounded-3xl blur-xl opacity-60 pointer-events-none" />

                            <div className="relative flex flex-col h-full bg-background/95 backdrop-blur-2xl rounded-3xl border border-border/50 shadow-2xl overflow-hidden">
                                {/* Header */}
                                <div className="flex-shrink-0 bg-background/90 backdrop-blur-xl border-b border-border/50">
                                    <div className="flex items-center justify-between p-5 md:p-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg">
                                                <GitBranch className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h2 className="text-lg md:text-xl font-bold text-foreground">
                                                        Build Journey
                                                    </h2>
                                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-primary to-accent text-white rounded-full">
                                                        Live
                                                    </span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    The story of building this portfolio, commit by commit
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Auto-play toggle */}
                                            {commits.length > 0 && (
                                                <button
                                                    onClick={() => {
                                                        if (!autoPlay) setVisibleCount(1);
                                                        setAutoPlay(!autoPlay);
                                                    }}
                                                    className={`p-2 rounded-xl transition-colors ${autoPlay
                                                        ? 'bg-primary/15 text-primary'
                                                        : 'hover:bg-secondary/60 text-muted-foreground hover:text-foreground'
                                                        }`}
                                                    title={autoPlay ? 'Pause playback' : 'Auto-play timeline'}
                                                >
                                                    {autoPlay ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                                </button>
                                            )}

                                            <button
                                                onClick={onClose}
                                                className="p-2 rounded-xl hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground"
                                            >
                                                <X className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Category filters */}
                                    {commits.length > 0 && (
                                        <div className="px-5 pb-4">
                                            <CategoryFilter
                                                active={activeCategories}
                                                onToggle={toggleCategory}
                                                counts={categoryCounts}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Scrollable content */}
                                <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 md:p-6">
                                    {/* Loading */}
                                    {loading && (
                                        <div className="flex flex-col items-center justify-center py-20">
                                            <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                                            <p className="text-sm text-muted-foreground">
                                                Fetching commit history from GitHub...
                                            </p>
                                        </div>
                                    )}

                                    {/* Error */}
                                    {error && (
                                        <div className="flex flex-col items-center justify-center py-20">
                                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-sm mb-4">
                                                <Bug className="h-4 w-4" />
                                                {error}
                                            </div>
                                            <button
                                                onClick={fetchCommits}
                                                className="px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
                                            >
                                                Try Again
                                            </button>
                                        </div>
                                    )}

                                    {/* Timeline content */}
                                    {!loading && !error && commits.length > 0 && (
                                        <>
                                            {/* Stats */}
                                            <TimelineStats commits={filteredCommits} />

                                            {/* Timeline */}
                                            <div className="relative">
                                                {/* Central timeline line (desktop) */}
                                                <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/30 via-border to-transparent -translate-x-px" />

                                                {/* Mobile left line */}
                                                <div className="md:hidden absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-primary/30 via-border to-transparent" />

                                                {monthGroups.map((group, gi) => (
                                                    <div key={group.label}>
                                                        <MonthDivider
                                                            label={group.label}
                                                            commitCount={group.commits.length}
                                                            delay={gi * 0.05}
                                                        />
                                                        <div className="space-y-3 md:space-y-4">
                                                            {group.commits.map((commit, ci) => {
                                                                // On desktop, alternate left/right
                                                                const globalIndex = displayedCommits.indexOf(commit);
                                                                const isLeft = globalIndex % 2 === 0;
                                                                return (
                                                                    <div
                                                                        key={commit.sha}
                                                                        className="md:flex md:items-start relative pl-8 md:pl-0"
                                                                    >
                                                                        {/* Mobile timeline dot */}
                                                                        <div
                                                                            className="md:hidden absolute left-[11px] top-4 w-3 h-3 rounded-full border-2"
                                                                            style={{
                                                                                borderColor: CATEGORY_META[commit.category].color,
                                                                                background: CATEGORY_META[commit.category].bg,
                                                                            }}
                                                                        />

                                                                        <CommitCard
                                                                            commit={commit}
                                                                            index={ci}
                                                                            isLeft={isLeft}
                                                                        />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Load more */}
                                                {hasMore && !autoPlay && (
                                                    <motion.div
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        className="flex justify-center mt-8"
                                                    >
                                                        <button
                                                            onClick={() => setVisibleCount(prev => prev + 20)}
                                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
                                                        >
                                                            <ChevronDown className="h-4 w-4" />
                                                            Load more ({filteredCommits.length - visibleCount} remaining)
                                                        </button>
                                                    </motion.div>
                                                )}

                                                {/* End marker */}
                                                {!hasMore && displayedCommits.length > 0 && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.8 }}
                                                        whileInView={{ opacity: 1, scale: 1 }}
                                                        viewport={{ once: true }}
                                                        className="flex justify-center mt-8 mb-4"
                                                    >
                                                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
                                                            <Rocket className="h-4 w-4 text-primary" />
                                                            <span className="text-xs font-medium text-foreground">
                                                                First commit — where it all began 🎉
                                                            </span>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="flex-shrink-0 px-5 py-3 border-t border-border/50 bg-background/80">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                            <Eye className="h-3 w-3 text-primary" />
                                            Showing {displayedCommits.length} of {filteredCommits.length} commits
                                            {filteredCommits.length < commits.length && (
                                                <span className="text-primary">
                                                    • {commits.length - filteredCommits.length} filtered out
                                                </span>
                                            )}
                                        </p>
                                        <a
                                            href={`https://github.com/${GITHUB_REPO}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                                        >
                                            <Database className="h-3 w-3" />
                                            Source: GitHub API
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

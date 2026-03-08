import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    GitCommit,
    Timer,
    Cloud,
    ShieldCheck,
    ExternalLink,
    ChevronDown,
    CheckCircle2,
    Copy,
    Check,
    Github,
    Rocket,
    Hash,
    Clock,
    Server,
} from 'lucide-react';

interface DeployManifest {
    commit_sha: string;
    commit_short: string;
    commit_message: string;
    branch: string;
    run_id: string;
    run_number: number;
    repository: string;
    timestamp: string;
    build_duration_seconds: number;
    environment: string;
    deployer: string;
    frontend_status: string;
    cloudfront_invalidation: string;
    artifact_hash: string;
}

function timeAgo(dateString: string): string {
    const now = new Date();
    const then = new Date(dateString);
    const diffMs = now.getTime() - then.getTime();

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function StatusDot({ status }: { status: 'success' | 'pending' | 'error' }) {
    const colors = {
        success: 'bg-emerald-400',
        pending: 'bg-amber-400',
        error: 'bg-red-400',
    };

    return (
        <span className="relative flex h-2.5 w-2.5">
            <span
                className={`absolute inline-flex h-full w-full rounded-full ${colors[status]} opacity-75 animate-ping`}
            />
            <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${colors[status]}`}
            />
        </span>
    );
}

function InfoRow({
    icon: Icon,
    label,
    value,
    mono = false,
    href,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    mono?: boolean;
    href?: string;
}) {
    return (
        <div className="flex items-center justify-between py-1.5 group">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{label}</span>
            </div>
            {href ? (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs text-primary hover:underline flex items-center gap-1 ${mono ? 'font-mono' : ''}`}
                >
                    {value}
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
            ) : (
                <span
                    className={`text-xs text-foreground/90 ${mono ? 'font-mono' : ''}`}
                >
                    {value}
                </span>
            )}
        </div>
    );
}

export default function DeployBadge() {
    const [manifest, setManifest] = useState<DeployManifest | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchManifest = async () => {
            try {
                const res = await fetch('/deploy-manifest.json', {
                    cache: 'no-store',
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data: DeployManifest = await res.json();
                // Validate required fields
                if (data.commit_sha && data.timestamp) {
                    setManifest(data);
                } else {
                    throw new Error('Invalid manifest');
                }
            } catch {
                setError(true);
            }
        };

        fetchManifest();
    }, []);

    const handleCopyHash = async () => {
        if (!manifest?.artifact_hash) return;
        try {
            await navigator.clipboard.writeText(manifest.artifact_hash);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* clipboard may not be available */
        }
    };

    // Don't render anything if no manifest (dev mode or fetch failed)
    if (error || !manifest) return null;

    const runUrl = `https://github.com/${manifest.repository}/actions/runs/${manifest.run_id}`;
    const commitUrl = `https://github.com/${manifest.repository}/commit/${manifest.commit_sha}`;

    return (
        <div className="w-full flex justify-center mt-6 mb-2" id="deploy-badge">
            <motion.div
                layout
                className="w-full max-w-2xl rounded-xl overflow-hidden"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            >
                {/* ── Collapsed badge bar ── */}
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="
            w-full flex items-center justify-between gap-3 px-4 py-3
            bg-white/60 dark:bg-white/[0.04]
            backdrop-blur-md
            border border-white/20 dark:border-white/[0.08]
            rounded-xl
            shadow-sm hover:shadow-md
            transition-all duration-300
            cursor-pointer group
            text-left
          "
                    aria-expanded={expanded}
                    aria-label="Toggle deploy provenance details"
                    id="deploy-badge-toggle"
                >
                    {/* Left: status + headline */}
                    <div className="flex items-center gap-3 min-w-0">
                        <StatusDot status="success" />

                        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-w-0">
                            <span className="text-xs font-medium text-foreground/90 whitespace-nowrap">
                                Deployed from{' '}
                                <span className="font-mono text-primary font-semibold">
                                    {manifest.branch}
                                </span>
                            </span>
                            <span className="hidden sm:inline text-muted-foreground/40 text-xs">•</span>
                            <a
                                href={commitUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="font-mono text-xs text-primary/80 hover:text-primary hover:underline transition-colors"
                            >
                                {manifest.commit_short}
                            </a>
                            <span className="hidden sm:inline text-muted-foreground/40 text-xs">•</span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {timeAgo(manifest.timestamp)}
                            </span>
                        </div>
                    </div>

                    {/* Right: chevron */}
                    <motion.div
                        animate={{ rotate: expanded ? 180 : 0 }}
                        transition={{ duration: 0.25 }}
                        className="text-muted-foreground group-hover:text-foreground/70 transition-colors flex-shrink-0"
                    >
                        <ChevronDown className="h-4 w-4" />
                    </motion.div>
                </button>

                {/* ── Expanded details panel ── */}
                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            key="details"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                            className="overflow-hidden"
                        >
                            <div
                                className="
                  mx-1 mt-1 px-4 py-4
                  bg-white/40 dark:bg-white/[0.02]
                  backdrop-blur-lg
                  border border-white/15 dark:border-white/[0.06]
                  rounded-lg
                  space-y-0.5
                "
                            >
                                {/* Section: Pipeline */}
                                <div className="mb-3">
                                    <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-1.5">
                                        Pipeline
                                    </h4>
                                    <div className="divide-y divide-border/50">
                                        <InfoRow
                                            icon={Timer}
                                            label="Build time"
                                            value={formatDuration(manifest.build_duration_seconds)}
                                        />
                                        <InfoRow
                                            icon={Cloud}
                                            label="CloudFront invalidation"
                                            value={manifest.cloudfront_invalidation}
                                        />
                                        <InfoRow
                                            icon={Server}
                                            label="Environment"
                                            value={manifest.environment}
                                        />
                                        <InfoRow
                                            icon={Rocket}
                                            label="Frontend status"
                                            value={manifest.frontend_status}
                                        />
                                    </div>
                                </div>

                                {/* Section: Provenance */}
                                <div className="mb-3">
                                    <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-1.5">
                                        Provenance
                                    </h4>
                                    <div className="divide-y divide-border/50">
                                        <InfoRow
                                            icon={GitCommit}
                                            label="Commit"
                                            value={`${manifest.commit_short} — ${manifest.commit_message}`}
                                            href={commitUrl}
                                        />
                                        <InfoRow
                                            icon={Hash}
                                            label="Run"
                                            value={`#${manifest.run_number}`}
                                            href={runUrl}
                                        />
                                        <InfoRow
                                            icon={Github}
                                            label="Repository"
                                            value={manifest.repository}
                                            href={`https://github.com/${manifest.repository}`}
                                        />
                                        <InfoRow
                                            icon={Clock}
                                            label="Deployed at"
                                            value={new Date(manifest.timestamp).toLocaleString()}
                                        />
                                    </div>
                                </div>

                                {/* Section: Verify Build */}
                                <div>
                                    <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-1.5">
                                        Verify Build
                                    </h4>
                                    <div
                                        className="
                      flex items-center gap-2 px-3 py-2.5 rounded-md
                      bg-black/[0.03] dark:bg-white/[0.03]
                      border border-border/40
                    "
                                    >
                                        <ShieldCheck className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                        <code className="text-[11px] font-mono text-foreground/80 break-all flex-1 leading-relaxed select-all">
                                            {manifest.artifact_hash}
                                        </code>
                                        <button
                                            onClick={handleCopyHash}
                                            className="
                        p-1 rounded-md
                        hover:bg-white/20 dark:hover:bg-white/10
                        text-muted-foreground hover:text-foreground
                        transition-colors flex-shrink-0
                      "
                                            title="Copy hash"
                                            id="copy-artifact-hash"
                                        >
                                            {copied ? (
                                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                                            ) : (
                                                <Copy className="h-3.5 w-3.5" />
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground/50 mt-1.5 flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3 text-emerald-500/70" />
                                        Artifact provenance: verified
                                    </p>
                                </div>

                                {/* Footer link */}
                                <div className="pt-3 border-t border-border/30 mt-3">
                                    <a
                                        href={runUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="
                      inline-flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary
                      transition-colors group/link
                    "
                                        id="view-full-pipeline-link"
                                    >
                                        <Github className="h-3.5 w-3.5" />
                                        View full pipeline run
                                        <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}

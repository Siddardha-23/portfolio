import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUnderTheHood } from '@/contexts/UnderTheHoodContext';
import { getFeature, gh } from '@/lib/underTheHoodData';
import {
    X,
    ArrowRight,
    ExternalLink,
    GitBranch,
    FileCode2,
    Server,
    Scale,
    AlertTriangle,
    Activity,
    ChevronRight,
    Layers,
    Cloud,
} from 'lucide-react';

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
    return (
        <div className="flex items-center gap-2 mb-3 mt-6 first:mt-0">
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10">
                <Icon className="h-3.5 w-3.5 text-primary" />
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                {title}
            </h4>
        </div>
    );
}

export default function UnderTheHoodDrawer() {
    const { activeDrawer, closeDrawer } = useUnderTheHood();
    const feature = activeDrawer ? getFeature(activeDrawer) : null;
    const panelRef = useRef<HTMLDivElement>(null);

    // Scroll to top when drawer changes
    useEffect(() => {
        if (panelRef.current) panelRef.current.scrollTop = 0;
    }, [activeDrawer]);

    // Close on Escape key
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeDrawer();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [closeDrawer]);

    return (
        <AnimatePresence>
            {feature && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="uth-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
                        onClick={closeDrawer}
                    />

                    {/* Side Panel */}
                    <motion.div
                        key="uth-panel"
                        ref={panelRef}
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="
              fixed top-0 right-0 z-[61] h-full
              w-full sm:w-[440px] md:w-[480px]
              bg-background/95 backdrop-blur-xl
              border-l border-border/50
              shadow-2xl
              overflow-y-auto overscroll-contain
            "
                        id="under-the-hood-drawer"
                    >
                        {/* ── Header ── */}
                        <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border/50 px-5 py-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/70 mb-1">
                                        Under the Hood
                                    </p>
                                    <h3 className="text-lg font-bold text-foreground leading-tight truncate">
                                        {feature.title}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {feature.subtitle}
                                    </p>
                                </div>
                                <button
                                    onClick={closeDrawer}
                                    className="
                    ml-3 p-1.5 rounded-lg
                    hover:bg-secondary text-muted-foreground hover:text-foreground
                    transition-colors flex-shrink-0
                  "
                                    aria-label="Close drawer"
                                    id="close-uth-drawer"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* ── Content ── */}
                        <div className="px-5 py-4 pb-16 space-y-1">
                            {/* Why it exists */}
                            <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                                <p className="text-xs text-foreground/80 leading-relaxed">
                                    {feature.whyItExists}
                                </p>
                            </div>

                            {/* ─── Request Path ─── */}
                            <SectionHeader icon={ArrowRight} title="Request Path" />
                            <div className="space-y-0">
                                {feature.requestPath.map((hop, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        {/* Connector line */}
                                        <div className="flex flex-col items-center flex-shrink-0 pt-1.5">
                                            <div className="w-2 h-2 rounded-full bg-primary/70 ring-2 ring-primary/20" />
                                            {i < feature.requestPath.length - 1 && (
                                                <div className="w-px flex-1 min-h-[20px] bg-gradient-to-b from-primary/40 to-primary/10" />
                                            )}
                                        </div>
                                        <div className="pb-3 min-w-0">
                                            <span className="text-xs font-semibold text-foreground">
                                                {hop.label}
                                            </span>
                                            {hop.detail && (
                                                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                                                    {hop.detail}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ─── Key Files ─── */}
                            <SectionHeader icon={FileCode2} title="Key Files" />
                            <div className="space-y-1.5">
                                {feature.keyFiles.map((file) => (
                                    <a
                                        key={file.path}
                                        href={gh(file.path, file.lines)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="
                      group flex items-start gap-2 p-2 rounded-md
                      hover:bg-secondary/50 transition-colors
                    "
                                    >
                                        <FileCode2 className="h-3.5 w-3.5 mt-0.5 text-primary/60 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-mono text-primary truncate">
                                                    {file.path.split('/').pop()}
                                                </span>
                                                {file.lines && (
                                                    <span className="text-[10px] text-muted-foreground/50 font-mono">
                                                        {file.lines}
                                                    </span>
                                                )}
                                                <ExternalLink className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary/60 transition-colors flex-shrink-0" />
                                            </div>
                                            <p className="text-[10px] text-muted-foreground leading-snug">
                                                {file.description}
                                            </p>
                                        </div>
                                    </a>
                                ))}
                            </div>

                            {/* ─── Terraform Resources ─── */}
                            <SectionHeader icon={Layers} title="Terraform Resources" />
                            <div className="space-y-1.5">
                                {feature.terraformResources.map((res) => (
                                    <div
                                        key={res.resource}
                                        className="flex items-start gap-2 p-2 rounded-md bg-secondary/20"
                                    >
                                        <Server className="h-3.5 w-3.5 mt-0.5 text-amber-500/70 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <code className="text-[11px] font-mono text-amber-600 dark:text-amber-400 break-all">
                                                {res.resource}
                                            </code>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <span className="text-[10px] text-muted-foreground/50 font-mono">
                                                    {res.file}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">
                                                {res.purpose}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ─── AWS Services ─── */}
                            <SectionHeader icon={Cloud} title="AWS Services" />
                            <div className="flex flex-wrap gap-1.5">
                                {feature.awsServices.map((svc) => (
                                    <span
                                        key={svc}
                                        className="
                      inline-flex items-center px-2 py-0.5
                      text-[10px] font-medium
                      rounded-full
                      bg-amber-500/10 text-amber-600 dark:text-amber-400
                      border border-amber-500/20
                    "
                                    >
                                        {svc}
                                    </span>
                                ))}
                            </div>

                            {/* ─── Tradeoffs ─── */}
                            <SectionHeader icon={Scale} title="Architecture Tradeoffs" />
                            <div className="space-y-3">
                                {feature.tradeoffs.map((t, i) => (
                                    <div
                                        key={i}
                                        className="rounded-lg border border-border/50 p-3 space-y-1.5"
                                    >
                                        <p className="text-xs font-semibold text-foreground leading-snug">
                                            {t.decision}
                                        </p>
                                        <p className="text-[11px] text-foreground/70 leading-relaxed">
                                            <span className="font-medium text-emerald-600 dark:text-emerald-400">Why:</span>{' '}
                                            {t.why}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                                            <span className="font-medium">Alternative:</span> {t.alternative}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* ─── Failure Modes ─── */}
                            <SectionHeader icon={AlertTriangle} title="Failure Modes" />
                            <ul className="space-y-1.5">
                                {feature.failureModes.map((f, i) => (
                                    <li
                                        key={i}
                                        className="flex items-start gap-2 text-[11px] text-foreground/70"
                                    >
                                        <ChevronRight className="h-3 w-3 mt-0.5 text-red-400/60 flex-shrink-0" />
                                        <span className="leading-snug">{f}</span>
                                    </li>
                                ))}
                            </ul>

                            {/* ─── Observability ─── */}
                            <SectionHeader icon={Activity} title="Observability" />
                            <ul className="space-y-1.5">
                                {feature.observability.map((o, i) => (
                                    <li
                                        key={i}
                                        className="flex items-start gap-2 text-[11px] text-foreground/70"
                                    >
                                        <ChevronRight className="h-3 w-3 mt-0.5 text-blue-400/60 flex-shrink-0" />
                                        <span className="leading-snug">{o}</span>
                                    </li>
                                ))}
                            </ul>

                            {/* ─── GitHub Link ─── */}
                            <div className="pt-4 mt-4 border-t border-border/30">
                                <a
                                    href={`https://github.com/Siddardha-23/portfolio`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="
                    inline-flex items-center gap-2 text-xs text-primary/70 hover:text-primary
                    transition-colors group
                  "
                                >
                                    <GitBranch className="h-4 w-4" />
                                    View full repository
                                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </a>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBuilding, FaLinkedin, FaUsers, FaUserTie } from 'react-icons/fa';
import { apiService } from '@/lib/api';

interface OrgStat {
    name: string;
    visitors: number;
    latest_visit: string | null;
}

interface NotableLinkedin {
    name: string;
    count: number;
}

interface OrgStatsData {
    total_visitors: number;
    organizations: OrgStat[];
    total_registered: number;
    linkedin_profiles_found: number;
    notable_linkedin?: NotableLinkedin[];
}

export default function VisitorShowcase() {
    const [stats, setStats] = useState<OrgStatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showLinkedinTooltip, setShowLinkedinTooltip] = useState(false);
    const linkedinRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await apiService.getOrgStats();
                if (response.data) {
                    setStats(response.data);
                }
            } catch {
                // Silently handle fetch failure
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    // Rotate through organizations
    useEffect(() => {
        if (!stats?.organizations.length) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % stats.organizations.length);
        }, 3000);

        return () => clearInterval(interval);
    }, [stats?.organizations.length]);

    if (loading) {
        return (
            <div className="h-20 flex items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full"
                />
            </div>
        );
    }

    const totalVisitors = stats?.total_visitors ?? 0;
    const totalRegistered = stats?.total_registered ?? 0;
    if (!stats || (totalVisitors === 0 && totalRegistered === 0)) {
        return null;
    }

    const currentOrg = stats.organizations[currentIndex];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative"
        >
            {/* Glass card container - adapts to theme */}
            <div className="relative overflow-hidden rounded-2xl glass-card p-6">
                {/* Animated glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-2xl animate-gradient-glow" />

                <div className="relative z-10">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg">
                            <FaUsers className="text-white text-lg" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">Visitors from Top Organizations</h3>
                            <p className="text-sm text-muted-foreground">Professionals who explored this portfolio</p>
                        </div>
                    </div>

                    {/* Stats row: total visitors (all), orgs and LinkedIn (form submitters only) */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="text-center p-3 rounded-xl bg-secondary/50 dark:bg-secondary/30 border border-border">
                            <div className="text-2xl font-bold text-primary">{totalVisitors}</div>
                            <div className="text-xs text-muted-foreground">Total Visitors</div>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-secondary/50 dark:bg-secondary/30 border border-border">
                            <div className="text-2xl font-bold text-accent">{stats.organizations.length}</div>
                            <div className="text-xs text-muted-foreground">Organizations</div>
                        </div>
                        <div
                            ref={linkedinRef}
                            className="relative text-center p-3 rounded-xl bg-secondary/50 dark:bg-secondary/30 border border-border cursor-pointer transition-colors hover:border-blue-500/50"
                            onMouseEnter={() => setShowLinkedinTooltip(true)}
                            onMouseLeave={() => setShowLinkedinTooltip(false)}
                        >
                            <div className="text-2xl font-bold text-blue-500">{stats.linkedin_profiles_found}</div>
                            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                <FaLinkedin className="text-blue-500" /> Found
                            </div>

                            {/* Notable orgs tooltip */}
                            <AnimatePresence>
                                {showLinkedinTooltip && stats.notable_linkedin && stats.notable_linkedin.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56"
                                    >
                                        <div className="bg-popover border border-border rounded-lg shadow-xl p-3">
                                            <div className="text-xs font-semibold text-foreground mb-2">
                                                Professionals from
                                            </div>
                                            <div className="space-y-1.5">
                                                {stats.notable_linkedin.map((org, i) => (
                                                    <div key={i} className="flex items-center justify-between text-xs">
                                                        <span className="text-muted-foreground truncate mr-2">{org.name}</span>
                                                        <span className="text-blue-500 font-medium shrink-0">{org.count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Arrow */}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-popover border-r border-b border-border rotate-45 -mt-1" />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Organization carousel */}
                    {stats.organizations.length > 0 && (
                        <div className="relative overflow-hidden rounded-xl bg-secondary/30 dark:bg-secondary/20 p-4 border border-border">
                            <motion.div
                                key={currentIndex}
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                transition={{ duration: 0.5 }}
                                className="flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/30">
                                        <FaBuilding className="text-primary text-lg" />
                                    </div>
                                    <div>
                                        <div className="text-foreground font-medium">{currentOrg?.name}</div>
                                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                                            <FaUserTie className="text-xs" />
                                            {currentOrg?.visitors} professional{currentOrg?.visitors > 1 ? 's' : ''}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-muted-foreground">viewed this portfolio</div>
                                </div>
                            </motion.div>

                            {/* Carousel dots */}
                            <div className="flex justify-center gap-2 mt-4">
                                {stats.organizations.slice(0, 5).map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentIndex(idx)}
                                        className={`h-2 rounded-full transition-all duration-300 ${idx === currentIndex
                                            ? 'bg-primary w-6'
                                            : 'bg-primary/30 w-2 hover:bg-primary/50'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Call to action */}
                    <motion.div
                        className="mt-4 text-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                    >
                        <p className="text-sm text-muted-foreground italic">
                            Trusted by professionals across leading organizations
                        </p>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
}

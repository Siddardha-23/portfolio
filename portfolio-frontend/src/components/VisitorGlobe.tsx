/**
 * VisitorGlobe - Small popup with 3D spinning globe and zoom.
 * Globe is lazy-loaded so the main app does not load Three.js at startup (avoids blank page).
 * Triggered by event 'open-visitor-map'.
 */
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, X, MapPin, Users, AlertCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiService } from '@/lib/api';

// Lazy-load GlobeView so we never import Three.js/react-globe.gl until the popup is opened
const LazyGlobeView = lazy(() => import('@/components/GlobeView'));

// Country lat/lng for globe points (lat, lng)
const COUNTRY_LATLNG: Record<string, [number, number]> = {
    'United States': [39.8, -98.5], 'US': [39.8, -98.5],
    'Canada': [56.1, -106.3], 'CA': [56.1, -106.3],
    'Mexico': [23.6, -102.5], 'MX': [23.6, -102.5],
    'Brazil': [-14.2, -51.9], 'BR': [-14.2, -51.9],
    'Argentina': [-38.4, -63.6], 'AR': [-38.4, -63.6],
    'Colombia': [4.5, -74.2], 'CO': [4.5, -74.2],
    'United Kingdom': [55.3, -3.4], 'UK': [55.3, -3.4], 'GB': [55.3, -3.4],
    'Germany': [51.1, 10.4], 'DE': [51.1, 10.4],
    'France': [46.2, 2.2], 'FR': [46.2, 2.2],
    'Netherlands': [52.1, 5.3], 'NL': [52.1, 5.3],
    'Spain': [40.4, -3.7], 'ES': [40.4, -3.7],
    'Italy': [41.8, 12.6], 'IT': [41.8, 12.6],
    'Poland': [51.9, 19.1], 'PL': [51.9, 19.1],
    'Sweden': [60.1, 18.6], 'SE': [60.1, 18.6],
    'India': [20.5, 78.9], 'IN': [20.5, 78.9],
    'China': [35.8, 104.1], 'CN': [35.8, 104.1],
    'Japan': [36.2, 138.2], 'JP': [36.2, 138.2],
    'South Korea': [35.9, 127.7], 'KR': [35.9, 127.7],
    'Singapore': [1.3, 103.8], 'SG': [1.3, 103.8],
    'UAE': [23.4, 53.8], 'AE': [23.4, 53.8],
    'Israel': [31.0, 34.8], 'IL': [31.0, 34.8],
    'Pakistan': [30.3, 69.3], 'PK': [30.3, 69.3],
    'Bangladesh': [23.6, 90.3], 'BD': [23.6, 90.3],
    'Philippines': [12.8, 121.7], 'PH': [12.8, 121.7],
    'Nigeria': [9.0, 8.6], 'NG': [9.0, 8.6],
    'South Africa': [-30.5, 22.9], 'ZA': [-30.5, 22.9],
    'Egypt': [26.8, 30.8], 'EG': [26.8, 30.8],
    'Kenya': [-0.0, 37.9], 'KE': [-0.0, 37.9],
    'Australia': [-25.2, 133.7], 'AU': [-25.2, 133.7],
    'New Zealand': [-40.9, 174.8], 'NZ': [-40.9, 174.8],
    'Russia': [61.5, 105.3], 'RU': [61.5, 105.3],
    'Turkey': [38.9, 35.2], 'TR': [38.9, 35.2],
};

interface VisitorLocation {
    country: string;
    count: number;
}

export function VisitorMapTrigger({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-2 w-full p-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all cursor-pointer group"
        >
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md group-hover:shadow-lg transition-shadow">
                <Globe className="h-4 w-4 text-white" />
            </div>
            <div className="text-left flex-1">
                <div className="text-sm font-medium text-foreground">Global Reach</div>
                <div className="text-[10px] text-muted-foreground">View visitor globe</div>
            </div>
            <MapPin className="h-3.5 w-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
    );
}

const GLOBE_SIZE = 320;

export default function VisitorGlobe() {
    const [isOpen, setIsOpen] = useState(false);
    const [globeReady, setGlobeReady] = useState(false);
    const [locations, setLocations] = useState<VisitorLocation[]>([]);
    const [totalVisitors, setTotalVisitors] = useState(0);
    const [loading, setLoading] = useState(false);
    const mapReady = useRef(false);
    const spinResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const globeRef = useRef<{
        pointOfView: (pov?: { lat?: number; lng?: number; altitude?: number }, ms?: number) => unknown;
        controls: () => { autoRotate: boolean; autoRotateSpeed: number };
    } | null>(null);

    const fetchData = async () => {
        if (mapReady.current) return;
        setLoading(true);
        try {
            const response = await apiService.getOrgStats();
            if (response.data) {
                setTotalVisitors(response.data.total_visitors || 0);
                setLocations(response.data.top_countries || []);
                mapReady.current = true;
            }
        } catch {
            // Silently fail
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleOpen = () => {
        setGlobeReady(false);
        setIsOpen(true);
        if (window.history?.pushState) {
            window.history.pushState('', document.title, window.location.pathname + window.location.search);
        }
        if (!mapReady.current) fetchData();
    };

    useEffect(() => {
        window.addEventListener('open-visitor-map', handleOpen);
        return () => {
            window.removeEventListener('open-visitor-map', handleOpen);
            if (spinResumeTimeoutRef.current) clearTimeout(spinResumeTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (!isOpen && spinResumeTimeoutRef.current) {
            clearTimeout(spinResumeTimeoutRef.current);
            spinResumeTimeoutRef.current = null;
        }
    }, [isOpen]);

    const pointsData = locations
        .map((loc) => {
            const coords = COUNTRY_LATLNG[loc.country];
            if (!coords) return null;
            const [lat, lng] = coords;
            return { lat, lng, country: loc.country, count: loc.count };
        })
        .filter(Boolean) as { lat: number; lng: number; country: string; count: number }[];

    const handleZoomIn = () => {
        const g = globeRef.current;
        if (!g) return;
        const pov = g.pointOfView() as { altitude?: number };
        const alt = typeof pov?.altitude === 'number' ? pov.altitude : 2.5;
        g.pointOfView({ altitude: Math.max(1.2, alt - 0.4) }, 300);
    };

    const handleZoomOut = () => {
        const g = globeRef.current;
        if (!g) return;
        const pov = g.pointOfView() as { altitude?: number };
        const alt = typeof pov?.altitude === 'number' ? pov.altitude : 2.5;
        g.pointOfView({ altitude: Math.min(5, alt + 0.4) }, 300);
    };

    const handleFocusCountry = (country: string) => {
        const coords = COUNTRY_LATLNG[country];
        const g = globeRef.current;
        if (!coords || !g) return;
        const [lat, lng] = coords;

        if (spinResumeTimeoutRef.current) {
            clearTimeout(spinResumeTimeoutRef.current);
            spinResumeTimeoutRef.current = null;
        }

        const ctrl = g.controls();
        ctrl.autoRotate = false;
        g.pointOfView({ lat, lng, altitude: 0.95 }, 900);

        spinResumeTimeoutRef.current = setTimeout(() => {
            ctrl.autoRotate = true;
            spinResumeTimeoutRef.current = null;
        }, 5000);
    };

    const isClient = typeof window !== 'undefined';

    return (
        <>
            <motion.div
                className="fixed bottom-6 left-6 z-40 md:hidden"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 3, type: 'spring' }}
            >
                <Button
                    onClick={handleOpen}
                    className="rounded-full w-10 h-10 p-0 bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg"
                    title="Visitor Globe"
                >
                    <Globe className="h-4 w-4 text-white" />
                </Button>
            </motion.div>

            <AnimatePresence>
                {isOpen && isClient && (
                    <>
                        <motion.div
                            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] cursor-pointer"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
                            role="button"
                            tabIndex={0}
                            aria-label="Close overlay"
                        />

                        {/* Centered wrapper: flex so the popup is always in the middle */}
                        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pointer-events-none">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.92 }}
                                transition={{ duration: 0.2, type: 'spring', bounce: 0.25 }}
                                className="flex flex-col rounded-xl overflow-hidden bg-card border border-border shadow-[0_25px_80px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.05)] w-[min(380px,90vw)] max-h-[85vh] pointer-events-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                            {/* Popup title bar */}
                            <div className="flex items-center justify-between px-3 py-2.5 shrink-0 bg-muted/40 border-b border-border/50 rounded-t-xl">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="p-1.5 rounded-md bg-gradient-to-br from-blue-500 to-cyan-500 shadow shrink-0">
                                        <Globe className="h-3.5 w-3.5 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-xs font-bold text-foreground truncate">Global Visitors</h2>
                                        <p className="text-[10px] text-muted-foreground">Click a country to zoom</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 bg-primary/5">
                                        <Users className="h-3 w-3 mr-0.5" />
                                        {totalVisitors}
                                    </Badge>
                                    <Button
                                        onClick={() => setIsOpen(false)}
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-md hover:bg-destructive/10 hover:text-destructive"
                                        title="Close (ESC)"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            {/* Globe + controls */}
                            <div className="flex-1 relative flex items-center justify-center bg-slate-950/90 min-h-[260px]">
                                {loading ? (
                                    <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
                                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                                            <Globe className="h-8 w-8 text-primary" />
                                        </motion.div>
                                        <p className="text-xs text-muted-foreground">Loading...</p>
                                    </div>
                                ) : locations.length === 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
                                        <AlertCircle className="h-8 w-8 text-muted-foreground" />
                                        <p className="text-xs text-muted-foreground">No visitor data</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-full h-full min-h-[280px] flex items-center justify-center" style={{ maxWidth: GLOBE_SIZE, maxHeight: GLOBE_SIZE }}>
                                            <Suspense fallback={
                                                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                                                        <Globe className="h-8 w-8 text-primary/70" />
                                                    </motion.div>
                                                    <p className="text-xs">Loading globe...</p>
                                                </div>
                                            }>
                                                <LazyGlobeView
                                                    ref={globeRef}
                                                    width={GLOBE_SIZE}
                                                    height={GLOBE_SIZE}
                                                    pointsData={pointsData}
                                                    onGlobeReady={() => setGlobeReady(true)}
                                                />
                                            </Suspense>
                                        </div>
                                        {/* Zoom controls */}
                                        <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-lg bg-card/90 border border-border/50 p-1 shadow-lg">
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleZoomIn} title="Zoom in">
                                                <ZoomIn className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleZoomOut} title="Zoom out">
                                                <ZoomOut className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Country list - click to zoom into country */}
                            <div className="px-3 py-2.5 border-t border-border/50 bg-muted/20 shrink-0">
                                <p className="text-[10px] text-muted-foreground mb-1.5 px-0.5">Click to zoom</p>
                                <div className="flex flex-wrap gap-1.5 justify-center max-h-20 overflow-y-auto">
                                    {locations.map((loc, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => handleFocusCountry(loc.country)}
                                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium border border-primary/20 bg-primary/5 hover:bg-primary/15 hover:border-primary/40 text-foreground transition-colors cursor-pointer"
                                        >
                                            <MapPin className="h-2.5 w-2.5 text-cyan-500 shrink-0" />
                                            <span className="truncate max-w-[100px]">{loc.country}</span>
                                            <span className="text-muted-foreground shrink-0">· {loc.count}</span>
                                        </button>
                                    ))}
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

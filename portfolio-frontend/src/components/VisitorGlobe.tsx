/**
 * VisitorGlobe - Interactive world map modal showing visitor locations.
 * Uses Leaflet with CARTO dark tiles, pulsing glow markers, and animated popups.
 * Triggered by custom event 'open-visitor-map'.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, X, MapPin, Users, AlertCircle, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiService } from '@/lib/api';
import L from 'leaflet';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Country centroids for fallback when city-level lat/lng unavailable
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
    'Switzerland': [46.8, 8.2], 'CH': [46.8, 8.2],
    'Belgium': [50.5, 4.5], 'BE': [50.5, 4.5],
    'Austria': [47.5, 14.5], 'AT': [47.5, 14.5],
    'Portugal': [39.4, -8.2], 'PT': [39.4, -8.2],
    'Indonesia': [-0.8, 113.9], 'ID': [-0.8, 113.9],
    'Vietnam': [14.1, 108.3], 'VN': [14.1, 108.3],
    'Thailand': [15.9, 100.9], 'TH': [15.9, 100.9],
    'Malaysia': [4.2, 101.9], 'MY': [4.2, 101.9],
    'Hong Kong': [22.3, 114.2], 'HK': [22.3, 114.2],
    'Chile': [-35.6, -71.2], 'CL': [-35.6, -71.2],
    'Peru': [-9.2, -75.0], 'PE': [-9.2, -75.0],
};

// Country name → flag emoji via regional indicator symbols
const COUNTRY_FLAGS: Record<string, string> = {
    'United States': '\u{1F1FA}\u{1F1F8}', 'Canada': '\u{1F1E8}\u{1F1E6}', 'Mexico': '\u{1F1F2}\u{1F1FD}',
    'Brazil': '\u{1F1E7}\u{1F1F7}', 'Argentina': '\u{1F1E6}\u{1F1F7}', 'Colombia': '\u{1F1E8}\u{1F1F4}',
    'United Kingdom': '\u{1F1EC}\u{1F1E7}', 'Germany': '\u{1F1E9}\u{1F1EA}', 'France': '\u{1F1EB}\u{1F1F7}',
    'Netherlands': '\u{1F1F3}\u{1F1F1}', 'Spain': '\u{1F1EA}\u{1F1F8}', 'Italy': '\u{1F1EE}\u{1F1F9}',
    'Poland': '\u{1F1F5}\u{1F1F1}', 'Sweden': '\u{1F1F8}\u{1F1EA}', 'India': '\u{1F1EE}\u{1F1F3}',
    'China': '\u{1F1E8}\u{1F1F3}', 'Japan': '\u{1F1EF}\u{1F1F5}', 'South Korea': '\u{1F1F0}\u{1F1F7}',
    'Singapore': '\u{1F1F8}\u{1F1EC}', 'UAE': '\u{1F1E6}\u{1F1EA}', 'Israel': '\u{1F1EE}\u{1F1F1}',
    'Pakistan': '\u{1F1F5}\u{1F1F0}', 'Bangladesh': '\u{1F1E7}\u{1F1E9}', 'Philippines': '\u{1F1F5}\u{1F1ED}',
    'Nigeria': '\u{1F1F3}\u{1F1EC}', 'South Africa': '\u{1F1FF}\u{1F1E6}', 'Egypt': '\u{1F1EA}\u{1F1EC}',
    'Kenya': '\u{1F1F0}\u{1F1EA}', 'Australia': '\u{1F1E6}\u{1F1FA}', 'New Zealand': '\u{1F1F3}\u{1F1FF}',
    'Russia': '\u{1F1F7}\u{1F1FA}', 'Turkey': '\u{1F1F9}\u{1F1F7}', 'Switzerland': '\u{1F1E8}\u{1F1ED}',
    'Belgium': '\u{1F1E7}\u{1F1EA}', 'Austria': '\u{1F1E6}\u{1F1F9}', 'Portugal': '\u{1F1F5}\u{1F1F9}',
    'Indonesia': '\u{1F1EE}\u{1F1E9}', 'Vietnam': '\u{1F1FB}\u{1F1F3}', 'Thailand': '\u{1F1F9}\u{1F1ED}',
    'Malaysia': '\u{1F1F2}\u{1F1FE}', 'Hong Kong': '\u{1F1ED}\u{1F1F0}', 'Chile': '\u{1F1E8}\u{1F1F1}',
    'Peru': '\u{1F1F5}\u{1F1EA}',
};

// Junk values that should never appear on the map
const EXCLUDED_NAMES = new Set(['local', 'unknown', 'localhost', 'n/a', '-', '']);

interface VisitorLocation {
    country: string;
    count: number;
}

interface MapPoint {
    country: string;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    count: number;
}

function isValidPoint(point: MapPoint): boolean {
    const c = (point.country || '').trim().toLowerCase();
    return !EXCLUDED_NAMES.has(c);
}

function getPointLatLng(point: MapPoint): [number, number] | null {
    if (point.latitude != null && point.longitude != null &&
        Number.isFinite(point.latitude) && Number.isFinite(point.longitude) &&
        !(point.latitude === 0 && point.longitude === 0)) {
        return [point.latitude, point.longitude];
    }
    return COUNTRY_LATLNG[point.country] ?? null;
}

// Color gradient based on visitor count (low → cyan, high → magenta)
function getMarkerColor(count: number, maxCount: number): { stroke: string; fill: string; glow: string } {
    const ratio = Math.min(count / maxCount, 1);
    if (ratio > 0.6) return { stroke: '#c084fc', fill: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' };
    if (ratio > 0.3) return { stroke: '#60a5fa', fill: '#3b82f6', glow: 'rgba(59, 130, 246, 0.35)' };
    return { stroke: '#22d3ee', fill: '#06b6d4', glow: 'rgba(6, 182, 212, 0.3)' };
}

// Inject CSS for pulsing glow animation + custom popup styling
const STYLE_ID = 'visitor-globe-styles';
function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        @keyframes pulse-ring {
            0% { r: inherit; opacity: 0.6; }
            70% { opacity: 0; }
            100% { opacity: 0; }
        }
        .leaflet-interactive.visitor-marker {
            filter: drop-shadow(0 0 6px var(--marker-glow, rgba(6,182,212,0.4)));
            transition: filter 0.2s, r 0.2s;
        }
        .leaflet-interactive.visitor-marker:hover {
            filter: drop-shadow(0 0 14px var(--marker-glow, rgba(6,182,212,0.6)));
        }
        .visitor-popup .leaflet-popup-content-wrapper {
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(148, 163, 184, 0.15);
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(6, 182, 212, 0.1);
            color: #e2e8f0;
            padding: 0;
        }
        .visitor-popup .leaflet-popup-content {
            margin: 0;
            min-width: 140px;
        }
        .visitor-popup .leaflet-popup-tip {
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(148, 163, 184, 0.15);
            border-top: none;
            border-left: none;
        }
        .visitor-popup .leaflet-popup-close-button {
            color: #94a3b8;
            font-size: 18px;
            top: 4px;
            right: 6px;
        }
        .visitor-popup .leaflet-popup-close-button:hover {
            color: #e2e8f0;
        }
    `;
    document.head.appendChild(style);
}

function MapController({
    mapPoints,
    flyToCountry,
    onFlyDone,
}: {
    mapPoints: MapPoint[];
    flyToCountry: string | null;
    onFlyDone: () => void;
}) {
    const map = useMap();

    useEffect(() => {
        if (mapPoints.length === 0) return;
        const latlngs = mapPoints
            .map(p => getPointLatLng(p))
            .filter((ll): ll is [number, number] => ll != null) as L.LatLngExpression[];
        if (latlngs.length > 0) {
            const bounds = L.latLngBounds(latlngs);
            map.fitBounds(bounds, { padding: [80, 80], maxZoom: 4 });
        }
    }, [mapPoints, map]);

    useEffect(() => {
        if (!flyToCountry) return;
        const latlng = COUNTRY_LATLNG[flyToCountry];
        if (!latlng) return;
        map.flyTo(latlng as L.LatLngExpression, 5, { duration: 1.2 });
        const handleMoveEnd = () => onFlyDone();
        map.once('moveend', handleMoveEnd);
        return () => { map.off('moveend', handleMoveEnd); };
    }, [flyToCountry, map, onFlyDone]);

    return null;
}

export default function VisitorGlobe() {
    const [isOpen, setIsOpen] = useState(false);
    const [locations, setLocations] = useState<VisitorLocation[]>([]);
    const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
    const [totalVisitors, setTotalVisitors] = useState(0);
    const [loading, setLoading] = useState(false);
    const [flyToCountry, setFlyToCountry] = useState<string | null>(null);
    const mapReady = useRef(false);

    // Filter out junk entries on the frontend as a safety net
    const validMapPoints = useMemo(
        () => mapPoints.filter(isValidPoint),
        [mapPoints]
    );
    const validLocations = useMemo(
        () => locations.filter(l => !EXCLUDED_NAMES.has((l.country || '').trim().toLowerCase())),
        [locations]
    );

    const maxCount = Math.max(...validMapPoints.map(p => p.count), 1);
    const countryCount = validLocations.length;

    const fetchData = async () => {
        if (mapReady.current) return;
        setLoading(true);
        try {
            const response = await apiService.getOrgStats();
            if (response.data) {
                setTotalVisitors(response.data.total_visitors || 0);
                const topCountries = response.data.top_countries || [];
                setLocations(topCountries);
                const ml = response.data.map_locations;
                if (ml && ml.length > 0) {
                    setMapPoints(ml);
                } else {
                    setMapPoints(topCountries.map(c => ({ country: c.country, count: c.count })));
                }
                mapReady.current = true;
            }
        } catch {
            // Silently fail
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const handler = () => handleOpen();
        window.addEventListener('open-visitor-map', handler);
        return () => window.removeEventListener('open-visitor-map', handler);
    }, []);

    const handleOpen = () => {
        ensureStyles();
        setIsOpen(true);
        if (window.history?.pushState) {
            window.history.pushState('', document.title, window.location.pathname + window.location.search);
        }
        if (!mapReady.current) fetchData();
    };

    useEffect(() => {
        if (isOpen) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev; };
        }
    }, [isOpen]);

    // ESC key handler
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen]);

    const isClient = typeof window !== 'undefined';

    return (
        <>
            {/* Mobile FAB */}
            <motion.div
                className="fixed bottom-6 left-6 z-40 md:hidden"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 3, type: 'spring' }}
            >
                <Button
                    onClick={handleOpen}
                    className="rounded-full w-10 h-10 p-0 bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg"
                    title="Visitor Map"
                >
                    <Globe className="h-4 w-4 text-white" />
                </Button>
            </motion.div>

            {isClient && createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] cursor-pointer"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsOpen(false)}
                                role="button"
                                tabIndex={0}
                                aria-label="Close overlay"
                            />

                            {/* Modal */}
                            <div
                                className="fixed z-[10000] flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-white/[0.08] bg-slate-950 shadow-2xl"
                                style={{
                                    left: '50%',
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 'min(1100px, 95vw)',
                                    height: 'min(850px, 90vh)',
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.3, type: 'spring', bounce: 0.2 }}
                                    className="flex h-full w-full flex-col overflow-hidden"
                                >
                                    {/* Header */}
                                    <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-sm px-4 sm:px-6 py-4">
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            <div className="shrink-0 rounded-xl bg-gradient-to-br from-blue-500 via-blue-400 to-cyan-500 p-2.5 shadow-lg shadow-blue-500/20">
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                                                >
                                                    <Globe className="h-5 w-5 text-white" />
                                                </motion.div>
                                            </div>
                                            <div className="min-w-0">
                                                <h2 className="text-lg font-semibold text-white">Global Visitors</h2>
                                                <p className="text-xs text-slate-400 hidden sm:block">Click markers for details</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge className="hidden sm:flex gap-1.5 bg-cyan-500/10 border-cyan-500/20 text-cyan-400 text-xs">
                                                <Users className="h-3.5 w-3.5" />
                                                {totalVisitors} visitors
                                            </Badge>
                                            {countryCount > 0 && (
                                                <Badge className="hidden md:flex gap-1.5 bg-purple-500/10 border-purple-500/20 text-purple-400 text-xs">
                                                    <Navigation className="h-3.5 w-3.5" />
                                                    {countryCount} countries
                                                </Badge>
                                            )}
                                            <Button
                                                onClick={() => setIsOpen(false)}
                                                className="h-8 w-8 p-0 rounded-lg hover:bg-white/10 transition-colors bg-white/5 text-slate-400 hover:text-white"
                                                title="Close (ESC)"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Map area */}
                                    <div className="flex-1 relative bg-slate-950 w-full min-h-0 overflow-hidden">
                                        {loading ? (
                                            <div className="absolute inset-0 flex items-center justify-center z-10 flex-col gap-4">
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                                >
                                                    <Globe className="h-12 w-12 text-cyan-500/60" />
                                                </motion.div>
                                                <p className="text-sm text-slate-500">Loading visitor data...</p>
                                            </div>
                                        ) : validMapPoints.length === 0 ? (
                                            <div className="absolute inset-0 flex items-center justify-center z-10 flex-col gap-3">
                                                <AlertCircle className="h-10 w-10 text-slate-600" />
                                                <p className="text-sm text-slate-500">No visitor data available</p>
                                            </div>
                                        ) : (
                                            <MapContainer
                                                center={[20, 0]}
                                                zoom={2}
                                                minZoom={2}
                                                maxZoom={12}
                                                scrollWheelZoom={true}
                                                zoomControl={false}
                                                dragging={true}
                                                touchZoom={true}
                                                doubleClickZoom={true}
                                                className="w-full h-full !m-0 !p-0"
                                                style={{
                                                    background: '#0a0f1e',
                                                    position: 'absolute',
                                                    inset: 0,
                                                    zIndex: 1,
                                                }}
                                            >
                                                <TileLayer
                                                    key="base-layer"
                                                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                                                    url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
                                                    maxZoom={19}
                                                    tileSize={256}
                                                />
                                                <TileLayer
                                                    key="label-layer"
                                                    attribution=""
                                                    url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
                                                    maxZoom={19}
                                                    tileSize={256}
                                                    opacity={0.5}
                                                />

                                                {/* Outer glow rings (rendered behind markers) */}
                                                {validMapPoints.map((point, i) => {
                                                    const latlng = getPointLatLng(point);
                                                    if (!latlng) return null;
                                                    const colors = getMarkerColor(point.count, maxCount);
                                                    const glowRadius = 8 + (point.count / maxCount) * 25;
                                                    return (
                                                        <CircleMarker
                                                            key={`glow-${point.country}-${point.city ?? ''}-${i}`}
                                                            center={latlng}
                                                            radius={glowRadius}
                                                            pathOptions={{
                                                                color: 'transparent',
                                                                fillColor: colors.fill,
                                                                fillOpacity: 0.12,
                                                                weight: 0,
                                                            }}
                                                            interactive={false}
                                                        />
                                                    );
                                                })}

                                                {/* Main markers */}
                                                {validMapPoints.map((point, i) => {
                                                    const latlng = getPointLatLng(point);
                                                    if (!latlng) return null;
                                                    const colors = getMarkerColor(point.count, maxCount);
                                                    const radius = 4 + (point.count / maxCount) * 14;
                                                    const label = point.city
                                                        ? `${point.city}, ${point.country}`
                                                        : point.country;
                                                    const flag = COUNTRY_FLAGS[point.country] || '';

                                                    return (
                                                        <CircleMarker
                                                            key={`marker-${point.country}-${point.city ?? ''}-${i}`}
                                                            center={latlng}
                                                            radius={radius}
                                                            className="visitor-marker"
                                                            pathOptions={{
                                                                color: colors.stroke,
                                                                fillColor: colors.fill,
                                                                fillOpacity: 0.7,
                                                                weight: 1.5,
                                                                opacity: 0.9,
                                                            }}
                                                        >
                                                            <Popup className="visitor-popup">
                                                                <div className="px-4 py-3 font-sans">
                                                                    <div className="flex items-center gap-2 mb-1.5">
                                                                        {flag && <span className="text-lg leading-none">{flag}</span>}
                                                                        <span className="font-semibold text-sm text-white">{label}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                                        <Users className="h-3 w-3 text-cyan-400" />
                                                                        <span>
                                                                            <span className="text-cyan-400 font-medium">{point.count}</span>
                                                                            {' '}visitor{point.count !== 1 ? 's' : ''}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </Popup>
                                                        </CircleMarker>
                                                    );
                                                })}

                                                <MapController
                                                    mapPoints={validMapPoints}
                                                    flyToCountry={flyToCountry}
                                                    onFlyDone={() => setFlyToCountry(null)}
                                                />
                                                <ZoomControl position="bottomright" />
                                            </MapContainer>
                                        )}
                                    </div>

                                    {/* Footer: country buttons */}
                                    {validLocations.length > 0 && (
                                        <div className="border-t border-white/[0.06] px-4 py-3 shrink-0 bg-slate-950/90 backdrop-blur-sm">
                                            <div className="flex flex-wrap gap-1.5 justify-center max-h-[72px] overflow-y-auto scrollbar-thin">
                                                {validLocations.map((loc, i) => {
                                                    const flag = COUNTRY_FLAGS[loc.country];
                                                    return (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={() => setFlyToCountry(loc.country)}
                                                            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs font-medium transition-all hover:bg-white/[0.1] hover:border-cyan-500/30 hover:shadow-[0_0_12px_rgba(6,182,212,0.15)] focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-slate-300"
                                                        >
                                                            {flag ? (
                                                                <span className="text-sm leading-none">{flag}</span>
                                                            ) : (
                                                                <MapPin className="h-3 w-3 flex-shrink-0 text-cyan-500" />
                                                            )}
                                                            <span className="truncate">{loc.country}</span>
                                                            <span className="flex-shrink-0 text-slate-500 font-normal">{loc.count}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            </div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}

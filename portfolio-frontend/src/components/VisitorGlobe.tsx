/**
 * VisitorGlobe - Professional interactive world map modal showing visitor locations.
 * Uses Leaflet for a real, zoomable map with clean tile rendering.
 * Triggered by event 'open-visitor-map'.
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, X, MapPin, Users, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiService } from '@/lib/api';
// Leaflet imports
import L from 'leaflet';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Country lat/lng coordinates (same as before)
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
    'Updated': [0.0, 0.0],
};

interface VisitorLocation {
    country: string;
    count: number;
}

/** Map point: country-level or city-level with real lat/long when available */
interface MapPoint {
    country: string;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    count: number;
}

function getPointLatLng(point: MapPoint): [number, number] | null {
    if (point.latitude != null && point.longitude != null &&
        Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) {
        return [point.latitude, point.longitude];
    }
    const countryLatLng = COUNTRY_LATLNG[point.country];
    return countryLatLng ? countryLatLng : null;
}

// Map controller: fit bounds from map points (real lat/long or country centroid)
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
        const latlng = COUNTRY_LATLNG[flyToCountry] ?? COUNTRY_LATLNG['United States'];
        if (!latlng) return;
        map.flyTo(latlng as L.LatLngExpression, 5, { duration: 1.2 });
        const handleMoveEnd = () => {
            onFlyDone();
        };
        map.once('moveend', handleMoveEnd);
        return () => {
            map.off('moveend', handleMoveEnd);
        };
    }, [flyToCountry, map, onFlyDone]);

    return null;
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
                <div className="text-[10px] text-muted-foreground">View visitor map</div>
            </div>
            <MapPin className="h-3.5 w-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
    );
}

export default function VisitorGlobe() {
    const [isOpen, setIsOpen] = useState(false);
    const [locations, setLocations] = useState<VisitorLocation[]>([]);
    const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
    const [totalVisitors, setTotalVisitors] = useState(0);
    const [loading, setLoading] = useState(false);
    const [flyToCountry, setFlyToCountry] = useState<string | null>(null);
    const mapReady = useRef(false);

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

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        const handler = () => handleOpen();
        window.addEventListener('open-visitor-map', handler);
        return () => window.removeEventListener('open-visitor-map', handler);
    }, []);

    const handleOpen = () => {
        setIsOpen(true);
        if (window.history && window.history.pushState) {
            window.history.pushState("", document.title, window.location.pathname + window.location.search);
        }
        if (!mapReady.current) fetchData();
    };

    // Lock body scroll when popup is open so modal stays centered
    useEffect(() => {
        if (isOpen) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev; };
        }
    }, [isOpen]);

    const maxCount = Math.max(...mapPoints.map(p => p.count), 1);
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
                    title="Visitor Map"
                >
                    <Globe className="h-4 w-4 text-white" />
                </Button>
            </motion.div>

            {isClient && createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <>
                            <motion.div
                                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] cursor-pointer"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsOpen(false)}
                                onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
                                role="button"
                                tabIndex={0}
                                aria-label="Close overlay"
                            />

                            {/* Wrapper handles centering so Framer Motion's transform doesn't override it */}
                            <div
                                className="fixed z-[10000] flex flex-col overflow-hidden rounded-3xl border border-border/50 bg-card shadow-2xl"
                                style={{
                                    left: '50%',
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 'min(1100px, 92vw)',
                                    height: 'min(850px, 88vh)',
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.85 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.85 }}
                                    transition={{ duration: 0.25, type: 'spring', bounce: 0.25 }}
                                    className="flex h-full w-full flex-col overflow-hidden"
                                >
                            <div className="flex shrink-0 items-center justify-between border-b border-border/50 bg-gradient-to-r from-card via-card/60 to-card px-6 py-5">
                                <div className="flex min-w-0 flex-1 items-center gap-4">
                                    <div className="shrink-0 rounded-xl bg-gradient-to-br from-blue-500 via-blue-400 to-cyan-500 p-3 shadow-lg">
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                                        >
                                            <Globe className="h-6 w-6 text-white" />
                                        </motion.div>
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-xl font-bold text-foreground">Global Visitors</h2>
                                        <p className="text-sm text-muted-foreground">Scroll to zoom • Drag to pan • Use +/− to zoom in/out</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Badge
                                        className="hidden sm:flex gap-2 bg-primary/10 border-primary/20 text-primary"
                                        title="One count per unique browser (fingerprint)"
                                    >
                                        <Users className="h-4 w-4" />
                                        <span className="font-semibold">{totalVisitors} unique visitors</span>
                                    </Badge>
                                    <Button 
                                        onClick={() => setIsOpen(false)} 
                                        className="h-9 w-9 p-0 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors bg-muted/50"
                                        title="Close (ESC)"
                                    >
                                        <X className="h-6 w-6" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 relative bg-slate-950 w-full min-h-0 overflow-hidden">
                                {loading ? (
                                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-950/40 flex-col gap-3">
                                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                                            <Globe className="h-10 w-10 text-primary" />
                                        </motion.div>
                                        <p className="text-sm text-muted-foreground">Loading visitor data...</p>
                                    </div>
                                ) : mapPoints.length === 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center z-10 flex-col gap-3 bg-slate-950/40">
                                        <AlertCircle className="h-10 w-10 text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground">No visitor data available</p>
                                    </div>
                                ) : (
                                    <MapContainer
                                        center={[20, 0]}
                                        zoom={2}
                                        minZoom={1}
                                        maxZoom={10}
                                        scrollWheelZoom={true}
                                        zoomControl={false}
                                        dragging={true}
                                        touchZoom={true}
                                        doubleClickZoom={true}
                                        className="w-full h-full !m-0 !p-0"
                                        style={{ 
                                            background: '#0f172a',
                                            position: 'absolute',
                                            inset: 0,
                                            zIndex: 1
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
                                            opacity={0.7}
                                        />
                                        {mapPoints.map((point, i) => {
                                            const latlng = getPointLatLng(point);
                                            if (!latlng) return null;
                                            const radius = 5 + (point.count / maxCount) * 18;
                                            const label = point.city ? `${point.city}, ${point.country}` : point.country;
                                            return (
                                                <CircleMarker
                                                    key={`${point.country}-${point.city ?? ''}-${i}`}
                                                    center={latlng}
                                                    radius={radius}
                                                    pathOptions={{
                                                        color: '#0ea5e9',
                                                        fillColor: '#06b6d4',
                                                        fillOpacity: 0.65,
                                                        weight: 2,
                                                        opacity: 0.95,
                                                    }}
                                                >
                                                    <Popup>
                                                        <div className="text-center font-sans">
                                                            <div className="font-bold text-sm">{label}</div>
                                                            <div className="text-xs text-gray-600">{point.count} visitor{point.count > 1 ? 's' : ''}</div>
                                                        </div>
                                                    </Popup>
                                                </CircleMarker>
                                            );
                                        })}
                                        <MapController
                                            mapPoints={mapPoints}
                                            flyToCountry={flyToCountry}
                                            onFlyDone={() => setFlyToCountry(null)}
                                        />
                                        <ZoomControl position="bottomright" />
                                    </MapContainer>
                                )}
                            </div>

                            <div className="border-t border-border/50 px-4 py-3 shrink-0 bg-gradient-to-r from-card/50 via-card to-card/50 max-h-24 overflow-hidden">
                                <p className="text-center text-xs text-muted-foreground mb-1.5" title="Counts by location; sum may exceed unique visitors">
                                    By location
                                </p>
                                <div className="flex flex-wrap gap-2 justify-center overflow-y-auto max-h-20">
                                    {locations.map((loc, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setFlyToCountry(loc.country)}
                                            className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-xs font-medium transition-colors hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        >
                                            <MapPin className="h-3 w-3 flex-shrink-0 text-cyan-500" />
                                            <span className="truncate">{loc.country}</span>
                                            <span className="flex-shrink-0 text-muted-foreground">· {loc.count}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
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

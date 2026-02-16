/**
 * VisitorGlobe - Professional interactive world map modal showing visitor locations.
 * Uses Leaflet for a real, zoomable map with clean tile rendering.
 * Triggered by event 'open-visitor-map'.
 */
import { useState, useEffect, useRef } from 'react';
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

// Map controller component to handle bounds and initial setup
function MapController({ locations }: { locations: VisitorLocation[] }) {
    const map = useMap();

    useEffect(() => {
        if (locations.length === 0) return;

        // Create bounds from all locations
        const latlngs = locations
            .map(loc => COUNTRY_LATLNG[loc.country])
            .filter(Boolean) as L.LatLngExpression[];

        if (latlngs.length > 0) {
            const bounds = L.latLngBounds(latlngs);
            // Add padding
            map.fitBounds(bounds, { padding: [80, 80], maxZoom: 4 });
        }
    }, [locations, map]);

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
    const [totalVisitors, setTotalVisitors] = useState(0);
    const [loading, setLoading] = useState(false);
    const mapReady = useRef(false);

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

    const maxCount = Math.max(...locations.map(l => l.count), 1);
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

            <AnimatePresence>
                {isOpen && isClient && (
                    <>
                        <motion.div
                            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[999] cursor-pointer"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3, type: 'spring', bounce: 0.2 }}
                            style={{
                                position: 'fixed',
                                top: '50%',
                                left: '50%',
                                marginTop: 'auto',
                                marginBottom: 'auto',
                                marginLeft: 'auto',
                                marginRight: 'auto',
                                transform: 'translate(-50%, -50%)',
                                width: 'min(1100px, 92vw)',
                                height: 'min(850px, 88vh)',
                                zIndex: 1000,
                            }}
                            className="bg-card rounded-3xl shadow-2xl border border-border/50 overflow-hidden flex flex-col"
                        >
                            <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 shrink-0 bg-gradient-to-r from-card via-card/60 to-card">
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 via-blue-400 to-cyan-500 shadow-lg shrink-0">
                                        <Globe className="h-6 w-6 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-xl font-bold text-foreground">Global Visitors</h2>
                                        <p className="text-sm text-muted-foreground">Interactive map — zoom and explore</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Badge className="hidden sm:flex gap-2 bg-primary/10 border-primary/20 text-primary">
                                        <Users className="h-4 w-4" />
                                        <span className="font-semibold">{totalVisitors} visitors</span>
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
                                ) : locations.length === 0 ? (
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
                                        {locations.map((loc, i) => {
                                            const latlng = COUNTRY_LATLNG[loc.country];
                                            if (!latlng) return null;
                                            const radius = 5 + (loc.count / maxCount) * 18;
                                            return (
                                                <CircleMarker
                                                    key={`${loc.country}-${i}`}
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
                                                            <div className="font-bold text-sm">{loc.country}</div>
                                                            <div className="text-xs text-gray-600">{loc.count} visitor{loc.count > 1 ? 's' : ''}</div>
                                                        </div>
                                                    </Popup>
                                                </CircleMarker>
                                            );
                                        })}
                                        <MapController locations={locations} />
                                        <ZoomControl position="bottomright" />
                                    </MapContainer>
                                )}
                            </div>

                            <div className="border-t border-border/50 px-4 py-3 shrink-0 bg-gradient-to-r from-card/50 via-card to-card/50 max-h-24 overflow-hidden">
                                <div className="flex flex-wrap gap-2 justify-center overflow-y-auto max-h-20">
                                    {locations.map((loc, i) => (
                                        <Badge key={i} variant="outline" className="px-2 py-1 gap-1 text-xs flex-shrink-0 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
                                            <MapPin className="h-3 w-3 text-cyan-500 flex-shrink-0" />
                                            <span className="truncate">{loc.country}</span>
                                            <span className="text-muted-foreground flex-shrink-0">· {loc.count}</span>
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

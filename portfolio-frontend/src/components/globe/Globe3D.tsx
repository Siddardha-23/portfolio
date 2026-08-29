/**
 * The 3D visitor globe.
 *
 * Drawn from local vector polygons rather than a photographic earth texture:
 * it keeps the instrument-panel look consistent with the rest of the page, needs
 * no third-party image host at runtime, and stays legible at small sizes where a
 * satellite image turns to mud.
 *
 * Heavy (three.js). Always reach it through a lazy import.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import type { VisitorPoint } from '@/hooks/useVisitorGeo';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

/** Tempe, AZ — where the arcs originate. */
export const HOME_COORDS = { lat: 33.4255, lng: -111.94, label: 'Tempe, Arizona' };

/**
 * Two palettes rather than one dark scene: the globe sits inside the page, so it
 * has to follow the theme toggle like every other surface. Light mode inverts the
 * figure/ground — pale ocean, darker land — instead of dimming the dark palette,
 * which would just look grey.
 */
const PALETTES = {
    dark: {
        ocean: '#070b14',
        land: 'rgba(56, 82, 112, 0.55)',
        landSide: 'rgba(10, 16, 28, 0.9)',
        border: 'rgba(125, 175, 220, 0.28)',
        atmosphere: '#4da3ff',
        point: '#38e0d0',
        pointHot: '#7dd3fc',
        ring: '56, 224, 208',
        arc: '#38e0d0',
        arcFade: 'rgba(56, 224, 208, 0)',
        home: '#fbbf24',
    },
    light: {
        ocean: '#dde5f0',
        land: 'rgba(94, 124, 158, 0.75)',
        landSide: 'rgba(168, 186, 210, 0.9)',
        border: 'rgba(40, 76, 118, 0.35)',
        atmosphere: '#6aa6f5',
        point: '#0d9488',
        pointHot: '#0369a1',
        ring: '13, 148, 136',
        arc: '#0d9488',
        arcFade: 'rgba(13, 148, 136, 0)',
        home: '#c2410c',
    },
} as const;

interface CountryFeature {
    properties: { iso: string; name: string };
}

export interface Globe3DHandle {
    /** Animate the camera to a lat/lng. */
    flyTo: (lat: number, lng: number, altitude?: number, ms?: number) => void;
    setAutoRotate: (on: boolean) => void;
}

export interface Globe3DProps {
    points: VisitorPoint[];
    width: number;
    height: number;
    /** Draw arcs from Tempe to each visitor. */
    showArcs?: boolean;
    autoRotate?: boolean;
    autoRotateSpeed?: number;
    /** Initial camera distance. Larger is further away. */
    altitude?: number;
    onPointClick?: (point: VisitorPoint) => void;
    onReady?: () => void;
}

const Globe3D = forwardRef<Globe3DHandle, Globe3DProps>(function Globe3D(
    {
        points,
        width,
        height,
        showArcs = true,
        autoRotate = true,
        autoRotateSpeed = 0.35,
        altitude = 2.4,
        onPointClick,
        onReady,
    },
    ref
) {
    const globeRef = useRef<GlobeMethods | undefined>(undefined);
    const [countries, setCountries] = useState<CountryFeature[]>([]);
    const [hovered, setHovered] = useState<VisitorPoint | null>(null);

    const theme = useResolvedTheme();
    const COLORS = PALETTES[theme];

    // Vector landmasses. Failing to load leaves a clean sphere rather than an error.
    useEffect(() => {
        let cancelled = false;
        fetch('/geo/countries.geojson')
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((geo) => {
                if (!cancelled) setCountries(geo.features ?? []);
            })
            .catch(() => {
                if (!cancelled) setCountries([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            flyTo: (lat, lng, alt = 1.6, ms = 1200) => {
                globeRef.current?.pointOfView({ lat, lng, altitude: alt }, ms);
            },
            setAutoRotate: (on) => {
                const controls = globeRef.current?.controls();
                if (controls) controls.autoRotate = on;
            },
        }),
        []
    );

    // A matte sphere: no specular highlight sliding across the ocean as it spins.
    const globeMaterial = useMemo(() => {
        const material = new THREE.MeshPhongMaterial();
        material.color = new THREE.Color(COLORS.ocean);
        material.shininess = 0;
        return material;
    }, [COLORS.ocean]);

    const maxCount = useMemo(
        () => Math.max(1, ...points.map((p) => p.count)),
        [points]
    );

    // Arcs read as traffic arriving, so they all start at home.
    const arcs = useMemo(() => {
        if (!showArcs) return [];
        return points.map((p, i) => ({
            startLat: HOME_COORDS.lat,
            startLng: HOME_COORDS.lng,
            endLat: p.lat,
            endLng: p.lng,
            count: p.count,
            // Staggered here rather than in an accessor: an accessor returning a
            // fresh random number would re-roll every arc on each re-render, so
            // the dashes would jump whenever a marker is hovered.
            dashGap: (i * 0.37) % 2,
        }));
    }, [points, showArcs]);

    // The home marker is a point too, so it sits in the same render pass.
    const markers = useMemo(
        () => [
            ...points,
            {
                id: '__home__',
                code: 'US',
                country: HOME_COORDS.label,
                flag: '',
                city: null,
                label: HOME_COORDS.label,
                lat: HOME_COORDS.lat,
                lng: HOME_COORDS.lng,
                count: 0,
                approximate: false,
            } satisfies VisitorPoint,
        ],
        [points]
    );

    useEffect(() => {
        const controls = globeRef.current?.controls();
        if (controls) controls.autoRotate = autoRotate;
    }, [autoRotate]);

    /**
     * The camera's field of view is vertical, so on a canvas that is taller than
     * it is wide — a phone, or the modal in portrait — the globe overflows left
     * and right. Pulling the camera back by the inverse aspect makes it fit.
     *
     * distance = R * (1 + altitude), so scaling distance by 1/aspect gives
     * altitude' = (1 + altitude) / aspect - 1.
     */
    const fittedAltitude = useMemo(() => {
        if (!width || !height) return altitude;
        const aspect = width / height;
        if (aspect >= 1) return altitude;
        return (1 + altitude) / aspect - 1;
    }, [altitude, width, height]);

    // Re-fit when the box changes shape (rotation, modal resize), not just on mount.
    useEffect(() => {
        const globe = globeRef.current;
        if (!globe) return;
        const current = globe.pointOfView();
        globe.pointOfView({ ...current, altitude: fittedAltitude }, 400);
    }, [fittedAltitude]);

    return (
        // Centred and clipped: three-render-objects falls back to window-sized
        // canvas when it is handed a non-finite width, which would otherwise put
        // the globe's centre far down and to the right of this box.
        <div
            className="relative flex items-center justify-center overflow-hidden"
            style={{ width, height }}
        >
            <Globe
                ref={globeRef}
                width={width}
                height={height}
                backgroundColor="rgba(0,0,0,0)"
                globeMaterial={globeMaterial}
                showAtmosphere
                atmosphereColor={COLORS.atmosphere}
                atmosphereAltitude={0.17}
                showGraticules
                polygonsData={countries}
                polygonCapColor={() => COLORS.land}
                polygonSideColor={() => COLORS.landSide}
                polygonStrokeColor={() => COLORS.border}
                polygonAltitude={0.006}
                pointsData={markers}
                pointLat="lat"
                pointLng="lng"
                pointColor={(d) => {
                    const p = d as VisitorPoint;
                    if (p.id === '__home__') return COLORS.home;
                    return p.count / maxCount > 0.6 ? COLORS.pointHot : COLORS.point;
                }}
                // Altitude encodes volume, so the globe reads as a bar chart
                // wrapped round a sphere rather than a scatter of equal dots.
                pointAltitude={(d) => {
                    const p = d as VisitorPoint;
                    if (p.id === '__home__') return 0.06;
                    return 0.015 + (p.count / maxCount) * 0.16;
                }}
                pointRadius={(d) => ((d as VisitorPoint).id === '__home__' ? 0.42 : 0.3)}
                pointsMerge={false}
                pointsTransitionDuration={900}
                onPointHover={(d) => {
                    const p = d as VisitorPoint | null;
                    setHovered(p && p.id !== '__home__' ? p : null);
                }}
                onPointClick={(d) => {
                    const p = d as VisitorPoint;
                    if (p.id !== '__home__') onPointClick?.(p);
                }}
                ringsData={points}
                ringLat="lat"
                ringLng="lng"
                ringColor={() => (t: number) => `rgba(${COLORS.ring}, ${1 - t})`}
                ringMaxRadius={(d) => 1.5 + ((d as VisitorPoint).count / maxCount) * 3}
                ringPropagationSpeed={1.4}
                ringRepeatPeriod={2200}
                ringAltitude={0.007}
                arcsData={arcs}
                arcStartLat="startLat"
                arcStartLng="startLng"
                arcEndLat="endLat"
                arcEndLng="endLng"
                arcColor={() => [COLORS.arcFade, COLORS.arc, COLORS.arcFade]}
                arcAltitudeAutoScale={0.42}
                arcStroke={0.32}
                arcDashLength={0.45}
                arcDashGap={1.8}
                arcDashInitialGap={(d) => (d as { dashGap: number }).dashGap}
                arcDashAnimateTime={2600}
                arcsTransitionDuration={900}
                onGlobeReady={() => {
                    const globe = globeRef.current;
                    if (globe) {
                        const controls = globe.controls();
                        controls.autoRotate = autoRotate;
                        controls.autoRotateSpeed = autoRotateSpeed;
                        controls.enableZoom = true;
                        controls.minDistance = 180;
                        // Generous, so a tall canvas's fitted altitude is never
                        // clamped back to a distance that crops the globe.
                        controls.maxDistance = 1400;
                        globe.pointOfView({ lat: 22, lng: 10, altitude: fittedAltitude }, 0);
                    }
                    onReady?.();
                }}
            />

            {hovered && (
                <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-md border border-border bg-popover/95 px-3 py-2 font-mono text-[11px] tracking-tight text-popover-foreground shadow-xl backdrop-blur">
                    <span className="mr-2">{hovered.flag}</span>
                    {hovered.label}
                    <span className="ml-2 text-primary">
                        {hovered.count} visitor{hovered.count === 1 ? '' : 's'}
                    </span>
                    {hovered.approximate && (
                        <span className="ml-2 text-muted-foreground">~country</span>
                    )}
                </div>
            )}
        </div>
    );
});

export default Globe3D;

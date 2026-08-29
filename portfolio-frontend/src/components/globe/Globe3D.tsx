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

/** Tempe, AZ — where the arcs originate. */
export const HOME_COORDS = { lat: 33.4255, lng: -111.94, label: 'Tempe, Arizona' };

const COLORS = {
    ocean: '#070b14',
    land: 'rgba(56, 82, 112, 0.55)',
    landSide: 'rgba(10, 16, 28, 0.9)',
    border: 'rgba(125, 175, 220, 0.28)',
    atmosphere: '#4da3ff',
    point: '#38e0d0',
    pointHot: '#7dd3fc',
    arc: '#38e0d0',
    home: '#fbbf24',
};

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
    }, []);

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

    return (
        <div className="relative" style={{ width, height }}>
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
                ringColor={() => (t: number) => `rgba(56, 224, 208, ${1 - t})`}
                ringMaxRadius={(d) => 1.5 + ((d as VisitorPoint).count / maxCount) * 3}
                ringPropagationSpeed={1.4}
                ringRepeatPeriod={2200}
                ringAltitude={0.007}
                arcsData={arcs}
                arcStartLat="startLat"
                arcStartLng="startLng"
                arcEndLat="endLat"
                arcEndLng="endLng"
                arcColor={() => ['rgba(251, 191, 36, 0.0)', COLORS.arc, 'rgba(56, 224, 208, 0.0)']}
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
                        controls.maxDistance = 620;
                        globe.pointOfView({ lat: 22, lng: 10, altitude }, 0);
                    }
                    onReady?.();
                }}
            />

            {hovered && (
                <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-md border border-white/10 bg-[#070b14]/95 px-3 py-2 font-mono text-[11px] tracking-tight text-slate-200 shadow-xl backdrop-blur">
                    <span className="mr-2">{hovered.flag}</span>
                    {hovered.label}
                    <span className="ml-2 text-teal-300">
                        {hovered.count} visitor{hovered.count === 1 ? '' : 's'}
                    </span>
                    {hovered.approximate && (
                        <span className="ml-2 text-slate-500">~country</span>
                    )}
                </div>
            )}
        </div>
    );
});

export default Globe3D;

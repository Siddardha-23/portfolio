/**
 * GlobeView - Renders the 3D globe. Loaded only when the visitor popup is open
 * so the main app does not load Three.js at startup (avoids blank page).
 */
import { forwardRef, useImperativeHandle, useRef } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';

export interface GlobePoint {
    lat: number;
    lng: number;
    country: string;
    count: number;
}

export interface GlobeViewProps {
    width: number;
    height: number;
    pointsData: GlobePoint[];
    onGlobeReady?: () => void;
}

export interface GlobeViewHandle {
    pointOfView: GlobeMethods['pointOfView'];
    controls: GlobeMethods['controls'];
}

const GlobeView = forwardRef<GlobeViewHandle, GlobeViewProps>(function GlobeView(
    { width, height, pointsData, onGlobeReady },
    ref
) {
    const innerRef = useRef<GlobeMethods | undefined>(undefined);

    useImperativeHandle(ref, () => ({
        pointOfView: ((pov?: { lat?: number; lng?: number; altitude?: number }, ms?: number) => {
            if (!innerRef.current) return undefined;
            if (pov === undefined && ms === undefined) return innerRef.current.pointOfView();
            return innerRef.current.pointOfView(pov!, ms);
        }) as GlobeMethods['pointOfView'],
        controls: () => innerRef.current!.controls(),
    }), []);

    const labelsData = pointsData.map((p) => ({ lat: p.lat, lng: p.lng, text: p.country }));

    return (
        <Globe
            ref={innerRef as React.RefObject<GlobeMethods>}
            width={width}
            height={height}
            backgroundColor="rgba(15,23,42,0.6)"
            globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
            showAtmosphere={true}
            atmosphereColor="#38bdf8"
            atmosphereAltitude={0.2}
            showGraticules={true}
            graticuleColor="rgba(255,255,255,0.06)"
            pointsData={pointsData}
            pointLat="lat"
            pointLng="lng"
            pointColor={() => '#06b6d4'}
            pointAltitude={0.02}
            pointRadius={(d) => 0.4 + (d as GlobePoint).count * 0.06}
            pointLabel={(d) => {
                const o = d as GlobePoint;
                return `${o.country}: ${o.count} visitor${o.count !== 1 ? 's' : ''}`;
            }}
            pointsTransitionDuration={800}
            ringsData={pointsData}
            ringLat="lat"
            ringLng="lng"
            ringAltitude={0.015}
            ringColor={() => ['#06b6d4', '#0ea5e9']}
            ringMaxRadius={0.5}
            ringPropagationSpeed={2}
            ringRepeatPeriod={2000}
            labelsData={labelsData}
            labelLat="lat"
            labelLng="lng"
            labelText="text"
            labelColor={() => '#f1f5f9'}
            labelAltitude={0.025}
            labelSize={0.8}
            labelResolution={2}
            labelIncludeDot={false}
            onGlobeReady={() => {
                const g = innerRef.current;
                if (g) {
                    g.controls().autoRotate = true;
                    g.controls().autoRotateSpeed = 0.5;
                    g.pointOfView({ altitude: 2.2 }, 0);
                }
                onGlobeReady?.();
            }}
        />
    );
});

export default GlobeView;

/**
 * Sizing and loading shell around Globe3D.
 *
 * three.js needs explicit pixel dimensions, so the stage measures its own box and
 * only mounts the globe once it has one. It also keeps the heavy chunk behind a
 * lazy import and an error boundary, so a WebGL failure degrades to a quiet
 * placeholder instead of taking the page down.
 */
import { Suspense, lazy, useEffect, useRef, useState, forwardRef } from 'react';
import { GlobeErrorBoundary } from '@/components/GlobeErrorBoundary';
import type { Globe3DHandle, Globe3DProps } from './Globe3D';

const Globe3D = lazy(() => import('./Globe3D'));

type GlobeStageProps = Omit<Globe3DProps, 'width' | 'height'> & {
    className?: string;
    /** Rendered while measuring, loading, or after a WebGL failure. */
    fallback?: React.ReactNode;
};

function DefaultFallback() {
    return (
        <div className="flex h-full w-full items-center justify-center">
            <div className="h-24 w-24 animate-pulse rounded-full border border-primary/20 bg-primary/5" />
        </div>
    );
}

const GlobeStage = forwardRef<Globe3DHandle, GlobeStageProps>(function GlobeStage(
    { className, fallback, ...globeProps },
    ref
) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const observer = new ResizeObserver((entries) => {
            const box = entries[0]?.contentRect;
            if (!box) return;
            // Round to whole pixels; fractional sizes make three.js resize every
            // frame. Non-finite values must never reach the renderer: it treats
            // those as "unset" and falls back to a window-sized canvas.
            const width = Math.round(box.width);
            const height = Math.round(box.height);
            if (!Number.isFinite(width) || !Number.isFinite(height)) return;
            setSize((prev) =>
                prev.width === width && prev.height === height ? prev : { width, height }
            );
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const ready = size.width > 0 && size.height > 0;
    const placeholder = fallback ?? <DefaultFallback />;

    return (
        // grid + place-items-center keeps the globe centred in this box whatever
        // size the renderer ends up choosing for its canvas.
        <div ref={containerRef} className={`grid place-items-center ${className ?? ''}`}>
            {ready ? (
                <GlobeErrorBoundary fallback={placeholder}>
                    <Suspense fallback={placeholder}>
                        <Globe3D ref={ref} width={size.width} height={size.height} {...globeProps} />
                    </Suspense>
                </GlobeErrorBoundary>
            ) : (
                placeholder
            )}
        </div>
    );
});

export default GlobeStage;

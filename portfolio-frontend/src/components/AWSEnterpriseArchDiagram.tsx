/**
 * AWSEnterpriseArchDiagram — production-grade architecture renderer.
 *
 * What this gives you over AWSRefArchDiagram:
 *   - AWS service-tile style nodes (large, white, category-colored stripe,
 *     icon + label + sublabel + optional tag chip).
 *   - Phase modes: provision | request | teardown — toggle to filter edges
 *     and sequence the animation.
 *   - Step-by-step playback with autoplay; the current edge pulses brighter
 *     and an animated dot travels along it.
 *   - Animated dataflow particles on every visible edge for that ambient
 *     "AWS reference architecture" feel.
 *   - Nested region rendering (AWS Cloud > VPC/account > AZ-style) with
 *     subtle gradient backgrounds and a category badge.
 *   - Hover sidecar showing a node's full description.
 *
 * Data model is a superset of the original RefArchDiagramData. Old diagrams
 * can opt in by adding `phase`/`step` to edges and `category`/`description`
 * to nodes.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Cloud, Activity, Play, Pause, SkipForward, SkipBack,
    Maximize2, Eye, Info,
} from 'lucide-react';

// ───── Types ────────────────────────────────────────────────────────────────

export type ArchPhase = 'provision' | 'request' | 'teardown';

export interface EAA_Region {
    id: string;
    label: string;
    sublabel?: string;
    /** Optional category badge text rendered in the region pill (e.g. "AWS Account", "VPC"). */
    badge?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    /** If set, the region renders with a subtle dashed border and background tint. */
    dashed?: boolean;
}

export interface EAA_Node {
    id: string;
    label: string;
    sublabel?: string;
    /** Short pill text rendered at the bottom of the tile (e.g. "ARM64", "per-PR"). */
    chip?: string;
    /** Long-form description shown in the hover sidecar. */
    description?: string;
    icon: React.ReactNode;
    /** Center x in the SVG viewBox. */
    x: number;
    /** Center y in the SVG viewBox. */
    y: number;
    /** Brand/accent color (drives stripe + icon tint). */
    accentColor: string;
    /** AWS-style category color for the top stripe; defaults to accentColor. */
    categoryColor?: string;
    /** Optional category label (e.g. "Compute", "Networking"). */
    category?: string;
}

export interface EAA_Edge {
    from: string;
    to: string;
    label?: string;
    dashed?: boolean;
    fromSide?: 'top' | 'right' | 'bottom' | 'left';
    toSide?: 'top' | 'right' | 'bottom' | 'left';
    /** Which phase this edge belongs to (controls visibility per mode). */
    phase?: ArchPhase;
    /** Sequence index within the phase (for step-through playback). */
    step?: number;
    /** Override edge color. */
    color?: string;
}

export interface EAA_DiagramData {
    title: string;
    subtitle?: string;
    /** [width, height] of the SVG viewBox. */
    viewBox: [number, number];
    regions: EAA_Region[];
    nodes: EAA_Node[];
    edges: EAA_Edge[];
}

// ───── Geometry ─────────────────────────────────────────────────────────────

const NW = 180; // node width
const NH = 110; // node height

const PHASE_COLOR: Record<ArchPhase, string> = {
    provision: '#7B42BC',
    request:   '#0EA5E9',
    teardown:  '#EF4444',
};

const PHASE_LABEL: Record<ArchPhase, string> = {
    provision: 'Provisioning',
    request:   'Request flow',
    teardown:  'Teardown',
};

type Side = 'top' | 'right' | 'bottom' | 'left';

function getSidePoint(node: EAA_Node, side: Side) {
    switch (side) {
        case 'right':  return { x: node.x + NW / 2, y: node.y };
        case 'left':   return { x: node.x - NW / 2, y: node.y };
        case 'bottom': return { x: node.x, y: node.y + NH / 2 };
        case 'top':    return { x: node.x, y: node.y - NH / 2 };
    }
}

function autoSide(from: EAA_Node, to: EAA_Node): { fromSide: Side; toSide: Side } {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);
    let fromSide: Side;
    if (angle > -Math.PI / 4 && angle <= Math.PI / 4) fromSide = 'right';
    else if (angle > Math.PI / 4 && angle <= (3 * Math.PI) / 4) fromSide = 'bottom';
    else if (angle > (-3 * Math.PI) / 4 && angle <= -Math.PI / 4) fromSide = 'top';
    else fromSide = 'left';
    const opposites: Record<Side, Side> = { right: 'left', left: 'right', bottom: 'top', top: 'bottom' };
    return { fromSide, toSide: opposites[fromSide] };
}

/**
 * Compute a smooth right-angle-ish path between two ports. We use a Bezier
 * with control points pulled out from each port in the perpendicular direction
 * — produces clean S-curves for diagonals and straight lines for cardinals.
 */
function edgePath(from: EAA_Node, to: EAA_Node, edge: EAA_Edge) {
    let { fromSide, toSide } = edge;
    if (!fromSide || !toSide) {
        const a = autoSide(from, to);
        fromSide ??= a.fromSide;
        toSide   ??= a.toSide;
    }
    const fp = getSidePoint(from, fromSide);
    const tp = getSidePoint(to, toSide);
    const dist = Math.hypot(tp.x - fp.x, tp.y - fp.y);
    const ctrl = Math.max(60, Math.min(180, dist * 0.4));

    const c1x = fp.x + (fromSide === 'right' ? ctrl : fromSide === 'left' ? -ctrl : 0);
    const c1y = fp.y + (fromSide === 'bottom' ? ctrl : fromSide === 'top' ? -ctrl : 0);
    const c2x = tp.x + (toSide === 'right' ? ctrl : toSide === 'left' ? -ctrl : 0);
    const c2y = tp.y + (toSide === 'bottom' ? ctrl : toSide === 'top' ? -ctrl : 0);

    const midX = 0.125 * fp.x + 0.375 * c1x + 0.375 * c2x + 0.125 * tp.x;
    const midY = 0.125 * fp.y + 0.375 * c1y + 0.375 * c2y + 0.125 * tp.y;

    return {
        d: `M${fp.x},${fp.y} C${c1x},${c1y} ${c2x},${c2y} ${tp.x},${tp.y}`,
        midX,
        midY,
    };
}

// ───── Service tile ─────────────────────────────────────────────────────────

function ServiceTile({
    node, highlighted, focused, onMouseEnter, onMouseLeave, onClick,
}: {
    node: EAA_Node;
    highlighted: boolean;
    focused: boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onClick: () => void;
}) {
    const stripeColor = node.categoryColor || node.accentColor;
    const tileX = node.x - NW / 2;
    const tileY = node.y - NH / 2;

    return (
        <motion.g
            transform={`translate(${tileX}, ${tileY})`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: highlighted ? 1 : 0.22, y: 0 }}
            transition={{ duration: 0.25 }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            style={{ cursor: 'pointer' }}
        >
            {/* Drop shadow card */}
            <rect
                x={0} y={0} width={NW} height={NH} rx={12}
                fill="#ffffff"
                stroke={focused ? node.accentColor : '#e2e8f0'}
                strokeWidth={focused ? 2.5 : 1.2}
                filter="url(#eaa-shadow)"
                className="dark:fill-zinc-800 dark:stroke-zinc-600"
            />
            {/* Top color stripe */}
            <path
                d={`M0,12 Q0,0 12,0 L${NW - 12},0 Q${NW},0 ${NW},12 L${NW},22 L0,22 Z`}
                fill={stripeColor}
            />
            {/* Category label inside stripe */}
            {node.category && (
                <text
                    x={NW / 2} y={15}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="800"
                    letterSpacing="0.08em"
                    fill="#ffffff"
                    style={{ pointerEvents: 'none' }}
                >
                    {node.category.toUpperCase()}
                </text>
            )}
            {/* Icon container */}
            <rect
                x={(NW - 44) / 2} y={32}
                width={44} height={44} rx={10}
                fill={`${node.accentColor}1a`}
                stroke={`${node.accentColor}33`}
                strokeWidth={1}
            />
            <foreignObject x={(NW - 28) / 2} y={40} width={28} height={28}>
                <div
                    className="flex items-center justify-center w-full h-full"
                    style={{ color: node.accentColor }}
                >
                    {node.icon}
                </div>
            </foreignObject>
            {/* Label */}
            <text
                x={NW / 2} y={92}
                textAnchor="middle"
                fontSize="13"
                fontWeight="700"
                fill="#1e293b"
                style={{ pointerEvents: 'none' }}
                className="dark:fill-zinc-100"
            >
                {node.label}
            </text>
            {/* Sublabel */}
            {node.sublabel && (
                <text
                    x={NW / 2} y={104}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="500"
                    fill="#64748b"
                    style={{ pointerEvents: 'none' }}
                    className="dark:fill-zinc-400"
                >
                    {node.sublabel}
                </text>
            )}
            {/* Chip */}
            {node.chip && (
                <g transform={`translate(${NW - 10}, 30)`} style={{ pointerEvents: 'none' }}>
                    <rect
                        x={-(node.chip.length * 5 + 12)} y={-10}
                        width={node.chip.length * 5 + 12} height={16}
                        rx={8}
                        fill={node.accentColor}
                        opacity={0.9}
                    />
                    <text
                        x={-(node.chip.length * 5 + 6)} y={1}
                        fontSize="8.5"
                        fontWeight="700"
                        fill="#ffffff"
                    >
                        {node.chip}
                    </text>
                </g>
            )}

            {/* Glow ring when focused */}
            {focused && (
                <rect
                    x={-4} y={-4}
                    width={NW + 8} height={NH + 8}
                    rx={16}
                    fill="none"
                    stroke={node.accentColor}
                    strokeWidth={1.5}
                    opacity={0.45}
                >
                    <animate
                        attributeName="opacity"
                        values="0.45;0.12;0.45"
                        dur="2.4s"
                        repeatCount="indefinite"
                    />
                </rect>
            )}
        </motion.g>
    );
}

// ───── Edge ─────────────────────────────────────────────────────────────────

function EdgeRender({
    from, to, edge, active, dimmed, isCurrentStep, idSuffix,
}: {
    from: EAA_Node;
    to: EAA_Node;
    edge: EAA_Edge;
    active: boolean;
    dimmed: boolean;
    isCurrentStep: boolean;
    idSuffix: string;
}) {
    const { d, midX, midY } = useMemo(() => edgePath(from, to, edge), [from, to, edge]);
    const baseColor = edge.color || (edge.phase ? PHASE_COLOR[edge.phase] : '#94a3b8');
    const labelW = edge.label ? Math.max(edge.label.length * 6.5 + 18, 50) : 0;

    const visualActive = active || isCurrentStep;
    const stroke = visualActive ? baseColor : '#cbd5e1';
    const strokeWidth = isCurrentStep ? 3.4 : visualActive ? 2.2 : 1.4;

    const pathId = `eaa-path-${idSuffix}`;

    return (
        <g style={{ opacity: dimmed ? 0.18 : 1, transition: 'opacity 240ms ease' }}>
            {/* Glow halo for current step */}
            {isCurrentStep && (
                <path
                    d={d}
                    fill="none"
                    stroke={baseColor}
                    strokeWidth={9}
                    strokeOpacity={0.25}
                    strokeLinecap="round"
                />
            )}
            {/* Background lane */}
            <path
                d={d}
                fill="none"
                stroke="#eef2f7"
                strokeWidth={6}
                className="dark:stroke-zinc-700/60"
            />
            {/* Main stroke */}
            <path
                id={pathId}
                d={d}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={edge.dashed ? '7 4' : '0'}
                markerEnd={`url(#eaa-arrow-${visualActive ? 'on' : 'off'}-${idSuffix})`}
                style={{ transition: 'stroke 200ms, stroke-width 200ms' }}
            />

            {/* Animated dataflow particle on visible edges */}
            {!dimmed && (
                <circle r={isCurrentStep ? 4.5 : 3} fill={baseColor} opacity={visualActive ? 0.95 : 0.55}>
                    <animateMotion
                        dur={isCurrentStep ? '1.6s' : '3.2s'}
                        repeatCount="indefinite"
                        rotate="auto"
                    >
                        <mpath xlinkHref={`#${pathId}`} />
                    </animateMotion>
                    <animate
                        attributeName="opacity"
                        values="0;1;1;0"
                        dur={isCurrentStep ? '1.6s' : '3.2s'}
                        repeatCount="indefinite"
                    />
                </circle>
            )}

            {/* Label pill */}
            {edge.label && (
                <g style={{ pointerEvents: 'none' }}>
                    <rect
                        x={midX - labelW / 2}
                        y={midY - 11}
                        width={labelW}
                        height={22}
                        rx={11}
                        fill="#ffffff"
                        stroke={visualActive ? baseColor : '#e2e8f0'}
                        strokeWidth={1}
                        className="dark:fill-zinc-800 dark:stroke-zinc-600"
                    />
                    <text
                        x={midX}
                        y={midY + 4}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="700"
                        fill={visualActive ? baseColor : '#475569'}
                        className="dark:fill-zinc-300"
                        style={{ transition: 'fill 200ms' }}
                    >
                        {edge.label}
                    </text>
                </g>
            )}
        </g>
    );
}

// ───── Region rendering ─────────────────────────────────────────────────────

function RegionRender({ region }: { region: EAA_Region }) {
    return (
        <g key={region.id} style={{ pointerEvents: 'none' }}>
            {/* Subtle gradient fill */}
            <rect
                x={region.x}
                y={region.y}
                width={region.width}
                height={region.height}
                rx={14}
                fill={`url(#region-fill-${region.id})`}
                stroke={region.color}
                strokeWidth={1.5}
                strokeDasharray={region.dashed ? '8 5' : '0'}
                className="dark:opacity-90"
            />
            {/* Label badge */}
            <g transform={`translate(${region.x + 14}, ${region.y - 1})`}>
                <rect
                    x={0} y={-12}
                    width={region.label.length * 7 + (region.badge ? region.badge.length * 5 + 24 : 18)}
                    height={22}
                    rx={11}
                    fill={region.color}
                />
                <text
                    x={10} y={3}
                    fontSize="11"
                    fontWeight="800"
                    letterSpacing="0.02em"
                    fill="#ffffff"
                >
                    {region.label}
                </text>
                {region.badge && (
                    <>
                        <rect
                            x={region.label.length * 7 + 10}
                            y={-7}
                            width={region.badge.length * 5 + 10}
                            height={12}
                            rx={6}
                            fill="#ffffff"
                            opacity={0.92}
                        />
                        <text
                            x={region.label.length * 7 + 15}
                            y={2}
                            fontSize="8"
                            fontWeight="800"
                            fill={region.color}
                        >
                            {region.badge}
                        </text>
                    </>
                )}
            </g>
        </g>
    );
}

// ───── Component ────────────────────────────────────────────────────────────

export default function AWSEnterpriseArchDiagram({
    data,
    initialPhase = 'request',
    showPhaseToggle = true,
    showStepper = true,
    autoPlayDefault = true,
}: {
    data: EAA_DiagramData;
    initialPhase?: ArchPhase | 'all';
    showPhaseToggle?: boolean;
    showStepper?: boolean;
    autoPlayDefault?: boolean;
}) {
    const [phase, setPhase] = useState<ArchPhase | 'all'>(initialPhase);
    const [hoverNode, setHoverNode] = useState<string | null>(null);
    const [focusNode, setFocusNode] = useState<string | null>(null);
    const [stepIdx, setStepIdx] = useState<number>(0);
    const [playing, setPlaying] = useState<boolean>(autoPlayDefault);
    const [vw, vh] = data.viewBox;
    const idSuffix = useMemo(() => Math.random().toString(36).slice(2, 8), []);

    const nodeMap = useMemo(() => new Map(data.nodes.map(n => [n.id, n])), [data.nodes]);

    // Edges visible for the current phase, sorted by step.
    const phaseEdges = useMemo(() => {
        const filtered = phase === 'all'
            ? data.edges
            : data.edges.filter(e => e.phase === phase);
        return [...filtered].sort((a, b) => (a.step ?? 1e6) - (b.step ?? 1e6));
    }, [data.edges, phase]);

    const stepEdges = useMemo(
        () => phaseEdges.filter(e => e.step !== undefined),
        [phaseEdges]
    );

    // Reset stepper on phase change.
    useEffect(() => { setStepIdx(0); }, [phase]);

    // Autoplay
    useEffect(() => {
        if (!playing || stepEdges.length === 0) return;
        const id = setInterval(() => {
            setStepIdx(i => (i + 1) % stepEdges.length);
        }, 1900);
        return () => clearInterval(id);
    }, [playing, stepEdges.length]);

    const currentEdgeKey = stepEdges[stepIdx]
        ? `${stepEdges[stepIdx].from}->${stepEdges[stepIdx].to}`
        : null;

    // Highlighting
    const connectivity = useMemo(() => {
        const map = new Map<string, Set<string>>();
        data.edges.forEach(e => {
            if (!map.has(e.from)) map.set(e.from, new Set());
            if (!map.has(e.to)) map.set(e.to, new Set());
            map.get(e.from)!.add(e.to);
            map.get(e.to)!.add(e.from);
        });
        return map;
    }, [data.edges]);

    const focused = focusNode ?? hoverNode;
    const isNodeHighlighted = (id: string) => {
        if (!focused) return true;
        return id === focused || (connectivity.get(focused)?.has(id) ?? false);
    };
    const isEdgeActive = (e: EAA_Edge) => focused !== null && (e.from === focused || e.to === focused);

    const stepEdge = stepEdges[stepIdx];
    const stepFromNode = stepEdge ? nodeMap.get(stepEdge.from) : null;
    const stepToNode = stepEdge ? nodeMap.get(stepEdge.to) : null;

    const wrapRef = useRef<HTMLDivElement>(null);

    const handleFullscreen = useCallback(() => {
        const el = wrapRef.current;
        if (!el) return;
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            el.requestFullscreen();
        }
    }, []);

    const phases: Array<ArchPhase | 'all'> = ['provision', 'request', 'teardown', 'all'];

    const hoverNodeData = (focused && nodeMap.get(focused)) || null;

    return (
        <Card className="p-0 border-0 shadow-2xl overflow-hidden bg-white dark:bg-zinc-900" ref={wrapRef as any}>
            {/* ─── Header ───────────────────────────────────────────────── */}
            <div className="px-5 md:px-6 py-3.5 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-orange-500/10 via-zinc-50 to-emerald-500/10 dark:from-orange-500/10 dark:via-zinc-800/50 dark:to-emerald-500/10 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-[#FF9900] shadow-md shrink-0">
                        <Cloud className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base md:text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {data.title}
                        </h3>
                        {data.subtitle && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">{data.subtitle}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {showPhaseToggle && (
                        <div className="flex items-center gap-1 p-1 rounded-full bg-zinc-200/70 dark:bg-zinc-800/70 backdrop-blur-sm">
                            {phases.map(p => {
                                const active = p === phase;
                                const color = p === 'all' ? '#0f172a' : PHASE_COLOR[p];
                                return (
                                    <button
                                        key={p}
                                        onClick={() => setPhase(p)}
                                        className={`relative text-[11px] font-bold px-3 py-1 rounded-full transition ${active ? 'text-white' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
                                        style={active ? { background: color } : undefined}
                                    >
                                        {p === 'all' ? 'All' : PHASE_LABEL[p]}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <button
                        onClick={handleFullscreen}
                        className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition"
                        title="Fullscreen"
                    >
                        <Maximize2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* ─── Diagram + sidecar ────────────────────────────────────── */}
            <div className="relative">
                <div className="w-full overflow-x-auto bg-[radial-gradient(ellipse_at_center,_#FAFBFC_0%,_#F1F5F9_100%)] dark:bg-[radial-gradient(ellipse_at_center,_#0f172a_0%,_#020617_100%)] px-3 py-4 md:px-6 md:py-6">
                    <svg
                        viewBox={`0 0 ${vw} ${vh}`}
                        className="w-full min-w-[900px] md:min-w-[1100px]"
                        preserveAspectRatio="xMidYMid meet"
                        onClick={() => setFocusNode(null)}
                    >
                        <defs>
                            <filter id="eaa-shadow" x="-15%" y="-15%" width="130%" height="140%">
                                <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.10" />
                            </filter>
                            <marker id={`eaa-arrow-on-${idSuffix}`} markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                                <polygon points="0 0, 10 4, 0 8" fill="#0EA5E9" />
                            </marker>
                            <marker id={`eaa-arrow-off-${idSuffix}`} markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
                                <polygon points="0 0, 9 3.5, 0 7" fill="#94a3b8" />
                            </marker>
                            {data.regions.map(r => (
                                <linearGradient key={r.id} id={`region-fill-${r.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={`${r.color}1c`} />
                                    <stop offset="100%" stopColor={`${r.color}06`} />
                                </linearGradient>
                            ))}
                            <pattern id="eaa-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M40 0 L0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" className="dark:stroke-zinc-800/60" />
                            </pattern>
                        </defs>

                        {/* Grid background */}
                        <rect x={0} y={0} width={vw} height={vh} fill="url(#eaa-grid)" />

                        {/* Regions (largest first) */}
                        {[...data.regions]
                            .sort((a, b) => b.width * b.height - a.width * a.height)
                            .map(r => <RegionRender key={r.id} region={r} />)}

                        {/* Edges */}
                        {phaseEdges.map((edge, i) => {
                            const f = nodeMap.get(edge.from);
                            const t = nodeMap.get(edge.to);
                            if (!f || !t) return null;
                            const key = `${edge.from}->${edge.to}`;
                            const isCurrent = currentEdgeKey === key;
                            return (
                                <EdgeRender
                                    key={`${key}-${i}`}
                                    from={f}
                                    to={t}
                                    edge={edge}
                                    active={isEdgeActive(edge)}
                                    dimmed={focused !== null && !isEdgeActive(edge)}
                                    isCurrentStep={isCurrent}
                                    idSuffix={`${idSuffix}-${i}`}
                                />
                            );
                        })}

                        {/* Nodes */}
                        {data.nodes.map(node => (
                            <ServiceTile
                                key={node.id}
                                node={node}
                                highlighted={isNodeHighlighted(node.id)}
                                focused={focused === node.id}
                                onMouseEnter={() => setHoverNode(node.id)}
                                onMouseLeave={() => setHoverNode(null)}
                                onClick={() => setFocusNode(prev => prev === node.id ? null : node.id)}
                            />
                        ))}
                    </svg>
                </div>

                {/* Node detail sidecar */}
                <AnimatePresence>
                    {hoverNodeData && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.18 }}
                            className="hidden md:block absolute right-4 top-4 max-w-[260px] pointer-events-none"
                        >
                            <div
                                className="rounded-xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur shadow-xl border p-3"
                                style={{ borderColor: `${hoverNodeData.accentColor}55` }}
                            >
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div
                                        className="w-7 h-7 rounded-md flex items-center justify-center"
                                        style={{ background: `${hoverNodeData.accentColor}1a`, color: hoverNodeData.accentColor }}
                                    >
                                        {hoverNodeData.icon}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-tight">{hoverNodeData.label}</p>
                                        {hoverNodeData.category && (
                                            <p className="text-[9px] uppercase tracking-wider font-bold" style={{ color: hoverNodeData.accentColor }}>
                                                {hoverNodeData.category}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {hoverNodeData.description && (
                                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                                        {hoverNodeData.description}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ─── Stepper ──────────────────────────────────────────────── */}
            {showStepper && stepEdges.length > 0 && (
                <div className="px-5 md:px-6 py-3 border-t border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-zinc-50 to-zinc-100/50 dark:from-zinc-900 dark:to-zinc-900/50">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setStepIdx(i => (i - 1 + stepEdges.length) % stepEdges.length)}
                                className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
                                title="Previous step"
                            >
                                <SkipBack className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                            </button>
                            <button
                                onClick={() => setPlaying(p => !p)}
                                className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
                                title={playing ? 'Pause' : 'Play'}
                            >
                                {playing
                                    ? <Pause className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                                    : <Play className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />}
                            </button>
                            <button
                                onClick={() => setStepIdx(i => (i + 1) % stepEdges.length)}
                                className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
                                title="Next step"
                            >
                                <SkipForward className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                            </button>
                        </div>

                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-bold tabular-nums">
                            Step {String(stepIdx + 1).padStart(2, '0')} / {String(stepEdges.length).padStart(2, '0')}
                        </Badge>

                        {stepEdge && stepFromNode && stepToNode && (
                            <div className="flex items-center gap-2 text-xs flex-wrap min-w-0">
                                <span className="font-bold text-zinc-700 dark:text-zinc-200 truncate">
                                    {stepFromNode.label}
                                </span>
                                <svg width={20} height={10} viewBox="0 0 20 10" className="shrink-0">
                                    <path
                                        d="M2 5 L18 5"
                                        stroke={stepEdge.phase ? PHASE_COLOR[stepEdge.phase] : '#0EA5E9'}
                                        strokeWidth="1.6"
                                        markerEnd={`url(#eaa-arrow-on-${idSuffix})`}
                                    />
                                </svg>
                                <span className="font-bold text-zinc-700 dark:text-zinc-200 truncate">
                                    {stepToNode.label}
                                </span>
                                {stepEdge.label && (
                                    <Badge
                                        className="text-[10px] font-bold border-0"
                                        style={{
                                            background: `${stepEdge.phase ? PHASE_COLOR[stepEdge.phase] : '#0EA5E9'}1a`,
                                            color: stepEdge.phase ? PHASE_COLOR[stepEdge.phase] : '#0EA5E9',
                                        }}
                                    >
                                        {stepEdge.label}
                                    </Badge>
                                )}
                            </div>
                        )}

                        <div className="ml-auto hidden lg:flex items-center gap-3 text-[10px] text-zinc-500 dark:text-zinc-400">
                            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Hover to focus</span>
                            <span className="flex items-center gap-1"><Info className="h-3 w-3" /> Click to lock</span>
                            <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> {phaseEdges.length} edges</span>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
}

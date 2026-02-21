import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cloud, Activity } from 'lucide-react';

// ===== Types =====

export interface RefArchRegion {
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
}

export interface RefArchNode {
    id: string;
    label: string;
    sublabel?: string;
    icon: React.ReactNode;
    x: number; // center x
    y: number; // center y
    accentColor: string;
}

export interface RefArchEdge {
    from: string;
    to: string;
    label?: string;
    dashed?: boolean;
    fromSide?: 'top' | 'right' | 'bottom' | 'left';
    toSide?: 'top' | 'right' | 'bottom' | 'left';
}

export interface RefArchDiagramData {
    title: string;
    viewBox: [number, number];
    regions: RefArchRegion[];
    nodes: RefArchNode[];
    edges: RefArchEdge[];
}

// ===== Constants =====

const NW = 130; // node width
const NH = 52;  // node height

// ===== Edge Routing =====

type Side = 'top' | 'right' | 'bottom' | 'left';

function getSidePoint(node: RefArchNode, side: Side) {
    switch (side) {
        case 'right':  return { x: node.x + NW / 2, y: node.y };
        case 'left':   return { x: node.x - NW / 2, y: node.y };
        case 'bottom': return { x: node.x, y: node.y + NH / 2 };
        case 'top':    return { x: node.x, y: node.y - NH / 2 };
    }
}

function autoDetectSide(from: RefArchNode, to: RefArchNode): { fromSide: Side; toSide: Side } {
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

function computeEdgePath(
    from: RefArchNode,
    to: RefArchNode,
    edge: RefArchEdge
): { path: string; midX: number; midY: number } {
    let fromSide = edge.fromSide;
    let toSide = edge.toSide;

    if (!fromSide || !toSide) {
        const auto = autoDetectSide(from, to);
        if (!fromSide) fromSide = auto.fromSide;
        if (!toSide) toSide = auto.toSide;
    }

    const fp = getSidePoint(from, fromSide);
    const tp = getSidePoint(to, toSide);

    const dist = Math.sqrt((tp.x - fp.x) ** 2 + (tp.y - fp.y) ** 2);
    const ctrl = Math.max(dist * 0.3, 40);

    const c1x = fp.x + (fromSide === 'right' ? ctrl : fromSide === 'left' ? -ctrl : 0);
    const c1y = fp.y + (fromSide === 'bottom' ? ctrl : fromSide === 'top' ? -ctrl : 0);
    const c2x = tp.x + (toSide === 'right' ? ctrl : toSide === 'left' ? -ctrl : 0);
    const c2y = tp.y + (toSide === 'bottom' ? ctrl : toSide === 'top' ? -ctrl : 0);

    // Bezier midpoint at t=0.5
    const midX = 0.125 * fp.x + 0.375 * c1x + 0.375 * c2x + 0.125 * tp.x;
    const midY = 0.125 * fp.y + 0.375 * c1y + 0.375 * c2y + 0.125 * tp.y;

    return {
        path: `M${fp.x},${fp.y} C${c1x},${c1y} ${c2x},${c2y} ${tp.x},${tp.y}`,
        midX,
        midY,
    };
}

// ===== Component =====

export default function AWSRefArchDiagram({ data }: { data: RefArchDiagramData }) {
    const [activeNode, setActiveNode] = useState<string | null>(null);
    const [vw, vh] = data.viewBox;

    const nodeMap = new Map(data.nodes.map(n => [n.id, n]));

    // Build adjacency
    const connectedTo = new Map<string, Set<string>>();
    data.edges.forEach(e => {
        if (!connectedTo.has(e.from)) connectedTo.set(e.from, new Set());
        if (!connectedTo.has(e.to)) connectedTo.set(e.to, new Set());
        connectedTo.get(e.from)!.add(e.to);
        connectedTo.get(e.to)!.add(e.from);
    });

    const isNodeHighlighted = (nodeId: string) => {
        if (!activeNode) return true;
        return nodeId === activeNode || (connectedTo.get(activeNode)?.has(nodeId) ?? false);
    };

    const isEdgeActive = (edge: RefArchEdge) => {
        if (!activeNode) return false;
        return edge.from === activeNode || edge.to === activeNode;
    };

    const handleNodeClick = useCallback((nodeId: string) => {
        setActiveNode(prev => (prev === nodeId ? null : nodeId));
    }, []);

    const handleBgClick = useCallback(() => setActiveNode(null), []);

    return (
        <Card className="p-0 border shadow-xl overflow-hidden bg-white dark:bg-zinc-900">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2.5 rounded-lg bg-[#FF9900] shadow-sm shrink-0">
                        <Cloud className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base md:text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {data.title}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 hidden sm:block">
                            AWS Reference Architecture
                        </p>
                    </div>
                </div>
                <Badge className="text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 shrink-0">
                    Production
                </Badge>
            </div>

            {/* Diagram */}
            <div className="relative w-full overflow-x-auto bg-[#FAFBFC] dark:bg-zinc-900/50 px-4 py-6 md:px-8 md:py-8">
                <svg
                    viewBox={`0 0 ${vw} ${vh}`}
                    className="w-full min-w-[600px] md:min-w-[800px]"
                    preserveAspectRatio="xMidYMid meet"
                    onClick={handleBgClick}
                >
                    <defs>
                        <filter id="refNodeShadow" x="-15%" y="-15%" width="130%" height="130%">
                            <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#000" floodOpacity="0.07" />
                        </filter>
                        <marker id="refArrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                            <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                        </marker>
                        <marker id="refArrowActive" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                            <polygon points="0 0, 8 3, 0 6" fill="#3b82f6" />
                        </marker>
                    </defs>

                    {/* Regions — sorted largest first so smaller regions render on top */}
                    {[...data.regions]
                        .sort((a, b) => b.width * b.height - a.width * a.height)
                        .map(region => (
                            <g key={region.id}>
                                <rect
                                    x={region.x}
                                    y={region.y}
                                    width={region.width}
                                    height={region.height}
                                    rx="10"
                                    fill={`${region.color}08`}
                                    stroke={region.color}
                                    strokeWidth="1.5"
                                    strokeDasharray="8 4"
                                    className="dark:opacity-70"
                                />
                                <text
                                    x={region.x + 14}
                                    y={region.y + 20}
                                    fill={region.color}
                                    fontSize="12"
                                    fontWeight="700"
                                    letterSpacing="0.03em"
                                    style={{ pointerEvents: 'none' }}
                                >
                                    {region.label}
                                </text>
                            </g>
                        ))}

                    {/* Edges */}
                    {data.edges.map((edge, idx) => {
                        const fromNode = nodeMap.get(edge.from);
                        const toNode = nodeMap.get(edge.to);
                        if (!fromNode || !toNode) return null;

                        const active = isEdgeActive(edge);
                        const dimmed = activeNode !== null && !active;
                        const { path, midX, midY } = computeEdgePath(fromNode, toNode, edge);
                        const labelW = edge.label ? Math.max(edge.label.length * 6.5 + 16, 48) : 0;

                        return (
                            <g
                                key={`edge-${idx}`}
                                style={{
                                    opacity: dimmed ? 0.15 : 1,
                                    transition: 'opacity 200ms ease',
                                }}
                            >
                                {/* Glow / shadow path */}
                                <path
                                    d={path}
                                    fill="none"
                                    stroke="#e2e8f0"
                                    strokeWidth="5"
                                    className="dark:stroke-zinc-700"
                                />
                                {/* Main path */}
                                <path
                                    d={path}
                                    fill="none"
                                    stroke={active ? '#3b82f6' : '#94a3b8'}
                                    strokeWidth={active ? 2.2 : 1.5}
                                    strokeDasharray={edge.dashed ? '6 3' : '0'}
                                    markerEnd={active ? 'url(#refArrowActive)' : 'url(#refArrow)'}
                                    style={{ transition: 'stroke 200ms, stroke-width 200ms' }}
                                />
                                {/* Label pill */}
                                {edge.label && (
                                    <g>
                                        <rect
                                            x={midX - labelW / 2}
                                            y={midY - 10}
                                            width={labelW}
                                            height={20}
                                            rx="10"
                                            fill="#ffffff"
                                            stroke={active ? '#3b82f6' : '#e2e8f0'}
                                            strokeWidth="0.75"
                                            className="dark:fill-zinc-800 dark:stroke-zinc-600"
                                        />
                                        <text
                                            x={midX}
                                            y={midY + 4}
                                            textAnchor="middle"
                                            fill={active ? '#3b82f6' : '#64748b'}
                                            fontSize="9.5"
                                            fontWeight="600"
                                            style={{ pointerEvents: 'none', transition: 'fill 200ms' }}
                                            className="dark:fill-zinc-300"
                                        >
                                            {edge.label}
                                        </text>
                                    </g>
                                )}
                            </g>
                        );
                    })}

                    {/* Nodes */}
                    {data.nodes.map(node => {
                        const highlighted = isNodeHighlighted(node.id);
                        const isActive = activeNode === node.id;

                        return (
                            <g
                                key={node.id}
                                transform={`translate(${node.x - NW / 2}, ${node.y - NH / 2})`}
                                style={{
                                    opacity: highlighted ? 1 : 0.25,
                                    transition: 'opacity 200ms ease',
                                }}
                                onClick={e => {
                                    e.stopPropagation();
                                    handleNodeClick(node.id);
                                }}
                                onMouseEnter={() => setActiveNode(node.id)}
                                onMouseLeave={() => setActiveNode(null)}
                                className="cursor-pointer"
                            >
                                {/* Card background */}
                                <rect
                                    x="0"
                                    y="0"
                                    width={NW}
                                    height={NH}
                                    rx="6"
                                    fill="#ffffff"
                                    stroke={isActive ? node.accentColor : '#e2e8f0'}
                                    strokeWidth={isActive ? 2 : 1}
                                    filter="url(#refNodeShadow)"
                                    className="dark:fill-zinc-800 dark:stroke-zinc-600"
                                />
                                {/* Colored accent bar */}
                                <rect
                                    x="0"
                                    y="0"
                                    width="3.5"
                                    height={NH}
                                    rx="6 0 0 6"
                                    fill={node.accentColor}
                                />
                                {/* Icon background circle */}
                                <rect
                                    x="10"
                                    y="10"
                                    width="32"
                                    height="32"
                                    rx="8"
                                    fill={`${node.accentColor}15`}
                                />
                                {/* Icon */}
                                <foreignObject x="14" y="14" width="24" height="24">
                                    <div
                                        className="flex items-center justify-center w-full h-full"
                                        style={{ color: node.accentColor }}
                                    >
                                        {node.icon}
                                    </div>
                                </foreignObject>
                                {/* Label text */}
                                <text
                                    x="48"
                                    y={node.sublabel ? '23' : '30'}
                                    fill="#1e293b"
                                    fontSize="11"
                                    fontWeight="700"
                                    style={{ pointerEvents: 'none' }}
                                    className="dark:fill-zinc-200"
                                >
                                    {node.label}
                                </text>
                                {node.sublabel && (
                                    <text
                                        x="48"
                                        y="39"
                                        fill="#64748b"
                                        fontSize="9"
                                        fontWeight="500"
                                        style={{ pointerEvents: 'none' }}
                                        className="dark:fill-zinc-400"
                                    >
                                        {node.sublabel}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2 flex-wrap">
                <Activity className="h-3.5 w-3.5 shrink-0" />
                <span>Hover or tap components to highlight data flow</span>
            </div>
        </Card>
    );
}

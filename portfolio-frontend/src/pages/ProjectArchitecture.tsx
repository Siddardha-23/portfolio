import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PROJECTS } from '@/lib/constants';
import { useState, useEffect } from 'react';
import {
    ArrowLeft, Shield, Zap, DollarSign, Layers, Server, Cloud, Code,
    GitBranch, Rocket, Sparkles, Github, Snowflake,
    Lightbulb, Monitor, Terminal, ArrowRight, Globe, Database,
    HardDrive, Wifi, BarChart3, Box, Users, Lock, Cpu, Network, Activity
} from 'lucide-react';
import {
    SiTerraform, SiDocker,
    SiGithubactions, SiMongodb, SiPython
} from 'react-icons/si';
import { ThemeToggle } from '@/components/theme-toggle';

// ========== AWS ARCHITECTURE DIAGRAM COMPONENT ==========

interface AWSNode {
    id: string;
    label: string;
    icon: React.ReactNode;
    type: 'service' | 'actor' | 'db' | 'security' | 'compute' | 'cdn';
    region?: string;
}

interface AWSConnection {
    from: string;
    to: string;
    label?: string;
    style?: 'solid' | 'dashed';
}

interface AWSArchitectureLayer {
    name: string;
    description?: string;
    nodes: AWSNode[];
    color: string;
    gradient: [string, string];
}

// Professional AWS-style diagram component
const DIAGRAM = {
    width: 1240,
    height: 640,
    margin: { top: 72, right: 48, bottom: 48, left: 48 },
    layerGap: 12,
    nodeWidth: 128,
    nodeHeight: 88,
    connectionCurve: 120,
};

function AWSArchitectureDiagram({ 
    title, 
    layers, 
    connections 
}: {
    title: string;
    layers: AWSArchitectureLayer[];
    connections: AWSConnection[];
}) {
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const { width: svgWidth, height: svgHeight, margin, layerGap, nodeWidth, nodeHeight, connectionCurve } = DIAGRAM;
    const contentWidth = svgWidth - margin.left - margin.right;
    const layerWidth = (contentWidth - (layers.length - 1) * layerGap) / layers.length;
    const startX = margin.left;
    const startY = margin.top;
    const contentHeight = svgHeight - margin.top - margin.bottom;

    const getNodePosition = (layerIdx: number, nodeIdx: number, layerNodeCount: number) => {
        const colCenterX = startX + layerIdx * (layerWidth + layerGap) + layerWidth / 2;
        const spacingY = contentHeight / (layerNodeCount + 1);
        const y = startY + (nodeIdx + 1) * spacingY;
        return { x: colCenterX, y };
    };

    const nodeMap = new Map<string, { x: number; y: number; node: AWSNode }>();
    layers.forEach((layer, layerIdx) => {
        layer.nodes.forEach((node, nodeIdx) => {
            const pos = getNodePosition(layerIdx, nodeIdx, layer.nodes.length);
            nodeMap.set(node.id, { x: pos.x, y: pos.y, node });
        });
    });

    // Cubic Bezier for smooth, professional flow (horizontal tangents at endpoints)
    const generatePath = (_from: AWSNode, fromPos: { x: number; y: number }, toPos: { x: number; y: number }) => {
        const ctrl = Math.min(connectionCurve, (toPos.x - fromPos.x) * 0.4);
        return `M ${fromPos.x} ${fromPos.y} C ${fromPos.x + ctrl} ${fromPos.y}, ${toPos.x - ctrl} ${toPos.y}, ${toPos.x} ${toPos.y}`;
    };

    return (
        <Card className="p-0 border shadow-xl overflow-hidden bg-white dark:bg-zinc-900">
            {/* AWS-style header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2.5 rounded-lg bg-[#FF9900] shadow-sm shrink-0">
                        <Cloud className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base md:text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">{title}</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 hidden sm:block">AWS-style reference architecture</p>
                    </div>
                </div>
                <Badge className="text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 shrink-0">
                    Production
                </Badge>
            </div>

            {/* Diagram - clean white/light background like AWS reference diagrams */}
            <div className="relative w-full overflow-x-auto bg-zinc-50 dark:bg-zinc-900/50 px-4 py-6 md:px-8 md:py-8">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full min-w-[500px] md:min-w-[800px] z-10 relative" preserveAspectRatio="xMidYMid meet">
                    <defs>
                        <filter id="awsNodeShadow" x="-15%" y="-15%" width="130%" height="130%">
                            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.08" />
                        </filter>
                        <marker id="arrowHead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                            <polygon points="0 0, 10 3, 0 6" fill="#475569" />
                        </marker>
                        <marker id="arrowHeadHover" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                            <polygon points="0 0, 10 3, 0 6" fill="#2563eb" />
                        </marker>
                    </defs>

                    {/* Light column backgrounds */}
                    {layers.map((layer, idx) => {
                        const colX = startX + idx * (layerWidth + layerGap);
                        return (
                            <g key={`layer-bg-${idx}`}>
                                <rect
                                    x={colX}
                                    y={startY - 32}
                                    width={layerWidth}
                                    height={contentHeight + 40}
                                    rx="8"
                                    fill="#f8fafc"
                                    stroke="#e2e8f0"
                                    strokeWidth="1"
                                    className="dark:fill-zinc-800/40 dark:stroke-zinc-700"
                                />
                                <text
                                    x={colX + layerWidth / 2}
                                    y={startY - 12}
                                    textAnchor="middle"
                                    fill="#475569"
                                    fontSize="11"
                                    fontWeight="700"
                                    className="dark:fill-zinc-400"
                                >
                                    {layer.name}
                                </text>
                            </g>
                        );
                    })}

                    {/* Connections - always show label */}
                    {connections.map((conn, idx) => {
                        const fromData = nodeMap.get(conn.from);
                        const toData = nodeMap.get(conn.to);
                        if (!fromData || !toData) return null;

                        const isConnected = hoveredNode === conn.from || hoveredNode === conn.to;
                        const path = generatePath(fromData.node, fromData, toData);
                        const label = conn.label || '';

                        return (
                            <g key={`connection-${idx}`} opacity={!hoveredNode || isConnected ? 1 : 0.35}>
                                <path d={path} fill="none" stroke="#cbd5e1" strokeWidth="6" opacity="0.5" />
                                <path
                                    d={path}
                                    fill="none"
                                    stroke={isConnected ? '#2563eb' : '#475569'}
                                    strokeWidth={isConnected ? 2.5 : 1.5}
                                    strokeDasharray={conn.style === 'dashed' ? '6,4' : '0'}
                                    markerEnd={isConnected ? 'url(#arrowHeadHover)' : 'url(#arrowHead)'}
                                    strokeLinecap="round"
                                />
                                {label && (
                                    <g>
                                        <rect
                                            x={(fromData.x + toData.x) / 2 - 42}
                                            y={(fromData.y + toData.y) / 2 - 12}
                                            width="84"
                                            height="24"
                                            rx="4"
                                            fill="#ffffff"
                                            stroke="#e2e8f0"
                                            strokeWidth="1"
                                            filter="url(#awsNodeShadow)"
                                            className="dark:fill-zinc-800 dark:stroke-zinc-600"
                                        />
                                        <text
                                            x={(fromData.x + toData.x) / 2}
                                            y={(fromData.y + toData.y) / 2 + 4}
                                            textAnchor="middle"
                                            fill="#334155"
                                            fontSize="10"
                                            fontWeight="600"
                                            className="dark:fill-zinc-300"
                                        >
                                            {label}
                                        </text>
                                    </g>
                                )}
                            </g>
                        );
                    })}

                    {/* Nodes - AWS-style: white card with colored left bar and icon */}
                    {layers.map((layer, layerIdx) =>
                        layer.nodes.map((node) => {
                            const pos = nodeMap.get(node.id);
                            if (!pos) return null;

                            const isHovered = hoveredNode === node.id;
                            const nodeW = nodeWidth;
                            const nodeH = nodeHeight;

                            return (
                                <g
                                    key={node.id}
                                    transform={`translate(${pos.x - nodeW / 2}, ${pos.y - nodeH / 2})`}
                                    onMouseEnter={() => setHoveredNode(node.id)}
                                    onMouseLeave={() => setHoveredNode(null)}
                                    className="cursor-pointer"
                                >
                                    <rect
                                        x="0" y="0" width={nodeW} height={nodeH} rx="6"
                                        fill="#ffffff"
                                        stroke={isHovered ? layer.color : '#e2e8f0'}
                                        strokeWidth={isHovered ? 2 : 1}
                                        filter="url(#awsNodeShadow)"
                                        className="dark:fill-zinc-800 dark:stroke-zinc-600"
                                    />
                                    <rect x="0" y="0" width="4" height={nodeH} rx="6 0 0 6" fill={layer.color} />
                                    <rect x="10" y="10" width="36" height="36" rx="6" fill={`${layer.color}18`} />
                                    <foreignObject x="14" y="14" width="28" height="28">
                                        <div className="flex items-center justify-center w-full h-full" style={{ color: layer.color }}>
                                            {node.icon}
                                        </div>
                                    </foreignObject>
                                    <text
                                        x={54} y="32"
                                        fill="#1e293b"
                                        fontSize="12"
                                        fontWeight="700"
                                        style={{ pointerEvents: 'none' }}
                                        className="dark:fill-zinc-200"
                                    >
                                        {node.label.split(' ')[0]}
                                    </text>
                                    {node.label.includes(' ') && (
                                        <text
                                            x={54} y="52"
                                            fill="#64748b"
                                            fontSize="10"
                                            fontWeight="500"
                                            style={{ pointerEvents: 'none' }}
                                            className="dark:fill-zinc-400"
                                        >
                                            {node.label.split(' ').slice(1).join(' ')}
                                        </text>
                                    )}
                                </g>
                            );
                        })
                    )}
                </svg>
            </div>

            <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2 flex-wrap">
                <Activity className="h-3.5 w-3.5 shrink-0" />
                <span>Hover components to highlight data flow</span>
            </div>
        </Card>
    );
}

// ========== ARCHITECTURE DATA ==========

const portfolioArchitecture = {
    layers: [
        {
            name: 'Users',
            color: '#3B82F6',
            gradient: ['#3B82F6', '#1E40AF'] as [string, string],
            nodes: [
                { id: 'user', label: 'End Users', icon: <Users className="h-5 w-5" />, type: 'actor' as const },
            ]
        },
        {
            name: 'DNS & CDN',
            color: '#F59E0B',
            gradient: ['#F59E0B', '#D97706'] as [string, string],
            nodes: [
                { id: 'route53', label: 'Route 53', icon: <Globe className="h-5 w-5" />, type: 'service' as const },
                { id: 'cloudfront', label: 'CloudFront', icon: <Wifi className="h-5 w-5" />, type: 'service' as const },
            ]
        },
        {
            name: 'Static & API',
            color: '#10B981',
            gradient: ['#10B981', '#059669'] as [string, string],
            nodes: [
                { id: 's3', label: 'S3 Static', icon: <HardDrive className="h-5 w-5" />, type: 'service' as const },
                { id: 'api', label: 'API Gateway', icon: <Server className="h-5 w-5" />, type: 'service' as const },
            ]
        },
        {
            name: 'Compute',
            color: '#F59E0B',
            gradient: ['#F59E0B', '#D97706'] as [string, string],
            nodes: [
                { id: 'lambda', label: 'AWS Lambda', icon: <Cpu className="h-5 w-5" />, type: 'compute' as const },
                { id: 'flask', label: 'Flask API', icon: <SiPython className="h-5 w-5" />, type: 'service' as const },
            ]
        },
        {
            name: 'Data & Security',
            color: '#8B5CF6',
            gradient: ['#8B5CF6', '#7C3AED'] as [string, string],
            nodes: [
                { id: 'mongo', label: 'MongoDB', icon: <SiMongodb className="h-5 w-5" />, type: 'db' as const },
                { id: 'ssm', label: 'SSM Secrets', icon: <Lock className="h-5 w-5" />, type: 'security' as const },
            ]
        },
    ] as AWSArchitectureLayer[],
    connections: [
        { from: 'user', to: 'route53', label: 'DNS', style: 'dashed' as const },
        { from: 'user', to: 'cloudfront', label: 'HTTPS' },
        { from: 'route53', to: 'cloudfront', style: 'dashed' as const },
        { from: 'cloudfront', to: 's3', label: 'Static' },
        { from: 'cloudfront', to: 'api', label: 'REST' },
        { from: 'api', to: 'lambda', label: 'Trigger' },
        { from: 'lambda', to: 'flask', label: 'Execute' },
        { from: 'flask', to: 'mongo', label: 'Query' },
        { from: 'flask', to: 'ssm', label: 'Config' },
    ] as AWSConnection[]
};

const slateArchitecture = {
    layers: [
        {
            name: 'SCM',
            color: '#2D3748',
            gradient: ['#2D3748', '#1A202C'] as [string, string],
            nodes: [
                { id: 'gh', label: 'GitHub', icon: <Github className="h-5 w-5" />, type: 'actor' as const },
            ]
        },
        {
            name: 'DevOps',
            color: '#2088FF',
            gradient: ['#2088FF', '#0056B3'] as [string, string],
            nodes: [
                { id: 'actions', label: 'GH Actions', icon: <SiGithubactions className="h-5 w-5" />, type: 'service' as const },
                { id: 'tf', label: 'Terraform', icon: <SiTerraform className="h-5 w-5" />, type: 'service' as const },
            ]
        },
        {
            name: 'Load Balancing',
            color: '#F59E0B',
            gradient: ['#F59E0B', '#D97706'] as [string, string],
            nodes: [
                { id: 'alb', label: 'ALB', icon: <Network className="h-5 w-5" />, type: 'service' as const },
            ]
        },
        {
            name: 'Compute & Storage',
            color: '#2496ED',
            gradient: ['#2496ED', '#0B5394'] as [string, string],
            nodes: [
                { id: 'ecs', label: 'ECS Fargate', icon: <SiDocker className="h-5 w-5" />, type: 'compute' as const },
                { id: 'rds', label: 'RDS DB', icon: <Database className="h-5 w-5" />, type: 'db' as const },
            ]
        },
        {
            name: 'Monitoring',
            color: '#EF4444',
            gradient: ['#EF4444', '#DC2626'] as [string, string],
            nodes: [
                { id: 'cw', label: 'CloudWatch', icon: <BarChart3 className="h-5 w-5" />, type: 'service' as const },
            ]
        },
    ] as AWSArchitectureLayer[],
    connections: [
        { from: 'gh', to: 'actions', label: 'Push' },
        { from: 'actions', to: 'tf', label: 'Trigger' },
        { from: 'tf', to: 'alb', label: 'Create' },
        { from: 'tf', to: 'ecs', label: 'Deploy' },
        { from: 'tf', to: 'rds', label: 'Setup' },
        { from: 'alb', to: 'ecs', label: 'Route' },
        { from: 'ecs', to: 'rds', label: 'Query' },
        { from: 'ecs', to: 'cw', label: 'Logs' },
        { from: 'alb', to: 'cw', label: 'Metrics' },
    ] as AWSConnection[]
};


// ========== SUMMARY / TECH COMPONENTS ==========

function SummaryCard({ title, icon, items, gradient, iconColor }: {
    title: string; icon: React.ReactNode; items: string[]; gradient: string; iconColor: string;
}) {
    const displayItems = items.slice(0, 4);
    const remaining = items.length - 4;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
        >
            <Card className="p-5 border-0 shadow-xl bg-card/80 backdrop-blur-sm h-full hover:shadow-2xl transition-shadow">
                <div className={`h-1 rounded-full mb-4 bg-gradient-to-r ${gradient}`} />
                <div className="flex items-center gap-2.5 mb-4">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} shadow-md`}>
                        <div className="text-white">{icon}</div>
                    </div>
                    <h3 className="font-bold text-foreground">{title}</h3>
                </div>
                <ul className="space-y-2">
                    {displayItems.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground/75">
                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: iconColor }} />
                            {item}
                        </li>
                    ))}
                </ul>
                {remaining > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">+{remaining} more</p>
                )}
            </Card>
        </motion.div>
    );
}

function TechStack({ stack }: { stack: Record<string, string[]> }) {
    const iconMap: Record<string, React.ReactNode> = {
        frontend: <Monitor className="h-3.5 w-3.5" />,
        backend: <Terminal className="h-3.5 w-3.5" />,
        infrastructure: <Cloud className="h-3.5 w-3.5" />,
        cicd: <GitBranch className="h-3.5 w-3.5" />,
        monitoring: <BarChart3 className="h-3.5 w-3.5" />
    };
    const colorMap: Record<string, string> = {
        frontend: '#3B82F6', backend: '#8B5CF6', infrastructure: '#F59E0B',
        cicd: '#10B981', monitoring: '#EF4444'
    };
    const labelMap: Record<string, string> = {
        frontend: 'Frontend', backend: 'Backend', infrastructure: 'Infra',
        cicd: 'CI/CD', monitoring: 'Monitoring'
    };

    return (
        <div className="space-y-3">
            {Object.entries(stack).map(([key, tools]) => (
                <div key={key} className="flex flex-wrap items-center gap-2">
                    <Badge
                        variant="outline"
                        className="px-2 py-1 gap-1 border-0 font-semibold text-xs shrink-0"
                        style={{ background: `${colorMap[key]}15`, color: colorMap[key] }}
                    >
                        {iconMap[key]}
                        {labelMap[key] || key}
                    </Badge>
                    {(tools as string[]).map((tool, i) => (
                        <span key={i} className="text-xs px-2 py-1 rounded-md bg-muted/50 text-foreground/70">
                            {tool}
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
}

// ========== MAIN PAGE ==========

export default function ProjectArchitecture() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();

    // Scroll to top on mount is CRITICAL
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [slug]);

    const project = PROJECTS.find(p => p.slug === slug);

    if (!project || !project.architecture) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-foreground mb-4">Project Not Found</h1>
                    <Button onClick={() => navigate('/home')} variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
                    </Button>
                </div>
            </div>
        );
    }

    const { architecture } = project;
    const isPortfolio = slug === 'cloud-portfolio';

    const handleContactClick = () => navigate('/home#contact');
    const handleBackClick = () => navigate('/home#projects');

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
                <div className="container flex items-center justify-between py-3">
                    <Button variant="ghost" onClick={handleBackClick} className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Portfolio
                    </Button>
                    <div className="flex items-center gap-3">
                        {project.status && (
                            <Badge className={`${project.status === 'Live' ? 'bg-emerald-500' : 'bg-amber-500'} text-white`}>
                                {project.status === 'Live' ? <Sparkles className="h-3 w-3 mr-1" /> : <Rocket className="h-3 w-3 mr-1" />}
                                {project.status}
                            </Badge>
                        )}
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <main className="container px-4 md:px-6 py-8 md:py-12 max-w-6xl mx-auto">
                {/* Hero */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-10"
                >
                    <Badge variant="outline" className="mb-3 border-primary/40 text-primary px-3 py-1 text-xs">
                        <Layers className="h-3 w-3 mr-1.5" />
                        Architecture Overview
                    </Badge>
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-3">
                        {project.title}
                    </h1>
                    <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
                        {project.description[0].length > 150
                            ? project.description[0].substring(0, 150) + '...'
                            : project.description[0]}
                    </p>
                </motion.div>

                {/* Draw.io Style Diagram */}
                <motion.section
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                    className="mb-12"
                >
                    <AWSArchitectureDiagram
                        title={architecture.diagram.title}
                        layers={isPortfolio ? portfolioArchitecture.layers : slateArchitecture.layers}
                        connections={isPortfolio ? portfolioArchitecture.connections : slateArchitecture.connections}
                    />
                </motion.section>

                {/* Tech Stack */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mb-10"
                >
                    <Card className="p-5 border-0 shadow-xl bg-card/80 backdrop-blur-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent shadow-md">
                                <Code className="h-4 w-4 text-white" />
                            </div>
                            <h2 className="font-bold text-foreground">Tech Stack</h2>
                        </div>
                        <TechStack stack={architecture.stack} />
                    </Card>
                </motion.section>

                {/* Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
                    <SummaryCard
                        title="Security"
                        icon={<Shield className="h-5 w-5" />}
                        items={architecture.security}
                        gradient="from-red-500 to-orange-500"
                        iconColor="#EF4444"
                    />
                    <SummaryCard
                        title="Scalability"
                        icon={<Zap className="h-5 w-5" />}
                        items={architecture.scalability}
                        gradient="from-blue-500 to-cyan-500"
                        iconColor="#3B82F6"
                    />
                    <SummaryCard
                        title="Cost Efficiency"
                        icon={<DollarSign className="h-5 w-5" />}
                        items={architecture.costEfficiency}
                        gradient="from-emerald-500 to-teal-500"
                        iconColor="#10B981"
                    />
                    <SummaryCard
                        title={architecture.coldStartOptimization ? 'Cold Start Optimization' : 'Innovation'}
                        icon={architecture.coldStartOptimization ? <Snowflake className="h-5 w-5" /> : <Lightbulb className="h-5 w-5" />}
                        items={architecture.coldStartOptimization || architecture.innovations || []}
                        gradient="from-purple-500 to-pink-500"
                        iconColor="#A855F7"
                    />
                </div>

                {/* CTA Footer */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center"
                >
                    <Card className="p-6 border-0 shadow-2xl bg-gradient-to-br from-primary/5 via-card to-accent/5">
                        <h3 className="text-xl font-bold text-foreground mb-2">Interested in this architecture?</h3>
                        <p className="text-sm text-muted-foreground mb-5 max-w-lg mx-auto">
                            Let's discuss how these patterns can solve your infrastructure challenges.
                        </p>
                        <div className="flex flex-wrap gap-3 justify-center">
                            <Button className="btn-premium" onClick={handleContactClick}>
                                Get In Touch
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                            {project.github && (
                                <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10" asChild>
                                    <a href={project.github} target="_blank" rel="noopener noreferrer">
                                        <Github className="mr-2 h-4 w-4" />
                                        Source Code
                                    </a>
                                </Button>
                            )}
                            <Button variant="ghost" onClick={handleBackClick} className="text-muted-foreground">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                All Projects
                            </Button>
                        </div>
                    </Card>
                </motion.div>
            </main>
        </div>
    );
}

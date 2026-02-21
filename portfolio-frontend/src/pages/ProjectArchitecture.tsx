import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PROJECTS } from '@/lib/constants';
import { useState, useEffect, lazy, Suspense } from 'react';

const AerosecCaseStudy = lazy(() => import('./AerosecCaseStudy'));
import AWSRefArchDiagram from '@/components/AWSRefArchDiagram';
import type { RefArchDiagramData } from '@/components/AWSRefArchDiagram';
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

// ========== SPATIAL ARCHITECTURE DATA ==========

const portfolioDiagram: RefArchDiagramData = {
    title: 'Cloud Portfolio — AWS Architecture',
    viewBox: [1160, 600],
    regions: [
        { id: 'aws', label: 'AWS Cloud', x: 160, y: 30, width: 980, height: 540, color: '#FF9900' },
        { id: 'vpc', label: 'VPC — Private Subnet', x: 460, y: 350, width: 380, height: 130, color: '#10B981' },
    ],
    nodes: [
        { id: 'users', label: 'End Users', icon: <Users className="h-5 w-5" />, x: 75, y: 250, accentColor: '#3B82F6' },
        { id: 'route53', label: 'Route 53', sublabel: 'DNS', icon: <Globe className="h-5 w-5" />, x: 270, y: 140, accentColor: '#F59E0B' },
        { id: 'cloudfront', label: 'CloudFront', sublabel: 'CDN', icon: <Wifi className="h-5 w-5" />, x: 270, y: 340, accentColor: '#8B5CF6' },
        { id: 's3', label: 'S3 Bucket', sublabel: 'Static Assets', icon: <HardDrive className="h-5 w-5" />, x: 500, y: 140, accentColor: '#10B981' },
        { id: 'apigw', label: 'API Gateway', sublabel: 'REST API', icon: <Server className="h-5 w-5" />, x: 500, y: 250, accentColor: '#10B981' },
        { id: 'lambda', label: 'AWS Lambda', sublabel: 'Compute', icon: <Cpu className="h-5 w-5" />, x: 560, y: 415, accentColor: '#F59E0B' },
        { id: 'flask', label: 'Flask API', sublabel: 'Application', icon: <SiPython className="h-5 w-5" />, x: 740, y: 415, accentColor: '#8B5CF6' },
        { id: 'mongo', label: 'MongoDB', sublabel: 'Atlas DB', icon: <SiMongodb className="h-5 w-5" />, x: 980, y: 330, accentColor: '#10B981' },
        { id: 'ssm', label: 'SSM Params', sublabel: 'Secrets', icon: <Lock className="h-5 w-5" />, x: 980, y: 480, accentColor: '#8B5CF6' },
    ],
    edges: [
        { from: 'users', to: 'route53', label: 'DNS' },
        { from: 'users', to: 'cloudfront', label: 'HTTPS' },
        { from: 'route53', to: 'cloudfront', dashed: true },
        { from: 'cloudfront', to: 's3', label: 'Static', fromSide: 'right', toSide: 'bottom' },
        { from: 'cloudfront', to: 'apigw', label: 'API' },
        { from: 'apigw', to: 'lambda', label: 'Invoke', fromSide: 'bottom', toSide: 'top' },
        { from: 'lambda', to: 'flask', label: 'Execute' },
        { from: 'flask', to: 'mongo', label: 'Query' },
        { from: 'flask', to: 'ssm', label: 'Config', dashed: true },
    ],
};

const slateDiagram: RefArchDiagramData = {
    title: 'SLATE — Multi-Environment Architecture',
    viewBox: [1160, 530],
    regions: [
        { id: 'aws', label: 'AWS Cloud', x: 170, y: 40, width: 970, height: 450, color: '#FF9900' },
        { id: 'vpc', label: 'VPC — Application Tier', x: 580, y: 85, width: 420, height: 330, color: '#10B981' },
    ],
    nodes: [
        { id: 'gh', label: 'GitHub', sublabel: 'Source', icon: <Github className="h-5 w-5" />, x: 75, y: 260, accentColor: '#24292F' },
        { id: 'actions', label: 'GH Actions', sublabel: 'CI/CD', icon: <SiGithubactions className="h-5 w-5" />, x: 290, y: 180, accentColor: '#2088FF' },
        { id: 'tf', label: 'Terraform', sublabel: 'IaC', icon: <SiTerraform className="h-5 w-5" />, x: 290, y: 340, accentColor: '#7B42BC' },
        { id: 'alb', label: 'ALB', sublabel: 'Load Balancer', icon: <Network className="h-5 w-5" />, x: 700, y: 155, accentColor: '#FF9900' },
        { id: 'ecs', label: 'ECS Fargate', sublabel: 'Containers', icon: <SiDocker className="h-5 w-5" />, x: 700, y: 310, accentColor: '#2496ED' },
        { id: 'rds', label: 'RDS', sublabel: 'Database', icon: <Database className="h-5 w-5" />, x: 900, y: 310, accentColor: '#3B82F6' },
        { id: 'cw', label: 'CloudWatch', sublabel: 'Monitoring', icon: <BarChart3 className="h-5 w-5" />, x: 1040, y: 155, accentColor: '#EF4444' },
    ],
    edges: [
        { from: 'gh', to: 'actions', label: 'Push' },
        { from: 'actions', to: 'tf', label: 'Trigger' },
        { from: 'tf', to: 'alb', label: 'Create' },
        { from: 'tf', to: 'ecs', label: 'Deploy' },
        { from: 'tf', to: 'rds', label: 'Setup', dashed: true },
        { from: 'alb', to: 'ecs', label: 'Route' },
        { from: 'ecs', to: 'rds', label: 'Query' },
        { from: 'ecs', to: 'cw', label: 'Logs', fromSide: 'right', toSide: 'bottom' },
        { from: 'alb', to: 'cw', label: 'Metrics' },
    ],
};

const microservicesDiagram: RefArchDiagramData = {
    title: 'Microservices CI/CD — AWS Architecture',
    viewBox: [1200, 570],
    regions: [
        { id: 'aws', label: 'AWS Account', x: 170, y: 40, width: 1010, height: 500, color: '#FF9900' },
        { id: 'cicd', label: 'CI/CD Pipeline', x: 390, y: 80, width: 230, height: 310, color: '#F59E0B' },
        { id: 'vpc', label: 'VPC — Production', x: 810, y: 220, width: 340, height: 290, color: '#10B981' },
    ],
    nodes: [
        { id: 'commit', label: 'CodeCommit', sublabel: 'Source', icon: <GitBranch className="h-5 w-5" />, x: 90, y: 240, accentColor: '#24292F' },
        { id: 'eb', label: 'EventBridge', sublabel: 'Events', icon: <Activity className="h-5 w-5" />, x: 270, y: 240, accentColor: '#FF4F8B' },
        { id: 'pipeline', label: 'CodePipeline', sublabel: 'Orchestrator', icon: <Rocket className="h-5 w-5" />, x: 505, y: 150, accentColor: '#F59E0B' },
        { id: 'build', label: 'CodeBuild', sublabel: 'Build & Test', icon: <Box className="h-5 w-5" />, x: 505, y: 310, accentColor: '#F59E0B' },
        { id: 'ecr', label: 'ECR', sublabel: 'Container Reg', icon: <Layers className="h-5 w-5" />, x: 710, y: 140, accentColor: '#FF9900' },
        { id: 's3', label: 'S3 Artifacts', sublabel: 'Build Output', icon: <HardDrive className="h-5 w-5" />, x: 710, y: 310, accentColor: '#FF9900' },
        { id: 'r53', label: 'Route 53', sublabel: 'DNS', icon: <Globe className="h-5 w-5" />, x: 935, y: 140, accentColor: '#8B5CF6' },
        { id: 'alb', label: 'ALB', sublabel: 'Load Balancer', icon: <Network className="h-5 w-5" />, x: 895, y: 310, accentColor: '#FF9900' },
        { id: 'ecs', label: 'ECS Fargate', sublabel: 'Containers', icon: <Cloud className="h-5 w-5" />, x: 895, y: 440, accentColor: '#FF9900' },
        { id: 'rds', label: 'Amazon RDS', sublabel: 'Database', icon: <Database className="h-5 w-5" />, x: 1080, y: 440, accentColor: '#3B82F6' },
    ],
    edges: [
        { from: 'commit', to: 'eb', label: 'Event' },
        { from: 'eb', to: 'pipeline', label: 'Trigger' },
        { from: 'pipeline', to: 'build', label: 'Build' },
        { from: 'build', to: 'ecr', label: 'Image' },
        { from: 'build', to: 's3', label: 'Artifacts' },
        { from: 'ecr', to: 'ecs', label: 'Pull', fromSide: 'right', toSide: 'top' },
        { from: 'r53', to: 'alb', label: 'DNS', dashed: true },
        { from: 'alb', to: 'ecs', label: 'Route' },
        { from: 'ecs', to: 'rds', label: 'Query' },
    ],
};

const crossAccountDiagram: RefArchDiagramData = {
    title: 'Cross-Account CI/CD — Multi-Tenancy',
    viewBox: [1200, 680],
    regions: [
        { id: 'main', label: 'Main Account — Build & Artifacts', x: 40, y: 30, width: 1120, height: 260, color: '#FF9900' },
        { id: 'tenantA', label: 'Tenant A Account', x: 40, y: 360, width: 530, height: 280, color: '#10B981' },
        { id: 'tenantB', label: 'Tenant B Account', x: 630, y: 360, width: 530, height: 280, color: '#3B82F6' },
        { id: 'vpcA', label: 'VPC', x: 100, y: 440, width: 420, height: 150, color: '#10B981' },
        { id: 'vpcB', label: 'VPC', x: 690, y: 440, width: 420, height: 150, color: '#3B82F6' },
    ],
    nodes: [
        { id: 'commit', label: 'CodeCommit', sublabel: 'Source', icon: <GitBranch className="h-5 w-5" />, x: 130, y: 150, accentColor: '#24292F' },
        { id: 'pipeline', label: 'CodePipeline', sublabel: 'Orchestrator', icon: <Rocket className="h-5 w-5" />, x: 340, y: 150, accentColor: '#F59E0B' },
        { id: 'build', label: 'CodeBuild', sublabel: 'Build & Test', icon: <Box className="h-5 w-5" />, x: 550, y: 150, accentColor: '#F59E0B' },
        { id: 'ecr', label: 'ECR', sublabel: 'Shared Registry', icon: <Layers className="h-5 w-5" />, x: 780, y: 100, accentColor: '#FF9900' },
        { id: 'kms', label: 'KMS', sublabel: 'Encryption', icon: <Lock className="h-5 w-5" />, x: 780, y: 210, accentColor: '#EF4444' },
        { id: 's3', label: 'S3 Encrypted', sublabel: 'Artifacts', icon: <HardDrive className="h-5 w-5" />, x: 990, y: 155, accentColor: '#FF9900' },
        { id: 'ecsA', label: 'ECS Fargate', sublabel: 'Tenant A', icon: <Cloud className="h-5 w-5" />, x: 230, y: 520, accentColor: '#10B981' },
        { id: 'rdsA', label: 'RDS', sublabel: 'Tenant A DB', icon: <Database className="h-5 w-5" />, x: 430, y: 520, accentColor: '#10B981' },
        { id: 'ecsB', label: 'ECS Fargate', sublabel: 'Tenant B', icon: <Cloud className="h-5 w-5" />, x: 820, y: 520, accentColor: '#3B82F6' },
        { id: 'rdsB', label: 'RDS', sublabel: 'Tenant B DB', icon: <Database className="h-5 w-5" />, x: 1020, y: 520, accentColor: '#3B82F6' },
    ],
    edges: [
        { from: 'commit', to: 'pipeline', label: 'Trigger' },
        { from: 'pipeline', to: 'build', label: 'Build' },
        { from: 'build', to: 'ecr', label: 'Image' },
        { from: 'build', to: 's3', label: 'Artifacts' },
        { from: 'kms', to: 's3', label: 'Encrypt', dashed: true },
        { from: 'ecr', to: 'ecsA', label: 'Cross-Acct', fromSide: 'bottom', toSide: 'top' },
        { from: 'ecr', to: 'ecsB', label: 'Cross-Acct', fromSide: 'bottom', toSide: 'top' },
        { from: 'ecsA', to: 'rdsA', label: 'Query' },
        { from: 'ecsB', to: 'rdsB', label: 'Query' },
    ],
};

const diagramDataMap: Record<string, RefArchDiagramData> = {
    'cloud-portfolio': portfolioDiagram,
    'slate-environments': slateDiagram,
    'aws-microservices-cicd': microservicesDiagram,
    'cross-account-cicd': crossAccountDiagram,
};

// ========== SUMMARY / TECH COMPONENTS ==========

function SummaryCard({ title, icon, items, gradient, iconColor }: {
    title: string; icon: React.ReactNode; items: string[]; gradient: string; iconColor: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const displayItems = expanded ? items : items.slice(0, 4);
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
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-xs text-primary hover:text-primary/80 mt-2 font-medium transition-colors cursor-pointer"
                    >
                        {expanded ? 'Show less' : `+${remaining} more`}
                    </button>
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

    if (slug === 'aerosec') {
        return (
            <Suspense fallback={
                <div className="min-h-screen bg-background flex items-center justify-center">
                    <div className="animate-pulse text-muted-foreground">Loading...</div>
                </div>
            }>
                <AerosecCaseStudy />
            </Suspense>
        );
    }

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
    const diagramData = diagramDataMap[slug!] || portfolioDiagram;

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
                    <AWSRefArchDiagram data={diagramData} />
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

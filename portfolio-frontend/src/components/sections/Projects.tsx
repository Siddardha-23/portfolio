import { motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PROJECTS } from '@/lib/constants';
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Github,
  ArrowRight,
  Layers,
  Cloud,
  Server,
  Code,
  Rocket,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Users,
  Globe,
  HardDrive,
  Cpu,
  Database,
  Lock,
  Network,
  BarChart3,
  Activity,
  GitBranch,
  Shield,
  FileText,
} from 'lucide-react';

// Tech color mapping
const techColors: { [key: string]: string } = {
  'AWS': '#FF9900',
  'Terraform': '#7B42BC',
  'Docker': '#2496ED',
  'Flask': '#000000',
  'React': '#61DAFB',
  'Nginx': '#009639',
  'CI/CD': '#4CAF50',
  'ECS': '#FF9900',
  'GitHub Actions': '#2088FF',
  'Cybersecurity': '#DC2626',
  'NIST CSF 2.0': '#6366F1',
  'API Security': '#F59E0B',
  'AI/ML': '#8B5CF6',
  'Aviation': '#0EA5E9',
  'Risk Analytics': '#10B981',
  'CloudFormation': '#E7157B',
  'RDS': '#3B82F6'
};

// Tech icon mapping
const techIcons: { [key: string]: React.ReactNode } = {
  'AWS': <Cloud className="h-4 w-4" />,
  'Terraform': <Server className="h-4 w-4" />,
  'Docker': <Layers className="h-4 w-4" />,
  'Flask': <Code className="h-4 w-4" />,
  'React': <Code className="h-4 w-4" />,
  'Nginx': <Server className="h-4 w-4" />,
  'CI/CD': <Rocket className="h-4 w-4" />,
  'ECS': <Cloud className="h-4 w-4" />,
  'GitHub Actions': <Rocket className="h-4 w-4" />,
  'Cybersecurity': <Shield className="h-4 w-4" />,
  'NIST CSF 2.0': <Lock className="h-4 w-4" />,
  'API Security': <Server className="h-4 w-4" />,
  'AI/ML': <Cpu className="h-4 w-4" />,
  'Aviation': <Globe className="h-4 w-4" />,
  'Risk Analytics': <BarChart3 className="h-4 w-4" />,
  'CloudFormation': <Layers className="h-4 w-4" />,
  'RDS': <Database className="h-4 w-4" />
};

// ==================== AWS-STYLE ARCHITECTURE DIAGRAM ====================

interface ArchNode {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  color: string;
  x: number;
  y: number;
}

interface ArchEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

interface ArchRegion {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  dashed?: boolean;
  icon?: React.ReactNode;
}

interface ArchData {
  nodes: ArchNode[];
  edges: ArchEdge[];
  regions: ArchRegion[];
}

// ---- Portfolio: Serverless 3-tier on AWS ----
const PORTFOLIO_ARCH: ArchData = {
  regions: [
    { label: 'AWS Cloud', x: 140, y: 8, w: 490, h: 265, color: '#FF9900', dashed: true, icon: <Cloud className="h-3 w-3" /> },
    { label: 'Edge (Global)', x: 152, y: 32, w: 145, h: 232, color: '#F59E0B', dashed: false },
    { label: 'Serverless Compute', x: 308, y: 32, w: 155, h: 232, color: '#FF9900', dashed: false },
    { label: 'Storage & Security', x: 474, y: 32, w: 145, h: 232, color: '#8B5CF6', dashed: false },
  ],
  nodes: [
    // External
    { id: 'user', label: 'End Users', sublabel: 'Browser', icon: <Users className="h-4 w-4" />, color: '#3B82F6', x: 62, y: 140 },
    // Edge
    { id: 'r53', label: 'Route 53', sublabel: 'DNS', icon: <Globe className="h-4 w-4" />, color: '#8B5CF6', x: 224, y: 90 },
    { id: 'cf', label: 'CloudFront', sublabel: 'CDN', icon: <Network className="h-4 w-4" />, color: '#8B5CF6', x: 224, y: 200 },
    // Compute
    { id: 'apigw', label: 'API Gateway', sublabel: 'REST API', icon: <Server className="h-4 w-4" />, color: '#E7157B', x: 385, y: 90 },
    { id: 'lambda', label: 'Lambda', sublabel: 'Flask App', icon: <Cpu className="h-4 w-4" />, color: '#FF9900', x: 385, y: 200 },
    // Storage
    { id: 's3', label: 'S3 Bucket', sublabel: 'Static SPA', icon: <HardDrive className="h-4 w-4" />, color: '#3ECF8E', x: 546, y: 70 },
    { id: 'mongo', label: 'MongoDB', sublabel: 'Atlas', icon: <Database className="h-4 w-4" />, color: '#00684A', x: 546, y: 155 },
    { id: 'ssm', label: 'SSM Params', sublabel: 'Secrets', icon: <Lock className="h-4 w-4" />, color: '#DD344C', x: 546, y: 235 },
    // External right
    { id: 'acm', label: 'ACM', sublabel: 'SSL/TLS', icon: <Lock className="h-4 w-4" />, color: '#DD344C', x: 700, y: 140 },
  ],
  edges: [
    { from: 'user', to: 'r53', label: 'HTTPS' },
    { from: 'r53', to: 'cf', dashed: true },
    { from: 'cf', to: 'apigw', label: 'REST' },
    { from: 'cf', to: 's3', label: 'Static' },
    { from: 'apigw', to: 'lambda', label: 'Invoke' },
    { from: 'lambda', to: 'mongo', label: 'Query' },
    { from: 'lambda', to: 'ssm', dashed: true },
    { from: 'acm', to: 'cf', dashed: true },
  ],
};

// ---- SLATE: Ephemeral environments on AWS ----
const SLATE_ARCH: ArchData = {
  regions: [
    { label: 'AWS Cloud', x: 262, y: 8, w: 470, h: 265, color: '#FF9900', dashed: true, icon: <Cloud className="h-3 w-3" /> },
    { label: 'VPC (per branch)', x: 396, y: 32, w: 325, h: 232, color: '#10B981', dashed: true },
  ],
  nodes: [
    // External / CI
    { id: 'gh', label: 'GitHub', sublabel: 'PR / Push', icon: <Github className="h-4 w-4" />, color: '#24292F', x: 55, y: 140 },
    { id: 'actions', label: 'GH Actions', sublabel: 'CI Pipeline', icon: <GitBranch className="h-4 w-4" />, color: '#2088FF', x: 168, y: 140 },
    // AWS - IaC
    { id: 'tf', label: 'Terraform', sublabel: 'IaC Engine', icon: <Layers className="h-4 w-4" />, color: '#7B42BC', x: 310, y: 140 },
    // Inside VPC
    { id: 'alb', label: 'ALB', sublabel: 'Load Balancer', icon: <Network className="h-4 w-4" />, color: '#8B5CF6', x: 440, y: 80 },
    { id: 'ecs', label: 'ECS Fargate', sublabel: 'Containers', icon: <Cloud className="h-4 w-4" />, color: '#FF9900', x: 565, y: 80 },
    { id: 'rds', label: 'RDS', sublabel: 'Database', icon: <Database className="h-4 w-4" />, color: '#3B82F6', x: 440, y: 200 },
    { id: 's3', label: 'S3', sublabel: 'Artifacts', icon: <HardDrive className="h-4 w-4" />, color: '#3ECF8E', x: 565, y: 200 },
    { id: 'cw', label: 'CloudWatch', sublabel: 'Monitoring', icon: <BarChart3 className="h-4 w-4" />, color: '#E7157B', x: 680, y: 140 },
  ],
  edges: [
    { from: 'gh', to: 'actions', label: 'Webhook' },
    { from: 'actions', to: 'tf', label: 'Trigger' },
    { from: 'tf', to: 'alb', label: 'Provision' },
    { from: 'tf', to: 'rds', label: 'Setup' },
    { from: 'alb', to: 'ecs', label: 'Route' },
    { from: 'ecs', to: 'rds', dashed: true },
    { from: 'ecs', to: 's3', dashed: true },
    { from: 'ecs', to: 'cw', label: 'Metrics' },
  ],
};

// ---- AEROSEC: Aviation Cybersecurity Risk Platform ----
const AEROSEC_ARCH: ArchData = {
  regions: [
    { label: 'AEROSEC Platform', x: 140, y: 8, w: 520, h: 265, color: '#DC2626', dashed: true, icon: <Shield className="h-3 w-3" /> },
    { label: 'Data Ingestion', x: 152, y: 32, w: 145, h: 232, color: '#F59E0B', dashed: false },
    { label: 'Analysis Engine', x: 308, y: 32, w: 155, h: 232, color: '#8B5CF6', dashed: false },
    { label: 'Risk Intelligence', x: 474, y: 32, w: 175, h: 232, color: '#10B981', dashed: false },
  ],
  nodes: [
    { id: 'airlines', label: 'Airlines', sublabel: 'PSS Data', icon: <Globe className="h-4 w-4" />, color: '#3B82F6', x: 62, y: 140 },
    { id: 'apis', label: 'API Monitor', sublabel: 'Real-time', icon: <Activity className="h-4 w-4" />, color: '#F59E0B', x: 224, y: 90 },
    { id: 'vendors', label: 'Vendor Feed', sublabel: 'Third-party', icon: <Network className="h-4 w-4" />, color: '#F59E0B', x: 224, y: 200 },
    { id: 'ai', label: 'AI Engine', sublabel: 'Anomaly Det.', icon: <Cpu className="h-4 w-4" />, color: '#8B5CF6', x: 385, y: 90 },
    { id: 'compliance', label: 'Compliance', sublabel: 'NIST/FAA', icon: <Lock className="h-4 w-4" />, color: '#8B5CF6', x: 385, y: 200 },
    { id: 'dashboard', label: 'Dashboard', sublabel: 'Executive', icon: <BarChart3 className="h-4 w-4" />, color: '#10B981', x: 546, y: 90 },
    { id: 'audit', label: 'Audit Logs', sublabel: 'Auto-gen', icon: <FileText className="h-4 w-4" />, color: '#10B981', x: 546, y: 200 },
    { id: 'nist', label: 'NIST CSF', sublabel: 'Standards', icon: <Shield className="h-4 w-4" />, color: '#DC2626', x: 700, y: 140 },
  ],
  edges: [
    { from: 'airlines', to: 'apis', label: 'APIs' },
    { from: 'airlines', to: 'vendors' },
    { from: 'apis', to: 'ai', label: 'Analyze' },
    { from: 'vendors', to: 'compliance', label: 'Score' },
    { from: 'ai', to: 'dashboard', label: 'Risk' },
    { from: 'compliance', to: 'audit', label: 'Report' },
    { from: 'ai', to: 'compliance', dashed: true },
    { from: 'nist', to: 'compliance', dashed: true },
  ],
};

// ---- AWS Microservices CI/CD Architecture ----
const MICROSERVICES_ARCH: ArchData = {
  regions: [
    { label: 'AWS Cloud', x: 140, y: 8, w: 530, h: 265, color: '#FF9900', dashed: true, icon: <Cloud className="h-3 w-3" /> },
    { label: 'CI/CD Pipeline', x: 152, y: 32, w: 165, h: 232, color: '#F59E0B', dashed: false },
    { label: 'VPC (3-Tier)', x: 328, y: 32, w: 195, h: 232, color: '#10B981', dashed: true },
  ],
  nodes: [
    { id: 'dev', label: 'Developer', sublabel: 'Push Code', icon: <Users className="h-4 w-4" />, color: '#3B82F6', x: 62, y: 140 },
    { id: 'commit', label: 'CodeCommit', sublabel: 'Source', icon: <GitBranch className="h-4 w-4" />, color: '#24292F', x: 234, y: 80 },
    { id: 'pipeline', label: 'CodePipeline', sublabel: 'Build+Deploy', icon: <Rocket className="h-4 w-4" />, color: '#4CAF50', x: 234, y: 200 },
    { id: 'alb', label: 'ALB', sublabel: 'Public Tier', icon: <Network className="h-4 w-4" />, color: '#8B5CF6', x: 426, y: 70 },
    { id: 'ecs', label: 'ECS Fargate', sublabel: '4 Services', icon: <Cloud className="h-4 w-4" />, color: '#FF9900', x: 426, y: 155 },
    { id: 'rds', label: 'RDS', sublabel: 'Data Tier', icon: <Database className="h-4 w-4" />, color: '#3B82F6', x: 426, y: 235 },
    { id: 'r53', label: 'Route 53', sublabel: 'DNS + SSL', icon: <Globe className="h-4 w-4" />, color: '#8B5CF6', x: 600, y: 80 },
    { id: 'ecr', label: 'ECR', sublabel: 'Images', icon: <Layers className="h-4 w-4" />, color: '#FF9900', x: 600, y: 200 },
  ],
  edges: [
    { from: 'dev', to: 'commit', label: 'Push' },
    { from: 'commit', to: 'pipeline', label: 'Trigger' },
    { from: 'pipeline', to: 'ecs', label: 'Deploy' },
    { from: 'r53', to: 'alb', dashed: true },
    { from: 'alb', to: 'ecs' },
    { from: 'ecs', to: 'rds', label: 'Query' },
    { from: 'ecr', to: 'ecs', dashed: true },
  ],
};

// ---- Cross-Account CI/CD Multi-Tenancy ----
const CROSS_ACCOUNT_ARCH: ArchData = {
  regions: [
    { label: 'Main Account', x: 140, y: 8, w: 195, h: 265, color: '#FF9900', dashed: true, icon: <Cloud className="h-3 w-3" /> },
    { label: 'Tenant Accounts', x: 347, y: 8, w: 270, h: 265, color: '#10B981', dashed: true, icon: <Users className="h-3 w-3" /> },
  ],
  nodes: [
    { id: 'dev', label: 'Developer', sublabel: 'Push Code', icon: <Users className="h-4 w-4" />, color: '#3B82F6', x: 62, y: 140 },
    { id: 'pipeline', label: 'CodePipeline', sublabel: 'Multi-Stage', icon: <Rocket className="h-4 w-4" />, color: '#4CAF50', x: 238, y: 90 },
    { id: 'ecr', label: 'ECR', sublabel: 'Shared', icon: <Layers className="h-4 w-4" />, color: '#FF9900', x: 238, y: 200 },
    { id: 'ecsA', label: 'ECS Fargate', sublabel: 'Tenant A', icon: <Cloud className="h-4 w-4" />, color: '#10B981', x: 430, y: 70 },
    { id: 'ecsB', label: 'ECS Fargate', sublabel: 'Tenant B', icon: <Cloud className="h-4 w-4" />, color: '#10B981', x: 430, y: 155 },
    { id: 'rds', label: 'RDS', sublabel: 'Per Tenant', icon: <Database className="h-4 w-4" />, color: '#3B82F6', x: 430, y: 235 },
    { id: 'kms', label: 'KMS', sublabel: 'Encryption', icon: <Lock className="h-4 w-4" />, color: '#DD344C', x: 560, y: 80 },
    { id: 'iam', label: 'IAM Roles', sublabel: 'Cross-Acct', icon: <Shield className="h-4 w-4" />, color: '#DD344C', x: 560, y: 200 },
  ],
  edges: [
    { from: 'dev', to: 'pipeline', label: 'Push' },
    { from: 'pipeline', to: 'ecr', label: 'Build' },
    { from: 'ecr', to: 'ecsA', label: 'Pull' },
    { from: 'ecr', to: 'ecsB', label: 'Pull' },
    { from: 'ecsB', to: 'rds', dashed: true },
    { from: 'kms', to: 'ecr', dashed: true },
    { from: 'iam', to: 'ecsA', dashed: true },
  ],
};

const ARCH_MAP: Record<string, ArchData> = {
  'cloud-portfolio': PORTFOLIO_ARCH,
  'slate-environments': SLATE_ARCH,
  'aerosec': AEROSEC_ARCH,
  'aws-microservices-cicd': MICROSERVICES_ARCH,
  'cross-account-cicd': CROSS_ACCOUNT_ARCH,
};

// AWS-style service icon node dimensions
const NW = 78;
const NH = 68;

function MiniArchitectureDiagram({ slug }: { slug: string }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const data = ARCH_MAP[slug];
  if (!data) return null;

  const nodeMap = new Map(data.nodes.map(n => [n.id, n]));

  const connectedEdges = new Set<number>();
  const connectedNodes = new Set<string>();
  if (hovered) {
    connectedNodes.add(hovered);
    data.edges.forEach((e, i) => {
      if (e.from === hovered || e.to === hovered) {
        connectedEdges.add(i);
        connectedNodes.add(e.from);
        connectedNodes.add(e.to);
      }
    });
  }

  return (
    <div className="w-full h-full">
      <svg viewBox="0 0 760 280" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id={`sh-${slug}`} x="-8%" y="-8%" width="116%" height="116%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.08" />
          </filter>
          <marker id={`arr-${slug}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" className="fill-zinc-400 dark:fill-zinc-500" />
          </marker>
          <marker id={`arrH-${slug}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#FF9900" />
          </marker>
        </defs>

        {/* ---- Regions (AWS Cloud, VPC, etc.) ---- */}
        {data.regions.map((r, i) => (
          <g key={`region-${i}`}>
            <rect
              x={r.x} y={r.y} width={r.w} height={r.h} rx="8"
              fill={r.dashed ? `${r.color}06` : `${r.color}08`}
              stroke={r.color}
              strokeWidth={r.dashed ? 1.5 : 0.8}
              strokeDasharray={r.dashed ? '8,4' : '0'}
              className="dark:opacity-80"
            />
            {/* Region label */}
            <g transform={`translate(${r.x + 8}, ${r.y - 1})`}>
              <rect
                x="0" y="-4" rx="3"
                width={r.label.length * 6.5 + (r.icon ? 20 : 10)} height="16"
                fill={r.color} opacity="0.9"
              />
              {r.icon && (
                <foreignObject x="4" y="-2" width="12" height="12">
                  <div className="flex items-center justify-center text-white w-full h-full">{r.icon}</div>
                </foreignObject>
              )}
              <text
                x={r.icon ? 18 : 5} y="8"
                fontSize="8" fontWeight="700" fill="white"
                style={{ pointerEvents: 'none' }}
              >
                {r.label}
              </text>
            </g>
          </g>
        ))}

        {/* ---- Edges ---- */}
        {data.edges.map((edge, idx) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;

          const isActive = connectedEdges.has(idx);
          const isDimmed = hovered && !isActive;

          const x1 = from.x + NW / 2;
          const y1 = from.y;
          const x2 = to.x - NW / 2;
          const y2 = to.y;

          // Bezier control offset
          const dx = x2 - x1;
          const dy = Math.abs(y2 - y1);
          const ctrl = Math.min(55, Math.abs(dx) * 0.35);
          // If mostly vertical movement, curve more
          const cy1 = dy > Math.abs(dx) * 0.8 ? y1 + (y2 - y1) * 0.3 : y1;
          const cy2 = dy > Math.abs(dx) * 0.8 ? y2 - (y2 - y1) * 0.3 : y2;

          const path = `M ${x1} ${y1} C ${x1 + ctrl} ${cy1}, ${x2 - ctrl} ${cy2}, ${x2} ${y2}`;

          return (
            <g key={`edge-${idx}`} opacity={isDimmed ? 0.15 : 1} className="transition-opacity duration-200">
              <path d={path} fill="none" stroke="transparent" strokeWidth="14" />
              <path
                d={path}
                fill="none"
                stroke={isActive ? '#FF9900' : '#94a3b8'}
                strokeWidth={isActive ? 2.2 : 1}
                strokeDasharray={edge.dashed ? '5,3' : '0'}
                markerEnd={isActive ? `url(#arrH-${slug})` : `url(#arr-${slug})`}
                className={`transition-all duration-200 ${!isActive ? 'dark:stroke-zinc-600' : ''}`}
              />
              {edge.label && (
                <g>
                  <rect
                    x={(x1 + x2) / 2 - edge.label.length * 3 - 4}
                    y={(y1 + y2) / 2 - 7}
                    width={edge.label.length * 6 + 8}
                    height="14" rx="3"
                    className="fill-white/90 dark:fill-zinc-800/90 stroke-zinc-200 dark:stroke-zinc-700"
                    strokeWidth="0.5"
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 + 3}
                    textAnchor="middle" fontSize="7.5" fontWeight="600"
                    className={isActive ? 'fill-[#FF9900]' : 'fill-zinc-400 dark:fill-zinc-500'}
                    style={{ transition: 'fill 0.2s' }}
                  >
                    {edge.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* ---- Nodes (AWS-style: icon centered, label below) ---- */}
        {data.nodes.map((node) => {
          const isActive = !hovered || connectedNodes.has(node.id);
          const isThis = hovered === node.id;
          const nx = node.x - NW / 2;
          const ny = node.y - NH / 2;

          return (
            <g
              key={node.id}
              transform={`translate(${nx}, ${ny})`}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
              opacity={isActive ? 1 : 0.2}
              style={{ transition: 'opacity 0.2s' }}
            >
              {/* Hover glow ring */}
              {isThis && (
                <rect
                  x="-3" y="-3" width={NW + 6} height={NH + 6} rx="10"
                  fill="none" stroke={node.color} strokeWidth="1.5" opacity="0.35"
                />
              )}
              {/* Card */}
              <rect
                x="0" y="0" width={NW} height={NH} rx="7"
                className="fill-white dark:fill-zinc-800"
                stroke={isThis ? node.color : '#e2e8f0'}
                strokeWidth={isThis ? 1.8 : 0.8}
                filter={`url(#sh-${slug})`}
                style={{ transition: 'stroke 0.15s' }}
              />
              {/* Icon circle */}
              <circle cx={NW / 2} cy="24" r="14" fill={`${node.color}15`} />
              <circle cx={NW / 2} cy="24" r="14" fill="none" stroke={node.color} strokeWidth="0.6" opacity="0.5" />
              <foreignObject x={NW / 2 - 9} y="15" width="18" height="18">
                <div className="flex items-center justify-center w-full h-full" style={{ color: node.color }}>
                  {node.icon}
                </div>
              </foreignObject>
              {/* Label */}
              <text
                x={NW / 2} y="50"
                textAnchor="middle" fontSize="8" fontWeight="700"
                className="fill-zinc-800 dark:fill-zinc-200"
                style={{ pointerEvents: 'none' }}
              >
                {node.label}
              </text>
              {/* Sublabel */}
              {node.sublabel && (
                <text
                  x={NW / 2} y="59"
                  textAnchor="middle" fontSize="6.5" fontWeight="500"
                  className="fill-zinc-400 dark:fill-zinc-500"
                  style={{ pointerEvents: 'none' }}
                >
                  {node.sublabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ==================== PROJECT CARD ====================

function ProjectCard({ project, index }: { project: typeof PROJECTS[0]; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();
  const hasArch = !!ARCH_MAP[project.slug];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: index * 0.2 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group"
    >
      <Card className="relative overflow-hidden border-0 shadow-2xl bg-card h-full">
        {/* Animated gradient border effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ padding: '2px' }}
          animate={isHovered ? { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] } : {}}
          transition={{ duration: 3, repeat: Infinity }}
        />

        {/* Inner content */}
        <div className="relative bg-card m-[2px] rounded-lg overflow-hidden">
          {/* Architecture diagram header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-zinc-50 via-white to-zinc-50 dark:from-zinc-900 dark:via-zinc-900/80 dark:to-zinc-800/50">
            {hasArch ? (
              <div className="relative">
                {/* AWS-style header bar */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700/50 bg-zinc-50/80 dark:bg-zinc-800/50">
                  <div className={`p-1 rounded ${project.slug === 'aerosec' ? 'bg-red-600' : 'bg-[#FF9900]'}`}>
                    {project.slug === 'aerosec' ? <Shield className="h-3 w-3 text-white" /> : <Cloud className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    {project.slug === 'aerosec' ? 'Security Architecture' : 'Architecture'}
                  </span>
                  <div className="ml-auto flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                    <Activity className="h-3 w-3" />
                    <span className="hidden sm:inline">Hover to explore</span>
                  </div>
                </div>
                {/* Diagram */}
                <div className="px-2 py-3" style={{ height: '240px' }}>
                  <MiniArchitectureDiagram slug={project.slug} />
                </div>
              </div>
            ) : (
              /* Fallback: floating icons for projects without architecture */
              <div className="relative h-48 bg-gradient-to-br from-primary/20 via-secondary/50 to-accent/20">
                <div className="absolute inset-0 opacity-30">
                  <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)',
                    backgroundSize: '20px 20px'
                  }} />
                </div>
                <div className="absolute inset-0">
                  {project.technologies.slice(0, 4).map((tech, i) => (
                    <motion.div
                      key={i}
                      className="absolute"
                      style={{ top: `${20 + i * 20}%`, left: `${10 + i * 25}%` }}
                      animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
                    >
                      <div
                        className="p-3 rounded-xl backdrop-blur-sm border border-white/10"
                        style={{ background: `${techColors[tech] || '#6366f1'}20` }}
                      >
                        <div style={{ color: techColors[tech] || '#6366f1' }}>
                          {techIcons[tech] || <Code className="h-4 w-4" />}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Project status badge */}
            <div className="absolute top-2 right-3 z-10">
              <Badge className={`backdrop-blur-sm border-0 px-2.5 py-0.5 shadow-lg text-xs ${project.status === 'Live'
                  ? 'bg-emerald-500/90 text-white'
                  : 'bg-amber-500/90 text-white'
                }`}>
                {project.status === 'Live' ? (
                  <Sparkles className="h-3 w-3 mr-1" />
                ) : (
                  <Rocket className="h-3 w-3 mr-1" />
                )}
                {project.status || 'Featured'}
              </Badge>
            </div>
          </div>

          {/* Title section */}
          <div className="px-6 pt-5 pb-2">
            <h3 className="text-xl font-bold text-foreground mb-1">{project.title}</h3>
            <div className="flex items-center text-muted-foreground text-sm">
              <Calendar className="h-4 w-4 mr-2" />
              {project.period}
            </div>
          </div>

          {/* Content section */}
          <div className="p-6 pt-3">
            {/* Tech stack */}
            <div className="flex flex-wrap gap-2 mb-5">
              {project.technologies.map((tech, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.05, duration: 0.3 }}
                  whileHover={{ scale: 1.1, y: -2 }}
                >
                  <Badge
                    variant="outline"
                    className="px-2.5 py-0.5 flex items-center gap-1.5 border font-medium transition-colors text-xs"
                    style={{
                      background: `${techColors[tech] || '#6366f1'}10`,
                      color: techColors[tech] || '#6366f1',
                      borderColor: `${techColors[tech] || '#6366f1'}40`
                    }}
                  >
                    {techIcons[tech] || <Code className="h-3 w-3" />}
                    {tech}
                  </Badge>
                </motion.div>
              ))}
            </div>

            {/* Description points - show first 2, expandable */}
            <ul className="space-y-3">
              {project.description.slice(0, isExpanded ? project.description.length : 2).map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-foreground/80 text-sm leading-relaxed">{item}</span>
                </motion.li>
              ))}
            </ul>

            {/* Expand button if more descriptions */}
            {project.description.length > 2 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-center gap-2 mt-4 py-2 text-muted-foreground hover:text-primary transition-colors"
              >
                <span className="text-sm font-medium">
                  {isExpanded ? 'Show Less' : `Show ${project.description.length - 2} More`}
                </span>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-border/50">
              <Button
                className="flex-1 btn-premium group"
                size="sm"
                onClick={() => navigate(`/project/${project.slug}`)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {project.slug === 'aerosec' ? 'Case Study' : project.status === 'Live' ? 'Full Architecture' : 'Architecture'}
                <ArrowRight className="ml-auto h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-primary/50 text-primary hover:bg-primary/10"
                asChild
              >
                <a href={project.github || '#'} target="_blank" rel="noopener noreferrer">
                  <Github className="h-4 w-4 mr-2" />
                  Code
                </a>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function Projects() {
  return (
    <section id="projects" className="pb-20 md:pb-24 section-light relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 right-0 w-40 md:w-80 h-40 md:h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-48 md:w-96 h-48 md:h-96 bg-accent/5 rounded-full blur-3xl" />

        {/* Floating particles - hidden on mobile for performance */}
        <div className="hidden md:block">
          {[...Array(10)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-primary/20"
              initial={{
                x: `${Math.random() * 100}%`,
                y: '100%'
              }}
              animate={{
                y: '-100%',
                opacity: [0, 1, 0]
              }}
              transition={{
                duration: Math.random() * 15 + 10,
                repeat: Infinity,
                delay: Math.random() * 5
              }}
            />
          ))}
        </div>
      </div>

      <div className="container px-4 md:px-6 relative z-10">
        {/* Section header */}
        <div className="text-center mb-10 md:mb-16">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="mb-3 md:mb-4 border-primary/40 text-primary px-3 md:px-4 py-1 text-xs md:text-sm">
              <Rocket className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1.5 md:mr-2" />
              Featured Work
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 text-foreground">
              Projects
            </h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto mb-4 md:mb-6 px-4">
              Production systems built with AWS, infrastructure as code,
              and modern CI/CD pipelines
            </p>
            <div className="w-16 md:w-24 h-1 bg-gradient-to-r from-primary via-accent to-primary mx-auto rounded-full" />
          </motion.div>
        </div>

        {/* Projects grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {PROJECTS.map((project, index) => (
            <ProjectCard key={index} project={project} index={index} />
          ))}
        </div>

        {/* More projects CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-16 text-center"
        >
          <Button variant="outline" size="lg" className="border-primary/50 text-primary hover:bg-primary/10 group" asChild>
            <a href="https://github.com/Siddardha-23" target="_blank" rel="noopener noreferrer">
              <Github className="mr-2 h-5 w-5" />
              View More on GitHub
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

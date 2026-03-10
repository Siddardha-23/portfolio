/**
 * InfraCostCalculator – Live infrastructure cost breakdown
 *
 * Shows real estimated AWS costs based on the actual Terraform-provisioned
 * architecture: S3 + CloudFront + Lambda + API Gateway + Route53 + ACM + CloudWatch.
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, DollarSign, Cloud, Server, Globe,
  Shield, Cpu, HardDrive, Wifi, Lock, Activity,
  TrendingDown, Zap, ChevronDown, ChevronUp,
} from 'lucide-react';

// ── Real cost items based on the Terraform config ──
interface CostItem {
  service: string;
  icon: React.ElementType;
  description: string;
  monthlyBase: number;    // base cost (always-on)
  perReqCost: number;      // per-request cost
  color: string;
  tier: 'free' | 'minimal' | 'moderate';
  awsFreeNote?: string;
  details: string[];
}

const TRAFFIC_PRESETS = [
  { label: 'Low', visitors: 500, requests: 5000, desc: 'Portfolio browsing' },
  { label: 'Moderate', visitors: 5000, requests: 50000, desc: 'Active job search' },
  { label: 'High', visitors: 25000, requests: 250000, desc: 'Viral / featured' },
];

const INFRA_COSTS: CostItem[] = [
  {
    service: 'CloudFront CDN',
    icon: Globe,
    description: 'Global edge caching across 400+ PoPs',
    monthlyBase: 0,
    perReqCost: 0.0000001,  // ~$0.01 per 10k requests
    color: '#8b5cf6',
    tier: 'free',
    awsFreeNote: '1TB transfer + 10M requests/mo free tier',
    details: [
      'Price class: PriceClass_100 (US, Canada, Europe)',
      '1 TB/month data transfer free tier',
      '10M HTTP/S requests/month free tier',
      'Custom SSL via ACM (free)',
      'Response headers policy (free)',
    ],
  },
  {
    service: 'S3 Static Hosting',
    icon: HardDrive,
    description: 'React SPA bundle + static assets',
    monthlyBase: 0.023, // ~$0.023/GB storage
    perReqCost: 0.0000004,  // $0.0004 per 1k GET requests
    color: '#10b981',
    tier: 'free',
    awsFreeNote: '5GB storage + 20K GET free tier',
    details: [
      'S3 Standard: $0.023/GB/month',
      'Bundle size: ~5MB → ~$0.0001/month storage',
      'GET requests: $0.0004 per 1,000',
      'All public access blocked (OAC only)',
      'Versioning disabled for cost savings',
    ],
  },
  {
    service: 'Lambda (Flask API)',
    icon: Cpu,
    description: 'Python 3.12 + Flask via Mangum adapter',
    monthlyBase: 0,
    perReqCost: 0.000016,  // ~$0.20 per 1M requests + compute
    color: '#f59e0b',
    tier: 'free',
    awsFreeNote: '1M requests + 400K GB-sec free tier',
    details: [
      '512MB memory, 90s timeout',
      '$0.20 per 1M requests',
      '$0.0000166667 per GB-second',
      'X-Ray active tracing enabled',
      '1M requests/month free tier',
      '400,000 GB-seconds/month free tier',
    ],
  },
  {
    service: 'API Gateway HTTP',
    icon: Server,
    description: 'HTTP API with throttling (50 req/s)',
    monthlyBase: 0,
    perReqCost: 0.000001,  // $1.00 per 1M requests
    color: '#3b82f6',
    tier: 'free',
    awsFreeNote: '1M requests free tier (12 months)',
    details: [
      'HTTP API (not REST — 70% cheaper)',
      '$1.00 per million requests',
      'Burst: 100 req/s, Rate: 50 req/s',
      'Auto-deploy staging enabled',
      'Access logging to CloudWatch',
    ],
  },
  {
    service: 'Route 53 DNS',
    icon: Wifi,
    description: '2 hosted zones (root + www)',
    monthlyBase: 1.00,  // $0.50/zone × 2 zones
    perReqCost: 0.0000004, // $0.40/1M queries
    color: '#ec4899',
    tier: 'minimal',
    details: [
      '$0.50 per hosted zone/month',
      '2 zones: root + subdomain aliases',
      'A + AAAA records for CloudFront',
      '$0.40 per million queries',
      'Health checks not enabled (cost saving)',
    ],
  },
  {
    service: 'ACM (SSL/TLS)',
    icon: Lock,
    description: 'Wildcard certificate for *.domain',
    monthlyBase: 0,
    perReqCost: 0,
    color: '#14b8a6',
    tier: 'free',
    awsFreeNote: 'Always free with CloudFront/ALB',
    details: [
      'Public certificates: always free',
      'DNS validation via Route 53',
      'Auto-renewal enabled',
      'Covers: root + *.domain',
    ],
  },
  {
    service: 'CloudWatch Logs',
    icon: Activity,
    description: 'Lambda + API Gateway logs (14-day retention)',
    monthlyBase: 0,
    perReqCost: 0.0000005, // $0.50/GB ingestion
    color: '#6366f1',
    tier: 'free',
    awsFreeNote: '5GB data ingestion free tier',
    details: [
      '$0.50 per GB ingested',
      '14-day retention (cost-optimized)',
      'Lambda log group + API Gateway logs',
      '5 GB ingestion free tier',
      'Log Insights: $0.005/GB scanned',
    ],
  },
  {
    service: 'SSM Parameter Store',
    icon: Shield,
    description: 'Secrets: MongoDB URI, JWT, API keys',
    monthlyBase: 0,
    perReqCost: 0,
    color: '#f97316',
    tier: 'free',
    awsFreeNote: 'Standard parameters: always free',
    details: [
      'Standard tier: free (up to 10K params)',
      '6 parameters stored (encrypted)',
      'SecureString with AWS-managed KMS',
      'Runtime fetch by Lambda',
    ],
  },
];

// Animated counter
function AnimatedNumber({ value, decimals = 2, prefix = '$' }: {
  value: number;
  decimals?: number;
  prefix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const startVal = ref.current;
    const diff = value - startVal;
    const duration = 800;
    const start = performance.now();

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = startVal + diff * eased;
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(animate);
      else ref.current = value;
    }
    requestAnimationFrame(animate);
  }, [value]);

  return (
    <span className="font-mono tabular-nums">
      {prefix}{display.toFixed(decimals)}
    </span>
  );
}

export default function InfraCostCalculator({ isOpen, onClose }: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [trafficLevel, setTrafficLevel] = useState(0); // index into TRAFFIC_PRESETS
  const [expanded, setExpanded] = useState<string | null>(null);
  const [awsData, setAwsData] = useState<{
    total: number;
    projected: number;
    services: { service: string; cost: number; previousMonth: number }[];
    lastMonthTotal: number;
    period: { start: string; end: string; daysElapsed: number };
  } | null>(null);
  const [awsLoading, setAwsLoading] = useState(false);
  const [isRealData, setIsRealData] = useState(false);

  // Fetch real costs from AWS Cost Explorer when modal opens
  useEffect(() => {
    if (!isOpen || awsData !== null) return;

    setAwsLoading(true);
    const apiBase = window.location.origin.includes('localhost')
      ? 'http://localhost:5000/api'
      : `${window.location.origin}/api`;

    fetch(`${apiBase}/infra/costs`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setAwsData({
            total: data.data.currentMonth.total,
            projected: data.data.currentMonth.projected,
            services: data.data.currentMonth.services,
            lastMonthTotal: data.data.lastMonth.total,
            period: data.data.currentMonth.period,
          });
          setIsRealData(true);
        }
      })
      .catch(() => {
        // Fallback silently — use Terraform estimates
      })
      .finally(() => setAwsLoading(false));
  }, [isOpen, awsData]);

  const traffic = TRAFFIC_PRESETS[trafficLevel];

  // Calculate costs — use real AWS data if available, otherwise static estimates
  const costs = INFRA_COSTS.map(item => {
    // If we have real AWS data, try to match services
    if (isRealData && awsData) {
      const matched = awsData.services.find(s =>
        s.service.toLowerCase().includes(item.service.split(' ')[0].toLowerCase()) ||
        item.service.toLowerCase().includes(s.service.split(' ')[0].toLowerCase())
      );
      if (matched) {
        return { ...item, requestCost: 0, total: matched.cost };
      }
    }
    // Fallback: estimate based on traffic preset
    const requestCost = item.perReqCost * traffic.requests;
    const total = item.monthlyBase + requestCost;
    return { ...item, requestCost, total };
  });

  const totalMonthly = isRealData && awsData ? awsData.total : costs.reduce((s, c) => s + c.total, 0);
  const totalAnnual = totalMonthly * 12;
  const freeCount = costs.filter(c => c.total < 0.01).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.4, type: 'spring', damping: 25 }}
            className="fixed inset-4 md:inset-y-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl z-[61] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full max-h-full flex flex-col">
              <div className="absolute -inset-1 bg-gradient-to-br from-green-500/15 via-emerald-500/5 to-green-500/15 rounded-3xl blur-xl opacity-60 pointer-events-none" />

              <div className="relative flex flex-col max-h-[90vh] bg-background/95 backdrop-blur-2xl rounded-3xl border border-border/50 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 bg-background/90 border-b border-border/50 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                        <DollarSign className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-foreground">Infrastructure Costs</h2>
                          {awsLoading ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-secondary text-muted-foreground rounded-full">Loading...</span>
                          ) : isRealData ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full">AWS Billing API</span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-full">Estimate</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {isRealData ? 'Actual current month spend from AWS Cost Explorer' : 'Estimated AWS cost breakdown from Terraform config'}
                        </p>
                      </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {/* Total Cost Hero */}
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-4"
                  >
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Monthly Infrastructure Cost</p>
                    <div className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-600">
                      <AnimatedNumber value={totalMonthly} decimals={2} />
                      <span className="text-lg font-normal text-muted-foreground">/mo</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      <AnimatedNumber value={totalAnnual} decimals={2} />/year •{' '}
                      {freeCount}/{INFRA_COSTS.length} services on free tier
                    </p>
                    <div className="flex items-center justify-center gap-1.5 mt-2">
                      <TrendingDown className="h-3.5 w-3.5 text-green-500" />
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                        ~95% cheaper than equivalent EC2 hosting
                      </span>
                    </div>
                  </motion.div>

                  {/* Traffic Slider */}
                  <div className="p-4 rounded-xl bg-secondary/20 border border-border/50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Traffic Simulation
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {traffic.visitors.toLocaleString()} visitors • {traffic.requests.toLocaleString()} requests
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {TRAFFIC_PRESETS.map((preset, i) => (
                        <button
                          key={preset.label}
                          onClick={() => setTrafficLevel(i)}
                          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-300 ${
                            i === trafficLevel
                              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg'
                              : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60'
                          }`}
                        >
                          <div className="font-semibold">{preset.label}</div>
                          <div className="text-[10px] opacity-80">{preset.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cost Breakdown */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Cloud className="h-3 w-3" />
                      Service-by-Service Breakdown
                    </h3>
                    {costs.map((item, i) => {
                      const Icon = item.icon;
                      const isExpanded = expanded === item.service;
                      const pct = totalMonthly > 0 ? (item.total / totalMonthly) * 100 : 0;

                      return (
                        <motion.div
                          key={item.service}
                          initial={{ opacity: 0, x: -15 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <button
                            onClick={() => setExpanded(isExpanded ? null : item.service)}
                            className="w-full text-left p-3 rounded-xl bg-secondary/15 border border-border/40 hover:border-border/70 transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="flex-shrink-0 p-1.5 rounded-lg"
                                style={{ background: item.color + '18' }}
                              >
                                <Icon className="h-4 w-4" style={{ color: item.color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-foreground">{item.service}</span>
                                  {item.total < 0.01 && (
                                    <span className="px-1.5 py-px text-[8px] font-bold uppercase bg-green-500/15 text-green-600 dark:text-green-400 rounded-full">
                                      Free
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
                              </div>
                              <div className="text-right flex items-center gap-2">
                                <div>
                                  <p className="text-sm font-bold font-mono text-foreground">
                                    ${item.total < 0.01 ? '0.00' : item.total.toFixed(2)}
                                  </p>
                                  {totalMonthly > 0 && item.total >= 0.01 && (
                                    <p className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% of total</p>
                                  )}
                                </div>
                                {isExpanded
                                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                }
                              </div>
                            </div>

                            {/* Cost bar */}
                            {totalMonthly > 0 && (
                              <div className="mt-2 h-1 bg-secondary/30 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{ background: item.color }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.max(pct, item.total > 0 ? 2 : 0)}%` }}
                                  transition={{ duration: 0.5, delay: i * 0.05 }}
                                />
                              </div>
                            )}
                          </button>

                          {/* Expanded details */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 py-3 ml-4 border-l-2" style={{ borderColor: item.color + '40' }}>
                                  {item.awsFreeNote && (
                                    <div className="flex items-center gap-1.5 mb-2 text-[11px] text-green-600 dark:text-green-400">
                                      <Zap className="h-3 w-3" />
                                      {item.awsFreeNote}
                                    </div>
                                  )}
                                  <ul className="space-y-1">
                                    {item.details.map((d, j) => (
                                      <li key={j} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                                        <span className="text-muted-foreground/50 mt-0.5">•</span>
                                        {d}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Architecture source badge */}
                  <div className="flex items-center justify-center gap-2 py-2">
                    <span className="text-[10px] text-muted-foreground/60">
                      Costs derived from Terraform config: S3 + CloudFront + Lambda + API Gateway + Route53 + ACM + CloudWatch + SSM
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-5 py-3 border-t border-border/50 bg-background/80 flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                    <DollarSign className="h-3 w-3 text-green-500" />
                    Prices from AWS us-east-1 • {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    Serverless = pay only for what you use
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
